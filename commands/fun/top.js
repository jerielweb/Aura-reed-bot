import { fytBold } from './../../models/TextStyle.js'

export default {
    name: ['top'],
    category: 'fun',
    description: 'Crea un top 10 aleatorio con un tema.',
    async execute(sock, m, args, { groupMetadata, remoteJid }) {
        const targetJid = remoteJid || (m && m.key && m.key.remoteJid) || (m && m.chat);
        if (!groupMetadata) {

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('ACCION INCONPATIBLE')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Este comando solo funciona en grupos.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

            // Enviar mensaje de error
            return await sock.sendMessage(targetJid, { text }, { quoted: m });
        }

        const tema = args.join(' ') || 'los más locos';

        const participantesValidos = (groupMetadata.participants || []).filter(p => p && p.id);


        const top10 = participantesValidos
            .sort(() => Math.random() - 0.5)
            .slice(0, 10);

        let mensaje = `╭〔 🏆 𝐓𝐎𝐏 𝟏𝟎: ${fytBold(`${tema.toUpperCase()}`)} 〕⬣\n\n`;
        top10.forEach((p, i) => {
            mensaje += `┃ ${i + 1}. @${p.id.split('@')[0]}\n`;
        });
        mensaje += `\n╰━━━━━━━━━━━━⬣`;

        const mentions = top10.map(p => p.id).filter(Boolean);
        await sock.sendMessage(targetJid, {
            text: mensaje,
            mentions
        }, { quoted: m });
    }
};