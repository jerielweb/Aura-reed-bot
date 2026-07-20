import fetch from "node-fetch";
import fs from "fs";
import path from "path";
import { fytBold } from "../../models/TextStyle.js";

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "Accept-Encoding": "identity",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
  return await res.json();
}

export default {
  name: ["md", "mf", "mediafire"],
  category: "downloads",
  description: "Descarga archivos de Mediafire omitiendo la detección manual de tipos.",

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
      const apiKey = global.Apis?.apiAiya?.apikey || "oboe";
      const apiUrl = `https://api.alyacore.xyz/dl/mediafire?url=${encodeURIComponent(link)}&key=${apiKey}`;

      const resData = await fetchJson(apiUrl);

      if (!resData?.status || !resData?.result) {
        throw new Error("No se pudo obtener la información del archivo desde la API.");
      }

      const { filename, filetype, filesize, uploaded, download } = resData.result;

      // Limpiamos solo caracteres prohibidos del sistema de archivos, manteniendo el nombre original con su extensión
      const finalFileName = (filename || "archivo").replace(/[<>:"/\\|?*]/g, "");

      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      cachePath = path.join(cacheDir, finalFileName);

      if (fs.existsSync(cachePath)) {
        console.log(`[MEDIAFIRE CACHE] [HIT] Archivo en caché local: ${cachePath}`);
        isCacheHit = true;
      } else {
        console.log(`[MEDIAFIRE CACHE] [MISS] Descargando desde enlace directo...`);

        const res = await fetch(download, {
          headers: {
            "Accept-Encoding": "identity",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
        });

        if (!res.ok) throw new Error(`Fallo al descargar el archivo: ${res.statusText}`);

        const fileStream = fs.createWriteStream(cachePath);
        await new Promise((resolve, reject) => {
          res.body.pipe(fileStream);
          res.body.on("error", reject);
          fileStream.on("finish", resolve);
          fileStream.on("error", reject);
        });

        console.log(`[MEDIAFIRE CACHE] [SAVE] Guardado en caché local: ${cachePath}`);
      }

      const motorLabel = isCacheHit ? "Mediafire (Caché)" : "Mediafire";

      // 1️⃣ Plantilla informativa
      let caption = `╭〔 📦 ${fytBold("MEDIAFIRE DOWNLOADER")} 〕━⬣\n\n`;
      caption += `┃ 📂 ${fytBold("DESCARGANDO ARCHIVO")}\n`;
      caption += `┃ ⏳ Espere un momento...\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(finalFileName)}\n\n`;
      caption += `┃ > ${fytBold("Tamaño:")} › ${filesize || "Desconocido"}\n`;
      caption += `┃ > ${fytBold("Tipo:")} › ${filetype || "Archivo"}\n`;
      caption += `┃ > ${fytBold("Subido:")} › ${uploaded || "N/A"}\n`;
      caption += `┃ > ${fytBold("Motor:")} › ${motorLabel}\n`;
      caption += `┃ > ${fytBold("Link:")} › ${link}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ > El archivo se esta\n`;
      caption += `┃ > enviando, espera un momento...\n\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      // Primer envío: Texto informativo
      await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });

      // Segundo envío: Documento enviando directamente la ruta local sin mimetype forzado
      await socket.sendMessage(
        remoteJid,
        {
          document: { url: cachePath },
          fileName: finalFileName,
          mimetype: "application/octet-stream", // Mimetype genérico; WhatsApp usa el fileName para asignarle el formato al usuario
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
