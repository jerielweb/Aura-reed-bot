import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";

import pino from "pino";
import fs from "fs";
import path from "path";
import {
  fileURLToPath,
} from "url";

import chalk from "chalk";
import QRCode from "qrcode";

import { Boom } from "@hapi/boom";

import {
  handleMessage,
} from "../controllers/msgHandler.js";

import {
  handleGroupUpdate,
} from "../controllers/groupEvents.js";

import {
  stripEconomyFromUsers,
} from "./groupDb.js";

import {
  getDBSync,
} from "./db.js";

import {
  getSubBotDB,
  saveSubBotDB,
  closeSubBotDB,
  wrapGroupMetadataCache,
  groupMetadataCache,
} from "./subbotWorker.js";

// ============================================================
// SOCKET PRINCIPAL
// ============================================================

export function setMainSocket(
  sock,
) {
  global.mainSocket =
    sock;
}

export function getMainSocket() {
  return (
    global.mainSocket ||
    null
  );
}

// ============================================================
// LÍMITE
// ============================================================

export const SUB_LIMIT_MESSAGE =
  "✐ No se han encontrado espacios disponibles para registrar un `Sub-Bot`.";

export function getMaxSubBots() {
  try {
    const db =
      getDBSync();

    const max =
      Number(
        db.maxSubBots,
      );

    return Number.isFinite(
      max,
    ) && max >= 0
      ? max
      : 30;
  } catch {
    return 15;
  }
}

// ============================================================
// RUTAS
// ============================================================

const ROOT_DIR =
  path.join(
    path.dirname(
      fileURLToPath(
        import.meta.url,
      ),
    ),
    "..",
  );

const sessionsDir =
  path.join(
    ROOT_DIR,
    "sessions",
    "subbots",
  );

const databaseDir =
  path.join(
    ROOT_DIR,
    "database",
  );

const subbotsJsonPath =
  path.join(
    databaseDir,
    "subbots.json",
  );

if (
  !fs.existsSync(
    sessionsDir,
  )
) {
  fs.mkdirSync(
    sessionsDir,
    {
      recursive: true,
    },
  );
}

// ============================================================
// SOCKETS ACTIVOS
// ============================================================

const activeSubBots =
  new Map();

// ============================================================
// SESIONES
// ============================================================

export function listActiveSubBotSessions() {
  if (
    !fs.existsSync(
      sessionsDir,
    )
  ) {
    return [];
  }

  return fs
    .readdirSync(
      sessionsDir,
      {
        withFileTypes: true,
      },
    )
    .filter(
      (entry) =>
        entry.isDirectory(),
    )
    .map(
      (entry) =>
        entry.name,
    )
    .filter(
      (name) =>
        fs.existsSync(
          path.join(
            sessionsDir,
            name,
            "session.db",
          ),
        ),
    );
}

export function countActiveSubBots() {
  return listActiveSubBotSessions()
    .length;
}

// ============================================================
// RESOLVER ID
// ============================================================

// Algunos países insertan un dígito extra en el JID real de WhatsApp
// que la gente normalmente NO escribe al marcar el número. El caso
// más común es Argentina: código de país 54 + 10 dígitos al marcar,
// pero el JID de WhatsApp exige un "9" extra después del 54
// (549XXXXXXXXXX). Si no lo agregamos aquí, el ID que guardamos
// (carpeta de sesión / subbots.json) nunca calza con el JID real
// una vez conectado, y por eso el número "cambia de formato".
function applyCountryMobilePrefix(
  digits,
) {
  if (!digits) return digits;

  // Argentina: 54 + 10 dígitos (12 en total) sin el "9" de celular.
  if (
    digits.startsWith("54") &&
    digits.length === 12
  ) {
    return `549${digits.slice(2)}`;
  }

  return digits;
}

export function resolveSubBotSenderId(
  phoneNumber,
  jidRemitente,
) {
  if (phoneNumber) {
    const digits = String(
      phoneNumber,
    ).replace(
      /\D/g,
      "",
    );

    return applyCountryMobilePrefix(
      digits,
    );
  }

  if (jidRemitente) {
    // Mismo criterio que el resto del código (cleanNum/normalizeNumber):
    // dejar únicamente dígitos, para que el ID guardado siempre tenga
    // el mismo formato sin importar de dónde venga (QR, code, etc).
    const digits = String(jidRemitente)
      .split("@")[0]
      .split(":")[0]
      .replace(/\D/g, "");

    return applyCountryMobilePrefix(
      digits,
    );
  }

  return null;
}

// ============================================================
// ESTADO DEL SLOT
// ============================================================

