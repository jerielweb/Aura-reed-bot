import { warningMessage, errorMessage } from '../../models/messageTemplates.js';

export default {
    name: ['delwarn', 'unwarn'],
    category: 'group',
    description: 'Quitar advertencia.',
    adminOnly: true,
    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            return socket.sendMessage(remoteJid, { text: errorMessage('COMANDO INVÁLIDO', 'Este comando solo funciona en grupos.') }, { quoted: message });
        }

        let userToUnwarn = message.message?.extendedTextMessage?.contextInfo?.participant || message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!userToUnwarn) {
            return socket.sendMessage(remoteJid, { text: warningMessage('FALTA USUARIO', 'Etiqueta o responde al mensaje de alguien para quitarle una advertencia.') }, { quoted: message });
        }

        if (!db.groups[remoteJid]?.warns?.[userToUnwarn] || db.groups[remoteJid].warns[userToUnwarn].length === 0) {
            return socket.sendMessage(remoteJid, { text: warningMessage('SIN ADVERTENCIAS', 'Este usuario no tiene advertencias.'), mentions: [userToUnwarn] }, { quoted: message });
        }

        db.groups[remoteJid].warns[userToUnwarn].pop();
        saveDB(db);

        const limit = db.groups[remoteJid].warnLimit || 3;
        const count = db.groups[remoteJid].warns[userToUnwarn].length;

        await socket.sendMessage(remoteJid, { 
            text: `╭〔 👑 𝐀𝐃𝐌𝐈𝐍 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣\n\n┃ ✅ @${userToUnwarn.split('@')[0]}\n┃ > se le quito una advertencia\n┃ > Warns: [ ${count}/${limit} ]\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`,
            mentions: [userToUnwarn] 
        }, { quoted: message });
    }
};
