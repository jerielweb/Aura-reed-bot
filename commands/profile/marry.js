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

async function resolveTargetFromMessage(message, socket, remoteJid) {
  const ctx = message.message?.extendedTextMessage?.contextInfo;
  let targetJid = null;
  if (ctx?.mentionedJid?.length > 0) targetJid = ctx.mentionedJid[0];
  else if (ctx?.participant) targetJid = ctx.participant;
  if (!targetJid) return null;
  const resolved = await resolveLidToRealJid(targetJid, socket, remoteJid);
  return resolved ? jidNormalizedUser(resolved) : null;
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
      text += `${fytBold("ACCION INCONPATIBLE")} \n╰━━━━━━━━━━━━⬣\n\n`;
      text += `> Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const resolvedSender = await resolveLidToRealJid(
      jidRemitente,
      socket,
      remoteJid,
    );
    const normalizedSender = jidNormalizedUser(
      resolvedSender || jidRemitente,
    );
    const group = ensureGroup(db, remoteJid);
    const user = getProfileUser(db, remoteJid, normalizedSender);
    let targetJid = await resolveTargetFromMessage(message, socket, remoteJid);
    if (targetJid) targetJid = jidNormalizedUser(targetJid);
    const pending = getMarriagePending(group);

    if (!targetJid && pending?.to === normalizedSender) {
      targetJid = pending.from;
    }

    if (!targetJid) {
      if (user.marriedTo) {
        targetJid = user.marriedTo;
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

    if (targetJid === normalizedSender) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `${fytBold("ACCIÓN INVÁLIDA")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No puedes usar este comando contigo mismo.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ERROR")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const partner = getProfileUser(db, remoteJid, targetJid);

    if (pending && pending.to === normalizedSender && pending.from === targetJid) {
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

      user.marriedTo = targetJid;
      partner.marriedTo = normalizedSender;
      clearMarriagePending(group);
      if (typeof saveDB === "function") saveDB(db);
      let text = `╭〔 💍 ${fytBold("MATRIMONIO")} 〕⬣\n`;
      text += `┃ 💕 ¡${fytBold("CONFIRMADO")}!\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ @${normalizedSender.split("@")[0]} 💕 @${targetJid.split("@")[0]}\n`;
      text += `┃ Se han casado.\n`;
      text += `┃ Los declaro marido y mujer, ¡felicidades! 🎉\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [normalizedSender, targetJid] },
        { quoted: message },
      );
    }

    if (pending && pending.from === normalizedSender) {
      if (pending.type === "marry") {
        const left = formatTimeLeft(pending.expiresAt);
        let text = `╭〔 ⏳ ${fytBold("SOLICITUD PENDIENTE")} 〕⬣\n\n`;
        text += `┃ > Ya enviaste una solicitud de matrimonio.\n`;
        text += `┃ > Espera que @${pending.to.split("@")[0]} confirme con *${prefix}marry*.\n`;
        text += `┃ > Tiempo restante: *${left}*\n\n`;
        text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text, mentions: [pending.to] },
          { quoted: message },
        );
      }
    }

    if (
      pending &&
      pending.from !== normalizedSender &&
      pending.to !== normalizedSender
    ) {
      const left = formatTimeLeft(pending.expiresAt);
      let text = `╭〔 ⏳ ${fytBold("SOLICITUD ACTIVA")} 〕⬣\n\n`;
      text += `┃ > Hay otra solicitud en curso entre @${pending.from.split("@")[0]} y @${pending.to.split("@")[0]}.\n`;
      text += `┃ > Tiempo restante: *${left}*\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    if (user.marriedTo) {
      if (user.marriedTo === targetJid) {
        let text = `╭〔 ⚠️ ${fytBold("YA CASADOS")} 〕⬣\n\n`;
        text += `┃ > Ya estás casado/a con @${targetJid.split("@")[0]}.\n`;
        text += `┃ > Usa *${prefix}divorce @${targetJid.split("@")[0]}* para solicitar divorcio.\n\n`;
        text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text, mentions: [targetJid] },
          { quoted: message },
        );
      }
      let text = `╭〔 ❌ ${fytBold("NO PUEDES CASARTE")} 〕⬣\n\n`;
      text += `┃ > Estás casado/a con @${user.marriedTo.split("@")[0]}.\n`;
      text += `┃ > Primero debes divorciarte para casarte con otra persona.\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [user.marriedTo] },
        { quoted: message },
      );
    }

    if (partner.marriedTo) {
      let text = `╭〔 ❌ ${fytBold("YA CASADO/A")} 〕⬣\n\n`;
      text += `┃ > Esa persona ya está casada.\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    setMarriagePending(group, normalizedSender, targetJid, "marry");
    if (typeof saveDB === "function") saveDB(db);
    const left = formatTimeLeft(group.marriagePending.expiresAt);
    let text = `╭〔 💍 ${fytBold("MATRIMONIO")} 〕⬣\n`;
    text += `┃ ⏳ ${fytBold("ESPERANDO CONFIRMACIÓN")}\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ @${normalizedSender.split("@")[0]} quiere casarse contigo.\n`;
    text += `┃ @${targetJid.split("@")[0]} acepta con:\n`;
    text += `┃ ➪ *${prefix}marry @${normalizedSender.split("@")[0]}*\n`;
    text += `┃ ➪ o *${prefix}marry* (respondiendo)\n\n`;
    text += `┃ ⏱️ Tiempo: *${left}*\n\n`;
    text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
    return await socket.sendMessage(
      remoteJid,
      { text, mentions: [normalizedSender, targetJid] },
      { quoted: message },
    );
  },
};
