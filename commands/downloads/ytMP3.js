import yts from 'yt-search';
import downloader from '../../controllers/ytDownloader.js';

export default {
    name: ['ytmp3', 'play', 'yta'],
    category: 'downloads',
    description: 'Busca y descarga audio de YouTube con sistema de carrera y caché.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const text = args.join(' ');

        if (!text) {
            return await socket.sendMessage(remoteJid, { text: '╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > nombre o enlace de canción.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣' }, { quoted: message });
        }

        // Reacción de espera
        await socket.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        try {
            let finalUrl = text;
            let videoData = null;
            
            // Si no es un enlace, buscar en YouTube
            if (!text.match(/^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/)) {
                const search = await yts(text);
                if (!search.videos || search.videos.length === 0) {
                    await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
                    return await socket.sendMessage(remoteJid, { text: '╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐒𝐈𝐍 𝐑𝐄𝐒𝐔𝐋𝐓𝐀𝐃𝐎𝐒\n╰━━━━━━━━━━━━⬣\n\n┃ > No se encontró ningún video.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣' }, { quoted: message });
                }
                videoData = search.videos[0];
                finalUrl = videoData.url;
            } else {
                // Si es link, obtener data para el caption
                const search = await yts(finalUrl);
                videoData = search;
            }

            const { title, author, duration, views, thumbnail } = videoData;

            let caption = `╭〔 🎵 𝐘𝐓 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 〕━⬣\n\n`;
            caption += `┃ 🔊 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀𝐍𝐃𝐎 𝐀𝐑𝐂𝐇𝐈𝐕𝐎\n`;
            caption += `┃ ⏳ 𝐄𝐬𝐩𝐞𝐫𝐞 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ ➥ 𝐃𝐞𝐬𝐜𝐚𝐫𝐠𝐚𝐧𝐝𝐨 › ${title}\n\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐂𝐚𝐧𝐚𝐥 › ${author?.name || 'Desconocido'}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐃𝐮𝐫𝐚𝐜𝐢𝐨́𝐧 › ${duration?.timestamp || '??'}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐕𝐢𝐬𝐭𝐚𝐬 › ${views?.toLocaleString() || '0'}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐄𝐧𝐥𝐚𝐜𝐞 › ${finalUrl}\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ 𐙚 ❀ ｡ ↻ 𝐄𝐥 𝐚𝐫𝐜𝐡𝐢𝐯𝐨 𝐬𝐞 𝐞𝐬𝐭𝐚́\n`;
            caption += `┃ 𝐞𝐧𝐯𝐢𝐚𝐧𝐝𝐨, 𝐞𝐬𝐩𝐞𝐫𝐚 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

            // Enviar miniatura informativa (con fallback si falla el thumbnail)
            const imageSource = thumbnail || 'https://i.ytimg.com/vi/default/hqdefault.jpg';
            await socket.sendMessage(remoteJid, { 
                image: { url: imageSource }, 
                caption 
            }, { quoted: message });

            // Usar el controlador centralizado (Carrera + Caché)
            const audioPath = await downloader.getAudio(finalUrl);

            // Enviar el audio
            await socket.sendMessage(remoteJid, {
                audio: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: `${title}.mp3`
            }, { quoted: message });

            // Reacción de éxito
            await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });

        } catch (error) {
            console.error('Error en ytmp3:', error);
            await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await socket.sendMessage(remoteJid, { text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || 'Ocurrió un error inesperado.'}\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` }, { quoted: message });
        }
    }
};
