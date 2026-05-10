export default {
    name: ['antilink', 'antienlace', 'antigp'],
    category: 'group',
    description: 'Activar o desactivar el sistema antilink en el grupo.',
    adminOnly: true,
    middleware: async (socket, message, { db, owners }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return;

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || "";
        
        let rawSender = message.key.fromMe ? socket.user.id : (message.key.participant || message.key.remoteJid);
        
        const linkRegex = /(chat\.whatsapp\.com\/|whatsapp\.com\/channel\/)/i;
        const allowedLinks = ['https://whatsapp.com/channel/', 'https://wa.me/'];
        const isGroupLink = linkRegex.test(text);
        const hasAllowedLink = allowedLinks.some(link => text.includes(link));

        if (db.groups[remoteJid]?.antilink && isGroupLink && !hasAllowedLink) {
            console.log(`[ANTILINK] Enlace detectado en el grupo: ${remoteJid}`);
            try {
                const groupMetadata = await socket.groupMetadata(remoteJid);
                const participants = groupMetadata.participants || [];
                const groupAdmins = participants.filter(p => p.admin === 'admin' || p.admin === 'superadmin').map(p => p.id);
                
                const getNormalizedJid = (jid) => jid ? (jid.includes(':') ? jid.split(':')[0] + jid.substring(jid.indexOf('@')) : jid) : "";
                
                const normalizedSender = getNormalizedJid(rawSender);
                const senderIsAdmin = groupAdmins.includes(normalizedSender);
                
                const normalizedBotJid = getNormalizedJid(socket.user.id);
                const botLid = socket.user.lid ? getNormalizedJid(socket.user.lid) : null;
                const botIsAdmin = groupAdmins.includes(normalizedBotJid) || (botLid && groupAdmins.includes(botLid));
                const isOwner = owners.includes(normalizedSender);

                if (senderIsAdmin || isOwner || message.key.fromMe) {
                    return;
                }

                if (botIsAdmin) {
                    const deleteKey = { remoteJid: remoteJid, fromMe: false, id: message.key.id, participant: message.key.participant };
                    await socket.sendMessage(remoteJid, { delete: deleteKey });
                    
                    const isChannelLink = /whatsapp\.com\/channel\//i.test(text);
                    const userName = message.pushName || 'Usuario';
                    await socket.sendMessage(remoteJid, { text: `🚫 Se ha eliminado a *${userName}* del grupo por \`Anti-Link\`. No permitimos enlaces de *${isChannelLink ? 'canales' : 'otros grupos'}*.`, mentions: [normalizedSender] });
                    await socket.groupParticipantsUpdate(remoteJid, [normalizedSender], "remove");
                }
            } catch (err) { console.error("Error en antilink:", err); }
        }
    },
    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        if (!db.groups[remoteJid]) db.groups[remoteJid] = { antilink: false, warnLimit: 3, warns: {}, activity: {} };

        const status = args[0]?.toLowerCase();
        if (status === 'on' || status === '1' || status === 'true') {
            db.groups[remoteJid].antilink = true;
            saveDB(db);
            await socket.sendMessage(remoteJid, { text: '✅ Sistema *Antilink* activado.\nCualquier enlace de grupo enviado será eliminado y el usuario será expulsado.' }, { quoted: message });
        } else if (status === 'off' || status === '0' || status === 'false') {
            db.groups[remoteJid].antilink = false;
            saveDB(db);
            await socket.sendMessage(remoteJid, { text: '❌ Sistema *Antilink* desactivado.' }, { quoted: message });
        } else {
            await socket.sendMessage(remoteJid, { text: `⚠️ Uso incorrecto. Usa:\n*.antilink on* - Para activar\n*.antilink off* - Para desactivar` }, { quoted: message });
        }
    }
};
