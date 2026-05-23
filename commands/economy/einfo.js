import { getGroupUser } from '../../models/groupDb.js';

export default {
    name: ['einfo', 'economia'],
    category: 'economy',
    description: 'Muestra información sobre cómo funciona la economía del bot.',
    execute: async (socket, message, args, { db, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const user = getGroupUser(db, remoteJid, jidRemitente, {});

        const now = Date.now();
        
        // Definición de cooldowns (en milisegundos)
        const cooldowns = {
            work: 3 * 60 * 1000,      // 3 min
            daily: 24 * 60 * 60 * 1000, // 24 horas
            weekly: 7 * 24 * 60 * 60 * 1000, // 7 días
            monthly: 30 * 24 * 60 * 60 * 1000, // 30 días
            crime: 60 * 60 * 1000,      // 1 hora
            slut: 60 * 60 * 1000        // 1 hora
        };

        // Función auxiliar para calcular tiempo restante
        const getRemaining = (lastAction, duration) => {
            const expiration = (lastAction || 0) + duration;
            if (now >= expiration) return '✅ Disponible';
            
            const remaining = expiration - now;
            const hours = Math.floor(remaining / 3600000);
            const minutes = Math.floor((remaining % 3600000) / 60000);
            const seconds = Math.floor((remaining % 60000) / 1000);
            const days = Math.floor(hours / 24);

            let timeStr = '';
            if (days > 0) timeStr += `${days}d `;
            if (hours % 24 > 0) timeStr += `${hours % 24}h `;
            if (minutes > 0) timeStr += `${minutes}m `;
            timeStr += `${seconds}s`;
            return `⏳ _${timeStr}_`;
        };
        
        let text = `╭〔 ₡ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐄𝐂𝐎𝐍𝐎́𝐌𝐈𝐂𝐎 〕⬣\n`;
        text += `┃ ℹ️ 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐂𝐈𝐎́𝐍\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ Bienvenido al sistema de *AuraCoins* (₡).\n`;
        text += `┃ Gana, ahorra y gestiona tu fortuna.\n\n`;
        text += `┣━━〔 🛠️ 𝐂𝐎́𝐌𝐎 𝐆𝐀𝐍𝐀𝐑 〕━━⬣\n\n`;
        text += `┃ ➪ *.work:* ${getRemaining(user.lastWork, cooldowns.work)}\n`;
        text += `┃ ➪ *.daily:* ${getRemaining(user.lastDaily, cooldowns.daily)}\n`;
        text += `┃ ➪ *.weekly:* ${getRemaining(user.lastWeekly, cooldowns.weekly)}\n`;
        text += `┃ ➪ *.monthly:* ${getRemaining(user.lastMonthly, cooldowns.monthly)}\n`;
        text += `┃ ➪ *.crime:* ${getRemaining(user.lastCrime, cooldowns.crime)}\n`;
        text += `┃ ➪ *.slut:* ${getRemaining(user.lastSlut, cooldowns.slut)}\n\n`;
        text += `┣━━〔 🏦 𝐁𝐀𝐍𝐂𝐎 〕━━⬣\n\n`;
        text += `┃ Protege tus ₡ de los ladrones.\n`;
        text += `┃ ➪ *.dep [monto]:* Guardar en banco.\n`;
        text += `┃ ➪ *.with [monto]:* Sacar del banco.\n\n`;
        text += `┣━━〔 💳 𝐆𝐄𝐒𝐓𝐈𝐎́𝐍 〕━━⬣\n\n`;
        text += `┃ ➪ *.bal:* Tu balance actual.\n`;
        text += `┃ ➪ *.pay [monto] @user:* Transferir.\n`;
        text += `┃ ➪ *.steal @user:* Intentar robar.\n\n`;
        text += `╰━━〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕━━⬣`;

        await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
};
