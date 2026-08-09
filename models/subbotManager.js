import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion,
} from "@whiskeysockets/baileys";
import pino from "pino";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import QRCode from "qrcode";
import { Boom } from "@hapi/boom";
import { handleMessage } from "../controllers/msgHandler.js";
import { handleGroupUpdate } from "../controllers/groupEvents.js";
import { stripEconomyFromUsers } from "./groupDb.js";
import { getDBSync } from "./db.js";
import {
  getSubBotDB,
  saveSubBotDB,
  wrapGroupMetadataCache,
  groupMetadataCache,
} from "./subbotWorker.js";

export const SUB_LIMIT_MESSAGE =
  "✐ No se han encontrado espacios disponibles para registrar un `Sub-Bot`.";

export function getMaxSubBots() {
  try {
    const db = getDBSync();
    const max = Number(db.maxSubBots);
    return Number.isFinite(max) && max >= 0 ? max : 15;
  } catch {
    return 15;
  }
}

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const sessionsDir = path.join(ROOT_DIR, "sessions", "subbots");
const databaseDir = path.join(ROOT_DIR, "database");
const subbotsJsonPath = path.join(databaseDir, "subbots.json");

if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

const activeSubBots = new Map();

export function listActiveSubBotSessions() {
  if (!fs.existsSync(sessionsDir)) return [];
  return fs
    .readdirSync(sessionsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) =>
      fs.existsSync(path.join(sessionsDir, name, "creds.json")),
    );
}

export function countActiveSubBots() {
  return listActiveSubBotSessions().length;
}

export function getSubBotSlotStatus(senderId) {
  const max = getMaxSubBots();
  const id = resolveSubBotSenderId(null, senderId); 
  const active = listActiveSubBotSessions();
  const count = active.length;
  const hasOwn = id ? active.includes(id) : false;
  const available = Math.max(0, max - count);
  return { id, count, max, available, hasOwn };
}

export function resolveSubBotSenderId(phoneNumber, jidRemitente) {
  if (phoneNumber) return String(phoneNumber).replace(/\D/g, "");
  if (jidRemitente) return jidRemitente.split("@")[0].split(":")[0];
  return null;
}

export function canRegisterSubBot(senderId) {
  const { id, count, max, available, hasOwn } = getSubBotSlotStatus(senderId);
  if (!id) return false;
  if (max <= 0) return false;
  if (available > 0) return true;
  if (hasOwn) return true;
  return false;
}

export function syncSubBotsJson(mainBotNumber = null) {
  try {
    if (!fs.existsSync(databaseDir)) {
      fs.mkdirSync(databaseDir, { recursive: true });
    }

    let currentData = { mainBot: null, subbots: [] };
    if (fs.existsSync(subbotsJsonPath)) {
      try {
        currentData = JSON.parse(fs.readFileSync(subbotsJsonPath, "utf-8")) || currentData;
      } catch {}
    }

    const activeSessions = listActiveSubBotSessions();

    // 🛠️ Limpia adecuadamente quitando el puerto/dispositivo (:12) antes de extraer dígitos
    const cleanNum = (jid) => (jid ? String(jid).split("@")[0].split(":")[0].replace(/\D/g, "") : null);

    const mainNum = mainBotNumber ? cleanNum(mainBotNumber) : currentData.mainBot;

    const updatedData = {
      mainBot: mainNum,
      subbots: activeSessions.map(cleanNum).filter(Boolean),
    };

    fs.writeFileSync(subbotsJsonPath, JSON.stringify(updatedData, null, 2));
  } catch (error) {
    console.error("[SUB-BOT] Error al sincronizar subbots.json:", error);
  }
}



export async function stopSubBot(senderId) {
  const sessionPath = path.join(sessionsDir, senderId);
  let handled = false;
  if (activeSubBots.has(senderId)) {
    try {
      const subSock = activeSubBots.get(senderId);
      subSock.isClosedManually = true;
      if (subSock.ws?.isOpen) {
        await subSock.logout().catch(() => {});
      }
      subSock.ev.removeAllListeners();
      if (subSock.ws) subSock.ws.close();
      handled = true;
    } catch (e) {
      console.error(`Error cerrando socket de sub-bot ${senderId}:`, e.message);
    }
    activeSubBots.delete(senderId);
  }

  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
    handled = true;
  }
  
  syncSubBotsJson();
  return handled;
}

export async function loadAllSubBots() {
  const sessions = listActiveSubBotSessions();
  if (sessions.length === 0) return;
  
  console.log(chalk.cyan(`[SUB-BOT] Encontradas ${sessions.length} sesiones activas. Restaurando autónomamente...`));
  
  for (const senderId of sessions) {
    try {
      await createSubBot(null, null, "autoload", null, senderId);
      await new Promise((resolve) => setTimeout(resolve, 3000));
    } catch (e) {
      console.error(`[SUB-BOT] Error levantando la sesión automática ${senderId}:`, e.message);
    }
  }
}

