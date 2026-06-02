import {fytBold} from './../../models/TextStyle.js'

export default {
    name: ['welcome', 'bienvenida', 'setwelcome'],
    category: 'group',
    description: 'Activa o desactiva los mensajes de bienvenida.',
    adminOnly: true,
    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;

        if (!remoteJid.endsWith('@g.us')) {

            // Plantilla del mensaje para que sea más atractivo visualmente
                let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
                text += `┃ ${fytBold('ACCIÓN INCOMPATIBLE')} \n`;
                text += `╰━━━━━━━━━━━━⬣\n\n`;
                text += `┃ > Este comando solo funciona en grupos.\n\n`;
                text += `╰〔 ⚡${fytBold('SYSTEM ALERT')} 〕⬣`;

            // Enviar mensaje de error
            return await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        if (!db.groups[remoteJid]) {
            db.groups[remoteJid] = { antilink: false, welcome: false, warnLimit: 3, warns: {}, activity: {}, botOn: true };
        }

        const status = args[0]?.toLowerCase();

        if (status === 'on' || status === '1' || status === 'true' || status === 'activar' || status === 'enable') {
            db.groups[remoteJid].welcome = true;
            saveDB(db);

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ✅ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ 👋 ${fytBold('SISTEMA DE BIENVENIDA')}\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > La bienvenida ha sido\n`;
            text += `┃ > activada con éxito.\n\n`;
            text += `╰〔 ⚡${fytBold('SYSTEM INFO')} 〕⬣`;

            // Enviar mensaje de éxito
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else if (status === 'off' || status === '0' || status === 'false' || status === 'desactivar' || status === 'disable') {
            db.groups[remoteJid].welcome = false;
            saveDB(db);

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ 👋 ${fytBold('SISTEMA DE BIENVENIDA')}\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > La bienvenida ha sido\n`;
            text += `┃ > desactivada con éxito.\n\n`;
            text += `╰〔 ⚡${fytBold('SYSTEM ACTIVE')} 〕⬣`;

            // Enviar mensaje de éxito
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else {
            const currentStatus = db.groups[remoteJid]?.welcome ? '✅ Activado' : '❌ Desactivado';

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 👋 ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ⚙️ ${fytBold('SISTEMA DE BIENVENIDA')}\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ℹ️ Estado actual: ${currentStatus}\n\n`;
            text += `┣━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ➪ .welcome on\n`;
            text += `┃ ✦ Activar bienvenida\n\n`;
            text += `┃ ➪ .welcome off\n`;
            text += `┃ ✦ Desactivar bienvenida\n\n`;
            text += `╰〔 ⚡${fytBold('SYSTEM INFO')} 〕⬣`;

            // Enviar mensaje de estado
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }
    }
};
