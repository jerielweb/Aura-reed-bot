/**
import downloader from "../../controllers/spotifyDownloader.js";

export default {
  name: ["spsearch", "spotifysearch", "sps"],
  category: "search",
  description: "Busca canciones en Spotify.",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const query = args.join(" ").trim();

    if (!query) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona el nombre\n┃ > de la canción o artista a buscar.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
        },
        { quoted: message },
      );
    }

    console.log(`[Spotify Search] Iniciando búsqueda para: "${query}"`);
    await socket.sendMessage(remoteJid, {
      react: { text: "🔍", key: message.key },
    });

    try {
      const tracks = await downloader.searchTracks(query);

      if (!tracks || !tracks.length) {
        await socket.sendMessage(remoteJid, {
          react: { text: "❌", key: message.key },
        });
        return await socket.sendMessage(
          remoteJid,
          {
            text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐒𝐈𝐍 𝐑𝐄𝐒𝐔𝐋𝐓𝐀𝐃𝐎𝐒\n╰━━━━━━━━━━━━⬣\n\n┃ > No se encontraron resultados en Spotify.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
          },
          { quoted: message },
        );
      }

      const slicedTracks = tracks.slice(0, 10);

      let text = `╭━━〔 𝐒𝐏𝐎𝐓𝐈𝐅𝐘 𝐒𝐄𝐀𝐑𝐂𝐇 〕━━⬣\n`;
      text += `┃ 🔍 𝐁úsqueda: ${query}\n`;
      text += `┃ ⚙️ 𝐌otor › ${slicedTracks[0].source || "Desconocido"}\n`;
      text += `╰━━━━━━━━━━━━━━━━⬣\n\n`;

      slicedTracks.forEach((track, i) => {
        text += `┃ ${i + 1}. ${track.title}\n`;
        text += `┃ ├ 👤 Artista › ${track.artist || "Desconocido"}\n`;
        text += `┃ ├ 💿 Álbum › ${track.album || "Desconocido"}\n`;
        text += `┃ ├ ⏱️ Duración › ${track.duration || "N/A"}\n`;
        text += `┃ ├ 📅 Publicado › ${track.publish || "N/A"}\n`;
        text += `┃ └ 🔗 Enlace › ${track.url || "No disponible"}\n\n`;
      });

      text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

      const coverUrl =
        slicedTracks[0].image || "https://open.spotify.com/favicon.ico";

      await socket.sendMessage(
        remoteJid,
        {
          image: { url: coverUrl },
          caption: text,
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en Spotify Search:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Ocurrió un error inesperado al buscar."}\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
**/