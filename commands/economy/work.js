import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { economyTexts } from "../../models/economyTexts.js";
import { getGroupUser } from "../../models/groupDb.js";
import formatter from "../../controllers/functions/formatNumbers.js";
import { getDBSync } from "../../models/db.js";

export default {
  name: ["work", "trabajar", "w", "job", "empleo"],
  category: "economy",
  description: "Trabaja para ganar algunas monedas y experiencia.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const participantJid = jidNormalizedUser(
      message.key.participant || message.key.remoteJid || jidRemitente
    );

    // 1. Obtener datos locales de economía del grupo
    const userEconomy = getGroupUser(db, remoteJid, participantJid, {
      coins: 0,
      bank: 0,
      lastWork: 0,
    });

    // 2. Obtener datos globales del perfil (XP, nivel)
    const globalDb = getDBSync();
    if (!globalDb.users) globalDb.users = {};
    if (!globalDb.users[participantJid]) {
      globalDb.users[participantJid] = { xp: 0, level: 1 };
    }
    const userGlobal = globalDb.users[participantJid];

    const now = Date.now();
    const cooldown = 5 * 60 * 1000; // 5 minutos

    if (userEconomy.lastWork && now - userEconomy.lastWork < cooldown) {
      const timeLeft = cooldown - (now - userEconomy.lastWork);
      const minutes = Math.floor(timeLeft / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

      return await socket.sendMessage(
        remoteJid,
        {
          text: `⏳ Estás cansado. Descansa *${minutes}m ${seconds}s* antes de volver a trabajar.`,
        },
        { quoted: message },
      );
    }

    const works = economyTexts.work;
    const randomWork = works[Math.floor(Math.random() * works.length)];
    const reward = Math.floor(Math.random() * 2000) + 5000; // Entre 5000 y 7000
    const xpGanado = Math.floor(Math.random() * (30 - 10 + 1)) + 10; // XP por la jornada laboral

    userEconomy.coins = (userEconomy.coins || 0) + reward;
    userEconomy.lastWork = now;

    // XP y Nivel se actualizan en el perfil global
    userGlobal.xp = (userGlobal.xp || 0) + xpGanado;
    userGlobal.level = Math.floor(userGlobal.xp / 150) + 1;

    saveDB(db);

    let text = `╭〔 💼 𝐓𝐑𝐀𝐁𝐀𝐉𝐎 〕⬣\n`;
    text += `┃ 👷 𝐉𝐎𝐑𝐍𝐀𝐃𝐀 𝐋𝐀𝐁𝐎𝐑𝐀𝐋\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ 👋 Hola *@${participantJid.split("@")[0]}*\n`;
    text += `┃ ✨ XP Ganado: +${xpGanado}\n`;
    text += `┃ 🛠️ ${randomWork} *₡${formatter(reward)}*\n`;
    text += `┃ 💵 𝐒𝐚𝐥𝐝𝐨 𝐚𝐜𝐭𝐮𝐚𝐥: ₡${formatter(userEconomy.coins)}\n\n`;
    text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text, mentions: [participantJid] },
      { quoted: message },
    );
  },
};
