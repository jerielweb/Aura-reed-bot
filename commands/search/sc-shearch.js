import axios from 'axios'
import FormartTime from '../../controllers/functions/formatTimeCont.js'
import { fytBold } from '../../models/TextStyle.js';

let cachedClientId = null;
let cacheTime = 0;

async function getClientId() {
    if (cachedClientId && (Date.now() - cacheTime < 3600000)) return cachedClientId;

    const html = await axios.get('https://soundcloud.com', {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36'},
        timeout: 10000
    }).then(r => r.data);

    const scriptUrls = [...html.matchAll(/src="(https:\/\/a-v2\.sndcdn\.com\/assets\/[^"]+\.js)"/g)].map(m => m[1]);

    for (const scriptUrl of scriptUrls.slice(-5)) {
        try {
            const cli = await axios.get(scriptUrl).then(r => r.data);
            const match = cli.match(/client_id:"([a-zA-Z0-9]+)"/);
            if (match) {
                cachedClientId = match[1];
                cacheTime = Date.now();
                return cachedClientId;
            }
        } catch {}
    }
    throw new Error('No se pudo obtener el client_id de SoundCloud');
}

export default {
    name: ['scsearch', 'scbuscar', 'scb', 'scs'],
    description: 'Busca canciones de SoundCloud',

    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        let query = args.join(' ').trim();

        if (!query) {
            let errorText = `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n`;
            errorText += `┃ ❌ ${fytBold('FALTA BUSQUEDA')}\n`;
            errorText += `╰━━━━━━━━━━━━⬣\n\n`;
            errorText += `┃ > Por favor, proporciona\n`;
            errorText += `┃ > palabras clave para\n`;
            errorText += `┃ > realizar la búsqueda.\n\n`;
            errorText += `╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣`;
            return await socket.sendMessage(remoteJid, { text: errorText }, { quoted: message });
        }

        await socket.sendMessage(remoteJid, { react: { text: '🔍', key: message.key } });

        try {
            const clientId = await getClientId();
            const r = await axios.get('https://api-v2.soundcloud.com/search/tracks', {
                params: { q: query, client_id: clientId, limit: 10 },
                timeout: 10000
            });

            const response = r.data.collection;
            if (!response?.length) throw new Error('No se encontraron resultados');

            let resultTest = `╭━━〔 ${fytBold('SOUNDCLOUD SEARCH')} 〕━━⬣\n`;
            resultTest += `┃ 🔍 ${fytBold('Busqueda:')} ${query}\n`;
            resultTest += `┃ ⚙️ ${fytBold('Motor')} › Api Interna\n`;
            resultTest += `╰━━━━━━━━━━━━━━━━⬣\n\n`;

            response.forEach((res, i) => {
                resultTest += `┃ ${i + 1}. ${fytBold(res.title)}\n`;
                resultTest += `┃ ├ 👤 ${fytBold('Artista')} › ${res.user?.username || 'Desconocido'}\n`;
                resultTest += `┃ ├ ⏱️ ${fytBold('Duracuión')} › ${FormartTime(res.duration) || 'N/A'}\n`;
                resultTest += `┃ └ 🔗 ${fytBold('Url')} › ${res.permalink_url || 'No disponible'}\n\n`;
            });
            await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });
            await socket.sendMessage(remoteJid, { text: resultTest.trim() }, { quoted: message });
        } catch (error) {
            console.error(error);
            await socket.sendMessage(remoteJid, { text: `❌ Error: ${error.message}` }, { quoted: message });
        }
    }
}