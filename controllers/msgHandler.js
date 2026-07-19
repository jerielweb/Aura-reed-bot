import fs from "fs";
import chalk from "chalk";
import { resolveLidToRealJid } from "./../models/utils.js";
import { trackGroupActivity } from "./../models/groupDb.js";
import { cmdLog } from "./cmdLog.js";
import { Rstr } from "./textBots.js";
import { isCategoryEnabled, default as cmdManagerCmd } from "./cmdManager.js";
import { botStatus } from "./../commands/group/bot.js";
import { categories } from "./consts/cat.js";

let middlewareCache = null;
let middlewareCacheTime = 0;
let commandCache = null;
let commandCacheTime = 0;
const CACHE_TTL = 30000;

async function loadMiddlewares() {
  const now = Date.now();
  if (middlewareCache && now - middlewareCacheTime < CACHE_TTL)
    return middlewareCache;
  const middlewares = [];
  for (const cat of categories) {
    const folderPath = `./commands/${cat}`;
    if (!fs.existsSync(folderPath)) continue;
    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      try {
        const { default: cmd } = await import(
          `../commands/${cat}/${file}?update=${now}`
        );
        if (cmd && typeof cmd.middleware === "function") middlewares.push(cmd);
      } catch (e) {
        console.error(chalk.red(`Error middleware ${file}:`), e.message);
      }
    }
  }
  middlewareCache = middlewares;
  middlewareCacheTime = now;
  return middlewares;
}

async function loadCommands() {
  const now = Date.now();
  if (commandCache && now - commandCacheTime < CACHE_TTL) return commandCache;
  const allCommands = [];
  for (const cat of categories) {
    const folderPath = `./commands/${cat}`;
    if (!fs.existsSync(folderPath)) continue;
    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      try {
        const { default: cmd } = await import(
          `../commands/${cat}/${file}?update=${now}`
        );
        if (cmd && cmd.name) allCommands.push(cmd);
      } catch (e) {
        console.error(chalk.red(`Error comando ${file}:`), e.message);
      }
    }
  }
  allCommands.push(cmdManagerCmd);
  commandCache = allCommands;
  commandCacheTime = now;
  return allCommands;
}

async function resolveMessageLids(m, sock, remoteJid) {
  if (!m || !m.message) return;

  const findAndResolveContextInfo = async (obj) => {
    if (!obj || typeof obj !== "object") return;

    if (obj.contextInfo) {
      const ci = obj.contextInfo;
      if (ci.participant) {
        try {
          ci.participant = await resolveLidToRealJid(
            ci.participant,
            sock,
            remoteJid,
          );
        } catch (e) {
          console.error(
            "[resolveMessageLids] Error resolving participant LID:",
            e.message,
          );
        }
      }
      if (Array.isArray(ci.mentionedJid)) {
        for (let i = 0; i < ci.mentionedJid.length; i++) {
          try {
            ci.mentionedJid[i] = await resolveLidToRealJid(
              ci.mentionedJid[i],
              sock,
              remoteJid,
            );
          } catch (e) {
            console.error(
              "[resolveMessageLids] Error resolving mention LID:",
              e.message,
            );
          }
        }
      }
    }

    for (const key of Object.keys(obj)) {
      if (obj[key] && typeof obj[key] === "object") {
        await findAndResolveContextInfo(obj[key]);
      }
    }
  };

  await findAndResolveContextInfo(m.message);
}

