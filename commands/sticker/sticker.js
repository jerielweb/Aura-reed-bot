import { downloadMediaMessage } from '@whiskeysockets/baileys';
import { fytBold } from '../../models/TextStyle.js';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import fs from 'fs';
import path from 'path';
import os from 'os';

ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

// Función robusta para desempaquetar y limpiar el mensaje multimedia
function unwrapMessage(msg) {
    if (!msg) return null;
    if (msg.imageMessage || msg.videoMessage || msg.documentMessage || msg.stickerMessage) {
        return msg;
    }
    if (msg.viewOnceMessageV2?.message) {
        return unwrapMessage(msg.viewOnceMessageV2.message);
    }
    if (msg.viewOnceMessage?.message) {
        return unwrapMessage(msg.viewOnceMessage.message);
    }
    if (msg.documentWithCaptionMessage?.message) {
        return unwrapMessage(msg.documentWithCaptionMessage.message);
    }
    return null;
}

// Convertidor unificado basado en FFMPEG (seguro y compatible al 100% en Windows)
async function convertToSticker(inputPath, outputPath, isVideo, attempt = 1) {
    return new Promise((resolve, reject) => {
        let fps = 12;
        let quality = 50;
        let duration = 15; // Límite de 15 segundos

        if (attempt === 2) {
            fps = 10;
            quality = 35;
            duration = 13;
        } else if (attempt >= 3) {
            fps = 8;
            quality = 20;
            duration = 11;
        }

        // 1. Opciones generales de salida (Separadas correctamente sin mezclar banderas)
        const options = [
            '-vcodec libwebp',
            '-an',
            '-vsync 0'
        ];

        if (isVideo) {
            options.push('-loop 0');
            options.push(`-t ${duration}`);
            options.push(`-q:v ${quality}`);
        } else {
            options.push('-q:v 80');
        }

        // 2. Definir la cadena de filtros de video exacta
        const filtroVideo = isVideo
            ? `format=rgba,scale=512:512:force_original_aspect_ratio=decrease,fps=${fps},pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x000000@0`
            : `format=rgba,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x000000@0`;

        // 3. Ejecutar FFmpeg usando .videoFilters() para evitar conflictos de argumentos
        ffmpeg(inputPath)
            .outputOptions(options)
            .videoFilters(filtroVideo) // <--- Esto soluciona el "Option not found"
            .toFormat('webp')
            .save(outputPath)
            .on('end', resolve)
            .on('error', reject);
    });
}

export default {
    name: ['s', 'sticker', 'stiker'],
    category: 'sticker',
    description: 'Convierte imágenes, videos o GIFs en stickers optimizados.',
    execute: async (socket, message, args, { prefix }) => {
        const remoteJid = message.key.remoteJid;

        // Determinar el mensaje multimedia objetivo (citado o directo)
        const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const targetMessage = quoted ? unwrapMessage(quoted) : unwrapMessage(message.message);

        if (!targetMessage) {
            return await socket.sendMessage(remoteJid, { 
                text: `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n┃ ❌ ${fytBold('FALTA MEDIO')}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, envía una imagen/video\n┃ > con la descripción *${prefix}s* o responde\n┃ > a una imagen/video con *${prefix}s*.\n\n╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣`
            }, { quoted: message });
        }

        await socket.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        const tempId = Date.now();
        const tempInPath = path.join(os.tmpdir(), `aura-sticker-in-${tempId}`);
        const tempOutPath = path.join(os.tmpdir(), `aura-sticker-out-${tempId}.webp`);

        try {
            // Descargar el contenido multimedia
            console.log('[Sticker] Descargando contenido multimedia...');
            const downloadMsg = { key: message.key, message: targetMessage };
            const buffer = await downloadMediaMessage(downloadMsg, 'buffer', {}, { logger: console });

            if (!buffer || buffer.length === 0) {
                throw new Error('No se pudo descargar el archivo o está vacío.');
            }

            console.log(`[Sticker] Archivo descargado con éxito. Tamaño: ${buffer.length} bytes`);

            // Escribir archivo temporal de entrada
            await fs.promises.writeFile(tempInPath, buffer);

            const isVideo = !!targetMessage.videoMessage || (targetMessage.documentMessage && targetMessage.documentMessage.mimetype?.startsWith('video/'));

            if (!isVideo) {
                console.log('[Sticker] Procesando imagen estática con ffmpeg...');
                await convertToSticker(tempInPath, tempOutPath, false);
            } else {
                console.log('[Sticker] Procesando video/GIF animado con ffmpeg...');

                let attempt = 1;
                let fileSize = Infinity;

                while (fileSize > 1000000 && attempt <= 3) {
                    if (fs.existsSync(tempOutPath)) {
                        await fs.promises.unlink(tempOutPath);
                    }

                    console.log(`[Sticker] Optimizando video, intento: ${attempt}...`);
                    await convertToSticker(tempInPath, tempOutPath, true, attempt);

                    fileSize = fs.statSync(tempOutPath).size;
                    console.log(`[Sticker] Tamaño final del archivo en intento ${attempt}: ${fileSize} bytes`);
                    attempt++;
                }

                if (fileSize > 1000000) {
                    throw new Error('El video es demasiado largo o pesado para un sticker animado. Intenta con uno de menos de 4 segundos.');
                }
            }

            // Leer sticker generado
            const stickerBuffer = await fs.promises.readFile(tempOutPath);

            // Obtener el nombre del usuario y formatear metadatos
            const pushName = message.pushName || 'Usuario';
            const packName = `${fytBold('AURA REED')} 🧠 ${fytBold('BOT')}`;
            const author = `@${pushName}`;

            console.log(`[Sticker] Inyectando metadatos para ${pushName}...`);
            let finalStickerBuffer;
            try {
                const { addStickerMetadata } = await import('../../controllers/stickerMetadata.js');
                finalStickerBuffer = await addStickerMetadata(stickerBuffer, packName, author);
            } catch (err) {
                console.error('[Sticker] Error al inyectar metadatos:', err);
                finalStickerBuffer = stickerBuffer;
            }

            // Enviar sticker
            await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });
            await socket.sendMessage(remoteJid, {
                sticker: finalStickerBuffer,
                mimetype: 'image/webp'
            }, { quoted: message });

        } catch (error) {
            console.error('Error al generar sticker:', error);
            await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await socket.sendMessage(remoteJid, {
                text: `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n┃ ⚠️ ${fytBold('ERROR AL CREAR STICKER')}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || 'No pude generar el sticker.'}\n\n╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣`
            }, { quoted: message });
        } finally {
            // Limpieza de archivos temporales
            try {
                if (fs.existsSync(tempInPath)) await fs.promises.unlink(tempInPath);
                if (fs.existsSync(tempOutPath)) await fs.promises.unlink(tempOutPath);
            } catch (err) {
                console.error('Error al limpiar archivos temporales de sticker:', err);
            }
        }
    }
};
