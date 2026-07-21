import axios from "axios";
import { fytBold } from "../../models/TextStyle.js";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

export default {
  name: ["tt", "tiktok"],
  category: "downloads",
  description: "Descarga videos de TikTok en HD directamente por enlace o búsqueda.",

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
      const apiUrl = `https://api.alyacore.xyz/dl/tiktokv2?url=${encodeURIComponent(query)}&key=${apiKey}`;

      const res = await axios.get(apiUrl, { headers: HEADERS, timeout: 15000 });
      const resData = res.data;

      if (!resData?.status || !resData?.data) {
        throw new Error("No se pudo obtener información del video.");
      }

      // Priorizar HD -> SD sin marca de agua -> Cualquier enlace disponible
      const hdObj = resData.data.find((item) => item.type === "nowatermark_hd");
      const noWmObj = resData.data.find((item) => item.type === "nowatermark");
      const downloadUrl = hdObj?.url || noWmObj?.url || resData.data[0]?.url;

      if (!downloadUrl) {
        throw new Error("No se encontró un enlace de descarga válido.");
      }

      const videoData = {
        id: resData.id || Date.now(),
        title: resData.title || "Sin título",
        downloadUrl,
        author: resData.author?.nickname || resData.author?.fullname || "Desconocido",
        duration: resData.duration || `${resData.durations || 0} Segundos`,
        views: resData.stats?.views || "0",
        likes: resData.stats?.likes || "0",
        quality: hdObj ? "HD (Sin marca)" : "SD (Sin marca)",
      };

      // 1️⃣ Mensaje Informativo
      let caption = `╭〔 🎵 ${fytBold("TIKTOK DOWNLOADER")} 〕━⬣\n\n`;
      caption += `┃ 📂 ${fytBold("DESCARGANDO VIDEO")}\n`;
      caption += `┃ ⏳ Espere un momento...\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(videoData.title.slice(0, 60))}${videoData.title.length > 60 ? "..." : ""}\n\n`;
      caption += `┃ > ${fytBold("Autor:")} › @${videoData.author}\n`;
      caption += `┃ > ${fytBold("Calidad:")} › ${videoData.quality}\n`;
      caption += `┃ > ${fytBold("Duración:")} › ${videoData.duration}\n`;
      caption += `┃ > ${fytBold("Vistas:")} › ${videoData.views}\n`;
      caption += `┃ > ${fytBold("Likes:")} › ${videoData.likes}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ > El video se está\n`;
      caption += `┃ > enviando, espera un momento...\n\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });

      // 2️⃣ Envío directo del video HD mediante URL
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
