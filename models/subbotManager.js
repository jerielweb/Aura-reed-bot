import makeWASocket, { useMultiFileAuthState, makeCacheableSignalKeyStore, DisconnectReason } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import { handleMessage } from '../controllers/msgHandler.js';
import { stripEconomyFromUsers } from './groupDb.js';

export const SUB_LIMIT_MESSAGE = '✐ No se han encontrado espacios disponibles para registrar un `Sub-Bot`.';

/** Lee el límite en cada llamada (sin caché de módulo; editable en database.json). */
export function getMaxSubBots() {
    try {
        const db = JSON.parse(fs.readFileSync(path.join(databaseDir, 'database.json'), 'utf-8'));
        const max = Number(db.maxSubBots);
        return Number.isFinite(max) && max >= 0 ? max : 15;
    } catch {
        return 15;
    }
}

const ROOT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const sessionsDir = path.join(ROOT_DIR, 'sessions', 'subbots');
const databaseDir = path.join(ROOT_DIR, 'database');

if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

const getDB = () => {
    const dbData = JSON.parse(fs.readFileSync(path.join(databaseDir, 'database.json'), 'utf-8'));
    const usersData = JSON.parse(fs.readFileSync(path.join(databaseDir, 'users.json'), 'utf-8'));
    const groupsData = JSON.parse(fs.readFileSync(path.join(databaseDir, 'groups.json'), 'utf-8'));
    return {
        prefix: dbData.prefix,
        owners: dbData.owners,
        ownerRoles: dbData.ownerRoles || {},
        users: stripEconomyFromUsers(usersData.users || {}),
        groups: groupsData.groups || {}
    };
};

const saveDB = (data) => {
    const roles = data.ownerRoles || {};
    const existing = JSON.parse(fs.readFileSync(path.join(databaseDir, 'database.json'), 'utf-8'));
    const dbToSave = {
        prefix: data.prefix,
        owners: data.owners,
        maxSubBots: data.maxSubBots ?? existing.maxSubBots ?? 15
    };
    if (Object.keys(roles).length > 0) dbToSave.ownerRoles = roles;
    fs.writeFileSync(path.join(databaseDir, 'database.json'), JSON.stringify(dbToSave, null, 2));
    fs.writeFileSync(path.join(databaseDir, 'users.json'), JSON.stringify({ users: stripEconomyFromUsers(data.users) }, null, 2));
    fs.writeFileSync(path.join(databaseDir, 'groups.json'), JSON.stringify({ groups: data.groups }, null, 2));
};

// Mapa para rastrear sockets activos de sub-bots
const activeSubBots = new Map();

/** Lista carpetas de sesión con creds.json válido. */
export function listActiveSubBotSessions() {
    if (!fs.existsSync(sessionsDir)) return [];
    return fs.readdirSync(sessionsDir, { withFileTypes: true })
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .filter(name => fs.existsSync(path.join(sessionsDir, name, 'creds.json')));
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
    if (phoneNumber) return String(phoneNumber).replace(/\D/g, '');
    if (jidRemitente) return jidRemitente.split('@')[0].split(':')[0];
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
    const senderId = resolveSubBotSenderId(phoneNumber, null) || sender.split('@')[0].split(':')[0];
    const sessionPath = path.join(sessionsDir, senderId);

    if (!canRegisterSubBot(senderId)) {
        await sock.sendMessage(remoteJid, { text: SUB_LIMIT_MESSAGE }, { quoted: m });
        return;
    }

    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
    }

    let isConnected = false;
    let isClosedManually = false;

    const timeout = setTimeout(async () => {
        if (!isConnected) {
            isClosedManually = true;
            await sock.sendMessage(remoteJid, { text: '⏳ El tiempo de vinculación ha expirado (60 segundos). Inténtalo de nuevo.' }, { quoted: m });
            if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
        }
    }, 60000);

    async function start() {
        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
        const subSock = makeWASocket({
            auth: {
                creds: state.creds,
                keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' }))
            },
            logger: pino({ level: 'silent' }),
            printQRInTerminal: false,
            browser: ["Ubuntu", "Chrome", "20.0.04"],
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 0,
            keepAliveIntervalMs: 10000,
            syncFullHistory: false,
            markOnlineOnConnect: true
        });

        // Registrar en el mapa
        activeSubBots.set(senderId, subSock);

        subSock.ev.on('creds.update', saveCreds);

        subSock.ev.on('messages.upsert', async ({ messages, type: msgType }) => {
            if (msgType !== 'notify') return;
            const msg = messages[0];
            const db = getDB();
            await handleMessage(subSock, msg, db, saveDB);
        });

        subSock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;

            if (qr && type === 'qr' && !isConnected) {
                const qrBuffer = await QRCode.toBuffer(qr);
                await sock.sendMessage(remoteJid, { image: qrBuffer, caption: '〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕⬣' }, { quoted: m });
            }

            if (connection === 'close') {
                const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                console.log(`[SUB-BOT] Conexión cerrada. Razón/Código: ${reason}`);
                
                if (reason === 401) {
                    if (fs.existsSync(sessionPath)) fs.rmSync(sessionPath, { recursive: true, force: true });
                    clearTimeout(timeout);
                } else if (!isConnected && !isClosedManually) {
                    console.log(`[SUB-BOT] Reintentando conexión...`);
                    start(); // Reintentar automáticamente
                }
            } else if (connection === 'open') {
                isConnected = true;
                clearTimeout(timeout);
                await sock.sendMessage(remoteJid, { text: '╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n\n┃ 🤖 ¡𝐒𝐮𝐛-𝐛𝐨𝐭 𝐯𝐢𝐧𝐜𝐮𝐥𝐚𝐝𝐨 𝐜𝐨𝐧 𝐞́𝐱𝐢𝐭𝐨!\n┃ ⚡ Ahora el bot está activo en tu cuenta\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣' }, { quoted: m });
            }
        });

        if (type === 'code' && phoneNumber && !subSock.authState.creds.registered) {
            setTimeout(async () => {
                try {
                    const code = await subSock.requestPairingCode(phoneNumber);
                    await sock.sendMessage(remoteJid, { text: `${code}` }, { quoted: m });
                } catch (err) {
                    console.error('Error solicitando código:', err);
                }
            }, 5000);
        }
    }

    start();
}
