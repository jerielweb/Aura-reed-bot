import axios from "axios";
import { fytBold } from "../../models/TextStyle.js";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export default {
  name: ["tt", "tiktok"],
  category: "downloads",
  description: "Descarga videos de TikTok por enlace o término de búsqueda de forma directa.",

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const query = args.join(" ").trim();

    if (!query) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA PARÁMETRO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un enlace\n┃ > de TikTok o un término de búsqueda.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message }
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      const apiKey = global.Apis?.apiAiya?.apikey || "oboe";
      const isUrl = /(tiktok\.com)/i.test(query);

      let videoData = null;

      if (isUrl) {
        // Opción 1: Enlace directo
        const apiUrl = `https://api.alyacore.xyz/dl/tiktok?url=${encodeURIComponent(query)}&key=${apiKey}`;
        const res = await axios.get(apiUrl, { headers: HEADERS, timeout: 15000 });
        const resData = res.data;

        if (!resData?.status || !resData?.data) {
          throw new Error("No se pudo obtener información del enlace provisto.");
        }

        const nowmObj = resData.data.find((item) => item.type === "nowatermark_hd") || 
                        resData.data.find((item) => item.type === "nowatermark");

        videoData = {
          id: resData.id,
          title: resData.title || "Sin título",
          downloadUrl: nowmObj ? nowmObj.url : resData.data[0]?.url,
          author: resData.author?.nickname || resData.author?.fullname || "Desconocido",
          duration: resData.duration || `${resData.durations || 0} Segundos`,
          views: resData.stats?.views || "0",
          likes: resData.stats?.likes || "0",
        };
      } else {
        // Opción 2: Búsqueda por texto (Primer resultado)
        const apiUrl = `https://api.alyacore.xyz/search/tiktok?query=${encodeURIComponent(query)}&key=${apiKey}`;
        const res = await axios.get(apiUrl, { headers: HEADERS, timeout: 15000 });
        const resData = res.data;

        if (!resData?.status || !resData?.data || resData.data.length === 0) {
          throw new Error(`No se encontraron resultados para: "${query}"`);
        }

        const item = resData.data[0];

        videoData = {
          id: item.id,
          title: item.title?.trim() || "Sin título",
          downloadUrl: item.dl || item.watermark,
          author: item.author?.nickname || item.author?.unique_id || "Desconocido",
          duration: item.duration || "N/A",
          views: item.stats?.views?.toLocaleString() || "0",
          likes: item.stats?.likes?.toLocaleString() || "0",
        };
      }

      if (!videoData.downloadUrl) {
        throw new Error("No se encontró ningún enlace de descarga válido.");
      }

      // 1️⃣ Mensaje Informativo
      let caption = `╭〔 🎵 ${fytBold("TIKTOK DOWNLOADER")} 〕━⬣\n\n`;
      caption += `┃ 📂 ${fytBold("DESCARGANDO VIDEO")}\n`;
      caption += `┃ ⏳ Espere un momento...\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(videoData.title.slice(0, 60))}${videoData.title.length > 60 ? "..." : ""}\n\n`;
      caption += `┃ > ${fytBold("Autor:")} › @${videoData.author}\n`;
      caption += `┃ > ${fytBold("Duración:")} › ${videoData.duration}\n`;
      caption += `┃ > ${fytBold("Vistas:")} › ${videoData.views}\n`;
      caption += `┃ > ${fytBold("Likes:")} › ${videoData.likes}\n`;
      caption += `┃ > ${fytBold("Motor:")} › TikTok API Directo\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ > El video se está\n`;
      caption += `┃ > enviando, espera un momento...\n\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });

      // 2️⃣ Envío directo del video mediante URL
      await socket.sendMessage(
        remoteJid,
        {
          video: { url: videoData.downloadUrl },
          mimetype: "video/mp4",
          fileName: `${videoData.id}.mp4`,
        },
        { quoted: message }
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });

    } catch (error) {
      console.error("Error en TikTok Downloader:", error);

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
