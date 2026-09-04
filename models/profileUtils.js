import { resolveLidToRealJid, resolveToLid } from "./utils.js";
import { getGroupUser } from "./groupDb.js";
import formatter from "../controllers/functions/formatNumbers.js";
import { fytBold } from "./TextStyle.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

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

/**
 * Resuelve el jid objetivo (mencionado, o el remitente si no hay mención)
 * SIEMPRE a LID. Esta es la única identidad que usamos para leer/guardar
 * datos de usuario (matrimonio, xp, genero, cumpleaños, etc).
 *
 * IMPORTANTE: ya no devuelve el jid real (@s.whatsapp.net) — si necesitas
 * el número real para llamadas a la API de WhatsApp (foto de perfil,
 * contacto), conviértelo aparte con resolveLidToRealJid().
 */
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

  const raw = targetJid || fallbackJid;
  return resolveToLid(raw, socket, remoteJid);
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

// profileUtils.js - formatProfileText CON LOGS
// profileUtils.js - formatProfileText CORREGIDO
// profileUtils.js - formatProfileText SOLO TEXTO
export function formatProfileText(user, pushName, displayJid) {
  console.log('📝 [formatProfileText] Datos recibidos:', {
    jid: displayJid,
    genre: user.genre,
    birthday: user.birthday,
    marriedTo: user.marriedTo,
    xp: user.xp,
    level: user.level
  });

  const coins = user.coins || 0;
  const bank = user.bank || 0;
  const xp = user.xp || 0;
  const level = user.level || calculateLevel(xp);
  const yearsOld = user.birthday ? calculateAge(user.birthday) : null;
  const genre = user.genre ? (GENRES[user.genre] || user.genre) : "No definido";
  const birthday = user.birthday || "No definido";

  // ✅ Mostrar pareja
  let marriedText = "Soltero/a";
  if (user.marriedTo) {
    const marriedJid = jidNormalizedUser(user.marriedTo);
    const marriedNumber = marriedJid.split("@")[0];
    marriedText = `@${marriedNumber}`;
  }

  const phoneNumber = displayJid.split("@")[0];
  
  let text = `╭〔 👤 𝐏𝐄𝐑𝐅𝐈𝐋 〕⬣\n`;
  text += `┃ 📋 𝐃𝐀𝐓𝐎𝐒 𝐃𝐄 𝐔𝐒𝐔𝐀𝐑𝐈𝐎\n`;
  text += `╰━━━━━━━━━━━━⬣\n\n`;
  text += `┃ 👤 ${fytBold("Usuario")} › @${phoneNumber}\n`;
  text += `┃ 🆔 ${fytBold("ID")} › ${phoneNumber}\n\n`;

  text += `┃ ⚧️ ${fytBold("Género")} › ${genre}\n`;
  text += `┃ 🎂 ${fytBold("Cumpleaños")} › ${birthday}\n`;
  text += `┃ 🎈 ${fytBold("Edad")} › ${yearsOld !== null ? yearsOld : "Indefinido"}\n\n`;
  text += `┃ 💍 ${fytBold("Pareja")} › ${marriedText}\n`;
  text += `┃ 📊 ${fytBold("Nivel")} › ${level}\n`;
  text += `┃ ✨ ${fytBold("XP")} › ${formatter(xp)}\n`;
  text += `┃ 💵 ${fytBold("Cartera")} › ₡${formatter(coins)}\n`;
  text += `┃ 🏦 ${fytBold("Banco")} › ₡${formatter(bank)}\n\n`;
  text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;
  
  // ✅ RETORNAR SOLO TEXTO
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
 * Obtiene (o crea) el usuario global, usando SIEMPRE `jid` (debe ser LID)
 * como clave canónica.
 *
 * @param {string} legacyJid - Opcional. Si el usuario tenía datos guardados
 *   con una clave vieja (jid real, de antes de unificar a LID), pásala aquí
 *   para migrar automáticamente esos datos a la clave LID la primera vez
 *   que se lean. Así nadie pierde su matrimonio/xp/etc ya guardado.
 */
// profileUtils.js - VERSIÓN CORREGIDA
export function getProfileUser(db, remoteJid, jid, legacyJid = null) {
  // 1. Economía local (por grupo)
  let localEconomy = getGroupUser(db, remoteJid, jid, { coins: 0, bank: 0 });
  
  // 2. Datos globales
  if (!db.users) db.users = {};
  
  // Migración suave: mover datos de clave vieja a nueva
  if (
    legacyJid &&
    legacyJid !== jid &&
    !db.users[jid] &&
    db.users[legacyJid]
  ) {
    db.users[jid] = db.users[legacyJid];
    delete db.users[legacyJid];
  }
  
  // ✅ FORZAR RECARGA DEL CACHE si el usuario existe
  // Esto asegura que siempre tengamos los datos más recientes
  let globalUser = db.users[jid];
  
  // Si no existe, crearlo
  if (!globalUser) {
    globalUser = {
      xp: 0,
      level: 1,
      genre: null,
      birthday: null,
      marriedTo: null,
    };
    db.users[jid] = globalUser;
  }
  
  // 3. Retornar objeto con getters/setters
  return {
    // Economía (local por grupo)
    get coins() { return localEconomy.coins || 0; },
    set coins(val) { localEconomy.coins = val; },
    
    get bank() { return localEconomy.bank || 0; },
    set bank(val) { localEconomy.bank = val; },
    
    // Perfil (global) - AHORA SIEMPRE LEE DE db.users DIRECTAMENTE
    get xp() {
      const user = db.users[jid];
      return user?.xp || 0;
    },
    set xp(val) {
      if (!db.users[jid]) db.users[jid] = {};
      db.users[jid].xp = val;
    },
    
    get level() {
      const user = db.users[jid];
      return user?.level || calculateLevel(user?.xp || 0);
    },
    set level(val) {
      if (!db.users[jid]) db.users[jid] = {};
      db.users[jid].level = val;
    },
    
    get genre() {
      const user = db.users[jid];
      return user?.genre || null;
    },
    set genre(val) {
      if (!db.users[jid]) db.users[jid] = {};
      db.users[jid].genre = val;
    },
    
    get birthday() {
      const user = db.users[jid];
      return user?.birthday || null;
    },
    set birthday(val) {
      if (!db.users[jid]) db.users[jid] = {};
      db.users[jid].birthday = val;
    },
    
    get marriedTo() {
      const user = db.users[jid];
      return user?.marriedTo || null;
    },
    set marriedTo(val) {
      if (!db.users[jid]) db.users[jid] = {};
      db.users[jid].marriedTo = val;
    },
    
    // Referencias internas
    _localEconomy: localEconomy,
    _globalUser: db.users[jid],
    _jid: jid,
  };
}