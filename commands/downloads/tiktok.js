import Tiktok from "@tobyg74/tiktok-api-dl";
import formatter from "../../controllers/functions/formatNumbers.js";

const TIKTOK_REGEX = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/.*$/i;

export default {
  name: ["tiktok", "tt", "tk"],
  category: "downloads",
  description: "Busca y descarga videos de TikTok. Usa: .tiktok [enlace/búsqueda]",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > enlace de TikTok o una búsqueda.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
        },
        { quoted: message }
      );
    }

    await socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

    try {
      const isUrl = TIKTOK_REGEX.test(text);
      let targetUrl = text;

      // 1. Si es búsqueda por texto
      if (!isUrl) {
        const searchRes = await Tiktok.Search(text, { type: "video" });
        const results = searchRes?.result;
        
        // En v1 res.result es directamente un Array de videos
        const first = Array.isArray(results) ? results[0] : results?.videos?.[0];

        if (!first) throw new Error("No se encontraron resultados para la búsqueda.");
        
        targetUrl = first.play || first.url || first.link || `https://www.tiktok.com/@${first.author?.username || 'user'}/video/${first.id}`;
      }

      // 2. Descarga usando la versión 1 (v1) de la API
      const downloadData = await Tiktok.Downloader(targetUrl, { version: "v1" });
      
      if (downloadData?.status !== "success" || !downloadData?.result) {
        throw new Error("No se pudo obtener la información del enlace.");
      }

      const res = downloadData.result;

      // Estructura oficial v1: video1, video2, video_hd
      const videoUrl = res.video1 || res.video2 || res.video_hd || (typeof res.video === "string" ? res.video : null);

      if (!videoUrl) {
        throw new Error("No se pudo extraer el enlace del video.");
      }

      const title = res.desc || "Video de TikTok";
      const author = res.author?.nickname || "TikTok User";
      const duration = res.duration ? `${res.duration}s` : "N/A";
      const views = res.statistics?.playCount || res.statistics?.play_count || 0;
      const likes = res.statistics?.diggCount || res.statistics?.digg_count || 0;
      const thumbnail = res.cover || res.dynamic_cover;

      const caption =
        `╭〔 🎬 𝐓𝐈𝐊𝐓𝐎𝐊 𝐕𝐈𝐃𝐄𝐎 〕━⬣\n\n` +
        `┃ ➥ 𝐃𝐞𝐬𝐜𝐚𝐫𝐠𝐚𝐧𝐝𝐨 › ${title}\n\n` +
        `┣━━━━━━━━━━━━⬣\n` +
        `┃ > 𝐀𝐮𝐭𝐨𝐫 › ${author}\n` +
        `┃ > 𝐃𝐮𝐫𝐚𝐜𝐢𝐨́𝐧 › ${duration}\n` +
        `┃ > 𝐕𝐢𝐬𝐭𝐚𝐬 › ${formatter(views)}\n` +
        `┃ > Likes › ${formatter(likes)}\n` +
        `┃ > 𝐌𝐨𝐝𝐨 › Video (MP4)\n` +
        `┃ > 𝐄𝐧𝐥𝐚𝐜𝐞 › ${targetUrl}\n` +
        `┣━━━━━━━━━━━━⬣\n` +
        `┃ ⏳ Descargando Video...\n` +
        `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

      const mediaPayload = thumbnail ? { image: { url: thumbnail }, caption } : { text: caption };
      await socket.sendMessage(remoteJid, mediaPayload, { quoted: message });

      await socket.sendMessage(
        remoteJid,
        {
          video: { url: videoUrl },
          mimetype: "video/mp4",
          fileName: `${title.replace(/[<>:"/\\|?*]/g, "")}.mp4`,
          caption: `🎬 *𝐓𝐢́𝐭𝐮𝐥𝐨:* ${title}\n⚡ *𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝 𝐃𝐨𝐰𝐧𝐥𝐨𝐚𝐝𝐞𝐫*`,
        },
        { quoted: message }
      );

      await socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } });
    } catch (error) {
      console.error("Error en tiktok command:", error);
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Ocurrió un error inesperado."}\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
        },
        { quoted: message }
      );
    }
  },
};
