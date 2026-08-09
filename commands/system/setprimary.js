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

    const cleanJid = (jid) =>
      jid ? String(jid).split("@")[0].split(":")[0] : null;

    const currentBotId = cleanJid(sock.user?.id || sock.user?.jid);
    if (!currentBotId) return;

    const subCommand = args[0]?.toLowerCase();
    db.groups = db.groups || {};
    db.groups[remoteJid] = db.groups[remoteJid] || {};

    const currentPrimary = db.groups[remoteJid].primaryBot;

    let targetBotRaw = null;
    let isClearing = false;

    // Extraer participante citado (soporta citados simples y contextInfo)
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

    // Mostrar Estado / Ayuda si no citó/mencionó a nadie
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

    // Limpieza estricta para comparar únicamente los números
    const targetNum = cleanJid(targetBotRaw);
    const targetBotJid = `${targetNum}@s.whatsapp.net`;

    const mainBotNum = cleanJid(db.mainBotJid || currentBotId);
    const isMainBot = targetNum === mainBotNum || targetNum === currentBotId;

    // Obtener lista de subbots registrando arreglos u objetos
    let subbotsList = db.subbots || [];
    let isSubBot = false;

    if (Array.isArray(subbotsList)) {
      isSubBot = subbotsList.some(
        (sb) => cleanJid(typeof sb === "object" ? sb.jid : sb) === targetNum,
      );
    } else if (typeof subbotsList === "object") {
      isSubBot = Object.keys(subbotsList).some((key) => cleanJid(key) === targetNum);
    }

    // VERIFICACIÓN: Si no es el bot principal ni sub-bot
    if (!isMainBot && !isSubBot) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("USUARIO NO VALIDO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > El usuario etiquetado no está registrado como bot o sub-bot activo.\n\n╰〔 ⚡ SYSTEM 〕⬣`,
        },
        { quoted: m },
      );
    }

    // Asignar el Bot Primario en la Base de Datos
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
