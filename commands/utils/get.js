import axios from "axios";
import { fileTypeFromBuffer } from "file-type";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_CODE_MESSAGE_SIZE = 12000;
const CODE_EXTENSIONS = new Set([
  "c",
  "cpp",
  "cs",
  "css",
  "go",
  "html",
  "java",
  "js",
  "json",
  "jsx",
  "kt",
  "md",
  "php",
  "py",
  "rb",
  "rs",
  "sh",
  "sql",
  "ts",
  "tsx",
  "txt",
  "xml",
  "yaml",
  "yml",
]);

function getFileName(url, contentDisposition, extension = "bin") {
  const dispositionName = contentDisposition?.match(
    /filename\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i,
  )?.[1];

  if (dispositionName) return decodeURIComponent(dispositionName);

  try {
    const pathname = new URL(url).pathname;
    const name = decodeURIComponent(pathname.split("/").pop() || "");
    if (name && name.includes(".")) return name;
  } catch {}

  return `archivo.${extension}`;
}

function normalizeMimeType(mimeType = "") {
  return mimeType.split(";", 1)[0].trim().toLowerCase();
}

function mimeTypeFromExtension(fileName) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return (
    {
      avif: "image/avif",
      bmp: "image/bmp",
      gif: "image/gif",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      m4a: "audio/mp4",
      mkv: "video/x-matroska",
      mp3: "audio/mpeg",
      mp4: "video/mp4",
      ogg: "audio/ogg",
      opus: "audio/ogg",
      png: "image/png",
      wav: "audio/wav",
      webm: "video/webm",
      webp: "image/webp",
      zip: "application/zip",
    }[extension] || "application/octet-stream"
  );
}

function isCodeContent(mimeType, fileName) {
  const extension = fileName.split(".").pop()?.toLowerCase();
  return (
    (mimeType.startsWith("text/") && mimeType !== "text/html") ||
    mimeType.includes("json") ||
    mimeType.includes("javascript") ||
    mimeType.includes("xml") ||
    CODE_EXTENSIONS.has(extension)
  );
}

function getExtension(mimeType) {
  return (
    {
      "application/pdf": "pdf",
      "application/zip": "zip",
      "application/json": "json",
      "text/plain": "txt",
      "text/html": "html",
    }[mimeType] ||
    mimeType.split("/")[1]?.split(";")[0] ||
    "bin"
  );
}

export default {
  name: ["get", "fetch", "download"],
  category: "utils",
  description: "Descarga y envía cualquier contenido desde una URL",
  ownerOnly: false,

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const url = args.join(" ").trim();

    if (!/^https?:\/\//i.test(url)) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "❌ Proporciona una URL válida. Ejemplo: .get https://sitio.com/archivo",
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⬇️", key: message.key },
    });

    try {
      const response = await axios.get(url, {
        responseType: "arraybuffer",
        timeout: 60000,
        maxContentLength: MAX_FILE_SIZE,
        maxBodyLength: MAX_FILE_SIZE,
        headers: {
          "User-Agent": "Mozilla/5.0 AuraReedBot",
        },
      });

      const buffer = Buffer.from(response.data);
      const detectedType = await fileTypeFromBuffer(buffer);
      const headerType = normalizeMimeType(response.headers["content-type"]);
      const fileName = getFileName(
        url,
        response.headers["content-disposition"],
        detectedType?.ext || getExtension(headerType),
      );
      const extensionType = mimeTypeFromExtension(fileName);
      const mimeType =
        detectedType?.mime ||
        (headerType && headerType !== "application/octet-stream"
          ? headerType
          : extensionType);
      const extension = detectedType?.ext || getExtension(mimeType);

      let payload;
      if (
        isCodeContent(mimeType, fileName) &&
        buffer.length <= MAX_CODE_MESSAGE_SIZE
      ) {
        const code = buffer.toString("utf8");
        payload = {
          text: `*${fileName}*\n\n${"```"}\n${code}\n${"```"}`,
        };
      } else if (mimeType.startsWith("image/") && mimeType !== "image/gif") {
        payload = { image: buffer, mimetype: mimeType, caption: fileName };
      } else if (mimeType.startsWith("video/")) {
        payload = { video: buffer, mimetype: mimeType, fileName };
      } else if (mimeType.startsWith("audio/")) {
        payload = { audio: buffer, mimetype: mimeType, fileName };
      } else {
        payload = {
          document: buffer,
          mimetype: mimeType,
          fileName,
        };
      }

      await socket.sendMessage(remoteJid, payload, { quoted: message });
      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en get:", error.message);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text:
            error.code === "ERR_BAD_RESPONSE" || error.response
              ? `❌ No se pudo descargar el contenido (${error.response?.status || "respuesta inválida"}).`
              : `❌ No se pudo descargar el contenido: ${error.message}`,
        },
        { quoted: message },
      );
    }
  },
};
