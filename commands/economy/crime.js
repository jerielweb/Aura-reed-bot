import { economyTexts } from '../../models/economyTexts.js';
import { getGroupUser } from '../../models/groupDb.js';

export default {
    name: ['crime', 'crimen'],
    category: 'economy',
    description: 'Comete un crimen para ganar monedas, pero cuidado con la policía.',
    execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const user = getGroupUser(db, remoteJid, jidRemitente, { coins: 0, bank: 0, lastCrime: 0 });
        const now = Date.now();
        const cooldown = 60 * 60 * 1000; // 1 hora

        if (user.lastCrime && now - user.lastCrime < cooldown) {
            const timeLeft = cooldown - (now - user.lastCrime);
            const minutes = Math.floor(timeLeft / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            return await socket.sendMessage(remoteJid, {
                text: `🚓 La policía te está buscando. Escóndete por *${minutes}m ${seconds}s* antes de intentar otro crimen.`
            }, { quoted: message });
        }

        const success = Math.random() > 0.4; // 60% probabilidad de éxito
        user.lastCrime = now;

        if (success) {
            const phrases = economyTexts.crime.success;
            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            const reward = Math.floor(Math.random() * 8000) + 2000; // 200 a 1000
            user.coins = (user.coins || 0) + reward;

            let text = `╭〔 🥷 𝐂𝐑𝐈𝐌𝐄𝐍 𝐄𝐗𝐈𝐓𝐎𝐒𝐎 〕⬣\n`;
            text += `┃ 💰 𝐁𝐎𝐓𝐈́𝐍 𝐂𝐎𝐍𝐒𝐄𝐆𝐔𝐈𝐃𝐎\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ 👋 *${message.pushName || 'Usuario'}*\n`;
            text += `┃ ${randomPhrase} *₡${reward}* \n`;
            text += `┃ 💵 𝐒𝐚𝐥𝐝𝐨 𝐚𝐜𝐭𝐮𝐚𝐥: ₡${user.coins} \n\n`;
            text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

            saveDB(db);
            return await socket.sendMessage(remoteJid, { text, mentions: [jidRemitente] }, { quoted: message });
        } else {
            const phrases = economyTexts.crime.fail;
            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            const penalty = Math.floor(Math.random() * 3000) + 1000; // 100 a 400
            user.coins = Math.max(0, (user.coins || 0) - penalty);

            let text = `╭〔 🚓 𝐀𝐑𝐑𝐄𝐒𝐓𝐀𝐃𝐎 〕⬣\n`;
            text += `┃ ⚖️ 𝐂𝐑𝐈𝐌𝐄𝐍 𝐅𝐀𝐋𝐋𝐈𝐃𝐎\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ 👋 *${message.pushName || 'Usuario'}*\n`;
            text += `┃ ${randomPhrase} *₡${penalty}* \n`;
            text += `┃ 💵 𝐒𝐚𝐥𝐝𝐨 𝐚𝐜𝐭𝐮𝐚𝐥: ₡${user.coins} \n\n`;
            text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

            saveDB(db);
            return await socket.sendMessage(remoteJid, { text, mentions: [jidRemitente] }, { quoted: message });
        }
    }
};
