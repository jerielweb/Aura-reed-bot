import { warningMessage, errorMessage } from '../../models/messageTemplates.js';

export default {
    name: ['delwarn', 'unwarn'],
    category: 'group',
    description: 'Quitar advertencia.',
    adminOnly: true,
    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('ACCION INCONPATIBLE')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Este comando solo funciona en grupos.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

            return socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        let userToUnwarn = message.message?.extendedTextMessage?.contextInfo?.participant || message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!userToUnwarn) {

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('FALTA USUARIO')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Etiqueta o responde al mensaje de alguien\n`;
            text += `┃ > para quitarle una advertencia.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM INFO')} 〕⬣`;

            // Enviar mensaje de error
            return socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        if (!db.groups[remoteJid]?.warns?.[userToUnwarn] || db.groups[remoteJid].warns[userToUnwarn].length === 0) {

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('SIN ADVERTENCIAS')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > El usuario @${userToUnwarn.split('@')[0]}\n`;
            text += `┃ > no tiene advertencias para quitar.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM INFO')} 〕⬣`;

            // Enviar mensaje de error
            return socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        db.groups[remoteJid].warns[userToUnwarn].pop();
        saveDB(db);

        const limit = db.groups[remoteJid].warnLimit || 3;
        const count = db.groups[remoteJid].warns[userToUnwarn].length;

        // Plantilla del mensaje para que sea más atractivo visualmente
        let text = `╭〔 ✅ ${fytBold('AURA REED')} 〕⬣\n`;
        text += `┃ ${fytBold('ADVERTENCIA ELIMINADA')} \n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > Se le ha quitado una advertencia a @${userToUnwarn.split('@')[0]}\n`;
        text += `┃ > Warns restantes: [ ${count}/${limit} ]\n\n`;
        text += `╰〔 ⚡ ${fytBold('SYSTEM INFO')} 〕⬣`;

        // Enviar mensaje de éxito
        await socket.sendMessage(remoteJid, { text, mentions: [userToUnwarn] }, { quoted: message });
    }
};
