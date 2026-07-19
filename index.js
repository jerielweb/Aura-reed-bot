import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestWaWebVersion,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcodeTerminal from "qrcode-terminal";
import pino from "pino";
import chalk from "chalk";
import readline from "readline";
import fs from "fs";
import "./models/settings.js";
import { handleMessage } from "./controllers/msgHandler.js";
import { handleGroupUpdate } from "./controllers/groupEvents.js";
import { getDB, saveDB, initDB, flushDB } from "./models/db.js";
import {
  runCleanCacheIfNeeded,
  startCleanCacheTimer,
} from "./controllers/cleanCache.js";
import {
  wrapGroupMetadataCache,
  flushAllSubBotDBs,
  groupMetadataCache,
} from "./models/subbotWorker.js";

await initDB();
const db = await getDB();
await runCleanCacheIfNeeded(db, saveDB);
startCleanCacheTimer(db, saveDB);

function setupExitHandlers() {
  const saveAndExit = async (signal) => {
    console.log(
      chalk.gray(
        `\n[EXIT] Señal recibida: ${signal}. Guardando base de datos...`,
      ),
    );
    try {
      await flushDB();
      await flushAllSubBotDBs();
    } catch (err) {
      console.error(chalk.red("[EXIT] Error guardando DB:"), err);
    }
    process.exit(signal === "SIGINT" ? 0 : 1);
  };

  process.on("SIGINT", () => saveAndExit("SIGINT"));
  process.on("SIGTERM", () => saveAndExit("SIGTERM"));
  process.on("beforeExit", async () => {
    try {
      await flushDB();
      await flushAllSubBotDBs();
    } catch (err) {
      console.error(chalk.red("[EXIT] Error guardando DB en beforeExit:"), err);
    }
  });
}

setupExitHandlers();

const banner = `
\t${chalk.hex("#e9d5ff").bold("  █████╗ ██╗   ██╗██████╗  █████╗     ██████╗ ███████╗███████╗██████╗ ")}
\t${chalk.hex("#c084fc").bold(" ██╔══██╗██║   ██║██╔══██╗██╔══██╗    ██╔══██╗██╔════╝██╔════╝██╔══██╗")}
\t${chalk.hex("#a855f7").bold(" ███████║██║   ██║██████╔╝███████║    ██████╔╝█████╗  █████╗  ██║  ██║")}
\t${chalk.hex("#8b5cf6").bold(" ██╔══██║██║   ██║██╔══██╗██╔══██║    ██╔══██╗██╔══╝  ██╔══╝  ██║  ██║")}
\t${chalk.hex("#6d28d9").bold(" ██║  ██║╚██████╔╝██║  ██║██║  ██║    ██║  ██║███████╗███████╗██████╔╝")}
\t${chalk.hex("#4c1d95").bold(" ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚══════╝╚══════╝╚═════╝ ")}
\t\t\t${chalk.hex("#6d28d9").italic("─────────── Powered By Jeriel B. ───────────")}
`;
console.log(banner);

// Helper to ask terminal questions
const question = (text) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(text, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });

let isPairingChoiceMade = false;
let chosenPairingCode = false;
let chosenPhoneNumber = "";

