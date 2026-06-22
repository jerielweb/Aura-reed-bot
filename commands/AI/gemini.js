import { fytBold } from './../../models/TextStyle.js';

export default {
    name: ['gemini', 'gia', 'gai', 'genai'],
    description: 'Habla con gemini',
    category: 'AI',

    execute: async (sock, message, args, { prefix }) => {
        const remotxeJid = message.key.remoteJid;
        const prompt = typeof args === 'string' ? args : (Array.isArray(args) ? args.join(' ') : '');

        if (!prompt) {
            let text = `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n`
            text += `┃ ${fytBold('FALTA MENSAJE')}\n`
            text += `╰━━━━━━━━━━━━⬣\n\n`
            text += `┃ > Debes escribir un mensaje para\n`
            text += `┃ > que Gemini pueda responderte.\n\n`
            text += `╰〔 ⚡ ${fytBold('SYSTEM INFO')} 〕⬣`

            return sock.sendMessage(message.key.remoteJid, { text }, { quoted: message });
        }

        await sock.sendMessage(message.key.remoteJid, { react: { text: '🤖', key: message.key } });

        try {
            await sock.sendPresenceUpdate('composing', remotxeJid);

            // Hacemos la petición a la API externa pasando el texto y la clave
            const url = `https://api.alyacore.xyz/ai/gemini?text=${encodeURIComponent(prompt)}&key=oboe`;
            const res = await fetch(url);
            const data = await res.json();

            if (!data.status || !data.response) {
                throw new Error('La API externa no devolvió una respuesta válida.');
            }

            const textResponse = data.response;

            let resultText = `╭〔 🤖 ${fytBold('GEMINI AI')} 〕⬣\n\n`
            resultText += `${textResponse}\n\n`
            resultText += `╰〔 ⚡ ${fytBold('SYSTEM AI')} 〕⬣`

            await sock.sendPresenceUpdate('paused', remotxeJid);
            return sock.sendMessage(message.key.remoteJid, { text: resultText }, { quoted: message });

        } catch (error) {
            console.error('Error al generar respuesta de Gemini:', error);
            await sock.sendPresenceUpdate('paused', remotxeJid);
            return sock.sendMessage(message.key.remoteJid, { text:  `❌ ${fytBold('ERROR AL OBTENER RESPUESTA')}❌\n\n> ${error.message || error}` }, { quoted: message });
        }
    }
}