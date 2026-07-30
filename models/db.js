import sqlite3 from "sqlite3";
import { open } from "sqlite";
import NodeCache from "node-cache";
import path from "path";
import fs from "fs";
import chalk from "chalk";

const DATABASE_DIR = path.resolve("./database");
const DB_SQLITE_FILE = path.join(DATABASE_DIR, "db.sqlite3");

const DB_FILE = path.join(DATABASE_DIR, "database.json");
const USERS_FILE = path.join(DATABASE_DIR, "users.json");
const GROUPS_FILE = path.join(DATABASE_DIR, "groups.json");

const SAVE_DELAY_MS = 800;

let dbConn = null;
let dbCache = null;
let saveTimer = null;
let saving = false;
let initialized = false;

// Instancias de node-cache sin expiración automática estricta para mantener sync en RAM
export const groupsCache = new NodeCache({ stdTTL: 0, useClones: false });
export const usersCache = new NodeCache({ stdTTL: 0, useClones: false });

const DEFAULT_DB_CONFIG = {
  prefix: [".", "!", "#", "/"],
  owners: [
    "50670375314@s.whatsapp.net",
    "50581253065@s.whatsapp.net",
    "5214183357841@s.whatsapp.net",
    "50578391933@s.whatsapp.net",
  ],
  maxSubBots: 20,
  ownerRoles: {
    "50670375314@s.whatsapp.net": "DEV Principal",
    "50581253065@s.whatsapp.net": "Soporte",
    "5214183357841@s.whatsapp.net": "Colaborador",
    "50578391933@s.whatsapp.net": "Soporte",
  },
};

// Proxies para interactuar directamente con la memoria síncrona
const groupsProxy = new Proxy(
  {},
  {
    get(target, key) {
      if (typeof key !== "string" || key === "toJSON" || key === "then")
        return target[key];
      return groupsCache.get(key);
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
        if (dbConn) {
          dbConn.run("DELETE FROM groups WHERE jid = ?", [key]).catch((err) => {
            console.error(
              chalk.red(`[DB] Error eliminando grupo ${key} de SQLite:`),
              err.message,
            );
          });
        }
      }
      return true;
    },
    has(target, key) {
      if (typeof key !== "string") return false;
      return groupsCache.has(key);
    },
    ownKeys() {
      return groupsCache.keys();
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    },
  },
);

const usersProxy = new Proxy(
  {},
  {
    get(target, key) {
      if (typeof key !== "string" || key === "toJSON" || key === "then")
        return target[key];
      return usersCache.get(key);
    },
    set(target, key, value) {
      if (typeof key === "string") {
        usersCache.set(key, value);
      }
      return true;
    },
    deleteProperty(target, key) {
      if (typeof key === "string") {
        usersCache.del(key);
        if (dbConn) {
          dbConn.run("DELETE FROM users WHERE jid = ?", [key]).catch((err) => {
            console.error(
              chalk.red(`[DB] Error eliminando usuario ${key} de SQLite:`),
              err.message,
            );
          });
        }
      }
      return true;
    },
    has(target, key) {
      if (typeof key !== "string") return false;
      return usersCache.has(key);
    },
    ownKeys() {
      return usersCache.keys();
    },
    getOwnPropertyDescriptor() {
      return { enumerable: true, configurable: true };
    },
  },
);