async function connectToWhatsApp() {
  const { state, saveCreds } =
    await useMultiFileAuthState("sessions/principal");

  // Check if we are already registered/logged in
  const isRegistered =
    state.creds && (state.creds.registered || state.creds.me);

  if (!isRegistered && !isPairingChoiceMade) {
    let menu = `${
      chalk.blue.bold(`╭──────────── Vinculación de Aura Reed ───────────⬣\n`) +
      chalk.blue.bold(`│ \n`) +
      chalk.blue.bold(`│ Seleccione un método de vinculación:\n`) +
      chalk.blue.bold(`│ \n`) +
      chalk.blue.bold(`│ 1. Código QR (Terminal)\n`) +
      chalk.blue.bold(`│ 2. Código de emparejamiento\n`) +
      chalk.blue.bold(`│ \n`) +
      chalk.blue.bold(`╰─────────────────────────────────────────────────⬣\n`)
    }`;

    console.log(menu);
    console.log(chalk.cyan.bold("Seleccione una opción (1 o 2) "));
    const option = await question(chalk.cyan.bold(">_ "));

    isPairingChoiceMade = true;
    if (option === "2") {
      chosenPairingCode = true;
      console.log(
        chalk.cyan.bold(
          "Ingrese el número de teléfono con código de país (solo números, ej: 50612345678): ",
        ),
      );
      let num = await question(chalk.cyan.bold("> "));
      chosenPhoneNumber = num.replace(/[^0-9]/g, "");
      if (!chosenPhoneNumber) {
        console.log(
          chalk.red(
            "Número inválido. Se usará el método de Código QR por defecto.",
          ),
        );
        chosenPairingCode = false;
      }
    }
  }

  let version;
  try {
    const fetched = await fetchLatestWaWebVersion();
    version = fetched.version;
    console.log(
      chalk.blue(
        `[Aura Reed] Usando la versión de WhatsApp Web v${version.join(".")}`,
      ),
    );
  } catch (err) {
    console.log(
      chalk.yellow(
        `[Aura Reed] No se pudo obtener la última versión de WhatsApp Web (posible bloqueo de IP en el host). Se usará la versión interna de Baileys.`,
      ),
    );
  }

  const sock = makeWASocket({
    ...(version ? { version } : {}),
    auth: {
      creds: state.creds,
      keys: state.keys,
    },
    printQRInTerminal: false,
    browser: ["Ubuntu", "Chrome", "20.0.04"],
    logger: pino({ level: "silent" }),
    cachedGroupMetadata: async (jid) => {
      const meta = groupMetadataCache.get(jid);
      console.log(
        chalk.gray(
          `[Aura Reed] Metadata cache check for ${jid}: ${meta ? "HIT" : "MISS"}`,
        ),
      );
      return fetch;
    },
  });

  await wrapGroupMetadataCache(sock);

  sock.ev.on("creds.update", saveCreds);

  if (chosenPairingCode && !isRegistered) {
    (async () => {
      try {
        await sock.waitForSocketOpen();
        // Esperar 3 segundos para asegurar que el apretón de manos (handshake) se complete
        await new Promise((resolve) => setTimeout(resolve, 3000));
        let code = await sock.requestPairingCode(chosenPhoneNumber);
        code = code?.match(/.{1,4}/g)?.join("-") || code;
        console.log(
          chalk.green(`\n🔑 Código de vinculación: `) +
            chalk.bgGreen.black(` ${code.toUpperCase()} `) +
            "\n",
        );
      } catch (err) {
        console.error(
          chalk.red("Error al solicitar el código de emparejamiento:"),
          err,
        );
      }
    })();
  }

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;
    const m = messages[0];
    const db = await getDB();
    await handleMessage(sock, m, db, saveDB);
  });

  sock.ev.on("group-participants.update", async (update) => {
    await handleGroupUpdate(sock, update, getDB);
  });

  sock.ev.on("connection.update", (u) => {
    if (u.qr && !chosenPairingCode) {
      console.log(
        chalk.yellow(
          "Escanea este código QR con WhatsApp para vincular el bot.",
        ),
      );
      qrcodeTerminal.generate(u.qr, { small: true });
    }
    if (u.connection === "close") {
      try {
        sock.ev.removeAllListeners();
      } catch (e) {
        console.error("Error al remover oyentes del socket:", e);
      }

      const error = u.lastDisconnect?.error;
      const statusCode = error?.output?.statusCode || error?.statusCode;
      const errorMessage = error?.message || "Error desconocido";

      console.log(
        chalk.yellow(
          `\nℹ️ Conexión cerrada. Código de estado: ${statusCode || "N/A"}. Razón: ${errorMessage}`,
        ),
      );

      // Si aún no estábamos registrados (en proceso de vinculación) y se cierra la conexión
      const isNotRegistered =
        !state.creds || !(state.creds.registered || state.creds.me);

      const shouldResetSession =
        [
          DisconnectReason.loggedOut, // 401
          DisconnectReason.badSession, // 500
          DisconnectReason.forbidden, // 403
          DisconnectReason.multideviceMismatch, // 411
        ].includes(statusCode) || isNotRegistered;

      if (shouldResetSession) {
        if (isNotRegistered) {
          console.log(
            chalk.red(
              "\n⚠️ La vinculación fue interrumpida, el código expiró o la IP del host está bloqueada.",
            ),
          );
        } else {
          console.log(
            chalk.red(
              "\n❌ La sesión no es válida, ha sido desvinculada por WhatsApp o el dispositivo cambió.",
            ),
          );
        }
        console.log(
          chalk.yellow(
            "Limpiando credenciales y volviendo al menú de vinculación...\n",
          ),
        );

        const authFolder = "./sessions/principal";
        if (fs.existsSync(authFolder)) {
          try {
            fs.rmSync(authFolder, { recursive: true, force: true });
          } catch (e) {
            console.error(chalk.red("Error al limpiar credenciales:"), e);
          }
        }

        // Reset state to prompt for new linking
        isPairingChoiceMade = false;
        chosenPairingCode = false;
        chosenPhoneNumber = "";

        console.log(
          chalk.cyan("Iniciando nuevo proceso de vinculación en 3 segundos..."),
        );
        setTimeout(connectToWhatsApp, 3000);
      } else {
        console.log(
          chalk.yellow(
            "⚠️ Conexión interrumpida. Reconectando en 5 segundos...",
          ),
        );
        setTimeout(connectToWhatsApp, 5000);
      }
    }
    if (u.connection === "open") {
      console.log(chalk.green("✅ Bot Principal en línea y validado"));
    }
  });
}

connectToWhatsApp();