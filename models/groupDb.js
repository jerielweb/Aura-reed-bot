export const DEFAULT_GROUP = {
    antilink: false,
    warnLimit: 3,
    warns: {},
    activity: {},
    onlyAdmin: false,
    antitoxic: false,
    welcome: false,
    disabledCategories: [],
    botOn: true,
    prefix: null,
    users: {}
};

const ECONOMY_FIELDS = new Set([
    'coins', 'bank', 'xp', 'level',
    'lastWork', 'lastDaily', 'lastWeekly', 'lastMonthly',
    'lastCrime', 'lastSlut', 'lastHunt', 'lastMine', 'lastPpt',
    'lastSteal', 'lastAdventure'
]);

/** Elimina campos de economía del almacén global de usuarios (solo queda data global como Subs). */
export function stripEconomyFromUsers(users = {}) {
    const cleaned = {};
    for (const [jid, data] of Object.entries(users)) {
        if (!data || typeof data !== 'object') continue;
        const globalData = {};
        for (const [key, value] of Object.entries(data)) {
            if (!ECONOMY_FIELDS.has(key)) globalData[key] = value;
        }
        if (Object.keys(globalData).length > 0) cleaned[jid] = globalData;
    }
    return cleaned;
}

export function ensureGroup(db, remoteJid) {
    if (!db.groups) db.groups = {};
    if (!db.groups[remoteJid]) {
        db.groups[remoteJid] = {
            ...DEFAULT_GROUP,
            warns: {},
            activity: {},
            users: {}
        };
    } else if (!db.groups[remoteJid].users) {
        db.groups[remoteJid].users = {};
    }
    return db.groups[remoteJid];
}

export function getGroupUsers(db, remoteJid) {
    return ensureGroup(db, remoteJid).users;
}

export function getGroupUser(db, remoteJid, jid, defaults = { coins: 0, bank: 0 }) {
    const users = getGroupUsers(db, remoteJid);
    if (!users[jid]) users[jid] = { ...defaults };
    return users[jid];
}

/** Registra un mensaje del usuario en la actividad mensual del grupo (para topactivos / topinactivos). */
export function trackGroupActivity(db, remoteJid, jid) {
    if (!remoteJid?.endsWith('@g.us') || !jid?.endsWith('@s.whatsapp.net')) return false;

    const group = ensureGroup(db, remoteJid);
    const monthKey = new Date().toISOString().slice(0, 7);

    if (!group.activity[monthKey] || typeof group.activity[monthKey] !== 'object') {
        group.activity[monthKey] = {};
    }

    const monthly = group.activity[monthKey];
    monthly[jid] = (monthly[jid] || 0) + 1;

    const user = getGroupUser(db, remoteJid, jid, { xp: 0, level: 1 });
    user.xp = (user.xp || 0) + 1;
    user.level = Math.floor(user.xp / 150) + 1;

    return true;
}
