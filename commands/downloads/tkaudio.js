import downloader from '../../controllers/tiktokDownloader.js';

const TIKTOK_REGEX = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/.*$/i;

export default {
    name: ['tkaudio', 'ttaudio', 'tta'],
    category: 'downloads',
    description: 'Busca y descarga audios de TikTok.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const text = args.join(' ').trim();

        if (!text) {
            return await socket.sendMessage(remoteJid, {
                text: '╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > enlace de TikTok o una búsqueda.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣'
            }, { quoted: message });
        }

        await socket.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        try {
            let finalUrl = text;
            let videoData = null;

            if (!TIKTOK_REGEX.test(text)) {
                // Buscar en TikTok
                const searchResult = await downloader.search(text);
                finalUrl = searchResult.url;
                videoData = {
                    title: searchResult.title || 'Audio de TikTok',
                    author: searchResult.author || 'TikTok User',
                    duration: 'N/A',
                    views: searchResult.views || 0,
                    thumbnail: searchResult.cover,
                    url: finalUrl
                };
            } else {
                // Enlace directo, resolvemos metadatos
                const info = await downloader.getDownloadInfo(finalUrl);
                videoData = {
                    title: info.title || 'Audio de TikTok',
                    author: info.author || 'TikTok User',
                    duration: info.duration ? `${info.duration}s` : 'N/A',
                    views: info.views || 0,
                    thumbnail: info.cover,
                    url: finalUrl
                };
            }

            const title = videoData.title;
            const author = videoData.author;
            const duration = videoData.duration;
            const views = typeof videoData.views === 'number' ? videoData.views : 0;
            const thumbnail = videoData.thumbnail;

            let caption = `╭〔 🎵 𝐓𝐈𝐊𝐓𝐎𝐊 𝐀𝐔𝐃𝐈𝐎 〕━⬣\n\n`;
            caption += `┃ 🔊 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀𝐍𝐃𝐎 𝐀𝐑𝐂𝐇𝐈𝐕𝐎\n`;
            caption += `┃ ⏳ 𝐄𝐬𝐩𝐞𝐫𝐞 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ ➥ 𝐃𝐞𝐬𝐜𝐚𝐫𝐠𝐚𝐧𝐝𝐨 › ${title}\n\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐀𝐮𝐭𝐨𝐫 › ${author}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐃𝐮𝐫𝐚𝐜𝐢𝐨́𝐧 › ${duration}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐕𝐢𝐬𝐭𝐚𝐬 › ${views.toLocaleString()}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐌𝐨𝐝𝐨 › Audio (MP3)\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐄𝐧𝐥𝐚𝐜𝐞 › ${finalUrl}\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ 𐙚 ❀ ｡ ↻ 𝐄𝐥 𝐚𝐫𝐜𝐡𝐢𝐯𝐨 𝐬𝐞 𝐞𝐬𝐭𝐚́\n`;
            caption += `┃ 𝐞𝐧𝐯𝐢𝐚𝐧𝐝𝐨, 𝐞𝐬𝐩𝐞𝐫𝐚 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

            if (thumbnail) {
                await socket.sendMessage(remoteJid, { image: { url: thumbnail }, caption }, { quoted: message });
            } else {
                await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });
            }

            // Descargar y enviar audio
            const { path: audioPath } = await downloader.getAudio(finalUrl);
            await socket.sendMessage(remoteJid, {
                audio: { url: audioPath },
                mimetype: 'audio/mpeg',
                fileName: `${title.replace(/[<>:"/\\|?*]/g, '')}.mp3`
            }, { quoted: message });

            await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });

        } catch (error) {
            console.error('Error en tkaudio downloader command:', error);
            await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await socket.sendMessage(remoteJid, {
                text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || 'Ocurrió un error inesperado.'}\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`
            }, { quoted: message });
        }
    }
};
