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

async function ensureFiles() {
    await fs.mkdir(DATABASE_DIR, { recursive: true });

    const defaultDatabase = JSON.stringify(DEFAULT_DB_CONFIG, null, 2);
    const defaultUsers = JSON.stringify({ users: {} }, null, 2);
    const defaultGroups = JSON.stringify({ groups: {} }, null, 2);

    for (const [file, content] of [[DB_FILE, defaultDatabase], [USERS_FILE, defaultUsers], [GROUPS_FILE, defaultGroups]]) {
        try {
            const existing = await fs.readFile(file, 'utf-8');
            if (!existing || existing.trim().length === 0) {
                console.warn(chalk.yellow(`[DB] Archivo vacio detectado: ${path.basename(file)} - Recreando...`));
                await fs.writeFile(file, content, 'utf-8');
            } else {
                JSON.parse(existing);
            }
        } catch (err) {
            console.warn(chalk.yellow(`[DB] Error validando ${path.basename(file)}: ${err.message}`));
            if (file === GROUPS_FILE) {
                const backupRestored = await restoreGroupsFromBackup();
                if (!backupRestored) {
                    await fs.writeFile(file, content, 'utf-8');
                }
            } else if (file === USERS_FILE) {
                const backupRestored = await restoreUsersFromBackup();
                if (!backupRestored) {
                    await fs.writeFile(file, content, 'utf-8');
                }
            } else {
                await fs.writeFile(file, content, 'utf-8');
            }
        }
    }

    for (const [file, content] of [[DB_BACKUP_FILE, defaultDatabase], [GROUPS_BACKUP_FILE, defaultGroups], [USERS_BACKUP_FILE, defaultUsers]]) {
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
    } catch (err) {
        console.warn(chalk.yellow(`[DB] Error leyendo ${path.basename(filePath)}: ${err.message}`));
        return null;
    }
}

async function restoreGroupsFromBackup() {
    try {
        const backup = await readJson(GROUPS_BACKUP_FILE);
        if (backup && backup.groups && Object.keys(backup.groups).length > 0) {
            await fs.writeFile(GROUPS_FILE, JSON.stringify(backup, null, 2), 'utf-8');
            console.log(chalk.gray('[DB] groups.json restaurado desde backup'));
            return true;
        }
    } catch (err) {
        console.warn(chalk.yellow(`[DB] No se pudo restaurar groups.json desde backup: ${err.message}`));
    }
    return false;
}

async function restoreUsersFromBackup() {
    try {
        const backup = await readJson(USERS_BACKUP_FILE);
        if (backup && backup.users && Object.keys(backup.users).length > 0) {
            await fs.writeFile(USERS_FILE, JSON.stringify(backup, null, 2), 'utf-8');
            console.log(chalk.gray('[DB] users.json restaurado desde backup'));
            return true;
        }
    } catch (err) {
        console.warn(chalk.yellow(err.message));
    }
    return false;
}

export async function initDB() {
    if (dbCache && groupsCache && usersCache) {
        return { ...dbCache, groups: groupsCache, users: usersCache };
    }

    await ensureFiles();

    let dbData = await readJson(DB_FILE) || {};
    let usersData = await readJson(USERS_FILE) || { users: {} };
    let groupsData = await readJson(GROUPS_FILE) || { groups: {} };

    if ((!groupsData || !groupsData.groups || Object.keys(groupsData.groups || {}).length === 0)) {
        console.warn(chalk.yellow('[DB] Groups vacio detectado en initDB, intentando restaurar desde backup'));
        const backupRestored = await restoreGroupsFromBackup();
        if (backupRestored) {
            const restored = await readJson(GROUPS_FILE) || { groups: {} };
            groupsData.groups = restored.groups;
        }
    }

    if ((!usersData || !usersData.users || Object.keys(usersData.users || {}).length === 0)) {
        console.warn(chalk.yellow('[DB] Users vacio detectado en initDB, intentando restaurar desde backup'));
        const backupRestored = await restoreUsersFromBackup();
        if (backupRestored) {
            const restored = await readJson(USERS_FILE) || { users: {} };
            usersData.users = restored.users;
        }
    }

    if (!dbData || !dbData.owners || dbData.owners.length === 0) {
        console.warn(chalk.yellow('[DB] Configuracion invalida detectada en initDB, usando valores por defecto'));
        dbCache = { ...DEFAULT_DB_CONFIG };
    } else {
        dbCache = {
            prefix: dbData.prefix ?? DEFAULT_DB_CONFIG.prefix,
            owners: dbData.owners || DEFAULT_DB_CONFIG.owners,
            ownerRoles: dbData.ownerRoles || {},
            maxSubBots: dbData.maxSubBots ?? DEFAULT_DB_CONFIG.maxSubBots
        };
    }

    groupsCache = (groupsData?.groups && typeof groupsData.groups === 'object') ? groupsData.groups : {};
    usersCache = (usersData?.users && typeof usersData.users === 'object') ? usersData.users : {};

    const groupCount = Object.keys(groupsCache).length;
    const userCount = Object.keys(usersCache).length;
    console.log(chalk.gray(`[DB] Inicializado: ${groupCount} grupos, ${userCount} usuarios globales`));

    return { ...dbCache, groups: groupsCache, users: usersCache };
}

