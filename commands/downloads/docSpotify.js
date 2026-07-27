import { fytBold } from "../../models/TextStyle.js";
import axios from "axios";
import NodeID3 from "node-id3";

export default {
  name: ["spotifydoc", "docsplay", "dsp", "dspdl"],
  category: "download",
  description: "Descarga canciones de Spotify por enlace o búsqueda como documento con metadatos ID3.",

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

      const endpoint = isUrl
        ? "https://api.alyacore.xyz/dl/spotifyv2"
        : "https://api.alyacore.xyz/dl/spotifyplay";

      const params = isUrl
        ? { url: text, key: apiKey }
        : { query: text, key: apiKey };

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
      caption += `┃ > ${fytBold("Artista")} › ${song.artist}\n`;
      caption += `┃ > ${fytBold("Álbum")} › ${song.album || "Desconocido"}\n`;
      caption += `┃ > ${fytBold("Duración")} › ${song.duration}\n`;
      caption += `┃ > ${fytBold("Tipo")} › Documento (MP3)\n`;
      caption += `╰━━━━━━━━━━━━⬣\n`;
      caption += `┃ ⏳ Aplicando metadatos y preparando documento...\n`;
      caption += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

      const coverUrl = song.coverHd || song.cover;

      if (coverUrl) {
        await socket.sendMessage(
          remoteJid,
          {
            image: { url: coverUrl },
            caption,
          },
          { quoted: message }
        );
      }

      // 1. Descargar el buffer del audio MP3
      const { data: audioBuffer } = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
      });

      // 2. Descargar el buffer de la portada si existe
      let coverBuffer = null;
      if (coverUrl) {
        try {
          const { data: imgBuf } = await axios.get(coverUrl, {
            responseType: "arraybuffer",
          });
          coverBuffer = Buffer.from(imgBuf);
        } catch (e) {
          console.error("Error al descargar la carátula para metadatos:", e.message);
        }
      }

      // 3. Definir etiquetas ID3
      const tags = {
        title: song.title,
        artist: song.artist,
        album: song.album || "Spotify Single",
        ...(coverBuffer && {
          image: {
            mime: "image/jpeg",
            type: { id: 3, name: "front cover" },
            description: "Cover",
            imageBuffer: coverBuffer,
          },
        }),
      };

      // 4. Inyectar metadatos directamente al buffer del MP3
      const taggedAudioBuffer = NodeID3.write(tags, Buffer.from(audioBuffer));

      // 5. Enviar el buffer procesado como documento
      await socket.sendMessage(
        remoteJid,
        {
          document: taggedAudioBuffer,
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
