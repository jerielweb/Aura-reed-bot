// lvl.js
import {
  getProfileUser,
  calculateLevel,
  xpToNextLevel,
  resolveTargetJid,
} from "../../models/profileUtils.js";
import { resolveLidToRealJid } from "../../models/utils.js";

export default {
  name: ["lvl", "level", "nivel"],
  category: "profile",
  description: "Muestra tu nivel y experiencia en el grupo.",
  execute: async (socket, message, args, { db, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;

    const targetLid = await resolveTargetJid(
      message,
      socket,
      remoteJid,
      jidRemitente,
    );

    const user = getProfileUser(db, remoteJid, targetLid);
    const realJid = await resolveLidToRealJid(targetLid, socket, remoteJid);

    const xp = user.xp || 0;
    const level = user.level || calculateLevel(xp);
    const remaining = xpToNextLevel(xp);

    let text = `╭〔 📊 𝐍𝐈𝐕𝐄𝐋 〕⬣\n`;
    text += `┃ ⭐ 𝐏𝐑𝐎𝐆𝐑𝐄𝐒𝐎\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ 👤 @${realJid.split("@")[0]}\n`;
    text += `┃ 📊 𝐍𝐢𝐯𝐞𝐥 › *${level}*\n`;
    text += `┃ ✨ 𝐗𝐏 › ${xp.toLocaleString()}\n`;
    text += `┃ 🎯 𝐗𝐏 𝐩𝐚𝐫𝐚 𝐬𝐮𝐛𝐢𝐫 › ${remaining.toLocaleString()}\n\n`;
    text += `┃ 💬 Ganas XP al participar en el grupo.\n\n`;
    text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text, mentions: [realJid] },
      { quoted: message },
    );
  },
};