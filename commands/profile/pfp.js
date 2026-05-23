import { resolveTargetJid, getProfilePictureUrl } from '../../models/profileUtils.js';

export default {
    name: ['pfp', 'foto', 'fotoperfil'],
    category: 'profile',
    description: 'Muestra la foto de perfil de WhatsApp.',
    execute: async (socket, message, args, { jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const targetJid = await resolveTargetJid(message, socket, remoteJid, jidRemitente);
        const ppUrl = await getProfilePictureUrl(socket, targetJid);

        const name = targetJid.split('@')[0];
        await socket.sendMessage(remoteJid, {
            image: { url: ppUrl },
            caption: `╭〔 📸 𝐏𝐄𝐑𝐅𝐈𝐋 〕⬣\n┃ Foto de @${name}\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`,
            mentions: [targetJid]
        }, { quoted: message });
    }
};
