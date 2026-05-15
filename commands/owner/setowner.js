export default {
    name: ['setowner', 'newowner', 'addowner'],
    category: 'owner',
    description: 'Añade un nuevo owner al bot.',
    ownerOnly: true,

    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;
        
        let userToAdd = message.message?.extendedTextMessage?.contextInfo?.participant || message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        
        if (!userToAdd && args[0]) {
            userToAdd = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
        }

        if (!userToAdd) {
            let text = `╭〔 👑 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ ⚠️ 𝐔𝐒𝐎 𝐈𝐍𝐂𝐎𝐑𝐑𝐄𝐂𝐓𝐎\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ➪ .setowner @usuario\n`;
            text += `┃ ✦ Menciona a alguien\n\n`;
            text += `┃ ➪ .setowner 50612345678\n`;
            text += `┃ ✦ Escribe el número\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            return await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        if (!db.owners) db.owners = [];
        
        if (db.owners.includes(userToAdd)) {
            let text = `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ 👑 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐎𝐖𝐍𝐄𝐑\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Este usuario ya es un\n`;
            text += `┃ > owner del bot.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            return await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        db.owners.push(userToAdd);
        saveDB(db);

        let text = `╭〔 👑 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
        text += `┃ ✅ 𝐍𝐔𝐄𝐕𝐎 𝐎𝐖𝐍𝐄𝐑\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > @${userToAdd.split('@')[0]} ha sido\n`;
        text += `┃ > ascendido a owner con éxito.\n\n`;
        text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

        await socket.sendMessage(remoteJid, { text, mentions: [userToAdd] }, { quoted: message });
    }
};
