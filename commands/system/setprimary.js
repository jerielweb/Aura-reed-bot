import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fytBold } from "./../../models/TextStyle.js";

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "../..");
const subbotsJsonPath = path.join(ROOT_DIR, "database", "subbots.json");

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

    // Limpia cualquier JID o ID dejando únicamente los dígitos del número telefónico
    const cleanNum = (jid) => (jid ? String(jid).split("@")[0].split(":")[0].replace(/\D/g, "") : null);

    const subCommand = args[0]?.toLowerCase();
    db.groups = db.groups || {};
    db.groups[remoteJid] = db.groups[remoteJid] || {};

    const currentPrimary = db.groups[remoteJid].primaryBot;

    // Extracción robusta de cita o mención
    const contextInfo =
      m.message?.extendedTextMessage?.contextInfo ||
      m.message?.imageMessage?.contextInfo ||
      m.message?.videoMessage?.contextInfo ||
      m.message?.buttonsResponseMessage?.contextInfo ||
      m.message?.templateButtonReplyMessage?.contextInfo;

    const quotedParticipant =
      contextInfo?.participant ||
      m.quoted?.participant ||
      m.quoted?.key?.participant;

    const mentionedJid = contextInfo?.mentionedJid?.[0];

    let targetBotRaw = null;
    let isClearing = false;

    if (
      args[0] &&
      ["off", "reset", "clear", "desactivar", "ninguno"].includes(subCommand)
    ) {
      isClearing = true;
    } else if (quotedParticipant) {
      targetBotRaw = quotedParticipant;
    } else if (mentionedJid) {
      targetBotRaw = mentionedJid;
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

    // Si no se citó ni etiquetó a nadie, muestra el menú instructivo
    if (!targetBotRaw) {
      let text = `╭〔 ℹ️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚙️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ *Uso del comando:*\n`;
      text += `┃ > Responde (cita) a un mensaje del bot o etiquétalo (@bot) usando:\n`;
      text += `┃ ➪ *${prefix}setprimary*\n\n`;
      text += `┃ *Para desactivar:* \n`;
      text += `┃ ➪ *${prefix}setprimary off*\n\n`;
      if (currentPrimary) {
        text += `┃ ➪ *Bot primario actual:* @${cleanNum(currentPrimary)}\n\n`;
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

    const targetNum = cleanNum(targetBotRaw);
    const currentBotNum = cleanNum(sock.user?.id || sock.user?.jid);

    // Lectura del JSON global de bots
    let globalBots = { mainBot: null, subbots: {} };
    if (fs.existsSync(subbotsJsonPath)) {
      try {
        globalBots = JSON.parse(fs.readFileSync(subbotsJsonPath, "utf-8")) || globalBots;
      } catch {}
    }

    // "subbots" se guarda como objeto { "numero": { active } }.
    // Soportamos también el formato viejo (arreglo de números) por compatibilidad.
    const subbotIds = Array.isArray(globalBots.subbots)
      ? globalBots.subbots
      : Object.keys(globalBots.subbots || {});

    // Lista unificada limpia de números telefónicos
    const allValidBots = [
      cleanNum(globalBots.mainBot),
      currentBotNum,
      ...subbotIds.map(cleanNum),
    ].filter(Boolean);

    const isValidBot = allValidBots.includes(targetNum);

    if (!isValidBot) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("USUARIO NO VALIDO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > El usuario etiquetado no está registrado como bot o sub-bot activo.\n\n╰〔 ⚡ SYSTEM 〕⬣`,
        },
        { quoted: m },
      );
    }

    // Guardar la selección
    const targetBotJid = `${targetNum}@s.whatsapp.net`;
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
      { text, mentions: [targetBotJid] },
      { quoted: m },
    );
  },
};
