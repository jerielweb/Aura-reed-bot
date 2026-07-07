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
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ${fytBold("ACCION INCONPATIBLE")} \n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo funciona en grupos.\n\n╰〔 ⚡ SYSTEM ALERT 〕⬣`,
        },
        { quoted: m },
      );
    }

    const botId = sock.user?.id
      ? sock.user.id.split("@")[0].split(":")[0] + "@s.whatsapp.net"
      : null;
    if (!botId) return;

    const subCommand = args[0]?.toLowerCase();
    db.groups = db.groups || {};
    db.groups[remoteJid] = db.groups[remoteJid] || {};

    const currentPrimary = db.groups[remoteJid].primaryBot;

    let targetBot = null;
    let isClearing = false;

    const replied = m.message?.extendedTextMessage?.contextInfo?.participant;
    const mentioned =
      m.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (
      args[0] &&
      ["off", "reset", "clear", "desactivar", "ninguno"].includes(subCommand)
    ) {
      isClearing = true;
    } else if (replied) {
      targetBot = replied;
    } else if (mentioned) {
      targetBot = mentioned;
    }

    // Normalize targetBot if resolved
    if (targetBot) {
      targetBot = targetBot.split("@")[0].split(":")[0] + "@s.whatsapp.net";
    }

    if (isClearing) {
      db.groups[remoteJid].primaryBot = null;
      await saveDB(db);

      let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚙️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Se ha desactivado la prioridad del bot primario.\n`;
      text += `┃ > Ahora todos los bots (principal y subs) responderán en este grupo.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      return await sock.sendMessage(remoteJid, { text }, { quoted: m });
    }

    if (!targetBot) {
      let text = `╭〔 ℹ️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚙️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ *Uso del comando:*\n`;
      text += `┃ > Responde (cita) al bot o etiquétalo (@bot) con el comando:\n`;
      text += `┃ ➪ *${prefix}setprimary*\n\n`;
      text += `┃ *Para desactivar:* \n`;
      text += `┃ ➪ *${prefix}setprimary off*\n\n`;
      if (currentPrimary) {
        text += `┃ ➪ *Bot primario actual:* @${currentPrimary.split("@")[0]}\n\n`;
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

    db.groups[remoteJid].primaryBot = targetBot;
    await saveDB(db);

    const targetNum = targetBot.split("@")[0];
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
        mentions: [targetBot],
      },
      { quoted: m },
    );
  },
};
