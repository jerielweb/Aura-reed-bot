import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

async function fetchJson(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
    return await res.json();
}

async function firstSuccessfulPromise(promises) {
    return new Promise((resolve, reject) => {
        let errors = [];
        let completed = 0;
        if (promises.length === 0) {
            reject(new Error('No hay tareas disponibles para procesar.'));
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

function normalize(apiResult, motorName) {
    if (!apiResult || !apiResult.status || !apiResult.data) {
        throw new Error(`[${motorName}] Respuesta inválida o sin datos`);
    }
    const data = apiResult.data;
    
    const name = data.name || 'Aplicación Desconocida';
    const packageId = data.package || data.id || 'com.unknown';
    const size = data.size || 'N/A';
    const lastUpdated = data.lastUpdated || data.publish || 'N/A';
    const banner = data.banner || data.image || null;
    const dl = data.dl || data.download;

    if (!dl) {
        throw new Error(`[${motorName}] No se pudo obtener el enlace de descarga`);
    }

    return {
        name,
        packageId,
        size,
        lastUpdated,
        banner,
        dl,
        motor: motorName
    };
}

export default {
    name: ['apk', 'apkdl'],
    category: 'downloads',
    description: 'Descarga archivos APK de Android.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const query = args.join(' ').trim();

        if (!query) {
            return await socket.sendMessage(remoteJid, { 
                text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona el nombre\n┃ > de la aplicación APK a buscar.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` 
            }, { quoted: message });
        }

        await socket.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        const cacheDir = path.resolve('./tmp');
        let cachePath = null;
        let isCacheHit = false;

        try {
            // Carrera en paralelo de las 3 APIs para obtener metadatos
            const searchTasks = [
                (async () => {
                    const res = await fetchJson(`https://api.stellarwa.xyz/search/apk?query=${encodeURIComponent(query)}&key=api-7dSKm`);
                    return normalize(res, 'StellarWA');
                })(),
                (async () => {
                    const res = await fetchJson(`https://api.alyacore.xyz/search/apk?query=${encodeURIComponent(query)}&key=oboe`);
                    return normalize(res, 'Alyacore');
                })(),
                (async () => {
                    const res = await fetchJson(`https://api.delirius.store/download/apk?query=${encodeURIComponent(query)}`);
                    return normalize(res, 'Delirius');
                })()
            ];

            const metadata = await firstSuccessfulPromise(searchTasks);
            const { name, packageId, size, lastUpdated, banner, dl, motor } = metadata;

            // Configurar directorio de caché si no existe
            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            cachePath = path.join(cacheDir, `${packageId}.apk`);

            if (fs.existsSync(cachePath)) {
                console.log(`[APK CACHE] [HIT] Encontrado APK en caché local: ${cachePath}`);
                isCacheHit = true;
            } else {
                console.log(`[APK CACHE] [MISS] No se encontró el APK local para: ${packageId}. Descargando...`);
                
                const res = await fetch(dl);
                if (!res.ok) throw new Error(`Fallo al descargar APK: ${res.statusText}`);

                const fileStream = fs.createWriteStream(cachePath);
                await new Promise((resolve, reject) => {
                    res.body.pipe(fileStream);
                    res.body.on("error", reject);
                    fileStream.on("finish", resolve);
                    fileStream.on("error", reject);
                });

                console.log(`[APK CACHE] [SAVE] Guardando APK en caché local: ${cachePath}`);
            }

            const motorLabel = isCacheHit ? `${motor} (Caché)` : motor;

            let caption = `╭〔 🤖 𝐀𝐏𝐊 𝐃𝐎𝐖𝐍𝐋𝐎𝐀𝐃𝐄𝐑 〕━⬣\n\n`;
            caption += `┃ 📦 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀𝐍𝐃𝐎 𝐀𝐑𝐂𝐇𝐈𝐕𝐎\n`;
            caption += `┃ ⏳ 𝐄𝐬𝐩𝐞𝐫𝐞 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ ➥ 𝐀𝐩𝐥𝐢𝐜𝐚𝐜𝐢𝐨́𝐧 › ${name || 'Desconocida'}\n\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐏𝐚𝐪𝐮𝐞𝐭𝐞 › ${packageId || 'Desconocido'}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐓𝐚𝐦𝐚𝐧̃𝐨 › ${size || 'N/A'}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐀𝐜𝐭𝐮𝐚𝐥𝐢𝐳𝐚𝐝𝐨 › ${lastUpdated || 'N/A'}\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐌𝐨𝐝𝐨 › Aplicación (APK)\n`;
            caption += `┃ > ✿⃘࣪◌ ֪ 𝐌𝐨𝐭𝐨𝐫 › ${motorLabel}\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ 𐙚 ❀ ｡ ↻ 𝐄𝐥 𝐚𝐫𝐜𝐡ι𝐯𝐨 𝐬𝐞 𝐞𝐬𝐭𝐚́\n`;
            caption += `┃ 𝐞𝐧𝐯𝐢𝐚𝐧𝐝𝐨, 𝐞𝐬𝐩𝐞𝐫𝐚 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

            if (banner) {
                await socket.sendMessage(remoteJid, { image: { url: banner }, caption }, { quoted: message });
            } else {
                await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });
            }

            // Enviar archivo APK como documento desde la caché local
            await socket.sendMessage(remoteJid, {
                document: { url: cachePath },
                mimetype: 'application/vnd.android.package-archive',
                fileName: `${(name || 'App').replace(/[<>:"/\\|?*]/g, '')}.apk`
            }, { quoted: message });

            await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });

        } catch (error) {
            console.error('Error en APK Downloader:', error);
            
            // Eliminar archivo corrupto si falló la descarga
            if (cachePath && fs.existsSync(cachePath) && !isCacheHit) {
                try {
                    fs.unlinkSync(cachePath);
                    console.log(`[APK CACHE] [CLEANUP] Eliminado archivo corrupto o incompleto: ${cachePath}`);
                } catch (err) {
                    console.error('[APK CACHE] Error al limpiar archivo corrupto:', err);
                }
            }

            await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await socket.sendMessage(remoteJid, { 
                text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || 'Ocurrió un error inesperado.'}\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` 
            }, { quoted: message });
        }
    }
};
