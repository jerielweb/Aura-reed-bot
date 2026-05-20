import downloader from '../../controllers/spotifyDownloader.js';

export default {
    name: ['spotify', 'sp', 'spotifydl'],
    category: 'downloads',
    description: 'Busca y descarga canciones de Spotify.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const text = args.join(' ').trim();

        if (!text) {
            return await socket.sendMessage(remoteJid, { 
                text: '╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > enlace de Spotify o una búsqueda.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣' 
            }, { quoted: message });
        }

        await socket.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        try {
            // Descargar y obtener la ruta del archivo + metadatos
            const { metadata, path: audioPath, downloadSource } = await downloader.download(text);

            const title = metadata.title || 'Canción de Spotify';
            const artist = metadata.artist || 'Desconocido';
            const duration = metadata.duration || 'N/A';
            const cover = metadata.cover;
            const finalUrl = metadata.url || text;

            let caption = `╭〔 🎵 𝐒𝐏𝐎𝐓𝐈𝐅𝐘 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 〕━⬣\n\n`;
            caption += `┃ 🔊 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀𝐍𝐃𝐎 𝐀𝐑𝐂𝐇𝐈𝐕𝐎\n`;
            caption += `┃ ⏳ 𝐄𝐬𝐩𝐞𝐫𝐞 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ ➥ 𝐃𝐞𝐬𝐜𝐚𝐫𝐠𝐚𝐧𝐝𝐨 › ${title}\n\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐀𝐫𝐭𝐢𝐬𝐭𝐚 › ${artist}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐃𝐮𝐫𝐚𝐜𝐢𝐨́𝐧 › ${duration}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐌𝐨𝐝𝐨 › Audio (MP3)\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐌𝐨𝐭𝐨𝐫 › ${downloadSource || 'Desconocido'}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐄𝐧𝐥𝐚𝐜𝐞 › ${finalUrl}\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ 𐙚 ❀ ｡ ↻ 𝐄𝐥 𝐚𝐫𝐜𝐡𝐢𝐯𝐨 𝐬𝐞 𝐞𝐬𝐭𝐚́\n`;
            caption += `┃ 𝐞𝐧𝐯𝐢𝐚𝐧𝐝𝐨, 𝐞𝐬𝐩𝐞𝐫𝐚 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

            if (cover) {
                await socket.sendMessage(remoteJid, { image: { url: cover }, caption }, { quoted: message });
            } else {
                await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });
            }

            // Enviar archivo de audio
            await socket.sendMessage(remoteJid, {
                audio: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: `${title.replace(/[<>:"/\\|?*]/g, '')}.mp3`
            }, { quoted: message });

            await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });

        } catch (error) {
            console.error('Error en Spotify Downloader:', error);
            await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await socket.sendMessage(remoteJid, { 
                text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || 'Ocurrió un error inesperado.'}\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` 
            }, { quoted: message });
        }
    }
};
