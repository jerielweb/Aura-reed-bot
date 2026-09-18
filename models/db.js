import Database from "better-sqlite3";
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

function closeDbConnection() {
  try {
    if (dbConn) {
      dbConn.close();
    }
  } catch {}
  dbConn = null;
}

function initializeSqliteConnection() {
  if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
  }

  closeDbConnection();
  dbConn = new Database(DB_SQLITE_FILE);
  dbConn.pragma("journal_mode = WAL");
  dbConn.pragma("synchronous = NORMAL");
  dbConn.pragma("busy_timeout = 5000");

  dbConn.exec(`
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
}

function recoverSqliteConnection() {
  try {
    if (dbConn) {
      dbConn.close();
    }
  } catch {}

  dbConn = null;
  initialized = false;

  try {
    initializeSqliteConnection();
    migrateFromJsonIfNeeded();
    ensureDefaults();

    const configRows = dbConn.prepare("SELECT key, value FROM config").all();
    const dbData = {};
    for (const row of configRows) {
      try {
        dbData[row.key] = JSON.parse(row.value);
      } catch {
        dbData[row.key] = row.value;
      }
    }

    dbCache = {
      selfMode: dbData.selfMode ?? DEFAULT_DB_CONFIG.selfMode,
      modSelfMode: dbData.modSelfMode ?? DEFAULT_DB_CONFIG.modSelfMode,
      restrictedCommands:
        dbData.restrictedCommands || DEFAULT_DB_CONFIG.restrictedCommands,
      prefix: dbData.prefix ?? DEFAULT_DB_CONFIG.prefix ?? ".",
      owners: dbData.owners || DEFAULT_DB_CONFIG.owners,
      ownerRoles: dbData.ownerRoles || {},
      maxSubBots: Number.isFinite(Number(dbData.maxSubBots))
        ? Number(dbData.maxSubBots)
        : Number(DEFAULT_DB_CONFIG.maxSubBots ?? 30),
      botName: dbData.botName ?? DEFAULT_DB_CONFIG.botName ?? "Aura Reed",
      customBanner:
        dbData.customBanner ?? DEFAULT_DB_CONFIG.customBanner ?? null,
    };

    initialized = true;
    return true;
  } catch (err) {
    console.error(
      chalk.red("[DB] No se pudo reabrir SQLite tras error de escritura:"),
      err.message,
    );
    return false;
  }
}

export const groupsCache = new NodeCache({ stdTTL: 600, useClones: false });
export const usersCache = new NodeCache({ stdTTL: 600, useClones: false });

const DEFAULT_DB_CONFIG = {
  selfMode: false,
  modSelfMode: false,
  restrictedCommands: [],
  prefix: ".",
  maxSubBots: 30,
  botName: "Aura Reed",
  customBanner: null,
  owners: [
    "50672373785@s.whatsapp.net",
    "573135180876@s.whatsapp.net",
    "50581253065@s.whatsapp.net",
    "5214183357841@s.whatsapp.net",
    "50578391933@s.whatsapp.net",
  ],
  ownerRoles: {
    "50672373785@s.whatsapp.net": "Dev principal",
    "573135180876@s.whatsapp.net": "Moderador",
    "50581253065@s.whatsapp.net": "Soporte",
    "5214183357841@s.whatsapp.net": "Colaborador",
    "50578391933@s.whatsapp.net": "Soporte",
  },
};


groupsCache.on("expired", (key, value) => {
  try {
    dbConn
      .prepare(
        "INSERT INTO groups(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data",
      )
      .run(key, JSON.stringify(value));
    console.log(
      chalk.gray(
        `[DB] Grupo ${key} guardado en SQLite por expiración de caché`,
      ),
    );
  } catch (err) {
    console.error(
      chalk.red(`[DB] Error al guardar grupo expirado ${key}:`),
      err.message,
    );
  }
});

usersCache.on("expired", (key, value) => {
  try {
    dbConn
      .prepare(
        "INSERT INTO users(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data",
      )
      .run(key, JSON.stringify(value));
    console.log(
      chalk.gray(
        `[DB] Usuario ${key} guardado en SQLite por expiración de caché`,
      ),
    );
  } catch (err) {
    console.error(
      chalk.red(`[DB] Error al guardar usuario expirado ${key}:`),
      err.message,
    );
  }
});

const groupsProxy = new Proxy(
  {},
  {
    get(target, key) {
      if (typeof key !== "string" || key === "toJSON" || key === "then")
        return target[key];

      let group = groupsCache.get(key);
      if (!group) {
        try {
          const row = dbConn
            .prepare("SELECT data FROM groups WHERE jid = ?")
            .get(key);
          if (row) {
            group = JSON.parse(row.data);
            groupsCache.set(key, group);
          }
        } catch (err) {
          console.error(
            chalk.red(`[DB] Error cargando grupo ${key} de SQLite:`),
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
          dbConn.prepare("DELETE FROM groups WHERE jid = ?").run(key);
        } catch (err) {
          console.error(
            chalk.red(`[DB] Error eliminando grupo ${key} de SQLite:`),
            err.message,
          );
        }
      }
      return true;
    },
    has(target, key) {
      if (typeof key !== "string") return false;
      if (groupsCache.has(key)) return true;
      try {
        const row = dbConn
          .prepare("SELECT 1 FROM groups WHERE jid = ?")
          .get(key);
        return !!row;
      } catch {
        return false;
      }
    },
    ownKeys(target) {
      try {
        const rows = dbConn.prepare("SELECT jid FROM groups").all();
        const keys = new Set(rows.map((r) => r.jid));
        const cachedKeys = groupsCache.keys();
        for (const k of cachedKeys) keys.add(k);
        return Array.from(keys);
      } catch {
        return groupsCache.keys();
      }
    },
    getOwnPropertyDescriptor(target, key) {
      return {
        enumerable: true,
        configurable: true,
      };
    },
  },
);

const usersProxy = new Proxy(
  {},
  {
    get(target, key) {
      if (typeof key !== "string" || key === "toJSON" || key === "then")
        return target[key];

      let user = usersCache.get(key);
      if (!user) {
        try {
          const row = dbConn
            .prepare("SELECT data FROM users WHERE jid = ?")
            .get(key);
          if (row) {
            user = JSON.parse(row.data);
            usersCache.set(key, user);
          }
        } catch (err) {
          console.error(
            chalk.red(`[DB] Error cargando usuario ${key} de SQLite:`),
            err.message,
          );
        }
      }
      return user;
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
        try {
          dbConn.prepare("DELETE FROM users WHERE jid = ?").run(key);
        } catch (err) {
          console.error(
            chalk.red(`[DB] Error eliminando usuario ${key} de SQLite:`),
            err.message,
          );
        }
      }
      return true;
    },
    has(target, key) {
      if (typeof key !== "string") return false;
      if (usersCache.has(key)) return true;
      try {
        const row = dbConn
          .prepare("SELECT 1 FROM users WHERE jid = ?")
          .get(key);
        return !!row;
      } catch {
        return false;
      }
    },
    ownKeys(target) {
      try {
        const rows = dbConn.prepare("SELECT jid FROM users").all();
        const keys = new Set(rows.map((r) => r.jid));
        const cachedKeys = usersCache.keys();
        for (const k of cachedKeys) keys.add(k);
        return Array.from(keys);
      } catch {
        return usersCache.keys();
      }
    },
    getOwnPropertyDescriptor(target, key) {
      return {
        enumerable: true,
        configurable: true,
      };
    },
  },
);

function migrateFromJsonIfNeeded() {
  try {
    const configCountRow = dbConn
      .prepare("SELECT COUNT(*) as count FROM config")
      .get();
    if (configCountRow && configCountRow.count > 0) {
      return;
    }
  } catch (e) {}

  let hasJson = false;
  let oldConfig = null;
  let oldUsers = null;
  let oldGroups = null;

  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, "utf-8");
      oldConfig = JSON.parse(raw);
      hasJson = true;
    }
  } catch {}

  try {
    if (fs.existsSync(USERS_FILE)) {
      const raw = fs.readFileSync(USERS_FILE, "utf-8");
      oldUsers = JSON.parse(raw);
      hasJson = true;
    }
  } catch {}

  try {
    if (fs.existsSync(GROUPS_FILE)) {
      const raw = fs.readFileSync(GROUPS_FILE, "utf-8");
      oldGroups = JSON.parse(raw);
      hasJson = true;
    }
  } catch {}

  if (!hasJson) {
    return;
  }

  console.log(chalk.cyan("[DB] Migrando datos desde JSON a SQLite3..."));

  dbConn.transaction(() => {
    if (oldConfig) {
      const keysToMigrate = ["prefix", "owners", "maxSubBots", "ownerRoles"];
      const stmt = dbConn.prepare(
        "INSERT INTO config(key, value) VALUES(?, ?)",
      );
      for (const key of keysToMigrate) {
        if (oldConfig[key] !== undefined) {
          stmt.run(key, JSON.stringify(oldConfig[key]));
        }
      }
    }

    if (oldUsers && oldUsers.users) {
      const stmt = dbConn.prepare("INSERT INTO users(jid, data) VALUES(?, ?)");
      for (const [jid, data] of Object.entries(oldUsers.users)) {
        stmt.run(jid, JSON.stringify(data));
      }
    }

    if (oldGroups && oldGroups.groups) {
      const stmt = dbConn.prepare("INSERT INTO groups(jid, data) VALUES(?, ?)");
      for (const [jid, data] of Object.entries(oldGroups.groups)) {
        stmt.run(jid, JSON.stringify(data));
      }
    }
  })();

  console.log(
    chalk.green(
      "[DB] Migración completada con éxito. Renombrando archivos antiguos...",
    ),
  );

  const renameFile = (oldPath) => {
    try {
      if (fs.existsSync(oldPath)) {
        fs.renameSync(oldPath, oldPath + ".migrated.bak");
      }
    } catch {}
  };

  renameFile(DB_FILE);
  renameFile(USERS_FILE);
  renameFile(GROUPS_FILE);

  const DB_BACKUP_FILE = path.join(DATABASE_DIR, "database.backup.json");
  const GROUPS_BACKUP_FILE = path.join(DATABASE_DIR, "groups.backup.json");
  const USERS_BACKUP_FILE = path.join(DATABASE_DIR, "users.backup.json");
  renameFile(DB_BACKUP_FILE);
  renameFile(GROUPS_BACKUP_FILE);
  renameFile(USERS_BACKUP_FILE);
}

function ensureDefaults() {
  const defaults = [
    ["selfMode", DEFAULT_DB_CONFIG.selfMode],
    ["modSelfMode", DEFAULT_DB_CONFIG.modSelfMode],
    ["restrictedCommands", DEFAULT_DB_CONFIG.restrictedCommands],
    ["prefix", DEFAULT_DB_CONFIG.prefix],
    ["owners", DEFAULT_DB_CONFIG.owners],
    ["maxSubBots", DEFAULT_DB_CONFIG.maxSubBots],
    ["botName", DEFAULT_DB_CONFIG.botName],
    ["customBanner", DEFAULT_DB_CONFIG.customBanner],
    ["ownerRoles", DEFAULT_DB_CONFIG.ownerRoles],
  ];

  const stmtSelect = dbConn.prepare("SELECT key FROM config WHERE key = ?");
  const stmtInsert = dbConn.prepare(
    "INSERT INTO config(key, value) VALUES(?, ?)",
  );

  for (const [key, defaultValue] of defaults) {
    if (defaultValue === undefined) continue;

    const row = stmtSelect.get(key);
    if (!row) {
      stmtInsert.run(key, JSON.stringify(defaultValue));
    }
  }
}

export async function initDB() {
  if (initialized && dbCache) {
    return { ...dbCache, groups: groupsProxy, users: usersProxy };
  }

  if (!dbConn || !fs.existsSync(DB_SQLITE_FILE)) {
    initializeSqliteConnection();
  }

  migrateFromJsonIfNeeded();
  ensureDefaults();

  // Load config
  const configRows = dbConn.prepare("SELECT key, value FROM config").all();
  const dbData = {};
  for (const row of configRows) {
    try {
      dbData[row.key] = JSON.parse(row.value);
    } catch {
      dbData[row.key] = row.value;
    }
  }

  dbCache = {
    selfMode: dbData.selfMode ?? DEFAULT_DB_CONFIG.selfMode,
    modSelfMode: dbData.modSelfMode ?? DEFAULT_DB_CONFIG.modSelfMode,
    restrictedCommands:
      dbData.restrictedCommands || DEFAULT_DB_CONFIG.restrictedCommands,
    prefix: dbData.prefix ?? DEFAULT_DB_CONFIG.prefix ?? ".",
    owners: dbData.owners || DEFAULT_DB_CONFIG.owners,
    ownerRoles: dbData.ownerRoles || {},
    maxSubBots: Number.isFinite(Number(dbData.maxSubBots))
      ? Number(dbData.maxSubBots)
      : Number(DEFAULT_DB_CONFIG.maxSubBots ?? 30),
    botName: dbData.botName ?? DEFAULT_DB_CONFIG.botName ?? "Aura Reed",
    customBanner: dbData.customBanner ?? DEFAULT_DB_CONFIG.customBanner ?? null,
  };

  initialized = true;

  const groupCount = dbConn
    .prepare("SELECT COUNT(*) as count FROM groups")
    .get().count;
  const userCount = dbConn
    .prepare("SELECT COUNT(*) as count FROM users")
    .get().count;
  console.log(
    chalk.gray(
      `[DB] SQLite3 & Node-Cache Inicializado: ${groupCount} grupos, ${userCount} usuarios en DB`,
    ),
  );

  return { ...dbCache, groups: groupsProxy, users: usersProxy };
}

function makeLiveDbObject() {
  const live = {
    ...dbCache,
    groups: groupsProxy,
    users: usersProxy,
  };

  return new Proxy(live, {
    get(target, prop) {
      if (prop === "groups") return groupsProxy;
      if (prop === "users") return usersProxy;
      if (prop in target) return target[prop];
      if (prop in dbCache) return dbCache[prop];
      return undefined;
    },
    set(target, prop, value) {
      if (prop === "groups" || prop === "users") {
        target[prop] = value;
        return true;
      }

      dbCache[prop] = value;
      target[prop] = value;
      return true;
    },
    deleteProperty(target, prop) {
      if (prop in dbCache) {
        delete dbCache[prop];
      }
      if (prop in target) {
        delete target[prop];
      }
      return true;
    },
  });
}

export async function getDB() {
  if (!initialized) {
    await initDB();
  }
  return makeLiveDbObject();
}

export function getDBSync() {
  if (!initialized) {
    throw new Error("DB has not been initialized yet!");
  }
  return makeLiveDbObject();
}

function writeDbFiles(data) {
  if (!data || typeof data !== "object") {
    console.error(chalk.red("[DB] Datos invalidos recibidos en writeDbFiles"));
    return;
  }

  const doWrite = () => {
    const prefix = data.prefix ?? DEFAULT_DB_CONFIG.prefix ?? ".";
    const selfMode = data.selfMode ?? DEFAULT_DB_CONFIG.selfMode;
    const modSelfMode = data.modSelfMode ?? DEFAULT_DB_CONFIG.modSelfMode;
    const restrictedCommands =
      data.restrictedCommands ?? DEFAULT_DB_CONFIG.restrictedCommands;
    const owners = data.owners ?? DEFAULT_DB_CONFIG.owners;
    const maxSubBots = Number.isFinite(Number(data.maxSubBots))
      ? Number(data.maxSubBots)
      : Number(DEFAULT_DB_CONFIG.maxSubBots ?? 30);
    const ownerRoles = data.ownerRoles ?? {};
    const botName = data.botName ?? DEFAULT_DB_CONFIG.botName ?? "Aura Reed";
    const customBanner =
      data.customBanner ?? DEFAULT_DB_CONFIG.customBanner ?? null;

    const cachedGroups = groupsCache.keys();
    const cachedUsers = usersCache.keys();

    dbConn.transaction(() => {
      const configUpdates = [
        ["selfMode", selfMode],
        ["modSelfMode", modSelfMode],
        ["restrictedCommands", restrictedCommands],
        ["prefix", prefix],
        ["owners", owners],
        ["maxSubBots", maxSubBots],
        ["botName", botName],
        ["customBanner", customBanner],
        ["ownerRoles", ownerRoles],
      ];
      const stmtConfig = dbConn.prepare(
        "INSERT INTO config(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
      );
      for (const [key, value] of configUpdates) {
        stmtConfig.run(key, JSON.stringify(value));
      }

      const stmtGroup = dbConn.prepare(
        "INSERT INTO groups(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data",
      );
      for (const jid of cachedGroups) {
        const groupData = groupsCache.get(jid);
        if (groupData) {
          stmtGroup.run(jid, JSON.stringify(groupData));
        }
      }

      const stmtUser = dbConn.prepare(
        "INSERT INTO users(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data",
      );
      for (const jid of cachedUsers) {
        const userData = usersCache.get(jid);
        if (userData) {
          stmtUser.run(jid, JSON.stringify(userData));
        }
      }
    })();

    console.log(
      chalk.gray(
        `[DB] SQLite3 Guardado: DB config, ${cachedGroups.length} grupos en caché, ${cachedUsers.length} usuarios en caché`,
      ),
    );
  };

  try {
    doWrite();
  } catch (err) {
    const dbWasDeletedOrLocked =
      /readonly|locked|DBMOVED|database is locked|database is read-only/i.test(
        err.message || "",
      ) || !fs.existsSync(DB_SQLITE_FILE);

    if (!dbWasDeletedOrLocked) {
      console.error(
        chalk.red("[DB] Error CRITICO en writeDbFiles:"),
        err.message,
      );
      throw err;
    }

    console.warn(
      chalk.yellow(
        "[DB] Se detectó una DB SQLite cerrada/readonly/locked. Reconectando...",
      ),
    );

    const reconnected = recoverSqliteConnection();
    if (!reconnected) {
      console.error(chalk.red("[DB] No se pudo recuperar SQLite."));
      throw err;
    }

    try {
      ensureDefaults();
      doWrite();
    } catch (retryErr) {
      console.error(
        chalk.red("[DB] Error CRITICO después de reconectar SQLite:"),
        retryErr.message,
      );
      throw retryErr;
    }
  }
}

export async function saveDB(data, options = {}) {
  if (data && typeof data === "object") {
    const { groups, users, ...dbData } = data;

    if (Object.keys(dbData).length > 0) {
      dbCache = { ...(dbCache || {}), ...dbData };
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
      writeDbFiles(toSave);
    } finally {
      saving = false;
    }
    return;
  }

  saveTimer = setTimeout(() => {
    saveTimer = null;
    if (saving) return;
    saving = true;
    try {
      const toSave = { ...dbCache, groups: groupsProxy, users: usersProxy };
      writeDbFiles(toSave);
    } catch (err) {
      console.error(
        chalk.red("[DB] Error guardando base de datos:"),
        err.message,
      );
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
    const toSave = {
      ...dbCache,
      groups: groupsProxy,
      users: usersProxy,
    };
    writeDbFiles(toSave);
    console.log(chalk.gray("[DB] Flush completado exitosamente"));
  } catch (err) {
    console.error(chalk.red("[DB] ERROR CRITICO en flushDB:"), err.message);
  }
}
