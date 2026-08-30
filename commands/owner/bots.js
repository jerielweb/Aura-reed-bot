import {
  jidNormalizedUser,
} from "@whiskeysockets/baileys";

import {
  countActiveSubBots,
  getMaxSubBots,
  getRegisteredSubBots,
} from "../../models/subbotManager.js";


// ============================================================
// NORMALIZAR JID / NÚMERO
// ============================================================

function normalizeNumber(jid) {
  if (!jid) return "";

  try {
    const normalized =
      jidNormalizedUser(
        String(jid),
      );

    return normalized
      .split("@")[0]
      .split(":")[0]
      .replace(/\D/g, "");
  } catch {
    return String(jid)
      .split("@")[0]
      .split(":")[0]
      .replace(/\D/g, "");
  }
}


// ============================================================
// COMANDO BOTS
// ============================================================

export default {
  name: [
    "bots",
    "subbots",
    "lista-bots",
  ],

  category: "owner",

  description:
    "Muestra los Sub-Bots activos y cuáles están en el grupo.",

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

      if (!remoteJid) {
        return;
      }

      const isGroup =
        remoteJid.endsWith(
          "@g.us",
        );


      // ========================================================
      // DATOS GENERALES
      // ========================================================

      const activeCount =
        countActiveSubBots();

      const maxSubs =
        getMaxSubBots();

      const registeredBots =
        getRegisteredSubBots();


      const mentions = [];


      let text =
        `╭〔 🔌 ${fytBold ? fytBold("AURA REED") : "AURA REED"} 〕⬣\n`;


      // ========================================================
      // PRIVADO
      // ========================================================

      if (!isGroup) {

        text +=
          `┃ 🤖 𝐒𝐔𝐁-𝐁𝐎𝐓𝐒\n`;

        text +=
          `┣━━━━━━━━━━━━⬣\n`;

        text +=
          `┃ 📊 𝐀𝐜𝐭𝐢𝐯𝐨𝐬: *${activeCount}/${maxSubs}*\n`;

        text +=
          `┃ 📁 𝐑𝐞𝐠𝐢𝐬𝐭𝐫𝐚𝐝𝐨𝐬: *${registeredBots.length}*\n\n`;


        if (
          registeredBots.length === 0
        ) {

          text +=
            `┃ > No hay Sub-Bots registrados.\n`;

        } else {

          registeredBots.forEach(
            (
              bot,
              index,
            ) => {

              const id =
                normalizeNumber(
                  bot.id,
                );

              if (!id) {
                return;
              }

              text +=
                `┃ ${index + 1}. @${id} ${
                  bot.active
                    ? "🟢 ACTIVO"
                    : "🔴 INACTIVO"
                }\n`;

              mentions.push(
                `${id}@s.whatsapp.net`,
              );
            },
          );
        }


      // ========================================================
      // GRUPO
      // ========================================================

      } else {

        let groupMetadata = null;

        try {

          groupMetadata =
            await socket.groupMetadata(
              remoteJid,
            );

        } catch (error) {

          console.error(
            "[BOTS] No se pudo obtener metadata del grupo:",
            error,
          );

          text +=
            `┃ ⚠️ No pude obtener la información del grupo.\n`;

          text +=
            `┃ Intenta nuevamente en unos segundos.\n`;

          text +=
            `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;


          return await socket.sendMessage(
            remoteJid,
            {
              text,
            },
            {
              quoted:
                message,
            },
          );
        }


        // ======================================================
        // OBTENER PARTICIPANTES
        // ======================================================

        const participants =
          groupMetadata?.participants ||
          [];

        const participantNumbers =
          new Set();


        for (
          const participant of participants
        ) {

          const possibleJids = [
            participant?.phoneNumber,
            participant?.jid,
            participant?.id,
          ];


          for (
            const jid of possibleJids
          ) {

            if (!jid) {
              continue;
            }

            const normalized =
              normalizeNumber(
                jid,
              );

            if (normalized) {

              participantNumbers.add(
                normalized,
              );
            }
          }
        }


        // ======================================================
        // COMPARAR SUB-BOTS REGISTRADOS
        // ======================================================

        const botsInGroup = [];
        const activeNotInGroup = [];
        const inactiveBots = [];


        for (
          const bot of registeredBots
        ) {

          const id =
            normalizeNumber(
              bot.id,
            );

          if (!id) {
            continue;
          }

          const isInGroup =
            participantNumbers.has(
              id,
            );


          if (
            bot.active &&
            isInGroup
          ) {

            botsInGroup.push(
              id,
            );

            continue;
          }


          if (
            bot.active &&
            !isInGroup
          ) {

            activeNotInGroup.push(
              id,
            );

            continue;
          }


          if (
            !bot.active
          ) {

            inactiveBots.push(
              id,
            );
          }
        }


        // ======================================================
        // CABECERA GRUPO
        // ======================================================

        text +=
          `┃ 🤖 𝐒𝐔𝐁-𝐁𝐎𝐓𝐒 𝐄𝐍 𝐄𝐋 𝐆𝐑𝐔𝐏Ο\n`;

        text +=
          `┣━━━━━━━━━━━━⬣\n`;

        text +=
          `┃ 📊 𝐀𝐜𝐭𝐢𝐯𝐨𝐬 𝐠𝐥𝐨𝐛𝐚𝐥: *${activeCount}/${maxSubs}*\n`;

        text +=
          `┃ ⚡ 𝐄𝐧 𝐞𝐬𝐭𝐞 𝐠𝐫𝐮𝐩𝐨: *${botsInGroup.length}*\n\n`;


        // ======================================================
        // BOTS EN EL GRUPO
        // ======================================================

        if (
          botsInGroup.length > 0
        ) {

          text +=
            `┃ 🟢 𝐀𝐂𝐓𝐈𝐕𝐎𝐒 𝐄𝐍 𝐄𝐒𝐓𝐄 𝐆𝐑𝐔𝐏𝐎\n`;

          botsInGroup.forEach(
            (
              id,
              index,
            ) => {

              text +=
                `┃ ${index + 1}. @${id} 🟢\n`;

              mentions.push(
                `${id}@s.whatsapp.net`,
              );
            },
          );

          text += `┃\n`;

        } else {

          text +=
            `┃ > No hay Sub-Bots activos aquí.\n\n`;
        }


        // ======================================================
        // ACTIVOS PERO NO EN GRUPO
        // ======================================================

        if (
          activeNotInGroup.length > 0
        ) {

          text +=
            `┃ 🔵 𝐀𝐂𝐓𝐈𝐕𝐎𝐒 (𝐅𝐔𝐄𝐑𝐀)\n`;

          activeNotInGroup.forEach(
            (
              id,
            ) => {

              text +=
                `┃ • @${id} 🔵\n`;

              mentions.push(
                `${id}@s.whatsapp.net`,
              );
            },
          );

          text += `┃\n`;
        }


        // ======================================================
        // INACTIVOS
        // ======================================================

        if (
          inactiveBots.length > 0
        ) {

          text +=
            `┃ 🔴 𝐈𝐍𝐀𝐂𝐓𝐈𝐕𝐎𝐒\n`;

          inactiveBots.forEach(
            (
              id,
            ) => {

              text +=
                `┃ • @${id} 🔴\n`;

              mentions.push(
                `${id}@s.whatsapp.net`,
              );
            },
          );
        }
      }


      // ========================================================
      // PIE DE PÁGINA ÚNICO
      // ========================================================

      text +=
        `┣━━━━━━━━━━━━⬣\n`;

      text +=
        `┃ 💡 _Usa ${prefix}code o ${prefix}qr_\n`;

      text +=
        `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;


      // ========================================================
      // ENVIAR
      // ========================================================

      await socket.sendMessage(
        remoteJid,
        {
          text,
          mentions,
        },
        {
          quoted:
            message,
        },
      );


    } catch (error) {

      console.error(
        "[BOTS] Error ejecutando comando:",
        error,
      );

      try {

        await socket.sendMessage(
          message.key.remoteJid,
          {
            text:
              `❌ Error en .bots:\n\n${error.message}`,
          },
          {
            quoted:
              message,
          },
        );

      } catch {}
    }
  },
};
