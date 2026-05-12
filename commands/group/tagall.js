import { Rstr } from './../../controllers/textBots.js';

export default {
    name: ['tagall', 'tagtodos', 'tgat', 'invocar'],
    category: 'group',
    description: 'Mencionar a todos con un simple mensaje.',
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

        const mentionNames = memberJids.map(jid => `@${jid.split('@')[0]}`);
        const totalMembers = memberJids.length;
        const groupHeader = `👥 Miembros totales: ${totalMembers}\n\n`;
        const mentionList = mentionNames.join('\n');

        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || 'Llamando a Todo el equipo *Activense* 🔔';
        const customMessage = args.join(' ') || quotedText;

        const text = customMessage
            ? `${customMessage}\n\n${groupHeader}\n${mentionList}`
            : `${groupHeader}${mentionList}`;

        await socket.sendMessage(remoteJid, { text, mentions: memberJids });
    }
};