export default {
    name: ['antilink', 'antienlace', 'antigp'],
    category: 'group',
    description: 'Activar o desactivar el sistema antilink en el grupo.',
    adminOnly: true,
    middleware: async (socket, message, { db, owners, isAdmin, isBotAdmin, isOwner, groupMetadata }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return;

        // Verificar si antilink está activado para este grupo
        if (!db.groups[remoteJid]?.antilink) return;

        const text = message.message?.conversation || message.message?.extendedTextMessage?.text || message.message?.imageMessage?.caption || message.message?.videoMessage?.caption || "";
        if (!text) return;
        
        // Detectar enlaces de grupos de WhatsApp (NO canales)
        const groupLinkRegex = /chat\.whatsapp\.com\//i;
        const isGroupLink = groupLinkRegex.test(text);

        if (!isGroupLink) return;

        console.log(`[ANTILINK] Enlace de grupo detectado en: ${remoteJid}`);
        
        // El sender raw es necesario para eliminar al participante del grupo
        const rawSender = message.key.fromMe ? socket.user.id : (message.key.participant || message.key.remoteJid);

        // Si es admin, owner o el propio bot, ignorar
        if (isAdmin || isOwner || message.key.fromMe) {
            console.log(`[ANTILINK] Sender es admin/owner/bot, ignorando.`);
            return;
        }

        // El bot necesita ser admin para poder eliminar mensajes y usuarios
        if (!isBotAdmin) {
            console.log(`[ANTILINK] El bot no es admin, no puede actuar.`);
            return;
        }

        try {
            // 1. Eliminar el mensaje con el enlace
            const deleteKey = {
                remoteJid: remoteJid,
                fromMe: false,
                id: message.key.id,
                participant: message.key.participant
            };
            await socket.sendMessage(remoteJid, { delete: deleteKey });
            console.log(`[ANTILINK] Mensaje eliminado.`);

            // 2. Notificar al grupo
            const userName = message.pushName || 'Usuario';
            await socket.sendMessage(remoteJid, {
                text: `🚫 *Anti-Link Activado*\n\nSe ha eliminado a *${userName}* del grupo por enviar un enlace de otro grupo.\n\n⚠️ Los enlaces de grupos no están permitidos.`,
                quoted: message,
                mentions: [rawSender]
            });

            // 3. Expulsar al usuario (usar el JID raw del participante, tal como aparece en el grupo)
            await socket.groupParticipantsUpdate(remoteJid, [rawSender], "remove");
            console.log(`[ANTILINK] Usuario ${rawSender} expulsado.`);

        } catch (err) {
            console.error("[ANTILINK] Error ejecutando acción:", err);
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
