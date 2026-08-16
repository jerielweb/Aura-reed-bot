import fs from "fs";
import chalk from "chalk";
import { trackGroupActivity } from "./../models/groupDb.js";
import { cmdLog } from "./cmdLog.js";
import { Rstr, catOff } from "./textBots.js";
import { isCategoryEnabled, default as cmdManagerCmd } from "./cmdManager.js";
import { botStatus } from "./../commands/group/bot.js";
import { categories } from "./consts/cat.js";
import { activeHangmanGames, gameKey } from "../models/gameState.js";
import { processHangmanGuess } from "../commands/games/ahorcado.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

// 💡 FUNCIÓN PARA RESOLVER USERNAMES, LIDs O NORMALIZAR JIDs
async function resolveLidToRealJid(jid, sock, remoteJid) {
  if (!jid) return "";

  // 1. Resolver Username (@username)
  if (jid.startsWith("@") || (!jid.includes("@") && isNaN(jid))) {
    const cleanUsername = jid.replace("@", "").toLowerCase();
    try {
      if (sock?.pnFromUsername) {
        const pn = await sock.pnFromUsername(cleanUsername);
        if (pn) return jidNormalizedUser(pn);
      }
    } catch (e) {
      console.error("[resolveLidToRealJid] Error resolviendo Username:", e.message);
    }
  }

  // 2. Resolver LID (@lid)
  if (jid.endsWith("@lid")) {
    try {
      if (sock?.signalRepository?.lidToJid) {
        const resolved = await sock.signalRepository.lidToJid(jid);
        if (resolved) return jidNormalizedUser(resolved);
      }
    } catch (e) {
      console.error("[resolveLidToRealJid] Error resolviendo LID:", e.message);
    }
  }

  // 3. JID normal (@s.whatsapp.net)
  return jidNormalizedUser(jid);
}

