import { downloadMediaMessage } from '@whiskeysockets/baileys';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from '@ffmpeg-installer/ffmpeg';
import ffprobePath from '@ffprobe-installer/ffprobe';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fytBold } from '../../models/TextStyle.js';

ffmpeg.setFfmpegPath(ffmpegPath.path);
ffmpeg.setFfprobePath(ffprobePath.path);

async function convertWebpToGif(buffer) {
    const tempId = Date.now();
    const tempIn = path.join(os.tmpdir(), `aura-webp-${tempId}.webp`);
    const tempOut = path.join(os.tmpdir(), `aura-webp-${tempId}.gif`);

    await fs.promises.writeFile(tempIn, buffer);

    await new Promise((resolve, reject) => {
        ffmpeg(tempIn)
            .outputOptions(['-y', '-filter_complex', 'fps=15', '-loop', '0'])
            .toFormat('gif')
            .save(tempOut)
            .on('error', reject)
            .on('end', resolve);
    });

    const gifBuffer = await fs.promises.readFile(tempOut);
    await fs.promises.unlink(tempIn).catch(() => {});
    await fs.promises.unlink(tempOut).catch(() => {});
    return gifBuffer;
}

export default {
    name: ['toimg', 'img', 'toimage'],
    category: 'utils',
    description: 'Extrae un sticker o gif view-once y lo convierte en imagen.',
    execute: async (socket, message, args, { prefix }) => {
        const remoteJid = message.key.remoteJid;
        const contextInfo = message.message?.extendedTextMessage?.contextInfo;
        const quotedMsg = contextInfo?.quotedMessage;

        if (!quotedMsg) {
            return await socket.sendMessage(remoteJid, {
                text: `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n┃ ❌ ${fytBold('FALTA MENSAJE CITADO')}\n╰━━━━━━━━━━━━⬣\n\n┃ > Responde al sticker o gif de visualización única con *${prefix}toimg*.`
            }, { quoted: message });
        }

        function unwrapMessage(msg) {
            if (!msg) return null;
            if (msg.stickerMessage || msg.imageMessage || msg.documentMessage) return msg;
            if (msg.viewOnceMessageV2?.message) return unwrapMessage(msg.viewOnceMessageV2.message);
            if (msg.viewOnceMessage?.message) return unwrapMessage(msg.viewOnceMessage.message);
            if (msg.documentWithCaptionMessage?.message) return unwrapMessage(msg.documentWithCaptionMessage.message);
            return null;
        }

        const target = unwrapMessage(quotedMsg);
        if (!target || (!target.stickerMessage && !target.imageMessage && !target.documentMessage)) {
            return await socket.sendMessage(remoteJid, {
                text: `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n┃ ❌ ${fytBold('NO HAY MEDIO VÁLIDO')}\n╰━━━━━━━━━━━━⬣\n\n┃ > El mensaje citado debe ser un sticker o un gif.`
            }, { quoted: message });
        }

        await socket.sendMessage(remoteJid, { react: { text: '⏳', key: message.key } });

        try {
            const downloadMsg = { key: message.key, message: target };
            const buffer = await downloadMediaMessage(downloadMsg, 'buffer', {}, { logger: console });
            if (!buffer || buffer.length === 0) throw new Error('No se pudo descargar el contenido multimedia.');

            const quotedKey = {
                remoteJid,
                id: contextInfo?.stanzaId || message.key.id,
                participant: contextInfo?.participant || undefined
            };
            const quotedObject = { key: quotedKey, message: quotedMsg };

            if (target.stickerMessage || (target.documentMessage && target.documentMessage.mimetype === 'image/webp')) {
                const isAnimated = target.stickerMessage?.isAnimated || (target.documentMessage && target.documentMessage.mimetype === 'image/webp' && target.documentMessage.url?.includes('animated'));

                if (isAnimated) {
                    const gifBuffer = await convertWebpToGif(buffer);
                    await socket.sendMessage(remoteJid, {
                        image: gifBuffer,
                        mimetype: 'image/gif',
                        caption: ` ${fytBold('Aqui tienes mi compa')}`
                    }, { quoted: quotedObject });
                } else {
                    const pngBuffer = await sharp(buffer).png().toBuffer();
                    await socket.sendMessage(remoteJid, {
                        image: pngBuffer,
                        caption: ` ${fytBold('Aqui tienes mi compa')}`
                    }, { quoted: quotedObject });
                }
            } else if (target.imageMessage) {
                await socket.sendMessage(remoteJid, {
                    image: buffer,
                    caption: ` ${fytBold('Aqui tienes mi compa')}`
                }, { quoted: quotedObject });
            } else if (target.documentMessage && target.documentMessage.mimetype === 'image/gif') {
                await socket.sendMessage(remoteJid, {
                    image: buffer,
                    mimetype: 'image/gif',
                    caption: ` ${fytBold('Aqui tienes mi compa')}`
                }, { quoted: quotedObject });
            } else {
                throw new Error('Tipo de medio no soportado. Solo stickers o gifs.');
            }

            await socket.sendMessage(remoteJid, { react: { text: '✅', key: message.key } });

        } catch (error) {
            console.error('[toimg] Error:', error);
            await socket.sendMessage(remoteJid, { react: { text: '❌', key: message.key } });
            await socket.sendMessage(remoteJid, {
                text: `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n┃ ⚠️ ${fytBold('ERROR AL CONVERTIR')}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || 'No pude convertir el medio.'}`
            }, { quoted: message });
        }
    }
};