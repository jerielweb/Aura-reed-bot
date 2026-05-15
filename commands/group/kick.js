export default {
    name: ['kick', 'sacar', 'quitar'],
    category: 'group',
    description: 'Expulsa a un integrante o a varios por prefijo de país.',
    adminOnly: true,
    execute: async (socket, message, args, { groupMetadata, isOwner }) => {
        const remoteJid = message.key.remoteJid;

        if (!remoteJid.endsWith('@g.us')) {
            return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });
        }

        let usersToKick = [];

        // 1. Caso: Por respuesta o mención
        if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            usersToKick.push(message.message.extendedTextMessage.contextInfo.participant);
        } else if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
            usersToKick = message.message.extendedTextMessage.contextInfo.mentionedJid;
        } 
        // 2. Caso: Por prefijo de país (ej: .kick 234)
        else if (args[0]) {
            const prefix = args[0].replace('+', '').trim();
            if (!isNaN(prefix)) {
                const participants = groupMetadata.participants;
                usersToKick = participants
                    .map(p => p.id)
                    .filter(id => id.startsWith(prefix) && !id.includes(socket.user.id.split(':')[0]));
                
                // Evitar expulsar admins si el comando no es super-específico
                const admins = participants.filter(p => p.admin).map(p => p.id);
                usersToKick = usersToKick.filter(id => !admins.includes(id));
            }
        }

        if (usersToKick.length === 0) {
            return socket.sendMessage(remoteJid, {
                text: '╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐀𝐂𝐂𝐈𝐎́𝐍 𝐈𝐍𝐕𝐀́𝐋𝐈𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Menciona a alguien, responde\n┃ > a su mensaje o escribe un\n┃ > prefijo (ej: .kick 234)\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣'
            }, { quoted: message });
        }

        try {
            await socket.groupParticipantsUpdate(remoteJid, usersToKick, "remove");
            
            let successText = `╭〔 👑 𝐀𝐃𝐌𝐈𝐍 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣\n\n`;
            if (usersToKick.length === 1) {
                successText += `┃ ✅ @${usersToKick[0].split('@')[0]}\n┃ > fue expulsado del grupo\n`;
            } else {
                successText += `┃ ✅ 𝐋𝐈𝐌𝐏𝐈𝐄𝐙𝐀 𝐂𝐎𝐌𝐏𝐋𝐄𝐓𝐀\n┃ > Se expulsaron ${usersToKick.length} usuarios\n┃ > con el prefijo solicitado.\n`;
            }
            successText += `\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

            await socket.sendMessage(remoteJid, { text: successText, mentions: usersToKick.length <= 10 ? usersToKick : [] }, { quoted: message });
        } catch (e) {
            await socket.sendMessage(remoteJid, { 
                text: '╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐊𝐈𝐂𝐊\n╰━━━━━━━━━━━━⬣\n\n┃ > No pude expulsar a los usuarios.\n┃ > Asegúrate de que soy admin.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣' 
            }, { quoted: message });
        }
    }
};