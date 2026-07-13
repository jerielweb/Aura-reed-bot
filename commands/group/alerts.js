import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["alerts", "alertas", "adminalerts"],
  description:
    "Activa o desactiva las notificaciones de administración del grupo.",
  adminOnly: true,

  execute: async (socket, message, args, { db, saveDB, prefix }) => {
    const remoteJid = message.key.remoteJid;

    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCIÓN INCOMPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    // Si el grupo no existe en la BD, lo inicializa con los valores por defecto
    if (!db.groups[remoteJid]) {
      db.groups[remoteJid] = {
        antilink: false,
        welcome: false,
        bye: true,
        warnLimit: 3,
        warns: {},
        activity: {},
        botOn: true,
      };
    }

    // Si la propiedad 'alerts' no existe dentro del grupo, la creamos en false por defecto
    if (db.groups[remoteJid].alerts === undefined) {
      db.groups[remoteJid].alerts = false;
    }

    const status = args[0]?.toLowerCase();
    const usadoPrefix = prefix || ".";

    if (
      status === "on" ||
      status === "1" ||
      status === "true" ||
      status === "activar" ||
      status === "enable"
    ) {
      // SE GUARDA EN: db.groups[remoteJid].alerts
      db.groups[remoteJid].alerts = true;
      saveDB(db);

      let text = `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ⚙️ ${fytBold("ALERTAS DE ADMIN")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Las notificaciones de administración\n`;
      text += `┃ > han sido activadas con éxito.\n\n`;
      text += `╰〔 ⚡${fytBold("SYSTEM INFO")} 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } else if (
      status === "off" ||
      status === "0" ||
      status === "false" ||
      status === "desactivar" ||
      status === "disable"
    ) {
      // SE GUARDA EN: db.groups[remoteJid].alerts
      db.groups[remoteJid].alerts = false;
      saveDB(db);

      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ⚙️ ${fytBold("ALERTAS DE ADMIN")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Las notificaciones de administración\n`;
      text += `┃ > han sido desactivadas con éxito.\n\n`;
      text += `╰〔 ⚡${fytBold("SYSTEM ACTIVE")} 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } else {
      const currentStatus = db.groups[remoteJid].alerts
        ? "✅ Activado"
        : "❌ Desactivado";

      let text = `╭〔 ⚙️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ 🔔 ${fytBold("SISTEMA DE ALERTAS")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ℹ️ Estado actual: ${currentStatus}\n\n`;
      text += `┣━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ➪ ${usadoPrefix}alerts on\n`;
      text += `┃ ✦ Activar alertas globales\n\n`;
      text += `┃ ➪ ${usadoPrefix}alerts off\n`;
      text += `┃ ✦ Desactivar alertas globales\n\n`;
      text += `╰〔 ⚡${fytBold("SYSTEM INFO")} 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};
