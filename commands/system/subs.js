import { createSubBot } from '../../models/subbotManager.js';
import fs from 'fs';
import path from 'path';

export default {
    name: ['code', 'qr'],
    category: 'system',
    description: 'Vincula un sub-bot usando código o QR.',
    execute: async (socket, message, args, { db, saveDB, numeroReal, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const sender = jidRemitente; // Usar el jid resuelto

        // Inicializar datos del usuario si no existen
        if (!db.users[sender]) {
            db.users[sender] = { Subs: 0 };
        }

        // 1. Cooldown de 2 minutos (120000 ms)
        let lastSub = db.users[sender].Subs || 0;
        let now = Date.now();
        if (now - lastSub < 120000) {
            let timeLeft = msToTime(120000 - (now - lastSub));
            return await socket.sendMessage(remoteJid, { text: `ꕥ Debes esperar *${timeLeft}* para volver a intentar vincular un sub-bot.` }, { quoted: message });
        }

        // 2. Límite de sub-bots (50)
        const sessionsDir = './sessions/subbots';
        if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
        
        const subsCount = fs.readdirSync(sessionsDir).filter(f => {
            return fs.existsSync(path.join(sessionsDir, f, 'creds.json'));
        }).length;

        const maxSubs = 50;
        if (subsCount >= maxSubs) {
            return await socket.sendMessage(remoteJid, { text: '✐ No se han encontrado espacios disponibles para registrar un `Sub-Bot`.' }, { quoted: message });
        }

        // Instrucciones
        const rtx = '`✤` Vincula tu *cuenta* usando el *codigo.*\n\n> ✥ Sigue las *instrucciones*\n\n*›* Click en los *3 puntos*\n*›* Toque *dispositivos vinculados*\n*›* Vincular *nuevo dispositivo*\n*›* Selecciona *Vincular con el número de teléfono*\n\nꕤ *`Importante`*\n> ₊·( 🜸 ) ➭ Este *Código* solo funciona en el *número que lo solicito*';
        const rtx2 = "`✤` Vincula tu *cuenta* usando *codigo qr.*\n\n> ✥ Sigue las *instrucciones*\n\n*›* Click en los *3 puntos*\n*›* Toque *dispositivos vinculados*\n*›* Vincular *nuevo dispositivo*\n*›* Escanea el código *QR.*\n\n> ₊·( 🜸 ) ➭ Recuerda que no es recomendable usar tu cuenta principal para registrar un socket.";

        const command = message.message?.conversation?.split(' ')[0].slice(1) || 
                        message.message?.extendedTextMessage?.text?.split(' ')[0].slice(1) || "";
        
        const isCode = command === 'code';
        const caption = isCode ? rtx : rtx2;

        await socket.sendMessage(remoteJid, { text: caption }, { quoted: message });

        // Actualizar cooldown
        db.users[sender].Subs = now;
        saveDB(db);

        try {
            if (isCode) {
                await createSubBot(socket, message, 'code', numeroReal);
            } else {
                await createSubBot(socket, message, 'qr');
            }
        } catch (error) {
            console.error('Error en comando subs:', error);
            await socket.sendMessage(remoteJid, { text: '❌ Ocurrió un error al procesar tu solicitud.' }, { quoted: message });
        }
    }
};

function msToTime(duration) {
    let seconds = Math.floor((duration / 1000) % 60);
    let minutes = Math.floor((duration / (1000 * 60)) % 60);
    let hours = Math.floor((duration / (1000 * 60 * 60)) % 24);

    hours = hours < 10 ? '0' + hours : hours;
    minutes = minutes > 0 ? minutes : '';
    seconds = seconds < 10 && minutes > 0 ? '0' + seconds : seconds;

    if (minutes) {
        return `${minutes} minuto${minutes > 1 ? 's' : ''}, ${seconds} segundo${seconds > 1 ? 's' : ''}`;
    } else {
        return `${seconds} segundo${seconds > 1 ? 's' : ''}`;
    }
}
