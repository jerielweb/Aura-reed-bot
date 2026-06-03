import fs from 'fs/promises';
import path from 'path';
import { stripEconomyFromUsers } from './groupDb.js';

const DATABASE_DIR = path.resolve('./database');
const DB_FILE = path.join(DATABASE_DIR, 'database.json');
const USERS_FILE = path.join(DATABASE_DIR, 'users.json');
const GROUPS_FILE = path.join(DATABASE_DIR, 'groups.json');
const DB_BACKUP_FILE = path.join(DATABASE_DIR, 'database.backup.json');
const GROUPS_BACKUP_FILE = path.join(DATABASE_DIR, 'groups.backup.json');
const USERS_BACKUP_FILE = path.join(DATABASE_DIR, 'users.backup.json');  // 🔴 NUEVO
const SAVE_DELAY_MS = 800;

let dbCache = null;
let groupsCache = null;
let usersCache = null;  // 🔴 NUEVO: Caché separado para users
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
                console.warn(`[DB] ⚠️ Archivo vacío/corrupto detectado: ${path.basename(file)} - Recreando...`);
                await fs.writeFile(file, content, 'utf-8');
            } else {
                JSON.parse(existing); // Validar JSON
            }
        } catch (err) {
            console.warn(`[DB] ⚠️ Error validando ${path.basename(file)}: ${err.message}`);
            if (file === GROUPS_FILE) {
                // Intentar restaurar groups desde backup antes de recrear
                const backupRestored = await restoreGroupsFromBackup();
                if (!backupRestored) {
                    await fs.writeFile(file, content, 'utf-8');
                }
            } else {
                await fs.writeFile(file, content, 'utf-8');
            }
        }
    }

    // Crear backups iniciales si no existen
    try {
        await fs.access(DB_BACKUP_FILE);
    } catch {
        await fs.writeFile(DB_BACKUP_FILE, defaultDatabase, 'utf-8');
    }

    try {
        await fs.access(GROUPS_BACKUP_FILE);
    } catch {
        await fs.writeFile(GROUPS_BACKUP_FILE, defaultGroups, 'utf-8');
    }

    try {  // 🔴 NUEVO
        await fs.access(USERS_BACKUP_FILE);
    } catch {
        await fs.writeFile(USERS_BACKUP_FILE, defaultUsers, 'utf-8');
    }
}

async function readJson(filePath) {
    try {
        const raw = await fs.readFile(filePath, 'utf-8');
        return JSON.parse(raw);
    } catch (err) {
        console.warn(`[DB] ⚠️ Error leyendo ${path.basename(filePath)}: ${err.message}`);
        return null;
    }
}

async function restoreGroupsFromBackup() {
    try {
        const backup = await readJson(GROUPS_BACKUP_FILE);
        if (backup && backup.groups && Object.keys(backup.groups).length > 0) {
            await fs.writeFile(GROUPS_FILE, JSON.stringify(backup, null, 2), 'utf-8');
            console.log('[DB] ✅ groups.json restaurado desde backup');
            return true;
        }
    } catch (err) {
        console.warn('[DB] ⚠️ No se pudo restaurar groups.json desde backup:', err.message);
    }
    return false;
}

async function restoreUsersFromBackup() {  // 🔴 NUEVO
    try {
        const backup = await readJson(USERS_BACKUP_FILE);
        if (backup && backup.users && Object.keys(backup.users).length > 0) {
            await fs.writeFile(USERS_FILE, JSON.stringify(backup, null, 2), 'utf-8');
            console.log('[DB] ✅ users.json restaurado desde backup');
            return true;
        }
    } catch (err) {
        console.warn('[DB] ⚠️ No se pudo restaurar users.json desde backup:', err.message);
    }
    return false;
}

