import makeWASocket, { useMultiFileAuthState, makeCacheableSignalKeyStore } from '@whiskeysockets/baileys';
import pino from 'pino';
import fs from 'fs';
import QRCode from 'qrcode';
import { Boom } from '@hapi/boom';
import { handleMessage } from '../controllers/msgHandler.js';

const sessionsDir = './sessions/subbots';
if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });

const getDB = () => JSON.parse(fs.readFileSync('./database.json', 'utf-8'));
const saveDB = (data) => fs.writeFileSync('./database.json', JSON.stringify(data, null, 2));

// Mapa para rastrear sockets activos de sub-bots
const activeSubBots = new Map();

export async function stopSubBot(senderId) {
    const sessionPath = `${sessionsDir}/${senderId}`;
    if (activeSubBots.has(senderId)) {
        try {
            const subSock = activeSubBots.get(senderId);
            await subSock.logout(); // Esto cierra la sesión en WhatsApp
            subSock.ws.close();
        } catch (e) {
            console.error(`Error cerrando socket de sub-bot ${senderId}:`, e.message);
        }
        activeSubBots.delete(senderId);
    }
    
    if (fs.existsSync(sessionPath)) {
        fs.rmSync(sessionPath, { recursive: true, force: true });
        return true;
    }
    return false;
}

export async function createSubBot(sock, m, type, phoneNumber = null) {
    const remoteJid = m.key.remoteJid;
    const sender = m.key.participant || m.key.remoteJid;
    const senderId = sender.split('@')[0].split(':')[0];
    const sessionPath = `${sessionsDir}/${senderId}`;

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
            markOnlineOnConnect: false
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
                await sock.sendMessage(remoteJid, { image: qrBuffer, caption: '✨ Escanea este código QR para vincular tu sub-bot.\n\n⚠️ Tienes 60 segundos antes de que expire.' }, { quoted: m });
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
                await sock.sendMessage(remoteJid, { text: '✅ ¡Sub-bot vinculado con éxito! Ahora el bot está activo en tu cuenta.' }, { quoted: m });
            }
        });

        if (type === 'code' && phoneNumber && !subSock.authState.creds.registered) {
            setTimeout(async () => {
                try {
                    const code = await subSock.requestPairingCode(phoneNumber);
                    await sock.sendMessage(remoteJid, { text: `🔢 Tu código de vinculación es: *${code}*\n\nIngrésalo en WhatsApp > Dispositivos vinculados > Vincular con número de teléfono.` }, { quoted: m });
                } catch (err) {
                    console.error('Error solicitando código:', err);
                }
            }, 5000);
        }
    }

    start();
}
