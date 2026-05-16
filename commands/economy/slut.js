import { economyTexts } from '../../models/economyTexts.js';

export default {
    name: ['slut', 'putear', 'prost'],
    category: 'economy',
    description: 'Vende tu cuerpo por dinero (con riesgo).',
    execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        
        if (!db.users[jidRemitente]) {
            db.users[jidRemitente] = { coins: 0, bank: 0, lastSlut: 0 };
        }

        const user = db.users[jidRemitente];
        const now = Date.now();
        const cooldown = 45 * 60 * 1000; // 45 minutos

        if (user.lastSlut && now - user.lastSlut < cooldown) {
            const timeLeft = cooldown - (now - user.lastSlut);
            const minutes = Math.floor(timeLeft / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);
            
            return await socket.sendMessage(remoteJid, {
                text: `⏳ Tu cuerpo necesita descanso. Vuelve a intentarlo en *${minutes}m ${seconds}s*.`
            }, { quoted: message });
        }

        const success = Math.random() > 0.5; // 50% probabilidad
        user.lastSlut = now;

        if (success) {
            const phrases = economyTexts.slut.success;
            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            const reward = Math.floor(Math.random() * 5000) + 1000; // 100 a 600
            user.coins = (user.coins || 0) + reward;

            let text = `╭〔 💃 𝐓𝐑𝐀𝐁𝐀𝐉𝐎 𝐍𝐎𝐂𝐓𝐔𝐑𝐍𝐎 〕⬣\n`;
            text += `┃ 💋 𝐄𝐗𝐈𝐓𝐎 𝐓𝐎𝐓𝐀𝐋\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ 👋 *${message.pushName || 'Usuario'}*\n`;
            text += `┃ ${randomPhrase} *₡${reward}*\n`;
            text += `┃ 💵 𝐒𝐚𝐥𝐝𝐨 𝐚𝐜𝐭𝐮𝐚𝐥: ₡${user.coins}\n\n`;
            text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

            saveDB(db);
            return await socket.sendMessage(remoteJid, { text, mentions: [jidRemitente] }, { quoted: message });
        } else {
            const phrases = economyTexts.slut.fail;
            const randomPhrase = phrases[Math.floor(Math.random() * phrases.length)];
            const penalty = Math.floor(Math.random() * 2000) + 500; // 50 a 250
            user.coins = Math.max(0, (user.coins || 0) - penalty);

            let text = `╭〔 💔 𝐌𝐀𝐋𝐀 𝐒𝐔𝐄𝐑𝐓𝐄 〕⬣\n`;
            text += `┃ 🤕 𝐍𝐎𝐂𝐇𝐄 𝐓𝐄𝐑𝐑𝐈𝐁𝐋𝐄\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ 👋 *${message.pushName || 'Usuario'}*\n`;
            text += `┃ ${randomPhrase} *₡${penalty}*\n`;
            text += `┃ 💵 𝐒𝐚𝐥𝐝𝐨 𝐚𝐜𝐭𝐮𝐚𝐥: ₡${user.coins}\n\n`;
            text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

            saveDB(db);
            return await socket.sendMessage(remoteJid, { text, mentions: [jidRemitente] }, { quoted: message });
        }
    }
};
