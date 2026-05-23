import { economyTexts } from '../../models/economyTexts.js';
import { getGroupUser } from '../../models/groupDb.js';

export default {
    name: ['work', 'trabajar', 'w'],
    category: 'economy',
    description: 'Trabaja para ganar algunas monedas.',
    execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const user = getGroupUser(db, remoteJid, jidRemitente, { coins: 0, bank: 0, lastWork: 0, lastDaily: 0 });
        const now = Date.now();
        const cooldown = 10 * 60 * 1000; // 1 minutos

        if (user.lastWork && now - user.lastWork < cooldown) {
            const timeLeft = cooldown - (now - user.lastWork);
            const minutes = Math.floor(timeLeft / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            return await socket.sendMessage(remoteJid, {
                text: `⏳ Estás cansado. Descansa *${minutes}m ${seconds}s* antes de volver a trabajar.`
            }, { quoted: message });
        }

        const works = economyTexts.work;
        const randomWork = works[Math.floor(Math.random() * works.length)];
        const reward = Math.floor(Math.random() * 2000) + 5000; // Entre 50 y 250

        user.coins = (user.coins || 0) + reward;
        user.lastWork = now;
        saveDB(db);

        let text = `╭〔 💼 𝐓𝐑𝐀𝐁𝐀𝐉𝐎 〕⬣\n`;
        text += `┃ 👷 𝐉𝐎𝐑𝐍𝐀𝐃𝐀 𝐋𝐀𝐁𝐎𝐑𝐀𝐋\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ 👋 *${message.pushName || 'Usuario'}*\n`;
        text += `┃ 🛠️ ${randomWork} *₡${reward}*\n`;
        text += `┃ 💵 𝐒𝐚𝐥𝐝𝐨 𝐚𝐜𝐭𝐮𝐚𝐥: ₡${user.coins}\n\n`;
        text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

        await socket.sendMessage(remoteJid, { text, mentions: [jidRemitente] }, { quoted: message });
    }
};
