import { fytBold } from "./../../models/TextStyle.js";

export default {
  name: ["onlyadmin", "soloadmin", "adminonly"],
  category: "group",
  description: "Solo admins usan el Bot.",
  adminOnly: true,
  execute: async (socket, message, args, { db, saveDB }) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCION INCOMPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    db.groups = db.groups || {};
    if (!db.groups[remoteJid]) {
      db.groups[remoteJid] = {
        antilink: false,
        warnLimit: 3,
        warns: {},
        activity: {},
        onlyAdmin: false,
        botOn: true,
      };
    }

    const status = args[0]?.toLowerCase();

    if (
      ["on", "1", "true", "activar", "enable"].includes(status)
    ) {
      db.groups[remoteJid].onlyAdmin = true;
      saveDB(db);
      let text = `╭〔 🛡️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ✅ 𝐀𝐂𝐂𝐈𝐎́𝐍 𝐄𝐌𝐏𝐋𝐄𝐌𝐄𝐍𝐓𝐀𝐃𝐀\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Modo Solo Admins\n`;
      text += `┃ > activado con éxito.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } else if (
      ["off", "0", "false", "desactivar", "disable"].includes(status)
    ) {
      db.groups[remoteJid].onlyAdmin = false;
      saveDB(db);
      let text = `╭〔 🛡️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ❌ 𝐀𝐂𝐂𝐈𝐎́𝐍 𝐄𝐌𝐏𝐋𝐄𝐌𝐄𝐍𝐓𝐀𝐃𝐀\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Modo Solo Admins\n`;
      text += `┃ > desactivado con éxito.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } else {
      const currentStatus = db.groups[remoteJid].onlyAdmin
        ? "✅ Activado"
        : "❌ Desactivado";
      let text = `╭〔 🛡️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚙️ 𝐌𝐎𝐃𝐎 𝐒𝐎𝐋𝐎 𝐀𝐃𝐌𝐈𝐍𝐒\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ℹ️ Estado actual: ${currentStatus}\n\n`;
      text += `┣━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ➪ .onlyadmin on\n`;
      text += `┃ ✦ Activar modo admins\n\n`;
      text += `┃ ➪ .onlyadmin off\n`;
      text += `┃ ✦ Desactivar modo admins\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};
