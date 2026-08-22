import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { resolveLidToRealJid } from "../../models/utils.js";
import { getGroupUser } from "../../models/groupDb.js";
import formatter from "../../controllers/functions/formatNumbers.js";

export default {
  name: ["transfer", "pagar", "pay"],
  category: "economy",
  description: "Transfiere monedas a otro usuario.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const senderJid = jidNormalizedUser(
      message.key.participant || message.key.remoteJid || jidRemitente
    );

    const user = getGroupUser(db, remoteJid, senderJid, {
      coins: 0,
      bank: 0,
    });
    let amountStr = args[0];
    let amount = parseInt(amountStr);

    // Buscar a quién pagarle (mención o quote)
    let targetJid = null;
    if (
      message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length >
      0
    ) {
      targetJid =
        message.message.extendedTextMessage.contextInfo.mentionedJid[0];
    } else if (message.message?.extendedTextMessage?.contextInfo?.participant) {
      targetJid = message.message.extendedTextMessage.contextInfo.participant;
    }

    if (!targetJid) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "⚠️ Debes mencionar o responder al mensaje del usuario al que quieres pagarle.\nEjemplo: *.pay 100 @usuario*",
        },
        { quoted: message },
      );
    }

    targetJid = await resolveLidToRealJid(targetJid, socket, remoteJid);
    targetJid = jidNormalizedUser(targetJid);

    // Evitar pagarse a uno mismo
    if (targetJid === senderJid) {
      return await socket.sendMessage(
        remoteJid,
        { text: "❌ No puedes transferirte dinero a ti mismo." },
        { quoted: message },
      );
    }

    if (isNaN(amount) || amount <= 0) {
      return await socket.sendMessage(
        remoteJid,
        { text: "⚠️ Cantidad inválida a transferir." },
        { quoted: message },
      );
    }

    if ((user.coins || 0) < amount) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `❌ No tienes suficientes monedas en tu cartera para hacer la transferencia. Tienes *₡${formatter(user.coins || 0)}*`,
        },
        { quoted: message },
      );
    }

    const targetUser = getGroupUser(db, remoteJid, targetJid, {
      coins: 0,
      bank: 0,
    });

    user.coins -= amount;
    targetUser.coins = (targetUser.coins || 0) + amount;
    saveDB(db);

    let resText = `╭〔 💸 𝐓𝐑𝐀𝐍𝐒𝐅𝐄𝐑𝐄𝐍𝐂𝐈𝐀 〕⬣\n`;
    resText += `┃ ✅ 𝐏𝐀𝐆𝐎 𝐑𝐄𝐀𝐋𝐈𝐙𝐀𝐃𝐎\n`;
    resText += `╰━━━━━━━━━━━━⬣\n\n`;
    resText += `┃ 📤 𝐃𝐞: *@${senderJid.split("@")[0]}*\n`;
    resText += `┃ 📥 𝐏𝐚𝐫𝐚: @${targetJid.split("@")[0]}\n`;
    resText += `┃ 💰 𝐌𝐨𝐧𝐭𝐨: ₡${formatter(amount)}\n\n`;
    resText += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text: resText, mentions: [senderJid, targetJid] },
      { quoted: message },
    );
  },
};
