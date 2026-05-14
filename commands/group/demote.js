export default {
    name: ['demote', 'descender', 'quitardadmin'],
    category: 'group',
    description: 'Quitar admin.',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        let userToDemote = message.message?.extendedTextMessage?.contextInfo?.participant || message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!userToDemote) return socket.sendMessage(remoteJid, { text: '⚠️ Etiqueta o responde al mensaje de alguien para quitarle el admin.' }, { quoted: message });

        try {
            await socket.groupParticipantsUpdate(remoteJid, [userToDemote], "demote");
            await socket.sendMessage(remoteJid, { text: `✅ @${userToDemote.split('@')[0]} ya no es administrador.`, mentions: [userToDemote] }, { quoted: message });
        } catch (e) {
            await socket.sendMessage(remoteJid, { text: '❌ Ocurrió un error. Asegúrate de que soy admin.' }, { quoted: message });
        }
    }
};
