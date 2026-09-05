import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { fytBold } from "./../../models/TextStyle.js";

export default {
  name: ["all", "todos", "invocar"],
  category: "group",
  description: "Menciona todos",
  adminOnly: true,
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCIÓN INCOMPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    try {
      const groupMetadata = await socket.groupMetadata(remoteJid);
      const participants = groupMetadata?.participants || [];

      // Usamos jidNormalizedUser para estandarizar los JIDs correctamente
      const memberJids = [
        ...new Set(
          participants
            .map((p) => p?.id)
            .filter(Boolean)
            .map((jid) => jidNormalizedUser(jid)),
        ),
      ];

      if (!memberJids.length) {
        let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
        text += `┃ ${fytBold("SIN MIEMBROS VÁLIDOS")} \n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > No se han encontrado participantes válidos en el grupo.\n\n`;
        text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

        return socket.sendMessage(remoteJid, { text }, { quoted: message });
      }

      const totalMembers = memberJids.length;
      const quotedMsg =
        message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
      const quotedText =
        quotedMsg?.conversation ||
        quotedMsg?.extendedTextMessage?.text ||
        "𝐀𝐜𝐭𝐢́𝐯𝐞𝐧𝐬𝐞";
      const customMessage = args.join(" ") || quotedText;

      let text = `╭〔 📢 ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ 🔔 ${fytBold("INVOCANDO AL GRUPO")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ✨ ${customMessage}\n`;
      text += `┃ 👥 ${fytBold("N° de Miembros:")} ${totalMembers}\n\n`;
      text += `┣━━━━━━━━━━━━⬣\n\n`;

      text += memberJids.map((jid) => `┃ ➪ @${jid.split("@")[0]}`).join("\n");
      text += `\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      await socket.sendMessage(remoteJid, { text, mentions: memberJids });
    } catch (error) {
      console.error("[AURA REED] Error al obtener miembros del grupo:", error);
    }
  },
};