export async function initDB() {
    if (dbCache && groupsCache && usersCache) {
        // Ya está inicializado, retornar caché
        return { ...dbCache, groups: groupsCache, users: usersCache };
    }

    await ensureFiles();

    const dbData = await readJson(DB_FILE) || {};
    const usersData = await readJson(USERS_FILE) || { users: {} };
    const groupsData = await readJson(GROUPS_FILE) || { groups: {} };

    // 🔴 VALIDACIÓN: Si groups.json está vacío pero existe backup, restaurar
    if ((!groupsData || !groupsData.groups || Object.keys(groupsData.groups || {}).length === 0)) {
        console.warn('[DB] ⚠️ Groups vacío detectado en initDB, intentando restaurar desde backup');
        const backupRestored = await restoreGroupsFromBackup();
        if (backupRestored) {
            const restored = await readJson(GROUPS_FILE) || { groups: {} };
            groupsData.groups = restored.groups;
        }
    }

    // 🔴 VALIDACIÓN: Si users.json está vacío pero existe backup, restaurar
    if ((!usersData || !usersData.users || Object.keys(usersData.users || {}).length === 0)) {
        console.warn('[DB] ⚠️ Users vacío detectado en initDB, intentando restaurar desde backup');
        const backupRestored = await restoreUsersFromBackup();
        if (backupRestored) {
            const restored = await readJson(USERS_FILE) || { users: {} };
            usersData.users = restored.users;
        }
    }

    // Validar configuración
    if (!dbData || !dbData.owners || dbData.owners.length === 0) {
        console.warn('[DB] ⚠️ Configuración inválida detectada en initDB, usando valores por defecto');
        dbCache = { ...DEFAULT_DB_CONFIG };
    } else {
        dbCache = {
            prefix: dbData.prefix ?? DEFAULT_DB_CONFIG.prefix,
            owners: dbData.owners || DEFAULT_DB_CONFIG.owners,
            ownerRoles: dbData.ownerRoles || {},
            maxSubBots: dbData.maxSubBots ?? DEFAULT_DB_CONFIG.maxSubBots
        };
    }

    // Guardar groups y users en caché SEPARADO para mejor control
    // 🔴 ASEGURADO: Caché NUNCA serán null/undefined
    groupsCache = (groupsData?.groups && typeof groupsData.groups === 'object') ? groupsData.groups : {};
    usersCache = (usersData?.users && typeof usersData.users === 'object') ? usersData.users : {};

    // Log de estado inicial
    const groupCount = Object.keys(groupsCache).length;
    const userCount = Object.keys(usersCache).length;
    console.log(`[DB] ✅ Inicializado: ${groupCount} grupos, ${userCount} usuarios globales`);

    // Retornar objeto combinado para compatibilidad
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
        console.error('[DB] ❌ Datos inválidos recibidos en writeDbFiles');
        return;
    }

    try {
        // PRESERVAR datos existentes si el nuevo está vacío
        const existingDb = await readJson(DB_FILE);
        const existingGroups = await readJson(GROUPS_FILE) || { groups: {} };
        const existingUsers = await readJson(USERS_FILE) || { users: {} };  // 🔴 NUEVO

        // 🔴 VALIDACIÓN CRÍTICA: Verificar que datos existentes son válidos
        if (!existingGroups || !existingGroups.groups) {
            console.error('[DB] ❌ ALERTA CRÍTICA: existingGroups corrupto, intentando restaurar');
            existingGroups.groups = existingGroups.groups || {};
        }

        if (!existingUsers || !existingUsers.users) {  // 🔴 NUEVO
            console.error('[DB] ❌ ALERTA CRÍTICA: existingUsers corrupto, intentando restaurar');
            existingUsers.users = existingUsers.users || {};
        }

        const existingGroupsCount = Object.keys(existingGroups.groups || {}).length;
        const existingUsersCount = Object.keys(existingUsers.users || {}).length;  // 🔴 NUEVO

        // Preparar config (database.json)
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

        // Validación crítica: nunca permitir owners vacío
        if (!dbToSave.owners || dbToSave.owners.length === 0) {
            dbToSave.owners = DEFAULT_DB_CONFIG.owners;
            console.warn('[DB] ⚠️ Owners vacío detectado durante guardado, usando valores por defecto');
        }

        // 🔴 CRÍTICO: Preservar groups si el nuevo está vacío - CON DOBLE VALIDACIÓN
        let groupsToSave = data.groups;
        const incomingGroupsCount = groupsToSave ? Object.keys(groupsToSave).length : 0;

        if (!groupsToSave || (typeof groupsToSave === 'object' && Object.keys(groupsToSave).length === 0)) {
            if (existingGroupsCount > 0) {
                console.warn(`[DB] ⚠️ Groups vacío DETECTADO (incoming: ${incomingGroupsCount}, preservando: ${existingGroupsCount})`);
                groupsToSave = existingGroups.groups;
            } else {
                console.warn('[DB] ⚠️ Advertencia: groups vacío pero no hay grupos previos para preservar');
                groupsToSave = {};
            }
        } else {
            console.log(`[DB] ✅ Groups actualizado correctamente (${incomingGroupsCount} grupos)`);
        }

        // 🔴 NUEVO: Preservar users si el nuevo está vacío
        let usersToSave = data.users;
        const incomingUsersCount = usersToSave ? Object.keys(usersToSave).length : 0;

        if (!usersToSave || (typeof usersToSave === 'object' && Object.keys(usersToSave).length === 0)) {
            if (existingUsersCount > 0) {
                console.warn(`[DB] ⚠️ Users vacío DETECTADO (incoming: ${incomingUsersCount}, preservando: ${existingUsersCount})`);
                usersToSave = existingUsers.users;
            } else {
                console.warn('[DB] ⚠️ Advertencia: users vacío pero no hay usuarios previos para preservar');
                usersToSave = {};
            }
        } else {
            console.log(`[DB] ✅ Users actualizado correctamente (${incomingUsersCount} usuarios)`);
        }

        // 🔴 PROTECCIÓN EXTRA: Validar que groupsToSave sea válido antes de guardar
        if (!groupsToSave || typeof groupsToSave !== 'object') {
            console.error('[DB] ❌ ALERTA: groupsToSave inválido, restaurando desde existentes');
            groupsToSave = existingGroups.groups || {};
        }

        // 🔴 NUEVO: Validar que usersToSave sea válido
        if (!usersToSave || typeof usersToSave !== 'object') {
            console.error('[DB] ❌ ALERTA: usersToSave inválido, restaurando desde existentes');
            usersToSave = existingUsers.users || {};
        }

        // Hacer backup de groups ANTES de guardar (extra seguridad)
        if (groupsToSave && Object.keys(groupsToSave).length > 0) {
            try {
                const backupContent = JSON.stringify({ groups: groupsToSave }, null, 2);
                await fs.writeFile(GROUPS_BACKUP_FILE, backupContent, 'utf-8');
                console.log(`[DB] ✅ Backup groups: ${Object.keys(groupsToSave).length} grupos guardados`);
            } catch (e) {
                console.error('[DB] ❌ ERROR CRÍTICO guardando backup de groups:', e.message);
            }
        }

        // 🔴 NUEVO: Hacer backup de users ANTES de guardar
        if (usersToSave && Object.keys(usersToSave).length > 0) {
            try {
                const backupContent = JSON.stringify({ users: usersToSave }, null, 2);
                await fs.writeFile(USERS_BACKUP_FILE, backupContent, 'utf-8');
                console.log(`[DB] ✅ Backup users: ${Object.keys(usersToSave).length} usuarios guardados`);
            } catch (e) {
                console.error('[DB] ❌ ERROR CRÍTICO guardando backup de users:', e.message);
            }
        }

        // Hacer backup de database.json
        if (existingDb && Object.keys(existingDb).length > 0) {
            try {
                await fs.writeFile(DB_BACKUP_FILE, JSON.stringify(existingDb, null, 2), 'utf-8');
            } catch (e) {
                console.warn('[DB] ⚠️ Error guardando backup de database:', e.message);
            }
        }

        // Escribir archivos con validación
        const filesToWrite = [
            { file: DB_FILE, data: JSON.stringify(dbToSave, null, 2) },
            { file: USERS_FILE, data: JSON.stringify({ users: usersToSave }, null, 2) },  // 🔴 CAMBIO: usa usersToSave protegido
            { file: GROUPS_FILE, data: JSON.stringify({ groups: groupsToSave }, null, 2) }
        ];

        // 🔴 VALIDACIÓN FINAL: Verificar que ningún archivo quedará vacío
        for (const { file, data: content } of filesToWrite) {
            if (!content || content.trim().length === 0) {
                console.error(`[DB] ❌ ERROR: Intento de escribir archivo VACÍO: ${path.basename(file)}`);
                throw new Error(`Intento de escribir archivo vacío: ${file}`);
            }
        }

        // Escribir archivos
        for (const { file, data: content } of filesToWrite) {
            try {
                await fs.writeFile(file, content, 'utf-8');
                console.log(`[DB] ✅ Guardado: ${path.basename(file)}`);
            } catch (err) {
                console.error(`[DB] ❌ Error CRÍTICO escribiendo ${path.basename(file)}:`, err.message);
                throw err;
            }
        }

        // 🔴 POST-VALIDACIÓN: Verificar que los archivos se escribieron correctamente
        const verifyDb = await readJson(DB_FILE);
        const verifyGroups = await readJson(GROUPS_FILE);
        const verifyUsers = await readJson(USERS_FILE);  // 🔴 NUEVO

        if (!verifyDb || !verifyDb.owners || verifyDb.owners.length === 0) {
            console.error('[DB] ❌ POST-VALIDACIÓN FALLÓ: database.json no tiene owners');
            throw new Error('Post-validación falló: database.json incompleto');
        }

        const verifyGroupsCount = verifyGroups?.groups ? Object.keys(verifyGroups.groups).length : 0;
        const verifyUsersCount = verifyUsers?.users ? Object.keys(verifyUsers.users).length : 0;  // 🔴 NUEVO

        if (verifyGroupsCount !== incomingGroupsCount && incomingGroupsCount > 0) {
            console.warn(`[DB] ⚠️ POST-VALIDACIÓN: Groups mismatch (escrito: ${verifyGroupsCount}, esperado: ${incomingGroupsCount})`);
        }

        if (verifyUsersCount !== incomingUsersCount && incomingUsersCount > 0) {  // 🔴 NUEVO
            console.warn(`[DB] ⚠️ POST-VALIDACIÓN: Users mismatch (escrito: ${verifyUsersCount}, esperado: ${incomingUsersCount})`);
        }

    } catch (err) {
        console.error('[DB] ❌ Error CRÍTICO en writeDbFiles:', err.message);
        throw err;
    }
}

