export default {
    name: ['topinactivos', 'fantasmas'],
    category: 'group',
    description: 'Ver usuarios más inactivos en el grupo.',
    adminOnly: true,
    execute: async (socket, message, args, { db }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        const groupMetadata = await socket.groupMetadata(remoteJid);
        const participants = groupMetadata.participants;
        
        const activity = db.groups?.[remoteJid]?.activity || {};
        
        // Find users with 0 or very few messages
        let users = participants.map(p => ({
            id: p.id,
            count: activity[p.id] || 0
        })).sort((a, b) => a.count - b.count);

        // Get top 10 least active
        const top = users.slice(0, 10);
        let text = `👻 *TOP INACTIVOS DEL GRUPO* 👻\n\n`;
        const mentions = [];
        top.forEach((u, i) => {
            text += `${i + 1}. @${u.id.split('@')[0]} - ${u.count} mensajes\n`;
            mentions.push(u.id);
        });

        await socket.sendMessage(remoteJid, { text, mentions }, { quoted: message });
    }
};
