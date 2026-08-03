import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["setwelcome", "welcome", "setbienvenida"],
  category: "group",
  description: "Configura o personaliza el mensaje de bienvenida del grupo",
  adminOnly: true,
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

    if (!customText) {
      const currentMsg =
        db.groups[remoteJid].welcomeMessage || "Mensaje por defecto";
      const status = db.groups[remoteJid].welcome ? "Activado 🟢" : "Desactivado 🔴";

      let text = `╭〔 ⚙️ ${fytBold("SETWELCOME - AURA REED")} 〕⬣\n`;
      text += `┃ 📌 ${fytBold("Estado:")} ${status}\n`;
      text += `┃ 💬 ${fytBold("Mensaje actual:")}\n`;
      text += `┃ > ${currentMsg}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `💡 ${fytBold("Uso del comando:")}\n`;
      text += `┃ • ${prefix}welcome on/off - Activa o desactiva\n`;
      text += `┃ • ${prefix}setwelcome [texto] - Define la plantilla\n\n`;
      text += `🏷️ ${fytBold("Etiquetas disponibles:")}\n`;
      text += `┃ • @user - Menciona al nuevo usuario\n`;
      text += `┃ • @group - Nombre del grupo\n`;
      text += `┃ • @desc - Descripción del grupo\n`;
      text += `┃ • @count - Total de integrantes\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;

      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    // 1. Activar / Desactivar si pasa on u off
    if (customText.toLowerCase() === "on") {
      db.groups[remoteJid].welcome = true;
      if (typeof saveDB === "function") await saveDB();

      let text = `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ > Bienvenida ${fytBold("ACTIVADA")} para este grupo.\n`;
      text += `╰━━━━━━━━━━━━⬣`;
      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    if (customText.toLowerCase() === "off") {
      db.groups[remoteJid].welcome = false;
      if (typeof saveDB === "function") await saveDB();

      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ > Bienvenida ${fytBold("DESACTIVADA")} para este grupo.\n`;
      text += `╰━━━━━━━━━━━━⬣`;
      return socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    // 2. Guardar plantilla personalizada
    db.groups[remoteJid].welcomeMessage = customText;
    db.groups[remoteJid].welcome = true;

    if (typeof saveDB === "function") await saveDB();

    let text = `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n`;
    text += `┃ ${fytBold("BIENVENIDA GUARDADA")} \n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ 📌 ${fytBold("Nueva plantilla:")}\n`;
    text += `${customText}\n\n`;
    text += `╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`;

    return socket.sendMessage(remoteJid, { text }, { quoted: message });
  },
};
