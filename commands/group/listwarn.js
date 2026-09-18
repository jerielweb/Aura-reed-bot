import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["listwarn", "warns", "verwarn", "viewwarn"],
  category: "group",
  description: "Muestra todas las advertencias de un usuario del grupo.",
  adminOnly: true,
  execute: async (socket, message, args, { db, prefix }) => {
    const remoteJid = message.key.remoteJid;

    if (!remoteJid.endsWith("@g.us")) {
      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("ACCIÓN INCOMPATIBLE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo funciona en grupos.\n\n╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    const mentioned =
      message.message?.extendedTextMessage?.contextInfo?.participant ||
      message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    const target =
      mentioned || (args[0] ? args[0].replace(/[^\d@]/g, "") : null);

    if (!target) {
      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("FALTA OBJETIVO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Menciona o responde a un usuario.\n┃ > Ejemplo: ${prefix}listwarn @usuario\n\n╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    const userWarns = db.groups?.[remoteJid]?.warns?.[target] || [];

    if (!Array.isArray(userWarns) || userWarns.length === 0) {
      return socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("SIN ADVERTENCIAS")}\n╰━━━━━━━━━━━━⬣\n\n┃ > El usuario @${target.split("@")[0]} no tiene advertencias registradas.\n\n╰〔 ⚡ ${fytBold("SYSTEM INFO")} 〕⬣`,
          mentions: [target],
        },
        { quoted: message },
      );
    }

    const content = userWarns
      .map(
        (warn, index) =>
          `┃ ${index + 1}. ${warn.reason || "Sin motivo"} • ${warn.date || "Sin fecha"}`,
      )
      .join("\n");

    const text =
      `╭〔 ⚠️ ${fytBold("ADVERTENCIAS")} 〕⬣\n` +
      `┃ 👤 Usuario: @${target.split("@")[0]}\n` +
      `┃ 📊 Total: ${userWarns.length}\n` +
      `╰━━━━━━━━━━━━⬣\n\n` +
      `${content}\n\n` +
      `╰〔 ⚡ ${fytBold("WARN SYSTEM")} 〕⬣`;

    return socket.sendMessage(
      remoteJid,
      { text, mentions: [target] },
      { quoted: message },
    );
  },
};
