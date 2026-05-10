export default {
    name: ['delwarn', 'unwarn'],
    category: 'group',
    description: 'Eliminar la advertencia de un integrante.',
    adminOnly: true,
    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        let userToUnwarn = message.message?.extendedTextMessage?.contextInfo?.participant || message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!userToUnwarn) return socket.sendMessage(remoteJid, { text: '⚠️ Etiqueta o responde al mensaje de alguien para quitarle una advertencia.' }, { quoted: message });

        if (!db.groups[remoteJid]?.warns?.[userToUnwarn] || db.groups[remoteJid].warns[userToUnwarn].length === 0) {
            return socket.sendMessage(remoteJid, { text: '⚠️ Este usuario no tiene advertencias.', mentions: [userToUnwarn] }, { quoted: message });
        }

        db.groups[remoteJid].warns[userToUnwarn].pop();
        saveDB(db);

        const limit = db.groups[remoteJid].warnLimit || 3;
        const count = db.groups[remoteJid].warns[userToUnwarn].length;

        await socket.sendMessage(remoteJid, { text: `✅ Se le ha quitado una advertencia a @${userToUnwarn.split('@')[0]}.\nAdvertencias actuales: ${count}/${limit}`, mentions: [userToUnwarn] }, { quoted: message });
    }
};
