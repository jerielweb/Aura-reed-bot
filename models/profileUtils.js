// profileUtils.js
import { resolveLidToRealJid, resolveToLid } from "./utils.js";
import formatter from "../controllers/functions/formatNumbers.js";
import { fytBold } from "./TextStyle.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { getGroupUser } from "./groupDb.js";

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
  const description = user.description || "Sin descripción";

  let marriedText = "Soltero/a";
  let marriedLid = null;

  if (user.marriedTo) {
    const marriedNumber = user.marriedTo.split("@")[0];
    marriedText = `@${marriedNumber}`;
    marriedLid = user.marriedTo;
  }

  const phoneNumber = jid.split("@")[0];
  const displayName = user.name || "Sin nombre";

  let text = `╭〔 👤 𝐏𝐄𝐑𝐅𝐈𝐋 〕⬣\n`;
  text += `┃ 📋 ${fytBold("SOBRE")} @${phoneNumber}\n`;
  text += `╰━━━━━━━━━━━━⬣\n\n`;
  text += `┏━━〔 ${fytBold("BIOGRAFIA")} 〕━━⬣\n`;
  text += `┃ ${description}\n`;
  text += `┗━━━━━━━━━━━━⬣\n\n`;
  text += `┏━━〔 ${fytBold("INFO BASICA")} 〕━━⬣\n`;
  text += `┃ 👤 ${fytBold("Nombre")} › ${displayName}\n`;
  text += `┃ 🆔 ${fytBold("ID")} › WB${phoneNumber}\n`;
  text += `┃ ⚧️ ${fytBold("Género")} › ${genre}\n`;
  text += `┃ 🎂 ${fytBold("Cumpleaños")} › ${birthday}\n`;
  text += `┃ 🎈 ${fytBold("Edad")} › ${yearsOld !== null ? yearsOld : "Indefinido"}\n`;
  text += `┃ 💍 ${fytBold("Pareja")} › ${marriedText}\n`;
  text += `┗━━━━━━━━━━━━⬣\n\n`;
  text += `┏━━〔 ${fytBold("RANGO")} 〕━━⬣\n`;
  text += `┃ 📊 ${fytBold("Nivel")} › ${level}\n`;
  text += `┃ ✨ ${fytBold("XP")} › ${formatter(xp)}\n`;
  text += `┃ 💵 ${fytBold("Cartera")} › ₡${formatter(coins)}\n`;
  text += `┃ 🏦 ${fytBold("Banco")} › ₡${formatter(bank)}\n\n`;
  text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

  return { text, marriedLid };
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

export function getProfileUser(db, remoteJid, jid) {
  const key = jidNormalizedUser(jid);

  if (!db.users) db.users = {};
  if (!db.users[key]) {
    db.users[key] = {
      xp: 0,
      level: 1,
      genre: null,
      birthday: null,
      description: null,
      name: null,
      marriedTo: null,
    };
  }

  const global = db.users[key];

  const local = getGroupUser(db, remoteJid, key);

  return {
    get xp() {
      return global.xp || 0;
    },
    set xp(v) {
      global.xp = v;
    },

    get level() {
      return global.level || calculateLevel(global.xp || 0);
    },
    set level(v) {
      global.level = v;
    },

    get genre() {
      return global.genre || null;
    },
    set genre(v) {
      global.genre = v;
    },

    get birthday() {
      return global.birthday || null;
    },
    set birthday(v) {
      global.birthday = v;
    },

    get description() {
      return global.description || null;
    },
    set description(v) {
      global.description = v;
    },

    get name() {
      return global.name || null;
    },
    set name(v) {
      global.name = v;
    },

    get marriedTo() {
      return global.marriedTo || null;
    },
    set marriedTo(v) {
      global.marriedTo = v;
    },

    get coins() {
      return local.coins || 0;
    },
    set coins(v) {
      local.coins = v;
    },

    get bank() {
      return local.bank || 0;
    },
    set bank(v) {
      local.bank = v;
    },

    _global: global,
    _local: local,
    _jid: key,
  };
}

export function migrateProfileIdentity(db, remoteJid, sourceJid, targetJid) {
  const sourceKey = sourceJid;
  const targetKey = jidNormalizedUser(targetJid);

  if (!sourceKey || !targetKey || sourceKey === targetKey) return;

  const sourceGlobal = db.users?.[sourceKey];
  let targetGlobal = db.users?.[targetKey];

  if (sourceGlobal && !targetGlobal) {
    db.users[targetKey] = sourceGlobal;
    targetGlobal = db.users[targetKey];
  }

  if (sourceGlobal && targetGlobal) {
    targetGlobal.xp = Math.max(targetGlobal.xp || 0, sourceGlobal.xp || 0);
    targetGlobal.level = calculateLevel(targetGlobal.xp);
    for (const field of [
      "genre",
      "birthday",
      "description",
      "name",
      "marriedTo",
    ]) {
      if (!targetGlobal[field] && sourceGlobal[field]) {
        targetGlobal[field] = sourceGlobal[field];
      }
    }
    delete db.users[sourceKey];
  }

  const sourceLocal = db.groups?.[remoteJid]?.users?.[sourceKey];
  let targetLocal = db.groups?.[remoteJid]?.users?.[targetKey];

  if (sourceLocal && !targetLocal) {
    db.groups[remoteJid].users[targetKey] = sourceLocal;
    targetLocal = db.groups[remoteJid].users[targetKey];
  }

  if (sourceLocal && targetLocal) {
    for (const field of ["coins", "bank"]) {
      if (!(targetLocal[field] > 0) && sourceLocal[field] > 0) {
        targetLocal[field] = sourceLocal[field];
      }
    }
    for (const [field, value] of Object.entries(sourceLocal)) {
      if (field.startsWith("last") && !(field in targetLocal)) {
        targetLocal[field] = value;
      }
    }
    delete db.groups[remoteJid].users[sourceKey];
  }
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

  const raw = targetJid || fallbackJid;
  return resolveToLid(raw, socket, remoteJid);
}