export async function createSubBot(sock = null, m = null, type = "qr", phoneNumber = null, autoSenderId = null) {
  const isAutoload = type === "autoload";
  const remoteJid = isAutoload ? null : m?.key?.remoteJid;
  const sender = isAutoload ? null : (m?.key?.participant || m?.key?.remoteJid);
  
  const senderId = autoSenderId || 
                   resolveSubBotSenderId(phoneNumber, null) || 
                   sender?.split("@")[0]?.split(":")[0];
                   
  if (!senderId) return;

  const sessionPath = path.join(sessionsDir, senderId);

  if (!isAutoload && !canRegisterSubBot(senderId)) {
    if (sock && remoteJid && m) {
      await sock.sendMessage(remoteJid, { text: SUB_LIMIT_MESSAGE }, { quoted: m });
    }
    return;
  }

  if (!isAutoload && fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }

  let isConnected = false;
  let codeRequested = false;
  let timeout;

  if (!isAutoload) {
    timeout = setTimeout(async () => {
      if (!isConnected) {
        if (activeSubBots.has(senderId)) {
          const s = activeSubBots.get(senderId);
          s.isClosedManually = true;
          try { s.ws?.close(); } catch {}
          activeSubBots.delete(senderId);
        }
        if (sock && remoteJid && m) {
          await sock.sendMessage(remoteJid, { text: "⏳ El tiempo de vinculación ha expirado (60 segundos). Inténtalo de nuevo." }, { quoted: m });
        }
        if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
        syncSubBotsJson();
      }
    }, 60000);
  }

  async function start() {
    let version;
    try {
      const fetched = await Promise.race([
        fetchLatestWaWebVersion(),
        new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000)),
      ]);
      version = fetched.version;
    } catch (err) {
      console.log(chalk.yellow(`[SUB-BOT] No se pudo obtener la última versión de WhatsApp Web para sub-bot ${senderId}. Se usará la interna.`));
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
    const subSock = makeWASocket({
      ...(version ? { version } : {}),
      auth: {
        creds: state.creds,
        keys: state.keys,
      },
      cachedGroupMetadata: async (jid) => {
        const meta = groupMetadataCache.get(jid);
        return meta;
      },
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 15000,
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    subSock.isSubBot = true;
    subSock.subBotId = senderId;
    subSock.isClosedManually = false;
    
    wrapGroupMetadataCache(subSock);
    activeSubBots.set(senderId, subSock);

    subSock.ev.on("creds.update", saveCreds);

    subSock.ev.on("messages.upsert", async ({ messages, type: msgType }) => {
      if (msgType !== "notify") return;
      const msg = messages[0];
      const db = await getSubBotDB(senderId);
      await handleMessage(subSock, msg, db, (data, options) =>
        saveSubBotDB(senderId, data, options),
      );
    });

    subSock.ev.on("group-participants.update", async (update) => {
      await handleGroupUpdate(subSock, update, () => getSubBotDB(senderId));
    });

    subSock.ev.on("connection.update", async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr && type === "qr" && !isConnected && !isAutoload && sock && remoteJid && m) {
        const qrBuffer = await QRCode.toBuffer(qr);
        await sock.sendMessage(remoteJid, { image: qrBuffer, caption: "〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕⬣" }, { quoted: m });
      }

      if (connection === "close") {
        const error = lastDisconnect?.error;
        const reason = error?.output?.statusCode || error?.statusCode || new Boom(error)?.output?.statusCode;
        
        console.log(`[SUB-BOT] Conexión cerrada para ${senderId}. Código: ${reason || "N/A"}.`);

        const shouldResetSession = [
          DisconnectReason.loggedOut,
          DisconnectReason.badSession,
          DisconnectReason.forbidden,
          DisconnectReason.multideviceMismatch,
        ].includes(reason);

        if (shouldResetSession) {
          console.log(`[SUB-BOT] Desvinculación detectada. Limpiando datos de sesión.`);
          try { subSock.ev.removeAllListeners(); } catch {}
          if (fs.existsSync(sessionPath)) {
            try { fs.rmSync(sessionPath, { recursive: true, force: true }); } catch (e) {}
          }
          activeSubBots.delete(senderId);
          syncSubBotsJson();
          if (timeout) clearTimeout(timeout);
        } else if (!subSock.isClosedManually) {
          console.log(`[SUB-BOT] Reconectando sesión caída de ${senderId} de forma autónoma en 7 segundos...`);
          try { subSock.ev.removeAllListeners(); } catch {}
          setTimeout(start, 7000);
        }
      } else if (connection === "open") {
        const wasConnected = isConnected;
        isConnected = true;
        if (timeout) clearTimeout(timeout);
        
        console.log(chalk.green(`✅ Sub-Bot (${senderId}) restablecido y corriendo de forma independiente.`));
        syncSubBotsJson();
        
        if (!wasConnected && !isAutoload && sock && remoteJid && m) {
          await sock.sendMessage(remoteJid, {
            text: "╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n\n┃ 🤖 ¡𝐒𝐮𝐛-𝐛𝐨𝐭 𝐯𝐢𝐧𝐜𝐮𝐥𝐚𝐝𝐨 𝐜𝐨𝐧 𝐞́𝐱𝐢𝐭𝐨!\n┃ ⚡ Ahora el bot está activo en tu cuenta\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
          }, { quoted: m });
        }
      }
    });

    const isRegistered = state.creds && (state.creds.registered || state.creds.me);
    if (type === "code" && phoneNumber && !isRegistered && !codeRequested && !isAutoload) {
      codeRequested = true;
      (async () => {
        try {
          console.log(`[SUB-BOT] Esperando canal seguro para generar código de ${senderId}...`);
          await subSock.waitForSocketOpen();
          await new Promise((resolve) => setTimeout(resolve, 4000));
          
          let code = await subSock.requestPairingCode(phoneNumber);
          code = code?.match(/.{1,4}/g)?.join("-") || code;
          
          if (sock && remoteJid && m) {
            await sock.sendMessage(remoteJid, { text: `*${code.toUpperCase()}*` }, { quoted: m });
          }
          console.log(`[SUB-BOT] Código delivered con éxito para ${senderId}`);
        } catch (err) {
          console.error("Error solicitando código en sub-bot:", err);
        }
      })();
    }
  }

  start();
}
