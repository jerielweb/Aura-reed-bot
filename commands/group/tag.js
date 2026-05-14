export default {
    name: ['tag', 'tg'],
    category: 'group',
    description: 'Mención invisible',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });

        const groupMetadata = await socket.groupMetadata(remoteJid);
        const participants = groupMetadata.participants;
        const mentions = participants.map(p => p.id);

        const quotedMsg = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
        const quotedText = quotedMsg?.conversation || quotedMsg?.extendedTextMessage?.text || '';

        const customMessage = args.join(' ') || quotedText;

        if (!customMessage) {
            return socket.sendMessage(remoteJid, { text: '⚠️ Debes escribir un mensaje o responder a uno existente para poder etiquetar a todos.' },{ quoted: message });
        }

        const text = `${customMessage}`;

        await socket.sendMessage(remoteJid, { text, mentions });
    }
};
