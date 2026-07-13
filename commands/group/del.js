import { fytBold } from "./../../models/TextStyle.js";

export default {
  name: ["del", "delete", "borrar", "eliminar"],
  category: "group",
  description: "Elimina mensajes (respondiendo a ellos).",
  adminOnly: true,
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCION INCONPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const contextInfo = message.message?.extendedTextMessage?.contextInfo;
    if (!contextInfo || !contextInfo.participant) {
      let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("FALTA OBJETIVO")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Responde al mensaje que deseas eliminar.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    try {
      // Limpiamos las IDs para comparar sin errores de dispositivo (:1, :2)
      const botLimpio = socket.user.id.split(":")[0].split("@")[0];
      const participanteLimpio = contextInfo.participant
        .split(":")[0]
        .split("@")[0];

      let deleteObject = {};

      if (botLimpio === participanteLimpio) {
        // CASO 1: El mensaje es del mismo bot. Ponemos true y OMITIMOS el participant.
        deleteObject = {
          remoteJid,
          fromMe: true,
          id: contextInfo.stanzaId,
        };
      } else {
        // CASO 2: El mensaje es de otro usuario. Ponemos false e INCLUIMOS el participant.
        deleteObject = {
          remoteJid,
          fromMe: false,
          id: contextInfo.stanzaId,
          participant: contextInfo.participant,
        };
      }

      await socket.sendMessage(remoteJid, { delete: deleteObject });
    } catch (e) {
      console.error("[Delete Error]:", e);
      let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ERROR DE ELIMINACIÓN")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No pude eliminar el mensaje.\n`;
      text += `┃ > Asegúrate de que soy admin.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};
