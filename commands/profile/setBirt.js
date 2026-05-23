import { getGroupUser } from '../../models/groupDb.js';
import { parseBirthday } from '../../models/profileUtils.js';

export default {
    name: ['setbirth', 'setbirt', 'cumple', 'cumpleaños'],
    category: 'profile',
    description: 'Define tu fecha de cumpleaños (DD/MM o DD/MM/AAAA).',
    execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const input = args.join(' ');

        if (!input) {
            return await socket.sendMessage(remoteJid, {
                text: '⚠️ Uso: *.setbirth DD/MM* o *.setbirth DD/MM/AAAA*\nEjemplo: *.setbirth 15/08/2002*'
            }, { quoted: message });
        }

        const birthday = parseBirthday(input);
        if (!birthday) {
            return await socket.sendMessage(remoteJid, {
                text: '❌ Fecha inválida. Usa el formato *DD/MM* o *DD/MM/AAAA*.'
            }, { quoted: message });
        }

        const user = getGroupUser(db, remoteJid, jidRemitente, {});
        user.birthday = birthday;
        saveDB(db);

        await socket.sendMessage(remoteJid, {
            text: `╭〔 🎂 𝐏𝐄𝐑𝐅𝐈𝐋 〕⬣\n┃ ✅ 𝐂𝐮𝐦𝐏𝐋𝐄𝐀𝐍̃𝐎𝐒 𝐆𝐔𝐀𝐑𝐃𝐀𝐃𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ > Fecha: *${birthday}*\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`,
            mentions: [jidRemitente]
        }, { quoted: message });
    }
};
