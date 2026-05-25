import { fytBold } from "../../models/TextStyle.js";

// ==========================================
// 1. GESTOR DE ESTADOS PARA MSGHANDLER.JS
// ==========================================
export const botStatus = {
    isGroupActive(remoteJid, db) {
        if (!remoteJid.endsWith('@g.us')) return true; 
        if (!db.chats) db.chats = {};
        if (db.chats[remoteJid]?.botOn === false) return false;
        return true;
    },
    groupOn(remoteJid, db, saveDB) {
        if (!db.chats) db.chats = {};
        if (!db.chats[remoteJid]) db.chats[remoteJid] = {};
        db.chats[remoteJid].botOn = true;
        saveDB(db);
    },
    groupOff(remoteJid, db, saveDB) {
        if (!db.chats) db.chats = {};
        if (!db.chats[remoteJid]) db.chats[remoteJid] = {};
        db.chats[remoteJid].botOn = false;
        saveDB(db);
    }
};

// ==========================================
// 2. COMANDO UNIFICADO ('bot')
// ==========================================
export default {
    name: ['bot'],
    category: 'group',
    description: 'Enciende o apaga el bot en el grupo actual usando "on" u "off".',
    async execute(sock, m, args, { prefix, db, saveDB, isOwner, isAdmin }) {
        const remoteJid = m.key.remoteJid;
        const isGroup = remoteJid.endsWith('@g.us');
        const accion = args[0]?.toLowerCase();

        if (!isGroup) {
            return await sock.sendMessage(remoteJid, { text: '⚠️ Este comando solo puede ser utilizado dentro de grupos.' }, { quoted: m });
        }

        if (!isOwner && !isAdmin) {
            return await sock.sendMessage(remoteJid, { text: '❌ Solo los administradores del grupo o el Owner pueden modificar el estado del bot.' }, { quoted: m });
        }

        if (!accion) {
            const estado = db.chats?.[remoteJid]?.botOn === false ? 'Desactivado' : 'Activado';
            return await sock.sendMessage(remoteJid, {
                text: `╭〔 ⚡ 𝐄𝐒𝐓𝐀𝐃𝐎 𝐃𝐄𝐋 𝐁𝐎𝐓 〕⬣\n┃ Estado: *${estado}*\n┃\n┃ Para activar: *${prefix}bot on*\n┃ Para desactivar: *${prefix}bot off*\n╰━━━━━━━━━━━━⬣`
            }, { quoted: m });
        }

        // Manejo de la acción "on"
        if (accion === 'on') {
            botStatus.groupOn(remoteJid, db, saveDB);
            return await sock.sendMessage(remoteJid, {
                text: `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ✨ 𝐁𝐎𝐓 𝐀𝐂𝐓𝐈𝐕𝐀𝐃𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ > Sistema reactivado con exito\n┃ > ¡Hola de nuevo! Ya pueden usar mis comandos.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕⬣`
            }, { quoted: m });
        }

        // Manejo de la acción "off"
        if (accion === 'off') {
            botStatus.groupOff(remoteJid, db, saveDB);
            return await sock.sendMessage(remoteJid, {
                text: `╭〔 💤 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ 🔇 𝐁𝐎𝐓 𝐃𝐄𝐒𝐀𝐂𝐓𝐈𝐕𝐀𝐃𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ > El bot ha sido apagado para este grupo.\n┃ > Responderé únicamente a las solicitudes de re-activación.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐒𝐋𝐄𝐄𝐏 〕⬣`
            }, { quoted: m });
        }

        // Si no pusieron ni on ni off
        await sock.sendMessage(remoteJid, {
            text: `⚠️ Uso incorrecto. Parámetros válidos:\n> *${prefix}bot on* (Para encender)\n> *${prefix}bot off* (Para apagar)`
        }, { quoted: m });
    }
};