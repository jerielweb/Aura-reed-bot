import { fytBold } from './../../models/TextStyle.js';

export default {
    name: ['8bal', '8ball', '8bola'],
    category: 'fun',
    description: 'Responde una pregunta estilo bola 8 (8-ball).',
    async execute(sock, m, args, { prefix, remoteJid }) {
        const targetJid = remoteJid || (m && m.key && m.key.remoteJid) || (m && m.chat);
        const pregunta = (args || []).join(' ').trim();

        if (!pregunta) {
            const uso = prefix ? `${prefix}8bal <pregunta>` : `8bal <pregunta>`;

            let text = `╭〔 ⚠️ ${fytBold('FALTA PREGUNTA')} 〕⬣\n\n`;
            text += `┃ > Debes escribir una pregunta para que la bola 8 pueda responder.\n`;
            text += `┃ > Uso: *${uso}*\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM INFO')} 〕⬣`;

            return await sock.sendMessage(targetJid, { text: `⚠️ Uso: ${uso}` }, { quoted: m });
        }

        const respuestas = [
            'Definitivamente sí.',
            'Sin duda.',
            'Puedes confiar en ello.',
            'Es probable.',
            'Pregunta de nuevo más tarde.',
            'Mejor no decirte ahora.',
            'No puedo predecirlo ahora.',
            'Concéntrate y pregunta otra vez.',
            'No cuentes con ello.',
            'Mi respuesta es no.',
            'Muy dudoso.',
            'Las señales apuntan a que sí.',
            'Las probabilidades son buenas.',
            'Respuesta confusa — inténtalo otra vez.',
            '¡Por supuesto!'
        ];

        const respuesta = respuestas[Math.floor(Math.random() * respuestas.length)];

        let texto = `╭〔 🎱 ${fytBold('BOLA 8')} 〕⬣\n\n`;
        texto += `┃ ${fytBold('Pregunta:')} ${pregunta}\n`;
        texto += `┃ ${fytBold('Respuesta:')} ${respuesta}\n\n`;
        texto += `╰〔 ⚡ ${fytBold('FUN')} 〕⬣`;

        await sock.sendMessage(targetJid, { text: texto }, { quoted: m });
    }
};