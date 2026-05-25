import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';

const FB_REGEX = /^(https?:\/\/)?(www\.)?(facebook\.com|fb\.watch|fb\.gg|m\.facebook\.com|share\/v|share\/r)\/.*$/i;

async function fetchJson(url) {
    const res = await axios.get(url, { timeout: 30000 });
    return res.data;
}

async function firstSuccessfulPromise(promises) {
    return new Promise((resolve, reject) => {
        let errors = [];
        let completed = 0;
        if (promises.length === 0) {
            reject(new Error('No hay servidores disponibles.'));
            return;
        }
        promises.forEach(p => {
            Promise.resolve(p)
                .then(res => {
                    if (res) {
                        resolve(res);
                    } else {
                        throw new Error('Respuesta vacía o inválida');
                    }
                })
                .catch(err => {
                    errors.push(err);
                })
                .finally(() => {
                    completed++;
                    if (completed === promises.length) {
                        reject(new Error('Todos los servidores fallaron: ' + errors.map(e => e.message).join(' | ')));
                    }
                });
        });
    });
}

function normalizeDelirius(res) {
    if (!res || !res.status || !res.list || res.list.length === 0) {
        throw new Error('Delirius no devolvió datos válidos');
    }
    const validVideos = res.list.filter(v => v.url && v.url !== '/');
    if (validVideos.length === 0) throw new Error('Delirius: No se encontraron videos válidos');
    
    // Priorizar HD/720p/1080p
    const hdVideo = validVideos.find(v => v.quality && (v.quality.includes('HD') || v.quality.includes('720p') || v.quality.includes('1080p')));
    const video = hdVideo || validVideos[0];
    
    return {
        url: video.url,
        quality: video.quality || 'N/A',
        thumbnail: res.thumb || null,
        motor: 'Delirius'
    };
}

function normalizeAlyacore(res) {
    if (!res || !res.status || !res.resultados || res.resultados.length === 0) {
        throw new Error('Alyacore no devolvió resultados válidos');
    }
    const validVideos = res.resultados.filter(v => v.url && v.url !== '/');
    if (validVideos.length === 0) throw new Error('Alyacore: No se encontraron videos válidos');
    
    const hdVideo = validVideos.find(v => v.quality && (v.quality.includes('HD') || v.quality.includes('720p') || v.quality.includes('1080p')));
    const video = hdVideo || validVideos[0];
    
    return {
        url: video.url,
        quality: video.quality || 'N/A',
        thumbnail: null,
        motor: 'Alyacore'
    };
}

function normalizeStellar(res) {
    if (!res || !res.status || !res.resultados || res.resultados.length === 0) {
        throw new Error('StellarWA no devolvió resultados válidos');
    }
    const validVideos = res.resultados.filter(v => v.url && v.url !== '/');
    if (validVideos.length === 0) throw new Error('StellarWA: No se encontraron videos válidos');
    
    const hdVideo = validVideos.find(v => v.quality && (v.quality.includes('HD') || v.quality.includes('720p') || v.quality.includes('1080p')));
    const video = hdVideo || validVideos[0];
    
    return {
        url: video.url,
        quality: video.quality || 'N/A',
        thumbnail: null,
        motor: 'StellarWA'
    };
}

export default {
    name: ['fb', 'facebook', 'fbdl', 'facebookdl', 'fbvideo', 'fbv', 'fbreels'],
    category: 'downloads',
    description: 'Descarga videos de Facebook / Reels.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const url = args[0] ? args[0].trim() : '';

        if (!url) {
            return await socket.sendMessage(remoteJid, { 
                text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐄𝐍𝐋𝐀𝐂𝐄\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un enlace\n┃ > de Facebook o Facebook Reels.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` 
            }, { quoted: message });
        }

        await socket.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        const tempId = Date.now();
        const tempPath = path.join(os.tmpdir(), `aura-fbdl-${tempId}.mp4`);

        try {
            console.log(`[FB Downloader] Buscando video para la URL: ${url}`);
            
            // Carrera en paralelo de las 3 APIs
            const fbTasks = [
                (async () => {
                    const res = await fetchJson(`https://api.delirius.store/download/facebook?url=${encodeURIComponent(url)}`);
                    return normalizeDelirius(res);
                })(),
                (async () => {
                    const res = await fetchJson(`https://api.alyacore.xyz/dl/facebook?url=${encodeURIComponent(url)}&key=oboe`);
                    return normalizeAlyacore(res);
                })(),
                (async () => {
                    const res = await fetchJson(`https://api.stellarwa.xyz/dl/facebook?url=${encodeURIComponent(url)}&key=api-7dSKm`);
                    return normalizeStellar(res);
                })()
            ];

            const metadata = await firstSuccessfulPromise(fbTasks);
            const { url: videoUrl, quality, thumbnail, motor } = metadata;

            console.log(`[FB Downloader] Servidor ganador: ${motor}. Descargando calidad: ${quality}`);

            // Enviar mensaje de carga
            let caption = `╭〔 🎬 𝐅𝐀𝐂𝐄𝐁𝐎𝐎𝐊 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 〕━⬣\n\n`;
            caption += `┃ 🎥 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀𝐍𝐃𝐎 𝐀𝐑𝐂𝐇𝐈𝐕𝐎\n`;
            caption += `┃ ⏳ 𝐄𝐬𝐩𝐞𝐫𝐞 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ > 𝐂𝐚𝐥𝐢𝐝𝐚𝐝 › ${quality}\n`;
            caption += `┃ > 𝐌𝐨𝐝𝐨 › Video (MP4)\n`;
            caption += `┃ > 𝐌𝐨𝐭𝐨𝐫 › ${motor}\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ > 𝐄𝐥 𝐚𝐫𝐜𝐡ι𝐯ο 𝐬𝐞 𝐞𝐬𝐭𝐚́\n`;
            caption += `┃ > 𝐞𝐧𝐯𝐢𝐚𝐧𝐝𝐨, 𝐞𝐬𝐩𝐞𝐫𝐚 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

            if (thumbnail) {
                await socket.sendMessage(remoteJid, { image: { url: thumbnail }, caption }, { quoted: message });
            } else {
                await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });
            }

            // Descargar video a un archivo temporal usando axios stream para soportar archivos de cualquier tamaño
            const videoRes = await axios({
                method: 'get',
                url: videoUrl,
                responseType: 'stream',
                timeout: 120000
            });

            const fileStream = fs.createWriteStream(tempPath);
            await new Promise((resolve, reject) => {
                videoRes.data.pipe(fileStream);
                videoRes.data.on("error", reject);
                fileStream.on("finish", resolve);
                fileStream.on("error", reject);
            });

            // Enviar el video a WhatsApp
        await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });
            await socket.sendMessage(remoteJid, {
                video: { url: tempPath },
                mimetype: 'video/mp4',
                fileName: `facebook_video_${tempId}.mp4`,
                caption: `🎬 *𝐅𝐚𝐜𝐞𝐛𝐨𝐨𝐤 𝐕𝐢𝐝𝐞𝐨*\n⚡ *𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝 𝐖𝐚𝐁𝐨𝐭*`
            }, { quoted: message });

        } catch (error) {
            console.error('Error en Facebook Downloader:', error);
            await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await socket.sendMessage(remoteJid, { 
                text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || 'Ocurrió un error inesperado al procesar el video de Facebook.'}\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` 
            }, { quoted: message });
        } finally {
            // Eliminar archivo temporal
            try {
                if (fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                }
            } catch (err) {
                console.error('[FB Downloader] Error al limpiar archivo temporal:', err);
            }
        }
    }
};
