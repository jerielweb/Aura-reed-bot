export default {
    name: ['owners', 'dueños', 'propietarios'],
    category: 'owner',
    description: 'Muestra la información de los propietarios del bot.',
    ownerOnly: true,

    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;

        let text = `╭〔 👑 𝐎𝐖𝐍𝐄𝐑𝐒 〕⬣\n\n`;
        
        text += `┃ 👤 𝐃𝐮𝐞𝐧̃𝐨 𝐩𝐫𝐢𝐧𝐜𝐢𝐩𝐚𝐥\n`;
        text += `┃ ➪ 𝐉𝐞𝐫𝐢𝐞𝐥 𝐁𝐞𝐜𝐤𝐟𝐨𝐫𝐝\n`;
        text += `┃ 📞 +506 8923 7369\n\n`;
        
        text += `┣━━━━━━━━━━━━⬣\n\n`;
        
        text += `┃ 🎨 𝐃𝐢𝐬𝐞𝐧̃𝐚𝐝𝐨𝐫 𝐝𝐞𝐥 𝐛𝐨𝐭\n`;
        text += `┃ ➪ 𝐄𝐌𝐀𝐍𝐔𝐄𝐋 𝐒𝐔𝐀𝐑𝐄𝐙\n`;
        text += `┃ 📞 +505 7783 9681\n\n`;
        
        text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

        await socket.sendMessage(remoteJid, { 
            text, 
            mentions: ['50689237369@s.whatsapp.net', '50577839681@s.whatsapp.net'] 
        }, { quoted: message });
    }
};
