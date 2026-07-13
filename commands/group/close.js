import { errorMessage } from "../../models/messageTemplates.js";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["close", "cerrar"],
  category: "group",
  description: "Cerrar el grupo.",
  adminOnly: true,
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      // Plantilla del mensaje para que sea más atractivo visualmente
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCION INCONPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      // Enviar mensaje de error
      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    try {
      await socket.groupSettingUpdate(remoteJid, "announcement");

      // Plantilla del mensaje para que sea más atractivo visualmente
      let text = `╭〔 👑 ${fytBold("ADMIN SYSTEM")} 〕⬣\n\n`;
      text += `┃ ✅ ${fytBold("GRUPO CERRADO")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > solo administradores pueden mensajear\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

      // Enviar mensaje de éxito
      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } catch (e) {
      // Plantilla del mensaje para que sea más atractivo visualmente
      let text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ERROR DE ADMIN")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No pude cerrar el grupo.\n`;
      text += `┃ > Asegúrate de que soy admin.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      // Enviar mensaje de error
      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};
