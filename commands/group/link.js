export default {
    name: ['link', 'linkgroup', 'grupo'],
    category: 'group',
    description: 'Link del grupo.',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: 'Este comando solo funciona en grupos o comunidades.' }, { quoted: message });

        let code = null;

        try {
            code = await socket.groupInviteCode(remoteJid);
        } catch (error) {
            // Intentamos fallback para comunidades.
        }

        if (!code) {
            try {
                const metadata = await socket.groupMetadata(remoteJid);
                code = metadata?.inviteCode || metadata?.invite?.code || metadata?.inviteCodeV2 || metadata?.groupInviteCode;
            } catch (error) {
                // Ignorar y seguir al mensaje de error.
            }
        }

        if (code) {
            return await socket.sendMessage(remoteJid, { text: `Link del grupo/comunidad:\nhttps://chat.whatsapp.com/${code}` }, { quoted: message });
        }

        await socket.sendMessage(remoteJid, { text: 'No pude obtener el enlace. Asegurate de que soy administrador del grupo o comunidad.' }, { quoted: message });
    }
};
