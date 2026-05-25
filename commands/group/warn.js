export default {
    name: 'warn',
    category: 'group',
    description: 'Advertencias usuarios.',
    adminOnly: true,
    execute: async (socket, message, args, { db, saveDB, groupMetadata }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        let userToWarn = message.message?.extendedTextMessage?.contextInfo?.participant || message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!userToWarn) return socket.sendMessage(remoteJid, { text: '⚠️ Etiqueta o responde al mensaje de alguien para advertirlo.' }, { quoted: message });

        // Constante para saber si el usuario a advertir es admin
        const isUserAdmin = groupMetadata?.participants.some(p => p.id === userToWarn && (p.admin === 'admin' || p.admin === 'superadmin'));
        if (isUserAdmin) return socket.sendMessage(remoteJid, { text: '❌ No puedes advertir a un administrador del grupo.' }, { quoted: message });

        const reason = args.filter(arg => !arg.includes('@')).join(' ') || 'Sin motivo';
        const date = new Date().toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica' });

        if (!db.groups[remoteJid]) db.groups[remoteJid] = { antilink: false, warnLimit: 3, warns: {}, activity: {}, botOn: true };
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
            const adminUser = message.key.participant || message.key.remoteJid;
            await socket.sendMessage(remoteJid, { 
                text: `╭━━〔 ⚠️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐃𝐄 𝐖𝐀𝐑𝐍 ⚠️ 〕━━⬣\n\n┃ 👤 𝐔𝐬𝐮𝐚𝐫𝐢𝐨: @${userToWarn.split('@')[0]}\n┃ 🛡️ 𝐀𝐝𝐦𝐢𝐧: @${adminUser.split('@')[0]}\n\┃ 📌 𝐀𝐜𝐜𝐢𝐨́𝐧: 𝐀𝐝𝐯𝐞𝐫𝐭𝐞𝐧𝐜𝐢𝐚 𝐚𝐠𝐫𝐞𝐠𝐚𝐝𝐚\n┃ 📊 𝐖𝐚𝐫𝐧𝐬: [ ${count}/${limit} ]\n┃ 📝 𝐑𝐚𝐳𝐨́𝐧: ${reason}\n┃ ⏰ 𝐅𝐞𝐜𝐡𝐚: ${date}\n\n┣━━━━━━━━━━━━━━━━⬣\n┃ ⚠️ 𝐒𝐞 𝐡𝐚 𝐚𝐧̃𝐚𝐝𝐢𝐝𝐨 𝐮𝐧𝐚\n┃ ⚠️ 𝐚𝐝𝐯𝐞𝐫𝐭𝐞𝐧𝐜𝐢𝐚 𝐚𝐥 𝐮𝐬𝐮𝐚𝐫𝐢𝐨.\n┣━━━━━━━━━━━━━━━━⬣\n\n┃ ❗ 𝐀𝐥 𝐥𝐥𝐞𝐠𝐚𝐫 𝐚𝐥 𝐥𝐢́𝐦𝐢𝐭𝐞\n┃ ❗ 𝐬𝐞𝐫𝐚́ 𝐞𝐱𝐩𝐮𝐥𝐬𝐚𝐝𝐨.\n╰━━〔 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 𝐒𝐘𝐒𝐓𝐄𝐌 〕━━⬣`, 
                mentions: [userToWarn, adminUser] 
            }, { quoted: message });
        }
    }
};
