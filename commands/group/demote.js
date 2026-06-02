import { warningMessage, errorMessage } from '../../models/messageTemplates.js';

export default {
    name: ['demote', 'descender', 'quitardadmin'],
    category: 'group',
    description: 'Quitar admin.',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            return socket.sendMessage(remoteJid, { text: errorMessage('COMANDO INVÁLIDO', 'Este comando solo funciona en grupos.') }, { quoted: message });
        }

        let userToDemote = message.message?.extendedTextMessage?.contextInfo?.participant || message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!userToDemote) {
            return socket.sendMessage(remoteJid, { text: warningMessage('FALTA USUARIO', 'Etiqueta o responde al mensaje de alguien para quitarle el admin.') }, { quoted: message });
        }

        try {
            await socket.groupParticipantsUpdate(remoteJid, [userToDemote], "demote");
            const text = `╭〔 👑 𝐀𝐃𝐌𝐈𝐍 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣\n\n┃ ✅ @${userToDemote.split('@')[0]}\n┃ > ya no es administrador del grupo\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;
            await socket.sendMessage(remoteJid, { text, mentions: [userToDemote] }, { quoted: message });
        } catch (e) {
            await socket.sendMessage(remoteJid, { text: '❌ Ocurrió un error. Asegúrate de que soy admin.' }, { quoted: message });
        }
    }
};
