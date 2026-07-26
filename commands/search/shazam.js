import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { identifySong } from "../../controllers/shazamScraper.js";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["shazam", "whatsong", "findsong", "find"],
  category: "search",
  description: "Identifica una canción desde un audio o video citado.",
  execute: async (socket, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;

    if (!quotedMsg) {
      return await socket.sendMessage(
        remoteJid,
        { text: `❗ Responde a un audio/video con ${prefix}shazam.` },
        { quoted: message }
      );
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
      return await socket.sendMessage(
        remoteJid,
        { text: `❗ El mensaje no contiene audio o video válido.` },
        { quoted: message }
      );
    }

    await socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

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

      // Procesamiento con el scraper (recorta, sube e identifica automáticamente)
      const track = await identifySong(buffer, { seconds: 60 });

      const title = track.title || "Desconocido";
      const artist = track.artist || "Desconocido";
      const album = track.album || "Desconocido";
      const genre = track.genre || "Desconocido";
      const releaseDate = track.releaseDate || "Desconocida";
      const label = track.label || "Desconocida";

      let text = `╭〔 🔍 ${fytBold("SHAZAM RESULT")} 〕━⬣\n\n`;
      text += `┃ ➥ ${title}\n\n`;
      text += `┣━━━━━━━━━━━━⬣\n`;
      text += `┃ > ${fytBold("Artista")} › ${artist}\n`;
      text += `┃ > ${fytBold("Álbum")} › ${album}\n`;
      text += `┃ > ${fytBold("Género")} › ${genre}\n`;
      text += `┃ > ${fytBold("Fecha")} › ${releaseDate}\n`;
      text += `┃ > ${fytBold("Sello")} › ${label}\n\n`;
      text += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      if (track.coverArt) {
        await socket.sendMessage(
          remoteJid,
          { image: { url: track.coverArt }, caption: text },
          { quoted: message }
        );
      } else {
        await socket.sendMessage(remoteJid, { text }, { quoted: message });
      }

      await socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } });

    } catch (err) {
      console.error("[shazam] Error:", err);
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
      await socket.sendMessage(
        remoteJid,
        { text: `❌ Error al identificar: ${err.message || "Sin coincidencias."}` },
        { quoted: message }
      );
    }
  },
};
