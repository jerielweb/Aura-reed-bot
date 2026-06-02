export default {
    name: ['antilink', 'antienlace', 'antigp'],
    category: 'group',
    description: 'Bloquea enlaces de otros grupos',
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
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '╭〔 ⚠️ 𝐀𝐃𝐌𝐈𝐍 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣\n\n┃ ❌ 𝐀𝐂𝐂𝐈𝐎́𝐍 𝐃𝐄𝐍𝐄𝐆𝐀𝐃𝐀\n┃ > solo funciona en grupos\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣' }, { quoted: message });

        if (!db.groups[remoteJid]) db.groups[remoteJid] = { antilink: false, warnLimit: 3, warns: {}, activity: {}, botOn: true };

        const status = args[0]?.toLowerCase();
        if (status === 'on' || status === '1' || status === 'true' || status === 'activar' || status === 'enable') {
            db.groups[remoteJid].antilink = true;
            saveDB(db);
            let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ 🛡️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈𝐋𝐈𝐍𝐊\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > El sistema Antilink ha\n`;
            text += `┃ > sido activado con éxito.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else if (status === 'off' || status === '0' || status === 'false' || status === 'desactivar' || status === 'disable') {
            db.groups[remoteJid].antilink = false;
            saveDB(db);
            let text = `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ 🛡️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈𝐋𝐈𝐍𝐊\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > El sistema Antilink ha\n`;
            text += `┃ > sido desactivado con éxito.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else {
            const currentStatus = db.groups[remoteJid]?.antilink ? '✅ Activado' : '❌ Desactivado';
            let text = `╭〔 🛡️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ ⚙️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈𝐋𝐈𝐍𝐊\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ℹ️ Estado actual: ${currentStatus}\n\n`;
            text += `┣━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ➪ .antilink on\n`;
            text += `┃ ✦ Activar sistema antilink\n\n`;
            text += `┃ ➪ .antilink off\n`;
            text += `┃ ✦ Desactivar sistema antilink\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }
    }
};
