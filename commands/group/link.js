export default {
    name: ['link', 'linkgroup', 'grouplink', 'grupo'],
    category: 'group',
    description: 'Extraer el link del grupo para compartir.',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        try {
            const code = await socket.groupInviteCode(remoteJid);
            await socket.sendMessage(remoteJid, { text: `🔗 *Enlace del grupo:*\nhttps://chat.whatsapp.com/${code}` }, { quoted: message });
        } catch (e) {
            await socket.sendMessage(remoteJid, { text: '❌ No pude obtener el enlace. Asegúrate de que soy administrador del grupo.' }, { quoted: message });
        }
    }
};
