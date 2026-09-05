import { fytBold } from "../../models/TextStyle.js";
import { resolveLidToRealJid } from "./../../models/utils.js";

export default {
  name: ["mute", "silenciar"],
  category: "admin",
  description: "Silencia a un usuario borrando sus mensajes automáticamente.",
  adminOnly: true,
  botAdminOnly: true,

  execute: async (
    socket,
    message,
    args,
    { db, saveDB, isBotAdmin, groupMetadata },
  ) => {
    const remoteJid = message.key.remoteJid;

    if (!remoteJid.endsWith("@g.us")) {
      return socket.sendMessage(
        remoteJid,
        { text: "⚠️ Este comando solo se puede usar en grupos." },
        { quoted: message },
      );
    }

    if (!isBotAdmin) {
      let noAdminText = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      noAdminText += `┃ ❌ ${fytBold("SIN PERMISOS")}\n`;
      noAdminText += `╰━━━━━━━━━━━━⬣\n\n`;
      noAdminText += `┃ > No pude silenciar al usuario.\n`;
      noAdminText += `┃ > Necesito ser administrador del grupo.\n\n`;
      noAdminText += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return socket.sendMessage(
        remoteJid,
        { text: noAdminText },
        { quoted: message },
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
      return socket.sendMessage(
        remoteJid,
        { text: errorText },
        { quoted: message },
      );
    }

    // Validar si el objetivo es Administrador
    const clean = (id) => (id ? String(id).split("@")[0].split(":")[0] : null);
    const targetBase = clean(targetJid);
    const isUserAdmin = groupMetadata?.participants?.some((p) => {
      const pIdClean = clean(p.id);
      const pLidClean = clean(p.lid);
      const pPhoneClean = clean(p.phoneNumber);
      const matches =
        targetBase &&
        (pIdClean === targetBase ||
          pLidClean === targetBase ||
          pPhoneClean === targetBase);
      return matches && (p.admin === "admin" || p.admin === "superadmin");
    });

    if (isUserAdmin) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCIÓN PROHIBIDA")} \n╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No puedes silenciar a\n`;
      text += `┃ > un administrador del grupo.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    if (!db.groups) db.groups = {};
    if (!db.groups[remoteJid]) db.groups[remoteJid] = {};
    if (!db.groups[remoteJid].mutedUsers) db.groups[remoteJid].mutedUsers = [];

    const mutedUsers = db.groups[remoteJid].mutedUsers;
    const isMuted = mutedUsers.includes(targetJid);
    const userTag = `@${targetJid.split("@")[0]}`;

    if (isMuted) {
      return socket.sendMessage(
        remoteJid,
        {
          text: `⚠️ El usuario ${userTag} ya está silenciado.`,
          mentions: [targetJid],
        },
        { quoted: message },
      );
    }

    // Agregar a la lista de silenciados
    db.groups[remoteJid].mutedUsers.push(targetJid);
    if (typeof saveDB === "function") saveDB(db);

    let text = `╭〔 🔇 ${fytBold("AURA REED")} 〕⬣\n`;
    text += `┃ 🛑 ${fytBold("USUARIO SILENCIADO")}\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ > Los mensajes de ${userTag} serán\n`;
    text += `┃ > eliminados automáticamente.\n\n`;
    text += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

    return socket.sendMessage(
      remoteJid,
      { text, mentions: [targetJid] },
      { quoted: message },
    );
  },
};
