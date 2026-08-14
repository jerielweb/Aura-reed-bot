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

    const apiKey = global.Apis?.apiAiya?.apikey || "oboe";
    const isUrl = text.includes("open.spotify.com");

    try {
      let endpoint = "";
      let params = {};

      if (isUrl) {
        // Limpiar URL dejando únicamente la parte antes del '?'
        const cleanTrackUrl = text.split("?")[0];
        endpoint = "https://api.alyacore.xyz/dl/spotify";
        params = { url: cleanTrackUrl, key: apiKey };
      } else {
        endpoint = "https://api.alyacore.xyz/dl/spotifyplay";
        params = { query: text, key: apiKey };
      }

      const { data: res } = await axios.get(endpoint, { params });

      if (!res.status || !res.data) {
        throw new Error("No se pudo obtener la información de la canción.");
      }

      const song = res.data;
      const downloadUrl = typeof song.dl === "string" ? song.dl : song.dl?.mp3;

      if (!downloadUrl) {
        throw new Error("El enlace de descarga del audio no está disponible.");
      }

      let caption = `╭〔 🎵 ${fytBold("SPOTIFY DOWNLOAD")} 〕⬣\n\n`;
      caption += `┃ ➥ ${fytBold(`${song.title}`)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Artista:")} › ${song.artist}\n`;
      caption += `┃ > ${fytBold("Álbum:")} › ${song.album || "Desconocido"}\n`;
      if (song.duration) caption += `┃ > ${fytBold("Duración:")} › ${song.duration}\n`;
      caption += `┃ > ${fytBold("Tipo:")} › Audio (MP3)\n`;
      caption += `╰━━━━━━━━━━━━⬣\n`;
      caption += `┃ ⏳ Descargando audio...\n`;
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

      const audioBuffer = (
        await axios.get(downloadUrl, { responseType: "arraybuffer" })
      ).data;

      await socket.sendMessage(
        remoteJid,
        {
          audio: Buffer.from(audioBuffer),
          mimetype: "audio/mp4",
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
