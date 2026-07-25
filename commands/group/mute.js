import { fytBold } from "../../models/TextStyle.js";
import { resolveLidToRealJid } from "./../../models/utils.js";

export default {
  name: ["mute", "silenciar"],
  category: "admin",
  description: "Silencia a un usuario borrando sus mensajes automáticamente.",
  adminOnly: true,
  botAdminOnly: true,

  execute: async (socket, message, args, { db }) => {
    const remoteJid = message.key.remoteJid;

    if (!remoteJid.endsWith("@g.us")) {
      return socket.sendMessage(
        remoteJid,
        { text: "⚠️ Este comando solo se puede usar en grupos." },
        { quoted: message }
      );
    }

    // Resolver objetivo por mención o mensaje citado
    let targetJid = null;
    const ctx = message.message?.extendedTextMessage?.contextInfo;

    if (ctx?.mentionedJid?.length > 0) {
      targetJid = ctx.mentionedJid[0];
    } else if (ctx?.participant) {
      targetJid = ctx.participant;
    }

    if (targetJid) {
      targetJid = await resolveLidToRealJid(targetJid, socket, remoteJid);
    }

    if (!targetJid) {
      let errorText = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      errorText += `┃ ❌ ${fytBold("FALTA USUARIO")}\n`;
      errorText += `╰━━━━━━━━━━━━⬣\n\n`;
      errorText += `┃ > Etiqueta o responde al mensaje del\n`;
      errorText += `┃ > usuario que deseas silenciar.\n\n`;
      errorText += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return socket.sendMessage(remoteJid, { text: errorText }, { quoted: message });
    }

    if (!db.groups) db.groups = {};
    if (!db.groups[remoteJid]) db.groups[remoteJid] = {};
    if (!db.groups[remoteJid].mutedUsers) db.groups[remoteJid].mutedUsers = [];

    const mutedUsers = db.groups[remoteJid].mutedUsers;
    const isMuted = mutedUsers.includes(targetJid);
    const userTag = `@${targetJid.split("@")[0]}`;

    if (isMuted) {
      db.groups[remoteJid].mutedUsers = mutedUsers.filter((j) => j !== targetJid);

      let text = `╭〔 🔊 ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ✅ ${fytBold("DESILENCIADO")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > El usuario ${userTag} ya puede hablar.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

      return socket.sendMessage(
        remoteJid,
        { text, mentions: [targetJid] },
        { quoted: message }
      );
    } else {
      db.groups[remoteJid].mutedUsers.push(targetJid);

      let text = `╭〔 🔇 ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ 🛑 ${fytBold("USUARIO SILENCIADO")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Los mensajes de ${userTag} serán\n`;
      text += `┃ > eliminados automáticamente.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

      return socket.sendMessage(
        remoteJid,
        { text, mentions: [targetJid] },
        { quoted: message }
      );
    }
  },
};
