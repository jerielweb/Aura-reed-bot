import { getDBSync } from "./db.js";

export const DEFAULT_GROUP = {
  antilink: false,
  warnLimit: 3,
  warns: {},
  activity: {},
  onlyAdmin: false,
  antitoxic: false,
  welcome: false,
  disabledCategories: ["nsfw"],
  botOn: true,
  prefix: null,
  users: {}, // Aquí vivirá únicamente la economía local por grupo
};

// Solo la economía se aísla por grupo
const ECONOMY_FIELDS = new Set([
  "coins",
  "bank",
  "lastWork",
  "lastDaily",
  "lastWeekly",
  "lastMonthly",
  "lastCrime",
  "lastSlut",
  "lastHunt",
  "lastMine",
  "lastPpt",
  "lastSteal",
  "lastAdventure",
]);

/** Limpia campos de economía viejos del almacén global de usuarios si llegasen a existir. */
export function stripEconomyFromUsers(users = {}) {
  const cleaned = {};
  for (const [jid, data] of Object.entries(users)) {
    if (!data || typeof data !== "object") continue;
    const globalData = {};
    for (const [key, value] of Object.entries(data)) {
      if (!ECONOMY_FIELDS.has(key)) globalData[key] = value;
    }
    if (Object.keys(globalData).length > 0) cleaned[jid] = globalData;
  }
  return cleaned;
}

export function ensureGroup(db, remoteJid) {
  if (!db.groups) db.groups = {};
  if (!db.groups[remoteJid]) {
    db.groups[remoteJid] = {
      ...DEFAULT_GROUP,
      warns: {},
      activity: {},
      users: {},
    };
  } else {
    if (!db.groups[remoteJid].activity) db.groups[remoteJid].activity = {};
    if (!db.groups[remoteJid].users) db.groups[remoteJid].users = {};
    if (!db.groups[remoteJid].warns) db.groups[remoteJid].warns = {};
  }
  return db.groups[remoteJid];
}

export function getGroupUsers(db, remoteJid) {
  return ensureGroup(db, remoteJid).users;
}

// Obtiene o inicializa la economía local del usuario en este grupo específico
export function getGroupUser(
  db,
  remoteJid,
  jid,
  defaults = { coins: 0, bank: 0 },
) {
  const users = getGroupUsers(db, remoteJid);
  if (!users[jid]) users[jid] = { ...defaults };
  return users[jid];
}

/** Registra un mensaje del usuario en la actividad del grupo y otorga XP global. */
export function trackGroupActivity(db, remoteJid, jid) {
  if (!remoteJid?.endsWith("@g.us") || !jid?.endsWith("@s.whatsapp.net"))
    return false;

  const group = ensureGroup(db, remoteJid);
  const monthKey = new Date().toISOString().slice(0, 7);

  if (
    !group.activity[monthKey] ||
    typeof group.activity[monthKey] !== "object"
  ) {
    group.activity[monthKey] = {};
  }

  const monthly = group.activity[monthKey];
  monthly[jid] = (monthly[jid] || 0) + 1;

  // El XP y nivel se suman en la base de datos GLOBAL para que apliquen en todos lados
  const globalDb = getDBSync();
  if (!globalDb.users) globalDb.users = {};
  if (!globalDb.users[jid]) {
    globalDb.users[jid] = { xp: 0, level: 1 };
  }
  
  const user = globalDb.users[jid];
  user.xp = (user.xp || 0) + 1;
  user.level = Math.floor(user.xp / 150) + 1;

  return true;
}
