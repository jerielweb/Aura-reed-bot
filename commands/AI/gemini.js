import {GoogleGenAI} from '@google/genai';
import {fytBold} from './../../models/TextStyle.js';

const AI = new GoogleGenAI({apiKey: 'AQ.Ab8RN6L3YB7_1vtQH-G4BYMK4x-OFdMwrZkqgaKZj2_-n5IdZg'})


export default {
    name: ['gemini', 'gia', 'gai','genai'],
    description: 'Habla con gemini',
    category: 'AI',

    execute: async (sock, message, args, {prefix}) =>{
        const remotxeJid = message.key.remoteJid;
        const prompt = typeof args === 'string' ? args : (Array.isArray(args) ? args.join(' ') : '');

        if(!prompt) {
            let text = `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n`
            text += `┃ ${fytBold('FALTA MENSAJE')}\n`
            text += `╰━━━━━━━━━━━━⬣\n\n`
            text += `┃ > Debes escribir un mensaje para\n`
            text += `┃ > que Gemini pueda responderte.\n\n`
            text += `╰〔 ⚡ ${fytBold('SYSTEM INFO')} 〕⬣`

            return sock.sendMessage(message.key.remoteJid, {text}, {quoted: message});
        }

        await sock.sendMessage(message.key.remoteJid, { react: { text: '🤖', key: message.key } });
        try {
            await sock.sendPresenceUpdate('composing', remotxeJid);
             const response = await AI.models.generateContent({
                model: "gemini-3.1-flash-lite",
                contents: `${prompt}`,
            });
            const textResponse = response.text;


            let resultText = `╭〔 🤖 ${fytBold('GEMINI AI')} 〕⬣\n\n`
            resultText += `${textResponse}\n\n`
            resultText += `╰〔 ⚡ ${fytBold('SYSTEM AI')} 〕⬣`


            await sock.sendPresenceUpdate('paused', remotxeJid);
            return sock.sendMessage(message.key.remoteJid, {text: resultText}, {quoted: message});
        } catch (error) {
            console.error('Error al generar respuesta de Gemini:', error);
            return sock.sendMessage(message.key.remoteJid, {text: `❌ ${fytBold('ERROR AL OBTENER RESPUESTA')}❌\n\n> ${error}`}, {quoted: message});
        }
    }
}