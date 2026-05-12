import makeWASocket, { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcodeTerminal from 'qrcode-terminal';
import fs from 'fs';
import pino from 'pino';
import chalk from 'chalk';
import { handleMessage } from './controllers/msgHandler.js';

const DB_PATH = './database.json';
const getDB = () => JSON.parse(fs.readFileSync(DB_PATH, 'utf-8'));
const saveDB = (data) => fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));

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
        const db = getDB();
        await handleMessage(sock, m, db, saveDB);
    });

    sock.ev.on('connection.update', (u) => {
        if (u.qr) qrcodeTerminal.generate(u.qr, { small: true });
        if (u.connection === 'close') connectToWhatsApp();
        if (u.connection === 'open') console.log(chalk.green('✅ Bot en línea y validado'));
    });
}

connectToWhatsApp();