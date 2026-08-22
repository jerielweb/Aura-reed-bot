import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { getGroupUser } from "../../models/groupDb.js";
import formatter from "../../controllers/functions/formatNumbers.js";

export default {
  name: ["monthly", "mensual"],
  category: "economy",
  description: "Reclama tu recompensa mensual gigante con sistema de racha.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const participantJid = jidNormalizedUser(
      message.key.participant || message.key.remoteJid || jidRemitente
    );

    const user = getGroupUser(db, remoteJid, participantJid, {
      coins: 0,
      bank: 0,
      lastMonthly: 0,
      monthlyStreak: 0,
    });

    const now = Date.now();
    const cooldown = 30 * 24 * 60 * 60 * 1000; // 30 días
    const gracePeriod = 45 * 24 * 60 * 60 * 1000; // 45 días (tiempo límite para no perder la racha mensual)

    // Verificar si ya reclamó este mes (dentro de los 30 días)
    if (user.lastMonthly && now - user.lastMonthly < cooldown) {
      const timeLeft = cooldown - (now - user.lastMonthly);
      const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
      const hours = Math.floor(
        (timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
      );

      return await socket.sendMessage(
        remoteJid,
        {
          text: `⏳ Ya reclamaste tu sueldo mensual.\nVuelve a intentarlo en *${days}d ${hours}h*.`,
        },
        { quoted: message },
      );
    }

    // Calcular racha mensual: si pasa el periodo de gracia (45h/45d), se reinicia a 1; de lo contrario, sube +1
    if (user.lastMonthly && now - user.lastMonthly > gracePeriod) {
      user.monthlyStreak = 1;
    } else {
      user.monthlyStreak = (user.monthlyStreak || 0) + 1;
    }

    // Base recompensa (10k a 15k) multiplicada por 5 (50k a 75k) + bono por racha mensual (ej. +5,000 por cada mes, máximo 6 meses extra)
    const baseReward = (Math.floor(Math.random() * 5000) + 10000) * 5;
    const streakBonus = Math.min(user.monthlyStreak - 1, 6) * 5000;
    const totalReward = baseReward + streakBonus;

    user.coins = (user.coins || 0) + totalReward;
    user.lastMonthly = now;
    saveDB(db);

    let text = `╭〔 🎁 𝐒𝐔𝐄𝐋𝐃𝐎 𝐌𝐄𝐍𝐒𝐔𝐀𝐋 〕⬣\n`;
    text += `┃ 🔥 𝐑𝐀𝐂𝐇𝐀: *${user.monthlyStreak} Meses*\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ 👋 Hola *@${participantJid.split("@")[0]}*\n`;
    text += `┃ 🎉 Base (x5): ₡${formatter(baseReward)}\n`;
    text += `┃ ✨ Bono de Racha: +₡${formatter(streakBonus)}\n`;
    text += `┃ 💰 Total Ganado: *₡${formatter(totalReward)}*\n`;
    text += `┃ 💵 Saldo actual: ₡${formatter(user.coins)}\n\n`;
    text += `┃ ⏳ Próxima recompensa: En *30 días*\n\n`;
    text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text, mentions: [participantJid] },
      { quoted: message },
    );
  },
};
