import Database from "better-sqlite3";
import NodeCache from "node-cache";
import path from "path";
import fs from "fs";
import chalk from "chalk";

const DATABASE_DIR = path.resolve("./database");
let dbInstance = null;
let sqliteConn = null;
let usersCache = null;
let groupsCache = null;
let usersProxy = null;
let groupsProxy = null;

export function getDBSync() {
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATABASE_DIR)) {
    fs.mkdirSync(DATABASE_DIR, { recursive: true });
  }

  const sqlitePath = path.join(DATABASE_DIR, "db.sqlite3");
  sqliteConn = new Database(sqlitePath);

  sqliteConn.exec(`
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

  usersCache = new NodeCache({ stdTTL: 600, useClones: false });
  groupsCache = new NodeCache({ stdTTL: 600, useClones: false });

  usersCache.on("expired", (key, value) => {
    try {
      sqliteConn.prepare(
        "INSERT INTO users(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data"
      ).run(key, JSON.stringify(value));
    } catch (err) {
      console.error(chalk.red(`[Main DB] Error guardando usuario expirado ${key}:`), err.message);
    }
  });

  groupsCache.on("expired", (key, value) => {
    try {
      sqliteConn.prepare(
        "INSERT INTO groups(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data"
      ).run(key, JSON.stringify(value));
    } catch (err) {
      console.error(chalk.red(`[Main DB] Error guardando grupo expirado ${key}:`), err.message);
    }
  });

  usersProxy = new Proxy({}, {
    get(target, key) {
      if (typeof key !== "string" || key === "toJSON" || key === "then") return target[key];
      let user = usersCache.get(key);
      if (!user) {
        try {
          const row = sqliteConn.prepare("SELECT data FROM users WHERE jid = ?").get(key);
          if (row) {
            user = JSON.parse(row.data);
            usersCache.set(key, user);
          }
        } catch (err) {
          console.error(chalk.red(`[Main DB] Error cargando usuario ${key}:`), err.message);
        }
      }
      return user;
    },
    set(target, key, value) {
      if (typeof key === "string") usersCache.set(key, value);
      return true;
    },
    deleteProperty(target, key) {
      if (typeof key === "string") {
        usersCache.del(key);
        try { sqliteConn.prepare("DELETE FROM users WHERE jid = ?").run(key); } catch {}
      }
      return true;
    },
    has(target, key) {
      if (typeof key !== "string") return false;
      if (usersCache.has(key)) return true;
      try {
        return !!sqliteConn.prepare("SELECT 1 FROM users WHERE jid = ?").get(key);
      } catch { return false; }
    }
  });

  groupsProxy = new Proxy({}, {
    get(target, key) {
      if (typeof key !== "string" || key === "toJSON" || key === "then") return target[key];
      let group = groupsCache.get(key);
      if (!group) {
        try {
          const row = sqliteConn.prepare("SELECT data FROM groups WHERE jid = ?").get(key);
          if (row) {
            group = JSON.parse(row.data);
            groupsCache.set(key, group);
          }
        } catch (err) {
          console.error(chalk.red(`[Main DB] Error cargando grupo ${key}:`), err.message);
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
        try { sqliteConn.prepare("DELETE FROM groups WHERE jid = ?").run(key); } catch {}
      }
      return true;
    }
  });

  const defaults = [
    ["prefix", "."],
    ["owners", []],
    ["ownerRoles", {}]
  ];

  for (const [k, v] of defaults) {
    const row = sqliteConn.prepare("SELECT key FROM config WHERE key = ?").get(k);
    if (!row) {
      sqliteConn.prepare("INSERT INTO config(key, value) VALUES(?, ?)").run(k, JSON.stringify(v));
    }
  }

  const configRows = sqliteConn.prepare("SELECT key, value FROM config").all();
  const dbData = {};
  for (const row of configRows) {
    try { dbData[row.key] = JSON.parse(row.value); } catch { dbData[row.key] = row.value; }
  }

  dbInstance = {
    ...dbData,
    users: usersProxy,
    groups: groupsProxy
  };

  return dbInstance;
}

export function saveMainDB() {
  if (!sqliteConn) return;
  try {
    sqliteConn.transaction(() => {
      const stmtUser = sqliteConn.prepare("INSERT INTO users(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data");
      for (const jid of usersCache.keys()) {
        const val = usersCache.get(jid);
        if (val) stmtUser.run(jid, JSON.stringify(val));
      }

      const stmtGroup = sqliteConn.prepare("INSERT INTO groups(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data");
      for (const jid of groupsCache.keys()) {
        const val = groupsCache.get(jid);
        if (val) stmtGroup.run(jid, JSON.stringify(val));
      }
    })();
  } catch (err) {
    console.error(chalk.red("[Main DB] Error guardando cambios:"), err.message);
  }
}

export function flushDB() {
  saveMainDB();
}
