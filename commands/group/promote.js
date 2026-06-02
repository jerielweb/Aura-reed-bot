import { warningMessage, errorMessage } from '../../models/messageTemplates.js';
import { fytBold } from './../../models/TextStyle.js';

export default {
    name: ['promote', 'ascender', 'haceradmin'],
    category: 'group',
    description: 'Dar admin',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {

            // Mensaje de éxito Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('ACCION INCONPATIBLE')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Este comando solo funciona en grupos.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

            return socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        let userToPromote = message.message?.extendedTextMessage?.contextInfo?.participant || message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!userToPromote) {
            return socket.sendMessage(remoteJid, { text: warningMessage('FALTA USUARIO', 'Etiqueta o responde al mensaje de alguien para darle admin.') }, { quoted: message });
        }

        try {
            await socket.groupParticipantsUpdate(remoteJid, [userToPromote], "promote");

            // Mensaje de éxito Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔  ${fytBold('ADMIN SYSTEM')} 〕⬣\n`
            text += `┃ > El usuario @${userToPromote.split('@')[0]}\n`;
            text += `┃ > ahora es administrador del grupo\n\n`;
            text += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;

            await socket.sendMessage(remoteJid, { text, mentions: [userToPromote] }, { quoted: message });
        } catch (e) {

            // Mensaje de éxito Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ❌ ${fytBold('ADMIN SYSTEM')} 〕⬣\n`
            text += `┃ ${fytBold('ERROR AL DAR ADMIN')}\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > No pude darle admin a @${userToPromote.split('@')[0]}\n`;
            text += `┃ > Asegúrate de que el usuario mencionado\n`;
            text += `┃ > no es ya admin y que soy admin.\n\n`;
            text += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;

            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }
    }
};
