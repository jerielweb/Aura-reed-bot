import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

const DATABASE_DIR = path.resolve('./database');
const DB_FILE = path.join(DATABASE_DIR, 'database.json');
const USERS_FILE = path.join(DATABASE_DIR, 'users.json');
const GROUPS_FILE = path.join(DATABASE_DIR, 'groups.json');
const DB_BACKUP_FILE = path.join(DATABASE_DIR, 'database.backup.json');
const GROUPS_BACKUP_FILE = path.join(DATABASE_DIR, 'groups.backup.json');
const USERS_BACKUP_FILE = path.join(DATABASE_DIR, 'users.backup.json');
const SAVE_DELAY_MS = 800;

let dbCache = null;
let groupsCache = null;
let usersCache = null;
let saveTimer = null;
let saving = false;
let initialized = false;

const DEFAULT_DB_CONFIG = {
    prefix: ".",
    owners: [
        "50670375314@s.whatsapp.net",
        "50577839681@s.whatsapp.net",
        "5214183357841@s.whatsapp.net",
        "50578391933@s.whatsapp.net"
    ],
    maxSubBots: 20,
    ownerRoles: {
        "50577839681@s.whatsapp.net": "Diseñador",
        "5214183357841@s.whatsapp.net": "Colaborador",
        "50578391933@s.whatsapp.net": "Soporte"
    }
};

async function ensureDir() {
    await fs.mkdir(DATABASE_DIR, { recursive: true });
}

async function readJson(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf-8');
        if (!raw || raw.trim().length === 0) return null;
        return JSON.parse(raw);
    } catch (err) {
        console.warn(chalk.yellow(`[DB] Error leyendo ${path.basename(filePath)}: ${err.message}`));
        return null;
    }
}

async function atomicWrite(filePath, data) {
    const tempFile = filePath + '.tmp';
    const content = JSON.stringify(data, null, 2);
    if (!content || content.trim().length === 0) {
        throw new Error(`Intento de escribir archivo vacio: ${filePath}`);
    }
    await fs.writeFile(tempFile, content, 'utf-8');
    await fs.rename(tempFile, filePath);
}

async function restoreFromBackup(backupPath, targetPath) {
    try {
        const backup = await readJson(backupPath);
        if (backup && Object.keys(backup).length > 0) {
            await atomicWrite(targetPath, backup);
            console.log(chalk.gray(`[DB] ${path.basename(targetPath)} restaurado desde backup`));
            return true;
        }
    } catch (err) {
        console.warn(chalk.yellow(`[DB] No se pudo restaurar ${path.basename(targetPath)}: ${err.message}`));
    }
    return false;
}

async function ensureFiles() {
    await ensureDir();

    const defaults = [
        [DB_FILE, DEFAULT_DB_CONFIG],
        [USERS_FILE, { users: {} }],
        [GROUPS_FILE, { groups: {} }]
    ];

    for (const [file, defaultContent] of defaults) {
        try {
            await fs.access(file);
            const data = await readJson(file);
            if (!data) {
                console.warn(chalk.yellow(`[DB] Archivo vacio/corrupto: ${path.basename(file)} - Restaurando...`));
                const backupMap = {
                    [DB_FILE]: DB_BACKUP_FILE,
                    [USERS_FILE]: USERS_BACKUP_FILE,
                    [GROUPS_FILE]: GROUPS_BACKUP_FILE
                };
                const restored = await restoreFromBackup(backupMap[file], file);
                if (!restored) {
                    await atomicWrite(file, defaultContent);
                }
            }
        } catch {
            await atomicWrite(file, defaultContent);
        }
    }

    const backupDefaults = [
        [DB_BACKUP_FILE, DEFAULT_DB_CONFIG],
        [GROUPS_BACKUP_FILE, { groups: {} }],
        [USERS_BACKUP_FILE, { users: {} }]
    ];
    for (const [file, content] of backupDefaults) {
        try {
            await fs.access(file);
        } catch {
            await atomicWrite(file, content);
        }
    }
}

export async function initDB() {
    if (initialized && dbCache && groupsCache && usersCache) {
        return { ...dbCache, groups: groupsCache, users: usersCache };
    }

    await ensureFiles();

    let dbData = await readJson(DB_FILE);
    let usersData = await readJson(USERS_FILE);
    let groupsData = await readJson(GROUPS_FILE);

    if (!dbData || !dbData.owners || dbData.owners.length === 0) {
        console.warn(chalk.yellow('[DB] Configuracion invalida, restaurando desde backup...'));
        const restored = await restoreFromBackup(DB_BACKUP_FILE, DB_FILE);
        if (restored) dbData = await readJson(DB_FILE);
        if (!dbData || !dbData.owners || dbData.owners.length === 0) {
            dbData = { ...DEFAULT_DB_CONFIG };
        }
    }

    if (!usersData || !usersData.users) {
        const restored = await restoreFromBackup(USERS_BACKUP_FILE, USERS_FILE);
        if (restored) usersData = await readJson(USERS_FILE);
        if (!usersData || !usersData.users) usersData = { users: {} };
    }

    if (!groupsData || !groupsData.groups) {
        const restored = await restoreFromBackup(GROUPS_BACKUP_FILE, GROUPS_FILE);
        if (restored) groupsData = await readJson(GROUPS_FILE);
        if (!groupsData || !groupsData.groups) groupsData = { groups: {} };
    }

    dbCache = {
        prefix: dbData.prefix ?? DEFAULT_DB_CONFIG.prefix,
        owners: dbData.owners || DEFAULT_DB_CONFIG.owners,
        ownerRoles: dbData.ownerRoles || {},
        maxSubBots: dbData.maxSubBots ?? DEFAULT_DB_CONFIG.maxSubBots
    };

    groupsCache = groupsData.groups;
    usersCache = usersData.users;
    initialized = true;

    const groupCount = Object.keys(groupsCache).length;
    const userCount = Object.keys(usersCache).length;
    console.log(chalk.gray(`[DB] Inicializado: ${groupCount} grupos, ${userCount} usuarios globales`));

    return { ...dbCache, groups: groupsCache, users: usersCache };
}

