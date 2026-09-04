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
    console.error(`[groupMetadataCache] Error o rate-limit obteniendo metadatos de ${remoteJid}:`, error.message);
    return null; // Retorna null para evitar tumbar la ejecución en caso de error 429
  }
}

// Lista de prefijos múltiples permitidos por defecto
const DEFAULT_PREFIXES = [".", "#", "/", "!", "-", "%", "$"];

// ============================================================
// CARGA DE COMANDOS Y MIDDLEWARES (HOT-RELOAD POR fs.watch)
// ============================================================
// Antes: se reimportaban TODOS los archivos cada 30s con un
// query string único (?update=timestamp), lo que generaba una
// instancia de módulo nueva en cada ciclo y esas instancias nunca
// se liberaban -> fuga de memoria progresiva.
//
// Ahora: cada archivo se importa UNA sola vez al arrancar y queda
// cacheado en memoria (loadedFiles). Solo se vuelve a importar
// (con un query string único, pero solo para ESE archivo) cuando
// fs.watch detecta que realmente cambió, fue creado o eliminado.
// Un comando nuevo se detecta solo, sin reiniciar el bot.

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
    console.error(chalk.red(`[Comandos] Error cargando ${relPath}:`), e.message);
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

  // Debounce: algunos editores/SFTP disparan varios eventos por un solo guardado
  clearTimeout(pendingReload.get(relPath));
  pendingReload.set(
    relPath,
    setTimeout(async () => {
      pendingReload.delete(relPath);

      if (!fs.existsSync(absPath)) {
        if (loadedFiles.delete(relPath)) {
          console.log(chalk.yellow(`[Comandos] 🗑️ Eliminado: ${file} (${cat})`));
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
  sock.sendPresenceUpdate('composing', remoteJid)
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

  // 📌 Capturamos los valores CRUDOS (tal cual los da WhatsApp) antes de que
  // resolveMessageLids los mute in-place. Comandos como marry/divorce que
  // necesitan comparar identidades por LID deben partir de estos valores,
  // no de los ya "resueltos" más abajo, para evitar doble resolución.
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

  const groupPrimaryBot = isGroup ? db.groups?.[remoteJid]?.prefix : null;

  if (isGroup && db.groups?.[remoteJid]?.primaryBot) {
    const groupPrimaryBotJid = db.groups[remoteJid].primaryBot;
    const currentBotNum = cleanJid(sock.user?.id || sock.user?.jid);
    const primaryBotNum = cleanJid(groupPrimaryBotJid);

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
  const rangoLog = isOwner ? "OWNER 👑" : "USUARIO 👤";

  let isAdmin = false;
  let isBotAdmin = false;
  let groupMetadata = null;

  if (isGroup) {
    // Uso del método seguro respaldado por caché en RAM
    groupMetadata = await getGroupMetadataSafe(sock, remoteJid);

    if (groupMetadata) {
      // 🏷️ MAPEAR PARTICIPANTES CORRIGIENDO EXTRACCIÓN DE USERNAME Y LIDs
      if (Array.isArray(groupMetadata.participants)) {
        groupMetadata.participants = await Promise.all(
          groupMetadata.participants.map(async (p) => {
            let realJid = p.id;

            if (p.id && p.id.endsWith("@lid")) {
              try {
                const resolved = await resolveLidToRealJid(p.id, sock, remoteJid);
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

            const num = extractNum(realJid) || extractNum(p.jid) || extractNum(p.phoneNumber);
            const isSender = p.id === senderRaw || realJid === jidRemitente;
            
            // Prioriza username real si no es un número/LID, de lo contrario busca el notify/pushName o número limpio
            const validUsername = p.username && !p.username.includes("@") && !/^\d+$/.test(p.username) ? p.username : null;
            const displayHandle = validUsername || p.notify || (isSender ? m.pushName : null) || num || "usuario";

            return {
              ...p,
              jid: realJid,
              phoneNumber: num ? `+${num}` : undefined,
              username: displayHandle.startsWith("@") ? displayHandle : `@${displayHandle}`,
            };
          })
        );
      }

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
            { text: catOff({ CAT_CMD: cmd.category, prefix }) },
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
        }
        return;
      }
    }

    if (!commandFound) {
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
