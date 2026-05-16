import axios from 'axios';

export default {
    name: ['ytsearch', 'yts', 'plays'],
    category: 'search',
    description: 'Busca videos en YouTube. Usa: .yt [búsqueda]',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const query = args.join(' ');

        if (!query) {
            return await socket.sendMessage(remoteJid, { text: `⚠️ Debes especificar qué buscar.\nEjemplo: *${db.prefix}yts Twice Fancy*` }, { quoted: message });
        }

        await socket.sendMessage(remoteJid, { text: '🔍 Buscando en YouTube...' }, { quoted: message });

        // Funciones para ambas APIs
        const searchAlyacore = async () => {
            try {
                const res = await axios.get(`${global.youtubeApis.alyacore.url}?query=${encodeURIComponent(query)}&key=${global.youtubeApis.alyacore.apikey}`);
                if (res.data?.result?.length > 0) {
                    return {
                        source: 'Alyacore API',
                        results: res.data.result.slice(0, 5).map(item => ({
                            title: item.title,
                            author: item.autor,
                            duration: item.duration,
                            views: item.views,
                            image: item.banner,
                            url: item.url
                        }))
                    };
                }
            } catch (err) {
                console.log('Error Alyacore:', err.message);
            }
            return null;
        };

        const searchDelirius = async () => {
            try {
                const res = await axios.get(`${global.youtubeApis.delirius.url}?q=${encodeURIComponent(query)}`);
                if (res.data?.data?.length > 0) {
                    return {
                        source: 'Delirius API',
                        results: res.data.data.slice(0, 5).map(item => ({
                            title: item.title,
                            author: item.author?.name || 'Desconocido',
                            duration: item.duration,
                            views: item.views?.toLocaleString(),
                            image: item.image,
                            url: item.url
                        }))
                    };
                }
            } catch (err) {
                console.log('Error Delirius:', err.message);
            }
            return null;
        };

        // Carrera: el primero que responda gana
        const result = await Promise.race([
            searchAlyacore().catch(() => null),
            searchDelirius().catch(() => null)
        ]);

        if (!result) {
            return await socket.sendMessage(remoteJid, { text: '❌ No se encontraron resultados o error en las APIs.' }, { quoted: message });
        }

        // Formatear respuesta
        let text = `╭━━〔 𝐘𝐎𝐔𝐓𝐔𝐁𝐄 𝐒𝐄𝐀𝐑𝐂𝐇 〕━━⬣\n`;
        text += `┃ 🔍 𝐏𝐨𝐫: ${result.source}\n`;
        text += `┃ 🎬 𝐁úsqueda: ${query}\n`;
        text += `╰━━━━━━━━━━━━━━━━⬣\n\n`;

        result.results.forEach((video, i) => {
            text += `┃ ${i + 1}. *${video.title}*\n`;
            text += `┃ ├ 👤 ${video.author}\n`;
            text += `┃ ├ ⏱️ ${video.duration}\n`;
            text += `┃ ├ 👁️ ${video.views}\n`;
            text += `┃ └ 🔗 ${video.url}\n\n`;
        });

        text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

        await socket.sendMessage(remoteJid, {
            image: { url: result.results[0].image },
            caption: text
        }, { quoted: message });
    }
};
