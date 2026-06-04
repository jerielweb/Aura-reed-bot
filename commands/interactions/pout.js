import { getReactionGif } from '../../controllers/interactionsUtils.js';
import { resolveLidToRealJid } from '../../models/utils.js';
import { fytBold } from '../../models/TextStyle.js';

export default {
    name: ['pout'],
    category: 'interaction',
    description: 'Envía una reacción "pout" en formato GIF.',
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
            const { image, mimetype } = await getReactionGif('pout');
            
            const senderTag = '@' + jidRemitente.split('@')[0];
            const mentions = [jidRemitente];
            let caption = '';

            if (targetJid && targetJid !== jidRemitente) {
                const targetTag = '@' + targetJid.split('@')[0];
                mentions.push(targetJid);
                caption = senderTag + ' ' + fytBold('le hace puchero a') + ' ' + targetTag;
            } else {
                caption = senderTag + ' ' + fytBold('hace puchero 😤');
            }

            await sock.sendMessage(remoteJid, {
                image,
                mimetype,
                caption,
                mentions,
                gifPlayback: true
            }, { quoted: m });
        } catch (e) {
            console.error('[Interacciones Error]:', e);
            await sock.sendMessage(remoteJid, { 
                text: '❌ Hubo un error al intentar enviar la reacción.' 
            }, { quoted: m });
        }
    }
};