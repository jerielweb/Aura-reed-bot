import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { getGroupUser } from "../../models/groupDb.js";
import formatter from "../../controllers/functions/formatNumbers.js";

export default {
  name: ["bank", "bal", "coins"],
  category: "economy",
  description: "Muestra tu saldo actual o el de otro usuario mencionado.",
  execute: async (socket, message, args, { db, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;

    // Detectar si se mencionó a alguien con @tag o si se respondió/citó el mensaje de otra persona
    const citado =
      message.message?.extendedTextMessage?.contextInfo?.participant;
    const mencionado =
      message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    // El usuario objetivo será el mencionado, el citado, o en su defecto, quien ejecuta el comando
    const rawTarget = mencionado || citado || jidRemitente;
    const targetUser = jidNormalizedUser(rawTarget);

    // Obtener los datos del usuario objetivo desde la base de datos local del grupo
    const user = getGroupUser(db, remoteJid, targetUser, {
      coins: 0,
      bank: 0,
      lastWork: 0,
      lastDaily: 0,
      lastWeekly: 0,
      lastMonthly: 0,
    });

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

    // Envía el mensaje citando el comando original y aplicando la etiqueta/mención correcta
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
