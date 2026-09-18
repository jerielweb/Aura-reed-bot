import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["readmore", "leermas", "troll"],
  category: "fun",
  description: "Crea un mensaje falso de leer más.",

  execute: async (sock, m, args, isOwner) => {
    try {
      const chatId = m?.key?.remoteJid;

      if (!isOwner) {
        return await sock.sendMessage(
          chatId,
          {
            text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ 🚫 ${fytBold("ACCESO DENEGADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Solo el owner puede usar este comando.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
          },
          { quoted: m },
        );
      }

      const text = args.join(" ");

      if (!text.includes("|")) {
        return await sock.sendMessage(
          chatId,
          {
            text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FORMATO INVÁLIDO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Usa: $readmore texto visible | texto oculto\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
          },
          { quoted: m },
        );
      }

      const [visible, hidden] = text.split("|");
      const readMoreChar = String.fromCharCode(8206).repeat(4000);
      const finalText = `${visible.trim()} ${readMoreChar} ${hidden.trim()}`;

      await sock.sendMessage(chatId, { text: finalText });
    } catch (error) {
      if (sock && m) {
        await sock
          .sendMessage(
            m?.key?.remoteJid,
            { text: `Error: ${error?.message}` },
            { quoted: m },
          )
          .catch(() => {});
      }
    }
  },
};
