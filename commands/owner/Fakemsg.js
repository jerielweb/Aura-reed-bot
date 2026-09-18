import { delay } from "@whiskeysockets/baileys";

export default {
  name: ["fakemsg", "fake", "fmsg"],
  category: "group",
  description: "Mensaje falso mediante edición de protocolo.",

  async execute(sock, msg, args, isOwner) {
    try {
      const targetChatId = msg?.key?.remoteJid;

      const hasQuoted =
        msg?.quoted ||
        msg?.message?.extendedTextMessage?.contextInfo?.quotedMessage ||
        msg?.contextInfo?.quotedMessage;

      if (!hasQuoted) {
        return await sock.sendMessage(
          targetChatId,
          { text: "Please reply to a message to process it." },
          { quoted: msg },
        );
      }

      const text = Array.isArray(args) ? args.join(" ") : String(args || "");
      if (!text.trim()) {
        return await sock.sendMessage(
          targetChatId,
          { text: "Please provide replacement text." },
          { quoted: msg },
        );
      }

      if (!targetChatId || !targetChatId.endsWith("@g.us")) {
        return await sock.sendMessage(
          targetChatId,
          { text: "This command only works in groups." },
          { quoted: msg },
        );
      }

      if (!isOwner) {
        return await sock.sendMessage(
          targetChatId,
          { text: "⚠️ Only the owner can use this command." },
          { quoted: msg },
        );
      }

      const stanzaId =
        msg.quoted?.stanzaId || msg.quoted?.key?.id || msg.key?.id;

      const tempId = await sock.relayMessage(
        targetChatId,
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
        targetChatId,
        {
          protocolMessage: {
            key: {
              jid: targetChatId,
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
        sock.sendMessage(targetChatId, {
          delete: {
            remoteJid: targetChatId,
            id: tempId,
            fromMe: true,
          },
        }),
        sock.sendMessage(targetChatId, {
          delete: {
            remoteJid: targetChatId,
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
              text: "Error: " + (error?.message || error),
            },
            { quoted: msg },
          )
          .catch(() => {});
      }
      return false;
    }
  },
};