// Lista de prefijos múltiples permitidos por defecto
const DEFAULT_PREFIXES = [".", "#", "/", "!"];

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
  const isGroup = remoteJid.endsWith("@g.us");
  const senderRaw = m.key.participant || remoteJid;

  // 🛠️ GUARDAR MENSAJE PARA SOPORTE DE "ESPERANDO MENSAJE" (RETRY REQUESTS)
  try {
    if (db && typeof db.run === "function") {
      await db.run(
        "INSERT OR REPLACE INTO messages (id, jid, message) VALUES (?, ?, ?)",
        [m.key.id, remoteJid, JSON.stringify(m.message)]
      );
    }
  } catch (e) {
    // Si la tabla no existe en tu esquema SQLite o falla, el try evita detener la ejecución
  }

  // 🔇 DETECTOR Y BORRADO AUTOMÁTICO DE USUARIOS SILENCIADOS (MUTE)
  if (isGroup && senderRaw) {
    try {
      const senderJid = await resolveLidToRealJid(senderRaw, sock, remoteJid);
      const mutedUsers = db.groups?.[remoteJid]?.mutedUsers || [];

      if (mutedUsers.includes(senderJid)) {
        await sock.sendMessage(remoteJid, {
          delete: {
            remoteJid: remoteJid,
            fromMe: false,
            id: m.key.id,
            participant: senderRaw,
          },
        });
        return;
      }
    } catch (e) {
      console.error("[handleMessage] Error al verificar/borrar usuario silenciado:", e);
    }
  }

  try {
    await resolveMessageLids(m, sock, remoteJid);
  } catch (e) {
    console.error("[handleMessage] Error resolving message LIDs:", e);
  }

  const text =
    m.message.conversation ||
    m.message.extendedTextMessage?.text ||
    m.message.imageMessage?.caption ||
    m.message.videoMessage?.caption ||
    m.msg?.selectedDisplayText ||
    m.message.buttonsResponseMessage?.selectedButtonId ||
    m.message.listResponseMessage?.singleSelectReply?.selectedRowId ||
    m.text ||
    "";

  const groupPrefix = isGroup ? db.groups?.[remoteJid]?.prefix : null;
  const activePrefixes = groupPrefix ? [groupPrefix] : DEFAULT_PREFIXES;

  const usedPrefix = activePrefixes.find((p) => text.startsWith(p));
  const esComando = Boolean(usedPrefix);
  const prefix = usedPrefix || groupPrefix || DEFAULT_PREFIXES[0];

  const argsForCheck = esComando
    ? text.slice(prefix.length).trim().split(/ +/)
    : [];
  const commandNameForCheck = esComando ? argsForCheck[0]?.toLowerCase() : null;

  // 🚫 VERIFICACIÓN DE CHAT BANEADO (BANCHAT)
  const isChatBanned = db.chats?.[remoteJid]?.isBanned;
  const isUnbanCmd =
    commandNameForCheck === "unbanchat" ||
    commandNameForCheck === "desbanearchat";

  if (isChatBanned && !isUnbanCmd) {
    return; // Ignora en silencio cualquier comando o interacción si el chat está baneado
  }

  // Interceptor del juego ahorcado
  const hangmanKey = gameKey(sock, remoteJid);
  if (activeHangmanGames.has(hangmanKey) && !esComando) {
    const game = activeHangmanGames.get(hangmanKey);
    const quotedId = m.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const isReplyToGame = game.lastMessage?.key?.id && quotedId === game.lastMessage.key.id;

    // En grupos, solo intercepta si es reply directo a la imagen del juego.
    // En privado, cualquier mensaje suelto cuenta como intento.
    const shouldIntercept = isReplyToGame || !isGroup;

    if (shouldIntercept) {
      const wasGameMove = await processHangmanGuess(sock, m, text, prefix, db, saveDB);
      if (wasGameMove) return;
    }
  }

  // 🤖 VERIFICACIÓN DE BOT PRIMARIO
  const cleanJid = (jid) => (jid ? String(jid).split("@")[0].split(":")[0] : null);

  const groupPrimaryBot = isGroup ? db.groups?.[remoteJid]?.primaryBot : null;

  if (isGroup && groupPrimaryBot) {
    const currentBotNum = cleanJid(sock.user?.id || sock.user?.jid);
    const primaryBotNum = cleanJid(groupPrimaryBot);

    // Permitir el comando setprimary/primary para poder reconfigurar o desactivar
    const isPrimaryCmd = ["setprimary", "primary"].includes(commandNameForCheck);

    if (currentBotNum !== primaryBotNum && !isPrimaryCmd) {
      return; // El bot secundario ignora todos los demás comandos
    }
  }

  if (isGroup && db.groups?.[remoteJid]?.botOn === false) {
    if (commandNameForCheck === "bot" && argsForCheck[1]?.toLowerCase() === "on") {
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
  const botId = sock.user?.id || sock.user?.jid;
  const sender = m.key.fromMe ? botId : jidRemitente;
  const isOwner = owners.includes(sender);

  let isAdmin = false;
  let isBotAdmin = false;
  let groupMetadata = null;

  if (isGroup) {
    try {
      groupMetadata = await sock.groupMetadata(remoteJid);
      
      const clean = (id) => (id ? String(id).split("@")[0].split(":")[0] : null);
      
      const senderBase = clean(senderRaw);
      const botBase = clean(sock.user?.id);

      const userParticipant = groupMetadata.participants?.find((p) => {
        const pId = clean(p.id);
        const pJid = clean(p.jid);
        const pPhone = clean(p.phoneNumber);
        
        return senderBase && (pId === senderBase || pJid === senderBase || pPhone === senderBase);
      });

      const botParticipant = groupMetadata.participants?.find((p) => {
        const pId = clean(p.id);
        const pJid = clean(p.jid);
        const pPhone = clean(p.phoneNumber);
        
        return botBase && (pId === botBase || pJid === botBase || pPhone === botBase);
      });

      isAdmin = userParticipant?.admin === "admin" || userParticipant?.admin === "superadmin";
      isBotAdmin = botParticipant?.admin === "admin" || botParticipant?.admin === "superadmin";

    } catch (e) {
      isAdmin = false;
      isBotAdmin = false;
    }
  }

  // 🛡️ VERIFICACIÓN DEL MODO "SOLO ADMINS" (onlyAdmin)
  if (
    isGroup &&
    db.groups?.[remoteJid]?.onlyAdmin &&
    esComando &&
    !isAdmin &&
    !isOwner
  ) {
    return;
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
      rango: isOwner ? "OWNER 👑" : "USUARIO 👤",
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
            { text: catOff({ CAT_CMD: cmd.category }) },
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
