import makeWASocket, { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import chalk from 'chalk';
import readline from 'readline';
import fs from 'fs';
import './models/settings.js';
import { handleMessage } from './controllers/msgHandler.js';
import { handleGroupUpdate } from './controllers/groupEvents.js';
import { getDB, saveDB, initDB, flushDB } from './models/db.js';
import { runCleanCacheIfNeeded, startCleanCacheTimer } from './controllers/cleanCache.js';

await initDB();
const db = await getDB();
await runCleanCacheIfNeeded(db, saveDB);
startCleanCacheTimer(db, saveDB);

function setupExitHandlers() {
    const saveAndExit = async (signal) => {
        console.log(chalk.gray(`\n[EXIT] Señal recibida: ${signal}. Guardando base de datos...`));
        try {
            await flushDB();
        } catch (err) {
            console.error(chalk.red('[EXIT] Error guardando DB:'), err);
        }
        process.exit(signal === 'SIGINT' ? 0 : 1);
    };

    process.on('SIGINT', () => saveAndExit('SIGINT'));
    process.on('SIGTERM', () => saveAndExit('SIGTERM'));
    process.on('beforeExit', async () => {
        try {
            await flushDB();
        } catch (err) {
            console.error(chalk.red('[EXIT] Error guardando DB en beforeExit:'), err);
        }
    });
}

setupExitHandlers();

const banner = `
\t${chalk.hex('#e9d5ff').bold("  █████╗ ██╗   ██╗██████╗  █████╗     ██████╗ ███████╗███████╗██████╗ ")}
\t${chalk.hex('#c084fc').bold(" ██╔══██╗██║   ██║██╔══██╗██╔══██╗    ██╔══██╗██╔════╝██╔════╝██╔══██╗")}
\t${chalk.hex('#a855f7').bold(" ███████║██║   ██║██████╔╝███████║    ██████╔╝█████╗  █████╗  ██║  ██║")}
\t${chalk.hex('#8b5cf6').bold(" ██╔══██║██║   ██║██╔══██╗██╔══██║    ██╔══██╗██╔══╝  ██╔══╝  ██║  ██║")}
\t${chalk.hex('#6d28d9').bold(" ██║  ██║╚██████╔╝██║  ██║██║  ██║    ██║  ██║███████╗███████╗██████╔╝")}
\t${chalk.hex('#4c1d95').bold(" ╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚══════╝╚══════╝╚═════╝ ")}
\t\t\t${chalk.hex('#6d28d9').italic("─────────── Powered By Jeriel B. ───────────")}
`;
console.log(banner);


// Helper to ask terminal questions
const question = (text) => new Promise((resolve) => {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    rl.question(text, (answer) => {
        rl.close();
        resolve(answer.trim());
    });
});

let isPairingChoiceMade = false;
let chosenPairingCode = false;
let chosenPhoneNumber = '';

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('sessions/principal');
    
    // Check if we are already registered/logged in
    const isRegistered = state.creds && state.creds.registered;
    
    if (!isRegistered && !isPairingChoiceMade) {
        let menu = `${
            chalk.blue.bold(`╭──────────── Vinculación de Aura Reed ───────────⬣\n`)+
            chalk.blue.bold(`│ \n`)+
            chalk.blue.bold(`│ Seleccione un método de vinculación:\n`)+
            chalk.blue.bold(`│ \n`)+
            chalk.blue.bold(`│ 1. Código QR (Terminal)\n`)+
            chalk.blue.bold(`│ 2. Código de emparejamiento\n`)+
            chalk.blue.bold(`│ \n`)+
            chalk.blue.bold(`╰─────────────────────────────────────────────────⬣\n`)
        }`

        console.log(menu);
        const option = await question(chalk.cyan.bold('Seleccione una opción (1 o 2) > '));
        
        isPairingChoiceMade = true;
        if (option === '2') {
            chosenPairingCode = true;
            let num = await question(chalk.cyan.bold('Ingrese el número de teléfono con código de país (solo números, ej: 50612345678): '));
            chosenPhoneNumber = num.replace(/[^0-9]/g, '');
            if (!chosenPhoneNumber) {
                console.log(chalk.red('Número inválido. Se usará el método de Código QR por defecto.'));
                chosenPairingCode = false;
            }
        }
    }

    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        printQRInTerminal: false,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

    if (chosenPairingCode && !isRegistered) {
        setTimeout(async () => {
            try {
                let code = await sock.requestPairingCode(chosenPhoneNumber);
                code = code?.match(/.{1,4}/g)?.join('-') || code;
                console.log(chalk.green(`\n🔑 Código de vinculación: `) + chalk.bgGreen.black(` ${code.toUpperCase()} `) + '\n');
            } catch (err) {
                console.error(chalk.red('Error al solicitar el código de emparejamiento:'), err);
            }
        }, 3000);
    }

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        const db = await getDB();
        await handleMessage(sock, m, db, saveDB);
    });

    sock.ev.on('group-participants.update', async (update) => {
        await handleGroupUpdate(sock, update, getDB);
    });

    sock.ev.on('connection.update', (u) => {
        if (u.qr && !chosenPairingCode) {
            console.log(chalk.yellow('Escanea este código QR con WhatsApp para vincular el bot.'));
            qrcodeTerminal.generate(u.qr, { small: true });
        }
        if (u.connection === 'close') {
            const statusCode = (u.lastDisconnect?.error)?.output?.statusCode;
            const isLoggedOut = statusCode === DisconnectReason.loggedOut;

            if (isLoggedOut) {
                console.log(chalk.red('\n❌ La sesión ha sido desvinculada por WhatsApp o el dispositivo cambió.'));
                console.log(chalk.yellow('Limpiando credenciales obsoletas y volviendo al menú de vinculación...\n'));
                
                const authFolder = './sessions/principal';
                if (fs.existsSync(authFolder)) {
                    try {
                        fs.rmSync(authFolder, { recursive: true, force: true });
                    } catch (e) {
                        console.error(chalk.red('Error al limpiar credenciales inactivas:'), e);
                    }
                }
                
                // Reset state to prompt for new linking
                isPairingChoiceMade = false;
                chosenPairingCode = false;
                chosenPhoneNumber = '';
                
                connectToWhatsApp();
            } else {
                console.log(chalk.yellow('⚠️ Conexión interrumpida. Reconectando...'));
                connectToWhatsApp();
            }
        }
        if (u.connection === 'open') {
            console.log(chalk.green('✅ Bot en línea y validado'));
        }
    });
}

connectToWhatsApp();
