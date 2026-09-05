import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["banchat", "banearchat", "mutechat"],
  category: "group",
  description: "Desactiva las funciones del bot en el chat actual.",
  execute: async (socket, message, args, { db, saveDB, prefix }) => {
    const remoteJid = message.key.remoteJid;

    db.chats ??= {};
    db.chats[remoteJid] ??= {};

    if (db.chats[remoteJid].isBanned) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ Este chat ya se encuentra baneado.\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    db.chats[remoteJid].isBanned = true;
    saveDB(db);

    let menuTexto = `╭〔 🚫 ${fytBold("AURA REED")} 〕⬣\n`;
    menuTexto += `┃ ${fytBold("CHAT BANEADO")}\n`;
    menuTexto += `╰━━━━━━━━━━━━⬣\n\n`;
    menuTexto += `┃ 🛑 El bot ha sido desactivado en este chat.\n`;
    menuTexto += `┃ > No responderá a ningún comando hasta usar *${prefix}unbanchat*.\n\n`;
    menuTexto += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text: menuTexto },
      { quoted: message },
    );
  },
};
