export default {
    name: ['welcome', 'bienvenida', 'setwelcome'],
    category: 'group',
    description: 'Activa o desactiva los mensajes de bienvenida.',
    adminOnly: true,
    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;

        if (!remoteJid.endsWith('@g.us')) {
            return await socket.sendMessage(remoteJid, { text: '╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐀𝐂𝐂𝐈𝐎́𝐍 𝐃𝐄𝐍𝐄𝐆𝐀𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo funciona en grupos.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣' }, { quoted: message });
        }

        if (!db.groups[remoteJid]) {
            db.groups[remoteJid] = { antilink: false, welcome: false, warnLimit: 3, warns: {}, activity: {}, botOn: true };
        }

        const status = args[0]?.toLowerCase();

        if (status === 'on' || status === '1' || status === 'true') {
            db.groups[remoteJid].welcome = true;
            saveDB(db);
            let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ 👋 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐁𝐈𝐄𝐍𝐕𝐄𝐍𝐈𝐃𝐀\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > La bienvenida ha sido\n`;
            text += `┃ > activada con éxito.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else if (status === 'off' || status === '0' || status === 'false') {
            db.groups[remoteJid].welcome = false;
            saveDB(db);
            let text = `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ 👋 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐁𝐈𝐄𝐍𝐕𝐄𝐍𝐈𝐃𝐀\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > La bienvenida ha sido\n`;
            text += `┃ > desactivada con éxito.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else {
            const currentStatus = db.groups[remoteJid]?.welcome ? '✅ Activado' : '❌ Desactivado';
            let text = `╭〔 👋 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ ⚙️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐁𝐈𝐄𝐍𝐕𝐄𝐍𝐈𝐃𝐀\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ℹ️ Estado actual: ${currentStatus}\n\n`;
            text += `┣━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ➪ .welcome on\n`;
            text += `┃ ✦ Activar bienvenida\n\n`;
            text += `┃ ➪ .welcome off\n`;
            text += `┃ ✦ Desactivar bienvenida\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }
    }
};
