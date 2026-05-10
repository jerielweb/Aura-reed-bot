import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import pino from 'pino';
import chalk from 'chalk';
import antilinkCmd from './commands/group/antilink.js';

const getDB = () => JSON.parse(fs.readFileSync('./database.json', 'utf-8'));
const saveDB = (data) => fs.writeFileSync('./database.json', JSON.stringify(data, null, 2));

const processedMessages = new Set();
const categories = ['owner', 'system', 'group'];

async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === 'close') {
            const shouldReconnect = (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            if (shouldReconnect) connectToWhatsApp();
        } else if (connection === 'open') console.log('✅ Bot conectado exitosamente');
    });

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('messages.upsert', async ({ messages, type }) => {
        if (type !== 'notify') return;
        const m = messages[0];
        if (!m.message) return;

        const msgId = m.key.id;
        if (processedMessages.has(msgId)) return;
        processedMessages.add(msgId);
        if (processedMessages.size > 100) processedMessages.clear();

        const db = getDB();
        const prefix = db.prefix;
        const owners = db.owners || [];
        if (!db.groups) db.groups = {};

        const text = m.message.conversation || m.message.extendedTextMessage?.text || m.message.imageMessage?.caption || m.message.videoMessage?.caption || "";
        const remoteJid = m.key.remoteJid;

        let rawSender = m.key.fromMe ? sock.user.id : (m.key.participant || m.key.remoteJid);
        const sender = rawSender ? rawSender.replace(/:\d+/, "") : "";

        if (remoteJid.endsWith('@g.us')) {
            if (!db.groups[remoteJid]) db.groups[remoteJid] = { antilink: false, warnLimit: 3, warns: {}, activity: {} };
            if (!db.groups[remoteJid].activity) db.groups[remoteJid].activity = {};
            if (!db.groups[remoteJid].activity[sender]) db.groups[remoteJid].activity[sender] = 0;
            db.groups[remoteJid].activity[sender] += 1;

            try {
                if (antilinkCmd && antilinkCmd.middleware) {
                    await antilinkCmd.middleware(sock, m, { db, owners });
                }
            } catch (e) {
                console.error("Error ejecutando middleware de antilink:", e);
            }
            saveDB(db);
        }

        if (!text.startsWith(prefix)) return;

        const args = text.slice(prefix.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        try {
            let commandToExecute = null;
            let currentCategory = null;

            for (const cat of categories) {
                const folderPath = `./commands/${cat}`;
                if (!fs.existsSync(folderPath)) continue;
                const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.js'));

                for (const file of files) {
                    try {
                        const { default: cmd } = await import(`./commands/${cat}/${file}?update=${Date.now()}`);
                        if (!cmd || !cmd.name) continue;

                        if ((Array.isArray(cmd.name) && cmd.name.includes(commandName)) || cmd.name === commandName) {
                            commandToExecute = cmd;
                            currentCategory = cat;
                            break;
                        }
                    } catch (err) {
                        console.error(`Error cargando comando ${file}:`, err);
                    }
                }
                if (commandToExecute) break;
            }

            if (commandToExecute) {
                const isOwner = owners.includes(sender);

                if (currentCategory === 'owners' && !isOwner) {
                    return await sock.sendMessage(remoteJid, { text: '❌ Este comando solo puede ser ejecutado por el dueño.' }, { quoted: m });
                }

                if (commandToExecute.adminOnly && remoteJid.endsWith('@g.us')) {
                    const groupMetadata = await sock.groupMetadata(remoteJid);
                    const senderIsAdmin = groupMetadata.participants.some(p => p.id === sender && (p.admin === 'admin' || p.admin === 'superadmin'));
                    
                    if (!senderIsAdmin && !isOwner) {
                        return await sock.sendMessage(remoteJid, { text: '❌ Este comando solo puede ser ejecutado por administradores del grupo.' }, { quoted: m });
                    }
                }

                await commandToExecute.execute(sock, m, args, { prefix, db, saveDB, isOwner, owners });
            } else {
                await sock.sendMessage(remoteJid, { text: `❌ El comando *"${commandName}"* no existe.\nUsa *${prefix}menu* para ver la lista de comandos disponibles.` }, { quoted: m });
            }
        } catch (error) {
            console.error(error);
        }

        const time = new Date().toLocaleString('es-CR', { timeZone: 'America/Costa_Rica' });
        const groupName = m.key.remoteJid.endsWith('@g.us') ? 'Chat Grupal' : 'Chat Privado';
        const pushName = m.pushName || 'Usuario Desconocido';

        console.log(chalk.blue.bold('╭─────────────────────────'));
        console.log(`${chalk.cyan('Bot:')} ${sock.user.id.split(':')[0]}`);
        console.log(`${chalk.yellow('Fecha:')} ${time}`);
        console.log(`${chalk.blue('Usuario:')} ${pushName}`);
        console.log(`${chalk.magenta('Remitente:')} ${sender.split('@')[0]}`);
        console.log(`${chalk.green('Grupo:')} ${groupName}`);
        console.log(`${chalk.white('ID:')} ${remoteJid}`);
        console.log(`${chalk.cyan.bold('Comando usado:')} ${chalk.bgWhite.black(' ' + commandName + ' ')}`);
        console.log(chalk.blue.bold('╰─────────────────────────\n'));
    }
);
}

connectToWhatsApp();