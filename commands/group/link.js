export default {
    name: ['link', 'linkgroup', 'grupo'],
    category: 'group',
    description: 'Link del grupo.',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '╭〔 ⚠️ 𝐀𝐃𝐌𝐈𝐍 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣\n\n┃ ❌ 𝐀𝐂𝐂𝐈𝐎́𝐍 𝐃𝐄𝐍𝐄𝐆𝐀𝐃𝐀\n┃ > solo funciona en grupos\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣' }, { quoted: message });

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
