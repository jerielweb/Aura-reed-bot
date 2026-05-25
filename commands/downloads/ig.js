import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fytBold } from '../../models/TextStyle.js';

const IG_REGEX = /^(https?:\/\/)?(www\.)?(instagram\.com)\/(p|reel|reels|tv|stories)\/.*$/i;

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

function normalizeAlyacore(res) {
    if (!res || !res.status || !res.data) {
        throw new Error('Alyacore no devolvió resultados válidos');
    }
    const downloadUrl = res.data.dl;
    if (!downloadUrl) throw new Error('Alyacore: No se encontró enlace de descarga');
    
    return {
        url: downloadUrl,
        type: res.data.type || 'video',
        title: res.data.title || null,
        username: res.data.username || null,
        motor: 'Alyacore'
    };
}

function normalizeDelirius(res) {
    if (!res || !res.status) {
        throw new Error('Delirius no devolvió datos válidos');
    }
    // Delirius might return it in data.download, data.url, or a list/result
    const dataObj = res.data;
    const downloadUrl = dataObj?.download || dataObj?.url || (dataObj?.list && dataObj.list[0]?.url) || res.result;
    if (!downloadUrl) throw new Error('Delirius: No se encontró enlace de descarga');
    
    let type = 'video';
    if (dataObj?.type) {
        type = dataObj.type;
    } else if (downloadUrl.includes('.jpg') || downloadUrl.includes('.jpeg') || downloadUrl.includes('.png') || downloadUrl.includes('.webp')) {
        type = 'image';
    }
    
    return {
        url: downloadUrl,
        type,
        title: dataObj?.title || null,
        username: dataObj?.username || null,
        motor: 'Delirius'
    };
}

function normalizeStellar(res) {
    if (!res || !res.status) {
        throw new Error('StellarWA no devolvió resultados válidos');
    }
    const dataObj = res.data || res.resultado || res.result;
    if (!dataObj) throw new Error('StellarWA: No se encontraron datos');
    
    const downloadUrl = dataObj.dl || dataObj.download || dataObj.url || (dataObj.resultados && dataObj.resultados[0]?.url);
    if (!downloadUrl) throw new Error('StellarWA: No se encontró enlace de descarga');
    
    return {
        url: downloadUrl,
        type: dataObj.type || 'video',
        title: dataObj.title || null,
        username: dataObj.username || null,
        motor: 'StellarWA'
    };
}

