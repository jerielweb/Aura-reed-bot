import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["kick", "sacar", "quitar", "expulsar", "limpiar"],
  category: "group",
  description: "Expulsa a un integrante o a varios por prefijo de país.",
  adminOnly: true,
  execute: async (
    sock,
    message,
    args,
    { prefix, db, saveDB, isOwner, isAdmin, isBotAdmin, owners, groupMetadata, numeroReal, jidRemitente, senderRaw, rawParticipant, rawMentionedJid }
  ) => {
    const remoteJid = message.key.remoteJid;

    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCION INCOMPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return sock.sendMessage(remoteJid, { text }, { quoted: message });
    }

    let usersToCryOrKick = [];

    // 1. Caso: Por respuesta o mención usando los raw o args directos
    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    const mentionedJid = contextInfo?.mentionedJid || rawMentionedJid;
    const participantRef = contextInfo?.participant || rawParticipant;

    if (participantRef) {
      usersToCryOrKick.push(participantRef);
    } else if (mentionedJid && mentionedJid.length > 0) {
      usersToCryOrKick = mentionedJid;
    } else if (args && args.length > 0) {
      // Tomamos el primer argumento y nos quedamos solo con dígitos (ej: +240 -> 240)
      const targetArg = args[0].replace(/\D/g, "");

      if (targetArg) {
        const participants = groupMetadata?.participants || [];
        const botBase = sock.user?.id?.split("@")[0]?.split(":")[0];

        // IMPORTANTE: filtramos por el número real (p.phoneNumber, ya resuelto
        // por msgHandler.js), NO por p.id. Con LID activo, p.id suele ser un
        // identificador interno (@lid) y no el número de teléfono, así que
        // comparar el prefijo contra p.id nunca coincide.
        usersToCryOrKick = participants
          .filter((p) => {
            const phoneBase = p.phoneNumber?.replace(/\D/g, "");
            return phoneBase && phoneBase.startsWith(targetArg);
          })
          .map((p) => p.id)
          .filter((id) => id.split("@")[0].split(":")[0] !== botBase);

        const admins = participants.filter((p) => p.admin).map((p) => p.id);
        usersToCryOrKick = usersToCryOrKick.filter((id) => !admins.includes(id));
      }
    }

    if (usersToCryOrKick.length === 0) {
      let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCIÓN INVÁLIDA")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Menciona a alguien, responde\n`;
      text += `┃ > a su mensaje o escribe un\n`;
      text += `┃ > prefijo (ej: ${prefix}kick 234)\n`;
      text += `┃ > Nota: el kick por prefijo solo\n`;
      text += `┃ > funciona si el número del\n`;
      text += `┃ > usuario es visible en el grupo.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return sock.sendMessage(remoteJid, { text }, { quoted: message });
    }

    try {
      await sock.groupParticipantsUpdate(remoteJid, usersToCryOrKick, "remove");

      let successText = `╭〔 👑 ${fytBold("ADMIN SYSTEM")} 〕⬣\n\n`;
      if (usersToCryOrKick.length === 1) {
        successText += `┃ ✅ @${usersToCryOrKick[0].split("@")[0]}\n┃ > fue expulsado del grupo\n`;
      } else {
        successText += `┃ ✅ ${fytBold("LIMPIEZA COMPLETADA")}\n┃ > Se expulsaron ${usersToCryOrKick.length} usuarios\n┃ > con el prefijo solicitado.\n`;
      }
      successText += `\n╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;

      await sock.sendMessage(
        remoteJid,
        {
          text: successText,
          mentions: usersToCryOrKick.length <= 10 ? usersToCryOrKick : [],
        },
        { quoted: message },
      );
    } catch (e) {
      let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ERROR DE KICK")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No pude expulsar a los usuarios.\n`;
      text += `┃ > Asegúrate de que soy admin.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      await sock.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};