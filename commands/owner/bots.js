import fs from 'fs';
import { countActiveSubBots, getMaxSubBots } from '../../models/subbotManager.js';

export default {
    name: ['bots', 'subbots', 'lista-bots'],
    category: 'owner',
    description: 'Muestra la lista de sub-bots activos/sesiones.',
    ownerOnly: false,

    execute: async (socket, message, args, {prefix}) => {
        const remoteJid = message.key.remoteJid;
        const sessionsDir = './sessions/subbots';

        if (!fs.existsSync(sessionsDir)) {
            let text = `╭〔 🔌 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ ⚠️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐒𝐔𝐁-𝐁𝐎𝐓𝐒\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > No se han encontrado\n`;
            text += `┃ > sesiones de sub-bots.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            return await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        const files = fs.readdirSync(sessionsDir);
        
        const activeCount = countActiveSubBots();
        const maxSubs = getMaxSubBots();

        let text = `╭〔 🔌 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
        text += `┃ 🤖 𝐒𝐔𝐁-𝐁𝐎𝐓𝐒 𝐀𝐂𝐓𝐈𝐕𝐎𝐒\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ 📊 𝐒𝐞𝐬𝐢𝐨𝐧𝐞𝐬: *${activeCount}/${maxSubs}*\n\n`;

        if (files.length === 0) {
            text += `┃ > No hay sesiones activas.\n\n`;
        } else {
            files.forEach((file, index) => {
                text += `┃ ${index + 1}. @${file}\n\n`;
            });
        }

        text += `> _Usa ${prefix}code o ${prefix}qr para tener tu sub-bot._\n\n`;
        text += `\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

        await socket.sendMessage(remoteJid, { text, mentions: files.map(f => f + '@s.whatsapp.net') }, { quoted: message });
    }
};
