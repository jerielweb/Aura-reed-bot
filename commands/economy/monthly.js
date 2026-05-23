import { getGroupUser } from '../../models/groupDb.js';

export default {
    name: ['monthly', 'mensual'],
    category: 'economy',
    description: 'Reclama tu recompensa mensual gigante.',
    execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const user = getGroupUser(db, remoteJid, jidRemitente, { coins: 0, bank: 0, lastMonthly: 0 });
        const now = Date.now();
        const cooldown = 30 * 24 * 60 * 60 * 1000; // 30 días

        if (user.lastMonthly && now - user.lastMonthly < cooldown) {
            const timeLeft = cooldown - (now - user.lastMonthly);
            const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
            const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            
            return await socket.sendMessage(remoteJid, { 
                text: `⏳ Ya reclamaste tu sueldo mensual.\nVuelve a intentarlo en *${days}d ${hours}h*.`
            }, { quoted: message });
        }

        const reward = Math.floor(Math.random() * 5000) + 10000; // Entre 10k y 15k
        user.coins = (user.coins || 0) + reward;
        user.lastMonthly = now;
        saveDB(db);

        let text = `╭〔 🎁 𝐑𝐄𝐂𝐎𝐌𝐏𝐄𝐍𝐒𝐀 〕⬣\n`;
        text += `┃ 💰 𝐒𝐔𝐄𝐋𝐃𝐎 𝐌𝐄𝐍𝐒𝐔𝐀𝐋\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ 👋 𝐇𝐨𝐥𝐚 *${message.pushName || 'Usuario'}*\n`;
        text += `┃ 🎉 𝐇𝐚𝐬 𝐫𝐞𝐜𝐢𝐛𝐢𝐝𝐨: ₡${reward.toLocaleString()}\n`;
        text += `┃ 💵 𝐒𝐚𝐥𝐝𝐨 𝐚𝐜𝐭𝐮𝐚𝐥: ₡${user.coins.toLocaleString()}\n\n`;
        text += `┃ ⏳ 𝐏𝐫𝐨́𝐱𝐢𝐦𝐚 𝐫𝐞𝐜𝐨𝐦𝐩𝐞𝐧𝐬𝐚: En *30 días*\n\n`;
        text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

        await socket.sendMessage(remoteJid, { text, mentions: [jidRemitente] }, { quoted: message });
    }
};
