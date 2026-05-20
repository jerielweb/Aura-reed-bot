import yts from 'yt-search';
import downloader from '../../controllers/ytDownloader.js';

const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;

function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match?.[1]) return match[1];
    }
    return null;
}

export default {
    name: ['ytmp4', 'video', 'playvideo'],
    category: 'downloads',
    description: 'Busca y descarga video de YouTube.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const text = args.join(' ').trim();

        if (!text) {
            return await socket.sendMessage(remoteJid, { text: '╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > nombre o enlace de video.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣' }, { quoted: message });
        }

        await socket.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        try {
            let finalUrl = text;
            let videoData = null;

            if (!YT_REGEX.test(text)) {
                const search = await yts(text);
                if (!search.videos?.length) {
                    await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
                    return await socket.sendMessage(remoteJid, { text: '╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐒𝐈𝐍 𝐑𝐄𝐒𝐔𝐋𝐓𝐀𝐃𝐎𝐒\n╰━━━━━━━━━━━━⬣\n\n┃ > No se encontró ningún video.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣' }, { quoted: message });
                }
                videoData = search.videos[0];
                finalUrl = videoData.url;
            } else {
                const videoId = extractVideoId(text);
                if (!videoId) throw new Error('URL de YouTube no válida');
                finalUrl = `https://youtu.be/${videoId}`;

                try {
                    const searchById = await yts({ videoId });
                    if (searchById?.title) {
                        videoData = searchById;
                    }
                } catch {}

                if (!videoData) {
                    try {
                        const searchFallback = await yts(videoId);
                        if (searchFallback.videos?.length) {
                            videoData = searchFallback.videos.find(v => v.videoId === videoId) || searchFallback.videos[0];
                        }
                    } catch {}
                }

                if (!videoData) {
                    videoData = {
                        title: 'Video de YouTube',
                        author: { name: 'Desconocido' },
                        duration: { timestamp: '??' },
                        views: 0,
                        thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                        url: finalUrl
                    };
                }
            }

            const title = videoData.title || 'Video de YouTube';
            const author = videoData.author?.name || videoData.author || 'Desconocido';
            const duration = videoData.duration?.timestamp || '??';
            const views = typeof videoData.views === 'number' ? videoData.views : 0;
            const thumbnail = videoData.thumbnail || videoData.image || `https://i.ytimg.com/vi/${extractVideoId(finalUrl) || 'default'}/hqdefault.jpg`;

            let caption = `╭〔 🎬 𝐘𝐓 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 〕━⬣\n\n`;
            caption += `┃ 🎥 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀𝐍𝐃𝐎 𝐀𝐑𝐂𝐇𝐈𝐕𝐎\n`;
            caption += `┃ ⏳ 𝐄𝐬𝐩𝐞𝐫𝐞 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ ➥ 𝐃𝐞𝐬𝐜𝐚𝐫𝐠𝐚𝐧𝐝𝐨 › ${title}\n\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐂𝐚𝐧𝐚𝐥 › ${author}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐃𝐮𝐫𝐚𝐜𝐢𝐨́𝐧 › ${duration}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐕𝐢𝐬𝐭𝐚𝐬 › ${views.toLocaleString()}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐄𝐧𝐥𝐚𝐜𝐞 › ${finalUrl}\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ 𐙚 ❀ ｡ ↻ 𝐄𝐥 𝐚𝐫𝐜𝐡𝐢𝐯𝐨 𝐬𝐞 𝐞𝐬𝐭𝐚́\n`;
            caption += `┃ 𝐭𝐫𝐚𝐧𝐬𝐜𝐨𝐝𝐢𝐟𝐢𝐜𝐚𝐧𝐝𝐨, 𝐞𝐬𝐩𝐞𝐫𝐚 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

            await socket.sendMessage(remoteJid, { image: { url: thumbnail }, caption }, { quoted: message });

            const videoPath = await downloader.getVideo(finalUrl);

            await socket.sendMessage(remoteJid, {
                video: { url: videoPath },
                mimetype: 'video/mp4',
                fileName: `${title.replace(/[<>:"/\\|?*]/g, '')}.mp4`,
                caption: `🎬 *𝐓𝐢𝐭𝐮𝐥𝐨:* ${title}\n⚡ *𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝 𝐃𝐨𝐰𝐧𝐥𝐨𝐚𝐝𝐞𝐫*`
            }, { quoted: message });

            await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });

        } catch (error) {
            console.error('Error en ytmp4:', error);
            await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await socket.sendMessage(remoteJid, { text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || 'Ocurrió un error inesperado.'}\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` }, { quoted: message });
        }
    }
};

