import { jidNormalizedUser } from "@whiskeysockets/baileys";
import formatter from "../../controllers/functions/formatNumbers.js";
import { getGroupUser } from "../../models/groupDb.js";

export default {
  name: ["ruleta", "roulette", "rt"],
  category: "economy",
  description: "Juega a la ruleta.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const participantJid = jidRemitente;

    const user = getGroupUser(db, remoteJid, participantJid, {
      coins: 0,
      bank: 0,
    });
    const amount = parseInt(args[0]);
    const color = args[1]?.toLowerCase();

    if (isNaN(amount) || amount <= 0) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "⚠️ Cantidad inválida. Usa: *.ruleta [cantidad] [color]*\nColores: *red*, *black*, *green*",
        },
        { quoted: message },
      );
    }

    if (!color || !["red", "black", "green"].includes(color)) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "⚠️ Debes elegir un color: *red*, *black* o *green*\nEjemplo: *.ruleta 5000 red*",
        },
        { quoted: message },
      );
    }

    if ((user.coins || 0) < amount) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `❌ No tienes suficientes monedas. Tienes *₡${user.coins || 0}*`,
        },
        { quoted: message },
      );
    }

    const random = Math.random() * 100;
    let result,
      winnings = 0,
      resultColor = "";

    if (random < 40) {
      result = "red";
      resultColor = "🔴 RED";
    } else if (random < 80) {
      result = "black";
      resultColor = "⚫ BLACK";
    } else {
      result = "green";
      resultColor = "🟢 GREEN";
    }

    let text = `╭〔 🎡 𝐑𝐔𝐋𝐄𝐓𝐀 〕⬣\n`;
    text += `┃ 🎰 𝐑𝐄𝐒𝐔𝐋𝐓𝐀𝐃𝐎\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;

    user.coins -= amount;

    if (result === color) {
      if (color === "green") {
        winnings = amount * 20;
        text += `┃ ✅ ¡𝐆𝐀𝐍𝐀𝐒𝐓𝐄!\n`;
        text += `┃ 🟢 𝐂𝐚𝐢𝐨 𝐆𝐫𝐞𝐞𝐧 - 20𝐱\n\n`;
      } else {
        winnings = amount * 2;
        text += `┃ ✅ ¡𝐆𝐀𝐍𝐀𝐒𝐓𝐄!\n`;
        text += `┃ ${resultColor} - 2𝐱\n\n`;
      }
      user.coins += winnings;
      text += `┃ 💰 𝐆𝐚𝐧𝐚𝐧𝐜𝐢𝐚: ₡${formatter(winnings)}\n`;
    } else {
      text += `┃ ❌ 𝐏𝐞𝐫𝐝𝐢𝐬𝐭𝐞\n`;
      text += `┃ 🎡 𝐑𝐞𝐬𝐮𝐥𝐭𝐚𝐝𝐨: ${resultColor}\n`;
      text += `┃ 🎯 𝐀𝐩𝐨𝐬𝐭𝐚𝐞𝐭𝐞 𝐞𝐧: ${color === "red" ? "🔴 RED" : color === "black" ? "⚫ BLACK" : "🟢 GREEN"}\n\n`;
      text += `┃ 💸 𝐏𝐞́𝐫𝐝𝐢𝐝𝐚: ₡${formatter(amount)}\n`;
    }

    text += `┃ 💵 𝐂𝐚𝐫𝐭𝐞𝐫𝐚: ₡${formatter(user.coins)}\n\n`;
    text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    saveDB(db);

    await socket.sendMessage(
      remoteJid,
      { text, mentions: [participantJid] },
      { quoted: message },
    );
  },
};
