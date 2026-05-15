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
            const text = `╭〔 👑 𝐀𝐃𝐌𝐈𝐍 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣\n\n┃ ✅ @${userToPromote.split('@')[0]}\n┃ > ahora es administrador del grupo\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;
            await socket.sendMessage(remoteJid, { text, mentions: [userToPromote] }, { quoted: message });
        } catch (e) {
            await socket.sendMessage(remoteJid, { text: '❌ Ocurrió un error. Asegúrate de que soy admin.' }, { quoted: message });
        }
    }
};
