import { resolveLidToRealJid } from "../../models/utils.js";
import { getProfileUser } from "../../models/profileUtils.js";
import { ensureGroup } from "../../models/groupDb.js";
import { fytBold } from "../../models/TextStyle.js";

import {
  getMarriagePending,
  setMarriagePending,
  clearMarriagePending,
  formatTimeLeft,
} from "../../models/marriageUtils.js";

import { jidNormalizedUser } from "@whiskeysockets/baileys";


// ============================================================
// RESOLVER JID REAL
// ============================================================
//
// Convierte:
//   123456789@s.whatsapp.net -> 123456789@s.whatsapp.net
//   123456789@lid            -> JID real si Baileys lo conoce
//
// Si no consigue resolver un LID, lo devuelve como @lid.
// Por eso más abajo comprobamos si realmente conseguimos
// un @s.whatsapp.net.
// ============================================================

async function resolveRealJid(
  jid,
  socket,
  remoteJid,
) {
  if (!jid) {
    return null;
  }

  try {
    const resolved =
      await resolveLidToRealJid(
        jid,
        socket,
        remoteJid,
      );

    if (!resolved) {
      return null;
    }

    return jidNormalizedUser(
      resolved,
    );
  } catch (error) {
    console.error(
      "[MARRY] Error resolviendo JID:",
      error?.message || error,
    );

    try {
      return jidNormalizedUser(
        jid,
      );
    } catch {
      return jid;
    }
  }
}


// ============================================================
// COMPROBAR SI ES UN JID REAL CON NÚMERO
// ============================================================

function isRealPhoneJid(jid) {
  return (
    typeof jid === "string" &&
    jid.endsWith("@s.whatsapp.net")
  );
}


// ============================================================
// OBTENER SOLO EL NÚMERO
// ============================================================
//
// 50688888888@s.whatsapp.net
//          ↓
// 50688888888
//
// IMPORTANTE:
// Si todavía tenemos @lid, NO fingimos que ese LID es
// un número de teléfono.
// ============================================================

function getPhoneNumber(jid) {
  if (!isRealPhoneJid(jid)) {
    return null;
  }

  const number =
    jid
      .split("@")[0]
      .split(":")[0]
      .replace(/\D/g, "");

  return number || null;
}


// ============================================================
// FORMATO PARA MOSTRAR PERSONA
// ============================================================
//
// La mención de WhatsApp puede aparecer como:
//
//   @Trolerant_YT
//
// aunque internamente estemos mencionando:
//
//   50688888888@s.whatsapp.net
//
// Para que el bot no dependa de cómo WhatsApp renderiza
// la mención, añadimos también el número real.
// ============================================================

function formatPerson(jid) {
  const phone =
    getPhoneNumber(jid);

  if (phone) {
    return `@${phone}`;
  }

  if (jid) {
    return `@${String(jid)
      .split("@")[0]
      .split(":")[0]}`;
  }

  return "@desconocido";
}


// ============================================================
// OBTENER REMITENTE REAL DEL MENSAJE ACTUAL
// ============================================================
//
// MUY IMPORTANTE:
//
// message.key.participant
//     = quien escribió el mensaje ACTUAL.
//
// contextInfo.participant
//     = quien escribió el mensaje CITADO.
//
// No debemos mezclarlos.
//
// Primero intentamos message.key.participant.
// ============================================================

async function resolveCurrentSender(
  message,
  socket,
  remoteJid,
  jidRemitente,
) {
  const candidates = [];

  if (
    message?.key?.participant
  ) {
    candidates.push(
      message.key.participant,
    );
  }

  if (
    message?.key?.senderPn
  ) {
    candidates.push(
      message.key.senderPn,
    );
  }

  if (jidRemitente) {
    candidates.push(
      jidRemitente,
    );
  }


  for (
    const candidate of candidates
  ) {
    const resolved =
      await resolveRealJid(
        candidate,
        socket,
        remoteJid,
      );

    if (
      resolved &&
      isRealPhoneJid(resolved)
    ) {
      return resolved;
    }
  }


  /*
   * Si ninguno pudo convertirse a JID real,
   * devolvemos el primero normalizado como
   * último recurso.
   */

  for (
    const candidate of candidates
  ) {
    if (!candidate) {
      continue;
    }

    try {
      return jidNormalizedUser(
        candidate,
      );
    } catch {}
  }

  return null;
}


