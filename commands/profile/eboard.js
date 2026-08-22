import { getGroupUsers } from "../../models/groupDb.js";
import { calculateLevel } from "../../models/profileUtils.js";
import formatter from "../../controllers/functions/formatNumbers.js";
import { fytBold } from "../../models/TextStyle.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

export default {
  name: ["eboard", "xprank", "levelboard"],
  category: "profile",
  description: "Muestra el ranking de usuarios por XP y nivel.",
  execute: async (socket, message, args, { db, remoteJid }) => {
    const targetJid = remoteJid || message.key.remoteJid;
    const groupUsers = getGroupUsers(db, targetJid);

    if (!groupUsers || Object.keys(groupUsers).length === 0) {
      return await socket.sendMessage(
        targetJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ No hay usuarios registrados aún.`,
        },
        { quoted: message },
      );
    }

    let pageSize = 10;
    let page = 1;

    if (args.length === 1) {
      const arg = parseInt(args[0], 10);
      if (arg > 20) {
        pageSize = Math.min(Math.max(arg, 1), 50);
      } else if (arg > 0) {
        page = arg;
      }
    } else if (args.length >= 2) {
      pageSize = Math.min(Math.max(parseInt(args[0], 10) || 10, 1), 50);
      page = Math.max(parseInt(args[1], 10) || 1, 1);
    }

    const usersArr = Object.entries(groupUsers).map(([jid, data]) => {
      const normalizedJid = jidNormalizedUser(jid);
      const xp = data.xp || 0;
      const level = calculateLevel(xp);
      return { jid: normalizedJid, xp, level };
    });

    const allSorted = usersArr
      .filter((u) => (u.xp || 0) > 0)
      .sort((a, b) => (b.level !== a.level ? b.level - a.level : b.xp - a.xp));

    if (allSorted.length === 0) {
      return await socket.sendMessage(
        targetJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ No hay usuarios con XP registrado.`,
        },
        { quoted: message },
      );
    }

    const totalPages = Math.max(Math.ceil(allSorted.length / pageSize), 1);
    const currentPage = Math.min(page, totalPages);
    const startIndex = (currentPage - 1) * pageSize;
    const pageUsers = allSorted.slice(startIndex, startIndex + pageSize);

    const medals = ["🥇", "🥈", "🥉", "🎖️"];
    let text = `╭━━〔 ✨ ${fytBold("XP BOARD")} ✨ 〕━━⬣\n`;
    text += `┃ 📊 Ranking de niveles y experiencia\n`;
    text += `┃ 📄 Página: ${currentPage}/${totalPages}\n`;
    text += `╰━━━━━━━━━━━━━━━━⬣\n\n`;

    const mentions = [];
    pageUsers.forEach((u, i) => {
      const rank = startIndex + i + 1;
      const medal = rank <= 3 ? medals[rank - 1] : medals[3];

      text += `┃ ${medal} *#${rank}* ➔ @${u.jid.split("@")[0]}\n`;
      text += `┃ 📊 Nivel *${u.level}* | XP: ${formatter(u.xp)}\n\n`;

      mentions.push(u.jid);
    });

    text += `╰━━〔 ⚡ ${fytBold("AURA PROFILE")} ⚡ 〕━━⬣`;

    await socket.sendMessage(
      targetJid,
      { text, mentions },
      { quoted: message },
    );
  },
};
