import axios from 'axios';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { downloadStreamToFile, ensureDirectory } from './downloadUtils.js';

const tempDir = path.resolve('./tmp/reactions');
ensureDirectory(tempDir);

export const ALLOWED_REACTIONS = new Set([
    // ── nekos.best ───────────────────────────────────────────────────────────
    'angry', 'baka', 'bite', 'bleh', 'blowkiss', 'blush', 'bonk', 'bored', 'carry', 'clap',
    'confused', 'cry', 'cuddle', 'dance', 'facepalm', 'feed', 'handhold', 'handshake',
    'happy', 'highfive', 'hug', 'kabedon', 'kick', 'kiss', 'lappillow', 'laugh', 'lurk',
    'nod', 'nom', 'nope', 'nya', 'pat', 'peck', 'poke', 'pout', 'punch', 'run',
    'salute', 'shake', 'shoot', 'shocked', 'shrug', 'sip', 'slap', 'sleep', 'smile',
    'smug', 'spin', 'stare', 'tableflip', 'teehee', 'think', 'thumbsup', 'tickle',
    'wag', 'wave', 'wink', 'yawn', 'yeet',
    // ── Alyacore (extras) ───────────────────────────────────────────────────
    'bath', 'bully', 'call', 'coffee', 'cold', 'comfort', 'cringe', 'curious',
    'dramatic', 'draw', 'drunk', 'eat', 'gaming', 'heat', 'impregnate', 'jump',
    'kill', 'kisscheek', 'lick', 'love', 'peek', 'push', 'sad', 'scared',
    'scream', 'seduce', 'shy', 'sing', 'smoke', 'sniff', 'snuggle', 'spit',
    'step', 'thinkhard', 'trip', 'walk'
]);

/**
 * Obtiene una URL de video (reacción) aleatoria.
 * Corre nekos.best y Alyacore en paralelo — gana la que responda primero.
 * @param {string} type Tipo de reacción (hug, kiss, slap, pat, bite, etc.)
 * @returns {Promise<string>} URL del video (.mp4)
 */
export async function getReactionUrl(type) {
    const reactionType = type?.toLowerCase().trim();
    if (!ALLOWED_REACTIONS.has(reactionType)) {
        throw new Error(`La reacción "${type}" no está soportada.`);
    }

    const apis = [
        // API 1: nekos.best
        (async () => {
            const res = await axios.get(`https://nekos.best/api/v2/${reactionType}`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'AuraReedBot/2.2.0 (https://github.com/this-xys/baileys)'
                }
            });
            const url = res.data?.results?.[0]?.url;
            if (!url) throw new Error('nekos.best no devolvió URL');
            console.log(`[Reactions] Ganador: nekos.best`);
            return url;
        })(),
        // API 2: Alyacore
        (async () => {
            const key = global.Apis?.apiAiya?.apikey || 'oboe';
            const res = await axios.get(`https://api.alyacore.xyz/sfw/interaction?inter=${reactionType}&key=${key}`, {
                timeout: 10000,
                headers: {
                    'User-Agent': 'AuraReedBot/2.2.0 (https://github.com/this-xys/baileys)'
                }
            });
            const url = res.data?.result;
            if (!url || res.data?.status !== true) throw new Error('Alyacore no devolvió URL');
            console.log(`[Reactions] Ganador: Alyacore`);
            return url;
        })()
    ];

    try {
        return await Promise.any(apis);
    } catch (e) {
        console.error(`[Reactions] Todas las APIs fallaron para "${reactionType}":`, e.message);
        throw new Error('No se pudo obtener la reacción. Intenta de nuevo.');
    }
}

/**
 * Descarga y cachea el video de la reacción en disco.
 * @param {string} videoUrl URL del video original
 * @returns {Promise<string>} Ruta local del archivo descargado
 */
export async function getReactionPath(videoUrl) {
    if (!videoUrl) throw new Error('URL de reacción inválida.');

    const hash = crypto.createHash('md5').update(videoUrl).digest('hex');
    const ext = path.extname(new URL(videoUrl).pathname) || '.mp4';
    const localPath = path.join(tempDir, `${hash}${ext}`);

    if (fs.existsSync(localPath)) {
        console.log(`[Reactions Caché] Carga instantánea para: ${hash}`);
        return localPath;
    }

    console.log(`[Reactions Descarga] Descargando nuevo video: ${videoUrl}`);
    await downloadStreamToFile(videoUrl, localPath, { timeout: 20000 });
    return localPath;
}

/**
 * Función todo-en-uno: obtiene la reacción, la cachea y devuelve el buffer original
 * para ser reproducido en bucle (tipo GIF) en WhatsApp.
 *
 * @param {string} type Tipo de reacción (hug, kiss, slap, pat, etc.)
 * @returns {Promise<{ video: Buffer, mimetype: 'video/mp4', gifPlayback: true }>}
 */
export async function getReactionGif(type) {
    const videoUrl  = await getReactionUrl(type);
    const localPath = await getReactionPath(videoUrl);
    const buffer    = await fs.promises.readFile(localPath);
    return { video: buffer, mimetype: 'video/mp4', gifPlayback: true };
}
