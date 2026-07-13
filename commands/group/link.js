import { fytBold } from "./../../models/TextStyle.js";

export default {
  name: ["link", "linkgroup", "grupo"],
  category: "group",
  description: "Link del grupo.",
  adminOnly: true,
  execute: async (socket, message, args, { groupMetadata }) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCION INCONPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;
      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    let code = null;

    try {
      code = await socket.groupInviteCode(remoteJid);
    } catch (error) {
      // Intentamos fallback para comunidades.
    }

    if (!code) {
      try {
        const metadata = await socket.groupMetadata(remoteJid);
        code =
          metadata?.inviteCode ||
          metadata?.invite?.code ||
          metadata?.inviteCodeV2 ||
          metadata?.groupInviteCode;
      } catch (error) {
        // Ignorar y seguir al mensaje de error.
      }
    }

    if (code) {
      let text = `╭〔 🔗 ${fytBold("LINK DEL GRUPO")} 〕⬣\n\n`;
      text += `┃ 👥 Grupo: ${groupMetadata.subject}\n`;
      text += `┃ 🔗 Enlace: https://chat.whatsapp.com/${code}\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
    let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
    text += `┃ ${fytBold("ERROR DE LINK")} \n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ > No pude obtener el link\n`;
    text += `┃ > Asegúrate de que soy admin.\n\n`;
    text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;
    await socket.sendMessage(remoteJid, { text }, { quoted: message });
  },
};
