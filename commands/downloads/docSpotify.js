import { fytBold } from "../../models/TextStyle.js";
import axios from "axios";
import ffmpeg from "fluent-ffmpeg";
import { Promises as fs } from "fs";
import path from "path";
import os from "os";

export default {
  name: ["spotifydoc", "docsplay", "dsp", "dspdl"],
  category: "download",
  description: "Descarga canciones de Spotify por enlace o búsqueda como documento con metadatos vía FFmpeg.",

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

    // Rutas temporales para el procesamiento con FFmpeg
    const tmpDir = os.tmpdir();
    const inputAudioPath = path.join(tmpDir, `input_${Date.now()}.mp3`);
    const inputCoverPath = path.join(tmpDir, `cover_${Date.now()}.jpg`);
    const outputPath = path.join(tmpDir, `output_${Date.now()}.mp3`);

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
      caption += `┃ ⏳ Procesando metadatos con FFmpeg...\n`;
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

      // 1. Descargar audio y portada
      const [audioRes, coverRes] = await Promise.all([
        axios.get(downloadUrl, { responseType: "arraybuffer" }),
        coverUrl ? axios.get(coverUrl, { responseType: "arraybuffer" }).catch(() => null) : Promise.resolve(null)
      ]);

      await fs.writeFile(inputAudioPath, Buffer.from(audioRes.data));

      let hasCover = false;
      if (coverRes) {
        await fs.writeFile(inputCoverPath, Buffer.from(coverRes.data));
        hasCover = true;
      }

      // 2. Procesar con FFmpeg para incrustar tags e imagen de portada
      await new Promise((resolve, reject) => {
        let command = ffmpeg().input(inputAudioPath);

        if (hasCover) {
          command = command.input(inputCoverPath);
        }

        const outputOptions = [
          "-map 0:0",
          "-c copy",
          "-id3v2_version 3",
          `-metadata title=${JSON.stringify(song.title || "")}`,
          `-metadata artist=${JSON.stringify(song.artist || "")}`,
          `-metadata album=${JSON.stringify(song.album || "Aura Reed Spotify")}`,
        ];

        if (hasCover) {
          outputOptions.push(
            "-map 1:0",
            "-metadata:s:v title=\"Album cover\"",
            "-metadata:s:v comment=\"Cover (front)\""
          );
        }

        command
          .outputOptions(outputOptions)
          .save(outputPath)
          .on("end", resolve)
          .on("error", reject);
      });

      // 3. Leer el archivo procesado y enviarlo
      const processedBuffer = await fs.readFile(outputPath);

      await socket.sendMessage(
        remoteJid,
        {
          document: processedBuffer,
          mimetype: "audio/mpeg",
          fileName: `${song.artist.replace(/[<>:"/\\|?*]/g, "")} - ${song.title.replace(/[<>:"/\\|?*]/g, "")}.mp3`,
        },
        { quoted: message }
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en spotifydoc:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });

      let textErr = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      textErr += `┃ ⚠️ ${fytBold("ERROR DE DESCARGA")}\n`;
      textErr += `╰━━━━━━━━━━━━⬣\n\n`;
      textErr += `┃ > ${error.message || "Ocurrió un error inesperado."}\n\n`;
      textErr += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      await socket.sendMessage(remoteJid, { text: textErr }, { quoted: message });
    } finally {
      // Limpieza de archivos temporales
      await Promise.all([
        fs.unlink(inputAudioPath).catch(() => {}),
        fs.unlink(inputCoverPath).catch(() => {}),
        fs.unlink(outputPath).catch(() => {}),
      ]);
    }
  },
};
