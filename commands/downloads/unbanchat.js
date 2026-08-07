import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["unbanchat", "desbanearchat", "unmutechat"],
  category: "group",
  description: "Reactiva las funciones del bot en el chat actual.",
  execute: async (socket, message, args, { db, saveDB, prefix }) => {
    const remoteJid = message.key.remoteJid;

    db.chats ??= {};
    db.chats[remoteJid] ??= {};

    if (!db.chats[remoteJid].isBanned) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ℹ️ Este chat no se encuentra baneado.\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message }
      );
    }

    db.chats[remoteJid].isBanned = false;
    saveDB(db);

    let menuTexto = `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n`;
    menuTexto += `┃ 𝐂𝐇𝐀𝐓 𝐃𝐄𝐒𝐁𝐀𝐍𝐄𝐀𝐃𝐎\n`;
    menuTexto += `╰━━━━━━━━━━━━⬣\n\n`;
    menuTexto += `┃ 🎉 El bot ha sido reactivado en este chat.\n`;
    menuTexto += `┃ > Ya puedes volver a usar todos los comandos normalmente.\n\n`;
    menuTexto += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text: menuTexto },
      { quoted: message }
    );
  },
};
