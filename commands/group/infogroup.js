export default {
    name: ['infogroup', 'infogp', 'ig'],
    category: 'group',
    description: 'Muestra la información detallada del grupo.',
    execute: async (socket, message, args, { groupMetadata }) => {
        const remoteJid = message.key.remoteJid;

        if (!remoteJid.endsWith('@g.us')) {
            return await socket.sendMessage(remoteJid, { text: '╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐀𝐂𝐂𝐈𝐎́𝐍 𝐃𝐄𝐍𝐄𝐆𝐀𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo funciona en grupos.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣' }, { quoted: message });
        }

        try {
            const { subject, id, desc, participants, owner, creation } = groupMetadata;
            
            const groupAdmins = participants.filter(p => p.admin).map(p => p.id);
            const adminCount = groupAdmins.length;
            const memberCount = participants.length;
            const description = desc || 'Sin descripción.';
            const date = new Date(creation * 1000).toLocaleString('es-ES');

            let text = `╭〔 🏰 𝐆𝐑𝐎𝐔𝐏 𝐈𝐍𝐅𝐎 〕⬣\n`;
            text += `┃ 🛡️ 𝐃𝐄𝐓𝐀𝐋𝐋𝐄𝐒 𝐃𝐄𝐋 𝐆𝐑𝐔𝐏𝐎\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ 📛 𝐍𝐨𝐦𝐛𝐫𝐞 › ${subject}\n`;
            text += `┃ 🆔 𝐈𝐃 › ${id.split('@')[0]}\n`;
            text += `┃ 📅 𝐂𝐫𝐞𝐚𝐜𝐢𝐨́𝐧 › ${date}\n`;
            text += `┃ 👑 𝐂𝐫𝐞𝐚𝐝𝐨𝐫 › @${(owner || '').split('@')[0]}\n\n`;
            text += `┣━━━━〔 👥 𝐄𝐒𝐓𝐀𝐃𝐈𝐒𝐓𝐈𝐂𝐀𝐒 〕━⬣\n\n`;
            text += `┃ 👥 𝐌𝐢𝐞𝐦𝐛𝐫𝐨𝐬 › ${memberCount}\n`;
            text += `┃ 🛡️ 𝐀𝐝𝐦𝐢𝐧𝐬 › ${adminCount}\n\n`;
            text += `┣━━━━〔 📝 𝐃𝐄𝐒𝐂𝐑𝐈𝐏𝐂𝐈𝐎́𝐍 〕━⬣\n\n`;
            text += `┃ ${description}\n\n`;
            text += `┣━━━━〔 🛡️ 𝐀𝐃𝐌𝐈𝐍𝐈𝐒𝐓𝐑𝐀𝐃𝐎𝐑𝐄𝐒 〕━⬣\n\n`;
            
            text += groupAdmins.map(admin => `┃ ➪ @${admin.split('@')[0]}`).join('\n');
            text += `\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

            // Obtener foto de perfil del grupo
            let ppUrl;
            try {
                ppUrl = await socket.profilePictureUrl(remoteJid, 'image');
            } catch {
                ppUrl = 'https://i.ibb.co/RBx5SQC/avatar-group-aura.png'; // Fallback
            }

            await socket.sendMessage(remoteJid, { 
                image: { url: ppUrl }, 
                caption: text,
                mentions: [owner, ...groupAdmins].filter(Boolean)
            }, { quoted: message });

        } catch (error) {
            console.error('Error en infogroup:', error);
            await socket.sendMessage(remoteJid, { text: '❌ Ocurrió un error al obtener la información del grupo.' }, { quoted: message });
        }
    }
};
