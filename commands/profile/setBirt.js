import { getGroupUser } from '../../models/groupDb.js';
import { parseBirthday } from '../../models/profileUtils.js';
import { fytBold } from '../../models/TextStyle.js';

export default {
    name: ['setbirth', 'setbirt', 'cumple', 'cumpleaños'],
    category: 'profile',
    description: 'Define tu fecha de cumpleaños (DD/MM o DD/MM/AAAA).',
    execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const input = args.join(' ');

        if (!input) {
            return await socket.sendMessage(remoteJid, {
                text: ''
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
            text: `╭〔 🎂${fytBold('PERFIL')} 〕⬣\n┃ ✅ ${fytBold('CUMPLEAÑOS GUARDADO')}\n╰━━━━━━━━━━━━⬣\n\n┃ > Fecha: *${birthday}*\n\n╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`,
            mentions: [jidRemitente]
        }, { quoted: message });
    }
};
