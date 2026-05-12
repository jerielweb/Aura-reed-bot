export default {
    name: ['topinactivos', 'fantasmas'],
    category: 'group',
    description: 'Ver usuarios más inactivos en el grupo.',
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

        if (users.length === 0) {
            return socket.sendMessage(remoteJid, { text: 'No se encontraron participantes válidos en este grupo.' }, { quoted: message });
        }

        const pageSize = Math.min(Math.max(parseInt(args[0], 10) || 10, 1), 50);
        const page = Math.max(parseInt(args[1], 10) || 1, 1);
        const totalPages = Math.max(Math.ceil(users.length / pageSize), 1);
        const currentPage = Math.min(page, totalPages);
        const startIndex = (currentPage - 1) * pageSize;
        const pageUsers = users.slice(startIndex, startIndex + pageSize);

        const monthLabel = new Date().toLocaleString('es-ES', { month: 'long', year: 'numeric' });
        let text = `👻 *TOP INACTIVOS DEL MES (${monthLabel})* 👻\n`;
        text += `📄 Página ${currentPage}/${totalPages} • ${pageSize} por página\n\n`;

        const mentions = [];
        pageUsers.forEach((u, i) => {
            text += `${startIndex + i + 1}. @${u.id.split('@')[0]} - ${u.count} mensajes\n`;
            mentions.push(u.id);
        });

        text += `\nUsa: ${db.prefix}fantasmas [cantidad] [página]`;
        await socket.sendMessage(remoteJid, { text, mentions }, { quoted: message });
    }
};
