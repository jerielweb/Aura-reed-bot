import axios from "axios";
import yts from "yt-search";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpegInstaller from "ffmpeg-static";
import { fytBold } from "../../models/TextStyle.js"; // Usamos tu formato de texto de Aura Reed

ffmpeg.setFfmpegPath(ffmpegInstaller);

const token = global.apiShazam?.apikey || "07887abb3c387183d5f3be932f3445d5";

export default {
  name: ["shazam", "whatsong", "audd", "find"],
  category: "search",
  description:
    "Identifica una canción desde un audio o video citado. Usa: responde con .shazam",
  execute: async (socket, message, args, { prefix }) => {
    // Corrección del JID usando la normalización compatible con LID
    const remoteJid = message.key.remoteJid;

    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;

    if (!quotedMsg) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `❗ Responde a un mensaje de voz/video con ${prefix}shazam para identificar la canción.`,
        },
        { quoted: message },
      );
    }

    // Desempaquetar posibles wrappers de vistas únicas
    function unwrapMessage(msg) {
      if (!msg) return null;
      if (msg.audioMessage || msg.videoMessage || msg.documentMessage)
        return msg;
      if (msg.viewOnceMessageV2?.message)
        return unwrapMessage(msg.viewOnceMessageV2.message);
      if (msg.viewOnceMessage?.message)
        return unwrapMessage(msg.viewOnceMessage.message);
      return null;
    }

    const target = unwrapMessage(quotedMsg);
    if (!target) {
      return await socket.sendMessage(
        remoteJid,
        { text: `❗ El mensaje citado no contiene audio o video válido.` },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    const tempIn = `./tmp/shazam_in_${Date.now()}`;
    const tempOut = `./tmp/shazam_out_${Date.now()}.mp3`; // Salida forzada a mp3 para la API

    try {
      // Reconstrucción limpia de la estructura del mensaje citado para que downloadMediaMessage no falle
      const downloadMsg = {
        key: {
          remoteJid: remoteJid,
          id: contextInfo.stanzaId,
          fromMe:
            contextInfo.participant ===
            socket.user.id.split(":")[0] + "@s.whatsapp.net",
        },
        message: target,
      };

      const buffer = await downloadMediaMessage(
        downloadMsg,
        "buffer",
        {},
        { logger: console },
      );
      if (!buffer || buffer.length === 0)
        throw new Error("No se pudo descargar el archivo de WhatsApp.");

      // Asegurar que la carpeta tmp exista en tu host vacío
      try {
        await fs.promises.mkdir("./tmp", { recursive: true });
      } catch (e) {
        /* ignore */
      }

      await fs.promises.writeFile(tempIn, buffer);

      // Conversión y recorte estricto a MP3 de 15 segundos (Ideal para AudD)
      const convertAndTrim = (inPath, outPath) =>
        new Promise((resolve, reject) => {
          ffmpeg(inPath)
            .outputOptions([
              "-t 15", // Recortar a 15 segundos max (ahorra ancho de banda)
              "-acodec libmp3lame", // Forzar códec estándar MP3
              "-b:a 128k", // Bitrate óptimo para reconocimiento
            ])
            .on("error", (err) => reject(err))
            .on("end", () => resolve())
            .save(outPath);
        });

      await convertAndTrim(tempIn, tempOut);

      let outBuffer = await fs.promises.readFile(tempOut);

      // Preparar payload Base64 para AudD
      const base64 = outBuffer.toString("base64");
      const params = new URLSearchParams();
      params.append("api_token", token);
      params.append("audio", base64);
      params.append("return", "spotify,apple_music");

      const res = await axios.post("https://api.audd.io/", params.toString(), {
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        timeout: 30000,
      });

      const data = res.data;
      if (!data?.result) {
        await socket.sendMessage(remoteJid, {
          react: { text: "❌", key: message.key },
        });
        return await socket.sendMessage(
          remoteJid,
          {
            text: "❌ No se pudo identificar la canción o no hay música clara en el archivo.",
          },
          { quoted: message },
        );
      }

      const r = data.result;
      const title = r.title || "Desconocido";
      const artist = r.artist || "Desconocido";
      const album = r.album || "Desconocido";
      const release = r.release_date || "";
      const genres =
        (r.apple_music?.genreNames || []).join(", ") || "Desconocido";

      // Links
      const spotifyUrl = r.spotify?.external_urls?.spotify || null;
      const appleUrl = r.apple_music?.url || null;
      const otherLinks = r.song_link || null;

      // Búsqueda en YouTube alternativo
      let youtubeUrl =
        r.youtube?.url ||
        (r.youtube?.videoId ? `https://youtu.be/${r.youtube.videoId}` : null);
      if (!youtubeUrl) {
        try {
          const youtubeQuery = [title, artist]
            .filter((v) => v && v !== "Desconocido")
            .join(" ");
          if (youtubeQuery) {
            const searchResults = await yts(youtubeQuery);
            if (searchResults?.videos?.length) {
              youtubeUrl = searchResults.videos[0].url;
            }
          }
        } catch (e) {
          console.log("[shazam] Falló búsqueda en YT:", e?.message);
        }
      }

      // Arte del Álbum
      let image = null;
      if (r.spotify?.album?.images && r.spotify.album.images.length) {
        image = r.spotify.album.images[0].url;
      }
      if (!image && r.apple_music?.artwork?.url) {
        image = r.apple_music.artwork.url.replace("{w}x{h}", "800x800");
      }

      // Render de la plantilla con fytBold
      let text = `╭〔 🔍 ${fytBold("SHAZAM RESULT")} 〕━⬣\n\n`;
      text += `┃ ➥ ${title}\n\n`;
      text += `┃ > ${fytBold("Artista")} › ${artist}\n`;
      text += `┃ > ${fytBold("Álbum")} › ${album}${release ? ` - ${release}` : ""}\n`;
      text += `┃ > ${fytBold("Género")} › ${genres}\n\n`;
      text += `┣━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > ${fytBold("Escúchala completa aquí:")}\n`;
      text += `┃ > ▶️ Spotify: ${spotifyUrl || "No disponible"}\n`;
      text += `┃ > 🍎 Apple Music: ${appleUrl || "No disponible"}\n`;
      text += `┃ > ▶️ YouTube: ${youtubeUrl || "No disponible"}\n`;
      text += `┃ > ▶️ Más Apps: ${otherLinks || "No disponible"}\n\n`;
      text += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      if (image) {
        await socket.sendMessage(
          remoteJid,
          { image: { url: image }, caption: text },
          { quoted: message },
        );
      } else {
        await socket.sendMessage(remoteJid, { text }, { quoted: message });
      }

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (err) {
      console.error("[shazam] Error:", err);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        { text: `❌ Error al identificar: ${err.message || err}` },
        { quoted: message },
      );
    } finally {
      // Limpieza garantizada de archivos temporales usando un bloque finally
      try {
        if (fs.existsSync(tempIn)) await fs.promises.unlink(tempIn);
      } catch (e) {}
      try {
        if (fs.existsSync(tempOut)) await fs.promises.unlink(tempOut);
      } catch (e) {}
    }
  },
};
