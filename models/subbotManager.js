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

/** Lee el límite en cada llamada. */
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

if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

// Mapa para rastrear sockets activos de sub-bots
const activeSubBots = new Map();

/** Lista carpetas de sesión con creds.json válido. */
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
  const id = resolveSubBotSenderId(senderId, null);
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

/**
 * true = puede vincular.
 * - Hay cupo libre (count < max): usuario nuevo.
 * - Cupo lleno: solo quien ya tiene sub-bot (re-vinculación).
 */
export function canRegisterSubBot(senderId) {
  const { id, count, max, available, hasOwn } = getSubBotSlotStatus(senderId);
  if (!id) return false;
  if (max <= 0) return false;
  if (available > 0) return true;
  if (hasOwn) return true;
  return false;
}

export async function stopSubBot(senderId) {
  const sessionPath = path.join(sessionsDir, senderId);
  let handled = false;
  if (activeSubBots.has(senderId)) {
    try {
      const subSock = activeSubBots.get(senderId);
      // Intentar cerrar de forma segura
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
  return handled;
}

export async function createSubBot(sock, m, type, phoneNumber = null) {
  const remoteJid = m.key.remoteJid;
  const sender = m.key.participant || m.key.remoteJid;
  const senderId =
    resolveSubBotSenderId(phoneNumber, null) ||
    sender.split("@")[0].split(":")[0];
  const sessionPath = path.join(sessionsDir, senderId);

  if (!canRegisterSubBot(senderId)) {
    await sock.sendMessage(
      remoteJid,
      { text: SUB_LIMIT_MESSAGE },
      { quoted: m },
    );
    return;
  }

  if (fs.existsSync(sessionPath)) {
    fs.rmSync(sessionPath, { recursive: true, force: true });
  }

  let isConnected = false;
  let isClosedManually = false;
  let codeRequested = false;

  const timeout = setTimeout(async () => {
    if (!isConnected) {
      isClosedManually = true;
      await sock.sendMessage(
        remoteJid,
        {
          text: "⏳ El tiempo de vinculación ha expirado (60 segundos). Inténtalo de nuevo.",
        },
        { quoted: m },
      );
      if (fs.existsSync(sessionPath))
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }
  }, 60000);

  async function start() {
    let version;
    try {
      const fetched = await Promise.race([
        fetchLatestWaWebVersion(),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Timeout")), 5000),
        ),
      ]);
      version = fetched.version;
    } catch (err) {
      console.log(
        chalk.yellow(
          `[SUB-BOT] No se pudo obtener la última versión de WhatsApp Web para sub-bot ${senderId}. Se usará la versión interna de Baileys.`,
        ),
      );
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
        console.log(
          chalk.gray(
            `[Aura Reed] Metadata cache check for ${jid}: ${meta ? "HIT" : "MISS"}`,
          ),
        );
        return fetch;
      },
      logger: pino({ level: "silent" }),
      printQRInTerminal: false,
      browser: ["Ubuntu", "Chrome", "20.0.04"],
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 0,
      keepAliveIntervalMs: 10000,
      syncFullHistory: false,
      markOnlineOnConnect: true,
    });

    // Registrar en el mapa y configurar banderas/caché
    subSock.isSubBot = true;
    subSock.subBotId = senderId;
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

      if (qr && type === "qr" && !isConnected) {
        const qrBuffer = await QRCode.toBuffer(qr);
        await sock.sendMessage(
          remoteJid,
          { image: qrBuffer, caption: "〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕⬣" },
          { quoted: m },
        );
      }

      if (connection === "close") {
        // Remove all event listeners of the old socket to prevent memory leaks,
        // duplicate reconnection triggers, and crashes if saveCreds is called after folder removal
        try {
          subSock.ev.removeAllListeners();
        } catch (e) {
          console.error("[SUB-BOT] Error al remover oyentes del socket:", e);
        }

        const error = lastDisconnect?.error;
        const reason =
          error?.output?.statusCode ||
          error?.statusCode ||
          new Boom(error)?.output?.statusCode;
        const errorMessage = error?.message || "Error desconocido";
        console.log(
          `[SUB-BOT] Conexión cerrada. Razón/Código: ${reason || "N/A"}. Error: ${errorMessage}`,
        );

        const shouldResetSession = [
          DisconnectReason.loggedOut, // 401
          DisconnectReason.badSession, // 500
          DisconnectReason.forbidden, // 403
          DisconnectReason.multideviceMismatch, // 411
        ].includes(reason);

        if (shouldResetSession) {
          console.log(
            `[SUB-BOT] Sesión inválida/desvinculada para sub-bot ${senderId}. Limpiando credenciales.`,
          );
          if (fs.existsSync(sessionPath)) {
            try {
              fs.rmSync(sessionPath, { recursive: true, force: true });
            } catch (e) {
              console.error(`[SUB-BOT] Error al limpiar credenciales:`, e);
            }
          }
          clearTimeout(timeout);
        } else if (!isClosedManually) {
          console.log(
            `[SUB-BOT] Reintentando conexión para sub-bot ${senderId} en 5 segundos...`,
          );
          setTimeout(start, 5000);
        }
      } else if (connection === "open") {
        const wasConnected = isConnected;
        isConnected = true;
        clearTimeout(timeout);
        console.log(chalk.gray(`✅ Sub-Bot (${senderId}) en línea y validado`));
        if (!wasConnected) {
          await sock.sendMessage(
            remoteJid,
            {
              text: "╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n\n┃ 🤖 ¡𝐒𝐮𝐛-𝐛𝐨𝐭 𝐯𝐢𝐧𝐜𝐮𝐥𝐚𝐝𝐨 𝐜𝐨𝐧 𝐞́𝐱𝐢𝐭𝐨!\n┃ ⚡ Ahora el bot está activo en tu cuenta\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
            },
            { quoted: m },
          );
        }
      }
    });

    const isRegistered =
      state.creds && (state.creds.registered || state.creds.me);
    if (type === "code" && phoneNumber && !isRegistered && !codeRequested) {
      codeRequested = true;
      (async () => {
        try {
          await subSock.waitForSocketOpen();
          // Esperar 3 segundos para asegurar que el apretón de manos (handshake) se complete
          await new Promise((resolve) => setTimeout(resolve, 3000));
          let code = await subSock.requestPairingCode(phoneNumber);
          code = code?.match(/.{1,4}/g)?.join("-") || code;
          await sock.sendMessage(
            remoteJid,
            { text: `${code.toUpperCase()}` },
            { quoted: m },
          );
        } catch (err) {
          console.error("Error solicitando código:", err);
        }
      })();
    }
  }

  start();
}