import axios from 'axios';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const token = process.env.AUDD_API_TOKEN || global.apiShazam?.apikey || '257b4fe430651b5c9fbaa9d5203531f8';

export default {
    name: ['shazam', 'whatsong', 'audd', 'find'],
    category: 'search',
    description: 'Identifica una canción desde un audio o video citado. Usa: responde con .shazam',
    execute: async (socket, message, args, { prefix }) => {
        const remoteJid = message.key.remoteJid;

        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = contextInfo?.quotedMessage;

        if (!quotedMsg) {
            return await socket.sendMessage(remoteJid, { text: `❗ Responde a un mensaje de voz/video con ${prefix}shazam para identificar la canción.` }, { quoted: message });
        }

        // Desempaquetar posibles wrappers
        function unwrapMessage(msg) {
            if (!msg) return null;
            if (msg.audioMessage || msg.videoMessage || msg.documentMessage) return msg;
            if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);
            if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);
            return null;
        }

        const target = unwrapMessage(quotedMsg);
        if (!target) {
            return await socket.sendMessage(remoteJid, { text: `❗ El mensaje citado no contiene audio o video válido.` }, { quoted: message });
        }

        await socket.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        try {
            // Descargar media
            const downloadMsg = { key: message.key, message: target };
            const buffer = await downloadMediaMessage(downloadMsg, 'buffer', {}, { logger: console });

            if (!buffer || buffer.length === 0) throw new Error('No se pudo descargar el media.');

            // Límite y recorte
            const MAX_BYTES = 6 * 1024 * 1024; // 6 MB max
            const MAX_SECONDS = 30; // 30s máximo

            // Determinar extensión
            const isVideo = Boolean(target.videoMessage);
            const ext = isVideo ? 'mp4' : 'mp3';

            const tempIn = `./tmp/shazam_in_${Date.now()}.${ext}`;
            const tempOut = `./tmp/shazam_out_${Date.now()}.${ext}`;

            // Asegurar carpeta tmp
            try { await fs.promises.mkdir('./tmp', { recursive: true }); } catch (e) { /* ignore */ }

            await fs.promises.writeFile(tempIn, buffer);

            // Función para recortar a MAX_SECONDS
            const trimTo = (inPath, outPath, seconds) => new Promise((resolve, reject) => {
                ffmpeg(inPath)
                    .outputOptions(['-t ' + seconds])
                    .on('error', err => reject(err))
                    .on('end', () => resolve())
                    .save(outPath);
            });

            // Siempre intentamos recortar a 30s para evitar payloads enormes
            try {
                await trimTo(tempIn, tempOut, MAX_SECONDS);
            } catch (e) {
                // Si falla el recorte, fallback a usar el archivo original
                console.log('[shazam] ffmpeg trim failed, usando original:', e?.message || e);
                await fs.promises.copyFile(tempIn, tempOut);
            }

            let outBuffer = await fs.promises.readFile(tempOut);

            // Si sigue siendo demasiado grande, rechazar
            if (outBuffer.length > MAX_BYTES) {
                // limpiar
                try { await fs.promises.unlink(tempIn); } catch (e) {}
                try { await fs.promises.unlink(tempOut); } catch (e) {}
                await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
                return await socket.sendMessage(remoteJid, { text: `❌ El archivo sigue siendo demasiado grande (${Math.round(outBuffer.length/1024/1024)} MB). Máx ${Math.round(MAX_BYTES/1024/1024)} MB después de recortar.` }, { quoted: message });
            }

            // Preparar base64
            const base64 = outBuffer.toString('base64');
            const params = new URLSearchParams();
            params.append('api_token', token);
            params.append('audio', base64);
            params.append('return', 'spotify,apple_music');

            const res = await axios.post('https://api.audd.io/', params.toString(), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 30000
            });

            const data = res.data;
            if (!data?.result) {
                await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
                return await socket.sendMessage(remoteJid, { text: '❌ No se pudo identificar la canción.' }, { quoted: message });
            }

            const r = data.result;
            const title = r.title || 'Desconocido';
            const artist = r.artist || 'Desconocido';
            const album = r.album || 'Desconocido';
            const release = r.release_date || '';
            const genres = (r.apple_music?.genreNames || []).join(', ') || 'Desconocido';

            // Extraer links desde la respuesta
            const spotifyUrl = r.spotify?.external_urls?.spotify || null;
            const appleUrl = r.apple_music?.url || null;
            const otherLinks = r.song_link || null;

            // Extraer imagen: preferencia Spotify -> Apple Music
            let image = null;
            if (r.spotify?.album?.images && r.spotify.album.images.length) {
                image = r.spotify.album.images[0].url;
            }
            if (!image && r.apple_music?.artwork?.url) {
                image = r.apple_music.artwork.url.replace('{w}x{h}', '800x800');
            }

            // Construir caption con plantilla solicitada
            let text = `╭〔 🔍 𝐒𝐇𝐀𝐙𝐀𝐌 𝐑𝐄𝐒𝐔𝐋𝐓 〕━⬣\n\n`;
            text += `┃ ➥ ${title}\n\n`;
            text += `┃ > Artista › ${artist}\n`;
            text += `┃ > Álbum › ${album}${release ? ` - ${release}` : ''}\n`;
            text += `┃ > Género › ${genres}\n\n`;
            text += `┣━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Escúchala completa aquí:\n`;
            text += `┃ > ▶️ Spotify: ${spotifyUrl || 'No disponible'}\n`;
            text += `┃ > 🍎 Apple Music: ${appleUrl || 'No disponible'}\n`;
            text += `┃ > ▶️ Mas Apps: ${otherLinks || 'No disponible'}\n\n`;
            text += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

            // Enviar resultado con imagen
            if (image) {
                await socket.sendMessage(remoteJid, {
                    image: { url: image },
                    caption: text
                }, { quoted: message });
            } else {
                await socket.sendMessage(remoteJid, { text }, { quoted: message });
            }

            await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });

            // limpiar temporales
            try { await fs.promises.unlink(tempIn); } catch (e) {}
            try { await fs.promises.unlink(tempOut); } catch (e) {}

        } catch (err) {
            console.error('[shazam] Error:', err?.message || err);
            await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await socket.sendMessage(remoteJid, { text: `❌ Error al identificar: ${err.message || err}` }, { quoted: message });
        }
    }
};