export function getSubBotSlotStatus(
  senderId,
) {
  const max =
    getMaxSubBots();

  const id =
    resolveSubBotSenderId(
      null,
      senderId,
    );

  const active =
    listActiveSubBotSessions();

  const count =
    active.length;

  const hasOwn =
    id
      ? active.includes(id)
      : false;

  const available =
    Math.max(
      0,
      max - count,
    );

  return {
    id,
    count,
    max,
    available,
    hasOwn,
  };
}

// ============================================================
// PERMITIR REGISTRO
// ============================================================

export function canRegisterSubBot(
  senderId,
) {
  const {
    id,
    max,
    available,
    hasOwn,
  } =
    getSubBotSlotStatus(
      senderId,
    );

  if (!id) {
    return false;
  }

  if (max <= 0) {
    return false;
  }

  if (available > 0) {
    return true;
  }

  if (hasOwn) {
    return true;
  }

  return false;
}

// ============================================================
// SINCRONIZAR JSON
// ============================================================

export function syncSubBotsJson(
  mainBotNumber = null,
) {
  try {
    if (!fs.existsSync(databaseDir)) {
      fs.mkdirSync(databaseDir, { recursive: true });
    }

    let currentData = {
      mainBot: null,
      subbots: {},
    };

    if (fs.existsSync(subbotsJsonPath)) {
      try {
        const parsed = JSON.parse(
          fs.readFileSync(subbotsJsonPath, "utf-8"),
        );
        if (parsed && typeof parsed === "object") {
          currentData = parsed;
        }
      } catch {}
    }

    const registry = {};
    const previous = currentData.subbots;

    // Compatibilidad con el formato viejo: subbots: ["506..."]
    if (Array.isArray(previous)) {
      for (const value of previous) {
        const id = String(value || "").replace(/\D/g, "");
        if (id) registry[id] = { active: false };
      }
    } else if (previous && typeof previous === "object") {
      for (const [key, value] of Object.entries(previous)) {
        const id = String(key).replace(/\D/g, "");
        if (!id) continue;
        registry[id] = {
          ...(value && typeof value === "object" ? value : {}),
          active: Boolean(value?.active),
        };
      }
    }

    // Las sesiones existentes siguen registradas aunque estén apagadas.
    for (const session of listActiveSubBotSessions()) {
      const id = String(session).replace(/\D/g, "");
      if (!id) continue;
      if (!registry[id]) registry[id] = { active: false };
    }

    // El estado real siempre sale del Map de sockets.
    for (const id of Object.keys(registry)) {
      registry[id].active = activeSubBots.has(id);
    }
    for (const id of activeSubBots.keys()) {
      const cleanId = String(id).replace(/\D/g, "");
      if (!cleanId) continue;
      if (!registry[cleanId]) registry[cleanId] = { active: true };
      else registry[cleanId].active = true;
    }

    const cleanNum = (jid) =>
      jid
        ? String(jid)
            .split("@")[0]
            .split(":")[0]
            .replace(/\D/g, "")
        : null;

    const mainNum = mainBotNumber
      ? cleanNum(mainBotNumber)
      : currentData.mainBot || null;

    fs.writeFileSync(
      subbotsJsonPath,
      JSON.stringify(
        {
          mainBot: mainNum,
          subbots: registry,
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      "[SUB-BOT] Error al sincronizar subbots.json:",
      error,
    );
  }
}

// ============================================================
// REGISTRO / ESTADO / GRUPOS
// ============================================================

export function isSubBotActive(senderId) {
  const id = resolveSubBotSenderId(null, senderId);
  return Boolean(id && activeSubBots.has(id));
}

export function getRegisteredSubBots() {
  try {
    if (!fs.existsSync(subbotsJsonPath)) return [];

    const data = JSON.parse(
      fs.readFileSync(subbotsJsonPath, "utf-8"),
    );

    const subbotsObj = data?.subbots || {};
    const results = [];

    // Si es un objeto, recorremos sus claves y valores
    const keys = Array.isArray(subbotsObj) ? subbotsObj : Object.keys(subbotsObj);

    for (const key of keys) {
      const cleanId = String(key).replace(/\D/g, "");
      
      // Ignoramos si no es un número de teléfono válido (muy corto)
      if (!cleanId || cleanId.length < 5) continue;

      // El estado activo real lo manda el Map de sockets activos o el JSON
      const isActive = activeSubBots.has(cleanId) || Boolean(subbotsObj[key]?.active);

      results.push({
        id: cleanId,
        active: isActive,
      });
    }

    return results;
  } catch {
    return [];
  }
}


export async function getSubBotsInGroup(groupJid) {
  const result = [];

  if (!groupJid || !String(groupJid).endsWith("@g.us")) {
    return result;
  }

  for (const [id] of activeSubBots) {
    const cleanId = String(id).replace(/\D/g, "");
    if (cleanId) {
      result.push({
        id: cleanId,
        active: true,
      });
    }
  }

  return result;
}


// ============================================================
// DESTRUIR SOCKET
// ============================================================

async function destroySubBotSocket(
  senderId,
  subSock,
) {
  if (!subSock) {
    return;
  }

  subSock.isClosedManually =
    true;

  try {
    subSock.ev.removeAllListeners();
  } catch {}

  try {
    subSock.ws?.close();
  } catch {}

  try {
    activeSubBots.delete(
      senderId,
    );
  } catch {}

  // Persistir inmediatamente que el Sub-Bot quedó inactivo.
  try {
    syncSubBotsJson();
  } catch {}

  // Muy importante:
  // libera DB y cache del sub-bot.
  try {
    closeSubBotDB(
      senderId,
    );
  } catch {}
}

// ============================================================
// DETENER SUB-BOT
// ============================================================

export async function stopSubBot(
  senderId,
) {
  const sessionPath =
    path.join(
      sessionsDir,
      senderId,
    );

  let handled =
    false;

  if (
    activeSubBots.has(
      senderId,
    )
  ) {
    try {
      const subSock =
        activeSubBots.get(
          senderId,
        );

      try {
        subSock.isClosedManually =
          true;

        await subSock
          .logout()
          .catch(
            () => {},
          );
      } catch {}

      await destroySubBotSocket(
        senderId,
        subSock,
      );

      handled =
        true;
    } catch (e) {
      console.error(
        `Error cerrando socket de sub-bot ${senderId}:`,
        e.message,
      );
    }
  } else {
    try {
      closeSubBotDB(
        senderId,
      );
    } catch {}
  }

  if (
    fs.existsSync(
      sessionPath,
    )
  ) {
    fs.rmSync(
      sessionPath,
      {
        recursive: true,
        force: true,
      },
    );

    handled =
      true;
  }

  syncSubBotsJson();

  return handled;
}

// ============================================================
// CARGAR TODOS LOS SUB-BOTS
// ============================================================

export async function loadAllSubBots() {
  const sessions =
    listActiveSubBotSessions();

  if (
    sessions.length === 0
  ) {
    return;
  }

  console.log(
    chalk.cyan(
      `[SUB-BOT] Encontradas ${sessions.length} sesiones activas. Restaurando autónomamente...`,
    ),
  );

  for (
    const senderId of
      sessions
  ) {
    try {
      await createSubBot(
        null,
        null,
        "autoload",
        null,
        senderId,
      );

      // Evita levantar todos los sockets
      // simultáneamente.
      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            3000,
          ),
      );
    } catch (e) {
      console.error(
        `[SUB-BOT] Error levantando la sesión automática ${senderId}:`,
        e.message,
      );
    }
  }
}