export async function saveDB(data, options = {}) {
    // 🔴 CRÍTICO: SIEMPRE preservar groups y users en caché, incluso si vacíos
    if (data && typeof data === 'object') {
        const { groups, users, ...dbData } = data;

        // Actualizar dbCache
        dbCache = dbData;

        // IMPORTANTE: Solo actualizar groupsCache si groups NO está vacío
        if (groups && typeof groups === 'object' && Object.keys(groups).length > 0) {
            groupsCache = groups;
        } else if (groups !== undefined && groups !== null) {
            console.warn('[DB] ⚠️ ANOMALÍA: saveDB() recibió groups vacío, PRESERVANDO caché anterior');
        }

        // IMPORTANTE: Solo actualizar usersCache si users NO está vacío
        if (users && typeof users === 'object' && Object.keys(users).length > 0) {
            usersCache = users;
        } else if (users !== undefined && users !== null) {
            console.warn('[DB] ⚠️ ANOMALÍA: saveDB() recibió users vacío, PRESERVANDO caché anterior');
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
            // ASEGURADO: Combinar caché actual con datos guardados
            const toSave = { ...dbCache, groups: groupsCache, users: usersCache };
            await writeDbFiles(toSave);
        } catch (err) {
            console.error('[DB] Error guardando base de datos:', err.message);
        } finally {
            saving = false;
        }
    }, SAVE_DELAY_MS);
}

