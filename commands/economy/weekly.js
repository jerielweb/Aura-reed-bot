import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { getGroupUser } from "../../models/groupDb.js";
import formatter from "../../controllers/functions/formatNumbers.js";

export default {
  name: ["weekly", "semanal"],
  category: "economy",
  description: "Reclama tu recompensa semanal.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const participantJid = jidRemitente;

    const user = getGroupUser(db, remoteJid, participantJid, {
      coins: 0,
      bank: 0,
      lastWeekly: 0,
      weeklyStreak: 0,
    });

    const now = Date.now();
    const cooldown = 7 * 24 * 60 * 60 * 1000; // 7 días
    const gracePeriod = 11 * 24 * 60 * 60 * 1000; // 11 días (tiempo límite para no perder la racha semanal)

    if (user.lastWeekly && now - user.lastWeekly < cooldown) {
      const timeLeft = cooldown - (now - user.lastWeekly);
      const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );

      return await socket.sendMessage(
        remoteJid,
        {
          text: `⏳ Ya reclamaste tu recompensa semanal.\nVuelve a intentarlo en *${days}d ${hours}h*.`,
        },
        { quoted: message },
      );
    }

    // Calcular racha semanal: si pasa el periodo de gracia, se reinicia a 1; de lo contrario, sube +1
    if (user.lastWeekly && now - user.lastWeekly > gracePeriod) {
      user.weeklyStreak = 1;
    } else {
      user.weeklyStreak = (user.weeklyStreak || 0) + 1;
    }

    // Base recompensa (3k a 5k) multiplicada por 3 (9k a 15k) + bono por racha semanal (ej. +1,500 por cada semana extra, máximo 8 semanas)
    const baseReward = (Math.floor(Math.random() * 2000) + 3000) * 3;
    const streakBonus = Math.min(user.weeklyStreak - 1, 8) * 1500;
    const totalReward = baseReward + streakBonus;

    user.coins = (user.coins || 0) + totalReward;
    user.lastWeekly = now;
    saveDB(db);

    let text = `╭〔 🎁 𝐁𝐎𝐍𝐎 𝐒𝐄𝐌𝐀𝐍𝐀𝐋 〕⬣\n`;
    text += `┃ 🔥 𝐑𝐀𝐂𝐇𝐀: *${user.weeklyStreak} Semanas*\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ 👋 Hola *@${participantJid.split("@")[0]}*\n`;
    text += `┃ 🎉 Base (x3): ₡${formatter(baseReward)}\n`;
    text += `┃ ✨ Bono de Racha: +₡${formatter(streakBonus)}\n`;
    text += `┃ 💰 Total Ganado: *₡${formatter(totalReward)}*\n`;
    text += `┃ 💵 Saldo actual: ₡${formatter(user.coins)}\n\n`;
    text += `┃ ⏳ Próxima recompensa: En *7 días*\n\n`;
    text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text, mentions: [participantJid] },
      { quoted: message },
    );
  },
};
