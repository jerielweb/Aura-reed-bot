import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { getGroupUser } from "../../models/groupDb.js";
import formatter from "../../controllers/functions/formatNumbers.js";

export default {
  name: ["deposit", "d", "dep"],
  category: "economy",
  description: "Deposita monedas en el banco para mantenerlas seguras.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const participantJid = jidNormalizedUser(
      message.key.participant || message.key.remoteJid || jidRemitente
    );

    const user = getGroupUser(db, remoteJid, participantJid, {
      coins: 0,
      bank: 0,
    });
    let amount = args[0];

    if (!amount) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "⚠️ Ingresa la cantidad a depositar.\nEjemplo: *.dep 100* o *.dep all*",
        },
        { quoted: message },
      );
    }

    if (amount.toLowerCase() === "all" || amount.toLowerCase() === "todo") {
      amount = user.coins || 0;
    } else {
      amount = parseInt(amount);
    }

    if (isNaN(amount) || amount <= 0) {
      return await socket.sendMessage(
        remoteJid,
        { text: "⚠️ Cantidad inválida." },
        { quoted: message },
      );
    }

    if ((user.coins || 0) < amount) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `❌ No tienes suficientes monedas. Tu saldo es de *₡${formatter(user.coins || 0)}* `,
        },
        { quoted: message },
      );
    }

    user.coins -= amount;
    user.bank = (user.bank || 0) + amount;
    saveDB(db);

    let text = `╭〔 🏦 𝐁𝐀𝐍𝐂𝐎 〕⬣\n`;
    text += `┃ 📥 𝐃𝐄𝐏𝐎́𝐒𝐈𝐓𝐎 𝐄𝐗𝐈𝐓𝐎𝐒𝐎\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ 👋 *@${participantJid.split("@")[0]}*\n`;
    text += `┃ 📥 𝐃𝐞𝐩𝐨𝐬𝐢𝐭𝐚𝐬𝐭𝐞: ₡${formatter(amount)}\n`;
    text += `┃ 🏦 𝐍𝐮𝐞𝐯𝐨 𝐒𝐚𝐥𝐝𝐨 𝐁𝐚𝐧𝐜𝐨: ₡${formatter(user.bank)}\n`;
    text += `┃ 💵 𝐌𝐨𝐧𝐞𝐝𝐚𝐬 𝐫𝐞𝐬𝐭𝐚𝐧𝐭𝐞𝐬: ₡${formatter(user.coins)}\n\n`;
    text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text, mentions: [participantJid] },
      { quoted: message },
    );
  },
};
