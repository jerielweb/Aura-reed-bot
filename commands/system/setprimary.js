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
const SESSIONS_DIR = path.join(ROOT_DIR, "sessions", "subbots");

function cleanJid(jid = "") {
  if (!jid) return "";
  const raw = String(jid).trim();
  const atIndex = raw.lastIndexOf("@");
  if (atIndex === -1) return raw.split(":")[0];
  const userPart = raw.slice(0, atIndex).split(":")[0];
  const domainPart = raw.slice(atIndex + 1);
  return `${userPart}@${domainPart}`;
}

function parseNum(jid) {
  return cleanJid(jid)?.split("@")[0] || null;
}

function hasValidSessionFolder(folderPath) {
  if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory()) {
    return false;
  }

  const files = fs.readdirSync(folderPath, { withFileTypes: true });
  if (!files.length) return false;

  return files.some((item) => {
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
}

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

    const subCommand = args[0]?.toLowerCase();
    db.groups = db.groups || {};
    db.groups[remoteJid] = db.groups[remoteJid] || {};

    const currentPrimary = db.groups[remoteJid].primaryBot;
    const currentPrimaryNum = currentPrimary ? parseNum(currentPrimary) : null;
    const currentBotNum = parseNum(sock.user?.id || sock.user?.jid);

    if (currentPrimaryNum && currentBotNum !== currentPrimaryNum) {
      return;
    }

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

    if (isClearing) {
      db.groups[remoteJid].primaryBot = null;
      await saveDB(db);

      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n┃ ⚙️ ${fytBold("CONFIGURACION")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Se ha desactivado la prioridad del bot primario.\n┃ > Ahora todos los bots responderán en este grupo.\n\n╰〔 ⚡ SYSTEM 〕⬣`,
        },
        { quoted: m },
      );
    }

    if (!targetBotRaw) {
      const validBotIds = new Set();
      const registered = getRegisteredSubBots();
      for (const bot of registered) {
        const id = parseNum(bot?.id || bot?.jid || bot?.key);
        if (id) validBotIds.add(id);
      }

      for (const id of listActiveSubBotSessions()) {
        const n = parseNum(id);
        if (n) validBotIds.add(n);
      }

      if (fs.existsSync(SESSIONS_DIR)) {
        for (const entry of fs.readdirSync(SESSIONS_DIR, {
          withFileTypes: true,
        })) {
          if (!entry.isDirectory()) continue;
          const folderPath = path.join(SESSIONS_DIR, entry.name);
          const num = parseNum(entry.name);
          if (num && hasValidSessionFolder(folderPath)) {
            validBotIds.add(num);
          }
        }
      }

      const mentionList = [...validBotIds].filter(Boolean);
      let text = `╭〔 ℹ️ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ⚙️ ${fytBold("CONFIGURACION")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ *Uso del comando:*\n`;
      text += `┃ > Responde (cita) a un mensaje del bot o etiquétalo (@bot) usando:\n`;
      text += `┃ ➪ *${prefix}setprimary*\n\n`;
      text += `┃ *Bot primario actual:* ${currentPrimaryNum ? `@${currentPrimaryNum}` : "Ninguno"}\n\n`;

      if (mentionList.length) {
        text += `┃ *Bots disponibles:*\n`;
        for (const num of mentionList) {
          text += `┃ ➪ @${num}\n`;
        }
      }

      text += `\n╰〔 ⚡ SYSTEM 〕⬣`;

      return await sock.sendMessage(
        remoteJid,
        {
          text,
          mentions: mentionList.map((num) => `${num}@s.whatsapp.net`),
        },
        { quoted: m },
      );
    }

    const targetNum = parseNum(targetBotRaw);
    const validBotIds = new Set();

    if (currentBotNum) validBotIds.add(currentBotNum);
    if (global.mainSocket?.user) {
      const mainNum = parseNum(
        global.mainSocket.user.id || global.mainSocket.user.jid,
      );
      if (mainNum) validBotIds.add(mainNum);
    }

    const registered = getRegisteredSubBots();
    for (const bot of registered) {
      const id = parseNum(bot?.id || bot?.jid || bot?.key);
      if (id) validBotIds.add(id);
    }

    for (const id of listActiveSubBotSessions()) {
      const n = parseNum(id);
      if (n) validBotIds.add(n);
    }

    if (fs.existsSync(SESSIONS_DIR)) {
      for (const entry of fs.readdirSync(SESSIONS_DIR, {
        withFileTypes: true,
      })) {
        if (!entry.isDirectory()) continue;
        const folderPath = path.join(SESSIONS_DIR, entry.name);
        const num = parseNum(entry.name);
        if (num && hasValidSessionFolder(folderPath)) {
          validBotIds.add(num);
        }
      }
    }

    const isValidBot = [...validBotIds].includes(targetNum);

    if (!isValidBot) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("USUARIO NO VALIDO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > El número no corresponde a un bot o sub-bot válido en esta sesión.\n\n╰〔 ⚡ SYSTEM 〕⬣`,
        },
        { quoted: m },
      );
    }

    const targetBotJid = `${targetNum}@s.whatsapp.net`;
    db.groups[remoteJid].primaryBot = targetBotJid;
    await saveDB(db);

    let text = `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n`;
    text += `┃ 🤖 ${fytBold("BOT PRIMARIO ESTABLECIDO")}\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ > El bot @${targetNum} ahora tiene prioridad en este grupo.\n`;
    text += `┃ > Los demás bots ignorarán los comandos y eventos aquí.\n\n`;
    text += `╰〔 ⚡ SYSTEM 〕⬣`;

    return await sock.sendMessage(
      remoteJid,
      { text, mentions: [targetBotJid] },
      { quoted: m },
    );
  },
};
