import yts from "yt-search";
import formatter from "../../controllers/functions/formatNumbers.js";

export default {
  name: ["ytsearch", "yts", "plays"],
  category: "search",
  description: "Busca videos en YouTube. Usa: .yt [búsqueda]",
  execute: async (socket, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;
    const query = args.join(" ");

    if (!query) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `⚠️ Debes especificar qué buscar.\nEjemplo: *${prefix}yts Twice Fancy*`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(
      remoteJid,
      { text: "🔍 Buscando en YouTube..." },
      { quoted: message },
    );

    try {
      const searchResult = await yts(query);
      const videos = searchResult.videos.slice(0, 5);

      if (!videos.length) {
        return await socket.sendMessage(
          remoteJid,
          { text: "❌ No se encontraron resultados." },
          { quoted: message },
        );
      }

      let text = `╭━━〔 𝐘𝐎𝐔𝐓𝐔𝐁𝐄 𝐒𝐄𝐀𝐑𝐂𝐇 〕━━⬣\n`;
      text += `┃ 🔍 𝐏𝐨𝐫: yt-search\n`;
      text += `┃ 🎬 𝐁úsqueda: ${query}\n`;
      text += `╰━━━━━━━━━━━━━━━━⬣\n\n`;

      videos.forEach((video, i) => {
        text += `┃ ${i + 1}. *${video.title}*\n`;
        text += `┃ ├ 👤 ${video.author.name}\n`;
        text += `┃ ├ ⏱️ ${video.timestamp}\n`;
        text += `┃ ├ 👁️ ${formatter(video.views)}\n`;
        text += `┃ └ 🔗 ${video.url}\n\n`;
      });

      text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

      await socket.sendMessage(
        remoteJid,
        {
          image: { url: videos[0].thumbnail },
          caption: text,
        },
        { quoted: message },
      );
    } catch (error) {
      console.error("Error en yt-search:", error);
      await socket.sendMessage(
        remoteJid,
        { text: "❌ Ocurrió un error al realizar la búsqueda." },
        { quoted: message },
      );
    }
  },
};
