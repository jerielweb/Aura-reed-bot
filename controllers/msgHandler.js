import fs from "fs";
import chalk from "chalk";
import NodeCache from "node-cache";
import { resolveLidToRealJid } from "./../models/utils.js";
import { trackGroupActivity } from "./../models/groupDb.js";
import { cmdLog } from "./cmdLog.js";
import { Rstr, catOff } from "./textBots.js";
import { isCategoryEnabled, default as cmdManagerCmd } from "./cmdManager.js";
import { botStatus } from "./../commands/group/bot.js";
import { categories } from "./consts/cat.js";
import { activeHangmanGames, gameKey } from "../models/gameState.js";
import { processHangmanGuess } from "../commands/games/ahorcado.js";

// Caché para metadatos de grupos (guarda por 10 minutos en memoria RAM)
const groupMetadataCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });

// Función auxiliar para obtener metadata desde caché o solicitarla de forma segura
async function getGroupMetadataSafe(sock, remoteJid) {
  if (!remoteJid || !remoteJid.endsWith("@g.us")) return null;

  // 1. Devolver desde la caché local si existe
  const cached = groupMetadataCache.get(remoteJid);
  if (cached) return cached;

  // 2. Si no existe, solicitar a WhatsApp dentro de un bloque protegido
  try {
    const metadata = await sock.groupMetadata(remoteJid);
    if (metadata) {
      groupMetadataCache.set(remoteJid, metadata);
    }
    return metadata;
  } catch (error) {
    console.error(
      `[groupMetadataCache] Error o rate-limit obteniendo metadatos de ${remoteJid}:`,
      error.message,
    );
    return null; // Retorna null para evitar tumbar la ejecución en caso de error 429
  }
}

// Lista de prefijos múltiples permitidos por defecto
const DEFAULT_PREFIXES = [".", "#", "/", "!", "-", "%", "$"];

// ============================================================
// CARGA DE COMANDOS Y MIDDLEWARES (HOT-RELOAD POR fs.watch)
// ============================================================
const loadedFiles = new Map(); // ruta relativa -> módulo cargado
let watchersReady = false;
const pendingReload = new Map(); // debounce por archivo

function isMiddlewareModule(cmd) {
  return Boolean(cmd && typeof cmd.middleware === "function");
}

function isCommandModule(cmd) {
  return Boolean(cmd && cmd.name);
}

async function importCommandFile(relPath, bust = false) {
  try {
    const spec = bust ? `${relPath}?update=${Date.now()}` : relPath;
    const { default: cmd } = await import(spec);
    return cmd || null;
  } catch (e) {
    console.error(
      chalk.red(`[Comandos] Error cargando ${relPath}:`),
      e.message,
    );
    return null;
  }
}

async function initialCommandScan() {
  for (const cat of categories) {
    const folderPath = `./commands/${cat}`;
    if (!fs.existsSync(folderPath)) continue;
    const files = fs.readdirSync(folderPath).filter((f) => f.endsWith(".js"));
    for (const file of files) {
      const relPath = `../commands/${cat}/${file}`;
      const cmd = await importCommandFile(relPath);
      if (cmd) loadedFiles.set(relPath, cmd);
    }
  }
}

function scheduleReload(cat, file) {
  const relPath = `../commands/${cat}/${file}`;
  const absPath = `./commands/${cat}/${file}`;

  clearTimeout(pendingReload.get(relPath));
  pendingReload.set(
    relPath,
    setTimeout(async () => {
      pendingReload.delete(relPath);

      if (!fs.existsSync(absPath)) {
        if (loadedFiles.delete(relPath)) {
          console.log(
            chalk.yellow(`[Comandos] 🗑️ Eliminado: ${file} (${cat})`),
          );
        }
        return;
      }

      const cmd = await importCommandFile(relPath, true);
      if (cmd) {
        const isNew = !loadedFiles.has(relPath);
        loadedFiles.set(relPath, cmd);
        console.log(
          chalk.cyan(
            `[Comandos] ${isNew ? "🆕 Agregado" : "♻️ Recargado"}: ${file} (${cat})`,
          ),
        );
      }
    }, 300),
  );
}

function initCommandWatchers() {
  if (watchersReady) return;
  watchersReady = true;

  for (const cat of categories) {
    const folderPath = `./commands/${cat}`;
    if (!fs.existsSync(folderPath)) continue;

    try {
      fs.watch(folderPath, (eventType, filename) => {
        if (!filename || !filename.endsWith(".js")) return;
        scheduleReload(cat, filename);
      });
    } catch (e) {
      console.error(
        chalk.red(`[Comandos] No se pudo observar ${folderPath}:`),
        e.message,
      );
    }
  }
}

