import { fytBold } from "../../models/TextStyle.js";

export default {
    name: ['kick', 'sacar', 'quitar', 'expulsar', 'limpiar'],
    category: 'group',
    description: 'Expulsa a un integrante o a varios por prefijo de país.',
    adminOnly: true,
    execute: async (socket, message, args, { groupMetadata, isOwner, prefix }) => {
        const remoteJid = message.key.remoteJid;

        if (!remoteJid.endsWith('@g.us')) {
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `${fytBold('ACCION INCONPATIBLE')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Este comando solo funciona en grupos.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

            return socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        let usersToKick = [];

        // 1. Caso: Por respuesta o mención
        if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            usersToKick.push(message.message.extendedTextMessage.contextInfo.participant);
        } else if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
            usersToKick = message.message.extendedTextMessage.contextInfo.mentionedJid;
        }
        else if (args[0]) {
            const prefix = args[0].replace('+', '').trim();
            if (!isNaN(prefix)) {
                const participants = groupMetadata.participants;
                usersToKick = participants
                    .map(p => p.id)
                    .filter(id => id.startsWith(prefix) && !id.includes(socket.user.id.split(':')[0]));
                const admins = participants.filter(p => p.admin).map(p => p.id);
                usersToKick = usersToKick.filter(id => !admins.includes(id));
            }
        }

        if (usersToKick.length === 0) {
            let text = `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n`
            text += `${fytBold('ACCIÓN INVÁLIDA')} \n`
            text += `╰━━━━━━━━━━━━⬣\n\n`
            text += `┃ > Menciona a alguien, responde\n`
            text += `┃ > a su mensaje o escribe un\n`
            text += `┃ > prefijo (ej: ${prefix}kick 234)\n\n`
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`

            return socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        try {
            await socket.groupParticipantsUpdate(remoteJid, usersToKick, "remove");

            let successText = `╭〔 👑 ${fytBold('ADMIN SYSTEM')} 〕⬣\n\n`;
            if (usersToKick.length === 1) {
                successText += `┃ ✅ @${usersToKick[0].split('@')[0]}\n┃ > fue expulsado del grupo\n`;
            } else {
                successText += `┃ ✅ ${fytBold('LIMPIEZA COMPLETADA')}\n┃ > Se expulsaron ${usersToKick.length} usuarios\n┃ > con el prefijo solicitado.\n`;
            }
            successText += `\n╰〔 ⚡ ${fytBold('SYSTEM INFO')} 〕⬣`;

            await socket.sendMessage(remoteJid, { text: successText, mentions: usersToKick.length <= 10 ? usersToKick : [] }, { quoted: message });
        } catch (e) {
            let text = `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `${fytBold('ERROR DE KICK')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > No pude expulsar a los usuarios.\n`;
            text += `┃ > Asegúrate de que soy admin.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }
    }
};