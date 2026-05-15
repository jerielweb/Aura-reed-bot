export default {
    name: ['topactivos', 'activos'],
    category: 'group',
    description: 'Usuarios activos.',
    adminOnly: true,
    execute: async (socket, message, args, { db }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        const groupMetadata = await socket.groupMetadata(remoteJid);
        const participants = groupMetadata.participants || [];
        const participantBaseMap = new Map();
        const participantJids = [];

        participants.forEach(p => {
            const jid = p?.id;
            const base = jid?.split('@')[0]?.split(':')[0];
            if (base && jid) {
                participantBaseMap.set(base, jid);
                participantJids.push(jid);
            }
        });

        const activity = db.groups?.[remoteJid]?.activity || {};
        const monthKey = new Date().toISOString().slice(0, 7);
        const monthlyActivity = activity[monthKey] && typeof activity[monthKey] === 'object' ? activity[monthKey] : activity;

        const counts = {};
        Object.entries(monthlyActivity).forEach(([key, value]) => {
            const base = key?.split('@')[0]?.split(':')[0];
            if (!base) return;
            const resolved = participantBaseMap.get(base) || (key.endsWith('@s.whatsapp.net') ? `${base}@s.whatsapp.net` : null);
            if (!resolved || !participantBaseMap.has(base)) return;
            counts[resolved] = (counts[resolved] || 0) + Number(value || 0);
        });

        const users = Object.entries(counts)
            .map(([id, count]) => ({ id, count }))
            .sort((a, b) => b.count - a.count);

        if (users.length === 0) {
            return socket.sendMessage(remoteJid, { text: 'Aún no hay suficiente actividad registrada en este mes.' }, { quoted: message });
        }

        const pageSize = Math.min(Math.max(parseInt(args[0], 20) || 20, 1), 50);
        const page = Math.max(parseInt(args[1], 10) || 1, 1);
        const totalPages = Math.max(Math.ceil(users.length / pageSize), 1);
        const currentPage = Math.min(page, totalPages);
        const startIndex = (currentPage - 1) * pageSize;
        const pageUsers = users.slice(startIndex, startIndex + pageSize);

        let text = `╭〔 🔥 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
        text += `┃ 📈 𝐔𝐒𝐔𝐀𝐑𝐈𝐎𝐒 𝐀𝐂𝐓𝐈𝐕𝐎𝐒\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ ⚡ 𝐌𝐢𝐞𝐦𝐛𝐫𝐨𝐬 𝐦𝐚́𝐬\n`;
        text += `┃ ⚡ 𝐚𝐜𝐭𝐢𝐯𝐨𝐬 𝐝𝐞𝐥 𝐠𝐫𝐮𝐩𝐨\n\n`;
        text += `┣━━━━━━━━━━━━⬣\n\n`;

        const mentions = [];
        pageUsers.forEach((u, i) => {
            const rank = startIndex + i + 1;
            let emoji = '➪';
            if (rank === 1) emoji = '🥇';
            else if (rank === 2) emoji = '🥈';
            else if (rank === 3) emoji = '🥉';

            text += `┃ ${emoji} @${u.id.split('@')[0]}\n`;
            mentions.push(u.id);
        });

        text += `\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

        await socket.sendMessage(remoteJid, { text, mentions }, { quoted: message });
    }
};
