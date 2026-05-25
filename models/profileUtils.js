import { resolveLidToRealJid } from './utils.js';
import { getGroupUser } from './groupDb.js';
import formatter from '../controllers/functions/formatNumbers.js';

export const GENRES = {
    hombre: 'Hombre',
    mujer: 'Mujer',
    otro: 'Otro',
    nb: 'No binario',
    nobinario: 'No binario'
};

export function calculateLevel(xp = 0) {
    return Math.floor(xp / 150) + 1;
}

export function xpForLevel(level) {
    return (level - 1) * 150;
}

export function xpToNextLevel(xp = 0) {
    const level = calculateLevel(xp);
    const nextThreshold = xpForLevel(level + 1);
    return Math.max(0, nextThreshold - xp);
}

export function addProfileXp(user, amount = 1) {
    user.xp = (user.xp || 0) + amount;
    user.level = calculateLevel(user.xp);
}

export async function resolveTargetJid(message, socket, remoteJid, fallbackJid) {
    let targetJid = null;
    const ctx = message.message?.extendedTextMessage?.contextInfo;

    if (ctx?.mentionedJid?.length > 0) {
        targetJid = ctx.mentionedJid[0];
    } else if (ctx?.participant) {
        targetJid = ctx.participant;
    }

    if (!targetJid) return fallbackJid;
    return resolveLidToRealJid(targetJid, socket, remoteJid);
}

export function parseBirthday(input) {
    if (!input) return null;
    const normalized = input.replace(/-/g, '/').trim();
    const parts = normalized.split('/').map(p => p.trim());

    if (parts.length < 2 || parts.length > 3) return null;

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10);
    const year = parts[2] !== undefined ? parseInt(parts[2], 10) : null;

    if (isNaN(day) || isNaN(month) || day < 1 || day > 31 || month < 1 || month > 12) return null;
    if (parts[2] !== undefined && (isNaN(year) || year < 1900 || year > new Date().getFullYear())) return null;

    const dd = String(day).padStart(2, '0');
    const mm = String(month).padStart(2, '0');
    return year ? `${dd}/${mm}/${year}` : `${dd}/${mm}`;
}

export function formatProfileText(user, pushName, jid) {
    const coins = user.coins || 0;
    const bank = user.bank || 0;
    const xp = user.xp || 0;
    const level = user.level || calculateLevel(xp);
    const genre = user.genre ? (GENRES[user.genre] || user.genre) : 'No definido';
    const birthday = user.birthday || 'No definido';
    const married = user.marriedTo
        ? `@${user.marriedTo.split('@')[0]}`
        : 'Soltero/a';

    let text = `╭〔 👤 𝐏𝐄𝐑𝐅𝐈𝐋 〕⬣\n`;
    text += `┃ 📋 𝐃𝐀𝐓𝐎𝐒 𝐃𝐄 𝐔𝐒𝐔𝐀𝐑𝐈𝐎\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ 👤 𝐍𝐨𝐦𝐛𝐫𝐞 › *${pushName || 'Usuario'}*\n`;
    text += `┃ 🆔 𝐈𝐃 › ${jid.split('@')[0]}\n\n`;
    text += `┃ ⚧️ 𝐆𝐞́𝐧𝐞𝐫𝐨 › ${genre}\n`;
    text += `┃ 🎂 𝐂𝐮𝐦𝐩𝐥𝐞𝐚𝐧̃𝐨𝐬 › ${birthday}\n`;
    text += `┃ 💍 𝐄𝐬𝐭𝐚𝐝𝐨 › ${married}\n\n`;
    text += `┃ 📊 𝐍𝐢𝐯𝐞𝐥 › ${level}\n`;
    text += `┃ ✨ 𝐗𝐏 › ${formatter(xp)}\n`;
    text += `┃ 💵 𝐂𝐚𝐫𝐭𝐞𝐫𝐚 › ₡${formatter(coins)}\n`;
    text += `┃ 🏦 𝐁𝐚𝐧𝐜𝐨 › ₡${formatter(bank)}\n\n`;
    text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;
    return text;
}

export const DEFAULT_PFP = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';

export async function getProfilePictureUrl(socket, jid) {
    try {
        return await socket.profilePictureUrl(jid, 'image');
    } catch {
        return DEFAULT_PFP;
    }
}

export function getProfileUser(db, remoteJid, jid) {
    return getGroupUser(db, remoteJid, jid, { coins: 0, bank: 0, xp: 0, level: 1 });
}
