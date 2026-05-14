import makeWASocket, { useMultiFileAuthState, DisconnectReason, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcodeTerminal from 'qrcode-terminal';
import fs from 'fs';
import pino from 'pino';
import chalk from 'chalk';
import { handleMessage } from './controllers/msgHandler.js';

const getDB = () => {
    const dbData = JSON.parse(fs.readFileSync('./database/database.json', 'utf-8'));
    const usersData = JSON.parse(fs.readFileSync('./database/users.json', 'utf-8'));
    const groupsData = JSON.parse(fs.readFileSync('./database/groups.json', 'utf-8'));
    return {
        prefix: dbData.prefix,
        owners: dbData.owners,
        users: usersData.users || {},
        groups: groupsData.groups || {}
    };
};

const saveDB = (data) => {
    fs.writeFileSync('./database/database.json', JSON.stringify({ prefix: data.prefix, owners: data.owners }, null, 2));
    fs.writeFileSync('./database/users.json', JSON.stringify({ users: data.users }, null, 2));
    fs.writeFileSync('./database/groups.json', JSON.stringify({ groups: data.groups }, null, 2));
};

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