import fs from 'fs';
import chalk from 'chalk';
import { resolveLidToRealJid } from '../models/utils.js';
import { trackGroupActivity } from '../models/groupDb.js';
import { cmdLog } from './cmdLog.js';
import { Rstr } from '../controllers/textBots.js';
import { isCategoryEnabled, default as cmdManagerCmd } from './cmdManager.js';

const categories = ['owner', 'system', 'group', 'downloads', 'economy', 'search', 'fun', 'utilities', 'sticker', 'profile'];

let middlewareCache = null;
let middlewareCacheTime = 0;
let commandCache = null;
let commandCacheTime = 0;
const CACHE_TTL = 30000; // 30 segundos

async function loadMiddlewares() {
    const now = Date.now();
    if (middlewareCache && (now - middlewareCacheTime) < CACHE_TTL) {
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

async function loadCommands() {
    const now = Date.now();
    if (commandCache && (now - commandCacheTime) < CACHE_TTL) {
        return commandCache;
    }

    const allCommands = [];
    for (const cat of categories) {
        const folderPath = `./commands/${cat}`;
        if (!fs.existsSync(folderPath)) continue;
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

        for (const file of files) {
            try {
                const { default: cmd } = await import(`../commands/${cat}/${file}?update=${now}`);
                if (cmd && cmd.name) {
                    allCommands.push(cmd);
                }
            } catch (e) {
                console.error(chalk.red(`Error cargando comando ${file}:`), e.message);
            }
        }
    }
    allCommands.push(cmdManagerCmd);
    commandCache = allCommands;
    commandCacheTime = now;
    return allCommands;
}

export async function handleMessage(sock, m, db, saveDB) {
    if (!m || !m.message) return;

    const remoteJid = m.key.remoteJid;
    const isGroup = remoteJid.endsWith('@g.us');
    const senderRaw = m.key.participant || remoteJid;

    // 1. RESOLVER IDENTIDAD
    const jidResuelto = await resolveLidToRealJid(senderRaw, sock, remoteJid);
    const numeroReal = jidResuelto.split('@')[0].split(':')[0];
    const jidRemitente = `${numeroReal}@s.whatsapp.net`;

    if (isGroup && !m.key.fromMe && trackGroupActivity(db, remoteJid, jidRemitente)) {
        saveDB(db);
    }

    // 2. DETECTAR RANGOS
    const owners = db.owners || [];
    const botId = sock.user.id.split('@')[0].split(':')[0] + '@s.whatsapp.net';
    const sender = m.key.fromMe ? botId : jidRemitente;
    const isOwner = owners.includes(sender);
    const rangoLog = isOwner ? 'OWNER 👑' : 'USUARIO 👤';

    let isAdmin = false;
    let isBotAdmin = false;
    let groupMetadata = null;

    if (isGroup) {
        try {
            groupMetadata = await sock.groupMetadata(remoteJid);
            const participants = groupMetadata.participants || [];
            
            // Búsqueda robusta del participante (por ID directo o por JID resuelto)
            const userParticipant = participants.find(p => 
                p.id === senderRaw || 
                p.id === jidRemitente || 
                p.id.split(':')[0] === numeroReal
            );
            
            const botParticipant = participants.find(p => p.id.includes(sock.user.id.split(':')[0]));

            const isGroupAdmin = userParticipant?.admin === 'admin' || userParticipant?.admin === 'superadmin';
            isAdmin = isGroupAdmin; // El rango de admin ahora es estrictamente para admins de grupo
            isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
        } catch (e) { 
            isAdmin = false;
        }
    }

    const text = m.message.conversation || 
                 m.message.extendedTextMessage?.text || 
                 m.message.imageMessage?.caption || 
                 m.message.videoMessage?.caption || 
                 m.message.documentMessage?.caption || 
                 m.message.viewOnceMessageV2?.message?.imageMessage?.caption || 
                 m.message.viewOnceMessageV2?.message?.videoMessage?.caption || 
                 m.message.viewOnceMessage?.message?.imageMessage?.caption || 
                 m.message.viewOnceMessage?.message?.videoMessage?.caption || 
                 m.message.documentWithCaptionMessage?.message?.documentMessage?.caption || 
                 "";

    await sock.readMessages([m.key]);

    // LOG DE TEXTO NORMAL (No es comando)
    if (!text.startsWith(db.prefix)) {
        cmdLog({
            numeroReal,
            rango: rangoLog,
            isGroup,
            text,
            pushName: m.pushName,
            groupMetadata: groupMetadata,
            m: m
        });
    }

    // 3. EJECUTAR MIDDLEWARES
    try {
        const middlewares = await loadMiddlewares();
        for (const cmd of middlewares) {
            try {
                await cmd.middleware(sock, m, { db, saveDB, owners, isAdmin, isBotAdmin, isOwner, groupMetadata, text });
            } catch (err) {
                console.error(chalk.red(`Error en middleware [${cmd.name}]:`), err.message);
            }
        }
    } catch (e) {
        console.error(chalk.red("Error ejecutando middlewares:"), e);
    }

    // 4. FILTRO DE PREFIX
    const prefix = db.prefix;
    if (!text.startsWith(prefix)) return;

    const args = text.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const rango = isOwner ? 'OWNER 👑' : (isAdmin ? 'ADMIN 🛡️' : 'USUARIO 👤');

    // LOG DE COMANDOS (Corregido para pasar todas las propiedades necesarias al cmdLog)
    cmdLog({ 
        numeroReal, 
        rango, 
        commandName, 
        isGroup,
        text,
        pushName: m.pushName,
        groupMetadata: groupMetadata,
        m: m,
        prefix: db.prefix
    });

    try {
        const allCommands = await loadCommands();
        let commandFound = false;

        for (const cmd of allCommands) {
            const match = Array.isArray(cmd.name) ? cmd.name.includes(commandName) : cmd.name === commandName;
            if (match) {
                commandFound = true;
                const cat = cmd.category;

                if (cat === 'owner' && !isOwner) {
                    return await sock.sendMessage(remoteJid, { text: Rstr.onlyOwner }, { quoted: m });
                }

                if ((cat === 'group' || cat === 'economy') && !isGroup) {
                    return await sock.sendMessage(remoteJid, { text: Rstr.onlyGroup }, { quoted: m });
                }

                if (isGroup && !isCategoryEnabled(remoteJid, cat, db)) {
                    return await sock.sendMessage(remoteJid, { text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈́𝐀 𝐃𝐄𝐒𝐀𝐂𝐓𝐈𝐕𝐀𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > La categoría *${cat}* está\n┃ > desactivada en este grupo.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` }, { quoted: m });
                }

                if (cmd.adminOnly && !isAdmin) {
                    return await sock.sendMessage(remoteJid, { text: Rstr.onlyAdmin }, { quoted: m });
                }

                try {
                    await cmd.execute(sock, m, args, { prefix, db, saveDB, isOwner, isAdmin, isBotAdmin, owners, groupMetadata, numeroReal, jidRemitente });
                } catch (error) {
                    console.error(chalk.red(`Error ejecutando comando [${commandName}]:`), error);
                    await sock.sendMessage(remoteJid, { text: `⚠️ Error: ${error.message}` }, { quoted: m });
                }
                return;
            }
        }

        if (!commandFound) {
            await sock.sendMessage(remoteJid, { text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐂𝐎𝐌𝐀𝐍𝐃𝐎 𝐍𝐎 𝐄𝐗𝐈𝐒𝐓𝐄\n╰━━━━━━━━━━━━⬣\n┃ > El comando que intentaste usar no existe.\n┃ > Usa el menú con ${db.prefix}menu para ver los comandos disponibles.` }, { quoted: m });
        }

    } catch (e) {
        console.error(chalk.red("Error crítico en el procesador de comandos:"), e);
    }
}