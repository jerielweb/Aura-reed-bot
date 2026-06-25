import yts from 'yt-search';
import downloader from '../../controllers/ytDownloader.js';
import formatter from '../../controllers/functions/formatNumbers.js';
import { fytBold } from '../../models/TextStyle.js';

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
    name: ['ytmp4', 'video', 'playvideo', 'mp4', 'ytv', 'play2'],
    category: 'downloads',
    description: 'Busca y descarga video de YouTube.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const text = args.join(' ').trim();

        if (!text) {
            return await socket.sendMessage(remoteJid, { text: `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n┃ ❌ ${fytBold('FALTA BUSQUEDA')}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > nombre o enlace de video.\n\n╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣` }, { quoted: message });
        }

        await socket.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        try {
            let finalUrl = text;
            let videoData = null;

            if (!YT_REGEX.test(text)) {
                const search = await yts(text);
                if (!search.videos?.length) {
                    await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
                    return await socket.sendMessage(remoteJid, { text: `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n┃ ⚠️ ${fytBold('SIN RESULTADOS')}\n╰━━━━━━━━━━━━⬣\n\n┃ > No se encontro ningun video.\n\n╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣` }, { quoted: message });
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

            let caption = `╭〔 🎬 ${fytBold('YT DOWNLOADER')} 〕━⬣\n\n`;
            caption += `┃ 🎥 ${fytBold('DESCARGANDO ARCHIVO')}\n`;
            caption += `┃ ⏳ Espere un momento...\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ ➥ ${fytBold(title)}\n\n`;
            caption += `┃ > Canal › ${author}\n`;
            caption += `┃ > Duracion › ${duration}\n`;
            caption += `┃ > Vistas › ${formatter(views)}\n`;
            caption += `┃ > Enlace › ${finalUrl}\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ > El archivo se esta\n`;
            caption += `┃ > transcodificando, espera un momento...\n\n`;
            caption += `╰━━〔 ⚡ ${fytBold('SYSTEM ACTIVE')} 〕━━⬣`;

            const videoPath = await downloader.getVideo(finalUrl);

            await socket.sendMessage(remoteJid, {
                video: {url: videoPath},
                minetype: 'video/mp4',
                fileName: `${title.replace(/[<>:"/\\|?*]/g, '')}.mp4`,
                caption
            },
            { quoted: message }
        );
            await socket.sendMessage(remoteJid, {react: { text: '✅', key: message.key } });



        } catch (error) {
            console.error('Error en ytmp4:', error);
            await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await socket.sendMessage(remoteJid, { text: `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n┃ ⚠️ ${fytBold('ERROR DE DESCARGA')}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || 'Ocurrio un error inesperado.'}\n\n╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣` }, { quoted: message });
        }
    }
};

