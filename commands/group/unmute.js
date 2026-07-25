import { fytBold } from "../../models/TextStyle.js";
import { resolveLidToRealJid } from "./../../models/utils.js";


export default {
  name: ["unmute", "desilenciar"],
  category: "admin",
  description: "Quita el silencio a un usuario para que sus mensajes no se borren.",
  adminOnly: true,

  execute: async (socket, message, args, { db, saveDB }) => {
    const remoteJid = message.key.remoteJid;

    if (!remoteJid.endsWith("@g.us")) {
      return socket.sendMessage(
        remoteJid,
        { text: "⚠️ Este comando solo se puede usar en grupos." },
        { quoted: message }
      );
    }
    if (!isBotAdmin) {
      let noAdminText = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      noAdminText += `┃ ❌ ${fytBold("SIN PERMISOS")}\n`;
      noAdminText += `╰━━━━━━━━━━━━⬣\n\n`;
      noAdminText += `┃ > No pude desilenciar al usuario.\n`;
      noAdminText += `┃ > Necesito ser administrador del grupo.\n\n`;
      noAdminText += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return socket.sendMessage(remoteJid, { text: noAdminText }, { quoted: message });
    }

    // Resolver el objetivo etiquetado o respondido
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
      errorText += `┃ > usuario que deseas desilenciar.\n\n`;
      errorText += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return socket.sendMessage(remoteJid, { text: errorText }, { quoted: message });
    }

    const mutedUsers = db.groups?.[remoteJid]?.mutedUsers || [];
    const isMuted = mutedUsers.includes(targetJid);
    const userTag = `@${targetJid.split("@")[0]}`;

    if (!isMuted) {
      return socket.sendMessage(
        remoteJid,
        { text: `⚠️ El usuario ${userTag} no está silenciado.`, mentions: [targetJid] },
        { quoted: message }
      );
    }

    // Remover de la lista
    db.groups[remoteJid].mutedUsers = mutedUsers.filter((j) => j !== targetJid);
    if (typeof saveDB === "function") saveDB(db);

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
  },
};
