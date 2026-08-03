import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["setwelcome", "setbienvenida"],
  category: "group",
  description: "Personalizar el mensaje de bienvenida del grupo",
  async execute(sock, m, args, { prefix, isGroup, isAdmin, db }) {
    const remoteJid = m.key.remoteJid;

    if (!isGroup) {
      return await sock.sendMessage(
        remoteJid,
        { text: "❌ Este comando solo se puede usar en grupos." },
        { quoted: m }
      );
    }

    if (!isAdmin) {
      return await sock.sendMessage(
        remoteJid,
        { text: "❌ Solo los administradores pueden cambiar la bienvenida." },
        { quoted: m }
      );
    }

    const text = args.join(" ").trim();

    // Estructura en BD
    if (!db.groups) db.groups = {};
    if (!db.groups[remoteJid]) db.groups[remoteJid] = {};

    if (!text) {
      const currentMsg =
        db.groups[remoteJid].welcomeMessage || "No configurado (usando por defecto)";

      return await sock.sendMessage(
        remoteJid,
        {
          text: `📝 ${fytBold("PERSONALIZAR BIENVENIDA")}\n\n` +
            `📌 ${fytBold("Mensaje actual:")}\n${currentMsg}\n\n` +
            `💡 ${fytBold("Uso:")} ${prefix}setwelcome <tu mensaje>\n\n` +
            `🏷️ ${fytBold("Etiquetas que puedes usar:")}\n` +
            `• @user - Menciona al usuario que entra\n` +
            `• @group - Nombre del grupo\n` +
            `• @desc - Descripción del grupo\n` +
            `• @count - Número total de miembros`,
        },
        { quoted: m }
      );
    }

    // Guardar plantilla y activar automáticamente
    db.groups[remoteJid].welcomeMessage = text;
    db.groups[remoteJid].welcomeEnabled = true;

    await sock.sendMessage(
      remoteJid,
      {
        text: `✅ ${fytBold("¡Mensaje de bienvenida personalizado con éxito!")}\n\n` +
          `📌 ${fytBold("Vista previa:")}\n${text}`,
      },
      { quoted: m }
    );
  },
};
