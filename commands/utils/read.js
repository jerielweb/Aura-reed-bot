import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["read"],
  category: "utils",
  description: "Extrae y reenvía medios de visualización única.",
  execute: async (socket, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;

    // Obtener mensaje citado
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = contextInfo?.quotedMessage;

    if (!quotedMsg) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA MENSAJE CITADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Responde al mensaje que contiene el medio de visualización única y ejecuta ${prefix}read.`,
        },
        { quoted: message },
      );
    }

    // Función para desempaquetar viewOnce / wrappers
    function unwrapMessage(msg) {
      if (!msg) return null;
      if (
        msg.imageMessage ||
        msg.videoMessage ||
        msg.documentMessage ||
        msg.audioMessage ||
        msg.stickerMessage
      )
        return msg;
      if (msg.viewOnceMessageV2?.message)
        return unwrapMessage(msg.viewOnceMessageV2.message);
      if (msg.viewOnceMessage?.message)
        return unwrapMessage(msg.viewOnceMessage.message);
      if (msg.documentWithCaptionMessage?.message)
        return unwrapMessage(msg.documentWithCaptionMessage.message);
      return null;
    }

    const target = unwrapMessage(quotedMsg);
    if (!target) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("NO HAY MEDIO VÁLIDO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > El mensaje citado no contiene una imagen o video.`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      const downloadMsg = { key: message.key, message: target };
      const buffer = await downloadMediaMessage(
        downloadMsg,
        "buffer",
        {},
        { logger: console },
      );

      if (!buffer || buffer.length === 0)
        throw new Error("No se pudo descargar el medio.");

      // Construir objeto para citar el mensaje original (mínimo requerido)
      const quotedKey = {
        remoteJid,
        id: contextInfo.stanzaId || contextInfo.stanzaId || message.key.id,
        participant: contextInfo.participant || undefined,
      };
      const quotedObj = { key: quotedKey, message: quotedMsg };

      // Enviar según tipo
      if (target.imageMessage) {
        await socket.sendMessage(
          remoteJid,
          {
            image: buffer,
            caption: `🔁 ${fytBold("Aqui tienes la imagen mi compa")}`,
          },
          { quoted: quotedObj },
        );
      } else if (target.videoMessage) {
        await socket.sendMessage(
          remoteJid,
          {
            video: buffer,
            caption: `🔁 ${fytBold("Aqui tienes el video mi compa")}`,
          },
          { quoted: quotedObj },
        );
      } else {
        throw new Error("Tipo de medio no soportado.");
      }

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("[read] Error:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR AL REENVIAR")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "No pude extraer el medio."}`,
        },
        { quoted: message },
      );
    }
  },
};
