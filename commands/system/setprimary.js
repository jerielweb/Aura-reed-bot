import { fytBold } from "./../../models/TextStyle.js";

export default {
  name: ["setprimary", "primary"],
  description: "Establece el bot primario para este grupo.",
  adminOnly: true,
  category: "system",

  async execute(sock, m, args, { prefix, db, saveDB }) {
    const remoteJid = m.key.remoteJid;
    const isGroup = remoteJid.endsWith("@g.us");

    if (!isGroup) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("ACCION INCOMPATIBLE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo funciona en grupos.\n\n╰〔 ⚡ SYSTEM ALERT 〕⬣`,
        },
        { quoted: m },
      );
    }

    // Limpia cualquier JID a solo dígitos
    const cleanJid = (jid) =>
      jid ? String(jid).replace(/[^0-9]/g, "") : null;

    const subCommand = args[0]?.toLowerCase();
    db.groups = db.groups || {};
    db.groups[remoteJid] = db.groups[remoteJid] || {};

    const currentPrimary = db.groups[remoteJid].primaryBot;

    let targetBotRaw = null;
    let isClearing = false;

    const contextInfo =
      m.message?.extendedTextMessage?.contextInfo ||
      m.message?.imageMessage?.contextInfo ||
      m.message?.videoMessage?.contextInfo;

    const replied =
      contextInfo?.participant ||
      m.quoted?.participant ||
      m.quoted?.key?.participant;
    const mentioned = contextInfo?.mentionedJid?.[0];

    if (
      args[0] &&
      ["off", "reset", "clear", "desactivar", "ninguno"].includes(subCommand)
    ) {
      isClearing = true;
    } else if (replied) {
      targetBotRaw = replied;
    } else if (mentioned) {
      targetBotRaw = mentioned;
    }

    // Desactivar Bot Primario
    if (isClearing) {
      db.groups[remoteJid].primaryBot = null;
      await saveDB(db);

      let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚙️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Se ha desactivado la prioridad del bot primario.\n`;
      text += `┃ > Ahora todos los bots responderán en este grupo.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      return await sock.sendMessage(remoteJid, { text }, { quoted: m });
    }

    // Si no se citó ni etiquetó a nadie
    if (!targetBotRaw) {
      let text = `╭〔 ℹ️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚙️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ *Uso del comando:*\n`;
      text += `┃ > Responde (cita) a un bot o etiquétalo (@bot) con:\n`;
      text += `┃ ➪ *${prefix}setprimary*\n\n`;
      text += `┃ *Para desactivar:* \n`;
      text += `┃ ➪ *${prefix}setprimary off*\n\n`;
      if (currentPrimary) {
        text += `┃ ➪ *Bot primario actual:* @${cleanJid(currentPrimary)}\n\n`;
      } else {
        text += `┃ ➪ *Bot primario actual:* Ninguno (responden todos)\n\n`;
      }
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      return await sock.sendMessage(
        remoteJid,
        {
          text,
          mentions: currentPrimary ? [currentPrimary] : [],
        },
        { quoted: m },
      );
    }

    const targetNum = cleanJid(targetBotRaw);
    if (!targetNum) {
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ No se pudo obtener el número del bot etiquetado/citado." },
        { quoted: m }
      );
    }

    const targetBotJid = `${targetNum}@s.whatsapp.net`;

    // Asignar en la Base de Datos local de esta instancia
    db.groups[remoteJid].primaryBot = targetBotJid;
    await saveDB(db);

    let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
    text += `┃ 🤖 𝐁𝐎𝐓 𝐏𝐑𝐈𝐌𝐀𝐑𝐈𝐎 𝐄𝐒𝐓𝐀𝐁𝐋𝐄𝐂𝐈𝐃𝐎\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ > El bot @${targetNum} ahora tiene prioridad en este grupo.\n`;
    text += `┃ > Los demás bots ignorarán los comandos y eventos aquí.\n\n`;
    text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    return await sock.sendMessage(
      remoteJid,
      {
        text,
        mentions: [targetBotJid],
      },
      { quoted: m },
    );
  },
};
