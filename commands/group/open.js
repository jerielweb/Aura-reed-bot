import { errorMessage } from '../../models/messageTemplates.js';

export default {
    name: ['open', 'abrir'],
    category: 'group',
    description: 'Abrir el grupo.',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            return socket.sendMessage(remoteJid, { text: errorMessage('COMANDO INVÁLIDO', 'Este comando solo funciona en grupos.') }, { quoted: message });
        }

        try {
            await socket.groupSettingUpdate(remoteJid, 'not_announcement');
            await socket.sendMessage(remoteJid, { 
                text: `╭〔 👑 𝐀𝐃𝐌𝐈𝐍 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣\n\n┃ ✅ 𝐆𝐑𝐔𝐏𝐎 𝐀𝐁𝐈𝐄𝐑𝐓𝐎\n┃ > ahora todos pueden mensajear\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`
            }, { quoted: message });
        } catch (e) {
            await socket.sendMessage(remoteJid, { text: errorMessage('ERROR DE ADMIN', 'Ocurrió un error. Asegúrate de que soy admin.') }, { quoted: message });
        }
    }
};
