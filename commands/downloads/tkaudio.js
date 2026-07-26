import downloader from "../../controllers/tiktokDownloader.js";

const TIKTOK_REGEX = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/.*$/i;

export default {
  name: ["tkaudio", "ttaudio", "tta", "tiktokaudio", "tkmp3"],
  category: "downloads",
  description: "Busca y descarga audios de TikTok.",
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
      let audioPath = null;

      if (!TIKTOK_REGEX.test(text)) {
        // 1. Caso Búsqueda: resolvemos URL y metadatos de la búsqueda
        const searchResult = await downloader.search(text);
        finalUrl = searchResult.url;
        videoData = {
          title: searchResult.title || "Audio de TikTok",
          author: searchResult.author || "TikTok User",
          duration: searchResult.duration ? `${searchResult.duration}s` : "N/A",
          views: searchResult.views || "0",
          thumbnail: searchResult.cover,
        };

        // Descargamos el audio a partir de la URL encontrada
        const audioResult = await downloader.getAudio(finalUrl);
        audioPath = audioResult.path;
      } else {
        // 2. Caso Enlace Directo: getAudio obtiene el audio y los metadatos en UNA SOLA llamada
        const { path, info } = await downloader.getAudio(finalUrl);
        audioPath = path;
        videoData = {
          title: info.title || "Audio de TikTok",
          author: info.author || "TikTok User",
          duration: info.duration ? `${info.duration}s` : "N/A",
          views: info.views || "0",
          thumbnail: info.cover,
        };
      }

      const { title, author, duration, views, thumbnail } = videoData;

      let caption = `╭〔 🎵 𝐓𝐈𝐊𝐓𝐎𝐊 𝐀𝐔𝐃𝐈𝐎 〕━⬣\n\n`;
      caption += `┃ ➥ 𝐃𝐞𝐬𝐜𝐚𝐫𝐠𝐚𝐧𝐝𝐨 › ${title}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > 𝐀𝐮𝐭𝐨𝐫 › ${author}\n`;
      caption += `┃ > 𝐃𝐮𝐫𝐚𝐜𝐢𝐨́𝐧 › ${duration}\n`;
      caption += `┃ > 𝐕𝐢𝐬𝐭𝐚𝐬 › ${views}\n`; // Se imprime directamente porque ya viene formateado de downloader
      caption += `┃ > 𝐌𝐨𝐝𝐨 › Audio (MP3)\n`;
      caption += `┃ > 𝐄𝐧𝐥𝐚𝐜𝐞 › ${finalUrl}\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ ⏳ Descargando audio...\n`;
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

      // Enviar archivo de audio descargado
      await socket.sendMessage(
        remoteJid,
        {
          audio: { url: audioPath },
          mimetype: "audio/mpeg",
          fileName: `${title.replace(/[<>:"/\\|?*]/g, "")}.mp3`,
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en tkaudio downloader command:", error);
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
import downloader from "../../controllers/tiktokDownloader.js";

const TIKTOK_REGEX = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/.*$/i;

export default {
  name: ["tkaudio", "ttaudio", "tta", "tiktokaudio", "tkmp3"],
  category: "downloads",
  description: "Busca y descarga audios de TikTok.",
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
      let audioPath = null;

      if (!TIKTOK_REGEX.test(text)) {
        // 1. Caso Búsqueda: resolvemos URL y metadatos de la búsqueda
        const searchResult = await downloader.search(text);
        finalUrl = searchResult.url;
        videoData = {
          title: searchResult.title || "Audio de TikTok",
          author: searchResult.author || "TikTok User",
          duration: searchResult.duration ? `${searchResult.duration}s` : "N/A",
          views: searchResult.views || "0",
          thumbnail: searchResult.cover,
        };

        // Descargamos el audio a partir de la URL encontrada
        const audioResult = await downloader.getAudio(finalUrl);
        audioPath = audioResult.path;
      } else {
        // 2. Caso Enlace Directo: getAudio obtiene el audio y los metadatos en UNA SOLA llamada
        const { path, info } = await downloader.getAudio(finalUrl);
        audioPath = path;
        videoData = {
          title: info.title || "Audio de TikTok",
          author: info.author || "TikTok User",
          duration: info.duration ? `${info.duration}s` : "N/A",
          views: info.views || "0",
          thumbnail: info.cover,
        };
      }

      const { title, author, duration, views, thumbnail } = videoData;

      let caption = `╭〔 🎵 𝐓𝐈𝐊𝐓𝐎𝐊 𝐀𝐔𝐃𝐈𝐎 〕━⬣\n\n`;
      caption += `┃ ➥ 𝐃𝐞𝐬𝐜𝐚𝐫𝐠𝐚𝐧𝐝𝐨 › ${title}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > 𝐀𝐮𝐭𝐨𝐫 › ${author}\n`;
      caption += `┃ > 𝐃𝐮𝐫𝐚𝐜𝐢𝐨́𝐧 › ${duration}\n`;
      caption += `┃ > 𝐕𝐢𝐬𝐭𝐚𝐬 › ${views}\n`; // Se imprime directamente porque ya viene formateado de downloader
      caption += `┃ > 𝐌𝐨𝐝𝐨 › Audio (MP3)\n`;
      caption += `┃ > 𝐄𝐧𝐥𝐚𝐜𝐞 › ${finalUrl}\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ ⏳ Descargando audio...\n`;
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

      // Enviar archivo de audio descargado
      await socket.sendMessage(
        remoteJid,
        {
          audio: { url: audioPath },
          mimetype: "audio/mpeg",
          fileName: `${title.replace(/[<>:"/\\|?*]/g, "")}.mp3`,
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en tkaudio downloader command:", error);
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