export async function getDB() {
    if (!dbCache) {
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
        const existingDb = await readJson(DB_FILE);
        const existingGroups = await readJson(GROUPS_FILE) || { groups: {} };
        const existingUsers = await readJson(USERS_FILE) || { users: {} };

        if (!existingGroups || !existingGroups.groups) {
            console.error(chalk.red('[DB] ALERTA: existingGroups corrupto, intentando restaurar'));
            existingGroups.groups = existingGroups.groups || {};
        }

        if (!existingUsers || !existingUsers.users) {
            console.error(chalk.red('[DB] ALERTA: existingUsers corrupto, intentando restaurar'));
            existingUsers.users = existingUsers.users || {};
        }

        const existingGroupsCount = Object.keys(existingGroups.groups || {}).length;
        const existingUsersCount = Object.keys(existingUsers.users || {}).length;

        const dbToSave = {
            prefix: (data.prefix && data.prefix.length > 0) ? data.prefix : (existingDb?.prefix ?? DEFAULT_DB_CONFIG.prefix),
            owners: (Array.isArray(data.owners) && data.owners.length > 0) ? data.owners : (existingDb?.owners ?? DEFAULT_DB_CONFIG.owners),
            maxSubBots: Number.isFinite(Number(data.maxSubBots)) ? Number(data.maxSubBots) : (existingDb?.maxSubBots ?? DEFAULT_DB_CONFIG.maxSubBots)
        };

        if (data.ownerRoles && Object.keys(data.ownerRoles).length > 0) {
            dbToSave.ownerRoles = data.ownerRoles;
        } else if (existingDb?.ownerRoles) {
            dbToSave.ownerRoles = existingDb.ownerRoles;
        }

        if (!dbToSave.owners || dbToSave.owners.length === 0) {
            dbToSave.owners = DEFAULT_DB_CONFIG.owners;
            console.warn(chalk.yellow('[DB] Owners vacio detectado durante guardado, usando valores por defecto'));
        }

        let groupsToSave;
        const incomingGroupsCount = data.groups ? Object.keys(data.groups).length : 0;

        if (incomingGroupsCount > 0) {
            groupsToSave = data.groups;
            console.log(chalk.gray(`[DB] Groups actualizado correctamente (${incomingGroupsCount} grupos)`));
        } else if (existingGroupsCount > 0) {
            groupsToSave = existingGroups.groups;
        } else {
            groupsToSave = {};
        }

        let usersToSave;
        const incomingUsersCount = data.users ? Object.keys(data.users).length : 0;

        if (incomingUsersCount > 0) {
            usersToSave = data.users;
            console.log(chalk.gray(`[DB] Users actualizado correctamente (${incomingUsersCount} usuarios)`));
        } else if (existingUsersCount > 0) {
            usersToSave = existingUsers.users;
        } else {
            usersToSave = {};
        }

        if (!groupsToSave || typeof groupsToSave !== 'object') {
            console.error(chalk.red('[DB] ALERTA: groupsToSave invalido, restaurando desde existentes'));
            groupsToSave = existingGroups.groups || {};
        }

        if (!usersToSave || typeof usersToSave !== 'object') {
            console.error(chalk.red('[DB] ALERTA: usersToSave invalido, restaurando desde existentes'));
            usersToSave = existingUsers.users || {};
        }

        if (Object.keys(groupsToSave).length > 0) {
            try {
                await fs.writeFile(GROUPS_BACKUP_FILE, JSON.stringify({ groups: groupsToSave }, null, 2), 'utf-8');
            } catch (e) {
                console.error(chalk.red('[DB] ERROR guardando backup de groups:'), e.message);
            }
        }

        if (Object.keys(usersToSave).length > 0) {
            try {
                await fs.writeFile(USERS_BACKUP_FILE, JSON.stringify({ users: usersToSave }, null, 2), 'utf-8');
            } catch (e) {
                console.error(chalk.red('[DB] ERROR guardando backup de users:'), e.message);
            }
        }

        if (existingDb && Object.keys(existingDb).length > 0) {
            try {
                await fs.writeFile(DB_BACKUP_FILE, JSON.stringify(existingDb, null, 2), 'utf-8');
            } catch (e) {
                console.warn(chalk.yellow('[DB] Error guardando backup de database:'), e.message);
            }
        }

        const filesToWrite = [
            { file: DB_FILE, data: JSON.stringify(dbToSave, null, 2) },
            { file: USERS_FILE, data: JSON.stringify({ users: usersToSave }, null, 2) },
            { file: GROUPS_FILE, data: JSON.stringify({ groups: groupsToSave }, null, 2) }
        ];

        for (const { file, data: content } of filesToWrite) {
            if (!content || content.trim().length === 0) {
                console.error(chalk.red(`[DB] ERROR: Intento de escribir archivo VACIO: ${path.basename(file)}`));
                throw new Error(`Intento de escribir archivo vacio: ${file}`);
            }
        }

        for (const { file, data: content } of filesToWrite) {
            try {
                await fs.writeFile(file, content, 'utf-8');
                console.log(chalk.gray(`[DB] Guardado: ${path.basename(file)}`));
            } catch (err) {
                console.error(chalk.red(`[DB] Error CRITICO escribiendo ${path.basename(file)}:`), err.message);
                throw err;
            }
        }

        const verifyDb = await readJson(DB_FILE);
        const verifyGroups = await readJson(GROUPS_FILE);
        const verifyUsers = await readJson(USERS_FILE);

        if (!verifyDb || !verifyDb.owners || verifyDb.owners.length === 0) {
            console.error(chalk.red('[DB] POST-VALIDACION FALLO: database.json no tiene owners'));
            throw new Error(chalk.red('Post-validacion fallo: database.json incompleto'));
        }

        const verifyGroupsCount = verifyGroups?.groups ? Object.keys(verifyGroups.groups).length : 0;
        const verifyUsersCount = verifyUsers?.users ? Object.keys(verifyUsers.users).length : 0;

        if (verifyGroupsCount !== incomingGroupsCount && incomingGroupsCount > 0) {
            console.warn(chalk.yellow(`[DB] POST-VALIDACION: Groups mismatch (escrito: ${verifyGroupsCount}, esperado: ${incomingGroupsCount})`));
        }

        if (verifyUsersCount !== incomingUsersCount && incomingUsersCount > 0) {
            console.warn(chalk.yellow(`[DB] POST-VALIDACION: Users mismatch (escrito: ${verifyUsersCount}, esperado: ${incomingUsersCount})`));
        }

    } catch (err) {
        console.error(chalk.red('[DB] Error CRITICO en writeDbFiles:'), err.message);
        throw err;
    }
}

