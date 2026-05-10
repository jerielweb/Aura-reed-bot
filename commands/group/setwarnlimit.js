export default {
    name: ['setwarnlimit', 'warnlimit'],
    category: 'group',
    description: 'Definir advertencias máximas.',
    adminOnly: true,
    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        const limit = parseInt(args[0]);
        if (isNaN(limit) || limit < 1) return socket.sendMessage(remoteJid, { text: '⚠️ Debes proporcionar un número válido mayor a 0.' }, { quoted: message });

        if (!db.groups[remoteJid]) db.groups[remoteJid] = { antilink: false, warnLimit: 3, warns: {}, activity: {} };
        db.groups[remoteJid].warnLimit = limit;
        saveDB(db);

        await socket.sendMessage(remoteJid, { text: `✅ Límite de advertencias actualizado a *${limit}*.` }, { quoted: message });
    }
};
