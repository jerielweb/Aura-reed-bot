import { fytBold } from '../../models/TextStyle.js';

export default {
    name: ['setname', 'setbotname'],
    category: 'system',
    description: 'Cambia el nombre del bot en el menú.',
    execute: async (sock, m, args, { prefix, db, saveDB, isOwner, numeroReal }) => {
        const remoteJid = m.key.remoteJid;
        const botNumber = sock.user.id.split('@')[0].split(':')[0];
        const isSubBot = !!sock.isSubBot;

        let hasPermission = false;
        if (isSubBot) {
            hasPermission = (numeroReal === botNumber);
        } else {
            hasPermission = isOwner;
        }

        if (!hasPermission) {
            return await sock.sendMessage(remoteJid, { text: '⚠️ No tienes permisos para usar este comando.' }, { quoted: m });
        }

        const newName = args.join(' ');
        if (!newName) {
            return await sock.sendMessage(remoteJid, { text: `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n┃ ❌ ${fytBold('FALTA NOMBRE')}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor proporciona el nuevo nombre para el bot.` }, { quoted: m });
        }

        db.botName = newName;
        await saveDB(db);

        await sock.sendMessage(remoteJid, { text: `╭〔 ✅ ${fytBold('AURA REED')} 〕⬣\n┃ ⚡ ${fytBold('NOMBRE ACTUALIZADO')}\n╰━━━━━━━━━━━━⬣\n\n┃ > El nombre del bot ha sido cambiado a: *${newName}*` }, { quoted: m });
    }
};
