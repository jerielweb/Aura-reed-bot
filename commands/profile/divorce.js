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
  name: ["divorce", "divorciar", "separar"],
  category: "profile",
  description: "Solicitar divorcio.",
  execute: async (
    socket,
    message,
    args,
    { db, saveDB, jidRemitente, prefix },
  ) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕━━⬣\n`;
      text += `${fytBold("ACCION INCONPATIBLE")} \n╰━━━━━━━━━━━━⬣\n\n`;
      text += `> Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const normalizedSender = jidNormalizedUser(jidRemitente);
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
        text += `┃ > Matrimonio: *${prefix}divorce @usuario*\n`;
        text += `┣━━━━━━━━━━━━⬣\n`;
        text += `┃ > _Ejemplo:_\n`;
        text += `┃ > *${prefix}divorce @pareja*\n`;
        text += `┃ > *${prefix}divorce* (respondiendo)\n\n`;
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
      text += `┃ ${fytBold("ACCIÓN INVÁLIDA")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No puedes usar este comando contigo mismo.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ERROR")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const partner = getProfileUser(db, remoteJid, targetJid);

    if (pending && pending.to === normalizedSender && pending.from === targetJid) {
      if (pending.type !== "divorce") {
        let text = `╭〔 ❌ ${fytBold("ERROR")} 〕⬣\n\n`;
        text += `┃ > Esta solicitud no es de divorcio.\n\n`;
        text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }

      if (user.marriedTo !== targetJid || partner.marriedTo !== normalizedSender) {
        clearMarriagePending(group);
        if (typeof saveDB === "function") saveDB(db);
        let text = `╭〔 ❌ ${fytBold("ERROR")} 〕⬣\n\n`;
        text += `┃ > El matrimonio ya no es válido o no coincide.\n\n`;
        text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message },
        );
      }

      user.marriedTo = null;
      partner.marriedTo = null;
      clearMarriagePending(group);
      if (typeof saveDB === "function") saveDB(db);

      let text = `╭〔 💔 ${fytBold("DIVORCIO")} 〕⬣\n`;
      text += `┃ ✅ ${fytBold("CONFIRMADO")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ @${normalizedSender.split("@")[0]} y @${targetJid.split("@")[0]}\n`;
      text += `┃ han terminado su matrimonio.\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [normalizedSender, targetJid] },
        { quoted: message },
      );
    }

    if (pending && pending.from === normalizedSender) {
      if (pending.type === "divorce") {
        const left = formatTimeLeft(pending.expiresAt);
        let text = `╭〔 ⏳ ${fytBold("SOLICITUD PENDIENTE")} 〕⬣\n`;
        text += `┃ > Ya enviaste una solicitud de divorcio.\n`;
        text += `┃ > Espera que @${pending.to.split("@")[0]} confirme con *${prefix}divorce*.\n`;
        text += `┃ > Tiempo restante: *${left}*\n`;
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
      let text = `╭〔 ⏳ ${fytBold("SOLICITUD ACTIVA")} 〕⬣\n`;
      text += `┃ > Hay otra solicitud en curso entre @${pending.from.split("@")[0]} y @${pending.to.split("@")[0]}.\n`;
      text += `┃ > Tiempo restante: *${left}*\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    if (!user.marriedTo) {
      let text = `╭〔 ❌ ${fytBold("NO ESTÁS CASAD@")} 〕⬣\n`;
      text += `┃ > No estás casado/a.\n`;
      text += `┃ > Usa *${prefix}marry @usuario* para solicitar matrimonio.\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    if (user.marriedTo !== targetJid) {
      let text = `╭〔 ❌ ${fytBold("NO PUEDES DIVORCIAR")} 〕⬣\n`;
      text += `┃ > Estás casado/a con @${user.marriedTo.split("@")[0]}.\n`;
      text += `┃ > Usa *${prefix}divorce @${user.marriedTo.split("@")[0]}* para solicitar el divorcio correcto.\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [user.marriedTo] },
        { quoted: message },
      );
    }

    setMarriagePending(group, normalizedSender, targetJid, "divorce");
    if (typeof saveDB === "function") saveDB(db);
    const left = formatTimeLeft(group.marriagePending.expiresAt);
    let text = `╭〔 💔 ${fytBold("DIVORCIO")} 〕⬣\n`;
    text += `┃ ⏳ ${fytBold("ESPERANDO CONFIRMACIÓN")}\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ @${normalizedSender.split("@")[0]} solicita divorcio.\n`;
    text += `┃ @${targetJid.split("@")[0]} confirma con:\n`;
    text += `┃ ➪ *${prefix}divorce @${normalizedSender.split("@")[0]}*\n`;
    text += `┃ ➪ o *${prefix}divorce* (respondiendo)\n\n`;
    text += `┃ ⏱️ Tiempo: *${left}*\n\n`;
    text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
    return await socket.sendMessage(
      remoteJid,
      { text, mentions: [normalizedSender, targetJid] },
      { quoted: message },
    );
  },
};
