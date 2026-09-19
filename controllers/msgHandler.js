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
import { getDBSync } from "../models/db.js";
import { runWithGachaDatabase } from "../models/gachaDb.js";
import { fytBold } from "../models/TextStyle.js;

const groupMetadataCache = new NodeCache({ stdTTL: 600, checkperiod: 120 });
const userCooldowns = new NodeCache({ stdTTL: 3, checkperiod: 4 });

async function getGroupMetadataSafe(sock, remoteJid) {
  if (!remoteJid || !remoteJid.endsWith("@g.us")) return null;

  const cached = groupMetadataCache.get(remoteJid);
  if (cached) return cached;

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
    return null;
  }
}

const DEFAULT_PREFIXES = [".", "#", "/", "!", "-", "%", "$"];

const loadedFiles = new Map();
let watchersReady = false;
const pendingReload = new Map();
let cachedMiddlewares = null;
let cachedCommands = null;

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
        cachedMiddlewares = null;
        cachedCommands = null;
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
  if (cachedMiddlewares) return cachedMiddlewares;
  cachedMiddlewares = [...loadedFiles.values()].filter(isMiddlewareModule);
  return cachedMiddlewares;
}

async function loadCommands() {
  await ensureCommandsLoaded();
  if (cachedCommands) return cachedCommands;
  const allCommands = [...loadedFiles.values()].filter(isCommandModule);
  allCommands.push(cmdManagerCmd);
  cachedCommands = allCommands;
  return cachedCommands;
}

