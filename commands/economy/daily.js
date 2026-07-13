import { getGroupUser } from "../../models/groupDb.js";

export default {
  name: ["daily", "diario"],
  category: "economy",
  description: "Reclama tu recompensa diaria.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const user = getGroupUser(db, remoteJid, jidRemitente, {
      coins: 0,
      bank: 0,
      lastWork: 0,
      lastDaily: 0,
    });
    const now = Date.now();
    const cooldown = 24 * 60 * 60 * 1000; // 24 horas

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

    const reward = Math.floor(Math.random() * 500) + 500; // Entre 500 y 1000
    user.coins = (user.coins || 0) + reward;
    user.lastDaily = now;
    saveDB(db);

    let text = `╭〔 🎁 𝐑𝐄𝐂𝐎𝐌𝐏𝐄𝐍𝐒𝐀 〕⬣\n`;
    text += `┃ 💰 𝐁𝐎𝐍𝐎 𝐃𝐈𝐀𝐑𝐈𝐎\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ 👋 𝐇𝐨𝐥𝐚 *${message.pushName || "Usuario"}*\n`;
    text += `┃ 🎉 𝐇𝐚𝐬 𝐫𝐞𝐜𝐢𝐛𝐢𝐝𝐨: ₡${reward}\n`;
    text += `┃ 💵 𝐒𝐚𝐥𝐝𝐨 𝐚𝐜𝐭𝐮𝐚𝐥: ₡${user.coins}\n\n`;
    text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text, mentions: [jidRemitente] },
      { quoted: message },
    );
  },
};
