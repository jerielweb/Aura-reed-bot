import makeWASocket, { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import chalk from 'chalk';
import './models/settings.js';
import { handleMessage } from './controllers/msgHandler.js';
import { handleGroupUpdate } from './controllers/groupEvents.js';
import { getDB, saveDB, initDB } from './models/db.js';
import { runCleanCacheIfNeeded, startCleanCacheTimer } from './controllers/cleanCache.js';

await initDB();
const db = await getDB();
await runCleanCacheIfNeeded(db, saveDB);
startCleanCacheTimer(db, saveDB);

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');
    const sock = makeWASocket({
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
        },
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('creds.update', saveCreds);

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
        if (u.qr) qrcodeTerminal.generate(u.qr, { small: true });
        if (u.connection === 'close') connectToWhatsApp();
        if (u.connection === 'open') console.log(chalk.green('✅ Bot en línea y validado'));
    });
}

connectToWhatsApp();