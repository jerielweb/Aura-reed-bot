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
            await socket.sendMessage(remoteJid, { text: '🔒 El grupo ha sido cerrado. Solo los administradores pueden enviar mensajes.' }, { quoted: message });
        } catch (e) {
            await socket.sendMessage(remoteJid, { text: '❌ Ocurrió un error. Asegúrate de que soy admin.' }, { quoted: message });
        }
    }
};
