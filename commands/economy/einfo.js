import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { getGroupUser } from "../../models/groupDb.js";

export default {
  name: ["einfo", "economia"],
  category: "economy",
  description: "Muestra información sobre cómo funciona la economía del bot.",
  execute: async (socket, message, args, { db, jidRemitente, prefix }) => {
    const remoteJid = message.key.remoteJid;
    const participantJid = jidNormalizedUser(
      message.key.participant || message.key.remoteJid || jidRemitente
    );

    const user = getGroupUser(db, remoteJid, participantJid, {});

    const now = Date.now();

    // Definición de cooldowns (en milisegundos)
    const cooldowns = {
      work: 5 * 60 * 1000, // 5 min
      ppt: 10 * 60 * 1000, // 10 min
      mine: 30 * 60 * 1000, // 30 min
      hunt: 30 * 60 * 1000, // 30 min
      crime: 60 * 60 * 1000, // 1 hora
      slut: 60 * 60 * 1000, // 1 hora
      steal: 60 * 60 * 1000, // 1 hora
      adventure: 120 * 60 * 1000, // 2 horas
      daily: 24 * 60 * 60 * 1000, // 24 horas
      weekly: 7 * 24 * 60 * 60 * 1000, // 7 días
      monthly: 30 * 24 * 60 * 60 * 1000, // 30 días
    };

    // Función auxiliar para calcular tiempo restante
    const getRemaining = (lastAction, duration) => {
      const expiration = (lastAction || 0) + duration;
      if (now >= expiration) return "✅ Disponible";

      const remaining = expiration - now;
      const hours = Math.floor(remaining / 3600000);
      const minutes = Math.floor((remaining % 3600000) / 60000);
      const seconds = Math.floor((remaining % 60000) / 1000);
      const days = Math.floor(hours / 24);

      let timeStr = "";
      if (days > 0) timeStr += `${days}d `;
      if (hours % 24 > 0) timeStr += `${hours % 24}h `;
      if (minutes > 0) timeStr += `${minutes}m `;
      timeStr += `${seconds}s`;
      return `⏳ _${timeStr}_`;
    };

    let text = `╭〔 ₡ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐄𝐂𝐎𝐍𝐎́𝐌𝐈𝐂𝐎 〕⬣\n`;
    text += `┃ ℹ️ 𝐈𝐍𝐅𝐎𝐑𝐌𝐀𝐂𝐈𝐎́𝐍\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ Bienvenido al sistema de *AuraCoins* (₡).\n`;
    text += `┃ Gana, ahorra y gestiona tu fortuna.\n\n`;
    text += `┣━━〔 🛠️ 𝐂𝐎́𝐌𝐎 𝐆𝐀𝐍𝐀𝐑 〕━━⬣\n\n`;
    text += `┃ ➪ *${prefix}work:* ${getRemaining(user.lastWork, cooldowns.work)}\n`;
    text += `┃ ➪ *${prefix}ppt:* ${getRemaining(user.lastPpt, cooldowns.ppt)}\n`;
    text += `┃ ➪ *${prefix}mine:* ${getRemaining(user.lastMine, cooldowns.mine)}\n`;
    text += `┃ ➪ *${prefix}hunt:* ${getRemaining(user.lastHunt, cooldowns.hunt)}\n`;
    text += `┃ ➪ *${prefix}crime:* ${getRemaining(user.lastCrime, cooldowns.crime)}\n`;
    text += `┃ ➪ *${prefix}slut:* ${getRemaining(user.lastSlut, cooldowns.slut)}\n`;
    text += `┃ ➪ *${prefix}steal:* ${getRemaining(user.lastSteal, cooldowns.steal)}\n`;
    text += `┃ ➪ *${prefix}adventure:* ${getRemaining(user.lastAdventure, cooldowns.adventure)}\n`;
    text += `┃ ➪ *${prefix}daily:* ${getRemaining(user.lastDaily, cooldowns.daily)}\n`;
    text += `┃ ➪ *${prefix}weekly:* ${getRemaining(user.lastWeekly, cooldowns.weekly)}\n`;
    text += `┃ ➪ *${prefix}monthly:* ${getRemaining(user.lastMonthly, cooldowns.monthly)}\n\n`;
    text += `┣━━〔 🏦 𝐁𝐀𝐍𝐂𝐎 〕━━⬣\n\n`;
    text += `┃ Protege tus ₡ de los ladrones.\n`;
    text += `┃ ➪ *${prefix}dep [monto]:* Guardar en banco.\n`;
    text += `┃ ➪ *${prefix}with [monto]:* Sacar del banco.\n\n`;
    text += `┣━━〔 💳 𝐆𝐄𝐒𝐓𝐈𝐎́𝐍 〕━━⬣\n\n`;
    text += `┃ ➪ *${prefix}bal:* Tu balance actual.\n`;
    text += `┃ ➪ *${prefix}pay [monto] @user:* Transferir.\n`;
    text += `┃ ➪ *${prefix}steal @user:* Intentar robar.\n\n`;
    text += `╰━━〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕━━⬣`;

    await socket.sendMessage(remoteJid, { text }, { quoted: message });
  },
};
