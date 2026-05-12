import fs from 'fs';
import chalk from 'chalk';
import { resolveLidToRealJid } from '../models/utils.js';
import { cmdLog } from './cmdLog.js';

import { Rstr } from '../controllers/textBots.js'; // IMPORTANTE

const categories = ['owner', 'system', 'group'];

// Cache de middlewares para no recargar en cada mensaje
let middlewareCache = null;
let middlewareCacheTime = 0;
const MIDDLEWARE_CACHE_TTL = 30000; // 30 segundos

async function loadMiddlewares() {
    const now = Date.now();
    if (middlewareCache && (now - middlewareCacheTime) < MIDDLEWARE_CACHE_TTL) {
        return middlewareCache;
    }

    const middlewares = [];
    for (const cat of categories) {
        const folderPath = `./commands/${cat}`;
        if (!fs.existsSync(folderPath)) continue;
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

        for (const file of files) {
            try {
                const { default: cmd } = await import(`../commands/${cat}/${file}?update=${now}`);
                if (cmd && typeof cmd.middleware === 'function') {
                    middlewares.push(cmd);
                }
            } catch (e) {
                console.error(chalk.red(`Error cargando middleware de ${file}:`), e.message);
            }
        }
    }

    middlewareCache = middlewares;
    middlewareCacheTime = now;
    return middlewares;
}

export async function handleMessage(sock, m, db, saveDB) {
    if (!m || !m.message) return;

    const remoteJid = m.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    const senderRaw = m.key.participant || remoteJid;

    // 1. RESOLVER IDENTIDAD (Corrección para número real en privado)
    const jidResuelto = await resolveLidToRealJid(senderRaw, sock, remoteJid);
    const numeroReal = jidResuelto.split('@')[0].split(':')[0];
    const jidRemitente = `${numeroReal}@s.whatsapp.net`;

    // 2. DETECTAR RANGOS
    const owners = db.owners || [];
    const botId = sock.user.id.split('@')[0].split(':')[0] + '@s.whatsapp.net';
    const sender = m.key.fromMe ? botId : jidRemitente;
    const isOwner = owners.includes(sender);

    let isAdmin = false;
    let isBotAdmin = false;
    let groupMetadata = null;

    if (isGroup) {
        try {
            groupMetadata = await sock.groupMetadata(remoteJid);
            const participants = groupMetadata.participants || [];
            const userParticipant = participants.find(p => p.id === senderRaw);
            const botParticipant = participants.find(p => p.id.includes(sock.user.id.split(':')[0]));

            isAdmin = userParticipant?.admin === 'admin' || userParticipant?.admin === 'superadmin' || isOwner;
            isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
        } catch (e) { }
    }

    // 3. EJECUTAR MIDDLEWARES (antes del filtro de prefix, para que antilink funcione en TODOS los mensajes)
    try {
        const middlewares = await loadMiddlewares();
        for (const cmd of middlewares) {
            try {
                await cmd.middleware(sock, m, { db, saveDB, owners, isAdmin, isBotAdmin, isOwner, groupMetadata });
            } catch (err) {
                console.error(chalk.red(`Error en middleware [${cmd.name}]:`), err.message);
            }
        }
    } catch (e) {
        console.error(chalk.red("Error cargando middlewares:"), e);
    }

    // 4. FILTRO DE PREFIX (solo comandos pasan de aquí)
    const prefix = db.prefix;
    const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || "";

    if (!text.startsWith(prefix)) return;

    const args = text.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const rango = isOwner ? 'OWNER 👑' : (isAdmin ? 'ADMIN 🛡️' : 'USUARIO 👤');

    cmdLog({ numeroReal, rango, commandName, isGroup });

    let commandFound = false;

    try {
        for (const cat of categories) {
            const folderPath = `./commands/${cat}`;
            if (!fs.existsSync(folderPath)) continue;
            const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

            for (const file of files) {
                const { default: cmd } = await import(`../commands/${cat}/${file}?update=${Date.now()}`);


                if (!cmd || !cmd.name) continue;

                const match = Array.isArray(cmd.name) ? cmd.name.includes(commandName) : cmd.name === commandName;

                if (match) {
                    commandFound = true;

                    if (cat === 'owner' && !isOwner) {
                        return await sock.sendMessage(remoteJid, { text: Rstr.onlyOwner }, { quoted: m });
                    }

                    if (cat === 'group' && !isGroup) {
                        return await sock.sendMessage(remoteJid, { text: Rstr.onlyGroup }, { quoted: m });
                    }

                    if (isGroup && db.groups[remoteJid]?.onlyAdmin && !isAdmin) {
                        return;
                    }

                    if (cmd.adminOnly && !isAdmin) {
                        return await sock.sendMessage(remoteJid, { text: Rstr.onlyAdmin }, { quoted: m });
                    }

                    try {
                        await cmd.execute(sock, m, args, { prefix, db, saveDB, isOwner, isAdmin, isBotAdmin, owners, groupMetadata, numeroReal, jidRemitente });
                    } catch (error) {
                        await sock.sendMessage(remoteJid, { text: `⚠️ Error: ${error.message}` }, { quoted: m });
                    }
                    return;
                }
            }
        }

        if (!commandFound) {
            await sock.sendMessage(remoteJid, { text: `El comando \`${commandName}\` no existe usa \`${db.prefix}help\` para ver la lista de comandos disponibles.` }, { quoted: m });
        }

    } catch (e) {
        console.error(chalk.red("Error crítico:"), e);
    }
}