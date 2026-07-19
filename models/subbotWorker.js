import Database from 'better-sqlite3';
import NodeCache from 'node-cache';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';
import { getDBSync } from './db.js';

const DATABASE_DIR = path.resolve('./database');
const subBotInstances = new Map();
const metadataCache = new Map();
const METADATA_TTL = 5 * 60 * 1000; // 5 minutes

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
        CREATE TABLE IF NOT EXISTS users (
            jid TEXT PRIMARY KEY,
            data TEXT
        );
        CREATE TABLE IF NOT EXISTS groups (
            jid TEXT PRIMARY KEY,
            data TEXT
        );
    `);

    // Create node-cache instances with TTL of 10 minutes
    const groupsCache = new NodeCache({ stdTTL: 600, useClones: false });
    const usersCache = new NodeCache({ stdTTL: 600, useClones: false });

    // Cache expired hooks to write to SQLite
    groupsCache.on("expired", (key, value) => {
        try {
            conn.prepare("INSERT INTO groups(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data")
                .run(key, JSON.stringify(value));
            console.log(chalk.gray(`[SubBot DB ${senderId}] Grupo ${key} guardado en SQLite por expiración de caché`));
        } catch (err) {
            console.error(chalk.red(`[SubBot DB ${senderId}] Error al guardar grupo expirado ${key}:`), err.message);
        }
    });

    usersCache.on("expired", (key, value) => {
        try {
            conn.prepare("INSERT INTO users(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data")
                .run(key, JSON.stringify(value));
            console.log(chalk.gray(`[SubBot DB ${senderId}] Usuario ${key} guardado en SQLite por expiración de caché`));
        } catch (err) {
            console.error(chalk.red(`[SubBot DB ${senderId}] Error al guardar usuario expirado ${key}:`), err.message);
        }
    });

    // Create proxies to intercept JS reads and writes
    const groupsProxy = new Proxy({}, {
        get(target, key) {
            if (typeof key !== 'string' || key === 'toJSON' || key === 'then') return target[key];
            
            let group = groupsCache.get(key);
            if (!group) {
                try {
                    const row = conn.prepare("SELECT data FROM groups WHERE jid = ?").get(key);
                    if (row) {
                        group = JSON.parse(row.data);
                        groupsCache.set(key, group);
                    }
                } catch (err) {
                    console.error(chalk.red(`[SubBot DB ${senderId}] Error cargando grupo ${key} de SQLite:`), err.message);
                }
            }
            return group;
        },
        set(target, key, value) {
            if (typeof key === 'string') {
                groupsCache.set(key, value);
            }
            return true;
        },
        deleteProperty(target, key) {
            if (typeof key === 'string') {
                groupsCache.del(key);
                try {
                    conn.prepare("DELETE FROM groups WHERE jid = ?").run(key);
                } catch (err) {
                    console.error(chalk.red(`[SubBot DB ${senderId}] Error eliminando grupo ${key} de SQLite:`), err.message);
                }
            }
            return true;
        },
        has(target, key) {
            if (typeof key !== 'string') return false;
            if (groupsCache.has(key)) return true;
            try {
                const row = conn.prepare("SELECT 1 FROM groups WHERE jid = ?").get(key);
                return !!row;
            } catch {
                return false;
            }
        },
        ownKeys() {
            try {
                const rows = conn.prepare("SELECT jid FROM groups").all();
                const keys = new Set(rows.map(r => r.jid));
                const cachedKeys = groupsCache.keys();
                for (const k of cachedKeys) keys.add(k);
                return Array.from(keys);
            } catch {
                return groupsCache.keys();
            }
        },
        getOwnPropertyDescriptor() {
            return {
                enumerable: true,
                configurable: true
            };
        }
    });

    const usersProxy = new Proxy({}, {
        get(target, key) {
            if (typeof key !== 'string' || key === 'toJSON' || key === 'then') return target[key];
            
            let user = usersCache.get(key);
            if (!user) {
                try {
                    const row = conn.prepare("SELECT data FROM users WHERE jid = ?").get(key);
                    if (row) {
                        user = JSON.parse(row.data);
                        usersCache.set(key, user);
                    }
                } catch (err) {
                    console.error(chalk.red(`[SubBot DB ${senderId}] Error cargando usuario ${key} de SQLite:`), err.message);
                }
            }
            return user;
        },
        set(target, key, value) {
            if (typeof key === 'string') {
                usersCache.set(key, value);
            }
            return true;
        },
        deleteProperty(target, key) {
            if (typeof key === 'string') {
                usersCache.del(key);
                try {
                    conn.prepare("DELETE FROM users WHERE jid = ?").run(key);
                } catch (err) {
                    console.error(chalk.red(`[SubBot DB ${senderId}] Error eliminando usuario ${key} de SQLite:`), err.message);
                }
            }
            return true;
        },
        has(target, key) {
            if (typeof key !== 'string') return false;
            if (usersCache.has(key)) return true;
            try {
                const row = conn.prepare("SELECT 1 FROM users WHERE jid = ?").get(key);
                return !!row;
            } catch {
                return false;
            }
        },
        ownKeys() {
            try {
                const rows = conn.prepare("SELECT jid FROM users").all();
                const keys = new Set(rows.map(r => r.jid));
                const cachedKeys = usersCache.keys();
                for (const k of cachedKeys) keys.add(k);
                return Array.from(keys);
            } catch {
                return usersCache.keys();
            }
        },
        getOwnPropertyDescriptor() {
            return {
                enumerable: true,
                configurable: true
            };
        }
    });

    // Ensure defaults inherit from the main database if available
    let mainDb = {};
    try {
        mainDb = getDBSync();
    } catch (e) {
        console.warn(chalk.yellow(`[SubBot DB ${senderId}] No se pudo obtener la DB principal, usando valores por defecto.`));
    }

    const defaults = [
        ['prefix', mainDb.prefix || '.'],
        ['owners', mainDb.owners || [`${senderId}@s.whatsapp.net`]],
        ['ownerRoles', mainDb.ownerRoles || {}],
        ['maxSubBots', 0],
        ['botName', 'Aura Reed'],
        ['customBanner', null]
    ];

    const stmtSelect = conn.prepare("SELECT key FROM config WHERE key = ?");
    const stmtInsert = conn.prepare("INSERT INTO config(key, value) VALUES(?, ?)");

    for (const [key, defaultValue] of defaults) {
        const row = stmtSelect.get(key);
        if (!row) {
            stmtInsert.run(key, JSON.stringify(defaultValue));
        }
    }

    // Load config
    const configRows = conn.prepare("SELECT key, value FROM config").all();
    const dbData = {};
    for (const row of configRows) {
        try {
            dbData[row.key] = JSON.parse(row.value);
        } catch {
            dbData[row.key] = row.value;
        }
    }

    const dbCache = {
        prefix: dbData.prefix ?? '.',
        owners: dbData.owners || [`${senderId}@s.whatsapp.net`],
        ownerRoles: dbData.ownerRoles || {},
        maxSubBots: dbData.maxSubBots ?? 0,
        botName: dbData.botName ?? 'Aura Reed',
        customBanner: dbData.customBanner ?? null
    };

    const db = {
        ...dbCache,
        groups: groupsProxy,
        users: usersProxy
    };

    subBotInstances.set(senderId, {
        conn,
        db,
        dbCache,
        groupsCache,
        usersCache,
        groupsProxy,
        usersProxy,
        saveTimer: null,
        saving: false
    });

    console.log(chalk.gray(`[SubBot DB ${senderId}] SQLite3 & Node-Cache Inicializado`));
    return db;
}

export async function saveSubBotDB(senderId, data, options = {}) {
    const inst = subBotInstances.get(senderId);
    if (!inst) return;

    if (data && typeof data === 'object') {
        const { groups, users, ...dbData } = data;

        if (Object.keys(dbData).length > 0) {
            inst.dbCache = { ...inst.dbCache, ...dbData };
            Object.assign(inst.db, dbData);
        }

        if (groups && typeof groups === 'object' && groups !== inst.groupsProxy) {
            for (const [key, value] of Object.entries(groups)) {
                inst.groupsCache.set(key, value);
            }
        }

        if (users && typeof users === 'object' && users !== inst.usersProxy) {
            for (const [key, value] of Object.entries(users)) {
                inst.usersCache.set(key, value);
            }
        }
    }

    if (inst.saveTimer) clearTimeout(inst.saveTimer);

    const writeDbFiles = () => {
        try {
            const prefix = inst.dbCache.prefix ?? '.';
            const owners = inst.dbCache.owners || [`${senderId}@s.whatsapp.net`];
            const maxSubBots = inst.dbCache.maxSubBots ?? 0;
            const ownerRoles = inst.dbCache.ownerRoles || {};
            const botName = inst.dbCache.botName ?? 'Aura Reed';
            const customBanner = inst.dbCache.customBanner ?? null;

            const cachedGroups = inst.groupsCache.keys();
            const cachedUsers = inst.usersCache.keys();

            inst.conn.transaction(() => {
                const configUpdates = [
                    ['prefix', prefix],
                    ['owners', owners],
                    ['maxSubBots', maxSubBots],
                    ['ownerRoles', ownerRoles],
                    ['botName', botName],
                    ['customBanner', customBanner]
                ];
                const stmtConfig = inst.conn.prepare("INSERT INTO config(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
                for (const [k, v] of configUpdates) {
                    stmtConfig.run(k, JSON.stringify(v));
                }

                const stmtGroup = inst.conn.prepare("INSERT INTO groups(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data");
                for (const jid of cachedGroups) {
                    const gd = inst.groupsCache.get(jid);
                    if (gd) stmtGroup.run(jid, JSON.stringify(gd));
                }

                const stmtUser = inst.conn.prepare("INSERT INTO users(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data");
                for (const jid of cachedUsers) {
                    const ud = inst.usersCache.get(jid);
                    if (ud) stmtUser.run(jid, JSON.stringify(ud));
                }
            })();

            console.log(chalk.gray(`[SubBot DB ${senderId}] SQLite3 Guardado`));
        } catch (err) {
            console.error(chalk.red(`[SubBot DB ${senderId}] Error en writeDbFiles:`), err.message);
        }
    };

    if (options.immediate) {
        if (inst.saving) return;
        inst.saving = true;
        try {
            writeDbFiles();
        } finally {
            inst.saving = false;
        }
        return;
    }

    inst.saveTimer = setTimeout(() => {
        inst.saveTimer = null;
        if (inst.saving) return;
        inst.saving = true;
        try {
            writeDbFiles();
        } finally {
            inst.saving = false;
        }
    }, 800);
}

export async function flushAllSubBotDBs() {
    console.log(chalk.gray('[SubBot DB] Guardando todas las bases de datos de sub-bots activas...'));
    for (const [senderId, inst] of subBotInstances.entries()) {
        try {
            if (inst.saveTimer) {
                clearTimeout(inst.saveTimer);
                inst.saveTimer = null;
            }
            
            const prefix = inst.dbCache.prefix ?? '.';
            const owners = inst.dbCache.owners || [`${senderId}@s.whatsapp.net`];
            const maxSubBots = inst.dbCache.maxSubBots ?? 0;
            const ownerRoles = inst.dbCache.ownerRoles || {};
            const botName = inst.dbCache.botName ?? 'Aura Reed';
            const customBanner = inst.dbCache.customBanner ?? null;

            const cachedGroups = inst.groupsCache.keys();
            const cachedUsers = inst.usersCache.keys();

            inst.conn.transaction(() => {
                const configUpdates = [
                    ['prefix', prefix],
                    ['owners', owners],
                    ['maxSubBots', maxSubBots],
                    ['ownerRoles', ownerRoles],
                    ['botName', botName],
                    ['customBanner', customBanner]
                ];
                const stmtConfig = inst.conn.prepare("INSERT INTO config(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value=excluded.value");
                for (const [k, v] of configUpdates) {
                    stmtConfig.run(k, JSON.stringify(v));
                }

                const stmtGroup = inst.conn.prepare("INSERT INTO groups(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data");
                for (const jid of cachedGroups) {
                    const gd = inst.groupsCache.get(jid);
                    if (gd) stmtGroup.run(jid, JSON.stringify(gd));
                }

                const stmtUser = inst.conn.prepare("INSERT INTO users(jid, data) VALUES(?, ?) ON CONFLICT(jid) DO UPDATE SET data=excluded.data");
                for (const jid of cachedUsers) {
                    const ud = inst.usersCache.get(jid);
                    if (ud) stmtUser.run(jid, JSON.stringify(ud));
                }
            })();

            inst.conn.close();
            console.log(chalk.gray(`[SubBot DB ${senderId}] Flushed y cerrado correctamente.`));
        } catch (err) {
            console.error(chalk.red(`[SubBot DB ${senderId}] Error en flush:`), err.message);
        }
    }
    subBotInstances.clear();
}

// --- Caché de Metadatos de Grupo ---

export function wrapGroupMetadataCache(sock) {
    const originalGroupMetadata = sock.groupMetadata.bind(sock);
    
    sock.groupMetadata = async (jid) => {
        const botId = sock.user?.id ? sock.user.id.split('@')[0].split(':')[0] : 'bot';
        const cacheKey = `${botId}:${jid}`;
        const cached = metadataCache.get(cacheKey);
        const now = Date.now();
        
        if (cached && (now - cached.timestamp < METADATA_TTL)) {
            cached.timestamp = now; // Actualizar timestamp para mantenerlo caliente
            return cached.metadata;
        }
        
        const metadata = await originalGroupMetadata(jid);
        metadataCache.set(cacheKey, {
            metadata,
            timestamp: now
        });
        return metadata;
    };
}

export function clearGroupMetadataCache(sock, jid) {
    const botId = sock.user?.id ? sock.user.id.split('@')[0].split(':')[0] : 'bot';
    metadataCache.delete(`${botId}:${jid}`);
}

// Intervalo de limpieza cada 60 segundos
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of metadataCache.entries()) {
        if (now - value.timestamp > METADATA_TTL) {
            metadataCache.delete(key);
        }
    }
}, 60000);