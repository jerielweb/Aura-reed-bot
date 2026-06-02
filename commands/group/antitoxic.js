import fs from 'fs';

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
        if (!remoteJid.endsWith('@g.us')) return;

        if (!db.groups[remoteJid]) {
            db.groups[remoteJid] = { antilink: false, warnLimit: 3, warns: {}, activity: {}, onlyAdmin: false, antitoxic: false, botOn: true };
        }

        const status = args[0]?.toLowerCase();

        if (status === 'on' || status === '1' || status === 'true' || status === 'activar' || status === 'enable') {
            db.groups[remoteJid].antitoxic = true;
            saveDB(db);
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
            let text = `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ 🛡️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈𝐓𝐎𝐗𝐈𝐂\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > El sistema Antitoxic ha\n`;
            text += `┃ > sido desactivado con éxito.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else {
            const currentStatus = db.groups[remoteJid]?.antitoxic ? '✅ Activado' : '❌ Desactivado';
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
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }
    },

    middleware: async (socket, m, { db, saveDB, isAdmin, isBotAdmin, text }) => {
        const remoteJid = m.key.remoteJid;
        if (!remoteJid.endsWith('@g.us') || !db.groups[remoteJid]?.antitoxic) return;
        if (isAdmin || !isBotAdmin) return;

        const normalizedText = normalizeText(text);
        const reversedText = normalizedText.split('').reverse().join('');
        const noVowelsText = normalizeText(text, true);

        for (const level of Object.values(badWordsData.levels)) {
            for (const wordObj of level.normalizedWords) {
                // 1. Verificación normal
                if (normalizedText.includes(wordObj.full) || reversedText.includes(wordObj.full)) {
                    // Evitar falsos positivos: si la palabra prohibida es muy corta, debe ser casi el mensaje completo
                    if (wordObj.full.length <= 3 && normalizedText.length > wordObj.full.length + 2) continue;
                    
                    console.log(`[ANTITOXIC] Detectado: "${wordObj.full}" en "${text}" (Nivel: ${level.reason})`);
                    await handleToxic(socket, m, level, db, saveDB);
                    return;
                }
                // 2. Verificación sin vocales
                if (wordObj.noVowels.length >= 3 && noVowelsText.includes(wordObj.noVowels)) {
                    // Evitar falsos positivos en siglas
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
        await socket.sendMessage(remoteJid, { 
            text: `╭〔 🚨 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⛔ 𝐔𝐒𝐔𝐀𝐑𝐈𝐎 𝐄𝐗𝐏𝐔𝐋𝐒𝐀𝐃𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ > @${user.split('@')[0]} ha sido expulsado\n┃ > por: ${reason}.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
            mentions: [user]
        });
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
            await socket.sendMessage(remoteJid, { 
                text: `╭〔 🚨 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⛔ 𝐔𝐒𝐔𝐀𝐑𝐈𝐎 𝐄𝐗𝐏𝐔𝐋𝐒𝐀𝐃𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ > @${user.split('@')[0]} ha alcanzado el\n┃ > límite de advertencias (${limit})\n┃ > por toxicidad.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
                mentions: [user]
            });
            await socket.groupParticipantsUpdate(remoteJid, [user], "remove");
            db.groups[remoteJid].warns[user] = [];
            saveDB(db);
        } else {
            const botJid = socket.user.id.split(':')[0] + '@s.whatsapp.net';
            await socket.sendMessage(remoteJid, { 
                text: `╭━━〔 ⚠️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈𝐓𝐎𝐗𝐈𝐂 ⚠️ 〕━━⬣\n\n┃ 👤 𝐔𝐬𝐮𝐚𝐫𝐢𝐨: @${user.split('@')[0]}\n┃ 🛡️ 𝐀𝐝𝐦𝐢𝐧: 𝐒𝐘𝐒𝐓𝐄𝐌 ⚡\n┃ 📌 𝐀𝐜𝐜𝐢𝐨́𝐧: 𝐀𝐝𝐯𝐞𝐫𝐭𝐞𝐧𝐜𝐢𝐚 𝐚𝐠𝐫𝐞𝐠𝐚𝐝𝐚\n┃ 📊 𝐖𝐚𝐫𝐧𝐬: [ ${count}/${limit} ]\n┃ 📝 𝐑𝐚𝐳𝐨́𝐧: ${reason}\n┃ ⏰ 𝐅𝐞𝐜𝐡𝐚: ${date}\n\n┣━━━━━━━━━━━━━━━━⬣\n┃ ⚠️ 𝐒𝐞 𝐡𝐚 𝐚𝐧̃𝐚𝐝𝐢𝐝𝐨 𝐮𝐧𝐚\n┃ ⚠️ 𝐚𝐝𝐯𝐞𝐫𝐭𝐞𝐧𝐜𝐢𝐚 𝐚𝐥 𝐮𝐬𝐮𝐚𝐫𝐢𝐨.\n┣━━━━━━━━━━━━━━━━⬣\n\n┃ ❗ 𝐀𝐥 𝐥𝐥𝐞𝐠𝐚𝐫 𝐚𝐥 𝐥𝐢́𝐦𝐢𝐭𝐞\n┃ ❗ 𝐬𝐞𝐫𝐚́ 𝐞𝐱𝐩𝐮𝐥𝐬𝐚𝐝𝐨.\n╰━━〔 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 𝐒𝐘𝐒𝐓𝐄𝐌 〕━━⬣`,
                mentions: [user, botJid]
            });
        }
    }
}
