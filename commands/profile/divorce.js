import {
  resolveLidToRealJid,
} from "../../models/utils.js";

import {
  getProfileUser,
} from "../../models/profileUtils.js";

import {
  ensureGroup,
} from "../../models/groupDb.js";

import {
  fytBold,
} from "../../models/TextStyle.js";

import {
  getMarriagePending,
  setMarriagePending,
  clearMarriagePending,
  formatTimeLeft,
} from "../../models/marriageUtils.js";

import {
  jidNormalizedUser,
} from "@whiskeysockets/baileys";

/**
 * Resuelve el objetivo de una mención
 * o de una respuesta.
 */
async function resolveTargetFromMessage(
  message,
  socket,
  remoteJid,
) {
  const ctx =
    message.message
      ?.extendedTextMessage
      ?.contextInfo;

  let targetJid = null;

  /*
   * Mención explícita
   */
  if (
    ctx?.mentionedJid?.length > 0
  ) {
    targetJid =
      ctx.mentionedJid[0];
  }

  /*
   * Respuesta a un mensaje
   */
  else if (ctx?.participant) {
    targetJid =
      ctx.participant;
  }

  if (!targetJid) {
    return null;
  }

  const resolved =
    await resolveLidToRealJid(
      targetJid,
      socket,
      remoteJid,
    );

  return resolved
    ? jidNormalizedUser(resolved)
    : null;
}

