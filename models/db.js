import fs from 'fs/promises';
import path from 'path';
import { stripEconomyFromUsers } from './groupDb.js';

const DATABASE_DIR = path.resolve('./database');
const DB_FILE = path.join(DATABASE_DIR, 'database.json');
const USERS_FILE = path.join(DATABASE_DIR, 'users.json');
const GROUPS_FILE = path.join(DATABASE_DIR, 'groups.json');
const SAVE_DELAY_MS = 800;

let dbCache = null;
let saveTimer = null;
let saving = false;

async function ensureFiles() {
    await fs.mkdir(DATABASE_DIR, { recursive: true });
    const defaultDatabase = JSON.stringify({ prefix: '.', owners: [], maxSubBots: 15 }, null, 2);
    const defaultUsers = JSON.stringify({ users: {} }, null, 2);
    const defaultGroups = JSON.stringify({ groups: {} }, null, 2);

    for (const [file, content] of [[DB_FILE, defaultDatabase], [USERS_FILE, defaultUsers], [GROUPS_FILE, defaultGroups]]) {
        try {
            await fs.access(file);
        } catch {
            await fs.writeFile(file, content, 'utf-8');
        }
    }
}

async function readJson(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function normalizeDbData(dbData, usersData, groupsData) {
    return {
        prefix: dbData?.prefix ?? '.',
        owners: Array.isArray(dbData?.owners) ? dbData.owners : [],
        ownerRoles: dbData?.ownerRoles || {},
        maxSubBots: Number.isFinite(Number(dbData?.maxSubBots)) ? Number(dbData.maxSubBots) : 15,
        users: stripEconomyFromUsers(usersData?.users || {}),
        groups: groupsData?.groups || {}
    };
}

async function writeDbFiles(data) {
    const roles = data.ownerRoles || {};
    const existing = await readJson(DB_FILE) || {};
    const dbToSave = {
        prefix: data.prefix,
        owners: data.owners,
        maxSubBots: data.maxSubBots ?? existing.maxSubBots ?? 15
    };
    if (Object.keys(roles).length > 0) dbToSave.ownerRoles = roles;

    await Promise.all([
        fs.writeFile(DB_FILE, JSON.stringify(dbToSave, null, 2), 'utf-8'),
        fs.writeFile(USERS_FILE, JSON.stringify({ users: stripEconomyFromUsers(data.users) }, null, 2), 'utf-8'),
        fs.writeFile(GROUPS_FILE, JSON.stringify({ groups: data.groups }, null, 2), 'utf-8')
    ]);
}

export async function initDB() {
    if (dbCache) return dbCache;
    await ensureFiles();
    const dbData = await readJson(DB_FILE) || {};
    const usersData = await readJson(USERS_FILE) || {};
    const groupsData = await readJson(GROUPS_FILE) || {};
    dbCache = normalizeDbData(dbData, usersData, groupsData);
    return dbCache;
}

export async function getDB() {
    if (!dbCache) {
        await initDB();
    }
    return dbCache;
}

export async function saveDB(data, options = {}) {
    dbCache = data;
    if (saveTimer) {
        clearTimeout(saveTimer);
    }
    if (options.immediate) {
        if (saving) return;
        saving = true;
        try {
            await writeDbFiles(data);
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
            await writeDbFiles(dbCache);
        } catch (err) {
            console.error('[DB] Error guardando base de datos:', err.message);
        } finally {
            saving = false;
        }
    }, SAVE_DELAY_MS);
}

export async function flushDB() {
    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }
    if (dbCache) {
        await writeDbFiles(dbCache);
    }
}
