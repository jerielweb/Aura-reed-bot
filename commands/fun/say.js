import { downloadContentFromMessage } from "@whiskeysockets/baileys";
import { fytBold } from "./../../models/TextStyle.js";

export default {
  name: ["say", "decir"],
  category: "utility",
  description: "Repite un mensaje o reenvía multimedia sin etiqueta de reenviado",
  adminOnly: false,
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;

    const ctx = message.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = ctx?.quotedMessage;

    const customText = args.join(" ").trim();

    // 1. Manejo de contenido multimedia citado (imágenes, stickers, videos, etc.)
    if (quotedMsg) {
      const type = Object.keys(quotedMsg)[0];

      if (
        [
          "imageMessage",
          "videoMessage",
          "stickerMessage",
          "audioMessage",
          "documentMessage",
        ].includes(type)
      ) {
        const mediaMsg = quotedMsg[type];
        const mediaType = type.replace("Message", "");

        // Descargar el buffer para enviarlo sin etiqueta de reenviado
        const stream = await downloadContentFromMessage(mediaMsg, mediaType);
        let buffer = Buffer.from([]);
        for await (const chunk of stream) {
          buffer = Buffer.concat([buffer, chunk]);
        }

        const payload = {};

        if (type === "imageMessage") {
          payload.image = buffer;
          payload.caption = customText || mediaMsg.caption || "";
        } else if (type === "videoMessage") {
          payload.video = buffer;
          payload.caption = customText || mediaMsg.caption || "";
          payload.gifPlayback = mediaMsg.gifPlayback || false;
        } else if (type === "stickerMessage") {
          payload.sticker = buffer;
        } else if (type === "audioMessage") {
          payload.audio = buffer;
          payload.mimetype = mediaMsg.mimetype || "audio/mp4";
          payload.ptt = mediaMsg.ptt || false;
        } else if (type === "documentMessage") {
          payload.document = buffer;
          payload.mimetype = mediaMsg.mimetype;
          payload.fileName = mediaMsg.fileName || "documento";
          payload.caption = customText || mediaMsg.caption || "";
        }

        return await socket.sendMessage(remoteJid, payload);
      }
    }

    // 2. Manejo de texto puro (escrito en el comando o citado)
    const quotedText =
      quotedMsg?.conversation ||
      quotedMsg?.extendedTextMessage?.text ||
      "";

    const finalText = customText || quotedText;

    if (!finalText) {
      let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("FALTA MENSAJE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Debes escribir un mensaje o responder a\n`;
      text += `┃ > uno existente para usar este comando.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    return await socket.sendMessage(remoteJid, { text: finalText });
  },
};