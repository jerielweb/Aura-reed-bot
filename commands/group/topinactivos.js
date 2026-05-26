export default {
    name: ['topinactivos', 'fantasmas'],
    category: 'group',
    description: 'Ver inactivos.',
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

        const users = participantJids
            .map(id => ({ id, count: counts[id] || 0 }))
            .sort((a, b) => a.count - b.count || a.id.localeCompare(b.id));

        if (Object.keys(monthlyActivity).length === 0) {
            return socket.sendMessage(remoteJid, { text: 'Aún no hay suficiente actividad registrada en este mes.' }, { quoted: message });
        }

        let pageSize = 10;
        let page = 1;

        if (args.length === 1) {
            const arg = parseInt(args[0], 10);
            if (arg > 20) {
                pageSize = Math.min(Math.max(arg, 1), 50);
            } else if (arg > 0) {
                page = arg;
            }
        } else if (args.length >= 2) {
            pageSize = Math.min(Math.max(parseInt(args[0], 10) || 10, 1), 50);
            page = Math.max(parseInt(args[1], 10) || 1, 1);
        }

        const totalPages = Math.max(Math.ceil(users.length / pageSize), 1);
        const currentPage = Math.min(page, totalPages);
        const startIndex = (currentPage - 1) * pageSize;
        const pageUsers = users.slice(startIndex, startIndex + pageSize);

        let text = `╭〔 👻 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
        text += `┃ 📉 𝐅𝐀𝐍𝐓𝐀𝐒𝐌𝐀𝐒 𝐃𝐄𝐋 𝐆𝐑𝐔𝐏𝐎\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ ⚠️ 𝐔𝐬𝐮𝐚𝐫𝐢𝐨𝐬 𝐢𝐧𝐚𝐜𝐭𝐢𝐯𝐨𝐬\n`;
        text += `┃ ⚠️ 𝐪𝐮𝐞 𝐧𝐨 𝐩𝐚𝐫𝐭𝐢𝐜𝐢𝐩𝐚𝐧\n\n`;
        text += `┣━━━━━━━━━━━━⬣\n\n`;

        const mentions = [];
        pageUsers.forEach((u, i) => {
            text += `┃ ➪ @${u.id.split('@')[0]}\n`;
            mentions.push(u.id);
        });

        text += `\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

        await socket.sendMessage(remoteJid, { text, mentions }, { quoted: message });
    }
};
