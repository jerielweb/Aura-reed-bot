// marry.js
import { resolveToLid, resolveLidToRealJid } from "../../models/utils.js";
import { getProfileUser } from "../../models/profileUtils.js";
import { ensureGroup } from "../../models/groupDb.js";
import { fytBold } from "../../models/TextStyle.js";
import {
  getMarriagePending,
  setMarriagePending,
  clearMarriagePending,
  formatTimeLeft,
} from "../../models/marriageUtils.js";

async function resolveTargetFromMessage(message, socket, remoteJid) {
  const ctx = message.message?.extendedTextMessage?.contextInfo;
  let targetJid = null;
  if (ctx?.mentionedJid?.length > 0) targetJid = ctx.mentionedJid[0];
  else if (ctx?.participant) targetJid = ctx.participant;
  if (!targetJid) return null;
  return resolveToLid(targetJid, socket, remoteJid);
}

export default {
  name: ["marry", "casar", "matrimonio"],
  category: "profile",
  description: "Solicitar matrimonio.",
  execute: async (
    socket,
    message,
    args,
    { db, saveDB, jidRemitente, prefix },
  ) => {
    const remoteJid = message.key.remoteJid;

    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `${fytBold("ACCION INCOMPATIBLE")} \n╰━━━━━━━━━━━━⬣\n\n`;
      text += `> Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const userLid = await resolveToLid(jidRemitente, socket, remoteJid);
    const group = ensureGroup(db, remoteJid);
    const user = getProfileUser(db, remoteJid, userLid);
    let targetLid = await resolveTargetFromMessage(message, socket, remoteJid);
    const pending = getMarriagePending(group);

    if (!targetLid && pending?.to === userLid) {
      targetLid = pending.from;
    }

    if (!targetLid) {
      if (user.marriedTo) {
        targetLid = user.marriedTo;
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

    if (targetLid === userLid) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `${fytBold("ACCIÓN INVÁLIDA")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No puedes usar este comando contigo mismo.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ERROR")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const partner = getProfileUser(db, remoteJid, targetLid);

    if (pending && pending.to === userLid && pending.from === targetLid) {
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

      user.marriedTo = targetLid;
      partner.marriedTo = userLid;

      clearMarriagePending(group);
      if (typeof saveDB === "function") saveDB(db);

      const userRealJid = await resolveLidToRealJid(userLid, socket, remoteJid);
      const targetRealJid = await resolveLidToRealJid(targetLid, socket, remoteJid);

      let text = `╭〔 💍 ${fytBold("MATRIMONIO")} 〕⬣\n`;
      text += `┃ 💕 ¡${fytBold("CONFIRMADO")}!\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ @${userRealJid.split("@")[0]} 💕 @${targetRealJid.split("@")[0]}\n`;
      text += `┃ Se han casado.\n`;
      text += `┃ Los declaro marido y mujer, ¡felicidades! 🎉\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [userRealJid, targetRealJid] },
        { quoted: message },
      );
    }

    if (pending && pending.from === userLid) {
      if (pending.type === "marry") {
        const left = formatTimeLeft(pending.expiresAt);
        const pendingToReal = await resolveLidToRealJid(pending.to, socket, remoteJid);
        let text = `╭〔 ⏳ ${fytBold("SOLICITUD PENDIENTE")} 〕⬣\n\n`;
        text += `┃ > Ya enviaste una solicitud de matrimonio.\n`;
        text += `┃ > Espera que @${pendingToReal.split("@")[0]} confirme con *${prefix}marry*.\n`;
        text += `┃ > Tiempo restante: *${left}*\n\n`;
        text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text, mentions: [pendingToReal] },
          { quoted: message },
        );
      }
    }

    if (
      pending &&
      pending.from !== userLid &&
      pending.to !== userLid
    ) {
      const left = formatTimeLeft(pending.expiresAt);
      const fromReal = await resolveLidToRealJid(pending.from, socket, remoteJid);
      const toReal = await resolveLidToRealJid(pending.to, socket, remoteJid);
      let text = `╭〔 ⏳ ${fytBold("SOLICITUD ACTIVA")} 〕⬣\n\n`;
      text += `┃ > Hay otra solicitud en curso entre @${fromReal.split("@")[0]} y @${toReal.split("@")[0]}.\n`;
      text += `┃ > Tiempo restante: *${left}*\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [fromReal, toReal] },
        { quoted: message },
      );
    }

    if (user.marriedTo) {
      const marriedReal = await resolveLidToRealJid(user.marriedTo, socket, remoteJid);
      if (user.marriedTo === targetLid) {
        let text = `╭〔 ⚠️ ${fytBold("YA CASADOS")} 〕⬣\n\n`;
        text += `┃ > Ya estás casado/a con @${marriedReal.split("@")[0]}.\n`;
        text += `┃ > Usa *${prefix}divorce @${marriedReal.split("@")[0]}* para solicitar divorcio.\n\n`;
        text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text, mentions: [marriedReal] },
          { quoted: message },
        );
      }
      let text = `╭〔 ❌ ${fytBold("NO PUEDES CASARTE")} 〕⬣\n\n`;
      text += `┃ > Estás casado/a con @${marriedReal.split("@")[0]}.\n`;
      text += `┃ > Primero debes divorciarte para casarte con otra persona.\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [marriedReal] },
        { quoted: message },
      );
    }

    if (partner.marriedTo) {
      const partnerReal = await resolveLidToRealJid(targetLid, socket, remoteJid);
      let text = `╭〔 ❌ ${fytBold("YA CASADO/A")} 〕⬣\n\n`;
      text += `┃ > Esa persona ya está casada.\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [partnerReal] },
        { quoted: message },
      );
    }

    setMarriagePending(group, userLid, targetLid, "marry");
    if (typeof saveDB === "function") saveDB(db);
    const left = formatTimeLeft(group.marriagePending.expiresAt);

    const userRealJid = await resolveLidToRealJid(userLid, socket, remoteJid);
    const targetRealJid = await resolveLidToRealJid(targetLid, socket, remoteJid);

    let text = `╭〔 💍 ${fytBold("MATRIMONIO")} 〕⬣\n`;
    text += `┃ ⏳ ${fytBold("ESPERANDO CONFIRMACIÓN")}\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ @${userRealJid.split("@")[0]} quiere casarse contigo.\n`;
    text += `┃ @${targetRealJid.split("@")[0]} acepta con:\n`;
    text += `┃ ➪ *${prefix}marry @${userRealJid.split("@")[0]}*\n`;
    text += `┃ ➪ o *${prefix}marry* (respondiendo)\n\n`;
    text += `┃ ⏱️ Tiempo: *${left}*\n\n`;
    text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
    return await socket.sendMessage(
      remoteJid,
      { text, mentions: [userRealJid, targetRealJid] },
      { quoted: message },
    );
  },
};