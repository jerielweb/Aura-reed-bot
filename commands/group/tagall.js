import { fytBold } from "./../../models/TextStyle.js";

export default {
  name: ["all", "todos", "invocar"],
  category: "group",
  description: "Menciona todos",
  adminOnly: true,
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      // Plantilla del mensaje para que sea más atractivo visualmente
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCION INCONPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      // Enviar mensaje de error
      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const groupMetadata = await socket.groupMetadata(remoteJid);
    const participants = groupMetadata.participants || [];
    const memberJids = [
      ...new Set(
        participants
          .map((p) => p?.id)
          .filter(
            (jid) => typeof jid === "string" && jid.endsWith("@s.whatsapp.net"),
          ),
      ),
    ];

    if (!memberJids.length) {
      // Plantilla del mensaje para que sea más atractivo visualmente
      let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("SIN MIEMBROS VÁLIDOS")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No se han encontrado participantes válidos en el grupo.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      // Enviar mensaje de error
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

    // Plantilla del mensaje para que sea más atractivo visualmente
    let text = `╭〔 📢 ${fytBold("AUR REED")} 〕⬣\n`;
    text += `┃ 🔔 ${fytBold("INVOCANDO AL GRUPO")}\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ ✨ ${customMessage}\n`;
    text += `┃ 👥 ${fytBold("N° de Miembros:")} ${totalMembers}\n\n`;
    text += `┣━━━━━━━━━━━━⬣\n\n`;
    text += memberJids.map((jid) => `┃ ➪ @${jid.split("@")[0]}`).join("\n");
    text += `\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    // Enviar mensaje con menciones a todos los miembros
    await socket.sendMessage(remoteJid, { text, mentions: memberJids });
  },
};
