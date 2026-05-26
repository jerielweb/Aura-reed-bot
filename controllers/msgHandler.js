import fs from 'fs';
import chalk from 'chalk';
import { resolveLidToRealJid } from '../models/utils.js';
import { trackGroupActivity } from '../models/groupDb.js';
import { cmdLog } from './cmdLog.js';
import { Rstr } from '../controllers/textBots.js';
import { isCategoryEnabled, default as cmdManagerCmd } from './cmdManager.js';
import { botStatus } from '../commands/group/bot.js';

const categories = ['owner', 'system', 'group', 'downloads', 'economy', 'search', 'fun', 'utils', 'sticker', 'profile'];

let middlewareCache = null;
let middlewareCacheTime = 0;
let commandCache = null;
let commandCacheTime = 0;
const CACHE_TTL = 30000;

async function loadMiddlewares() {
    const now = Date.now();
    if (middlewareCache && (now - middlewareCacheTime) < CACHE_TTL) return middlewareCache;
    const middlewares = [];
    for (const cat of categories) {
        const folderPath = `./commands/${cat}`;
        if (!fs.existsSync(folderPath)) continue;
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
        for (const file of files) {
            try {
                const { default: cmd } = await import(`../commands/${cat}/${file}?update=${now}`);
                if (cmd && typeof cmd.middleware === 'function') middlewares.push(cmd);
            } catch (e) { console.error(chalk.red(`Error middleware ${file}:`), e.message); }
        }
    }
    middlewareCache = middlewares;
    middlewareCacheTime = now;
    return middlewares;
}

async function loadCommands() {
    const now = Date.now();
    if (commandCache && (now - commandCacheTime) < CACHE_TTL) return commandCache;
    const allCommands = [];
    for (const cat of categories) {
        const folderPath = `./commands/${cat}`;
        if (!fs.existsSync(folderPath)) continue;
        const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));
        for (const file of files) {
            try {
                const { default: cmd } = await import(`../commands/${cat}/${file}?update=${now}`);
                if (cmd && cmd.name) allCommands.push(cmd);
            } catch (e) { console.error(chalk.red(`Error comando ${file}:`), e.message); }
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

    const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || "";
    
    // --- BLOQUEO TOTAL (INTERRUPTOR) ---
    const prefix = db.prefix;
    const esComando = text.startsWith(prefix);
    const argsForCheck = esComando ? text.slice(prefix.length).trim().split(/ +/) : [];
    const commandNameForCheck = esComando ? argsForCheck[0]?.toLowerCase() : null;

    if (isGroup && db.groups?.[remoteJid]?.botOn === false) {
        if (text === `${prefix}bot on` || commandNameForCheck === 'bot') {
            // Permitir el comando bot para mostrar estado o activar.
        } else if (esComando) {
            return await sock.sendMessage(remoteJid, { text: `⚠️ El bot está desactivado. Usa *${prefix}bot on* para activarlo.` }, { quoted: m });
        } else return;
    }
    // ------------------------------------

    const jidResuelto = await resolveLidToRealJid(senderRaw, sock, remoteJid);
    const numeroReal = jidResuelto.split('@')[0].split(':')[0];
    const jidRemitente = `${numeroReal}@s.whatsapp.net`;

    if (isGroup && !m.key.fromMe && trackGroupActivity(db, remoteJid, jidRemitente)) saveDB(db);

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
            const userParticipant = groupMetadata.participants.find(p => p.id === senderRaw || p.id === jidRemitente || p.id.split(':')[0] === numeroReal);
            const botParticipant = groupMetadata.participants.find(p => p.id.includes(sock.user.id.split(':')[0]));
            isAdmin = userParticipant?.admin === 'admin' || userParticipant?.admin === 'superadmin';
            isBotAdmin = botParticipant?.admin === 'admin' || botParticipant?.admin === 'superadmin';
        } catch (e) { isAdmin = false; }
    }

    await sock.readMessages([m.key]);

    if (!esComando) {
        cmdLog({ numeroReal, rango: rangoLog, isGroup, text, pushName: m.pushName, groupMetadata, m });
    } else {
        try {
            const middlewares = await loadMiddlewares();
            for (const cmd of middlewares) await cmd.middleware(sock, m, { db, saveDB, owners, isAdmin, isBotAdmin, isOwner, groupMetadata, text });
        } catch (e) { console.error(e); }

        const args = text.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();
        
        cmdLog({ numeroReal, rango: isOwner ? 'OWNER 👑' : (isAdmin ? 'ADMIN 🛡️' : 'USUARIO 👤'), commandName, isGroup, text, pushName: m.pushName, groupMetadata, m, prefix });

        const allCommands = await loadCommands();
        let commandFound = false;

        for (const cmd of allCommands) {
            const match = Array.isArray(cmd.name) ? cmd.name.includes(commandName) : cmd.name === commandName;
            if (match) {
                commandFound = true;
                if (cmd.category === 'owner' && !isOwner) return await sock.sendMessage(remoteJid, { text: Rstr.onlyOwner }, { quoted: m });
                if ((cmd.category === 'group' || cmd.category === 'economy') && !isGroup) return await sock.sendMessage(remoteJid, { text: Rstr.onlyGroup }, { quoted: m });
                if (isGroup && !isCategoryEnabled(remoteJid, cmd.category, db)) return await sock.sendMessage(remoteJid, { text: 'Categoría desactivada.' }, { quoted: m });
                if (cmd.adminOnly && !isAdmin) return await sock.sendMessage(remoteJid, { text: Rstr.onlyAdmin }, { quoted: m });

                await cmd.execute(sock, m, args, { prefix, db, saveDB, isOwner, isAdmin, isBotAdmin, owners, groupMetadata, numeroReal, jidRemitente });
                return;
            }
        }

        if (!commandFound) {
            return await sock.sendMessage(remoteJid, {
                text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐂𝐎𝐌𝐀𝐍𝐃𝐎 𝐍𝐎 𝐄𝐗𝐈𝐒𝐓𝐄\n╰━━━━━━━━━━━━⬣\n┃ > El comando que intentaste usar no existe.\n┃ > Usa el menú con ${prefix}menu para ver los comandos disponibles.`
            }, { quoted: m });
        }
    }
}