import { fytBold } from "./../../models/TextStyle.js";

export default {
  name: ["tag", "tg"],
  category: "group",
  description: "Mención invisible",
  adminOnly: true,
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCION INCONPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const groupMetadata = await socket.groupMetadata(remoteJid);
    const participants = groupMetadata.participants;
    const mentions = participants.map((p) => p.id);

    const ctx = message.message?.extendedTextMessage?.contextInfo;
    const quotedMsg = ctx?.quotedMessage;

    const customText = args.join(" ");
    const quotedText =
      quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || "";

    // 1. Si respondieron a un mensaje con contenido multimedia
    if (quotedMsg) {
      const type = Object.keys(quotedMsg)[0];

      if (
        type === "imageMessage" ||
        type === "videoMessage" ||
        type === "stickerMessage" ||
        type === "audioMessage" ||
        type === "documentMessage"
      ) {
        // Reenviar el archivo multimedia citado inyectando la mención masiva
        const forwardOptions = { mentions };
        if (customText) {
          forwardOptions.caption = customText;
        }

        return await socket.sendMessage(
          remoteJid,
          {
            forward: {
              key: {
                remoteJid,
                id: ctx.stanzaId,
                participant: ctx.participant,
              }
            },
            ...forwardOptions,
          }
        );
      }
    }

    // 2. Si es solo texto (escrito en el comando o citado)
    const finalMessage = customText || quotedText;

    if (!finalMessage) {
      let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("FALTA MENSAJE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Debes escribir un mensaje o responder a\n`;
      text += `┃ > uno existente para poder etiquetar a todos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    await socket.sendMessage(remoteJid, { text: finalMessage, mentions });
  },
};
