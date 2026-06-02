import { fytBold } from "../../models/TextStyle.js";

export default {
    name: ['topactivos', 'activos'],
    category: 'group',
    description: 'Usuarios activos.',
    adminOnly: true,
    execute: async (socket, message, args, { db }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us'))

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('ACCION INCONPATIBLE')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Este comando solo funciona en grupos.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

            // Enviar mensaje de error
            return socket.sendMessage(remoteJid, { text }, { quoted: message });

        const groupMetadata = await socket.groupMetadata(remoteJid);
        const participants = groupMetadata.participants || [];
        const participantBaseMap = new Map();
        const participantJids = [];

        participants.forEach(p => {
            const jid = p?.id;
            const base = jid?.split('@')[0]?.split(':')[0];
            if (base && jid) {
                participantBaseMap.set(base, jid);
                participantJids.push(jid);
            }
        });

        const activity = db.groups?.[remoteJid]?.activity || {};
        const monthKey = new Date().toISOString().slice(0, 7);
        const monthlyActivity = activity[monthKey] && typeof activity[monthKey] === 'object' ? activity[monthKey] : activity;

        const counts = {};
        Object.entries(monthlyActivity).forEach(([key, value]) => {
            const base = key?.split('@')[0]?.split(':')[0];
            if (!base) return;
            const resolved = participantBaseMap.get(base) || (key.endsWith('@s.whatsapp.net') ? `${base}@s.whatsapp.net` : null);
            if (!resolved || !participantBaseMap.has(base)) return;
            counts[resolved] = (counts[resolved] || 0) + Number(value || 0);
        });

        const users = Object.entries(counts)
            .map(([id, count]) => ({ id, count }))
            .sort((a, b) => b.count - a.count);

        if (users.length === 0) {
            return socket.sendMessage(remoteJid, { text: 'Aún no hay suficiente actividad registrada en este mes.' }, { quoted: message });
        }

        let pageSize = 10;
        let page = 1;

        if (args.length === 1) {
            const arg = parseInt(args[0], 10);
            if (arg > 20) {
                pageSize = Math.min(Math.max(arg, 1), 50);
            } else if (arg > 0) {
                page = arg;
            }
        } else if (args.length >= 2) {
            pageSize = Math.min(Math.max(parseInt(args[0], 10) || 10, 1), 50);
            page = Math.max(parseInt(args[1], 10) || 1, 1);
        }

        const totalPages = Math.max(Math.ceil(users.length / pageSize), 1);
        const currentPage = Math.min(page, totalPages);
        const startIndex = (currentPage - 1) * pageSize;
        const pageUsers = users.slice(startIndex, startIndex + pageSize);

        // Plantilla del mensaje para que sea más atractivo visualmente
        let text = `╭〔 🔥 ${fytBold('ADMIN SYSTEM')} 〕⬣\n`;
        text += `┃ 📈 𝐔𝐒𝐔𝐀𝐑𝐈𝐎𝐒 𝐀𝐂𝐓𝐈𝐕𝐎𝐒\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ ⚡ ${fytBold('Usuarios que')}\n`;
        text += `┃ ⚡ ${fytBold('si participan')}\n\n`;
        text += `┣━━━━━━━━━━━━⬣\n\n`;

        const mentions = [];
        pageUsers.forEach((u, i) => {
            const rank = startIndex + i + 1;
            let emoji = '➪';
            if (rank === 1) emoji = '🥇';
            else if (rank === 2) emoji = '🥈';
            else if (rank === 3) emoji = '🥉';

            text += `┃ ${emoji} @${u.id.split('@')[0]}\n`;
            mentions.push(u.id);
        });

        text += `\n╰〔 ⚡ ${fytBold('SYSTEM ACTIVE')}〕⬣`;

        // Enviar mensaje con menciones a los usuarios activos
        await socket.sendMessage(remoteJid, { text, mentions }, { quoted: message });
    }
};
