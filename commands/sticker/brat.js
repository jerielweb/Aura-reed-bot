import axios from "axios";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";
import { ffmpegSemaphore } from "../../controllers/downloadUtils.js";

const execAsync = promisify(exec);

const customTemp = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../../tmp",
);
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });

function buildUrl(base, path) {
  return `${base.replace(/\/+$|\s+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function decodeStickerResponse(data) {
  if (!data) return null;

  let rawBuffer = null;

  if (Buffer.isBuffer(data)) {
    rawBuffer = data;
  } else if (data instanceof ArrayBuffer) {
    rawBuffer = Buffer.from(data);
  } else if (typeof data === "string") {
    const raw = data.startsWith("data:") ? data.split(",")[1] : data;
    return Buffer.from(raw, "base64");
  } else if (typeof data === "object") {
    const payload = data.image || data.result || data.data || data.sticker;
    if (payload) {
      const raw =
        typeof payload === "string" && payload.startsWith("data:")
          ? payload.split(",")[1]
          : payload;
      return Buffer.from(raw, "base64");
    }
    return null;
  } else {
    return null;
  }

  const text = rawBuffer.toString("utf8").trim();
  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      const parsed = JSON.parse(text);
      const payload =
        parsed.image || parsed.result || parsed.data || parsed.sticker;
      if (payload) {
        const raw =
          typeof payload === "string" && payload.startsWith("data:")
            ? payload.split(",")[1]
            : payload;
        return Buffer.from(raw, "base64");
      }
    } catch {
      return rawBuffer;
    }
  }

  return rawBuffer;
}

async function raceStickerApis(apis) {
  const runners = apis.map((api) =>
    api.request().then((res) => {
      const buffer = decodeStickerResponse(res.data);
      if (!buffer || !buffer.length) {
        throw new Error(`[${api.name}] no devolvió sticker válido`);
      }
      return buffer;
    }),
  );

  if (typeof Promise.any === "function") {
    return Promise.any(runners);
  }

  const results = await Promise.allSettled(runners);
  for (const result of results) {
    if (result.status === "fulfilled") return result.value;
  }
  throw new Error(
    results
      .map((r) =>
        r.status === "rejected" ? r.reason?.message || String(r.reason) : "ok",
      )
      .join(", "),
  );
}

export default {
  name: ["brat"],
  category: "sticker",
  description: "Convierte texto o mensaje respondido en sticker estilo brat.",

  execute: async (sock, message, args) => {
    const remoteJid = message.key.remoteJid;
    const textArg = args.join(" ").trim();

    const quotedMsg =
      message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const quotedText =
      quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || "";

    const text = textArg || quotedText;

    if (!text) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: "╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐓𝐄𝐗𝐓𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ > Escribe un texto o responde a un mensaje\n┃ > para convertirlo en sticker.\n",
        },
        { quoted: message },
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    const apis = [
      {
        name: "AlyaCore tools/brat",
        request: () =>
          axios.get(buildUrl(global.Apis.apiAiya.url, "tools/brat"), {
            params: { text, key: global.Apis.apiAiya.apikey },
            responseType: "arraybuffer",
            timeout: 60000,
          }),
      },
      {
        name: "api-faa.my.id faa/brat",
        request: () =>
          axios.get(buildUrl(global.Apis.appiFaa.url, "faa/brat"), {
            params: { text },
            responseType: "arraybuffer",
            timeout: 60000,
          }),
      },
      {
        name: "AlyaCore api/v1/utilidades/brat",
        request: () =>
          axios.get(
            buildUrl(global.Apis.apiAiya.url, "api/v1/utilidades/brat"),
            {
              params: { apikey: global.Apis.apiAiya.apikey, text },
              responseType: "arraybuffer",
              timeout: 60000,
            },
          ),
      },
    ];

    try {
      const stickerBuffer = await raceStickerApis(apis);
      const tempId = Date.now();
      const inputPath = path.join(customTemp, `aura-brat-input-${tempId}`);
      const outputPath = path.join(
        customTemp,
        `aura-brat-output-${tempId}.webp`,
      );

      await fs.promises.writeFile(inputPath, stickerBuffer);

      const filtroVideo = `format=rgba,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=0x000000@0,fps=15`;
      const cmd = `"${ffmpegStatic}" -y -i "${inputPath}" -vcodec libwebp -vf "${filtroVideo}" -loop 0 -preset default -an -vsync 0 -f webp "${outputPath}"`;

      await ffmpegSemaphore.run(() =>
        execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 }),
      );

      const webpStickerBuffer = await fs.promises.readFile(outputPath);

      // Obtener el nombre del usuario y formatear metadatos
      const pushName = message.pushName || "Usuario";
      const packName = "𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝";
      const author = `@${pushName}`;

      let finalStickerBuffer;
      try {
        const { addStickerMetadata } =
          await import("../../controllers/stickerMetadata.js");
        finalStickerBuffer = await addStickerMetadata(
          webpStickerBuffer,
          packName,
          author,
        );
      } catch (err) {
        console.error("[Brat] Error al inyectar metadatos:", err);
        finalStickerBuffer = webpStickerBuffer;
      }

      await sock.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
      await sock.sendMessage(
        remoteJid,
        { sticker: finalStickerBuffer, mimetype: "image/webp" },
        { quoted: message },
      );

      await Promise.allSettled([
        fs.promises.unlink(inputPath),
        fs.promises.unlink(outputPath),
      ]);
    } catch (error) {
      console.error("Error al crear sticker brat:", error);
      return await sock.sendMessage(
        remoteJid,
        {
          text: "╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐀𝐋 𝐂𝐑𝐄𝐀𝐑 𝐒𝐓𝐈𝐂𝐊𝐄𝐑\n╰━━━━━━━━━━━━⬣\n\n┃ > No pude generar el sticker.\n┃ > Revisa las APIs o intenta con otro texto.\n",
        },
        { quoted: message },
      );
    }
  },
};