async function ensureCommandsLoaded() {
  if (loadedFiles.size === 0) {
    await initialCommandScan();
  }
  initCommandWatchers();
}

async function loadMiddlewares() {
  await ensureCommandsLoaded();
  return [...loadedFiles.values()].filter(isMiddlewareModule);
}

async function loadCommands() {
  await ensureCommandsLoaded();
  const allCommands = [...loadedFiles.values()].filter(isCommandModule);
  allCommands.push(cmdManagerCmd);
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
        [m.key.id, remoteJid, JSON.stringify(m.message)],
      );
    }
  } catch (e) {}

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
      console.error(
        "[handleMessage] Error al verificar/borrar usuario silenciado:",
        e,
      );
    }
  }

  const rawCtxInfo = m.message?.extendedTextMessage?.contextInfo;
  const rawParticipant = rawCtxInfo?.participant || null;
  const rawMentionedJid = Array.isArray(rawCtxInfo?.mentionedJid)
    ? [...rawCtxInfo.mentionedJid]
    : [];

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

  const cleanJid = (jid) =>
    jid ? String(jid).split("@")[0].split(":")[0] : null;
  const jidResuelto = await resolveLidToRealJid(senderRaw, sock, remoteJid);
  const numeroReal = jidResuelto.split("@")[0].split(":")[0];
  const jidRemitente = `${numeroReal}@s.whatsapp.net`;
  const owners = db.owners || [];
  const botId = sock.user?.id || sock.user?.jid;
  const sender = m.key.fromMe ? botId : jidRemitente;
  const isOwner = owners.some((owner) => cleanJid(owner) === cleanJid(sender));

  if (db.selfMode && !isOwner) return;

  // 🚫 VERIFICACIÓN DE CHAT BANEADO (BANCHAT)
  const isChatBanned = db.chats?.[remoteJid]?.isBanned;
  const isUnbanCmd =
    commandNameForCheck === "unbanchat" ||
    commandNameForCheck === "desbanearchat";

  if (isChatBanned && !isUnbanCmd) {
    return;
  }

  // Interceptor del juego ahorcado
  const hangmanKey = gameKey(sock, remoteJid);
  if (activeHangmanGames.has(hangmanKey) && !esComando) {
    const game = activeHangmanGames.get(hangmanKey);
    const quotedId = m.message?.extendedTextMessage?.contextInfo?.stanzaId;
    const isReplyToGame =
      game.lastMessage?.key?.id && quotedId === game.lastMessage.key.id;

    const shouldIntercept = isReplyToGame || !isGroup;

    if (shouldIntercept) {
      const wasGameMove = await processHangmanGuess(
        sock,
        m,
        text,
        prefix,
        db,
        saveDB,
      );
      if (wasGameMove) return;
    }
  }

  // 🤖 VERIFICACIÓN DE BOT PRIMARIO
  if (isGroup && db.groups?.[remoteJid]?.primaryBot) {
    const groupPrimaryBotJid = db.groups[remoteJid].primaryBot;
    const normalizeBotNumber = (jid) =>
      cleanJid(jid)?.replace(/\D/g, "") || null;
    const currentBotNum = normalizeBotNumber(sock.user?.id || sock.user?.jid);
    const primaryBotNum = normalizeBotNumber(groupPrimaryBotJid);

    const isPrimaryCmd = ["setprimary", "primary"].includes(
      commandNameForCheck,
    );

    if (currentBotNum !== primaryBotNum && !isPrimaryCmd) {
      return;
    }
  }

  if (isGroup && db.groups?.[remoteJid]?.botOn === false) {
    if (
      commandNameForCheck === "bot" &&
      argsForCheck[1]?.toLowerCase() === "on"
    ) {
    } else if (esComando) {
      await sock.sendPresenceUpdate("paused", remoteJid);
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ El bot está desactivado. Usa *${prefix}bot on* para activarlo.`,
        },
        { quoted: m },
      );
    } else {
      await sock.sendPresenceUpdate("paused", remoteJid);
      return;
    }
  }

  if (
    isGroup &&
    !m.key.fromMe &&
    trackGroupActivity(db, remoteJid, jidRemitente)
  )
    saveDB(db);

  const rangoLog = isOwner ? "OWNER 👑" : "USUARIO 👤";

  let isAdmin = false;
  let isBotAdmin = false;
  let groupMetadata = null;

  if (isGroup) {
    groupMetadata = await getGroupMetadataSafe(sock, remoteJid);

    if (groupMetadata) {
      if (Array.isArray(groupMetadata.participants)) {
        groupMetadata.participants = await Promise.all(
          groupMetadata.participants.map(async (p) => {
            let realJid = p.id;

            if (p.id && p.id.endsWith("@lid")) {
              try {
                const resolved = await resolveLidToRealJid(
                  p.id,
                  sock,
                  remoteJid,
                );
                if (resolved && !resolved.endsWith("@lid")) {
                  realJid = resolved;
                }
              } catch (e) {
                realJid = p.id;
              }
            }

            const extractNum = (jid) => {
              if (!jid || jid.endsWith("@lid")) return null;
              return jid.split("@")[0].split(":")[0];
            };

            const num =
              extractNum(realJid) ||
              extractNum(p.jid) ||
              extractNum(p.phoneNumber);
            const isSender = p.id === senderRaw || realJid === jidRemitente;

            const validUsername =
              p.username &&
              !p.username.includes("@") &&
              !/^\d+$/.test(p.username)
                ? p.username
                : null;
            const displayHandle =
              validUsername ||
              p.notify ||
              (isSender ? m.pushName : null) ||
              num ||
              "usuario";

            return {
              ...p,
              jid: realJid,
              phoneNumber: num ? `+${num}` : undefined,
              username: displayHandle.startsWith("@")
                ? displayHandle
                : `@${displayHandle}`,
            };
          }),
        );
      }

      const clean = (id) =>
        id ? String(id).split("@")[0].split(":")[0] : null;

      const senderBase = clean(senderRaw);
      const botBase = clean(sock.user?.id);

      const userParticipant = groupMetadata.participants?.find((p) => {
        const pId = clean(p.id);
        const pJid = clean(p.jid);
        const pPhone = clean(p.phoneNumber);

        return (
          senderBase &&
          (pId === senderBase || pJid === senderBase || pPhone === senderBase)
        );
      });

      const botParticipant = groupMetadata.participants?.find((p) => {
        const pId = clean(p.id);
        const pJid = clean(p.jid);
        const pPhone = clean(p.phoneNumber);

        return (
          botBase && (pId === botBase || pJid === botBase || pPhone === botBase)
        );
      });

      isAdmin =
        userParticipant?.admin === "admin" ||
        userParticipant?.admin === "superadmin";
      isBotAdmin =
        botParticipant?.admin === "admin" ||
        botParticipant?.admin === "superadmin";
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
    await sock.sendPresenceUpdate("paused", remoteJid);
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
      rango: rangoLog,
      isGroup,
      text,
      pushName: m.pushName,
      groupMetadata,
      m,
      sock,
    });
    // 🔴 DETENER ESTADO DE "ESCRIBIENDO" (Mensaje normal sin comando)
    await sock.sendPresenceUpdate("paused", remoteJid);
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
        if (requiresOwner && !isOwner) {
          await sock.sendPresenceUpdate("paused", remoteJid);
          return await sock.sendMessage(
            remoteJid,
            { text: Rstr.onlyOwner },
            { quoted: m },
          );
        }
        if (
          (cmd.category === "group" || cmd.category === "economy") &&
          !isGroup
        ) {
          await sock.sendPresenceUpdate("paused", remoteJid);
          return await sock.sendMessage(
            remoteJid,
            { text: Rstr.onlyGroup },
            { quoted: m },
          );
        }
        if (isGroup && !isCategoryEnabled(remoteJid, cmd.category, db)) {
          await sock.sendPresenceUpdate("paused", remoteJid);
          return await sock.sendMessage(
            remoteJid,
            { text: catOff({ CAT_CMD: cmd.category, prefix }) },
            { quoted: m },
          );
        }
        if (cmd.adminOnly && !isAdmin) {
          await sock.sendPresenceUpdate("paused", remoteJid);
          return await sock.sendMessage(
            remoteJid,
            { text: Rstr.onlyAdmin },
            { quoted: m },
          );
        }

        // Activar "escribiendo" solo para comandos válidos y autorizados.
        await sock.sendPresenceUpdate("composing", remoteJid);

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
            senderRaw,
            rawParticipant,
            rawMentionedJid,
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
        } finally {
          // 🔴 DETENER ESTADO DE "ESCRIBIENDO" (Al finalizar el comando con éxito o error)
          await sock.sendPresenceUpdate("paused", remoteJid);
        }
        return;
      }
    }

    if (!commandFound) {
      // 🔴 DETENER ESTADO DE "ESCRIBIENDO" (Comando no encontrado)
      await sock.sendPresenceUpdate("paused", remoteJid);
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐂𝐎𝐌𝐀𝐍𝐃𝐎 𝐍𝐎 𝐄𝐗𝐈𝐒𝐓𝐄\n╰━━━━━━━━━━━━⬣\n┃ > El comando \`${prefix}${commandName}\` no existe\n┃ > o esta mal escrito.\n┃ > Ejecuta \`${prefix}menu\` para ver\n┃ > los comandos disponibles.`,
        },
        { quoted: m },
      );
    }
  }
}
