import { getGroupUser } from '../../models/groupDb.js';

export default {
    name: ['bank', 'bal', 'coins'],
    category: 'economy',
    description: 'Muestra tu saldo actual de monedas.',
    execute: async (socket, message, args, { db, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const user = getGroupUser(db, remoteJid, jidRemitente, {
            coins: 0, bank: 0, lastWork: 0, lastDaily: 0, lastWeekly: 0, lastMonthly: 0
        });
        const coins = user.coins || 0;
        const bank = user.bank || 0;
        const total = coins + bank;

        let text = `╭〔 💰 𝐄𝐂𝐎𝐍𝐎𝐌𝐈́𝐀 〕⬣\n`;
        text += `┃ 🏦 𝐄𝐒𝐓𝐀𝐃𝐎 𝐃𝐄 𝐂𝐔𝐄𝐍𝐓𝐀\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ 👋 𝐇𝐨𝐥𝐚: *${message.pushName || 'Usuario'}*\n\n`;
        text += `┃ 💵 𝐂𝐚𝐫𝐭𝐞𝐫𝐚 › ${coins.toLocaleString()} 🪙\n`;
        text += `┃ 🏦 𝐁𝐚𝐧𝐜𝐨 › ${bank.toLocaleString()} 🪙\n`;
        text += `┃ 💎 𝐓𝐨𝐭𝐚𝐥 › ${total.toLocaleString()} 🪙\n\n`;
        text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

        await socket.sendMessage(remoteJid, {
            text, 
            mentions: [jidRemitente]
        }, { quoted: message });
    }
};