export async function handleMessage(sock, m, db, saveDB) {
  if (!m || !m.message) return;

  const remoteJid = m.key.remoteJid;

  // Resolve all LIDs in tags (mentionedJid) and replies (participant) to real phone numbers
  try {
    await resolveMessageLids(m, sock, remoteJid);
  } catch (e) {
    console.error("[handleMessage] Error resolving message LIDs:", e);
  }

  const isGroup = remoteJid.endsWith("@g.us");
  const senderRaw = m.key.participant || remoteJid;

  const text =
    m.message.conversation ||
    m.message.extendedTextMessage?.text ||
    m.message.imageMessage?.caption ||
    m.message.videoMessage?.caption ||
    "";

  const groupPrefix = isGroup ? db.groups?.[remoteJid]?.prefix : null;
  const prefix = groupPrefix || db.prefix;
  const esComando = text.startsWith(prefix);
  const argsForCheck = esComando
    ? text.slice(prefix.length).trim().split(/ +/)
    : [];
  const commandNameForCheck = esComando ? argsForCheck[0]?.toLowerCase() : null;

  const botId = sock.user?.id
    ? sock.user.id.split("@")[0].split(":")[0] + "@s.whatsapp.net"
    : null;
  const groupPrimaryBot = isGroup ? db.groups?.[remoteJid]?.primaryBot : null;
  if (isGroup && groupPrimaryBot && botId && groupPrimaryBot !== botId) {
    if (
      esComando &&
      (commandNameForCheck === "setprimary" ||
        commandNameForCheck === "primary")
    ) {
    } else {
      return;
    }
  }

  if (isGroup && db.groups?.[remoteJid]?.botOn === false) {
    if (text === `${prefix}bot on` || commandNameForCheck === "bot") {
    } else if (esComando) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ El bot está desactivado. Usa *${prefix}bot on* para activarlo.`,
        },
        { quoted: m },
      );
    } else return;
  }

  const jidResuelto = await resolveLidToRealJid(senderRaw, sock, remoteJid);
  const numeroReal = jidResuelto.split("@")[0].split(":")[0];
  const jidRemitente = `${numeroReal}@s.whatsapp.net`;

  if (
    isGroup &&
    !m.key.fromMe &&
    trackGroupActivity(db, remoteJid, jidRemitente)
  )
    saveDB(db);

  const owners = db.owners || [];
  const sender = m.key.fromMe ? botId : jidRemitente;
  const isOwner = owners.includes(sender);
  const rangoLog = isOwner ? "OWNER 👑" : "USUARIO 👤";

  let isAdmin = false;
  let isBotAdmin = false;
  let groupMetadata = null;

  if (isGroup) {
    try {
      groupMetadata = await sock.getMetadata(remoteJid);
      
      // 🛠️ SOLUCIÓN: Conversión segura a String controlando valores nulos o indefinidos
      const clean = (id) => {
        if (!id) return null;
        return String(id).split("@")[0].split(":")[0];
      };
      
      const senderBase = clean(senderRaw);
      const jidRemitenteBase = clean(jidRemitente);
      const botBase = clean(sock.user?.id);

      const userParticipant = groupMetadata.participants.find((p) => {
        const pIdClean = clean(p.id);
        const pLidClean = clean(p.lid);
        const pPhoneClean = clean(p.phoneNumber);
        return (
          (senderBase &&
            (pIdClean === senderBase ||
              pLidClean === senderBase ||
              pPhoneClean === senderBase)) ||
          (jidRemitenteBase &&
            (pIdClean === jidRemitenteBase ||
              pLidClean === jidRemitenteBase ||
              pPhoneClean === jidRemitenteBase))
        );
      });

      const botParticipant = groupMetadata.participants.find((p) => {
        const pIdClean = clean(p.id);
        const pLidClean = clean(p.lid);
        const pPhoneClean = clean(p.phoneNumber);
        return (
          botBase &&
          (pIdClean === botBase ||
            pLidClean === botBase ||
            pPhoneClean === botBase)
        );
      });

      isAdmin =
        userParticipant?.admin === "admin" ||
        userParticipant?.admin === "superadmin";
      isBotAdmin =
        botParticipant?.admin === "admin" ||
        botParticipant?.admin === "superadmin";
    } catch (e) {
      console.error("[msgHandler] Error al validar administradores:", e);
      isAdmin = false;
    }
  }

  try {
    const middlewares = await loadMiddlewares();
    for (const cmd of middlewares)
      await cmd.middleware(sock, m, {
        db,
        saveDB,
        owners,
        isAdmin,
        isBotAdmin,
        isOwner,
        groupMetadata,
        text,
      });
  } catch (e) {
    console.error(e);
  }

  if (!esComando) {
    cmdLog({
      numeroReal,
      rango: rangoLog,
      isGroup,
      text,
      pushName: m.pushName,
      groupMetadata,
      m,
      sock,
    });
  } else {
    const args = text.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    cmdLog({
      numeroReal,
      rango: isOwner ? "OWNER 👑" : isAdmin ? "ADMIN 🛡️" : "USUARIO 👤",
      commandName,
      isGroup,
      text,
      pushName: m.pushName,
      groupMetadata,
      m,
      prefix,
      sock,
    });

    const allCommands = await loadCommands();
    let commandFound = false;

    for (const cmd of allCommands) {
      const match = Array.isArray(cmd.name)
        ? cmd.name.includes(commandName)
        : cmd.name === commandName;
      if (match) {
        commandFound = true;
        const requiresOwner =
          cmd.ownerOnly !== false && cmd.category === "owner";
        if (requiresOwner && !isOwner)
          return await sock.sendMessage(
            remoteJid,
            { text: Rstr.onlyOwner },
            { quoted: m },
          );
        if (
          (cmd.category === "group" || cmd.category === "economy") &&
          !isGroup
        )
          return await sock.sendMessage(
            remoteJid,
            { text: Rstr.onlyGroup },
            { quoted: m },
          );
        if (isGroup && !isCategoryEnabled(remoteJid, cmd.category, db))
          return await sock.sendMessage(
            remoteJid,
            { text: "Categoría desactivada." },
            { quoted: m },
          );
        if (cmd.adminOnly && !isAdmin)
          return await sock.sendMessage(
            remoteJid,
            { text: Rstr.onlyAdmin },
            { quoted: m },
          );

        try {
          await cmd.execute(sock, m, args, {
            prefix,
            db,
            saveDB,
            isOwner,
            isAdmin,
            isBotAdmin,
            owners,
            groupMetadata,
            numeroReal,
            jidRemitente,
          });
        } catch (err) {
          console.error(
            `[msgHandler] Error ejecutando comando ${commandName}:`,
            err,
          );
          await sock.sendMessage(
            remoteJid,
            {
              text: "⚠️ Ocurrió un error al ejecutar el comando. Revisa la consola del bot.",
            },
            { quoted: m },
          );
        }
        return;
      }
    }

    if (!commandFound) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐂𝐎𝐌𝐀𝐍𝐃𝐎 𝐍𝐎 𝐄𝐗𝐈𝐒𝐓𝐄\n╰━━━━━━━━━━━━⬣\n┃ > El comando que intentaste usar no existe.\n┃ > Usa el menú con ${prefix}menu para ver los comandos disponibles.`,
        },
        { quoted: m },
      );
    }
  }
}
