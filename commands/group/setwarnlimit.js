export default {
    name: ['setwarnlimit', 'warnlimit'],
    category: 'group',
    description: 'Definir advertencias máximas.',
    adminOnly: true,
    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        const limit = parseInt(args[0]);
        if (isNaN(limit) || limit < 1) {
            let text = `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ ❌ 𝐔𝐒𝐎 𝐈𝐍𝐂𝐎𝐑𝐑𝐄𝐂𝐓𝐎\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Debes proporcionar un\n`;
            text += `┃ > número válido mayor a 0.\n\n`;
            text += `┣━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ➪ Ejemplo: .setwarnlimit 5\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            return socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        if (!db.groups[remoteJid]) db.groups[remoteJid] = { antilink: false, warnLimit: 3, warns: {}, activity: {}, botOn: true };
        db.groups[remoteJid].warnLimit = limit;
        saveDB(db);

        let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
        text += `┃ 🛡️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > Límite de advertencias\n`;
        text += `┃ > actualizado a: ${limit}\n\n`;
        text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

        await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
};
