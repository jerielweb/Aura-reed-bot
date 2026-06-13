import StalTK from '@tobyg74/tiktok-api-dl';
import { fytBold } from '../../models/TextStyle.js';
import formater from './../../controllers/functions/formatNumbers.js'

export default {
    name: ['ttp', 'stalktt', 'tiktokstalk'],
    description: 'Inspecciona perfiles de TikTok',

    execute: async (socket, message, args, { jidRemitente, prefix }) => {
        const remoteJid = message.key.remoteJid;
        const input = args.join(' ').trim();

        if (!remoteJid) return;

        if (!input) {
            let text = `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ❌ ${fytBold('FALTA USUARIO')}\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Por favor ingrese un nombre\n`;
            text += `┃ > o enlace del usuario para\n`;
            text += `┃ > inspeccionar su perfil.\n\n`;
            text += `┃ > Ejemplo:\n`;
            text += `┃ > \`${prefix}stalk [usuario]\`\n`;
            text += `┃ > \`${prefix}stalk [enlace]\`\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

            return socket.sendMessage(remoteJid, { text }, { quoted: message });
        }
        await socket.sendMessage(remoteJid, { react: { text: '👤', key: message.key } });

        let username = input;

        if (input.includes('tiktok.com')) {
            const match = input.match(/\/@([\w.-]+)/);
            if (match && match[1]) {
                username = match[1];
            } else {
                await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
                return socket.sendMessage(remoteJid, { 
                    text: `❌ ${fytBold('ENLACE INVÁLIDO')}\n\nAsegúrate de que sea un link de perfil válido (ej: https://www.tiktok.com/@usuario)` 
                }, { quoted: message });
            }
        } else {
            username = input.replace('@', '');
        }

        try {
            const response = await StalTK.StalkUser(username);

            if (!response || response.status === false || !response.result) {
                await socket.sendPresenceUpdate('paused', remoteJid);
                return socket.sendMessage(remoteJid, { 
                    text: `❌ No se encontraron resultados para el usuario: *${username}*` 
                }, { quoted: message });
            }

            const data = response.result;

            let profileText = `╭━━〔 👤 ${fytBold('TIKTOK STALK')} 〕━━⬣\n\n`;
            profileText += `┃ 🏷️ ${fytBold('Nombre:')} ${data.user.nickname || 'No especificado'}\n`;
            profileText += `┃ 👤 ${fytBold('Usuario:')} @${data.user.username}\n`;
            profileText += `┃ 📝 ${fytBold('Bio:')} ${data.user.signature || 'Sin descripción'}\n`;
            profileText += `┃ 🔒 ${fytBold('Cuenta Privada:')} ${data.user.privateAccount ? 'Sí 🔒' : 'No 🔓'}\n`;
            profileText += `┃ ✅ ${fytBold('Verificado:')} ${data.user.verified ? 'Sí ☑️' : 'No'}\n`;
            profileText += `╰━━━━━━━━━━━━━━━━━━━⬣\n\n`;
            profileText += `┏━━〔 📊 ${fytBold('ESTADÍSTICAS')} 〕━━⬣\n`;
            profileText += `┃ 👥 ${fytBold('Seguidores:')} ${formater(data.stats.followerCount)}\n`;
            profileText += `┃ 🏃 ${fytBold('Seguidos:')} ${formater(data.stats.followingCount)}\n`;
            profileText += `┃ ❤️ ${fytBold('Total Likes:')} ${formater(data.stats.heartCount)}\n`;
            profileText += `┃ 🎬 ${fytBold('Videos subidos:')} ${formater(data.stats.videoCount)}\n`;
            profileText += `╰〔 ⚡ ${fytBold('AURA STALK')} 〕⬣`;


            await socket.sendMessage(remoteJid, { react: { text: '✔️', key: message.key } });
            return socket.sendMessage(remoteJid, {
                image: { url: data.user.avatarMedium },
                caption: profileText
            }, { quoted: message });

        } catch (error) {
            console.error('Error en el Stalk de TikTok:', error);
            return socket.sendMessage(remoteJid, { 
                text: `❌ ${fytBold('ERROR CRÍTICO')}\n\nOcurrió un error al buscar el perfil. Revisa que el usuario exista o intenta más tarde.` 
            }, { quoted: message });
        }
    }
}