async function resolveMessageLids(m, sock, remoteJid) {
  if (!m || !m.message) return;

  const hasContextInfo =
    !!m.message?.extendedTextMessage?.contextInfo ||
    !!m.message?.imageMessage?.contextInfo ||
    !!m.message?.videoMessage?.contextInfo ||
    !!m.message?.audioMessage?.contextInfo ||
    !!m.message?.stickerMessage?.contextInfo ||
    !!m.message?.listResponseMessage ||
    !!m.message?.buttonsResponseMessage;

  if (!hasContextInfo) return;

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
        } catch (e) {}
      }
      if (Array.isArray(ci.mentionedJid)) {
        for (let i = 0; i < ci.mentionedJid.length; i++) {
          try {
            ci.mentionedJid[i] = await resolveLidToRealJid(
              ci.mentionedJid[i],
              sock,
              remoteJid,
            );
          } catch (e) {}
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

  if (isGroup && senderRaw) {
    const mutedUsers = db.groups?.[remoteJid]?.mutedUsers || [];
    if (Array.isArray(mutedUsers) && mutedUsers.length > 0) {
      try {
        const senderJid = senderRaw.endsWith("@lid")
          ? await resolveLidToRealJid(senderRaw, sock, remoteJid)
          : senderRaw;

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
      } catch (e) {}
    }
  }

  const rawCtxInfo = m.message?.extendedTextMessage?.contextInfo;
  const rawParticipant = rawCtxInfo?.participant || null;
  const rawMentionedJid = Array.isArray(rawCtxInfo?.mentionedJid)
    ? [...rawCtxInfo.mentionedJid]
    : [];

  try {
    if (
      !esComando &&
      m.message &&
      (m.message.extendedTextMessage ||
        m.message.listResponseMessage ||
        m.message.buttonsResponseMessage)
    ) {
      await resolveMessageLids(m, sock, remoteJid);
    }
  } catch (e) {}

  if (!esComando) {
    if (isGroup && !m.key.fromMe) {
      trackGroupActivity(db, remoteJid, senderRaw);
    }
    return;
  }

  const cleanJid = (jid) =>
    jid ? String(jid).split("@")[0].split(":")[0] : null;
  const jidResuelto = await resolveLidToRealJid(senderRaw, sock, remoteJid);
  const resolvedIsLid =
    jidResuelto?.endsWith("@lid") || jidResuelto?.includes("@hosted.lid");
  const numeroReal = resolvedIsLid
    ? ""
    : jidResuelto.split("@")[0].split(":")[0];
  const jidRemitente = resolvedIsLid
    ? jidResuelto
    : `${numeroReal}@s.whatsapp.net`;
  const globalDb = getDBSync();
  const owners = globalDb.owners || [];
  const botId = sock.user?.id || sock.user?.jid;
  const sender = m.key.fromMe ? botId : jidRemitente;

  const normalizeOwnerValue = (value) => {
    if (!value && value !== 0) return "";
    const str = String(value).trim().toLowerCase();
    if (!str) return "";

    const noPlus = str.replace(/^\+/, "");
    const noAt = noPlus.split("@")[0].split(":")[0];
    const digitsOnly = noAt.replace(/\D+/g, "");
    const variants = new Set([str, noPlus, noAt, digitsOnly]);
    return [...variants].filter(Boolean);
  };

  const ownerIdentities = new Set();
  for (const owner of owners) {
    const variants = normalizeOwnerValue(owner);
    for (const variant of variants) {
      ownerIdentities.add(variant);
    }

    if (String(owner).endsWith("@lid")) {
      try {
        const resolvedOwner = await resolveLidToRealJid(owner, sock, remoteJid);
        const resolvedOwnerVariants = normalizeOwnerValue(resolvedOwner);
        for (const variant of resolvedOwnerVariants) {
          ownerIdentities.add(variant);
        }
      } catch {}
    }
  }

  const senderIdentities = new Set();
  for (const value of [sender, senderRaw, jidRemitente]) {
    for (const variant of normalizeOwnerValue(value)) {
      senderIdentities.add(variant);
    }
  }
  const isOwner =
    Boolean(m.key.fromMe) ||
    [...senderIdentities].some((identity) => ownerIdentities.has(identity));

  if (!isOwner) {
    if (userCooldowns.has(sender)) return;
    userCooldowns.set(sender, true);
  }

  const groupSelfValue = isGroup ? db.groups?.[remoteJid]?.selfMode : undefined;
  const hasExplicitGroupSelf =
    isGroup &&
    !!db.groups?.[remoteJid] &&
    Object.prototype.hasOwnProperty.call(db.groups[remoteJid], "selfMode");
  const groupSelfMode = isGroup && groupSelfValue === true;
  const modSelfMode = !!db.modSelfMode;

  const shouldBlockBySelfMode =
    isGroup &&
    !isOwner &&
    (groupSelfMode ||
      (modSelfMode && (!hasExplicitGroupSelf || groupSelfValue !== false)));

  if (shouldBlockBySelfMode) return;

  const isChatBanned = db.chats?.[remoteJid]?.isBanned;
  const isUnbanCmd =
    commandNameForCheck === "unbanchat" ||
    commandNameForCheck === "desbanearchat";

  if (isChatBanned && !isUnbanCmd) {
    return;
  }

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
      sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});
      return await sock.sendMessage(
        remoteJid,
        {
          text: `⚠️ El bot está desactivado. Usa *${prefix}bot on* para activarlo.`,
        },
        { quoted: m },
      );
    } else {
      sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});
      return;
    }
  }

  if (isGroup && !m.key.fromMe) {
    trackGroupActivity(db, remoteJid, jidRemitente);
  }

  const rangoLog = isOwner ? "OWNER 👑" : "USUARIO 👤";

  let isAdmin = false;
  let isBotAdmin = false;
  let groupMetadata = null;

  if (isGroup && esComando) {
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

  if (
    isGroup &&
    db.groups?.[remoteJid]?.onlyAdmin &&
    esComando &&
    !isAdmin &&
    !isOwner
  ) {
    sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});
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
  } catch (e) {}

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
    sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});
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
          sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});
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
          sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});
          return await sock.sendMessage(
            remoteJid,
            { text: Rstr.onlyGroup },
            { quoted: m },
          );
        }
        if (isGroup && !isCategoryEnabled(remoteJid, cmd.category, db)) {
          sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});
          return await sock.sendMessage(
            remoteJid,
            { text: catOff({ CAT_CMD: cmd.category, prefix }) },
            { quoted: m },
          );
        }
        if (cmd.adminOnly && !isAdmin && !isOwner) {
          sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});
          return await sock.sendMessage(
            remoteJid,
            { text: Rstr.onlyAdmin },
            { quoted: m },
          );
        }

        const normalizedCommand = commandName.toLowerCase();
        const groupRestrictedCommands = new Set(
          (isGroup ? db.groups?.[remoteJid]?.restrictedCommands || [] : []).map(
            (item) => String(item).toLowerCase(),
          ),
        );
        const globalRestrictedCommands = new Set(
          (db.restrictedCommands || []).map((item) =>
            String(item).toLowerCase(),
          ),
        );

        if (
          !isOwner &&
          (groupRestrictedCommands.has(normalizedCommand) ||
            globalRestrictedCommands.has(normalizedCommand))
        ) {
          sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});
          return await sock.sendMessage(
            remoteJid,
            {
              text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ 🚫 ${fytBold("COMANDO RESTRINGIDO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > El comando *${prefix}${normalizedCommand}* está bloqueado.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
            },
            { quoted: m },
          );
        }

        sock.sendPresenceUpdate("composing", remoteJid).catch(() => {});

        try {
          await runWithGachaDatabase(sock, () =>
            cmd.execute(sock, m, args, {
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
            }),
          );
        } catch (err) {
          console.error(
            `[msgHandler] Error ejecutando comando ${commandName}:`,
            err,
          );
          await sock.sendMessage(
            remoteJid,
            {
              text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR EN COMANDO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Ocurrió un error al ejecutar el comando *${prefix}${commandName}*.\n> *Detalle del error:*\n> ${err.message || err}`,
            },
            { quoted: m },
          );
        } finally {
          sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});
        }
        return;
      }
      }

    if (!commandFound) {
      sock.sendPresenceUpdate("paused", remoteJid).catch(() => {});
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("COMANDO NO EXISTE")}\n╰━━━━━━━━━━━━⬣\n┃ > El comando \`${commandName}\` no existe\n┃ > o esta mal escrito.\n┃ > Ejecuta \`${prefix}menu\` para ver\n┃ > los comandos disponibles.`,
        },
        { quoted: m },
      );
    }
  }
}
