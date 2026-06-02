import { fytBold } from './../../models/TextStyle.js';

export default {
    name: ['tag', 'tg'],
    category: 'group',
    description: 'Mención invisible',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('ACCION INCONPATIBLE')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Este comando solo funciona en grupos.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

            // Enviar mensaje de error
            return socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        const groupMetadata = await socket.groupMetadata(remoteJid);
        const participants = groupMetadata.participants;
        const mentions = participants.map(p => p.id);

        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || '';

        const customMessage = args.join(' ') || quotedText;

        if (!customMessage) {

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('FALTA MENSAJE')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Debes escribir un mensaje o responder a\n`;
            text += `┃ > uno existente para poder etiquetar a todos.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM INFO')} 〕⬣`;

            // Enviar mensaje de error
            return socket.sendMessage(remoteJid, { text },{ quoted: message });
        }

        const text = `${customMessage}`;

        await socket.sendMessage(remoteJid, { text, mentions });
    }
};
