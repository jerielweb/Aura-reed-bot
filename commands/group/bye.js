import { fytBold } from "../../models/TextStyle.js";

export default {
    name: ['bye', 'saybye', 'despedida'],
    description: 'Activa o desactiva las despedidas automatitas.',
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
            db.groups[remoteJid] = { antilink: false, welcome: false, bye: true, warnLimit: 3, warns: {}, activity: {}, botOn: true };
        }
        const status = args[0]?.toLowerCase();

        if (status === 'on' || status === '1' || status === 'true' || status === 'activar' || status === 'enable') {
            db.groups[remoteJid].bye = true;
            saveDB(db);

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ✅ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ 👋 ${fytBold('SISTEMA DE DESPEDIDA')}\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > La despedida ha sido\n`;
            text += `┃ > activada con éxito.\n\n`;
            text += `╰〔 ⚡${fytBold('SYSTEM INFO')} 〕⬣`;

            // Enviar mensaje de éxito
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else if (status === 'off' || status === '0' || status === 'false' || status === 'desactivar' || status === 'disable') {
            db.groups[remoteJid].bye = false;
            saveDB(db);

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ 👋 ${fytBold('SISTEMA DE DESPEDIDA')}\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > La despedida ha sido\n`;
            text += `┃ > desactivada con éxito.\n\n`;
            text += `╰〔 ⚡${fytBold('SYSTEM ACTIVE')} 〕⬣`;

            // Enviar mensaje de éxito
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else {
            const currentStatus = db.groups[remoteJid]?.bye ? '✅ Activado' : '❌ Desactivado';

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 👋 ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ⚙️ ${fytBold('SISTEMA DE DESPEDIDA')}\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ℹ️ Estado actual: ${currentStatus}\n\n`;
            text += `┣━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ➪ .bye on\n`;
            text += `┃ ✦ Activar despedida\n\n`;
            text += `┃ ➪ .bye off\n`;
            text += `┃ ✦ Desactivar despedida\n\n`;
            text += `╰〔 ⚡${fytBold('SYSTEM INFO')} 〕⬣`;

            // Enviar mensaje de estado
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }
    }
}