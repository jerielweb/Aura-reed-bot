import { getGroupUser } from '../../models/groupDb.js';

export default {
    name: ['weekly', 'semanal'],
    category: 'economy',
    description: 'Reclama tu recompensa semanal.',
    execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const user = getGroupUser(db, remoteJid, jidRemitente, { coins: 0, bank: 0, lastWeekly: 0 });
        const now = Date.now();
        const cooldown = 7 * 24 * 60 * 60 * 1000; // 7 días

        if (user.lastWeekly && now - user.lastWeekly < cooldown) {
            const timeLeft = cooldown - (now - user.lastWeekly);
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            return await socket.sendMessage(remoteJid, { 
                text: `⏳ Ya reclamaste tu recompensa semanal.\nVuelve a intentarlo en *${days}d ${hours}h*.` 
            }, { quoted: message });
        }

        const reward = Math.floor(Math.random() * 2000) + 3000; // Entre 3000 y 5000
        user.coins = (user.coins || 0) + reward;
        user.lastWeekly = now;
        saveDB(db);

        let text = `╭〔 🎁 𝐑𝐄𝐂𝐎𝐌𝐏𝐄𝐍𝐒𝐀 〕⬣\n`;
        text += `┃ 💰 𝐁𝐎𝐍𝐎 𝐒𝐄𝐌𝐀𝐍𝐀𝐋\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ 👋 𝐇𝐨𝐥𝐚 *${message.pushName || 'Usuario'}*\n`;
        text += `┃ 🎉 𝐇𝐚𝐬 𝐫𝐞𝐜𝐢𝐛𝐢𝐝𝐨: ₡${reward.toLocaleString()}\n`;
        text += `┃ 💵 𝐒𝐚𝐥𝐝𝐨 𝐚𝐜𝐭𝐮𝐚𝐥: ₡${user.coins.toLocaleString()}\n\n`;
        text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

        await socket.sendMessage(remoteJid, { text, mentions: [jidRemitente] }, { quoted: message });
    }
};
