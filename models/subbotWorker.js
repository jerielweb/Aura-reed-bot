import Database from "better-sqlite3";
import NodeCache from "node-cache";
import path from "path";
import fs from "fs";
import chalk from "chalk";
import { getDBSync } from "./db.js";
import { LRUCache } from "lru-cache";

const DATABASE_DIR = path.resolve("./database");

const subBotInstances = new Map();

// ============================================================
// CACHE GLOBAL DE METADATA
// ============================================================

export const groupMetadataCache = new LRUCache({
  ttl: 30 * 60 * 1000,
  max: 500,
});

// ============================================================
// CACHE DE METADATA
// ============================================================

export function wrapGroupMetadataCache(cache) {
  return cache;
}

// ============================================================
// DB DE SUB-BOT
// ============================================================

export async function getSubBotDB(senderId) {
  if (subBotInstances.has(senderId)) {
    return subBotInstances.get(senderId).db;
  }

  if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, {
      recursive: true,
    });
  }

  const sqlitePath = path.join(DATABASE_DIR, `db_subbot_${senderId}.sqlite3`);

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

  // ==========================================================
  // CACHE LIMITADO
  // ==========================================================

  const groupsCache = new NodeCache({
    stdTTL: 200,
    checkperiod: 120,
    useClones: false,
    maxKeys: 150,
  });

  // ==========================================================
  // CACHE EXPIRADO → SQLITE
  // ==========================================================

  groupsCache.on("expired", (key, value) => {
    try {
      conn
        .prepare(
          `
            INSERT INTO groups(jid, data)
            VALUES(?, ?)
            ON CONFLICT(jid)
            DO UPDATE SET data=excluded.data
          `,
        )
        .run(key, JSON.stringify(value));
    } catch (err) {
      console.error(
        chalk.red(
          `[SubBot DB ${senderId}] Error al guardar grupo expirado ${key}:`,
        ),
        err.message,
      );
    }
  });

  // ==========================================================
  // PROXY
  // ==========================================================

  const groupsProxy = new Proxy(
    {},
    {
      get(target, key) {
        if (typeof key !== "string" || key === "toJSON" || key === "then") {
          return target[key];
        }

        let group = groupsCache.get(key);

        if (!group) {
          try {
            const row = conn
              .prepare("SELECT data FROM groups WHERE jid = ?")
              .get(key);

            if (row) {
              group = JSON.parse(row.data);

              groupsCache.set(key, group);
            }
          } catch (err) {
            console.error(
              chalk.red(`[SubBot DB ${senderId}] Error cargando grupo ${key}:`),
              err.message,
            );
          }
        }

        return group;
      },

      set(target, key, value) {
        if (typeof key === "string") {
          groupsCache.set(key, value);
        }

        return true;
      },

      deleteProperty(target, key) {
        if (typeof key === "string") {
          groupsCache.del(key);

          try {
            conn.prepare("DELETE FROM groups WHERE jid = ?").run(key);
          } catch {}
        }

        return true;
      },
    },
  );

  // ==========================================================
  // CONFIGURACIÓN
  // ==========================================================

  let mainDb = {};

  try {
    mainDb = getDBSync();
  } catch {}

  const defaults = [
    ["prefix", mainDb.prefix || "."],
    ["owners", mainDb.owners || [`${senderId}@s.whatsapp.net`]],
    ["ownerRoles", mainDb.ownerRoles || {}],
    ["maxSubBots", 0],
    ["botName", "Aura Reed"],
    ["customBanner", null],
  ];

  const stmtSelect = conn.prepare("SELECT key FROM config WHERE key = ?");

  const stmtInsert = conn.prepare(
    "INSERT INTO config(key, value) VALUES(?, ?)",
  );

  for (const [key, value] of defaults) {
    if (!stmtSelect.get(key)) {
      stmtInsert.run(key, JSON.stringify(value));
    }
  }

  const configRows = conn.prepare("SELECT key, value FROM config").all();

  const dbData = {};

  for (const row of configRows) {
    try {
      dbData[row.key] = JSON.parse(row.value);
    } catch {
      dbData[row.key] = row.value;
    }
  }

  // ==========================================================
  // DB FINAL
  // ==========================================================

  const db = {
    prefix: dbData.prefix ?? ".",

    owners: dbData.owners || [`${senderId}@s.whatsapp.net`],

    ownerRoles: dbData.ownerRoles || {},

    maxSubBots: dbData.maxSubBots ?? 0,

    botName: dbData.botName ?? "Aura Reed",

    customBanner: dbData.customBanner ?? null,

    groups: groupsProxy,

    get users() {
      return getDBSync().users;
    },
  };

  // ==========================================================
  // GUARDAR REFERENCIAS
  // ==========================================================

  subBotInstances.set(senderId, {
    conn,
    db,
    groupsCache,
    groupsProxy,
  });

  return db;
}

// ============================================================
// GUARDAR DB DEL SUB-BOT
// ============================================================

export function saveSubBotDB(senderId) {
  const instance = subBotInstances.get(senderId);

  if (!instance || !instance.groupsCache) {
    return;
  }

  try {
    const stmt = instance.conn.prepare(`
        INSERT INTO groups(jid, data)
        VALUES(?, ?)
        ON CONFLICT(jid)
        DO UPDATE SET data=excluded.data
      `);

    for (const key of instance.groupsCache.keys()) {
      const value = instance.groupsCache.get(key);

      if (value !== undefined) {
        stmt.run(key, JSON.stringify(value));
      }
    }
  } catch (err) {
    console.error(
      chalk.red(`[SubBot DB ${senderId}] Error guardando grupos:`),
      err.message,
    );
  }
}

// ============================================================
// CERRAR DB DE SUB-BOT
// ============================================================

export function closeSubBotDB(senderId) {
  const instance = subBotInstances.get(senderId);

  if (!instance) {
    return;
  }

  try {
    saveSubBotDB(senderId);
  } catch {}

  try {
    instance.groupsCache?.close?.();
  } catch {}

  try {
    instance.conn?.close();
  } catch {}

  subBotInstances.delete(senderId);
}

// ============================================================
// FLUSH
// ============================================================

export function flushAllSubBotDBs() {
  for (const senderId of subBotInstances.keys()) {
    saveSubBotDB(senderId);
  }
}
