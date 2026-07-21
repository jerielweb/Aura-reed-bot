import downloader from "../../controllers/tiktokDownloader.js";
import formatter from "../../controllers/functions/formatNumbers.js";

const TIKTOK_REGEX = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/.*$/i;

export default {
  name: ["tiktok", "tt", "tk"],
  category: "downloads",
  description:
    "Busca y descarga videos de TikTok. Usa: .tiktok [enlace/búsqueda]",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > enlace de TikTok o una búsqueda.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      let finalUrl = text;
      let videoData = null;

      if (!TIKTOK_REGEX.test(text)) {
        const searchResult = await downloader.search(text);
        finalUrl = searchResult.url;
        videoData = {
          title: searchResult.title || "Video de TikTok",
          author: searchResult.author || "TikTok User",
          duration: searchResult.duration ? `${searchResult.duration}s` : "N/A",
          views: searchResult.views || "0",
          likes: searchResult.likes || "0",
          thumbnail: searchResult.cover,
          url: finalUrl,
        };
      } else {
        const info = await downloader.getDownloadInfo(finalUrl);
        videoData = {
          title: info.title || "Video de TikTok",
          author: info.author || "TikTok User",
          duration: info.duration ? `${info.duration}s` : "N/A",
          views: info.views || "0",
          likes: info.likes || "0",
          thumbnail: info.cover,
          url: finalUrl,
        };
      }

      const title = videoData.title;
      const author = videoData.author;
      const duration = videoData.duration;
      const views = videoData.views || "0";
      const likes = videoData.likes || "0";
      const thumbnail = videoData.thumbnail;

      let caption = `╭〔 🎬 𝐓𝐈𝐊𝐓𝐎𝐊 𝐕𝐈𝐃𝐄𝐎 〕━⬣\n\n`;
      caption += `┃ 🎥 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀𝐍𝐃𝐎 𝐀𝐑𝐂𝐇𝐈𝐕𝐎\n`;
      caption += `┃ ⏳ 𝐄𝐬𝐩𝐞𝐫𝐞 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ ➥ 𝐃𝐞𝐬𝐜𝐚𝐫𝐠𝐚𝐧𝐝𝐨 › ${title}\n\n`;
      caption += `┃ > 𝐀𝐮𝐭𝐨𝐫 › ${author}\n`;
      caption += `┃ > 𝐃𝐮𝐫𝐚𝐜𝐢𝐨́𝐧 › ${duration}\n`;
      caption += `┃ > 𝐕𝐢𝐬𝐭𝐚𝐬 › ${formatter(views)}\n`;
      caption += `┃ > Likes › ${formatter(likes)}\n`;
      caption += `┃ > 𝐌𝐨𝐝𝐨 › Video (MP4)\n`;
      caption += `┃ > 𝐄𝐧𝐥𝐚𝐜𝐞 › ${finalUrl}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ > 𝐄𝐥 𝐚𝐫𝐜𝐡𝐢𝐯𝐨 𝐬𝐞 𝐞𝐬𝐭𝐚́\n`;
      caption += `┃ > 𝐞𝐧𝐯𝐢𝐚𝐧𝐝𝐨, 𝐞𝐬𝐩𝐞𝐫𝐚 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
      caption += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

      if (thumbnail) {
        await socket.sendMessage(
          remoteJid,
          { image: { url: thumbnail }, caption },
          { quoted: message },
        );
      } else {
        await socket.sendMessage(
          remoteJid,
          { text: caption },
          { quoted: message },
        );
      }

      const { path: videoPath } = await downloader.getVideo(finalUrl);
      await socket.sendMessage(
        remoteJid,
        {
          video: { url: videoPath },
          mimetype: "video/mp4",
          fileName: `${title.replace(/[<>:"/\\|?*]/g, "")}.mp4`,
          caption: `🎬 *𝐓𝐢́𝐭𝐮𝐥𝐨:* ${title}\n⚡ *𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝 𝐃𝐨𝐰𝐧𝐥𝐨𝐚𝐝𝐞𝐫*`,
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en tiktok downloader command:", error);
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