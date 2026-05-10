export default {
    name: ['topactivos', 'activos'],
    category: 'group',
    description: 'Ver usuarios más activos en el grupo.',
    execute: async (socket, message, args, { db }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        const groupMetadata = await socket.groupMetadata(remoteJid);
        const participants = groupMetadata.participants;
        const currentParticipantIds = participants.map(p => p.id);
        
        const activity = db.groups?.[remoteJid]?.activity || {};
        
        // Filter out users not in group anymore, then sort by messages
        let users = Object.entries(activity)
            .filter(([id]) => currentParticipantIds.includes(id))
            .map(([id, count]) => ({ id, count }))
            .sort((a, b) => b.count - a.count);

        // Get top 10 most active
        const top = users.slice(0, 10);
        if (top.length === 0) {
            return socket.sendMessage(remoteJid, { text: 'Aún no hay suficiente actividad registrada en este grupo.' }, { quoted: message });
        }

        let text = `🔥 *TOP ACTIVOS DEL GRUPO* 🔥\n\n`;
        const mentions = [];
        top.forEach((u, i) => {
            text += `${i + 1}. @${u.id.split('@')[0]} - ${u.count} mensajes\n`;
            mentions.push(u.id);
        });

        await socket.sendMessage(remoteJid, { text, mentions }, { quoted: message });
    }
};
