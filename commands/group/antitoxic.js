import fs from 'fs';
import { fytBold } from '../../models/TextStyle.js';

const badWordsData = JSON.parse(fs.readFileSync('./database/badWords.json', 'utf-8'));

// Pre-normalizar palabras prohibidas para mayor velocidad
for (const level of Object.values(badWordsData.levels)) {
    level.normalizedWords = level.words.map(w => ({
        full: normalizeText(w),
        noVowels: normalizeText(w, true)
    }));
}

export default {
    name: ['antitoxic', 'antitoxicos', 'antitx'],
    category: 'group',
    description: 'Sistema anti-toxicidad.',
    adminOnly: true,

    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `┃ ${fytBold('ACCION INCONPATIBLE')} \n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Este comando solo funciona en grupos.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;

            return await socket.sendMessage(remoteJid, { text }, { quoted: message });
        };

        if (!db.groups[remoteJid]) {
            db.groups[remoteJid] = { antilink: false, warnLimit: 3, warns: {}, activity: {}, onlyAdmin: false, antitoxic: false, botOn: true };
        }

        const status = args[0]?.toLowerCase();

        if (status === 'on' || status === '1' || status === 'true' || status === 'activar' || status === 'enable') {
            db.groups[remoteJid].antitoxic = true;
            saveDB(db);

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ 🛡️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈𝐓𝐎𝐗𝐈𝐂\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > El sistema Antitoxic ha\n`;
            text += `┃ > sido activado con éxito.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else if (status === 'off' || status === '0' || status === 'false' || status === 'desactivar' || status === 'disable') {
            db.groups[remoteJid].antitoxic = false;
            saveDB(db);

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ 🛡️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈𝐓𝐎𝐗𝐈𝐂\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > El sistema Antitoxic ha\n`;
            text += `┃ > sido desactivado con éxito.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

            // Enviar mensaje de éxito
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else {
            const currentStatus = db.groups[remoteJid]?.antitoxic ? '✅ Activado' : '❌ Desactivado';

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 🛡️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ ⚙️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈𝐓𝐎𝐗𝐈𝐂\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ℹ️ Estado actual: ${currentStatus}\n\n`;
            text += `┣━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ➪ .antitoxic on\n`;
            text += `┃ ✦ Activar sistema antitoxic\n\n`;
            text += `┃ ➪ .antitoxic off\n`;
            text += `┃ ✦ Desactivar sistema antitoxic\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

            // Enviar mensaje de estado
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }
    },

    middleware: async (socket, m, { db, saveDB, isAdmin, isBotAdmin, text }) => {
        const remoteJid = m.key.remoteJid;
        if (!remoteJid.endsWith('@g.us') || !db.groups[remoteJid]?.antitoxic) return;

        // Ignorar mensajes que son comandos o que no contienen texto
        const prefix = db.groups?.[remoteJid]?.prefix || db.prefix;
        if (!text || text.startsWith(prefix)) return;

        if (isAdmin || !isBotAdmin) return;

        const normalizedText = normalizeText(text);
        const reversedText = normalizedText.split('').reverse().join('');
        const noVowelsText = normalizeText(text, true);

        for (const level of Object.values(badWordsData.levels)) {
            for (const wordObj of level.normalizedWords) {
                if (normalizedText.includes(wordObj.full) || reversedText.includes(wordObj.full)) {
                    if (wordObj.full.length <= 3 && normalizedText.length > wordObj.full.length + 2) continue;

                    console.log(`[ANTITOXIC] Detectado: "${wordObj.full}" en "${text}" (Nivel: ${level.reason})`);
                    await handleToxic(socket, m, level, db, saveDB);
                    return;
                }
                if (wordObj.noVowels.length >= 3 && noVowelsText.includes(wordObj.noVowels)) {
                    if (wordObj.noVowels.length === 3 && noVowelsText.length > 5) continue;

                    console.log(`[ANTITOXIC] Detectado Sigla: "${wordObj.noVowels}" en "${text}" (Nivel: ${level.reason})`);
                    await handleToxic(socket, m, level, db, saveDB);
                    return;
                }
            }
        }
    }
};

function normalizeText(text, removeVowels = false) {
    if (!text) return '';
    const charMap = {
        '4': 'a', '@': 'a', '3': 'e', '1': 'i', '!': 'i', '0': 'o', '7': 't', '5': 's', '$': 's', '8': 'b', '9': 'g', '|': 'l', '2': 'z'
    };
    let normalized = text.toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "") // Quitar acentos
        .split('')
        .map(char => charMap[char] || char)
        .join('')
        .replace(/h/g, '') // Quitar 'h'
        .replace(/[v]/g, 'b') // b/v
        .replace(/[zc]/g, 's') // s/z/c
        .replace(/[k]/g, 'g') // g/k
        .replace(/[^a-z0-9]/g, '') // Quitar símbolos
        .replace(/\s+/g, ''); // Quitar espacios

    if (removeVowels) {
        normalized = normalized.replace(/[aeiou]/g, '');
    }

    return normalized;
}

async function handleToxic(socket, m, level, db, saveDB) {
    const remoteJid = m.key.remoteJid;
    const user = m.key.participant || remoteJid;
    const action = level.action;
    const reason = level.reason;

    // Eliminar mensaje
    try {
        await socket.sendMessage(remoteJid, { delete: m.key });
    } catch (e) {}

    if (action === 'kick') {

        // Plantilla del mensaje para que sea más atractivo visualmente
        let text = `╭〔 🚨 ${fytBold('ANTI-TOXIC SYSTEM')} 〕⬣\n`;
        text += `┃ 👤 Usuario: @${user.split('@')[0]}\n`;
        text += `┃ 🛡️ Acción: Expulsado por mala conducta\n`;
        text += `┃ 📌 Razón: ${reason}\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ ⚠️ El usuario ha sido expulsado\n`;
        text += `┃ ⚠️ por usar lenguaje tóxico.\n\n`;
        text += `╰〔 ${fytBold('SYSTEM ACTIVE')} 〕⬣`;

        // Enviar mensaje y expulsar al usuario
        await socket.sendMessage(remoteJid, { text, mentions: [user]});
        await socket.groupParticipantsUpdate(remoteJid, [user], "remove");
    } else if (action === 'warn') {
        if (!db.groups[remoteJid].warns) db.groups[remoteJid].warns = {};
        if (!db.groups[remoteJid].warns[user]) db.groups[remoteJid].warns[user] = [];

        const date = new Date().toLocaleDateString('es-CR', { timeZone: 'America/Costa_Rica' });
        db.groups[remoteJid].warns[user].push({ reason: `Toxicidad: ${reason}`, date });
        saveDB(db);

        const limit = db.groups[remoteJid].warnLimit || 3;
        const count = db.groups[remoteJid].warns[user].length;

        if (count >= limit) {
            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 🚨 ${fytBold('ANTI-TOXIC SYSTEM')} 〕⬣`
            text += `┃ 👤 Usuario: @${user.split('@')[0]}\n`;
            text += `┃ 📊 Warns: [ ${count}/${limit} ]\n`;
            text += `┃ 🛡️ Acción: Expulsado por mala conducta\n`;
            text += `┃ ⏰ Fecha: ${date}\n\n`;
            text += `┣━━━━━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ⚠️ El usuario ha alcanzado el límite\n`;
            text += `┃ ⚠️ de advertencias por toxicidad.\n`;
            text += `┃ ⚠️ Será expulsado del grupo.\n\n`;
            text += `╰〔 ${fytBold('SYSTEM ACTIVE')} 〕⬣`;

            // Enviar mensaje y expulsar al usuario
            await socket.sendMessage(remoteJid, { text, mentions: [user]});
            await socket.groupParticipantsUpdate(remoteJid, [user], "remove");
            db.groups[remoteJid].warns[user] = [];
            saveDB(db);
        } else {
            const botJid = socket.user.id.split(':')[0] + '@s.whatsapp.net';

            // Plantilla del mensaje para que sea más atractivo visualmente
            let text = `╭〔 ⚠️ ${fytBold('ANTI-TOXIC SYSTEM')} 〕⬣\n`;
            text += `┃ 👤 Usuario: @${user.split('@')[0]}\n`;
            text += `┃ 🛡️ Admin: 𝐒𝐘𝐒𝐓𝐄𝐌 ⚡\n`;
            text += `┃ 📌 Acción: Advertencia agregada\n`;
            text += `┃ 📊 Warns: [ ${count}/${limit} ]\n`;
            text += `┃ 📝 Razón: ${reason}\n`;
            text += `┃ ⏰ Fecha: ${date}\n\n`;
            text += `┣━━━━━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ⚠️ Se ha añadido una\n`;
            text += `┃ ⚠️ advertencia al usuario.\n`;
            text += `┣━━━━━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ❗ Al llegar al límite\n`;
            text += `┃ ❗ será expulsado.\n\n`;
            text += `╰〔 ${fytBold('SYSTEM ACTIVE')} 〕⬣`;

            // Enviar mensaje de advertencia
            await socket.sendMessage(remoteJid, { text, mentions: [user, botJid]});
        }
    }
}
