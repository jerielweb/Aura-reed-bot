import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { fytBold } from "./../../models/TextStyle.js";
import {
  getRegisteredSubBots,
  listActiveSubBotSessions,
} from "../../models/subbotManager.js";

const ROOT_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
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
    const cleanNum = (jid) =>
      jid ? String(jid).split("@")[0].split(":")[0].replace(/\D/g, "") : null;

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
    } else if (
      args[0] &&
      /^\d{8,20}$/.test(String(args[0]).replace(/\D/g, ""))
    ) {
      targetBotRaw = args[0];
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

    const registeredSubBots = getRegisteredSubBots();
    const activeSessionIds = listActiveSubBotSessions();
    const validSubBotIds = new Set();

    for (const bot of registeredSubBots) {
      const id = cleanNum(bot?.id || bot?.jid || bot?.key);
      if (id) validSubBotIds.add(id);
    }

    for (const sessionId of activeSessionIds) {
      const id = cleanNum(sessionId);
      if (id) validSubBotIds.add(id);
    }

    const sessionFolderIds = new Set();
    const subbotsDir = path.join(ROOT_DIR, "sessions", "subbots");

    if (fs.existsSync(subbotsDir)) {
      for (const entry of fs.readdirSync(subbotsDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;

        const sessionDir = path.join(subbotsDir, entry.name);
        const folderId = cleanNum(entry.name);

        if (!folderId) continue;

        const sessionFiles = fs.existsSync(sessionDir)
          ? fs.readdirSync(sessionDir, { withFileTypes: true })
          : [];

        const hasValidSession = sessionFiles.some((item) => {
          const name = String(item.name || "");
          return (
            name === "session.db" ||
            name === "creds.json" ||
            name === "creds.json.enc" ||
            name.startsWith("pre-key") ||
            name.startsWith("sender-key") ||
            name.startsWith("session") ||
            name.startsWith("auth") ||
            name.startsWith("app-state-sync-key")
          );
        });

        if (hasValidSession) {
          sessionFolderIds.add(folderId);
        }
      }
    }

    const allValidBots = [
      cleanNum(global.mainSocket?.user?.id || global.mainSocket?.user?.jid),
      currentBotNum,
      ...[...validSubBotIds],
      ...[...sessionFolderIds],
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
