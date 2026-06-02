import { fytBold } from './../../models/TextStyle.js';

export default {
    name: ['demote', 'descender', 'quitardadmin'],
    category: 'group',
    description: 'Quitar admin.',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {

            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('ACCION INCONPATIBLE')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Este comando solo funciona en grupos.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

            return socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        let userToDemote = message.message?.extendedTextMessage?.contextInfo?.participant || message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!userToDemote) {

            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('FALTA USUARIO')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Etiqueta o responde al mensaje de\n`;
            text += `┃ > alguien para quitarle el admin.\n\n`;
            text += `┃ > _Ejemplo:_\n`;
            text += `┃ > *${prefix}demote @usuario*\n`;
            text += `┃ > *${prefix}demote* (respondiendo)\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

            return socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        try {
            await socket.groupParticipantsUpdate(remoteJid, [userToDemote], "demote");

            let text = `╭〔  ${fytBold('ADMIN SYSTEM')} 〕⬣\n\n`
            text += `┃ > El usuario @${userToDemote.split('@')[0]}\n`;
            text += `┃ > ya no es administrador del grupo\n\n`;
            text += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;

            await socket.sendMessage(remoteJid, { text, mentions: [userToDemote] }, { quoted: message });
        } catch (e) {

            let text = `╭〔 ❌ ${fytBold('ADMIN SYSTEM')} 〕⬣\n`
            text += `┃ ${fytBold('ERROR AL QUITAR ADMIN')}\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > No pude quitarle el admin a @${userToDemote.split('@')[0]}\n`;
            text += `┃ > Asegúrate de que el usuario mencionado\n`;
            text += `┃ > es un administrador y que soy admin.\n\n`;
            text += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;

            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }
    }
};
