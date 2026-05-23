import { getGroupUser } from '../../models/groupDb.js';

export default {
    name: ['withdraw', 'retirar', 'with'],
    category: 'economy',
    description: 'Retira monedas de tu cuenta de banco.',
    execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const user = getGroupUser(db, remoteJid, jidRemitente, { coins: 0, bank: 0 });
        let amount = args[0];

        if (!amount) {
            return await socket.sendMessage(remoteJid, { text: '⚠️ Ingresa la cantidad a retirar.\nEjemplo: *.with 100* o *.with all*' }, { quoted: message });
        }

        if (amount.toLowerCase() === 'all' || amount.toLowerCase() === 'todo') {
            amount = user.bank || 0;
        } else {
            amount = parseInt(amount);
        }

        if (isNaN(amount) || amount <= 0) {
            return await socket.sendMessage(remoteJid, { text: '⚠️ Cantidad inválida.' }, { quoted: message });
        }

        if ((user.bank || 0) < amount) {
            return await socket.sendMessage(remoteJid, { text: `❌ No tienes suficientes fondos en el banco. Tienes *₡${user.bank || 0}*` }, { quoted: message });
        }

        user.bank -= amount;
        user.coins = (user.coins || 0) + amount;
        saveDB(db);

        let text = `╭〔 🏦 𝐁𝐀𝐍𝐂𝐎 〕⬣\n`;
        text += `┃ 📤 𝐑𝐄𝐓𝐈𝐑𝐎 𝐄𝐗𝐈𝐓𝐎𝐒𝐎\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ 👋 *${message.pushName || 'Usuario'}*\n`;
        text += `┃ 📤 𝐑𝐞𝐭𝐢𝐫𝐚𝐬𝐭𝐞: ₡${amount.toLocaleString()}\n`;
        text += `┃ 💵 𝐍𝐮𝐞𝐯𝐨 𝐒𝐚𝐥𝐝𝐨 𝐂𝐚𝐫𝐭𝐞𝐫𝐚: ₡${user.coins.toLocaleString()}\n`;
        text += `┃ 🏦 𝐅𝐨𝐧𝐝𝐨𝐬 𝐫𝐞𝐬𝐭𝐚𝐧𝐭𝐞𝐬: ₡${user.bank.toLocaleString()}\n\n`;
        text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

        await socket.sendMessage(remoteJid, { text, mentions: [jidRemitente] }, { quoted: message });
    }
};
