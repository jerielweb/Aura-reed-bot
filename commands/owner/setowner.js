export default {
  name: ["setowner", "newowner", "addowner"],
  category: "owner",
  description: "Añade un nuevo owner al bot con un rol opcional.",
  ownerOnly: true,

  execute: async (socket, message, args, { db, saveDB }) => {
    const remoteJid = message.key.remoteJid;

    // Detectar usuario por reply o mención
    const replied =
      message.message?.extendedTextMessage?.contextInfo?.participant;
    const mentioned =
      message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    let userToAdd = null;
    let role = "Propietario";

    // Filtrar menciones @número de los args para limpiar el rol
    const cleanArgs = args.filter((a) => !/^@?\d{5,}$/.test(a));

    if (replied || mentioned) {
      // Modo reply/mención: todos los args limpios son el rol
      userToAdd = replied || mentioned;
      if (cleanArgs.length > 0) role = cleanArgs.join(" ");
    } else if (args[0]) {
      const firstArg = args[0].replace(/[^0-9]/g, "");
      if (firstArg.length >= 7) {
        // Primer argumento es un número de teléfono
        userToAdd = firstArg + "@s.whatsapp.net";
        if (cleanArgs.length > 0) role = cleanArgs.join(" ");
      } else {
        // No hay número, no se puede determinar el usuario
        userToAdd = null;
      }
    }

    if (!userToAdd) {
      let text = `╭〔 👑 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚠️ 𝐔𝐒𝐎 𝐈𝐍𝐂𝐎𝐑𝐑𝐄𝐂𝐓𝐎\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ➪ .setowner @usuario Colaborador\n`;
      text += `┃ ✦ Responde a alguien con el rol\n\n`;
      text += `┃ ➪ .setowner 50612345678 Colaborador\n`;
      text += `┃ ✦ Por número con el rol\n\n`;
      text += `┃ ✦ Si no pones rol, se usa *Propietario*\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    if (!db.owners) db.owners = [];
    if (!db.ownerRoles) db.ownerRoles = {};

    if (db.owners.includes(userToAdd)) {
      // Si ya es owner pero se cambia el rol
      const rolAnterior = db.ownerRoles[userToAdd] || "Propietario";
      if (rolAnterior === role) {
        let text = `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
        text += `┃ 👑 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐎𝐖𝐍𝐄𝐑\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > @${userToAdd.split("@")[0]} ya es\n`;
        text += `┃ > *${role}* del bot.\n\n`;
        text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text, mentions: [userToAdd] },
          { quoted: message },
        );
      }

      // Actualizar solo el rol
      db.ownerRoles[userToAdd] = role;
      saveDB(db);

      let text = `╭〔 👑 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ 🔄 𝐑𝐎𝐋 𝐀𝐂𝐓𝐔𝐀𝐋𝐈𝐙𝐀𝐃𝐎\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > @${userToAdd.split("@")[0]}\n`;
      text += `┃ > *${rolAnterior}* ➜ *${role}*\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [userToAdd] },
        { quoted: message },
      );
    }

    db.owners.push(userToAdd);
    db.ownerRoles[userToAdd] = role;
    saveDB(db);

    let text = `╭〔 👑 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
    text += `┃ ✅ 𝐍𝐔𝐄𝐕𝐎 𝐎𝐖𝐍𝐄𝐑\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ > @${userToAdd.split("@")[0]} ha sido\n`;
    text += `┃ > ascendido como *${role}*.\n\n`;
    text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text, mentions: [userToAdd] },
      { quoted: message },
    );
  },
};
