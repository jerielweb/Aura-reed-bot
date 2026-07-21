import { fytBold } from "../../models/TextStyle.js";
import axios from "axios";
import FomatTime from "./../../controllers/functions/formatTimeCont.js";
import FornatNumber from "./../../controllers/functions/formatNumbers.js";

const API_KEY = "oboe";

async function getTikTokData(queryOrUrl) {
  const isUrl = queryOrUrl.includes("tiktok.com");
  
  if (isUrl) {
    const res = await axios.get("https://api.alyacore.xyz/dl/tiktokv2", {
      params: { url: queryOrUrl, key: API_KEY },
      timeout: 15000,
    });
    if (!res.data || !res.data.status) {
      throw new Error("No se pudo obtener el video de TikTok.");
    }
    return res.data.data;
  } else {
    const res = await axios.get("https://api.alyacore.xyz/search/tiktok", {
      params: { query: queryOrUrl, key: API_KEY },
      timeout: 15000,
    });
    const results = res.data?.data || [];
    if (!results.length) {
      throw new Error("No se encontraron resultados para tu búsqueda.");
    }
    return results[0];
  }
}

export default {
  name: ["tt", "tiktok", "ttdl", "tiktokdl"],
  description: "Descarga videos de TikTok",
  category: "downloads",

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    let text = args.join(" ").trim();

    if (!text) {
      let errorText = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      errorText += `┃ ❌ ${fytBold("FALTA BUSQUEDA")}\n`;
      errorText += `╰━━━━━━━━━━━━⬣\n\n`;
      errorText += `┃ > Por favor, proporciona un\n`;
      errorText += `┃ > enlace de TikTok\n`;
      errorText += `┃ > o una busqueda.\n\n`;
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
      const data = await getTikTokData(text);

      const videoUrl = data.dl || data.watermark;
      if (!videoUrl) throw new Error("No se encontró el enlace de descarga del video.");

      const title = data.title?.trim() || "Sin título";
      const authorName = data.author?.nickname || "N/A";
      const authorTag = data.author?.unique_id ? `@${data.author.unique_id}` : "";
      const views = FornatNumber(data.stats?.views || 0);
      const likes = FornatNumber(data.stats?.likes || 0);
      const comments = FornatNumber(data.stats?.comments || 0);
      const shares = FornatNumber(data.stats?.shares || 0);
      const duration = data.duration || "N/A";

      let caption = `╭〔 ${fytBold("TIKTOK DOWNLOADER")} 〕━⬣\n\n`;
      caption += `┃ 🎬 ${fytBold("DESCARGANDO VIDEO")}\n`;
      caption += `┃ ⏳ Espere un momento...\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(title)}\n\n`;
      caption += `┃ > ${fytBold("Autor:")} › ${authorName} ${authorTag}\n`;
      caption += `┃ > ${fytBold("Duración:")} › ${duration}\n`;
      caption += `┃ > ${fytBold("Vistas:")} › ${views}\n`;
      caption += `┃ > ${fytBold("Likes:")} › ${likes}\n`;
      caption += `┃ > ${fytBold("Comentarios:")} › ${comments}\n`;
      caption += `┃ > ${fytBold("Compartidos:")} › ${shares}\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ > El video se está\n`;
      caption += `┃ > enviando, espera un momento...\n\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      const videoRes = await axios.get(videoUrl, {
        responseType: "arraybuffer",
        timeout: 30000,
      });

      const videoBuffer = Buffer.from(videoRes.data);

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
