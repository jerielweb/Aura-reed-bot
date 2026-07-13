import downloader from "../../controllers/spotifyDownloader.js";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: [
    "spotify",
    "sp",
    "spotifydl",
    "spotifydownload",
    "spt",
    "spotifyaudio",
    "spta",
    "splay",
  ],
  category: "downloads",
  description: "Busca y descarga canciones de Spotify.",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BUSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > enlace de Spotify o una busqueda.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      // Descargar y obtener la ruta del archivo + metadatos
      const {
        metadata,
        path: audioPath,
        downloadSource,
      } = await downloader.download(text);

      const title = metadata.title || "Canción de Spotify";
      const artist = metadata.artist || "Desconocido";
      const duration = metadata.duration || "N/A";
      const cover = metadata.cover;
      const finalUrl = metadata.url || text;

      let caption = `╭〔 🎵 ${fytBold("SPOTIFY DOWNLOADER")} 〕━⬣\n\n`;
      caption += `┃ 🔊 ${fytBold("DESCARGANDO ARCHIVO")}\n`;
      caption += `┃ ⏳ Espere un momento...\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(title)}\n\n`;
      caption += `┃ > ${fytBold("Artista")} › ${artist}\n`;
      caption += `┃ > ${fytBold("Duración")} › ${duration}\n`;
      caption += `┃ > ${fytBold("Modo")} › Audio (MP3)\n`;
      caption += `┃ > ${fytBold("Link")} › ${finalUrl}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n\n`;
      caption += `┃ > El archivo se esta\n`;
      caption += `┃ > enviando, espera un momento...\n\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      if (cover) {
        await socket.sendMessage(
          remoteJid,
          { image: { url: cover }, caption },
          { quoted: message },
        );
      } else {
        await socket.sendMessage(
          remoteJid,
          { text: caption },
          { quoted: message },
        );
      }

      // Enviar archivo de audio
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
      console.error("Error en Spotify Downloader:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR DE DESCARGA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Ocurrio un error inesperado."}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