// ============================================================
// OBTENER OBJETIVO DEL MENSAJE
// ============================================================
//
// Orden:
//
// 1. Mención
// 2. Mensaje citado
//
// contextInfo.participant es el AUTOR DEL MENSAJE CITADO.
// ============================================================

async function resolveTargetFromMessage(
  message,
  socket,
  remoteJid,
) {
  const ctx =
    message
      ?.message
      ?.extendedTextMessage
      ?.contextInfo;

  let targetJid = null;


  // ----------------------------------------------------------
  // 1. Mención
  // ----------------------------------------------------------

  if (
    ctx?.mentionedJid?.length > 0
  ) {
    targetJid =
      ctx.mentionedJid[0];
  }


  // ----------------------------------------------------------
  // 2. Respuesta a mensaje
  // ----------------------------------------------------------

  else if (
    ctx?.participant
  ) {
    targetJid =
      ctx.participant;
  }


  if (!targetJid) {
    return null;
  }


  const resolved =
    await resolveRealJid(
      targetJid,
      socket,
      remoteJid,
    );


  if (!resolved) {
    return null;
  }


  return jidNormalizedUser(
    resolved,
  );
}


// ============================================================
// COMANDO MARRY
// ============================================================

export default {

  name: [
    "marry",
    "casar",
    "matrimonio",
  ],

  category: "profile",

  description:
    "Solicitar matrimonio.",


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
      message?.key?.remoteJid;


    // ========================================================
    // VALIDAR GRUPO
    // ========================================================

    if (
      !remoteJid ||
      !remoteJid.endsWith("@g.us")
    ) {

      let text =
        `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;

      text +=
        `${fytBold("ACCION INCONPATIBLE")} \n`;

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


    // ========================================================
    // RESOLVER QUIÉN MANDÓ EL MENSAJE ACTUAL
    // ========================================================

    const normalizedSender =
      await resolveCurrentSender(
        message,
        socket,
        remoteJid,
        jidRemitente,
      );


    if (!normalizedSender) {

      console.error(
        "[MARRY] No se pudo identificar al remitente.",
      );

      return;
    }


    // ========================================================
    // GRUPO
    // ========================================================

    const group =
      ensureGroup(
        db,
        remoteJid,
      );


    // ========================================================
    // PERFIL DEL REMITENTE
    // ========================================================

    const user =
      getProfileUser(
        db,
        remoteJid,
        normalizedSender,
      );


    // ========================================================
    // SOLICITUD PENDIENTE
    // ========================================================

    const pending =
      getMarriagePending(
        group,
      );


    // ========================================================
    // RESOLVER OBJETIVO
    // ========================================================

    let targetJid =
      await resolveTargetFromMessage(
        message,
        socket,
        remoteJid,
      );


    if (targetJid) {
      targetJid =
        jidNormalizedUser(
          targetJid,
        );
    }


    // ========================================================
    // SI EL USUARIO ESTÁ RESPONDIENDO A UNA SOLICITUD
    // ========================================================
    //
    // A solicita:
    //
    // pending.from = A
    // pending.to   = B
    //
    // B responde:
    //
    // .marry
    //
    // Entonces:
    //
    // normalizedSender = B
    //
    // y debemos poner:
    //
    // targetJid = A
    //
    // ========================================================

    if (
      pending &&
      pending.type === "marry" &&
      pending.to === normalizedSender
    ) {

      /*
       * Si no detectamos el mensaje citado,
       * usamos directamente a quien hizo la solicitud.
       */

      if (!targetJid) {
        targetJid =
          pending.from;
      }
    }


    // ========================================================
    // SI TENEMOS OBJETIVO PERO TODAVÍA ES LID
    // ========================================================

    if (
      targetJid &&
      !isRealPhoneJid(targetJid)
    ) {

      const resolvedTarget =
        await resolveRealJid(
          targetJid,
          socket,
          remoteJid,
        );

      if (
        resolvedTarget &&
        isRealPhoneJid(resolvedTarget)
      ) {
        targetJid =
          resolvedTarget;
      }
    }


    // ========================================================
    // SI NO HAY OBJETIVO
    // ========================================================

    if (!targetJid) {

      // ------------------------------------------------------
      // Si ya está casado, usar su pareja
      // ------------------------------------------------------

      if (user.marriedTo) {

        const resolvedPartner =
          await resolveRealJid(
            user.marriedTo,
            socket,
            remoteJid,
          );

        targetJid =
          resolvedPartner ||
          user.marriedTo;

      } else {

        let text =
          `╭〔 ⚠️ ${fytBold("FALTA OBJETIVO")} 〕⬣\n\n`;

        text +=
          `┃ > Menciona o responde a la persona.\n`;

        text +=
          `┃ > Matrimonio: *${prefix}marry @usuario*\n`;

        text +=
          `┣━━━━━━━━━━━━⬣\n`;

        text +=
          `┃ > _Ejemplo:_\n`;

        text +=
          `┃ > *${prefix}marry @pareja*\n`;

        text +=
          `┃ > *${prefix}marry* (respondiendo)\n\n`;

        text +=
          `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;


        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }
    }


    // ========================================================
    // NORMALIZAR OBJETIVO
    // ========================================================

    if (targetJid) {
      targetJid =
        jidNormalizedUser(
          targetJid,
        );
    }


    // ========================================================
    // NO CASARSE CONSIGO MISMO
    // ========================================================

    if (
      targetJid ===
      normalizedSender
    ) {

      let text =
        `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;

      text +=
        `${fytBold("ACCIÓN INVÁLIDA")}\n`;

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


    // ========================================================
    // PERFIL DEL OBJETIVO
    // ========================================================

    const partner =
      getProfileUser(
        db,
        remoteJid,
        targetJid,
      );


    // ========================================================
    // CONFIRMAR MATRIMONIO
    // ========================================================

    if (
      pending &&
      pending.type === "marry" &&
      pending.to === normalizedSender &&
      pending.from === targetJid
    ) {

      // ------------------------------------------------------
      // COMPROBAR SI ALGUNO YA ESTÁ CASADO
      // ------------------------------------------------------

      if (
        user.marriedTo ||
        partner.marriedTo
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
          `╭〔 ❌ ${fytBold("OPERACIÓN NO PERMITIDA")} 〕⬣\n`;

        text +=
          `${fytBold("YA ESTAS CASAD@")}\n`;

        text +=
          `╰━━━━━━━━━━━━⬣\n\n`;

        text +=
          `┃ > No puedes casarte: ya estás casado/a.\n\n`;

        text +=
          `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;


        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }


      // ------------------------------------------------------
      // GUARDAR MATRIMONIO
      // ------------------------------------------------------

      user.marriedTo =
        targetJid;

      partner.marriedTo =
        normalizedSender;


      clearMarriagePending(
        group,
      );


      if (
        typeof saveDB ===
        "function"
      ) {
        saveDB(db);
      }


      // ------------------------------------------------------
      // NÚMEROS
      // ------------------------------------------------------

      const senderNumber =
        getPhoneNumber(
          normalizedSender,
        );

      const targetNumber =
        getPhoneNumber(
          targetJid,
        );


      let text =
        `╭〔 💍 ${fytBold("MATRIMONIO")} 〕⬣\n`;

      text +=
        `┃ 💕 ¡${fytBold("CONFIRMADO")}!\n`;

      text +=
        `╰━━━━━━━━━━━━⬣\n\n`;

      text +=
        `┃ ${formatPerson(normalizedSender)} 💕 ${formatPerson(targetJid)}\n`;

      if (
        senderNumber &&
        targetNumber
      ) {
        text +=
          `┃ 📱 ${senderNumber} 💕 ${targetNumber}\n`;
      }

      text +=
        `┃ Se han casado.\n`;

      text +=
        `┃ Los declaro marido y mujer, ¡felicidades! 🎉\n\n`;

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
        {
          quoted: message,
        },
      );
    }


    // ========================================================
    // EL SOLICITANTE YA TIENE UNA SOLICITUD
    // ========================================================

    if (
      pending &&
      pending.from ===
        normalizedSender
    ) {

      if (
        pending.type ===
        "marry"
      ) {

        const left =
          formatTimeLeft(
            pending.expiresAt,
          );


        const targetNumber =
          getPhoneNumber(
            pending.to,
          );


        let text =
          `╭〔 ⏳ ${fytBold("SOLICITUD PENDIENTE")} 〕⬣\n\n`;

        text +=
          `┃ > Ya enviaste una solicitud de matrimonio.\n`;

        text +=
          `┃ > Espera que ${formatPerson(pending.to)} confirme con *${prefix}marry*.\n`;

        if (targetNumber) {
          text +=
            `┃ > 📱 Número: *${targetNumber}*\n`;
        }

        text +=
          `┃ > Tiempo restante: *${left}*\n\n`;

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
          {
            quoted: message,
          },
        );
      }
    }


    // ========================================================
    // HAY OTRA SOLICITUD ACTIVA
    // ========================================================

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


      const fromNumber =
        getPhoneNumber(
          pending.from,
        );

      const toNumber =
        getPhoneNumber(
          pending.to,
        );


      let text =
        `╭〔 ⏳ ${fytBold("SOLICITUD ACTIVA")} 〕⬣\n\n`;

      text +=
        `┃ > Hay otra solicitud en curso entre ${formatPerson(pending.from)} y ${formatPerson(pending.to)}.\n`;

      if (
        fromNumber &&
        toNumber
      ) {
        text +=
          `┃ > 📱 Números: *${fromNumber}* y *${toNumber}*\n`;
      }

      text +=
        `┃ > Tiempo restante: *${left}*\n\n`;

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
        {
          quoted: message,
        },
      );
    }


    // ========================================================
    // YA ESTÁ CASADO
    // ========================================================

    if (
      user.marriedTo
    ) {

      const marriedJid =
        await resolveRealJid(
          user.marriedTo,
          socket,
          remoteJid,
        ) ||
        user.marriedTo;


      if (
        marriedJid ===
        targetJid
      ) {

        const marriedNumber =
          getPhoneNumber(
            targetJid,
          );


        let text =
          `╭〔 ⚠️ ${fytBold("YA CASADOS")} 〕⬣\n\n`;

        text +=
          `┃ > Ya estás casado/a con ${formatPerson(targetJid)}.\n`;

        if (marriedNumber) {
          text +=
            `┃ > 📱 Número: *${marriedNumber}*\n`;
        }

        text +=
          `┃ > Usa *${prefix}divorce* para solicitar divorcio.\n\n`;

        text +=
          `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;


        return await socket.sendMessage(
          remoteJid,
          {
            text,
            mentions: [
              targetJid,
            ],
          },
          {
            quoted: message,
          },
        );
      }


      const marriedNumber =
        getPhoneNumber(
          marriedJid,
        );


      let text =
        `╭〔 ❌ ${fytBold("NO PUEDES CASARTE")} 〕⬣\n\n`;

      text +=
        `┃ > Estás casado/a con ${formatPerson(marriedJid)}.\n`;

      if (marriedNumber) {
        text +=
          `┃ > 📱 Número: *${marriedNumber}*\n`;
      }

      text +=
        `┃ > Primero debes divorciarte para casarte con otra persona.\n\n`;

      text +=
        `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;


      return await socket.sendMessage(
        remoteJid,
        {
          text,
          mentions: [
            marriedJid,
          ],
        },
        {
          quoted: message,
        },
      );
    }


    // ========================================================
    // LA OTRA PERSONA YA ESTÁ CASADA
    // ========================================================

    if (
      partner.marriedTo
    ) {

      let text =
        `╭〔 ❌ ${fytBold("YA CASADO/A")} 〕⬣\n\n`;

      text +=
        `┃ > Esa persona ya está casada.\n\n`;

      text +=
        `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;


      return await socket.sendMessage(
        remoteJid,
        {
          text,
        },
        {
          quoted: message,
        },
      );
    }
setMarriagePending(
      group,
      normalizedSender,
      targetJid,
      "marry",
    );


    if (
      typeof saveDB ===
      "function"
    ) {
      saveDB(db);
    }


    const left =
      formatTimeLeft(
        group
          .marriagePending
          .expiresAt,
      );


    const senderNumber =
      getPhoneNumber(
        normalizedSender,
      );

    const targetNumber =
      getPhoneNumber(
        targetJid,
      );


    // ========================================================
    // MENSAJE DE SOLICITUD
    // ========================================================

    let text =
      `╭〔 💍 ${fytBold("MATRIMONIO")} 〕⬣\n`;

    text +=
      `┃ ⏳ ${fytBold("ESPERANDO CONFIRMACIÓN")}\n`;

    text +=
      `╰━━━━━━━━━━━━⬣\n\n`;

    text +=
      `┃ ${formatPerson(normalizedSender)} quiere casarse contigo.\n`;

    if (senderNumber) {
      text +=
        `┃ 📱 Número: *${senderNumber}*\n`;
    }

    text +=
      `┃ ${formatPerson(targetJid)} acepta con:\n`;

    text +=
      `┃ ➪ *${prefix}marry @${senderNumber || normalizedSender.split("@")[0]}*\n`;

    text +=
      `┃ ➪ o *${prefix}marry* (respondiendo)\n\n`;

    if (targetNumber) {
      text +=
        `┃ 📱 Número de destino: *${targetNumber}*\n`;
    }

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
      {
        quoted: message,
      },
    );
  },
};