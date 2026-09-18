import { delay } from "@whiskeysockets/baileys";
import isOwnerOrSudo from "../lib/isOwner.js";
import { fytBold } from "../../models/TextStyle.js";

async function fakemsgCommand(sock, msg, args = [], options = {}) {
  try {
    const chatId = msg?.key?.remoteJid || options.chatId;
    const senderId =
      options.senderId || msg?.key?.participant || msg?.key?.remoteJid || "";

    const hasQuoted =
      msg?.quoted ||
      msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
      msg?.contextInfo?.quotedMessage;

    if (!hasQuoted) {
      await sock?.sendMessage?.(
        chatId,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA MENSAJE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Responde a un mensaje para usarlo.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: msg },
      );
      return true;
    }

    const text = Array.isArray(args) ? args.join(" ") : String(args || "");
    if (!text.trim()) {
      await sock?.sendMessage?.(
        chatId,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA TEXTO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Proporciona el texto de reemplazo.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: msg },
      );
      return true;
    }

    if (!chatId || !chatId.endsWith("@g.us")) {
      await sock?.sendMessage?.(
        chatId,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("SOLO GRUPOS")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo funciona en grupos.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: msg },
      );
      return true;
    }

    if (senderId) {
      const isAllowed = await isOwnerOrSudo(senderId, sock, chatId);
      if (!isAllowed) {
        await sock?.sendMessage?.(
          chatId,
          {
            text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ 🚫 ${fytBold("ACCESO DENEGADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Solo el owner puede usar este comando.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
          },
          { quoted: msg },
        );
        return true;
      }
    }

    const stanzaId = msg.quoted?.stanzaId || msg.quoted?.key?.id || msg.key?.id;

    const tempId = await sock.relayMessage(
      chatId,
      {
        extendedTextMessage: {
          text: "",
          contextInfo: {
            isGroupStatus: true,
          },
        },
      },
      { quoted: msg },
    );

    const tempId2 = await sock.relayMessage(
      chatId,
      {
        protocolMessage: {
          key: {
            jid: chatId,
            fromMe: true,
            id: tempId,
          },
          type: 14,
          editedMessage: {
            extendedTextMessage: {
              text,
              contextInfo: {
                isGroupStatus: false,
              },
            },
          },
        },
      },
      { messageId: stanzaId },
    );

    await delay(100);

    await Promise.allSettled([
      sock.sendMessage(chatId, {
        delete: {
          remoteJid: chatId,
          id: tempId,
          fromMe: true,
        },
      }),
      sock.sendMessage(chatId, {
        delete: {
          remoteJid: chatId,
          id: tempId2,
          fromMe: true,
        },
      }),
    ]);

    return true;
  } catch (error) {
    console.error("[fakemsg]", error);
    if (sock && msg) {
      await sock
        .sendMessage(
          msg?.key?.remoteJid,
          {
            text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error?.message || error}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
          },
          { quoted: msg },
        )
        .catch(() => {});
    }
    return false;
  }
}

export default {
  name: ["fakemsg", "fake", "fmsg"],
  category: "owner",
  description: "Crea un mensaje falso simulando edición de texto.",
  ownerOnly: true,

  execute: async (socket, message, args) => {
    await fakemsgCommand(socket, message, args);
  },
};