export async function getDB() {
    if (!initialized) {
        await initDB();
    }
    return { ...dbCache, groups: groupsCache, users: usersCache };
}

async function writeDbFiles(data) {
    if (!data || typeof data !== 'object') {
        console.error(chalk.red('[DB] Datos invalidos recibidos en writeDbFiles'));
        return;
    }

    try {
        const existingDb = await readJson(DB_FILE) || {};
        const existingGroups = await readJson(GROUPS_FILE) || { groups: {} };
        const existingUsers = await readJson(USERS_FILE) || { users: {} };

        const dbToSave = {
            prefix: data.prefix ?? existingDb.prefix ?? DEFAULT_DB_CONFIG.prefix,
            owners: (Array.isArray(data.owners) && data.owners.length > 0) 
                ? data.owners 
                : (existingDb.owners ?? DEFAULT_DB_CONFIG.owners),
            maxSubBots: Number.isFinite(Number(data.maxSubBots)) 
                ? Number(data.maxSubBots) 
                : (existingDb.maxSubBots ?? DEFAULT_DB_CONFIG.maxSubBots),
            ownerRoles: data.ownerRoles ?? existingDb.ownerRoles ?? {}
        };

        let groupsToSave;
        if (data.groups && typeof data.groups === 'object' && Object.keys(data.groups).length > 0) {
            groupsToSave = data.groups;
        } else if (existingGroups.groups && Object.keys(existingGroups.groups).length > 0) {
            groupsToSave = existingGroups.groups;
        } else {
            groupsToSave = {};
        }

        let usersToSave;
        if (data.users && typeof data.users === 'object' && Object.keys(data.users).length > 0) {
            usersToSave = data.users;
        } else if (existingUsers.users && Object.keys(existingUsers.users).length > 0) {
            usersToSave = existingUsers.users;
        } else {
            usersToSave = {};
        }

        const existingGroupsCount = Object.keys(existingGroups.groups || {}).length;
        const existingUsersCount = Object.keys(existingUsers.users || {}).length;
        const newGroupsCount = Object.keys(groupsToSave).length;
        const newUsersCount = Object.keys(usersToSave).length;

        if (existingGroupsCount > 0 && newGroupsCount === 0) {
            console.error(chalk.red('[DB] BLOQUEADO: Intento de borrar todos los grupos. Abortando escritura de groups.'));
            groupsToSave = existingGroups.groups;
        }

        if (existingUsersCount > 0 && newUsersCount === 0) {
            console.error(chalk.red('[DB] BLOQUEADO: Intento de borrar todos los usuarios. Abortando escritura de users.'));
            usersToSave = existingUsers.users;
        }

        if (Object.keys(groupsToSave).length > 0) {
            await atomicWrite(GROUPS_BACKUP_FILE, { groups: groupsToSave });
        }
        if (Object.keys(usersToSave).length > 0) {
            await atomicWrite(USERS_BACKUP_FILE, { users: usersToSave });
        }
        if (existingDb && Object.keys(existingDb).length > 0) {
            await atomicWrite(DB_BACKUP_FILE, existingDb);
        }

        await atomicWrite(DB_FILE, dbToSave);
        await atomicWrite(USERS_FILE, { users: usersToSave });
        await atomicWrite(GROUPS_FILE, { groups: groupsToSave });

        console.log(chalk.gray(`[DB] Guardado: DB config, ${Object.keys(groupsToSave).length} grupos, ${Object.keys(usersToSave).length} usuarios`));

    } catch (err) {
        console.error(chalk.red('[DB] Error CRITICO en writeDbFiles:'), err.message);
        throw err;
    }
}

export async function saveDB(data, options = {}) {
    if (data && typeof data === 'object') {
        const { groups, users, ...dbData } = data;

        if (Object.keys(dbData).length > 0) {
            dbCache = { ...dbCache, ...dbData };
        }

        if (groups && typeof groups === 'object' && Object.keys(groups).length > 0) {
            groupsCache = groups;
        }

        if (users && typeof users === 'object' && Object.keys(users).length > 0) {
            usersCache = users;
        }
    }

    if (saveTimer) clearTimeout(saveTimer);

    if (options.immediate) {
        if (saving) return;
        saving = true;
        try {
            const toSave = { ...dbCache, groups: groupsCache, users: usersCache };
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
            const toSave = { ...dbCache, groups: groupsCache, users: usersCache };
            await writeDbFiles(toSave);
        } catch (err) {
            console.error(chalk.red('[DB] Error guardando base de datos:'), err.message);
        } finally {
            saving = false;
        }
    }, SAVE_DELAY_MS);
}

export async function flushDB() {
    console.log(chalk.gray('[DB] Flushing database...'));

    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }

    if (!initialized || !dbCache) {
        console.warn(chalk.yellow('[DB] DB no inicializada en flushDB'));
        return;
    }

    try {
        const toSave = { 
            ...dbCache, 
            groups: groupsCache || {}, 
            users: usersCache || {} 
        };
        await writeDbFiles(toSave);
        console.log(chalk.gray('[DB] Flush completado exitosamente'));
    } catch (err) {
        console.error(chalk.red('[DB] ERROR CRITICO en flushDB:'), err.message);
    }
}