async function migrateFromJsonIfNeeded() {
  try {
    const configCountRow = await dbConn.get("SELECT COUNT(*) as count FROM config");
    if (configCountRow && configCountRow.count > 0) return;
  } catch (e) {}

  let hasJson = false;
  let oldConfig = null;
  let oldUsers = null;
  let oldGroups = null;

  try {
    if (fs.existsSync(DB_FILE)) {
      oldConfig = JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
      hasJson = true;
    }
  } catch {}

  try {
    if (fs.existsSync(USERS_FILE)) {
      oldUsers = JSON.parse(fs.readFileSync(USERS_FILE, "utf-8"));
      hasJson = true;
    }
  } catch {}

  try {
    if (fs.existsSync(GROUPS_FILE)) {
      oldGroups = JSON.parse(fs.readFileSync(GROUPS_FILE, "utf-8"));
      hasJson = true;
    }
  } catch {}

  if (!hasJson) return;

  console.log(chalk.cyan("[DB] Migrando datos desde JSON a SQLite3..."));

  if (oldConfig) {
    const keysToMigrate = ["prefix", "owners", "maxSubBots", "ownerRoles"];
    for (const key of keysToMigrate) {
      if (oldConfig[key] !== undefined) {
        await dbConn.run("INSERT OR REPLACE INTO config(key, value) VALUES(?, ?)", [
          key,
          JSON.stringify(oldConfig[key]),
        ]);
      }
    }
  }

  if (oldUsers && oldUsers.users) {
    for (const [jid, data] of Object.entries(oldUsers.users)) {
      await dbConn.run("INSERT OR REPLACE INTO users(jid, data) VALUES(?, ?)", [
        jid,
        JSON.stringify(data),
      ]);
    }
  }

  if (oldGroups && oldGroups.groups) {
    for (const [jid, data] of Object.entries(oldGroups.groups)) {
      await dbConn.run("INSERT OR REPLACE INTO groups(jid, data) VALUES(?, ?)", [
        jid,
        JSON.stringify(data),
      ]);
    }
  }

  console.log(chalk.green("[DB] Migración completada con éxito."));

  const renameFile = (oldPath) => {
    try {
      if (fs.existsSync(oldPath)) fs.renameSync(oldPath, oldPath + ".migrated.bak");
    } catch {}
  };

  renameFile(DB_FILE);
  renameFile(USERS_FILE);
  renameFile(GROUPS_FILE);
}

async function ensureDefaults() {
  const defaults = [
    ["prefix", DEFAULT_DB_CONFIG.prefix],
    ["owners", DEFAULT_DB_CONFIG.owners],
    ["maxSubBots", DEFAULT_DB_CONFIG.maxSubBots],
    ["ownerRoles", DEFAULT_DB_CONFIG.ownerRoles],
  ];

  for (const [key, defaultValue] of defaults) {
    const row = await dbConn.get("SELECT key FROM config WHERE key = ?", [key]);
    if (!row) {
      await dbConn.run("INSERT INTO config(key, value) VALUES(?, ?)", [
        key,
        JSON.stringify(defaultValue),
      ]);
    }
  }
}

export async function initDB() {
  if (initialized && dbCache) {
    return { ...dbCache, groups: groupsProxy, users: usersProxy };
  }

  if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
  }

  dbConn = await open({
    filename: DB_SQLITE_FILE,
    driver: sqlite3.Database,
  });

  await dbConn.exec(`
        CREATE TABLE IF NOT EXISTS config (
            key TEXT PRIMARY KEY,
            value TEXT
        );
        CREATE TABLE IF NOT EXISTS users (
            jid TEXT PRIMARY KEY,
            data TEXT
        );
        CREATE TABLE IF NOT EXISTS groups (
            jid TEXT PRIMARY KEY,
            data TEXT
        );
    `);

  await migrateFromJsonIfNeeded();
  await ensureDefaults();

  // Cargamos configuración
  const configRows = await dbConn.all("SELECT key, value FROM config");
  const dbData = {};
  for (const row of configRows) {
    try {
      dbData[row.key] = JSON.parse(row.value);
    } catch {
      dbData[row.key] = row.value;
    }
  }

  // Precargamos los Grupos en Memoria Caché
  const groupRows = await dbConn.all("SELECT jid, data FROM groups");
  for (const row of groupRows) {
    try {
      groupsCache.set(row.jid, JSON.parse(row.data));
    } catch {}
  }

  // Precargamos los Usuarios en Memoria Caché
  const userRows = await dbConn.all("SELECT jid, data FROM users");
  for (const row of userRows) {
    try {
      usersCache.set(row.jid, JSON.parse(row.data));
    } catch {}
  }

  dbCache = {
    prefix: dbData.prefix ?? DEFAULT_DB_CONFIG.prefix,
    owners: dbData.owners || DEFAULT_DB_CONFIG.owners,
    ownerRoles: dbData.ownerRoles || {},
    maxSubBots: dbData.maxSubBots ?? DEFAULT_DB_CONFIG.maxSubBots,
  };

  initialized = true;

  console.log(
    chalk.gray(
      `[DB] SQLite3 & Node-Cache Inicializado: ${groupRows.length} grupos, ${userRows.length} usuarios en memoria DB`,
    ),
  );

  return { ...dbCache, groups: groupsProxy, users: usersProxy };
}