export async function flushDB() {
    console.log('[DB] 🔄 Flushing database...');

    if (saveTimer) {
        clearTimeout(saveTimer);
        saveTimer = null;
    }

    // 🔴 CRÍTICO: Asegurar que tenemos datos antes de guardar
    if (!dbCache) {
        console.warn('[DB] ⚠️ dbCache vacío en flushDB, nada que guardar');
        return;
    }

    if (!groupsCache) {
        console.warn('[DB] ⚠️ groupsCache vacío en flushDB, usando caché vacío pero seguro');
        groupsCache = {};
    }

    if (!usersCache) {  // 🔴 NUEVO
        console.warn('[DB] ⚠️ usersCache vacío en flushDB, usando caché vacío pero seguro');
        usersCache = {};
    }

    try {
        const toSave = { ...dbCache, groups: groupsCache, users: usersCache };  // 🔴 ACTUALIZADO

        // Validación antes de guardar
        if (!toSave.groups || typeof toSave.groups !== 'object') {
            console.error('[DB] ❌ ALERTA EN FLUSH: groups inválido');
            toSave.groups = groupsCache || {};
        }

        if (!toSave.users || typeof toSave.users !== 'object') {  // 🔴 NUEVO
            console.error('[DB] ❌ ALERTA EN FLUSH: users inválido');
            toSave.users = usersCache || {};
        }

        console.log(`[DB] 💾 Guardando: ${Object.keys(toSave.groups || {}).length} grupos, ${Object.keys(toSave.users || {}).length} usuarios`);  // 🔴 ACTUALIZADO
        await writeDbFiles(toSave);
        console.log('[DB] ✅ Flush completado exitosamente');
    } catch (err) {
        console.error('[DB] ❌ ERROR CRÍTICO en flushDB:', err.message);
        // No lanzar error para permitir que el proceso cierre
    }
}
