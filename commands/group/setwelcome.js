import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["setwelcome", "setbienvenida"],
  category: "group",
  description: "Personaliza o restablece el mensaje de bienvenida del grupo",
  adminOnly: false,
  execute: async (socket, message, args, { prefix, db, saveDB }) => {
    const remoteJid = message.key.remoteJid;

    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCION INCOMPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    if (!db.groups) db.groups = {};
    if (!db.groups[remoteJid]) db.groups[remoteJid] = {};

    const customText = args.join(" ").trim();
    const option = args[0]?.toLowerCase();

    // 1. Si no pasa argumentos, mostrar menú de ayuda y mensaje actual
    if (!customText) {
      const currentMsg =
        db.groups[remoteJid].welcomeMessage || "Mensaje por defecto";

      let text = `╭〔 ⚙️ ${fytBold("SETWELCOME - AURA REED")} 〕⬣\n`;
      text += `┃ 💬 ${fytBold("Mensaje personalizado actual:")}\n`;
      text += `┃ > ${currentMsg}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `💡 ${fytBold("Uso del comando:")}\n`;
      text += `┃ • ${prefix}setwelcome [texto] - Establece un nuevo mensaje.\n`;
      text += `┃ • ${prefix}setwelcome reset - Restablece al mensaje por defecto.\n\n`;
      text += `🏷️ ${fytBold("Etiquetas disponibles:")}\n`;
      text += `┃ • @user - Menciona al nuevo usuario\n`;
      text += `┃ • @group - Nombre del grupo\n`;
      text += `┃ • @desc - Descripción del grupo\n`;
      text += `┃ • @count - Total de integrantes\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    // 2. Restablecer mensaje por defecto
    if (option === "reset" || option === "default") {
      delete db.groups[remoteJid].welcomeMessage;
      if (typeof saveDB === "function") await saveDB();

      let text = `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ > Mensaje personalizado ${fytBold("ELIMINADO")}.\n`;
      text += `┃ > Se usará la bienvenida por defecto.\n`;
      text += `╰━━━━━━━━━━━━⬣`;
      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    // 3. Guardar plantilla personalizada
    db.groups[remoteJid].welcomeMessage = customText;
    if (typeof saveDB === "function") await saveDB();

    let text = `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n`;
    text += `┃ ${fytBold("BIENVENIDA PERSONALIZADA")} \n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ 📌 ${fytBold("Nueva plantilla:")}\n`;
    text += `${customText}\n\n`;
    text += `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;

    return socket.sendMessage(remoteJid, { text }, { quoted: message });
  },
};
