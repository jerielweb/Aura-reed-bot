import { Rstr } from '../../controllers/textBots.js';

export default {
    name: ['onlyadmin', 'soloadmin', 'adminonly'],
    category: 'group',
    description: 'Solo admins usan el Bot.',
    adminOnly: true,
    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return;

        if (!db.groups[remoteJid]) {
            db.groups[remoteJid] = { antilink: false, warnLimit: 3, warns: {}, activity: {}, onlyAdmin: false, botOn: true };
        }

        const status = args[0]?.toLowerCase();

        if (status === 'on' || status === '1' || status === 'true' || status === 'activar' || status === 'enable') {
            db.groups[remoteJid].onlyAdmin = true;
            saveDB(db);
            let text = `╭〔 🛡️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ ✅ 𝐀𝐂𝐂𝐈𝐎́𝐍 𝐄𝐌𝐏𝐋𝐄𝐌𝐄𝐍𝐓𝐀𝐃𝐀\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Modo Solo Admins\n`;
            text += `┃ > activado con éxito.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else if (status === 'off' || status === '0' || status === 'false' || status === 'desactivar' || status === 'disable') {
            db.groups[remoteJid].onlyAdmin = false;
            saveDB(db);
            let text = `╭〔 🛡️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ ❌ 𝐀𝐂𝐂𝐈𝐎́𝐍 𝐄𝐌𝐏𝐋𝐄𝐌𝐄𝐍𝐓𝐀𝐃𝐀\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Modo Solo Admins\n`;
            text += `┃ > desactivado con éxito.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else {
            const currentStatus = db.groups[remoteJid].onlyAdmin ? '✅ Activado' : '❌ Desactivado';
            let text = `╭〔 🛡️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ ⚙️ 𝐌𝐎𝐃𝐎 𝐒𝐎𝐋𝐎 𝐀𝐃𝐌𝐈𝐍𝐒\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ℹ️ Estado actual: ${currentStatus}\n\n`;
            text += `┣━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ➪ .onlyadmin on\n`;
            text += `┃ ✦ Activar modo admins\n\n`;
            text += `┃ ➪ .onlyadmin off\n`;
            text += `┃ ✦ Desactivar modo admins\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }
    }
};
