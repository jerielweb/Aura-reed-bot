import { fytBold } from "../../models/TextStyle.js";
import axios from "axios";
import { spotifyDownload, SP_REGEX } from "/../../controllers/spotifyDownloader.js";

export default {
  name: ["spotify", "splay", "sp", "spdl"],
  category: "download",
  description: "Descarga canciones de Spotify por enlace o búsqueda.",

  execute: async (socket, message, args, { prefix }) => {
    const text = args.join(" ").trim();
    const remoteJid = message.key.remoteJid;

    // 1. Validación de entrada vacía
    if (!text) {
      let errorText = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      errorText += `┃ ❌ ${fytBold("FALTA BÚSQUEDA")}\n`;
      errorText += `╰━━━━━━━━━━━━⬣\n\n`;
      errorText += `┃ > Ingresa el nombre de una canción o\n`;
      errorText += `┃ > un enlace válido de Spotify.\n\n`;
      errorText += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return socket.sendMessage(remoteJid, { text: errorText }, { quoted: message });
    }

    // Reacción inicial de procesamiento
    await socket.sendMessage(remoteJid, {
      react: { text: "🎵", key: message.key },
    });

    const isUrl = text.includes("open.spotify.com");

    try {
      if (isUrl) {
        // ── Link de Spotify -> se resuelve con el scraper directamente ──
        if (!SP_REGEX.test(text)) {
          throw new Error("Enlace de Spotify inválido. Usa un link de tipo track.");
        }

        const track = await spotifyDownload(text);

        let caption = `╭〔 🎵 ${fytBold("SPOTIFY DOWNLOAD")} 〕⬣\n\n`;
        caption += `┃ ➥ ${fytBold(`${track.name}`)}\n\n`;
        caption += `┣━━━━━━━━━━━━⬣\n`;
        caption += `┃ > ${fytBold("Artista")} › ${track.artist}\n`;
        caption += `┃ > ${fytBold("Álbum")} › ${track.album || "Desconocido"}\n`;
        caption += `┃ > ${fytBold("Duración")} › ${track.duration}\n`;
        caption += `┃ > ${fytBold("Calidad")} › ${track.quality}\n`;
        caption += `┃ > ${fytBold("Tipo")} › Documento (MP3)\n`;
        caption += `╰━━━━━━━━━━━━⬣\n`;
        caption += `┃ ⏳ Enviando audio...\n`;
        caption += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

        await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });

        await socket.sendMessage(
          remoteJid,
          {
            document: track.buffer,
            mimetype: "audio/mpeg",
            fileName: `${track.artist} - ${track.name}.mp3`,
          },
          { quoted: message }
        );
      } else {
        // ── Búsqueda por texto -> comportamiento original (sin cambios) ──
        const apiKey = global.Apis?.apiAiya?.apikey || "oboe";
        const endpoint = "https://api.alyacore.xyz/dl/spotifyplay";
        const params = { query: text, key: apiKey };

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
        caption += `┃ > ${fytBold("Atista:")} › ${song.artist}\n`;
        caption += `┃ > ${fytBold("Album:")} › ${song.album || "Desconocido"}\n`;
        caption += `┃ > ${fytBold("Duración")} › ${song.duration}\n`;
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
      }

      // Reacción de éxito
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