export default {
  name: [
    "divorce",
    "divorciar",
    "separar",
  ],

  category: "profile",

  description:
    "Solicitar divorcio.",

  execute: async (
    socket,
    message,
    args,
    {
      db,
      saveDB,
      jidRemitente,
      prefix,
    },
  ) => {
    const remoteJid =
      message.key.remoteJid;

    /*
     * Solo grupos
     */

    if (
      !remoteJid.endsWith("@g.us")
    ) {
      let text =
        `╭〔 ❌ ${fytBold("AURA REED")} 〕━━⬣\n`;

      text +=
        `${fytBold("ACCION INCONPATIBLE")}\n`;

      text +=
        `╰━━━━━━━━━━━━⬣\n\n`;

      text +=
        `> Este comando solo funciona en grupos.\n\n`;

      text +=
        `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return await socket.sendMessage(
        remoteJid,
        { text },
        { quoted: message },
      );
    }

    /*
     * ============================================================
     * RESOLVER EL REMITENTE
     * ============================================================
     *
     * Esta es una de las correcciones principales.
     */

    const resolvedSender =
      await resolveLidToRealJid(
        jidRemitente,
        socket,
        remoteJid,
      );

    const normalizedSender =
      jidNormalizedUser(
        resolvedSender || jidRemitente,
      );

    const group =
      ensureGroup(
        db,
        remoteJid,
      );

    const user =
      getProfileUser(
        db,
        remoteJid,
        normalizedSender,
      );

    const pending =
      getMarriagePending(group);

    /*
     * ============================================================
     * DETERMINAR OBJETIVO
     * ============================================================
     */

    let targetJid = null;

    const ctx =
      message.message
        ?.extendedTextMessage
        ?.contextInfo;

    const hasExplicitMention =
      ctx?.mentionedJid?.length > 0;

    /*
     * Si el usuario es quien debe aceptar
     * una solicitud de divorcio, utilizar
     * pending.from.
     */

    if (
      pending &&
      pending.type === "divorce" &&
      pending.to === normalizedSender &&
      !hasExplicitMention
    ) {
      targetJid =
        pending.from;
    } else {
      targetJid =
        await resolveTargetFromMessage(
          message,
          socket,
          remoteJid,
        );
    }

    /*
     * Si no hay objetivo y está casado,
     * utilizar automáticamente su pareja.
     */

    if (!targetJid) {
      if (user.marriedTo) {
        targetJid =
          user.marriedTo;
      } else {
        let text =
          `╭〔 ⚠️ ${fytBold("FALTA OBJETIVO")} 〕⬣\n\n`;

        text +=
          `┃ > Menciona o responde a la persona.\n`;

        text +=
          `┃ > Matrimonio: *${prefix}divorce @usuario*\n`;

        text +=
          `┣━━━━━━━━━━━━⬣\n`;

        text +=
          `┃ > _Ejemplo:_\n`;

        text +=
          `┃ > *${prefix}divorce @pareja*\n`;

        text +=
          `┃ > *${prefix}divorce* (respondiendo)\n\n`;

        text +=
          `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;

        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }
    }

    /*
     * Resolver objetivo
     */

    const resolvedTarget =
      await resolveLidToRealJid(
        targetJid,
        socket,
        remoteJid,
      );

    targetJid =
      jidNormalizedUser(
        resolvedTarget || targetJid,
      );

    /*
     * No divorciarse de uno mismo
     */

    if (
      targetJid === normalizedSender
    ) {
      let text =
        `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;

      text +=
        `┃ ${fytBold("ACCIÓN INVÁLIDA")}\n`;

      text +=
        `╰━━━━━━━━━━━━⬣\n\n`;

      text +=
        `┃ > No puedes usar este comando contigo mismo.\n\n`;

      text +=
        `╰〔 ⚡ ${fytBold("SYSTEM ERROR")} 〕⬣`;

      return await socket.sendMessage(
        remoteJid,
        { text },
        { quoted: message },
      );
    }

    const partner =
      getProfileUser(
        db,
        remoteJid,
        targetJid,
      );

    /*
     * ============================================================
     * CONFIRMAR DIVORCIO
     * ============================================================
     */

    if (
      pending &&
      pending.to === normalizedSender &&
      pending.from === targetJid
    ) {
      if (
        pending.type !== "divorce"
      ) {
        let text =
          `╭〔 ❌ ${fytBold("ERROR")} 〕⬣\n\n`;

        text +=
          `┃ > Esta solicitud no es de divorcio.\n\n`;

        text +=
          `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }

      /*
       * Comprobar matrimonio
       */

      if (
        user.marriedTo !==
          targetJid ||
        partner.marriedTo !==
          normalizedSender
      ) {
        clearMarriagePending(
          group,
        );

        if (
          typeof saveDB ===
          "function"
        ) {
          saveDB(db);
        }

        let text =
          `╭〔 ❌ ${fytBold("ERROR")} 〕⬣\n\n`;

        text +=
          `┃ > El matrimonio ya no es válido o no coincide.\n\n`;

        text +=
          `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }

      /*
       * Confirmar divorcio
       */

      user.marriedTo =
        null;

      partner.marriedTo =
        null;

      clearMarriagePending(
        group,
      );

      if (
        typeof saveDB ===
        "function"
      ) {
        saveDB(db);
      }

      let text =
        `╭〔 💔 ${fytBold("DIVORCIO")} 〕⬣\n`;

      text +=
        `┃ ✅ ${fytBold("CONFIRMADO")}\n`;

      text +=
        `╰━━━━━━━━━━━━⬣\n\n`;

      text +=
        `┃ @${normalizedSender.split("@")[0]} y @${targetJid.split("@")[0]}\n`;

      text +=
        `┃ han terminado su matrimonio.\n\n`;

      text +=
        `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

      return await socket.sendMessage(
        remoteJid,
        {
          text,
          mentions: [
            normalizedSender,
            targetJid,
          ],
        },
        { quoted: message },
      );
    }

    /*
     * ============================================================
     * SOLICITUD PROPIA PENDIENTE
     * ============================================================
     */

    if (
      pending &&
      pending.from ===
        normalizedSender
    ) {
      if (
        pending.type === "divorce"
      ) {
        const left =
          formatTimeLeft(
            pending.expiresAt,
          );

        let text =
          `╭〔 ⏳ ${fytBold("SOLICITUD PENDIENTE")} 〕⬣\n`;

        text +=
          `┃ > Ya enviaste una solicitud de divorcio.\n`;

        text +=
          `┃ > Espera que @${pending.to.split("@")[0]} confirme con *${prefix}divorce*.\n`;

        text +=
          `┃ > Tiempo restante: *${left}*\n`;

        text +=
          `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

        return await socket.sendMessage(
          remoteJid,
          {
            text,
            mentions: [
              pending.to,
            ],
          },
          { quoted: message },
        );
      }
    }

    /*
     * ============================================================
     * OTRA SOLICITUD ACTIVA
     * ============================================================
     */

    if (
      pending &&
      pending.from !==
        normalizedSender &&
      pending.to !==
        normalizedSender
    ) {
      const left =
        formatTimeLeft(
          pending.expiresAt,
        );

      let text =
        `╭〔 ⏳ ${fytBold("SOLICITUD ACTIVA")} 〕⬣\n`;

      text +=
        `┃ > Hay otra solicitud en curso entre @${pending.from.split("@")[0]} y @${pending.to.split("@")[0]}.\n`;

      text +=
        `┃ > Tiempo restante: *${left}*\n`;

      text +=
        `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

      return await socket.sendMessage(
        remoteJid,
        {
          text,
          mentions: [
            pending.from,
            pending.to,
          ],
        },
        { quoted: message },
      );
    }

    /*
     * ============================================================
     * NO ESTÁ CASADO
     * ============================================================
     */

    if (!user.marriedTo) {
      let text =
        `╭〔 ❌ ${fytBold("NO ESTÁS CASAD@")} 〕⬣\n`;

      text +=
        `┃ > No estás casado/a.\n`;

      text +=
        `┃ > Usa *${prefix}marry @usuario* para solicitar matrimonio.\n`;

      text +=
        `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

      return await socket.sendMessage(
        remoteJid,
        { text },
        { quoted: message },
      );
    }

    /*
     * ============================================================
     * OBJETIVO INCORRECTO
     * ============================================================
     */

    if (
      user.marriedTo !==
      targetJid
    ) {
      let text =
        `╭〔 ❌ ${fytBold("NO PUEDES DIVORCIAR")} 〕⬣\n`;

      text +=
        `┃ > Estás casado/a con @${user.marriedTo.split("@")[0]}.\n`;

      text +=
        `┃ > Usa *${prefix}divorce @${user.marriedTo.split("@")[0]}* para solicitar el divorcio correcto.\n`;

      text +=
        `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

      return await socket.sendMessage(
        remoteJid,
        {
          text,
          mentions: [
            user.marriedTo,
          ],
        },
        { quoted: message },
      );
    }

    /*
     * ============================================================
     * CREAR SOLICITUD DE DIVORCIO
     * ============================================================
     */

    setMarriagePending(
      group,
      normalizedSender,
      targetJid,
      "divorce",
    );

    if (
      typeof saveDB ===
      "function"
    ) {
      saveDB(db);
    }

    const left =
      formatTimeLeft(
        group.marriagePending
          .expiresAt,
      );

    let text =
      `╭〔 💔 ${fytBold("DIVORCIO")} 〕⬣\n`;

    text +=
      `┃ ⏳ ${fytBold("ESPERANDO CONFIRMACIÓN")}\n`;

    text +=
      `╰━━━━━━━━━━━━⬣\n\n`;

    text +=
      `┃ @${normalizedSender.split("@")[0]} solicita divorcio.\n`;

    text +=
      `┃ @${targetJid.split("@")[0]} confirma con:\n`;

    text +=
      `┃ ➪ *${prefix}divorce @${normalizedSender.split("@")[0]}*\n`;

    text +=
      `┃ ➪ o *${prefix}divorce* (respondiendo)\n\n`;

    text +=
      `┃ ⏱️ Tiempo: *${left}*\n\n`;

    text +=
      `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

    return await socket.sendMessage(
      remoteJid,
      {
        text,
        mentions: [
          normalizedSender,
          targetJid,
        ],
      },
      { quoted: message },
    );
  },
};