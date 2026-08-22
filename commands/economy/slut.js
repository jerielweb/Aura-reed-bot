import { jidNormalizedUser } from "@whiskeysockets/baileys";
import formatNumber from "../../controllers/functions/formatNumbers.js";
import { economyTexts } from "../../models/economyTexts.js";
import { getGroupUser } from "../../models/groupDb.js";
import { getDBSync } from "../../models/db.js";

export default {
  name: ["slut", "putear", "prost"],
  category: "economy",
  description: "Vende tu cuerpo por dinero (con riesgo).",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const participantJid = jidRemitente;

    // 1. Obtener datos locales de economía del grupo
    const userEconomy = getGroupUser(db, remoteJid, participantJid, {
      coins: 0,
      bank: 0,
      lastSlut: 0,
    });

    // 2. Obtener datos globales del perfil (XP, nivel)
    const globalDb = getDBSync();
    if (!globalDb.users) globalDb.users = {};
    if (!globalDb.users[participantJid]) {
      globalDb.users[participantJid] = { xp: 0, level: 1 };
    }
    const userGlobal = globalDb.users[participantJid];

    const now = Date.now();
    const cooldown = 45 * 60 * 1000; // 45 minutos

    if (userEconomy.lastSlut && now - userEconomy.lastSlut < cooldown) {
      const timeLeft = cooldown - (now - userEconomy.lastSlut);
      const minutes = Math.floor(timeLeft / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

      return await socket.sendMessage(
        remoteJid,
        {
          text: `⏳ Tu cuerpo necesita descanso. Vuelve a intentarlo en *${minutes}m ${seconds}s*.`,
        },
        { quoted: message },
      );
    }

    const success = Math.random() > 0.5; // 50% probabilidad
    const xpGanado = Math.floor(Math.random() * (40 - 15 + 1)) + 15; // XP por la actividad
    userEconomy.lastSlut = now;

    // XP y Nivel se actualizan en el perfil global
    userGlobal.xp = (userGlobal.xp || 0) + xpGanado;
    userGlobal.level = Math.floor(userGlobal.xp / 150) + 1;

    if (success) {
      const phrases = economyTexts.slut.success;
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      const reward = Math.floor(Math.random() * 5000) + 1000; // 1000 a 6000
      userEconomy.coins = (userEconomy.coins || 0) + reward;

      let text = `╭〔 💃 𝐓𝐑𝐀𝐁𝐀𝐉𝐎 𝐍𝐎𝐂𝐓𝐔𝐑𝐍𝐎 〕⬣\n`;
      text += `┃ 💋 𝐄𝐗𝐈𝐓𝐎 𝐓𝐎𝐓𝐀𝐋\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ 👋 Hola *@${participantJid.split("@")[0]}*\n`;
      text += `┃ ✨ XP Ganado: +${xpGanado}\n`;
      text += `┃ ${randomPhrase} *₡${formatNumber(reward)}*\n`;
      text += `┃ 💵 𝐒𝐚𝐥𝐝𝐨 𝐚𝐜𝐭𝐮𝐚𝐥: ₡${formatNumber(userEconomy.coins)}\n\n`;
      text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

      saveDB(db);
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [participantJid] },
        { quoted: message },
      );
    } else {
      const phrases = economyTexts.slut.fail;
      const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
      const penalty = Math.floor(Math.random() * 2000) + 500; // 500 a 2500
      userEconomy.coins = Math.max(0, (userEconomy.coins || 0) - penalty);

      let text = `╭〔 💔 𝐌𝐀𝐋𝐀 𝐒𝐔𝐄𝐑𝐓𝐄 〕⬣\n`;
      text += `┃ 🤕 𝐍𝐎𝐂𝐇𝐄 𝐓𝐄𝐑𝐑𝐈𝐁𝐋𝐄\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ 👋 Hola *@${participantJid.split("@")[0]}*\n`;
      text += `┃ ✨ XP Ganado: +${xpGanado}\n`;
      text += `┃ ${randomPhrase} *₡${formatNumber(penalty)}*\n`;
      text += `┃ 💵 𝐒𝐚𝐥𝐝𝐨 𝐚𝐜𝐭𝐮𝐚𝐥: ₡${formatNumber(userEconomy.coins)}\n\n`;
      text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

      saveDB(db);
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [participantJid] },
        { quoted: message },
      );
    }
  },
};
