// divorce.js
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
      text += `${fytBold("ACCION INCOMPATIBLE")} \n╰━━━━━━━━━━━━⬣\n\n`;
      text += `> Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const userLid = await resolveToLid(jidRemitente, socket, remoteJid);
    const group = ensureGroup(db, remoteJid);
    const userJid = await resolveLidToRealJid(userLid, socket, remoteJid);
    const user = getProfileUser(db, remoteJid, userJid);
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

    if (targetLid === userLid) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCIÓN INVÁLIDA")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No puedes usar este comando contigo mismo.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ERROR")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const targetJid = await resolveLidToRealJid(targetLid, socket, remoteJid);
    const partner = getProfileUser(db, remoteJid, targetJid);

    if (pending && pending.to === userLid && pending.from === targetLid) {
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

      if (user.marriedTo !== targetLid || partner.marriedTo !== userLid) {
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

      const userRealJid = await resolveLidToRealJid(userLid, socket, remoteJid);
      const targetRealJid = await resolveLidToRealJid(
        targetLid,
        socket,
        remoteJid,
      );

      let text = `╭〔 💔 ${fytBold("DIVORCIO")} 〕⬣\n`;
      text += `┃ ✅ ${fytBold("CONFIRMADO")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ @${userRealJid.split("@")[0]} y @${targetRealJid.split("@")[0]}\n`;
      text += `┃ han terminado su matrimonio.\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [userRealJid, targetRealJid] },
        { quoted: message },
      );
    }

    if (pending && pending.from === userLid) {
      if (pending.type === "divorce") {
        const left = formatTimeLeft(pending.expiresAt);
        const pendingToReal = await resolveLidToRealJid(
          pending.to,
          socket,
          remoteJid,
        );
        let text = `╭〔 ⏳ ${fytBold("SOLICITUD PENDIENTE")} 〕⬣\n`;
        text += `┃ > Ya enviaste una solicitud de divorcio.\n`;
        text += `┃ > Espera que @${pendingToReal.split("@")[0]} confirme con *${prefix}divorce*.\n`;
        text += `┃ > Tiempo restante: *${left}*\n`;
        text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
        return await socket.sendMessage(
          remoteJid,
          { text, mentions: [pendingToReal] },
          { quoted: message },
        );
      }
    }

    if (pending && pending.from !== userLid && pending.to !== userLid) {
      const left = formatTimeLeft(pending.expiresAt);
      const fromReal = await resolveLidToRealJid(
        pending.from,
        socket,
        remoteJid,
      );
      const toReal = await resolveLidToRealJid(pending.to, socket, remoteJid);
      let text = `╭〔 ⏳ ${fytBold("SOLICITUD ACTIVA")} 〕⬣\n`;
      text += `┃ > Hay otra solicitud en curso entre @${fromReal.split("@")[0]} y @${toReal.split("@")[0]}.\n`;
      text += `┃ > Tiempo restante: *${left}*\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [fromReal, toReal] },
        { quoted: message },
      );
    }

    if (!user.marriedTo) {
      let text = `╭〔 ❌ ${fytBold("NO ESTÁS CASAD@")} 〕⬣\n`;
      text += `┃ > No estás casado/a.\n`;
      text += `┃ > Usa *${prefix}marry @usuario* para solicitar matrimonio.\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    if (user.marriedTo !== targetLid) {
      const marriedReal = await resolveLidToRealJid(
        user.marriedTo,
        socket,
        remoteJid,
      );
      let text = `╭〔 ❌ ${fytBold("NO PUEDES DIVORCIAR")} 〕⬣\n`;
      text += `┃ > Estás casado/a con @${marriedReal.split("@")[0]}.\n`;
      text += `┃ > Usa *${prefix}divorce @${marriedReal.split("@")[0]}* para solicitar el divorcio correcto.\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(
        remoteJid,
        { text, mentions: [marriedReal] },
        { quoted: message },
      );
    }

    setMarriagePending(group, userLid, targetLid, "divorce");
    if (typeof saveDB === "function") saveDB(db);
    const left = formatTimeLeft(group.marriagePending.expiresAt);

    const userRealJid = await resolveLidToRealJid(userLid, socket, remoteJid);
    const targetRealJid = await resolveLidToRealJid(
      targetLid,
      socket,
      remoteJid,
    );

    let text = `╭〔 💔 ${fytBold("DIVORCIO")} 〕⬣\n`;
    text += `┃ ⏳ ${fytBold("ESPERANDO CONFIRMACIÓN")}\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ @${userRealJid.split("@")[0]} solicita divorcio.\n`;
    text += `┃ @${targetRealJid.split("@")[0]} confirma con:\n`;
    text += `┃ ➪ *${prefix}divorce @${userRealJid.split("@")[0]}*\n`;
    text += `┃ ➪ o *${prefix}divorce* (respondiendo)\n\n`;
    text += `┃ ⏱️ Tiempo: *${left}*\n\n`;
    text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
    return await socket.sendMessage(
      remoteJid,
      { text, mentions: [userRealJid, targetRealJid] },
      { quoted: message },
    );
  },
};
