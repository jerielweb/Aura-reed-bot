import { Rstr } from './../../controllers/textBots.js';

export default {
    name: ['all', 'todos', 'invocar'],
    category: 'group',
    description: 'Menciona todos',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: Rstr.onlyGroup }, { quoted: message });

        const groupMetadata = await socket.groupMetadata(remoteJid);
        const participants = groupMetadata.participants || [];
        const memberJids = [...new Set(participants
            .map(p => p?.id)
            .filter(jid => typeof jid === 'string' && jid.endsWith('@s.whatsapp.net'))
        )];

        if (!memberJids.length) {
            return socket.sendMessage(remoteJid, { text: '⚠️ No se han encontrado participantes válidos en el grupo.' }, { quoted: message });
        }

        const totalMembers = memberJids.length;
        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || '𝐀𝐜𝐭𝐢́𝐯𝐞𝐧𝐬𝐞';
        const customMessage = args.join(' ') || quotedText;

        let text = `╭〔 📢 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
        text += `┃ 🔔 𝐋𝐋𝐀𝐌𝐀𝐍𝐃𝐎 𝐀 𝐓𝐎𝐃𝐎 𝐄𝐋 𝐄𝐐𝐔𝐈𝐏𝐎\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ ✨ ${customMessage}\n`;
        text += `┃ 👥 𝐌𝐢𝐞𝐦𝐛𝐫𝐨𝐬: ${totalMembers}\n\n`;
        text += `┣━━━━━━━━━━━━⬣\n\n`;
        text += memberJids.map(jid => `┃ ➪ @${jid.split('@')[0]}`).join('\n');
        text += `\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

        await socket.sendMessage(remoteJid, { text, mentions: memberJids });
    }
};