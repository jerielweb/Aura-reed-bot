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

      if (!isUrl) {
        const searchRes = await Tiktok.Search(text, { type: "video" });
        const results = searchRes?.result?.videos || searchRes?.result || [];
        const first = Array.isArray(results) ? results[0] : results;

        if (!first) throw new Error("No se encontraron resultados para la búsqueda.");
        targetUrl = first.play || first.url || first.link || `https://www.tiktok.com/@${first.author?.username || 'user'}/video/${first.id}`;
      }

      const downloadData = await Tiktok.Downloader(targetUrl, { version: "v2" });
      const res = downloadData?.result;

      if (!res) throw new Error("No se pudo obtener la información del video.");

      // Extracción segura garantizando que sea String
      let videoUrl = null;
      if (typeof res.video === "string") {
        videoUrl = res.video;
      } else if (Array.isArray(res.video)) {
        videoUrl = res.video[0];
      } else if (typeof res.video === "object") {
        videoUrl = res.video?.noWatermark || res.video?.url || res.video?.[0];
      }
      
      if (!videoUrl) {
        videoUrl = res.video1 || res.video2 || res.play;
      }

      if (!videoUrl || typeof videoUrl !== "string") {
        throw new Error("No se pudo extraer el enlace del video.");
      }

      const title = res.desc || res.title || "Video de TikTok";
      const author = res.author?.nickname || res.nickname || "TikTok User";
      const duration = res.duration ? `${res.duration}s` : "N/A";
      const views = res.statistics?.play_count || res.play_count || 0;
      const likes = res.statistics?.digg_count || res.digg_count || 0;
      const thumbnail = res.cover || res.origin_cover || res.dynamic_cover;

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
