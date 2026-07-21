import { fytBold } from "../../models/TextStyle.js";
import axios from "axios";
import FornatNumber from "./../../controllers/functions/formatNumbers.js";

const API_KEY = "oboe";

async function getDownloadData(tiktokUrl) {
  const res = await axios.get("https://api.alyacore.xyz/dl/tiktokv2", {
    params: { url: tiktokUrl, key: API_KEY },
    timeout: 15000,
  });
  if (!res.data || !res.data.status) {
    throw new Error("No se pudo obtener el video de TikTok.");
  }
  return res.data.data;
}

async function searchTikTok(query) {
  const res = await axios.get("https://api.alyacore.xyz/search/tiktok", {
    params: { query, key: API_KEY },
    timeout: 15000,
  });
  const results = res.data?.data || [];
  if (!results.length) {
    throw new Error("No se encontraron resultados para tu búsqueda.");
  }
  return results[0];
}

export default {
  name: ["tt", "tiktok", "ttdl", "tiktokdl"],
  description: "Descarga o busca videos de TikTok",
  category: "downloads",

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      let errorText = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      errorText += `┃ ❌ ${fytBold("FALTA BÚSQUEDA O LINK")}\n`;
      errorText += `╰━━━━━━━━━━━━⬣\n\n`;
      errorText += `┃ > Proporciona un enlace de TikTok\n`;
      errorText += `┃ > o un término de búsqueda.\n\n`;
      errorText += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text: errorText },
        { quoted: message }
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      const isUrl = text.includes("tiktok.com");
      let videoData;
      let targetUrl = text;

      if (isUrl) {
        videoData = await getDownloadData(text);
      } else {
        const firstResult = await searchTikTok(text);
        
        targetUrl = firstResult.url || `https://www.tiktok.com/@${firstResult.author?.unique_id || "user"}/video/${firstResult.id}`;
        
        const searchInfo = `╭〔 🔍 ${fytBold("TIKTOK SEARCH")} 〕━⬣\n\n` +
          `┃ ➥ ${fytBold(firstResult.title || "Sin título")}\n\n` +
          `┃ > ${fytBold("Autor:")} › ${firstResult.author?.nickname || "N/A"} (@${firstResult.author?.unique_id || ""})\n` +
          `┃ > ${fytBold("Duración:")} › ${firstResult.duration || "N/A"}\n` +
          `┃ > ${fytBold("Vistas:")} › ${FornatNumber(firstResult.stats?.views || 0)}\n` +
          `┃ > ${fytBold("Likes:")} › ${FornatNumber(firstResult.stats?.likes || 0)}\n` +
          `┃ > ${fytBold("Enlace:")} › ${targetUrl}\n\n` +
          `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

        await socket.sendMessage(remoteJid, { text: searchInfo }, { quoted: message });

        try {
          videoData = await getDownloadData(targetUrl);
        } catch {
          videoData = firstResult;
        }
      }

      const videoUrl = videoData.dl || videoData.nowm || videoData.watermark || videoData.video;
      if (!videoUrl) throw new Error("No se encontró el enlace directo del video.");

      const videoRes = await axios.get(videoUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
      });

      const videoBuffer = Buffer.from(videoRes.data);

      let caption = `╭〔 ${fytBold("TIKTOK DOWNLOADER")} 〕━⬣\n\n`;
      caption += `┃ 🎬 ${fytBold(videoData.title?.trim() || "TikTok Video")}\n`;
      caption += `┃ > ${fytBold("Autor:")} › ${videoData.author?.nickname || "N/A"}\n\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      await socket.sendMessage(
        remoteJid,
        {
          video: videoBuffer,
          caption: caption,
          mimetype: "video/mp4",
        },
        { quoted: message }
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error(error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        { text: `❌ Error: ${error.message}` },
        { quoted: message }
      );
    }
  },
};
