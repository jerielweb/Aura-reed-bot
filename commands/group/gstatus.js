import {
  generateWAMessageContent,
  generateWAMessageFromContent,
  jidNormalizedUser,
  downloadMediaMessage,
} from "@whiskeysockets/baileys";
import { fytBold } from "../../models/TextStyle.js";

// Función interna para publicar el estado de grupo V2
const sendGroupStatus = async (socket, jid, options = {}) => {
  const {
    text,
    media,
    type = "text",
    caption = "",
    mimetype,
    fileName,
    ptt = false,
    textArgb = 4292401368,
    backgroundArgb = 4283453520,
    font = 5,
    audienceType = 2,
    listName = "Mejores Amigos",
    listEmoji = "⭐",
  } = options;

  if (!socket?.relayMessage) throw new Error("Socket no disponible");
  if (!jid) throw new Error("JID de grupo no recibido");

  const contextInfo = {
    statusSourceType: 0,
    statusAttributions: [{ AttributionData: null, type: 10 }],
    isGroupStatus: true,
    statusAudienceMetadata: { audienceType, listName, listEmoji },
  };

  let innerMessage;

  if (type === "text") {
    if (!text) throw new Error("Ingresa un texto para el estado");
    innerMessage = {
      extendedTextMessage: {
        text,
        textArgb,
        backgroundArgb,
        font,
        previewType: 0,
        contextInfo,
      },
    };
  } else {
    if (!socket?.waUploadToServer)
      throw new Error("Servidor de carga no disponible");
    if (!media) throw new Error("Se requiere un archivo multimedia");

    const mediaContent = {
      [type]: typeof media === "string" ? { url: media } : media,
    };

    if (caption && ["image", "video"].includes(type))
      mediaContent.caption = caption;
    if (mimetype) mediaContent.mimetype = mimetype;
    if (fileName && type === "document") mediaContent.fileName = fileName;
    if (type === "audio") mediaContent.ptt = ptt;

    const content = await generateWAMessageContent(mediaContent, {
      upload: socket.waUploadToServer,
    });

    const messageKey = `${type}Message`;
    if (!content?.[messageKey])
      throw new Error(`No se pudo generar el mensaje de tipo ${type}`);

    content[messageKey].contextInfo = contextInfo;
    innerMessage = { [messageKey]: content[messageKey] };
  }

  const senderJid = socket.user?.id
    ? jidNormalizedUser(socket.user.id)
    : undefined;

  const message = generateWAMessageFromContent(
    jid,
    { groupStatusMessageV2: { message: innerMessage } },
    { userJid: senderJid }
  );

  await socket.relayMessage(jid, message.message, {
    messageId: message.key.id,
  });
  return message;
};

export default {
  name: ["estadogrupo", "gstatus", "statusgrupo"],
  description: "Publica un estado exclusivo para el grupo actual.",
  adminOnly: false,

  execute: async (socket, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;

    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCIÓN INCOMPATIBLE")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text },
        { quoted: message }
      );
    }

    const inputContent = args.join(" ");

    // Buscar si hay un mensaje citado (quoted) de forma nativa en Baileys
    const quotedMsg =
      message.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
      message.message?.ephemeralMessage?.message?.extendedTextMessage
        ?.contextInfo?.quotedMessage;

    try {
      if (quotedMsg) {
        const type = Object.keys(quotedMsg)[0];
        const mediaType = type.replace("Message", "").toLowerCase();

        if (["image", "video", "audio", "document"].includes(mediaType)) {
          // Descarga directa con la función nativa de Baileys
          const buffer = await downloadMediaMessage(
            {
              key: {
                remoteJid,
                id: message.message?.extendedTextMessage?.contextInfo
                  ?.stanzaId,
                participant:
                  message.message?.extendedTextMessage?.contextInfo
                    ?.participant,
              },
              message: quotedMsg,
            },
            "buffer",
            {}
          );

          await sendGroupStatus(socket, remoteJid, {
            type: mediaType,
            media: buffer,
            caption: inputContent || quotedMsg[type]?.caption || "",
            mimetype: quotedMsg[type]?.mimetype,
            fileName: quotedMsg[type]?.fileName,
          });
        } else {
          const statusText =
            inputContent ||
            quotedMsg.conversation ||
            quotedMsg.extendedTextMessage?.text;

          if (!statusText) {
            let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
            text += `┃ ⚠️ ${fytBold("ERROR DE ESTADO")}\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > El mensaje citado no contiene texto válido.\n\n`;
            text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;
            return await socket.sendMessage(
              remoteJid,
              { text },
              { quoted: message }
            );
          }

          await sendGroupStatus(socket, remoteJid, {
            type: "text",
            text: statusText,
          });
        }
      } else {
        if (!inputContent) {
          let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
          text += `┃ ⚠️ ${fytBold("ERROR DE ESTADO")}\n`;
          text += `╰━━━━━━━━━━━━⬣\n\n`;
          text += `┃ > Ingresa un texto o responde a un archivo multimedia\n`;
          text += `┃ > para publicarlo en el estado del grupo.\n\n`;
          text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;
          return await socket.sendMessage(
            remoteJid,
            { text },
            { quoted: message }
          );
        }

        await sendGroupStatus(socket, remoteJid, {
          type: "text",
          text: inputContent,
        });
      }

      let text = `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ 🟢 ${fytBold("ESTADO PUBLICADO")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > El estado se ha subido correctamente al grupo.\n\n`;
      text += `╰〔 ⚡${fytBold("SYSTEM INFO")} 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } catch (e) {
      console.error(e);
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ⚠️ ${fytBold("ERROR DE SISTEMA")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > ${e.message}\n\n`;
      text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};
