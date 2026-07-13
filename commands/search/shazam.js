import axios from "axios";
import yts from "yt-search";
import { downloadMediaMessage } from "@whiskeysockets/baileys";
import fs from "fs";
import ffmpegStatic from "ffmpeg-static";
import ffmpeg from "fluent-ffmpeg";
import { fytBold } from "../../models/TextStyle.js";

// Configuración de ffmpeg
ffmpeg.setFfmpegPath(ffmpegStatic);

const token = global.apiShazam?.apikey || "07887abb3c387183d5f3be932f3445d5";

export default {
  name: ["shazam", "whatsong", "audd", "find"],
  category: "search",
  description: "Identifica una canción desde un audio o video citado.",
  execute: async (socket, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;

    if (!quotedMsg) {
      return await socket.sendMessage(remoteJid, { text: `❗ Responde a un audio/video con ${prefix}shazam.` }, { quoted: message });
    }

    function unwrapMessage(msg) {
      if (!msg) return null;
      if (msg.audioMessage || msg.videoMessage || msg.documentMessage) return msg;
      if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);
      if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);
      return null;
    }

    const target = unwrapMessage(quotedMsg);
    if (!target) {
      return await socket.sendMessage(remoteJid, { text: `❗ El mensaje no contiene audio o video válido.` }, { quoted: message });
    }

    await socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

    const tempIn = `./tmp/shazam_in_${Date.now()}`;
    const tempOut = `./tmp/shazam_out_${Date.now()}.wav`;

    try {
      const downloadMsg = {
        key: {
          remoteJid: remoteJid,
          id: contextInfo.stanzaId,
          fromMe: contextInfo.participant === socket.user.id.split(":")[0] + "@s.whatsapp.net",
        },
        message: target,
      };

      const buffer = await downloadMediaMessage(downloadMsg, "buffer", {}, { logger: console });
      if (!buffer || buffer.length === 0) throw new Error("No se pudo descargar el archivo.");

      await fs.promises.mkdir("./tmp", { recursive: true });
      await fs.promises.writeFile(tempIn, buffer);

      // Conversión a WAV con filtro para eliminar silencio inicial (Offset)
      await new Promise((resolve, reject) => {
        ffmpeg(tempIn)
          .inputOptions(["-vn"])
          .outputOptions([
            "-t 15",
            "-acodec pcm_s16le",
            "-ar 44100",
            "-ac 1",
            "-af silenceremove=start_periods=1:start_duration=0.1:start_threshold=-50dB"
          ])
          .toFormat("wav")
          .on("error", (err) => reject(err))
          .on("end", () => resolve())
          .save(tempOut);
      });

      let outBuffer = await fs.promises.readFile(tempOut);
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
        throw new Error("No se pudo identificar la canción.");
      }

      const r = data.result;
      const title = r.title || "Desconocido";
      const artist = r.artist || "Desconocido";
      const album = r.album || "Desconocido";
      const genres = (r.apple_music?.genreNames || []).join(", ") || "Desconocido";

      const spotifyUrl = r.spotify?.external_urls?.spotify || "No disponible";
      const appleUrl = r.apple_music?.url || "No disponible";
      const youtubeUrl = r.youtube?.url || "No disponible";

      let text = `╭〔 🔍 ${fytBold("SHAZAM RESULT")} 〕━⬣\n\n`;
      text += `┃ ➥ ${title}\n\n`;
      text += `┃ > ${fytBold("Artista")} › ${artist}\n`;
      text += `┃ > ${fytBold("Álbum")} › ${album}\n`;
      text += `┃ > ${fytBold("Género")} › ${genres}\n\n`;
      text += `┣━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > ${fytBold("Escúchala aquí:")}\n`;
      text += `┃ > ▶️ Spotify: ${spotifyUrl}\n`;
      text += `┃ > 🍎 Apple Music: ${appleUrl}\n`;
      text += `┃ > ▶️ YouTube: ${youtubeUrl}\n\n`;
      text += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
      await socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } });

    } catch (err) {
      console.error("[shazam] Error:", err);
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
      await socket.sendMessage(remoteJid, { text: `❌ Error al identificar: ${err.message}` }, { quoted: message });
    } finally {
      if (fs.existsSync(tempIn)) await fs.promises.unlink(tempIn);
      if (fs.existsSync(tempOut)) await fs.promises.unlink(tempOut);
    }
  },
};
        
