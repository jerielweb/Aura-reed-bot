import axios from 'axios';

export default {
    name: ['ttsearch', 'tiktoksearch', 'tts'],
    category: 'search',
    description: 'Busca videos en TikTok.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const query = args.join(' ');

        if (!query) {
            return await socket.sendMessage(remoteJid, { text: `⚠️ Debes especificar qué buscar.\nEjemplo: *${global.db.prefix}ttsearch bomboclat*` }, { quoted: message });
        }

        console.log(`[TikTok Search] Iniciando búsqueda: "${query}"`);
        await socket.sendMessage(remoteJid, { text: '🔍 Buscando en TikTok...' }, { quoted: message });

        // Funciones para ambas APIs
        const searchAlyacore = async () => {
            try {
                console.log('[TikTok API] Intentando Alyacore...');
                const res = await axios.get('https://api.alyacore.xyz/search/tiktok', {
                    params: {
                        query: query,
                        key: 'oboe'
                    },
                    timeout: 10000
                });

                console.log(`[Alyacore Response] Status: ${res.status}, Resultados: ${res.data?.data?.length || 0}`);

                if (res.data?.status && res.data?.data?.length > 0) {
                    return {
                        source: 'Alyacore API',
                        results: res.data.data.slice(0, 5).map(video => ({
                            title: video.title,
                            author: video.author.nickname,
                            username: video.author.unique_id,
                            views: formatNumber(video.stats.views),
                            likes: formatNumber(video.stats.likes),
                            duration: video.duration,
                            music: video.music.title,
                            url: video.dl,
                            tiktok_url: `https://www.tiktok.com/video/${video.id}`,
                            cover: video.cover
                        }))
                    };
                }
            } catch (err) {
                console.log('[Alyacore Error]:', err.message);
            }
            return null;
        };

        const searchDelirius = async () => {
            try {
                console.log('[TikTok API] Intentando Delirius...');
                const res = await axios.get('https://api.delirius.store/search/tiktoksearch', {
                    params: {
                        query: query
                    },
                    timeout: 10000
                });

                console.log(`[Delirius Response] Status: ${res.status}, Resultados: ${res.data?.meta?.length || 0}`);

                if (res.data?.meta?.length > 0) {
                    return {
                        source: 'Delirius API',
                        results: res.data.meta.slice(0, 5).map(video => ({
                            title: video.title,
                            author: video.author.nickname,
                            username: video.author.username,
                            views: formatNumber(video.play),
                            likes: formatNumber(video.like),
                            duration: formatDuration(video.duration),
                            music: video.music.title,
                            url: video.hd,
                            tiktok_url: video.url,
                            cover: video.hd
                        }))
                    };
                }
            } catch (err) {
                console.log('[Delirius Error]:', err.message);
            }
            return null;
        };

        // Esperar ambas y seleccionar la que tenga resultados
        const results = await Promise.allSettled([
            searchAlyacore(),
            searchDelirius()
        ]);

        console.log('[TikTok Search] Resultados de ambas APIs:', {
            alyacore: results[0].status === 'fulfilled' ? (results[0].value ? '✅ Con datos' : '⚠️ Sin datos') : '❌ Error',
            delirius: results[1].status === 'fulfilled' ? (results[1].value ? '✅ Con datos' : '⚠️ Sin datos') : '❌ Error'
        });

        // Seleccionar la primera que tenga datos
        const result = results.find(r => r.status === 'fulfilled' && r.value?.results?.length > 0)?.value;

        if (!result) {
            console.log('[TikTok Search] No se encontraron resultados en ninguna API');
            return await socket.sendMessage(remoteJid, { text: '❌ No se encontraron resultados o error en las APIs.' }, { quoted: message });
        }
        // Formatear respuesta
        let text = `╭━━〔 𝐓𝐈𝐊𝐓𝐎𝐊 𝐒𝐄𝐀𝐑𝐂𝐇 〕━━⬣\n`;
        text += `┃ 🔍 𝐏𝐨𝐫: ${result.source}\n`;
        text += `┃ 🎬 𝐁úsqueda: ${query}\n`;
        text += `╰━━━━━━━━━━━━━━━━⬣\n\n`;

        result.results.forEach((video, i) => {
            text += `┃ ${i + 1}. ${video.title}\n`;
            text += `┃ ├ 👤 @${video.username} (${video.author})\n`;
            text += `┃ ├ 👁️ ${video.views} | ❤️ ${video.likes}\n`;
            text += `┃ ├ 🎵 ${video.music.substring(0, 40)}${video.music.length > 40 ? '...' : ''}\n`;
            text += `┃ ├ ⏱️ ${video.duration}\n`;
            text += `┃ └ 🎥 ${video.tiktok_url}\n\n`;
        });

        text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

        console.log(`[TikTok Search] Enviando ${result.results.length} resultados desde ${result.source}`);
        console.log('[TikTok Search] Videos encontrados:', result.results.map(v => ({ title: v.title, author: v.author })));

        await socket.sendMessage(remoteJid, {
            image: { url: result.results[0].cover },
            caption: text
        }, { quoted: message });
    }
};


/**
 * Formatea números para hacerlos más legibles
 * @param {number} num - Número a formatear
 * @returns {string} - Número formateado
 */
function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
}

/**
 * Convierte segundos a formato MM:SS
 * @param {number} seconds - Segundos
 * @returns {string} - Formato MM:SS
 */
function formatDuration(seconds) {
    if (!seconds) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
