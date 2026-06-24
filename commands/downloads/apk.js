import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

async function fetchJson(url) {
    const res = await fetch(url, {
        headers: {
            'Accept-Encoding': 'identity',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
    });
    if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
    return await res.json();
}

function normalize(apiResult, motorName) {
    // Verificamos la estructura real: apiResult.resultados debe ser un array con datos
    if (!apiResult || !apiResult.status || !Array.isArray(apiResult.resultados) || apiResult.resultados.length === 0) {
        throw new Error(`[${motorName}] No se encontraron resultados para esta aplicación`);
    }
    
    const data = apiResult.resultados[0]; // Tomamos el primer juego o app encontrado

    const name = data.titulo || 'Aplicación Desconocida';
    const packageId = data.appId || 'com.unknown';
    const size = data.tamaño || 'N/A';
    const lastUpdated = data.version || 'N/A'; // Usamos la versión ya que no trae fecha directa
    const banner = data.miniatura || null;
    const dl = data.dl;

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
    name: ['apk', 'apkdl', 'apkd', 'apks', 'apkdownload', 'androidapp', 'app'],
    category: 'downloads',
    description: 'Descarga archivos APK de Android desde Uptodown.',
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
            // Petición al endpoint real que enviaste
            const resData = await fetchJson(`https://fare.ink/search/uptodown?q=${encodeURIComponent(query)}&limit=1`);
            const metadata = normalize(resData, 'Uptodown');

            const { name, packageId, size, lastUpdated, banner, dl, motor } = metadata;

            if (!fs.existsSync(cacheDir)) {
                fs.mkdirSync(cacheDir, { recursive: true });
            }

            cachePath = path.join(cacheDir, `${packageId}.apk`);

            if (fs.existsSync(cachePath)) {
                console.log(`[APK CACHE] [HIT] Encontrado APK en caché local: ${cachePath}`);
                isCacheHit = true;
            } else {
                console.log(`[APK CACHE] [MISS] Descargando binario desde la API...`);

                const res = await fetch(dl, {
                    headers: {
                        'Accept-Encoding': 'identity',
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
                    }
                });
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
            caption += `┃ ➥ 𝐀𝐩𝐥𝐢𝐜𝐚𝐜𝐢𝐨́𝐧 › ${name}\n\n`;
            caption += `┃ > 𝐈𝐃 App › ${packageId}\n`;
            caption += `┃ > 𝐓𝐚𝐦𝐚𝐧̃𝐨 › ${size}\n`;
            caption += `┃ > 𝐕𝐞𝐫𝐬𝐢𝐨́𝐧 › ${lastUpdated}\n`;
            caption += `┃ > 𝐌𝐨𝐝𝐨 › Aplicación (APK)\n`;
            caption += `┃ > 𝐌𝐨𝐭𝐨𝐫 › ${motorLabel}\n\n`;
            caption += `┣━━━━━━━━━━━━⬣\n\n`;
            caption += `┃ > 𝐄𝐥 𝐚𝐫𝐜𝐡ι𝐯𝐨 𝐬𝐞 𝐞𝐬𝐭𝐚́\n`;
            caption += `┃ > 𝐞𝐧𝐯𝐢𝐚𝐧𝐝𝐨, 𝐞𝐬𝐩𝐞𝐫𝐚 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n\n`;
            caption += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

            if (banner) {
                await socket.sendMessage(remoteJid, { image: { url: banner }, caption }, { quoted: message });
            } else {
                await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });
            }

            await socket.sendMessage(remoteJid, {
                document: { url: cachePath },
                mimetype: 'application/vnd.android.package-archive',
                fileName: `${name.replace(/[<>:"/\\|?*]/g, '')}.apk`
            }, { quoted: message });

            await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });

        } catch (error) {
            console.error('Error en APK Downloader:', error);

            if (cachePath && fs.existsSync(cachePath) && !isCacheHit) {
                try {
                    fs.unlinkSync(cachePath);
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