export default {
    name: ['ig', 'instagram', 'igdl', 'reels', 'igtv'],
    category: 'downloads',
    description: 'Descarga videos, fotos, reels o historias de Instagram.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        let url = args[0] ? args[0].trim() : '';

        if (!url) {
            return await socket.sendMessage(remoteJid, { 
                text: `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n┃ ❌ ${fytBold('FALTA ENLACE')}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un enlace\n┃ > de Instagram (Post, Reel, Historia o IGTV).\n\n╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣` 
            }, { quoted: message });
        }

        // Normalizar /reels/ a /reel/ para que las APIs externas (que no soportan plural en su regex) no fallen
        url = url.replace(/\/reels\//i, '/reel/');

        await socket.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        const tempId = Date.now();
        
        try {
            console.log(`[IG Downloader] Buscando contenido para la URL: ${url}`);
            
            // Consultar las APIs de metadatos en paralelo usando allSettled para conservar todas las respuestas exitosas
            const results = await Promise.allSettled([
                (async () => {
                    const res = await fetchJson(`https://api.alyacore.xyz/dl/instagram?url=${encodeURIComponent(url)}&key=oboe`);
                    return normalizeAlyacore(res);
                })(),
                (async () => {
                    const res = await fetchJson(`https://api.delirius.store/download/instagram?url=${encodeURIComponent(url)}`);
                    return normalizeDelirius(res);
                })(),
                (async () => {
                    const res = await fetchJson(`https://api.stellarwa.xyz/dl/instagram?url=${encodeURIComponent(url)}&key=api-7dSKm`);
                    return normalizeStellar(res);
                })()
            ]);

            // Filtrar las respuestas exitosas
            const successfulMetadata = results
                .filter(r => r.status === 'fulfilled' && r.value)
                .map(r => r.value);

            if (successfulMetadata.length === 0) {
                throw new Error('Todos los servidores de metadatos fallaron o no devolvieron resultados válidos.');
            }

            console.log(`[IG Downloader] Servidores disponibles para descargar: ${successfulMetadata.map(s => s.motor).join(', ')}`);

            let downloaded = false;
            let tempPath = '';
            let finalMetadata = null;

            // Intentar descargar de los servidores exitosos secuencialmente si alguno da error
            for (const metadata of successfulMetadata) {
                const { url: downloadUrl, type, title, username, motor } = metadata;
                console.log(`[IG Downloader] Intentando descargar contenido del servidor: ${motor}...`);

                // Detectar si es una imagen, un Reel o un video común
                const isReelAttempt = url.includes('/reel/') || url.includes('/reels/') || type === 'reel';
                const isImageAttempt = !isReelAttempt && (type === 'image' || type === 'photo' || downloadUrl.includes('.jpg') || downloadUrl.includes('.jpeg') || downloadUrl.includes('.png'));
                
                const fileExt = isImageAttempt ? 'jpg' : 'mp4';
                const attemptTempPath = path.join(os.tmpdir(), `aura-igdl-${tempId}.${fileExt}`);

                try {
                    const mediaRes = await axios({
                        method: 'get',
                        url: downloadUrl,
                        responseType: 'stream',
                        headers: {
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        },
                        timeout: 45000
                    });

                    const fileStream = fs.createWriteStream(attemptTempPath);
                    await new Promise((resolve, reject) => {
                        mediaRes.data.pipe(fileStream);
                        mediaRes.data.on("error", reject);
                        fileStream.on("finish", resolve);
                        fileStream.on("error", reject);
                    });

                    if (fs.existsSync(attemptTempPath) && fs.statSync(attemptTempPath).size > 0) {
                        downloaded = true;
                        tempPath = attemptTempPath;
                        finalMetadata = { ...metadata, isReel: isReelAttempt, isImage: isImageAttempt };
                        console.log(`[IG Downloader] Descarga local exitosa usando Axios con motor: ${motor}`);
                        break;
                    }
                } catch (dlError) {
                    console.error(`[IG Downloader] Falló Axios para ${motor} (${dlError.message}). Intentando con fetch...`);
                    try {
                        if (fs.existsSync(attemptTempPath)) fs.unlinkSync(attemptTempPath);
                    } catch {}

                    try {
                        const fetchRes = await fetch(downloadUrl, {
                            headers: {
                                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                            }
                        });
                        if (fetchRes.ok) {
                            const arrayBuffer = await fetchRes.arrayBuffer();
                            fs.writeFileSync(attemptTempPath, Buffer.from(arrayBuffer));
                            
                            if (fs.existsSync(attemptTempPath) && fs.statSync(attemptTempPath).size > 0) {
                                downloaded = true;
                                tempPath = attemptTempPath;
                                finalMetadata = { ...metadata, isReel: isReelAttempt, isImage: isImageAttempt };
                                console.log(`[IG Downloader] Descarga local exitosa usando fetch con motor: ${motor}`);
                                break;
                            }
                        } else {
                            throw new Error(`HTTP ${fetchRes.status}`);
                        }
                    } catch (fetchError) {
                        console.error(`[IG Downloader] Falló fetch para ${motor}: ${fetchError.message}`);
                        try {
                            if (fs.existsSync(attemptTempPath)) fs.unlinkSync(attemptTempPath);
                        } catch {}
                    }
                }
            }

            // Si ningún servidor pudo descargarse localmente
            if (!downloaded) {
                console.log(`[IG Downloader] Advertencia: Todos los intentos de descarga local fallaron. Intentando envío directo.`);
                const fallbackMeta = successfulMetadata[0];
                finalMetadata = {
                    ...fallbackMeta,
                    isReel: url.includes('/reel/') || url.includes('/reels/') || fallbackMeta.type === 'reel',
                    isImage: !(url.includes('/reel/') || url.includes('/reels/') || fallbackMeta.type === 'reel') && 
                             (fallbackMeta.type === 'image' || fallbackMeta.type === 'photo' || fallbackMeta.url.includes('.jpg') || fallbackMeta.url.includes('.jpeg'))
                };
            }

            const { url: finalUrl, title, username, motor: finalMotor, isReel, isImage } = finalMetadata;
            const typeLabel = isImage ? 'Imagen (JPG)' : (isReel ? 'Reel (MP4)' : 'Video (MP4)');

            // Enviar mensaje de carga
            let caption = `╭〔 📸 ${fytBold('INSTAGRAM DOWNLOADER')} 〕━⬣\n\n`;
            caption += `┃ 📥 ${fytBold('DESCARGANDO ARCHIVO')}\n`;
            caption += `┃ ⏳ Espere un momento...\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            if (title) caption += `┃ > Titulo › ${title.slice(0, 50)}${title.length > 50 ? '...' : ''}\n`;
            if (username) caption += `┃ > Usuario › @${username}\n`;
            caption += `┃ > Tipo › ${typeLabel}\n`;
            caption += `┃ > Motor › ${finalMotor}\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ > El archivo se esta\n`;
            caption += `┃ > enviando, espera un momento...\n\n`;
            caption += `╰━━〔 ⚡ ${fytBold('SYSTEM ACTIVE')} 〕━━⬣`;

            await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });

            // Enviar el archivo (imagen o video/reel) a WhatsApp
            await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });

            const mediaSource = downloaded ? { url: tempPath } : { url: finalUrl };
            console.log(`[IG Downloader] Enviando contenido a WhatsApp desde: ${downloaded ? 'Archivo Local' : 'URL Remota'}`);

            if (isImage) {
                await socket.sendMessage(remoteJid, {
                    image: mediaSource,
                    caption: `📸 *𝐈𝐧𝐬𝐭𝐚𝐠𝐫𝐚𝐦 𝐏𝐡𝐨𝐭𝐨*\n⚡ *𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝 𝐖𝐚𝐁𝐨𝐭*`
                }, { quoted: message });
            } else {
                await socket.sendMessage(remoteJid, {
                    video: mediaSource,
                    mimetype: 'video/mp4',
                    fileName: isReel ? `instagram_reel_${tempId}.mp4` : `instagram_video_${tempId}.mp4`,
                    caption: isReel ? `🎬 *𝐈𝐧𝐬𝐭𝐚𝐠𝐫𝐚𝐦 𝐑𝐞𝐞𝐥*\n⚡ *𝐀𝐮𝐫𝐚 𝐑𝐞微𝐛𝐨𝐭*` : `🎬 *𝐈𝐧𝐬𝐭𝐚𝐠𝐫𝐚𝐦 𝐕𝐢𝐝𝐞𝐨*\n⚡ *𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝 𝐖𝐚𝐁𝐨𝐭*`
                }, { quoted: message });
            }

            // Limpieza del archivo temporal (solo si se descargó localmente)
            try {
                if (downloaded && fs.existsSync(tempPath)) {
                    fs.unlinkSync(tempPath);
                }
            } catch (err) {
                console.error('[IG Downloader] Error al limpiar archivo temporal:', err);
            }

        } catch (error) {
            console.error('Error en Instagram Downloader:', error);
            await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await socket.sendMessage(remoteJid, { 
                text: `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n┃ ⚠️ ${fytBold('ERROR DE DESCARGA')}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || 'Ocurrio un error inesperado al procesar la descarga de Instagram.'}\n\n╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣` 
            }, { quoted: message });
        }
    }
};
