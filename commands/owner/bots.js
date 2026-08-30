import {
  countActiveSubBots,
  getMaxSubBots,
  getRegisteredSubBots,
  getSubBotsInGroup,
} from "../../models/subbotManager.js";

export default {
  name: ["bots", "subbots", "lista-bots"],
  category: "owner",
  description: "Muestra la lista de sub-bots activos/sesiones.",
  ownerOnly: false,

  execute: async (
    socket,
    message,
    args,
    { prefix },
  ) => {
    try {
      const remoteJid =
        message.key.remoteJid;

      const isGroup =
        remoteJid.endsWith(
          "@g.us",
        );

      const activeCount =
        countActiveSubBots();

      const maxSubs =
        getMaxSubBots();

      const registeredBots =
        getRegisteredSubBots();

      const mentions = [];

      let text =
        `╭〔 🔌 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;

      if (isGroup) {
        const botsInGroup =
          await getSubBotsInGroup(
            remoteJid,
          );

        text +=
          `┃ 🤖 𝐒𝐔𝐁-𝐁𝐎𝐓𝐒 𝐄𝐍 𝐄𝐋 𝐆𝐑𝐔𝐏𝐎\n`;

        text +=
          `╰━━━━━━━━━━━━⬣\n\n`;

        text +=
          `┃ 📊 𝐀𝐜𝐭𝐢𝐯𝐨𝐬 𝐠𝐥𝐨𝐛𝐚𝐥: *${activeCount}/${maxSubs}*\n`;

        text +=
          `┃ ⚡ 𝐄𝐧 𝐞𝐬𝐭𝐞 𝐠𝐫𝐮𝐩𝐨: *${botsInGroup.length}*\n\n`;

        if (
          botsInGroup.length === 0
        ) {
          text +=
            `┃ > No hay sub-bots activos aquí.\n`;
        } else {
          botsInGroup.forEach(
            (bot, index) => {
              text +=
                `┃ ${index + 1}. @${bot.id} 🟢\n`;

              mentions.push(
                `${bot.id}@s.whatsapp.net`,
              );
            },
          );
        }

        // Mostrar registrados pero desconectados
        const inactiveBots =
          registeredBots.filter(
            (bot) =>
              !bot.active,
          );

        if (
          inactiveBots.length > 0
        ) {
          text +=
            `\n┃ 🔴 𝐒𝐔𝐁-𝐁𝐎𝐓𝐒 𝐈𝐍𝐀𝐂𝐓𝐈𝐕𝐎𝐒\n`;

          inactiveBots.forEach(
            (bot) => {
              text +=
                `┃ • @${bot.id} 🔴 INACTIVO\n`;

              mentions.push(
                `${bot.id}@s.whatsapp.net`,
              );
            },
          );
        }

      } else {
        text +=
          `┃ 🤖 𝐒𝐔𝐁-𝐁𝐎𝐓𝐒\n`;

        text +=
          `╰━━━━━━━━━━━━⬣\n\n`;

        text +=
          `┃ 📊 𝐀𝐜𝐭𝐢𝐯𝐨𝐬: *${activeCount}/${maxSubs}*\n`;

        text +=
          `┃ 📁 𝐑𝐞𝐠𝐢𝐬𝐭𝐫𝐚𝐝𝐨𝐬: *${registeredBots.length}*\n\n`;

        if (
          registeredBots.length === 0
        ) {
          text +=
            `┃ > No hay sub-bots registrados.\n`;
        } else {
          registeredBots.forEach(
            (bot, index) => {
              text +=
                `┃ ${index + 1}. @${bot.id} ${
                  bot.active
                    ? "🟢 ACTIVO"
                    : "🔴 INACTIVO"
                }\n`;

              mentions.push(
                `${bot.id}@s.whatsapp.net`,
              );
            },
          );
        }
      }

      text +=
        `\n> _Usa ${prefix}code o ${prefix}qr para tener tu sub-bot._\n\n`;

      text +=
        `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      await socket.sendMessage(
        remoteJid,
        {
          text,
          mentions,
        },
        {
          quoted: message,
        },
      );

    } catch (error) {
      console.error(
        "[BOTS] Error ejecutando comando:",
        error,
      );

      // Esto nos permite saber si vuelve a fallar.
      try {
        await socket.sendMessage(
          message.key.remoteJid,
          {
            text:
              `❌ Error ejecutando .bots:\n\n${error.message}`,
          },
          {
            quoted: message,
          },
        );
      } catch {}
    }
  },
};