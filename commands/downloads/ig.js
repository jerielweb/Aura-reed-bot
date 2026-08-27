import fs from "fs";
import path from "path";
import os from "os";
import { fetchJson, downloadStreamToFile } from "../../controllers/downloadUtils.js";

const IG_REGEX = /^(https?:\/\/)?(www\.)?(instagram\.com|instagr\.am)\/.*$/i;

function normalizeAlyacore(res) {
  if (!res || !res.status || !res.data || !res.data.dl) {
    throw new Error("Alyacore no devolvió datos válidos para Instagram");
  }

  const dl = res.data.dl;
  const type = (res.data.type || "video").toLowerCase();
  return {
    urls: [dl],
    type,
    title: res.data.title || null,
    username: res.data.username || null,
    motor: "Alyacore",
  };
}

function normalizeDelirius(res) {
  if (!res || !res.status || !Array.isArray(res.data) || res.data.length === 0) {
    throw new Error("Delirius no devolvió datos válidos para Instagram");
  }

  // Delirius devuelve un array de objetos { type, url }
  const items = res.data.filter((d) => d && d.url);
  if (items.length === 0) throw new Error("Delirius: no hay URLs válidas");

  const type = (items[0].type || "video").toLowerCase();
  const urls = items.map((i) => i.url);

  return {
    urls,
    type,
    title: null,
    username: null,
    motor: "Delirius",
  };
}

export default {
  name: ["ig", "instagram", "igdl", "instadl", "reel", "instareel"],
  category: "downloads",
  description: "Descarga posts y reels de Instagram usando Delirius (fallback Alyacore).",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const url = args[0] ? args[0].trim() : "";

    if (!url || !IG_REGEX.test(url)) {
      return await socket.sendMessage(remoteJid, {
        text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐄𝐍𝐋𝐀𝐂𝐄\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un enlace\n┃ > válido de Instagram (post o reel).\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
      }, { quoted: message });
    }

    await socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

    const tempId = Date.now();
    const tempDir = os.tmpdir();
    const tempPath = path.join(tempDir, `aura-igdl-${tempId}.mp4`);

    try {
      console.log(`[IG Downloader] Intentando Delirius para: ${url}`);
      let meta;

      try {
        const delApi = `https://api.delirius.online/download/instagram?url=${encodeURIComponent(url)}`;
        const delRes = await fetchJson(delApi, 30000);
        meta = normalizeDelirius(delRes);
        console.log(`[IG Downloader] Delirius respondió correctamente`);
      } catch (delErr) {
        console.warn(`[IG Downloader] Delirius falló: ${delErr.message}. Intentando Alyacore...`);
        // Intentar Alyacore como fallback
        const apiUrl = `${global.Apis.apiAiya.url}/dl/instagram?url=${encodeURIComponent(url)}&key=${global.Apis.apiAiya.apikey}`;
        const alyRes = await fetchJson(apiUrl, 30000);
        meta = normalizeAlyacore(alyRes);
      }

      const { urls, type, title, motor } = meta;

      let caption = `╭〔 📸 𝐈𝐍𝐒𝐓𝐀𝐆𝐑𝐀𝐌 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 〕━⬣\n\n`;
      caption += `┃ ➥ ${title || "Sin título"}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > 𝐌𝐨𝐝𝐨 › ${type === "image" ? "Imagen(es)" : "Video (MP4)"}\n`;
      caption += `┃ > 𝐌𝐨𝐭𝐨𝐫 › ${motor}\n\n`;
      caption += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      if (type === "image") {
        // Enviar cada imagen (WhatsApp acepta URLs remotas)
        for (let i = 0; i < urls.length; i++) {
          const imgUrl = urls[i];
          await socket.sendMessage(remoteJid, { image: { url: imgUrl }, caption: i === 0 ? caption : "" }, { quoted: message });
        }
      } else {
        // Para video, descargar la primera URL y enviar
        const mediaUrl = urls[0];
        await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });
        await downloadStreamToFile(mediaUrl, tempPath, { timeout: 120000 });

        await socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } });
        await socket.sendMessage(remoteJid, {
          video: { url: tempPath },
          mimetype: "video/mp4",
          fileName: `instagram_${tempId}.mp4`,
          caption: `🎬 *Instagram Video*\n${title || ""}`,
        }, { quoted: message });
      }

    } catch (error) {
      console.error("Error en Instagram Downloader:", error);
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
      await socket.sendMessage(remoteJid, { text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Ocurrió un error al procesar el enlace de Instagram."}\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` }, { quoted: message });
    } finally {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (e) {
        // Ignorar errores de limpieza
      }
    }
  },
};
