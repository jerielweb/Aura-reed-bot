/**
 * Verifica si una categoría de comandos está habilitada para un grupo específico.
 */
export function isCategoryEnabled(remoteJid, category, db) {
    const protectedCategories = ['owner', 'group', 'system'];
    if (!remoteJid.endsWith('@g.us') || protectedCategories.includes(category)) return true;

    const groupData = db.groups[remoteJid];
    if (!groupData || !groupData.disabledCategories) return true;

    return !groupData.disabledCategories.includes(category);
}

/**
 * Comando para gestionar las categorías (activar/desactivar)
 */
export default {
    name: ['cmds', 'cmd', 'cmdmanager'],
    category: 'group',
    description: 'Activa o desactiva comandos',
    adminOnly: true,

    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return;

        if (!db.groups[remoteJid]) {
            db.groups[remoteJid] = { antilink: false, warnLimit: 3, warns: {}, activity: {}, onlyAdmin: false, antitoxic: false, disabledCategories: [] };
        }

        if (!db.groups[remoteJid].disabledCategories) {
            db.groups[remoteJid].disabledCategories = [];
        }

        const action = args[0]?.toLowerCase();
        const category = args[1]?.toLowerCase();

        const protectedCategories = ['owner', 'group', 'system'];
        const validCategories = ['fun', 'utility', 'downloads', 'search', 'economy'];

        if (!action || !category) {
            let text = `╭〔 ⚙️ 𝐂𝐌𝐃 𝐌𝐀𝐍𝐀𝐆𝐄𝐑 〕⬣\n`;
            text += `┃ 🛡️ 𝐆𝐄𝐒𝐓𝐈𝐎́𝐍 𝐃𝐄 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈́𝐀𝐒\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ➪ ${db.prefix}cmds on [cat]\n`;
            text += `┃ ✦ Habilitar comandos\n\n`;
            text += `┃ ➪ ${db.prefix}cmds off [cat]\n`; 
            text += `┃ ✦ Deshabilitar comandos\n\n`;
            text += `╭━━━━━━━━━━━━⬣\n`
            text += `┃ 📂 Commandos y Estado:\n`;
            validCategories.forEach(cat => {
                const isDisabled = db.groups[remoteJid].disabledCategories.includes(cat);
                text += `┃ > ${isDisabled ? '❌' : '✅'} ${cat}\n`;
            });
            text += `╰━━━━━━━━━━━━⬣\n`;
            text += `\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            return await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        if (protectedCategories.includes(category)) {
            return await socket.sendMessage(remoteJid, { text: '╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐀𝐂𝐂𝐈𝐎́𝐍 𝐏𝐑𝐎𝐇𝐈𝐁𝐈𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > No puedes desactivar las\n┃ > categorías de administración.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣' }, { quoted: message });
        }

        if (!validCategories.includes(category)) {
            return await socket.sendMessage(remoteJid, { text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈́𝐀 𝐈𝐍𝐕𝐀́𝐋𝐈𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > La categoría *${category}*\n┃ > no existe.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` }, { quoted: message });
        }

        if (action === 'on') {
            db.groups[remoteJid].disabledCategories = db.groups[remoteJid].disabledCategories.filter(c => c !== category);
            saveDB(db);
            let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ 🛡️ 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈́𝐀 𝐇𝐀𝐁𝐈𝐋𝐈𝐓𝐀𝐃𝐀\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > La categoría *${category}* ha\n`;
            text += `┃ > sido habilitada con éxito.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        } else if (action === 'off') {
            if (!db.groups[remoteJid].disabledCategories.includes(category)) {
                db.groups[remoteJid].disabledCategories.push(category);
            }
            saveDB(db);
            let text = `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ 🛡️ 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈́𝐀 𝐁𝐋𝐎𝐐𝐔𝐄𝐀𝐃𝐀\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > La categoría *${category}* ha\n`;
            text += `┃ > sido bloqueada en este grupo.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }
    }
};