// ============================================================
// CREAR SUB-BOT
// ============================================================

export async function createSubBot(
  sock = null,
  m = null,
  type = "qr",
  phoneNumber = null,
  autoSenderId = null,
) {
  const isAutoload =
    type === "autoload";

  const remoteJid =
    isAutoload
      ? null
      : m?.key?.remoteJid;

  const sender =
    isAutoload
      ? null
      : m?.key?.participantPn ||
        m?.key?.participantAlt ||
        m?.key?.participant ||
        m?.key?.remoteJidAlt ||
        m?.key?.remoteJid;

  const senderId =
    autoSenderId ||
    resolveSubBotSenderId(
      phoneNumber,
      null,
    ) ||
    resolveSubBotSenderId(
      null,
      sender,
    );

  if (!senderId) {
    return;
  }

  const sessionPath =
    path.join(
      sessionsDir,
      senderId,
    );

  // ==========================================================
  // COMPROBAR LÍMITE
  // ==========================================================

  if (
    !isAutoload &&
    !canRegisterSubBot(
      senderId,
    )
  ) {
    if (
      sock &&
      remoteJid &&
      m
    ) {
      await sock.sendMessage(
        remoteJid,
        {
          text:
            SUB_LIMIT_MESSAGE,
        },
        {
          quoted: m,
        },
      );
    }

    return;
  }

  // ==========================================================
  // LIMPIAR SESIÓN ANTERIOR
  // ==========================================================
    if (
    !isAutoload &&
    fs.existsSync(
      sessionPath,
    )
  ) {
    fs.rmSync(
      sessionPath,
      {
        recursive: true,
        force: true,
      },
    );
  }

  let isConnected =
    false;

  let codeRequested =
    false;

  let timeout;

  // ==========================================================
  // TIMEOUT DE VINCULACIÓN
  // ==========================================================

  if (!isAutoload) {
    timeout =
      setTimeout(
        async () => {
          if (isConnected) {
            return;
          }

          const oldSock =
            activeSubBots.get(
              senderId,
            );

          if (oldSock) {
            await destroySubBotSocket(
              senderId,
              oldSock,
            );
          } else {
            try {
              closeSubBotDB(
                senderId,
              );
            } catch {}
          }

          if (
            sock &&
            remoteJid &&
            m
          ) {
            await sock.sendMessage(
              remoteJid,
              {
                text:
                  "⏳ El tiempo de vinculación ha expirado (60 segundos). Inténtalo de nuevo.",
              },
              {
                quoted: m,
              },
            );
          }

          if (
            fs.existsSync(
              sessionPath,
            )
          ) {
            fs.rmSync(
              sessionPath,
              {
                recursive: true,
                force: true,
              },
            );
          }

          syncSubBotsJson();
        },
        60000,
      );
  }

  // ==========================================================
  // START
  // ==========================================================

  async function start() {
    let version;

    try {
      const fetched =
        await Promise.race([
          fetchLatestWaWebVersion(),

          new Promise(
            (_, reject) =>
              setTimeout(
                () =>
                  reject(
                    new Error(
                      "Timeout",
                    ),
                  ),
                5000,
              ),
          ),
        ]);

      version =
        fetched.version;
    } catch {
      console.log(
        chalk.yellow(
          `[SUB-BOT] No se pudo obtener la última versión de WhatsApp Web para sub-bot ${senderId}. Se usará la interna.`,
        ),
      );
    }

    const {
      state,
      saveCreds,
    } =
      await useMultiFileAuthState(
        sessionPath,
      );

    // ========================================================
    // SOCKET
    // ========================================================

    const subSock =
      makeWASocket({
        ...(version
          ? { version }
          : {}),

        auth: {
          creds:
            state.creds,

          keys:
            makeCacheableSignalKeyStore(
              state.keys,
              pino({
                level: "silent",
              }),
            ),
        },

        cachedGroupMetadata:
          async (jid) =>
            groupMetadataCache.get(
              jid,
            ),

        logger:
          pino({
            level:
              "silent",
          }),

        printQRInTerminal:
          false,

        browser: [
          "Ubuntu",
          "Chrome",
          "20.0.04",
        ],

        connectTimeoutMs:
          60000,

        defaultQueryTimeoutMs:
          0,

        keepAliveIntervalMs:
          15000,

        syncFullHistory:
          false,

        markOnlineOnConnect:
          true,
      });

    subSock.isSubBot =
      true;

    subSock.subBotId =
      senderId;

    subSock.isClosedManually =
      false;

    wrapGroupMetadataCache(
      subSock,
    );

    activeSubBots.set(
      senderId,
      subSock,
    );

    // ========================================================
    // CREDENCIALES
    // ========================================================

    subSock.ev.on(
      "creds.update",
      saveCreds,
    );

    // ========================================================
    // MENSAJES
    // ========================================================

    subSock.ev.on(
      "messages.upsert",
      async ({
        messages,
        type: msgType,
      }) => {
        if (
          msgType !==
          "notify"
        ) {
          return;
        }

        const msg =
          messages[0];

        if (!msg) {
          return;
        }

        const db =
          await getSubBotDB(
            senderId,
          );

        await handleMessage(
          subSock,
          msg,
          db,
          () =>
            saveSubBotDB(
              senderId,
            ),
        );
      },
    );

    // ========================================================
    // GRUPOS
    // ========================================================

    subSock.ev.on(
      "group-participants.update",
      async (update) => {
        await handleGroupUpdate(
          subSock,
          update,
          () =>
            getSubBotDB(
              senderId,
            ),
        );
      },
    );

    // ========================================================
    // CONEXIÓN
    // ========================================================

    subSock.ev.on(
      "connection.update",
      async (
        update,
      ) => {
        const {
          connection,
          lastDisconnect,
          qr,
        } = update;

        // ====================================================
        // QR
        // ====================================================

        if (
          qr &&
          type === "qr" &&
          !isConnected &&
          !isAutoload &&
          sock &&
          remoteJid &&
          m
        ) {
          const qrBuffer =
            await QRCode.toBuffer(
              qr,
            );

          await sock.sendMessage(
            remoteJid,
            {
              image:
                qrBuffer,

              caption:
                "〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕⬣",
            },
            {
              quoted: m,
            },
          );
        }

        // ====================================================
        // CERRADO
        // ====================================================

        if (
          connection !==
          "close"
        ) {
          if (
            connection ===
            "open"
          ) {
            const wasConnected =
              isConnected;

            isConnected =
              true;

            if (
              timeout
            ) {
              clearTimeout(
                timeout,
              );

              timeout =
                null;
            }

            console.log(
              chalk.green(
                `✅ Sub-Bot (${senderId}) restablecido y corriendo de forma independiente.`,
              ),
            );

            syncSubBotsJson();

            if (
              !wasConnected &&
              !isAutoload &&
              sock &&
              remoteJid &&
              m
            ) {
              await sock.sendMessage(
                remoteJid,
                {
                  text:
                    "╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n\n┃ 🤖 ¡𝐒𝐮𝐛-𝐛𝐨𝐭 𝐯𝐢𝐧𝐜𝐮𝐥𝐚𝐝𝐨 𝐜𝐨𝐧 𝐞́𝐱𝐢𝐭𝐨!\n┃ ⚡ Ahora el bot está activo en tu cuenta\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
                },
                {
                  quoted: m,
                },
              );
            }
          }

          return;
        }

        // ====================================================
        // OBTENER RAZÓN
        // ====================================================

        const error =
          lastDisconnect?.error;

        const reason =
          error
            ?.output
            ?.statusCode ||
          error?.statusCode ||
          new Boom(error)
            ?.output
            ?.statusCode;

        console.log(
          `[SUB-BOT] Conexión cerrada para ${senderId}. Código: ${
            reason ||
            "N/A"
          }.`,
        );

        const shouldResetSession =
          [
            DisconnectReason.loggedOut,
            DisconnectReason.badSession,
            DisconnectReason.forbidden,
            DisconnectReason.multideviceMismatch,
          ].includes(
            reason,
          );

        if (
          timeout
        ) {
          clearTimeout(
            timeout,
          );

          timeout =
            null;
        }

        // ====================================================
        // SESIÓN INVÁLIDA
        // ====================================================

        if (
          shouldResetSession
        ) {
          console.log(
            `[SUB-BOT] Desvinculación detectada. Limpiando datos de sesión.`,
          );

          await destroySubBotSocket(
            senderId,
            subSock,
          );

          if (
            fs.existsSync(
              sessionPath,
            )
          ) {
            try {
              fs.rmSync(
                sessionPath,
                {
                  recursive:
                    true,
                  force:
                    true,
                },
              );
            } catch {}
          }

          syncSubBotsJson();

          return;
        }

        // ====================================================
        // RECONEXIÓN
        // ====================================================
                if (
          !subSock.isClosedManually
        ) {
          console.log(
            `[SUB-BOT] Reconectando sesión caída de ${senderId} en 7 segundos...`,
          );

          // Liberar el socket anterior
          // antes de crear uno nuevo.
          await destroySubBotSocket(
            senderId,
            subSock,
          );

          setTimeout(
            () => {
              start().catch(
                (err) => {
                  console.error(
                    `[SUB-BOT] Error reconectando ${senderId}:`,
                    err.message,
                  );
                },
              );
            },
            7000,
          );
        }
      },
    );

    // ========================================================
    // ESTADO DE REGISTRO
    // ========================================================

    const isRegistered =
      state.creds &&
      (
        state.creds
          .registered ||
        state.creds.me
      );

    // ========================================================
    // PAIRING CODE
    // ========================================================

    if (
      type === "code" &&
      phoneNumber &&
      !isRegistered &&
      !codeRequested &&
      !isAutoload
    ) {
      codeRequested =
        true;

      (async () => {
        try {
          console.log(
            `[SUB-BOT] Esperando canal seguro para generar código de ${senderId}...`,
          );

          await subSock
            .waitForSocketOpen();

          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                4000,
              ),
          );

          let code =
            await subSock
              .requestPairingCode(
                phoneNumber,
              );

          code =
            code
              ?.match(
                /.{1,4}/g,
              )
              ?.join("-") ||
            code;

          if (
            sock &&
            remoteJid &&
            m
          ) {
            await sock.sendMessage(
              remoteJid,
              {
                text:
                  `*${code.toUpperCase()}*`,
              },
              {
                quoted: m,
              },
            );
          }

          console.log(
            `[SUB-BOT] Código entregado con éxito para ${senderId}`,
          );
        } catch (err) {
          console.error(
            "Error solicitando código en sub-bot:",
            err,
          );
        }
      })();
    }
  }

  start().catch(
    (err) => {
      console.error(
        `[SUB-BOT] Error iniciando ${senderId}:`,
        err.message,
      );
    },
  );
}