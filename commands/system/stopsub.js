import { stopSubBot } from '../../models/subbotManager.js';

export default {
    name: ['stopsub', 'logoutsub', 'detenersub'],
    category: 'system',
    description: 'Detiene y cierra la sesión de tu sub-bot.',
    execute: async (socket, message, args, { numeroReal, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const senderId = jidRemitente.split('@')[0].split(':')[0];

        await socket.sendMessage(remoteJid, { text: '🔄 Intentando detener tu sub-bot y cerrar la sesión...' }, { quoted: message });

        try {
            const success = await stopSubBot(senderId);
            if (success) {
                await socket.sendMessage(remoteJid, { text: '✅ Tu sub-bot ha sido detenido y la sesión ha sido eliminada correctamente.' }, { quoted: message });
            } else {
                await socket.sendMessage(remoteJid, { text: '⚠️ No se encontró una sesión activa de sub-bot para tu número.' }, { quoted: message });
            }
        } catch (error) {
            console.error('Error en comando stopsub:', error);
            await socket.sendMessage(remoteJid, { text: '❌ Ocurrió un error al intentar detener el sub-bot.' }, { quoted: message });
        }
    }
};
