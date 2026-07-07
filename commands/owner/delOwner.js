export default {
  name: [
    "delowner",
    "removeowner",
    "rmowner",
    "quitarowner",
    "quitarpropietario",
  ],
  category: "owner",
  description: "Quita un owner del bot.",
  ownerOnly: true,

  execute: async (socket, message, args, { db, saveDB }) => {
    const remoteJid = message.key.remoteJid;
    const replied =
      message.message?.extendedTextMessage?.contextInfo?.participant;
    const mentioned =
      message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    let userToRemove = replied || mentioned;
    if (!userToRemove && args[0]) {
      const firstArg = args[0].replace(/[^0-9]/g, "");
      if (firstArg.length >= 7) userToRemove = `${firstArg}@s.whatsapp.net`;
    }

    if (!userToRemove) {
      let text = `╭〔 👑 𝐃𝐄𝐋 𝐎𝐖𝐍𝐄𝐑 〕⬣\n`;
      text += `┃ ⚠️ 𝐔𝐒𝐎 𝐈𝐍𝐂𝐎𝐑𝐑𝐄𝐂𝐓𝐎\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ➪ .delowner @usuario\n`;
      text += `┃ ➪ .delowner 50612345678\n`;
      text += `┃ ➪ Responde al mensaje de un owner\n`;
      text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    if (!Array.isArray(db.owners) || db.owners.length === 0) {
      return await socket.sendMessage(
        remoteJid,
        { text: "⚠️ No hay owners registrados en la base de datos." },
        { quoted: message },
      );
    }

    if (!db.owners.includes(userToRemove)) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `⚠️ @${userToRemove.split("@")[0]} no es owner del bot.`,
          mentions: [userToRemove],
        },
        { quoted: message },
      );
    }

    if (db.owners.length === 1) {
      return await socket.sendMessage(
        remoteJid,
        { text: "❌ No se puede quitar al último owner del bot." },
        { quoted: message },
      );
    }

    db.owners = db.owners.filter((owner) => owner !== userToRemove);
    if (db.ownerRoles && db.ownerRoles[userToRemove]) {
      delete db.ownerRoles[userToRemove];
    }
    saveDB(db);

    const text = `╭〔 👑 𝐃𝐄𝐋 𝐎𝐖𝐍𝐄𝐑 〕⬣\n\n┃ ✅ @${userToRemove.split("@")[0]} ha sido removido como owner.\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;
    await socket.sendMessage(
      remoteJid,
      { text, mentions: [userToRemove] },
      { quoted: message },
    );
  },
};
