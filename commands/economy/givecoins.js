import { resolveLidToRealJid } from '../../models/utils.js';

export default {
    name: ['transfer', 'pagar', 'pay'],
    category: 'economy',
    description: 'Transfiere monedas a otro usuario.',
    execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
        const remoteJid = message.key.remoteJid;
        const text = args.join(' ');

        if (!db.users[jidRemitente]) {
            db.users[jidRemitente] = { coins: 0, bank: 0 };
        }

        const user = db.users[jidRemitente];
        let amountStr = args[0];
        let amount = parseInt(amountStr);

        // Buscar a quién pagarle (mención o quote)
        let targetJid = null;
        if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length > 0) {
            targetJid = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            targetJid = message.message.extendedTextMessage.contextInfo.participant;
        }

        if (!targetJid) {
            return await socket.sendMessage(remoteJid, { text: '⚠️ Debes mencionar o responder al mensaje del usuario al que quieres pagarle.\nEjemplo: *.pay 100 @usuario*' }, { quoted: message });
        }

        // Evitar pagarse a uno mismo
        if (targetJid === jidRemitente) {
            return await socket.sendMessage(remoteJid, { text: '❌ No puedes transferirte dinero a ti mismo.' }, { quoted: message });
        }

        if (isNaN(amount) || amount <= 0) {
            return await socket.sendMessage(remoteJid, { text: '⚠️ Cantidad inválida a transferir.' }, { quoted: message });
        }

        if ((user.coins || 0) < amount) {
            return await socket.sendMessage(remoteJid, { text: `❌ No tienes suficientes monedas en tu cartera para hacer la transferencia. Tienes *₡${user.coins || 0}*` }, { quoted: message });
        }

        // Inicializar al receptor si no existe
        if (!db.users[targetJid]) {
            db.users[targetJid] = { coins: 0, bank: 0 };
        }

        user.coins -= amount;
        db.users[targetJid].coins = (db.users[targetJid].coins || 0) + amount;
        saveDB(db);

        let resText = `╭〔 💸 𝐓𝐑𝐀𝐍𝐒𝐅𝐄𝐑𝐄𝐍𝐂𝐈𝐀 〕⬣\n`;
        resText += `┃ ✅ 𝐏𝐀𝐆𝐎 𝐑𝐄𝐀𝐋𝐈𝐙𝐀𝐃𝐎\n`;
        resText += `╰━━━━━━━━━━━━⬣\n\n`;
        resText += `┃ 📤 𝐃𝐞: *@${jidRemitente.split('@')[0]}*\n`;
        resText += `┃ 📥 𝐏𝐚𝐫𝐚: @${targetJid.split('@')[0]}\n`;
        resText += `┃ 💰 𝐌𝐨𝐧𝐭𝐨: ₡${amount.toLocaleString()}\n\n`;
        resText += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

        await socket.sendMessage(remoteJid, { text: resText, mentions: [jidRemitente, targetJid] }, { quoted: message });
    }
};
