export default {
    name: ['open', 'abrir'],
    category: 'group',
    description: 'Abrir el grupo.',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        try {
            await socket.groupSettingUpdate(remoteJid, 'not_announcement');
            await socket.sendMessage(remoteJid, { text: '🔓 El grupo ha sido abierto. Ahora todos pueden enviar mensajes.' }, { quoted: message });
        } catch (e) {
            await socket.sendMessage(remoteJid, { text: '❌ Ocurrió un error. Asegúrate de que soy admin.' }, { quoted: message });
        }
    }
};
