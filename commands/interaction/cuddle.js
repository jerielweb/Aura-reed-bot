import { getReactionGif } from '../../controllers/interactionsUtils.js';
import { resolveLidToRealJid } from '../../models/utils.js';
import { fytBold } from '../../models/TextStyle.js';

export default {
    name: ['cuddle', 'acurrucarse', 'acurrucar', 'mimar', 'mimos', 'mimitos'],
    category: 'interaction',
    description: 'Acurrucarse',
    async execute(sock, m, args, { prefix, jidRemitente }) {
        const remoteJid = m.key.remoteJid;
        const ctx = m.message?.extendedTextMessage?.contextInfo;

        let targetJid = null;
        if (ctx?.mentionedJid?.length > 0) {
            targetJid = ctx.mentionedJid[0];
        } else if (ctx?.participant) {
            targetJid = ctx.participant;
        }
        if (targetJid) {
            targetJid = await resolveLidToRealJid(targetJid, sock, remoteJid);
        }

        try {
            // { video, mimetype, gifPlayback } — Baileys necesita 'video' para reproducir como GIF animado
            const gifData = await getReactionGif('cuddle');

            const senderTag = '@' + jidRemitente.split('@')[0];
            const mentions = [jidRemitente];
            let caption;

            if (targetJid && targetJid !== jidRemitente) {
                mentions.push(targetJid);
                caption = senderTag + ' ' + fytBold('se acurruca con') + ' @' + targetJid.split('@')[0];
            } else {
                caption = senderTag + ' ' + fytBold('quiere acurrucarse 🥺');
            }

            await sock.sendMessage(remoteJid, {
                ...gifData,
                caption,
                mentions
            }, { quoted: m });
        } catch (e) {
            console.error('[Interacciones Error]:', e.message);
            await sock.sendMessage(remoteJid, {
                text: '❌ Hubo un error al intentar enviar la reacción.'
            }, { quoted: m });
        }
    }
};