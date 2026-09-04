// lvl.js
import {
  getProfileUser,
  calculateLevel,
  xpToNextLevel,
  resolveTargetJid,
} from "../../models/profileUtils.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { resolveLidToRealJid } from "../../models/utils.js";

export default {
  name: ["lvl", "level", "nivel"],
  category: "profile",
  description: "Muestra tu nivel y experiencia en el grupo.",
  execute: async (socket, message, args, { db, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    let targetJid = await resolveTargetJid(
      message,
      socket,
      remoteJid,
      jidRemitente,
    );
    targetJid = jidNormalizedUser(targetJid);
    const user = getProfileUser(db, remoteJid, targetJid);

    const xp = user.xp || 0;
    const level = user.level || calculateLevel(xp);
    const remaining = xpToNextLevel(xp);

    // Obtener JID real para la mención
    const realJid = await resolveLidToRealJid(targetJid, socket, remoteJid);
    const mentionJid = realJid || targetJid;

    let text = `╭〔 📊 𝐍𝐈𝐕𝐄𝐋 〕⬣\n`;
    text += `┃ ⭐ 𝐏𝐑𝐎𝐆𝐑𝐄𝐒𝐎\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ 👤 @${mentionJid.split("@")[0]}\n`;
    text += `┃ 📊 𝐍𝐢𝐯𝐞𝐥 › *${level}*\n`;
    text += `┃ ✨ 𝐗𝐏 › ${xp.toLocaleString()}\n`;
    text += `┃ 🎯 𝐗𝐏 𝐩𝐚𝐫𝐚 𝐬𝐮𝐛𝐢𝐫 › ${remaining.toLocaleString()}\n\n`;
    text += `┃ 💬 Ganas XP al participar en el grupo.\n\n`;
    text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text, mentions: [mentionJid] },
      { quoted: message },
    );
  },
};