export async function saveDB(data, options = {}) {
    if (data && typeof data === 'object') {
        const { groups, users, ...dbData } = data;

        dbCache = dbData;

        if (groups && typeof groups === 'object' && Object.keys(groups).length > 0) {
            groupsCache = groups;
        } else if (groups !== undefined && groups !== null) {
            console.warn(chalk.yellow('[DB] ANOMALIA: saveDB() recibio groups vacio, PRESERVANDO cache anterior'));
        }

        if (users && typeof users === 'object' && Object.keys(users).length > 0) {
            usersCache = users;
        } else if (users !== undefined && users !== null) {
            console.warn(chalk.yellow('[DB] ANOMALIA: saveDB() recibio users vacio, PRESERVANDO cache anterior'));
        }
    }

    if (saveTimer) clearTimeout(saveTimer);

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

    if (!dbCache) {
        console.warn(chalk.yellow('[DB] dbCache vacio en flushDB, nada que guardar'));
        return;
    }

    if (!groupsCache) {
        console.warn(chalk.yellow('[DB] groupsCache vacio en flushDB, usando cache vacio pero seguro'));
        groupsCache = {};
    }

    if (!usersCache) {
        console.warn(chalk.yellow('[DB] usersCache vacio en flushDB, usando cache vacio pero seguro'));
        usersCache = {};
    }

    try {
        const toSave = { ...dbCache, groups: groupsCache, users: usersCache };

        if (!toSave.groups || typeof toSave.groups !== 'object') {
            console.error(chalk.red('[DB] ALERTA EN FLUSH: groups invalido'));
            toSave.groups = groupsCache || {};
        }

        if (!toSave.users || typeof toSave.users !== 'object') {
            console.error(chalk.red('[DB] ALERTA EN FLUSH: users invalido'));
            toSave.users = usersCache || {};
        }

        console.log(chalk.gray(`[DB] Guardando: ${Object.keys(toSave.groups || {}).length} grupos, ${Object.keys(toSave.users || {}).length} usuarios`));
        await writeDbFiles(toSave);
        console.log(chalk.gray('[DB] Flush completado exitosamente'));
    } catch (err) {
        console.error(chalk.red('[DB] ERROR CRITICO en flushDB:'), err.message);
    }
}