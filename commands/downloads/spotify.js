import { fytBold } from "../../models/TextStyle.js";
import axios from "axios";

export default {
  name: ["spotify", "splay", "sp", "spdl"],
  category: "download",
  description: "Descarga canciones de Spotify por enlace o búsqueda.",

  execute: async (socket, message, args, { prefix }) => {
    const text = args.join(" ").trim();
    const remoteJid = message.key.remoteJid;

    if (!text) {
      let errorText = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      errorText += `┃ ❌ ${fytBold("FALTA BÚSQUEDA")}\n`;
      errorText += `╰━━━━━━━━━━━━⬣\n\n`;
      errorText += `┃ > Ingresa el nombre de una canción o\n`;
      errorText += `┃ > un enlace válido de Spotify.\n\n`;
      errorText += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return socket.sendMessage(remoteJid, { text: errorText }, { quoted: message });
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "🎵", key: message.key },
    });

    try {
      const apiKey = global.Apis?.apiAiya?.apikey || "oboe";
      const isUrl = text.includes("open.spotify.com");

      // Limpiar URL: remover parámetros tipo ?si=...
      const cleanUrl = isUrl ? text.split("?")[0] : text;

      const endpoint = isUrl
        ? "https://api.alyacore.xyz/dl/spotifyv2"
        : "https://api.alyacore.xyz/dl/spotifyplay";

      const params = isUrl
        ? { url: cleanUrl, key: apiKey }
        : { query: cleanUrl, key: apiKey };

      const { data: res } = await axios.get(endpoint, { params });

      if (!res.status || !res.data) {
        throw new Error("No se pudo obtener la información de la canción.");
      }

      const song = res.data;
      const downloadUrl = typeof song.dl === "string" ? song.dl : song.dl?.mp3;

      if (!downloadUrl) {
        throw new Error("El enlace de descarga del audio no está disponible.");
      }

      // Se usa la URL retornada por la API o el link limpio en caso de ser directo
      const trackUrl = song.url || (isUrl ? cleanUrl : null);

      let caption = `╭〔 🎵 ${fytBold("SPOTIFY DOWNLOAD")} 〕⬣\n\n`;
      caption += `┃ ➥ ${fytBold(`${song.title}`)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Artista")} › ${song.artist}\n`;
      caption += `┃ > ${fytBold("Álbum")} › ${song.album || "Desconocido"}\n`;
      if (song.duration) caption += `┃ > ${fytBold("Duración")} › ${song.duration}\n`;
      if (trackUrl) caption += `┃ > ${fytBold("Link")} › ${trackUrl}\n`;
      caption += `┃ > ${fytBold("Tipo")} › Audio (MP3)\n`;
      caption += `╰━━━━━━━━━━━━⬣\n`;
      caption += `┃ ⏳ Enviando audio...\n`;
      caption += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

      if (song.cover || song.coverHd) {
        await socket.sendMessage(
          remoteJid,
          {
            image: { url: song.coverHd || song.cover },
            caption,
          },
          { quoted: message }
        );
      } else {
        await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });
      }

      // Envío del archivo como audio
      await socket.sendMessage(
        remoteJid,
        {
          audio: { url: downloadUrl },
          mimetype: "audio/mpeg",
          fileName: `${song.artist} - ${song.title}.mp3`,
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

      let textErr = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      textErr += `┃ ⚠️ ${fytBold("ERROR DE DESCARGA")}\n`;
      textErr += `╰━━━━━━━━━━━━⬣\n\n`;
      textErr += `┃ > ${error.message || "Ocurrió un error inesperado."}\n\n`;
      textErr += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      await socket.sendMessage(remoteJid, { text: textErr }, { quoted: message });
    }
  },
};
