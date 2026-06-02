import { fytBold } from "../../models/TextStyle.js";
import { errorMessage, warningMessage } from '../../models/messageTemplates.js';

// ==========================================
// 1. GESTOR DE ESTADOS PARA MSGHANDLER.JS
// ==========================================
export const botStatus = {
    isGroupActive(remoteJid, db) {
        if (!remoteJid.endsWith('@g.us')) return true;
        if (!db.groups) db.groups = {};
        if (db.groups[remoteJid]?.botOn === false) return false;
        return true;
    },
    groupOn(remoteJid, db, saveDB) {
        if (!db.groups) db.groups = {};
        if (!db.groups[remoteJid]) db.groups[remoteJid] = {};
        db.groups[remoteJid].botOn = true;
        saveDB(db);
    },
    groupOff(remoteJid, db, saveDB) {
        if (!db.groups) db.groups = {};
        if (!db.groups[remoteJid]) db.groups[remoteJid] = {};
        db.groups[remoteJid].botOn = false;
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
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('ACCION INCONPATIBLE')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Este comando solo funciona en grupos.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

            return await sock.sendMessage(remoteJid, { text }, { quoted: m });
        }

        if (!isOwner && !isAdmin) {
            return await sock.sendMessage(remoteJid, { text: errorMessage('PERMISO DENEGADO', 'Solo los administradores del grupo o el Owner pueden modificar el estado del bot.') }, { quoted: m });
        }

        if (!accion) {
            const estado = db.groups?.[remoteJid]?.botOn === false ? 'Desactivado' : 'Activado';

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ⚡${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('ESTADO DEL BOT')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > El bot está actualmente: *${estado}*\n`;
            text += `┃ > Para cambiar el estado, usa:\n`;
            text += `┃ > *${prefix}bot on* (Para activar)\n`;
            text += `┃ > *${prefix}bot off* (Para desactivar)\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM INFO')} 〕⬣`;

            // Enviar mensaje de información
            return await sock.sendMessage(remoteJid, { text }, { quoted: m });
        }

        // Manejo de la acción "on"
        if (accion === 'on' || accion === 'activar' || accion === 'enable' || accion === '1' || accion === 'true') {
            botStatus.groupOn(remoteJid, db, saveDB);

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ✅ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('BOT ACTIVADO')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > El bot ha sido reactivado para este grupo.\n`;
            text += `┃ > ¡Hola de nuevo! Ya pueden usar mis comandos.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ACTIVE')} 〕⬣`;

            // Enviar mensaje de éxito
            return await sock.sendMessage(remoteJid, { text }, { quoted: m });
        }

        // Manejo de la acción "off"
        if (accion === 'off' || accion === 'desactivar' || accion === 'disable' || accion === '0' || accion === 'false') {
            botStatus.groupOff(remoteJid, db, saveDB);

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 💤 ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ 🔇 ${fytBold('BOT DESACTIVADO')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > El bot ha sido apagado para este grupo.\n`;
            text += `┃ > Solo responderé a las solicitudes de re-activación.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM SLEEP')} 〕⬣`;


            return await sock.sendMessage(remoteJid, { text }, { quoted: m });
        }

        // Si no pusieron ni on ni off
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('PARÁMETRO INVÁLIDO')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Parámetros válidos:\n`;
            text += `┃ > *${prefix}bot on* (Para encender)\n`;
            text += `┃ > *${prefix}bot off* (Para apagar)\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

        await sock.sendMessage(remoteJid, { text }, { quoted: m });
    }
};