export async function getDB() {
  if (!initialized) {
    await initDB();
  }
  return { ...dbCache, groups: groupsProxy, users: usersProxy };
}

export function getDBSync() {
  if (!initialized) {
    throw new Error("DB no ha sido inicializada aún.");
  }
  return { ...dbCache, groups: groupsProxy, users: usersProxy };
}

async function writeDbFiles(data) {
  if (!data || typeof data !== "object") {
    console.error(chalk.red("[DB] Datos inválidos recibidos en writeDbFiles"));
    return;
  }

  try {
    const prefix = data.prefix ?? DEFAULT_DB_CONFIG.prefix;
    const owners = data.owners ?? DEFAULT_DB_CONFIG.owners;
    const maxSubBots = data.maxSubBots ?? DEFAULT_DB_CONFIG.maxSubBots;
    const ownerRoles = data.ownerRoles ?? {};

    const cachedGroups = groupsCache.keys();
    const cachedUsers = usersCache.keys();

    // Guardar Configuración
    const configUpdates = [
      ["prefix", prefix],
      ["owners", owners],
      ["maxSubBots", maxSubBots],
      ["ownerRoles", ownerRoles],
    ];

    for (const [key, value] of configUpdates) {
      await dbConn.run(
        "INSERT INTO config(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
        [key, JSON.stringify(value)],
      );
    }

    // Guardar Grupos
    for (const jid of cachedGroups) {
      const groupData = groupsCache.get(jid);
      if (groupData) {
        await dbConn.run(
          "INSERT INTO groups(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data",
          [jid, JSON.stringify(groupData)],
        );
      }
    }

    // Guardar Usuarios
    for (const jid of cachedUsers) {
      const userData = usersCache.get(jid);
      if (userData) {
        await dbConn.run(
          "INSERT INTO users(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data",
          [jid, JSON.stringify(userData)],
        );
      }
    }

    console.log(
      chalk.gray(
        `[DB] SQLite3 Guardado: Config, ${cachedGroups.length} grupos, ${cachedUsers.length} usuarios`,
      ),
    );
  } catch (err) {
    console.error(chalk.red("[DB] Error CRÍTICO en writeDbFiles:"), err.message);
  }
}

export async function saveDB(data, options = {}) {
  if (data && typeof data === "object") {
    const { groups, users, ...dbData } = data;

    if (Object.keys(dbData).length > 0) {
      dbCache = { ...dbCache, ...dbData };
    }

    if (groups && typeof groups === "object" && groups !== groupsProxy) {
      for (const [key, value] of Object.entries(groups)) {
        groupsCache.set(key, value);
      }
    }

    if (users && typeof users === "object" && users !== usersProxy) {
      for (const [key, value] of Object.entries(users)) {
        usersCache.set(key, value);
      }
    }
  }

  if (saveTimer) clearTimeout(saveTimer);

  if (options.immediate) {
    if (saving) return;
    saving = true;
    try {
      const toSave = { ...dbCache, groups: groupsProxy, users: usersProxy };
      await writeDbFiles(toSave);
    } finally {
      saving = false;
    }
    return;
  }

  saveTimer = setTimeout(async () => {
    saveTimer = null;
    if (saving) return;
    saving = true;
    try {
      const toSave = { ...dbCache, groups: groupsProxy, users: usersProxy };
      await writeDbFiles(toSave);
    } catch (err) {
      console.error(chalk.red("[DB] Error guardando base de datos:"), err.message);
    } finally {
      saving = false;
    }
  }, SAVE_DELAY_MS);
}

export async function flushDB() {
  console.log(chalk.gray("[DB] Flushing database..."));

  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  if (!initialized || !dbCache) {
    console.warn(chalk.yellow("[DB] DB no inicializada en flushDB"));
    return;
  }

  try {
    const toSave = { ...dbCache, groups: groupsProxy, users: usersProxy };
    await writeDbFiles(toSave);
    console.log(chalk.gray("[DB] Flush completado exitosamente"));
  } catch (err) {
    console.error(chalk.red("[DB] ERROR CRÍTICO en flushDB:"), err.message);
  }
}
