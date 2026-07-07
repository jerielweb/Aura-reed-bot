import { errorMessage } from "../../models/messageTemplates.js";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["open", "abrir"],
  category: "group",
  description: "Abrir el grupo.",
  adminOnly: true,
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCION INCONPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    try {
      await socket.groupSettingUpdate(remoteJid, "not_announcement");
      let text = `╭〔 👑 ${fytBold("ADMIN SYSTEM")} 〕⬣\n\n`;
      text += `┃ ✅ 𝐆𝐑𝐔𝐏𝐎 𝐀𝐁𝐈𝐄𝐑𝐓𝐎\n\n`;
      text += `┃ > ahora todos pueden mensajear\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      await socket.sendMessage(
        remoteJid,
        {
          text,
        },
        { quoted: message },
      );
    } catch (e) {
      let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ERROR DE ADMIN")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No pude abrir el grupo.\n`;
      text += `┃ > Asegúrate de que soy admin.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};
