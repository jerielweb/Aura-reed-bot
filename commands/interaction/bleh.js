import { getReactionGif } from '../../controllers/interactionsUtils.js';
import { resolveLidToRealJid } from '../../models/utils.js';
import { fytBold } from '../../models/TextStyle.js';

export default {
    name: ['bleh'],
    category: 'interaction',
    description: 'Envía una reacción "bleh" en formato GIF.',
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
            const { image, mimetype } = await getReactionGif('bleh');
            
            const senderTag = '@' + jidRemitente.split('@')[0];
            const mentions = [jidRemitente];
            let caption = '';

            if (targetJid && targetJid !== jidRemitente) {
                const targetTag = '@' + targetJid.split('@')[0];
                mentions.push(targetJid);
                caption = senderTag + ' ' + fytBold('le hace bleh a') + ' ' + targetTag;
            } else {
                caption = senderTag + ' ' + fytBold('dice ¡bleh! 😜');
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