export default {
    name: ['promote', 'ascender', 'haceradmin'],
    category: 'group',
    description: 'Dar admin',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        let userToPromote = message.message?.extendedTextMessage?.contextInfo?.participant || message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!userToPromote) return socket.sendMessage(remoteJid, { text: '⚠️ Etiqueta o responde al mensaje de alguien para darle admin.' }, { quoted: message });

        try {
            await socket.groupParticipantsUpdate(remoteJid, [userToPromote], "promote");
            await socket.sendMessage(remoteJid, { text: `✅ @${userToPromote.split('@')[0]} ahora es administrador.`, mentions: [userToPromote] }, { quoted: message });
        } catch (e) {
            await socket.sendMessage(remoteJid, { text: '❌ Ocurrió un error. Asegúrate de que soy admin.' }, { quoted: message });
        }
    }
};
