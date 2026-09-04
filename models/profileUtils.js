import { resolveLidToRealJid } from "./utils.js";
import { getGroupUser } from "./groupDb.js";
import formatter from "../controllers/functions/formatNumbers.js";
import { fytBold } from "./TextStyle.js";

export const GENRES = {
  hombre: "Hombre",
  mujer: "Mujer",
  otro: "Otro",
  nb: "No binario",
  nobinario: "No binario",
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

export async function resolveTargetJid(
  message,
  socket,
  remoteJid,
  fallbackJid,
) {
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
  const normalized = input.replace(/-/g, "/").trim();
  const parts = normalized.split("/").map((p) => p.trim());

  if (parts.length < 2 || parts.length > 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);
  const year = parts[2] !== undefined ? parseInt(parts[2], 10) : null;

  if (
    isNaN(day) ||
    isNaN(month) ||
    day < 1 ||
    day > 31 ||
    month < 1 ||
    month > 12
  )
    return null;
  if (
    parts[2] !== undefined &&
    (isNaN(year) || year < 1900 || year > new Date().getFullYear())
  )
    return null;

  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  return year ? `${dd}/${mm}/${year}` : `${dd}/${mm}`;
}

export function calculateAge(birthdayStr) {
  if (!birthdayStr) return null;
  const parts = birthdayStr.split("/");
  if (parts.length < 3) return null;

  const day = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const year = parseInt(parts[2], 10);

  const today = new Date();
  let age = today.getFullYear() - year;
  const m = today.getMonth() - month;

  if (m < 0 || (m === 0 && today.getDate() < day)) {
    age--;
  }

  return age >= 0 ? age : null;
}

export function formatProfileText(user, pushName, jid) {
  const coins = user.coins || 0;
  const bank = user.bank || 0;
  const xp = user.xp || 0;
  const level = user.level || calculateLevel(xp);
  const yearsOld = calculateAge(user.birthday);
  const genre = user.genre ? GENRES[user.genre] || user.genre : "No definido";
  const birthday = user.birthday || "No definido";
  const married = users.marriedTo
    ? `@${user.marriedTo.split("@")[0]}`
    : "Soltero/a";

  let text = `╭〔 👤 𝐏𝐄𝐑𝐅𝐈𝐋 〕⬣\n`;
  text += `┃ 📋 𝐃𝐀𝐓𝐎𝐒 𝐃𝐄 𝐔𝐒𝐔𝐀𝐑𝐈𝐎\n`;
  text += `╰━━━━━━━━━━━━⬣\n\n`;
  text += `┃ 👤 ${fytBold("Nombre")} › *${`@${pushName}` || "Usuario"}*\n`;
  text += `┃ 🆔 ${fytBold("ID")} › ${jid.split("@")[0]}\n\n`;
  text += `┃ ⚧️ ${fytBold("Género")} › ${genre}\n`;
  text += `┃ 🎂 ${fytBold("Cumpleaños")} › ${birthday}\n`;
  text += `┃ 🎈 ${fytBold("Edad")} › ${yearsOld !== null ? yearsOld : "Indefinido"}\n\n`;
  text += `┃ 💍 ${fytBold("Pareja")} › ${married}\n`;
  text += `┃ 📊 ${fytBold("Nivel")} › ${level}\n`;
  text += `┃ ✨ ${fytBold("XP")} › ${formatter(xp)}\n`;
  text += `┃ 💵 ${fytBold("Cartera")} › ₡${formatter(coins)}\n`;
  text += `┃ 🏦 ${fytBold("Banco")} › ₡${formatter(bank)}\n\n`;
  text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;
  return text;
}

export const DEFAULT_PFP =
  "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";

export async function getProfilePictureUrl(socket, jid) {
  try {
    return await socket.profilePictureUrl(jid, "image");
  } catch {
    return DEFAULT_PFP;
  }
}

/**
 * Obtiene de manera híbrida la economía local por grupo (usando getGroupUser)
 * y unifica el perfil social de forma 100% global.
 * 
 * ⚡ IMPORTANTE: Ahora usa el parámetro 'db' directamente en lugar de getDBSync()
 * para garantizar que todos los cambios se guarden correctamente.
 */
export function getProfileUser(db, remoteJid, jid) {
  // 1. Economía local sincronizada exactamente con los comandos de economía y wallet
  let localEconomy = getGroupUser(db, remoteJid, jid, { coins: 0, bank: 0 });

  // 2. Perfil social global (obtenido desde el parámetro db directamente)
  if (!db.users) db.users = {};
  if (!db.users[jid]) {
    db.users[jid] = {
      xp: 0,
      level: 1,
      genre: null,
      birthday: null,
      marriedTo: null,
    };
  }
  let globalUser = db.users[jid];

  // 3. Retorna un objeto unificado que conecta la economía local y los datos sociales globales
  return {
    get coins() { return localEconomy.coins || 0; },
    set coins(val) { localEconomy.coins = val; },

    get bank() { return localEconomy.bank || 0; },
    set bank(val) { localEconomy.bank = val; },

    get xp() { return globalUser.xp; },
    set xp(val) { globalUser.xp = val; },

    get level() { return globalUser.level; },
    set level(val) { globalUser.level = val; },

    get genre() { return globalUser.genre; },
    set genre(val) { globalUser.genre = val; },

    get birthday() { return globalUser.birthday; },
    set birthday(val) { globalUser.birthday = val; },

    get marriedTo() { return globalUser.marriedTo; },
    set marriedTo(val) { globalUser.marriedTo = val; },

    _localEconomy: localEconomy,
    _globalUser: globalUser
  };
}
