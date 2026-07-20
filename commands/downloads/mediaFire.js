import fs from "fs";
import path from "path";
import axios from "axios";
import * as cheerio from "cheerio";
import { fytBold } from "../../models/TextStyle.js";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

function parseKey(url) {
  const m = url.match(/mediafire\.com\/file\/([a-z0-9]+)/);
  return m ? m[1] : null;
}

function deduplicateName(raw) {
  const clean = raw.trim().replace(/\s+/g, " ");
  const half = Math.ceil(clean.length / 2);
  const first = clean.slice(0, half);
  const second = clean.slice(half).trim();
  return second.startsWith(first.trim()) ? first.trim() : clean;
}

async function tryPage(url) {
  const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
  const $ = cheerio.load(res.data);
  const link = $("a#downloadButton").attr("href") || $("a.input").attr("href");
  if (!link) throw new Error("page: sin link de descarga");
  const name = deduplicateName($("div.filename").text());
  const size = $("ul.details li").first().text().replace("File size:", "").trim();
  return { link, name, size };
}

async function tryAPI(key) {
  const res = await axios.get(
    `https://www.mediafire.com/api/1.5/file/get_links.php?quick_key=${key}&link_type=normal_download&response_format=json`,
    { headers: HEADERS, timeout: 15000 }
  );
  const data = res.data?.response;
  if (data?.result !== "Success") throw new Error("api: " + (data?.message || "sin resultado"));
  const dl = data?.links?.[0]?.normal_download;
  if (!dl) throw new Error("api: sin download link");
  return dl;
}

async function mediafireInfo(url) {
  if (!url.includes("mediafire.com")) throw new Error("URL de MediaFire inválida");

  const key = parseKey(url);
  const errors = [];
  let info = null;

  try {
    info = await tryPage(url);
  } catch (e) {
    errors.push("page: " + e.message);
  }

  if (!info?.link && key) {
    try {
      const link = await tryAPI(key);
      info = { ...(info || {}), link };
    } catch (e) {
      errors.push("api: " + e.message);
    }
  }

  if (!info?.link) throw new Error("No se pudo obtener el link. Errores: " + errors.join(" | "));

  return {
    key: key || "",
    name: info.name || "archivo_desconocido",
    size: info.size || "Desconocido",
    download: info.link,
    url,
  };
}

export default {
  name: ["md", "mf", "mediafire"],
  category: "downloads",
  description: "Descarga archivos de Mediafire usando scraper local con caché.",

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const link = args.join(" ").trim();

    if (!link) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA ENLACE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > enlace de Mediafire.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message }
      );
    }

    if (!link.includes("mediafire.com")) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("ENLACE INVÁLIDO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > enlace de Mediafire válido.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message }
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    const cacheDir = path.resolve("./tmp");
    let cachePath = null;
    let isCacheHit = false;

    try {
      // Obtener metadatos mediante el scraper
      const fileData = await mediafireInfo(link);

      // Limpiar nombre de archivo para evitar errores en SO
      const finalFileName = fileData.name.replace(/[<>:"/\\|?*]/g, "");

      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      cachePath = path.join(cacheDir, finalFileName);

      if (fs.existsSync(cachePath)) {
        console.log(`[MEDIAFIRE CACHE] [HIT] Archivo en caché local: ${cachePath}`);
        isCacheHit = true;
      } else {
        console.log(`[MEDIAFIRE CACHE] [MISS] Descargando archivo directo...`);

        const res = await axios({
          method: "get",
          url: fileData.download,
          responseType: "stream",
          headers: HEADERS,
        });

        const fileStream = fs.createWriteStream(cachePath);
        await new Promise((resolve, reject) => {
          res.data.pipe(fileStream);
          res.data.on("error", reject);
          fileStream.on("finish", resolve);
          fileStream.on("error", reject);
        });

        console.log(`[MEDIAFIRE CACHE] [SAVE] Guardado en caché local: ${cachePath}`);
      }

      const motorLabel = isCacheHit ? "Scraper Local (Caché)" : "Scraper Local";

      // 1️⃣ Mensaje informativo
      let caption = `╭〔 📦 ${fytBold("MEDIAFIRE DOWNLOADER")} 〕━⬣\n\n`;
      caption += `┃ 📂 ${fytBold("DESCARGANDO ARCHIVO")}\n`;
      caption += `┃ ⏳ Espere un momento...\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(finalFileName)}\n\n`;
      caption += `┃ > ${fytBold("Tamaño:")} › ${fileData.size}\n`;
      caption += `┃ > ${fytBold("Motor:")} › ${motorLabel}\n`;
      caption += `┃ > ${fytBold("Link:")} › ${link}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ > El archivo se esta\n`;
      caption += `┃ > enviando, espera un momento...\n\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      // Envío 1: Texto
      await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });

      // Envío 2: Documento por separado
      await socket.sendMessage(
        remoteJid,
        {
          document: { url: cachePath },
          fileName: finalFileName,
          mimetype: "application/octet-stream",
        },
        { quoted: message }
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });

    } catch (error) {
      console.error("Error en Mediafire Downloader:", error);

      if (cachePath && fs.existsSync(cachePath) && !isCacheHit) {
        try {
          fs.unlinkSync(cachePath);
        } catch (err) {
          console.error("[MEDIAFIRE CACHE] Error al limpiar archivo corrupto:", err);
        }
      }

      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });

      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR DE DESCARGA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Ocurrió un error inesperado."}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message }
      );
    }
  },
};
