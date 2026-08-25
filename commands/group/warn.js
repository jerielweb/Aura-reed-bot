import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["warn", "advertir", "aviso"],
  category: "group",
  description: "Advertencias usuarios.",
  adminOnly: true,
  execute: async (
    socket,
    message,
    args,
    { db, saveDB, groupMetadata, prefix },
  ) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕━━⬣\n`;
      text += `${fytBold("ACCION INCONPATIBLE")} \n╰━━━━━━━━━━━━⬣\n\n`;
      text += `> Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    let userToWarn =
      message.message?.extendedTextMessage?.contextInfo?.participant ||
      message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (!userToWarn) {
      let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("FALTA OBJETIVO")} \n╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Etiqueta o responde al mensaje de alguien para advertirlo.\n`;
      text += `┃ > Ejemplo: ${prefix}warn @usuario [razón]\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const reason = args.filter((arg) => !arg.includes("@")).join(" ").trim();
    if (!reason) {
      let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("FALTA MOTIVO")} \n╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Debes especificar una razón para la advertencia.\n`;
      text += `┃ > Ejemplo: ${prefix}warn @usuario Insultos\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const clean = (id) => (id ? id.split("@")[0].split(":")[0] : null);
    const targetBase = clean(userToWarn);
    const isUserAdmin = groupMetadata?.participants.some((p) => {
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
      text += `┃ > No puedes advertir a\n`;
      text += `┃ > un administrador del grupo.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const date = new Date().toLocaleDateString("es-CR", {
      timeZone: "America/Costa_Rica",
    });

    if (!db.groups[remoteJid])
      db.groups[remoteJid] = {
        antilink: false,
        warnLimit: 3,
        warns: {},
        activity: {},
        botOn: true,
      };
    if (!db.groups[remoteJid].warns) db.groups[remoteJid].warns = {};
    if (!db.groups[remoteJid].warns[userToWarn])
      db.groups[remoteJid].warns[userToWarn] = [];

    db.groups[remoteJid].warns[userToWarn].push({ reason, date });
    saveDB(db);

    const limit = db.groups[remoteJid].warnLimit || 3;
    const count = db.groups[remoteJid].warns[userToWarn].length;

    if (count >= limit) {
      let text = `╭〔 🚨 ${fytBold("LÍMITE DE ADVERTENCIAS ALCANZADO")} 〕⬣\n\n`;
      text += `┃ 👤 Usuario: @${userToWarn.split("@")[0]}\n`;
      text += `┃ 📊 Warns: [ ${count}/${limit} ]\n`;
      text += `┃ 🛡️ Acción: Expulsado por límite de advertencias\n`;
      text += `┃ ⏰ Fecha: ${date}\n\n`;
      text += `┣━━━━━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ⚠️ El usuario ha alcanzado el límite de advertencias.\n`;
      text += `┃ ⚠️ Será expulsado del grupo.\n\n`;
      text += `╰〔 ${fytBold("WARN SYSTEM")} 〕⬣`;

      await socket.sendMessage(remoteJid, { text, mentions: [userToWarn] });
      await socket.groupParticipantsUpdate(remoteJid, [userToWarn], "remove");
      db.groups[remoteJid].warns[userToWarn] = [];
      saveDB(db);
    } else {
      const adminUser = message.key.participant || message.key.remoteJid;

      let text = `╭〔 ⚠️ ${fytBold("ADVERTENCIA")} 〕⬣\n\n`;
      text += `┃ 👤 Usuario: @${userToWarn.split("@")[0]}\n`;
      text += `┃ 🛡️ Admin: @${adminUser.split("@")[0]}\n`;
      text += `┃ 📌 Acción: Advertencia agregada\n`;
      text += `┃ 📊 Warns: [ ${count}/${limit} ]\n`;
      text += `┃ 📝 Razón: ${reason}\n`;
      text += `┃ ⏰ Fecha: ${date}\n\n┃\n`;
      text += `┣━━━━━━━━━━━━━━━━⬣\n`;
      text += `┃ ⚠️ Se ha añadido una\n`;
      text += `┃ ⚠️ advertencia al usuario.\n\n`;
      text += `╰〔 ${fytBold("WARN SYSTEM")} 〕⬣`;

      await socket.sendMessage(
        remoteJid,
        {
          text,
          mentions: [userToWarn, adminUser],
        },
        { quoted: message },
      );
    }
  },
};
