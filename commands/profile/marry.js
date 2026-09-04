import { resolveToLid } from "../../models/utils.js";
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

async function resolveTargetFromMessage(
  message,
  socket,
  remoteJid,
  rawParticipant,
  rawMentionedJid,
) {
  const ctx = message.message?.extendedTextMessage?.contextInfo;
  let targetJid = null;
  if (rawMentionedJid?.length > 0) targetJid = rawMentionedJid[0];
  else if (rawParticipant) targetJid = rawParticipant;
  else if (ctx?.mentionedJid?.length > 0) targetJid = ctx.mentionedJid[0];
  else if (ctx?.participant) targetJid = ctx.participant;
  if (!targetJid) return null;
  const resolved = await resolveToLid(targetJid, socket, remoteJid);
  return resolved || targetJid; // Guarda el LID/JID tal cual llegue
}

export default {
  name: ["marry", "casar", "matrimonio"],
  category: "profile",
  description: "Solicitar matrimonio.",
  execute: async (
    socket,
    message,
    args,
    {
      db,
      saveDB,
      jidRemitente,
      prefix,
      senderRaw,
      rawParticipant,
      rawMentionedJid,
    },
  ) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `${fytBold("ACCION INCONPATIBLE")} \n╰━━━━━━━━━━━━⬣\n\n`;
      text += `> Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const resolvedSender = await resolveToLid(
      senderRaw || jidRemitente,
      socket,
      remoteJid,
    );
    // Guardamos la clave principal del usuario (puede ser LID)
    const senderKey = resolvedSender || senderRaw || jidRemitente;
    const group = ensureGroup(db, remoteJid);
    const user = getProfileUser(db, remoteJid, senderKey);
    
    let targetKey = await resolveTargetFromMessage(
      message,
      socket,
      remoteJid,
      rawParticipant,
      rawMentionedJid,
    );
    const pending = getMarriagePending(group);

    if (!targetKey && pending?.to === senderKey) {
      targetKey = pending.from;
    }

    if (!targetKey) {
      if (user.marriedTo) {
        targetKey = user.marriedTo;
      } else {
        let text = `╭〔 ⚠️ ${fytBold("FALTA OBJETIVO")} 〕⬣\n\n`;
        text += `┃ > Menciona o responde a la persona.\n`;
        text += `┃ > Matrimonio: *${prefix}marry @usuario*\n`;
        text += `┣━━━━━━━━━━━━⬣\n`;
        text += `┃ > _Ejemplo:_\n`;
        text += `┃ > *${prefix}marry @pareja*\n`;
        text += `┃ > *${prefix}marry* (respondiendo)\n\n`;
        text += `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }
    }

    if (targetKey === senderKey) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `${fytBold("ACCIÓN INVÁLIDA")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No puedes usar este comando contigo mismo.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ERROR")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const partner = getProfileUser(db, remoteJid, targetKey);

    if (pending && pending.to === senderKey && pending.from === targetKey) {
      if (pending.type !== "marry") {
        let text = `╭〔 ❌ ${fytBold("ERROR")} 〕⬣\n\n`;
        text += `┃ > Esta solicitud no es de matrimonio.\n\n`;
        text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }

      if (user.marriedTo || partner.marriedTo) {
        clearMarriagePending(group);
        if (typeof saveDB === "function") saveDB(db);
        let text = `╭〔 ❌ ${fytBold("OPERACIÓN NO PERMITIDA")} 〕⬣\n`;
        text += `${fytBold("YA ESTAS CASAD@")}\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > No puedes casarte: ya estás casado/a.\n\n`;
        text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }

      // Asignación de pareja
      if (!db.users) db.users = {};
      let globalUser = db.users[senderKey] || {};
      let globalPartner = db.users[targetKey] || {};

      globalUser.marriedTo = targetKey;
      globalPartner.marriedTo = senderKey;

      // Forzar reasignación para que el Proxy guarde en SQLite
      db.users[senderKey] = globalUser;
      db.users[targetKey] = globalPartner;

      clearMarriagePending(group);
      if (typeof saveDB === "function") saveDB(db);

      const senderNorm = jidNormalizedUser(senderKey);
      const targetNorm = jidNormalizedUser(targetKey);

      let text = `╭〔 💍 ${fytBold("MATRIMONIO")} 〕⬣\n`;
      text += `┃ 💕 ¡${fytBold("CONFIRMADO")}!\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ @${senderNorm.split("@")[0]} 💕 @${targetNorm.split("@")[0]}\n`;
      text += `┃ Se han casado.\n`;
      text += `┃ Los declaro marido y mujer, ¡felicidades! 🎉\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [senderNorm, targetNorm] },
        { quoted: message },
      );
    }

    if (pending && pending.from === senderKey) {
      if (pending.type === "marry") {
        const left = formatTimeLeft(pending.expiresAt);
        const pendingToNorm = jidNormalizedUser(pending.to);
        let text = `╭〔 ⏳ ${fytBold("SOLICITUD PENDIENTE")} 〕⬣\n\n`;
        text += `┃ > Ya enviaste una solicitud de matrimonio.\n`;
        text += `┃ > Espera que @${pendingToNorm.split("@")[0]} confirme con *${prefix}marry*.\n`;
        text += `┃ > Tiempo restante: *${left}*\n\n`;
        text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text, mentions: [pendingToNorm] },
          { quoted: message },
        );
      }
    }

    if (
      pending &&
      pending.from !== senderKey &&
      pending.to !== senderKey
    ) {
      const left = formatTimeLeft(pending.expiresAt);
      let text = `╭〔 ⏳ ${fytBold("SOLICITUD ACTIVA")} 〕⬣\n\n`;
      text += `┃ > Hay otra solicitud en curso.\n`;
      text += `┃ > Tiempo restante: *${left}*\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    if (user.marriedTo) {
      const marriedNorm = jidNormalizedUser(user.marriedTo);
      if (user.marriedTo === targetKey) {
        let text = `╭〔 ⚠️ ${fytBold("YA CASADOS")} 〕⬣\n\n`;
        text += `┃ > Ya estás casado/a con @${marriedNorm.split("@")[0]}.\n`;
        text += `┃ > Usa *${prefix}divorce @${marriedNorm.split("@")[0]}* para solicitar divorcio.\n\n`;
        text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text, mentions: [marriedNorm] },
          { quoted: message },
        );
      }
      let text = `╭〔 ❌ ${fytBold("NO PUEDES CASARTE")} 〕⬣\n\n`;
      text += `┃ > Estás casado/a con @${marriedNorm.split("@")[0]}.\n`;
      text += `┃ > Primero debes divorciarte para casarte con otra persona.\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [marriedNorm] },
        { quoted: message },
      );
    }

    if (partner.marriedTo) {
      let text = `╭〔 ❌ ${fytBold("YA CASADO/A")} 〕⬣\n\n`;
      text += `┃ > Esa persona ya está casada.\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    setMarriagePending(group, senderKey, targetKey, "marry");
    if (typeof saveDB === "function") saveDB(db);
    const left = formatTimeLeft(group.marriagePending.expiresAt);
    const senderNorm = jidNormalizedUser(senderKey);
    const targetNorm = jidNormalizedUser(targetKey);

    let text = `╭〔 💍 ${fytBold("MATRIMONIO")} 〕⬣\n`;
    text += `┃ ⏳ ${fytBold("ESPERANDO CONFIRMACIÓN")}\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ @${senderNorm.split("@")[0]} quiere casarse contigo.\n`;
    text += `┃ @${targetNorm.split("@")[0]} acepta con:\n`;
    text += `┃ ➪ *${prefix}marry @${senderNorm.split("@")[0]}*\n`;
    text += `┃ ➪ o *${prefix}marry* (respondiendo)\n\n`;
    text += `┃ ⏱️ Tiempo: *${left}*\n\n`;
    text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
    return await socket.sendMessage(
      remoteJid,
      { text, mentions: [senderNorm, targetNorm] },
      { quoted: message },
    );
  },
};
