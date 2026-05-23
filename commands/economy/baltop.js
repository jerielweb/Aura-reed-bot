import { getGroupUsers } from '../../models/groupDb.js';

export default {
    name: ['baltop', 'topbal', 'topcoins'],
    category: 'economy',
    description: 'Muestra quien tiene mas plata.',
    execute: async (socket, message, args, { db }) => {
        const remoteJid = message.key.remoteJid;
        const groupUsers = getGroupUsers(db, remoteJid);

        if (!groupUsers || Object.keys(groupUsers).length === 0) {
            return await socket.sendMessage(remoteJid, { text: '⚠️ No hay usuarios registrados aún en este grupo.' }, { quoted: message });
        }

        const requested = parseInt(args[0]) || 10;
        const topN = Math.min(Math.max(requested, 1), 20); // entre 1 y 20

        const usersArr = Object.entries(groupUsers).map(([jid, data]) => {
            const coins = data.coins || 0;
            const bank = data.bank || 0;
            const total = coins + bank;
            return { jid, coins, bank, total };
        });

        const top = usersArr
            .filter(u => (u.total || 0) > 0)
            .sort((a, b) => b.total - a.total)
            .slice(0, topN);

        if (top.length === 0) {
            return await socket.sendMessage(remoteJid, { text: '⚠️ No hay usuarios con saldo para mostrar.' }, { quoted: message });
        }

        const medals = ['🥇', '🥈', '🥉', '🎖️'];
        let text = `╭━━〔 💎 𝐁𝐀𝐋𝐀𝐍𝐂𝐄 𝐓𝐎𝐏 💎 〕━━⬣\n`;
        text += `┃ 🏆 𝐑𝐀𝐍𝐊𝐈𝐍𝐆 𝐃𝐄 𝐌𝐎𝐍𝐄𝐃𝐀𝐒\n`;
        text += `┃ 👑 𝐋𝐨𝐬 𝐦𝐚́𝐬 𝐫𝐢𝐜𝐨𝐬 𝐝𝐞 𝐞𝐬𝐭𝐞 𝐠𝐫𝐮𝐩𝐨\n`;
        text += `╰━━━━━━━━━━━━━━━━⬣\n\n`;

        const mentions = [];
        top.forEach((u, i) => {
            const contact = socket.store?.contacts?.get?.(u.jid) || socket.store?.contacts?.[u.jid] || {};
            const name = contact?.notify || contact?.name || contact?.formattedName || u.jid.split('@')[0];
            const medal = medals[i] || medals[medals.length - 1];

            text += `┃ ${medal} @${name}\n`;
            text += `┃ ₡ ${u.total.toLocaleString()} AuraCoins\n\n`;

            if (i < top.length - 1) {
                text += `┣━━━━━━━━━━━━━━━━⬣\n\n`;
            }

            mentions.push(u.jid);
        });

        text += `╰━━〔 ⚡ 𝐀𝐔𝐑𝐀 𝐄𝐂𝐎𝐍𝐎𝐌𝐘 ⚡ 〕━━⬣`;

        await socket.sendMessage(remoteJid, { text, mentions }, { quoted: message });
    }
};
