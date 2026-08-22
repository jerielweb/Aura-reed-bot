import Database from "better-sqlite3";
import NodeCache from "node-cache";
import path from "path";
import fs from "fs";
import chalk from "chalk";
import { getDBSync } from "./db.js";
import { LRUCache } from "lru-cache";

const DATABASE_DIR = path.resolve("./database");
const subBotInstances = new Map();

export const groupMetadataCache = new LRUCache({
  ttl: 30 * 60 * 1000,
  max: 500,
});

export async function getSubBotDB(senderId) {
  if (subBotInstances.has(senderId)) {
    return subBotInstances.get(senderId).db;
  }

  const sqlitePath = path.join(DATABASE_DIR, `db_subbot_${senderId}.sqlite3`);
  if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
  }

  const conn = new Database(sqlitePath);
  conn.exec(`
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS groups (
            jid TEXT PRIMARY KEY,
            data TEXT
        );
    `);

  const groupsCache = new NodeCache({ stdTTL: 600, useClones: false });

  groupsCache.on("expired", (key, value) => {
    try {
      conn.prepare(
        "INSERT INTO groups(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data"
      ).run(key, JSON.stringify(value));
    } catch (err) {
      console.error(chalk.red(`[SubBot DB ${senderId}] Error al guardar grupo expirado ${key}:`), err.message);
    }
  });

  const groupsProxy = new Proxy({}, {
    get(target, key) {
      if (typeof key !== "string" || key === "toJSON" || key === "then") return target[key];
      let group = groupsCache.get(key);
      if (!group) {
        try {
          const row = conn.prepare("SELECT data FROM groups WHERE jid = ?").get(key);
          if (row) {
            group = JSON.parse(row.data);
            groupsCache.set(key, group);
          }
        } catch (err) {
          console.error(chalk.red(`[SubBot DB ${senderId}] Error cargando grupo ${key}:`), err.message);
        }
      }
      return group;
    },
    set(target, key, value) {
      if (typeof key === "string") groupsCache.set(key, value);
      return true;
    },
    deleteProperty(target, key) {
      if (typeof key === "string") {
        groupsCache.del(key);
        try { conn.prepare("DELETE FROM groups WHERE jid = ?").run(key); } catch {}
      }
      return true;
    }
  });

  let mainDb = {};
  try { mainDb = getDBSync(); } catch (e) {}

  const defaults = [
    ["prefix", mainDb.prefix || "."],
    ["owners", mainDb.owners || [`${senderId}@s.whatsapp.net`]],
    ["ownerRoles", mainDb.ownerRoles || {}],
    ["maxSubBots", 0],
    ["botName", "Aura Reed"],
    ["customBanner", null],
  ];

  const stmtSelect = conn.prepare("SELECT key FROM config WHERE key = ?");
  const stmtInsert = conn.prepare("INSERT INTO config(key, value) VALUES(?, ?)");

  for (const [key, defaultValue] of defaults) {
    if (!stmtSelect.get(key)) {
      stmtInsert.run(key, JSON.stringify(defaultValue));
    }
  }

  const configRows = conn.prepare("SELECT key, value FROM config").all();
  const dbData = {};
  for (const row of configRows) {
    try { dbData[row.key] = JSON.parse(row.value); } catch { dbData[row.key] = row.value; }
  }

  const db = {
    prefix: dbData.prefix ?? ".",
    owners: dbData.owners || [`${senderId}@s.whatsapp.net`],
    ownerRoles: dbData.ownerRoles || {},
    maxSubBots: dbData.maxSubBots ?? 0,
    botName: dbData.botName ?? "Aura Reed",
    customBanner: dbData.customBanner ?? null,
    groups: groupsProxy,
    get users() {
      // Los perfiles globales (XP, nivel, casados) vienen de la BD principal
      return getDBSync().users;
    }
  };

  subBotInstances.set(senderId, {
    conn,
    db,
    groupsCache,
    groupsProxy,
    saveTimer: null,
    saving: false,
  });

  return db;
}

export function saveSubBotDB(senderId) {
  const instance = subBotInstances.get(senderId);
  if (!instance || !instance.groupsCache) return;

  const keys = instance.groupsCache.keys();
  for (const key of keys) {
    const value = instance.groupsCache.get(key);
    if (value !== undefined) {
      try {
        instance.conn.prepare(
          "INSERT INTO groups(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data"
        ).run(key, JSON.stringify(value));
      } catch (err) {
        console.error(chalk.red(`[SubBot DB ${senderId}] Error al guardar grupo ${key}:`), err.message);
      }
    }
  }
}
