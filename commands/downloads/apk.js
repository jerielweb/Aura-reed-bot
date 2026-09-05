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

function normalize(apiResult, motorName) {
  if (!apiResult || !apiResult.status || !apiResult.data) {
    throw new Error(
      `[${motorName}] No se encontraron resultados para esta aplicación`,
    );
  }

  const data = apiResult.data;

  const name = data.name || "Aplicación Desconocida";
  const packageId = data.package || "com.unknown";
  const size = data.size || "N/A";
  const lastUpdated = data.lastUpdated || "N/A";
  const banner = data.banner || null;
  const dl = data.dl;

  if (!dl) {
    throw new Error(`[${motorName}] No se pudo obtener el enlace de descarga`);
  }

  return {
    name,
    packageId,
    size,
    lastUpdated,
    banner,
    dl,
    motor: motorName,
  };
}

export default {
  name: ["apk", "apkdl", "apkd", "apks", "apkdownload", "androidapp", "app"],
  category: "downloads",
  description: "Descarga archivos APK de Android.",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const query = args.join(" ").trim();

    if (!query) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona el nombre\n┃ > de la aplicación APK a buscar.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    const cacheDir = path.resolve("./tmp");
    let cachePath = null;
    let isCacheHit = false;

    try {
      const resData = await fetchJson(
        `https://api.alyacore.xyz/search/apk?query=${encodeURIComponent(query)}&key=oboe`,
      );
      const metadata = normalize(resData, "AlyaCore");

      const { name, packageId, size, lastUpdated, banner, dl, motor } =
        metadata;

      if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
      }

      cachePath = path.join(cacheDir, `${packageId}.apk`);

      if (fs.existsSync(cachePath)) {
        console.log(
          `[APK CACHE] [HIT] Encontrado APK en caché local: ${cachePath}`,
        );
        isCacheHit = true;
      } else {
        console.log(`[APK CACHE] [MISS] Descargando binario desde la API...`);

        const res = await fetch(dl, {
          headers: {
            "Accept-Encoding": "identity",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
          },
        });
        if (!res.ok)
          throw new Error(`Fallo al descargar APK: ${res.statusText}`);

        const fileStream = fs.createWriteStream(cachePath);
        await new Promise((resolve, reject) => {
          res.body.pipe(fileStream);
          res.body.on("error", reject);
          fileStream.on("finish", resolve);
          fileStream.on("error", reject);
        });

        console.log(
          `[APK CACHE] [SAVE] Guardando APK en caché local: ${cachePath}`,
        );
      }

      const motorLabel = isCacheHit ? `${motor} (Caché)` : motor;

      let caption = `╭〔 🤖 𝐀𝐏𝐊 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 〕━⬣\n\n`;
      caption += `┃ ➥ ${fytBold("Aplicación")} › ${name}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ > ${fytBold("ID App")} › ${packageId}\n`;
      caption += `┃ > ${fytBold("Tamaño")} › ${size}\n`;
      caption += `┃ > ${fytBold("Versión")} › ${lastUpdated}\n`;
      caption += `┃ > ${fytBold("Tipo")} › Aplicación (APK)\n`;
      caption += `┃ > ${fytBold("Fuente")} › ${motorLabel}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ ⏳ Descargando APK...\n`;
      caption += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

      if (banner) {
        await socket.sendMessage(
          remoteJid,
          { image: { url: banner }, caption },
          { quoted: message },
        );
      } else {
        await socket.sendMessage(
          remoteJid,
          { text: caption },
          { quoted: message },
        );
      }

      await socket.sendMessage(
        remoteJid,
        {
          document: { url: cachePath },
          mimetype: "application/vnd.android.package-archive",
          fileName: `${name.replace(/[<>:"/\\|?*]/g, "")}.apk`,
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en APK Downloader:", error);

      if (cachePath && fs.existsSync(cachePath) && !isCacheHit) {
        try {
          fs.unlinkSync(cachePath);
        } catch (err) {
          console.error("[APK CACHE] Error al limpiar archivo corrupto:", err);
        }
      }

      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Ocurrió un error inesperado."}\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
