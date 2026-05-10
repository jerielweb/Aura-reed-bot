export default {
    name: 'warn',
    category: 'group',
    description: 'Dar y registrar una Advertencia con fecha y hora.',
    adminOnly: true,
    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        let userToWarn = message.message?.extendedTextMessage?.contextInfo?.participant || message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!userToWarn) return socket.sendMessage(remoteJid, { text: '⚠️ Etiqueta o responde al mensaje de alguien para advertirlo.' }, { quoted: message });

        const reason = args.join(' ') || 'Sin motivo';
        const date = new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });

        if (!db.groups[remoteJid]) db.groups[remoteJid] = { antilink: false, warnLimit: 3, warns: {}, activity: {} };
        if (!db.groups[remoteJid].warns) db.groups[remoteJid].warns = {};
        if (!db.groups[remoteJid].warns[userToWarn]) db.groups[remoteJid].warns[userToWarn] = [];

        db.groups[remoteJid].warns[userToWarn].push({ reason, date });
        saveDB(db);

        const limit = db.groups[remoteJid].warnLimit || 3;
        const count = db.groups[remoteJid].warns[userToWarn].length;

        if (count >= limit) {
            await socket.sendMessage(remoteJid, { text: `🚨 @${userToWarn.split('@')[0]} ha alcanzado el límite de advertencias (${limit}). Será expulsado.`, mentions: [userToWarn] });
            await socket.groupParticipantsUpdate(remoteJid, [userToWarn], "remove");
            db.groups[remoteJid].warns[userToWarn] = []; // Reset after kick
            saveDB(db);
        } else {
            await socket.sendMessage(remoteJid, { text: `⚠️ *ADVERTENCIA* ⚠️\n\nUsuario: @${userToWarn.split('@')[0]}\nMotivo: ${reason}\nFecha: ${date}\nAdvertencias: ${count}/${limit}`, mentions: [userToWarn] }, { quoted: message });
        }
    }
};
