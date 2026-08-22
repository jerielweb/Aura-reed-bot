import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { getGroupUser } from "../../models/groupDb.js";
import formatter from "../../controllers/functions/formatNumbers.js";

export default {
  name: ["daily", "diario"],
  category: "economy",
  description: "Reclama tu recompensa diaria.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const participantJid = jidNormalizedUser(
      message.key.participant || message.key.remoteJid || jidRemitente
    );

    const user = getGroupUser(db, remoteJid, participantJid, {
      coins: 0,
      bank: 0,
      lastDaily: 0,
      streak: 0,
    });

    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; // 24 horas
    const gracePeriod = 48 * 60 * 60 * 1000; // 48 horas (tiempo límite para no perder la racha)

    // Verificar si ya reclamó hoy (dentro de las 24 horas)
    if (user.lastDaily && now - user.lastDaily < cooldown) {
      const timeLeft = cooldown - (now - user.lastDaily);
      const hours = Math.floor(timeLeft / (1000 * 60 * 60));
      const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

      return await socket.sendMessage(
        remoteJid,
        {
          text: `⏳ Ya reclamaste tu recompensa diaria.\nVuelve en *${hours}h ${minutes}m*.`,
        },
        { quoted: message },
      );
    }

    // Calcular racha: si pasa el periodo de gracia (48h), se reinicia a 1; de lo contrario, sube +1
    if (user.lastDaily && now - user.lastDaily > gracePeriod) {
      user.streak = 1;
    } else {
      user.streak = (user.streak || 0) + 1;
    }

    // Base recompensa (500 - 1000) + bono por racha (ej. +100 por cada día de racha, máximo 10 días extra)
    const baseReward = Math.floor(Math.random() * 500) + 500;
    const streakBonus = Math.min(user.streak - 1, 10) * 100;
    const totalReward = baseReward + streakBonus;

    user.coins = (user.coins || 0) + totalReward;
    user.lastDaily = now;
    saveDB(db);

    let text = `╭〔 🎁 𝐑𝐄𝐂𝐎𝐌𝐏𝐄𝐍𝐒𝐀 𝐃𝐈𝐀𝐑𝐈𝐀 〕⬣\n`;
    text += `┃ 🔥 𝐑𝐀𝐂𝐇𝐀: *${user.streak} Días*\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ 👋 Hola *@${participantJid.split("@")[0]}*\n`;
    text += `┃ 🎉 Base: ₡${formatter(baseReward)}\n`;
    text += `┃ ✨ Bono de Racha: +₡${formatter(streakBonus)}\n`;
    text += `┃ 💰 Total Ganado: *₡${formatter(totalReward)}*\n`;
    text += `┃ 💵 Saldo actual: ₡${formatter(user.coins)}\n\n`;
    text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text, mentions: [participantJid] },
      { quoted: message },
    );
  },
};
