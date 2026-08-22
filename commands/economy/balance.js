import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { getProfileUser } from "../../models/profileUtils.js";
import formatter from "../../controllers/functions/formatNumbers.js";

export default {
  name: ["bank", "bal", "coins"],
  category: "economy",
  description: "Muestra tu saldo actual o el de otro usuario mencionado.",
  execute: async (socket, message, args, { db, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;

    const citado =
      message.message?.extendedTextMessage?.contextInfo?.participant;
    const mencionado =
      message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    const rawTarget = mencionado || citado || jidRemitente;
    const targetUser = jidNormalizedUser(rawTarget);

    // Usar getProfileUser para asegurar que lea la misma economía local del grupo
    const user = getProfileUser(db, remoteJid, targetUser);

    const coins = user.coins || 0;
    const bank = user.bank || 0;
    const total = coins + bank;

    let text = `╭〔 💰 𝐄𝐂𝐎𝐍𝐎𝐌𝐈́𝐀 〕⬣\n`;
    text += `┃ 🏦 𝐄𝐒𝐓𝐀𝐃𝐎 𝐃𝐄 𝐂𝐔𝐄𝐍𝐓𝐀\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ 👋 𝐇𝐨𝐥𝐚: *@${targetUser.split("@")[0]}*\n\n`;
    text += `┃ 💵 𝐂𝐚𝐫𝐭𝐞𝐫𝐚 › ₡${formatter(coins)}\n`;
    text += `┃ 🏦 𝐁𝐚𝐧𝐜𝐨 › ₡${formatter(bank)}\n`;
    text += `┃ 💎 𝐓𝐨𝐭𝐚𝐥 › ₡${formatter(total)}\n\n`;
    text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      {
        text,
        mentions: [targetUser],
      },
      { quoted: message },
    );
  },
};
