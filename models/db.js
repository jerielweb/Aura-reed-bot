import fs from 'fs/promises';
import path from 'path';
import { stripEconomyFromUsers } from './groupDb.js';

const DATABASE_DIR = path.resolve('./database');
const DB_FILE = path.join(DATABASE_DIR, 'database.json');
const USERS_FILE = path.join(DATABASE_DIR, 'users.json');
const GROUPS_FILE = path.join(DATABASE_DIR, 'groups.json');
const DB_BACKUP_FILE = path.join(DATABASE_DIR, 'database.backup.json');
const SAVE_DELAY_MS = 800;

let dbCache = null;
let saveTimer = null;
let saving = false;

// Configuración por defecto con datos del propietario principal
const DEFAULT_DB_CONFIG = {
    prefix: ".",
    owners: [
        "50689237369@s.whatsapp.net",
        "50577839681@s.whatsapp.net",
        "5214183357841@s.whatsapp.net",
        "50578391933@s.whatsapp.net"
    ],
    maxSubBots: 20,
    ownerRoles: {
        "50577839681@s.whatsapp.net": "Diseñador",
        "5214183357841@s.whatsapp.net": "Colaborador",
        "50578391933@s.whatsapp.net": "Noticiero"
    }
};

async function ensureFiles() {
    await fs.mkdir(DATABASE_DIR, { recursive: true });
    
    const defaultDatabase = JSON.stringify(DEFAULT_DB_CONFIG, null, 2);
    const defaultUsers = JSON.stringify({ users: {} }, null, 2);
    const defaultGroups = JSON.stringify({ groups: {} }, null, 2);

    // Crear o validar archivos
    for (const [file, content] of [[DB_FILE, defaultDatabase], [USERS_FILE, defaultUsers], [GROUPS_FILE, defaultGroups]]) {
        try {
            const existing = await fs.readFile(file, 'utf-8');
            // Validar que el archivo no esté vacío o corrupto
            if (!existing || existing.trim().length === 0) {
                console.warn(`[DB] Archivo corrupto/vacío, restaurando: ${path.basename(file)}`);
                await fs.writeFile(file, content, 'utf-8');
            } else {
                // Intentar parsear para validar JSON válido
                JSON.parse(existing);
            }
        } catch (err) {
            console.warn(`[DB] Creando archivo por defecto: ${path.basename(file)}`);
            await fs.writeFile(file, content, 'utf-8');
        }
    }
    
    // Crear backup si no existe
    try {
        await fs.access(DB_BACKUP_FILE);
    } catch {
        console.log('[DB] Creando backup inicial');
        await fs.writeFile(DB_BACKUP_FILE, defaultDatabase, 'utf-8');
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
    // Si dbData está vacío o no tiene owners, restaurar desde backup o defecto
    if (!dbData || !dbData.owners || dbData.owners.length === 0) {
        console.warn('[DB] ⚠️ Datos corrupted detectados, usando configuración por defecto');
        dbData = DEFAULT_DB_CONFIG;
    }
    
    return {
        prefix: (dbData.prefix && dbData.prefix.length > 0) ? dbData.prefix : DEFAULT_DB_CONFIG.prefix,
        owners: (Array.isArray(dbData.owners) && dbData.owners.length > 0) ? dbData.owners : DEFAULT_DB_CONFIG.owners,
        ownerRoles: dbData.ownerRoles || {},
        maxSubBots: Number.isFinite(Number(dbData.maxSubBots)) ? Number(dbData.maxSubBots) : DEFAULT_DB_CONFIG.maxSubBots,
        users: stripEconomyFromUsers(usersData?.users || {}),
        groups: groupsData?.groups || {}
    };
}

async function writeDbFiles(data) {
    // Validación crítica
    if (!data || typeof data !== 'object') {
        console.error('[DB] ❌ Error: Datos inválidos, usando configuración de recuperación');
        data = await restoreFromBackup();
    }

    const roles = data.ownerRoles || {};
    const existing = await readJson(DB_FILE) || DEFAULT_DB_CONFIG;
    
    // Asegurar valores con fallbacks seguros
    const dbToSave = {
        prefix: (data.prefix && data.prefix.length > 0) ? data.prefix : existing.prefix ?? "/",
        owners: (Array.isArray(data.owners) && data.owners.length > 0) ? data.owners : existing.owners ?? DEFAULT_DB_CONFIG.owners,
        maxSubBots: Number.isFinite(Number(data.maxSubBots)) ? Number(data.maxSubBots) : (existing.maxSubBots ?? 1)
    };
    
    // Validación final: nunca permitir array vacío de owners
    if (!dbToSave.owners || dbToSave.owners.length === 0) {
        console.warn('[DB] ⚠️ Owners vacío, restaurando valores por defecto');
        dbToSave.owners = DEFAULT_DB_CONFIG.owners;
    }
    
    if (Object.keys(roles).length > 0) dbToSave.ownerRoles = roles;

    try {
        // Guardar backup antes de escribir
        const currentDb = await readJson(DB_FILE);
        if (currentDb && Object.keys(currentDb).length > 0) {
            await fs.writeFile(DB_BACKUP_FILE, JSON.stringify(currentDb, null, 2), 'utf-8');
        }
        
        // Escribir archivos
        await Promise.all([
            fs.writeFile(DB_FILE, JSON.stringify(dbToSave, null, 2), 'utf-8'),
            fs.writeFile(USERS_FILE, JSON.stringify({ users: stripEconomyFromUsers(data.users || {}) }, null, 2), 'utf-8'),
            fs.writeFile(GROUPS_FILE, JSON.stringify({ groups: data.groups || {} }, null, 2), 'utf-8')
        ]);
    } catch (err) {
        console.error('[DB] ❌ Error escribiendo archivos:', err.message);
        throw err;
    }
}

// Restaurar desde backup
async function restoreFromBackup() {
    console.warn('[DB] 🔄 Restaurando desde backup...');
    try {
        const backup = await readJson(DB_BACKUP_FILE);
        if (backup && Object.keys(backup).length > 0) {
            console.log('[DB] ✅ Backup restaurado exitosamente');
            return {
                prefix: backup.prefix ?? DEFAULT_DB_CONFIG.prefix,
                owners: backup.owners ?? DEFAULT_DB_CONFIG.owners,
                ownerRoles: backup.ownerRoles || {},
                maxSubBots: backup.maxSubBots ?? DEFAULT_DB_CONFIG.maxSubBots,
                users: {},
                groups: {}
            };
        }
    } catch (err) {
        console.error('[DB] Error leyendo backup:', err.message);
    }
    
    // Fallback final: usar configuración por defecto
    console.log('[DB] Usando configuración por defecto');
    return {
        prefix: DEFAULT_DB_CONFIG.prefix,
        owners: DEFAULT_DB_CONFIG.owners,
        ownerRoles: DEFAULT_DB_CONFIG.ownerRoles,
        maxSubBots: DEFAULT_DB_CONFIG.maxSubBots,
        users: {},
        groups: {}
    };
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
