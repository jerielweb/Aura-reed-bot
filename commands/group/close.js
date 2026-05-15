export default {
    name: ['close', 'cerrar'],
    category: 'group',
    description: 'Cerrar el grupo.',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        try {
            await socket.groupSettingUpdate(remoteJid, 'announcement');
            await socket.sendMessage(remoteJid, { 
                text: `╭〔 👑 𝐀𝐃𝐌𝐈𝐍 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣\n\n┃ ✅ 𝐆𝐑𝐔𝐏𝐎 𝐂𝐄𝐑𝐑𝐀𝐃𝐎\n┃ > solo administradores pueden mensajear\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`
            }, { quoted: message });
        } catch (e) {
            await socket.sendMessage(remoteJid, { text: '❌ Ocurrió un error. Asegúrate de que soy admin.' }, { quoted: message });
        }
    }
};
