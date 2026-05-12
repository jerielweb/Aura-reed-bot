import { Rstr } from '../../controllers/textBots.js';

export default {
    name: ['onlyadmin', 'soloadmin', 'adminonly'],
    category: 'group',
    description: 'Activar o desactivar el modo "solo administradores" en el grupo.',
    adminOnly: true,
    execute: async (socket, message, args, { db, saveDB }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) return;

        if (!db.groups[remoteJid]) {
            db.groups[remoteJid] = { antilink: false, warnLimit: 3, warns: {}, activity: {}, onlyAdmin: false };
        }

        const status = args[0]?.toLowerCase();

        if (status === 'on' || status === '1' || status === 'true') {
            db.groups[remoteJid].onlyAdmin = true;
            saveDB(db);
            await socket.sendMessage(remoteJid, { text: '✅ Modo *Solo Administradores* activado.\n\nAhora solo los administradores y owners podran usar los comandos del grupo.' }, { quoted: message });
        } else if (status === 'off' || status === '0' || status === 'false') {
            db.groups[remoteJid].onlyAdmin = false;
            saveDB(db);
            await socket.sendMessage(remoteJid, { text: '❌ Modo *Solo Administradores* desactivado.\n\nTodos los miembros (excepto para comandos que requieren admin) podran usar comandos.' }, { quoted: message });
        } else {
            const currentStatus = db.groups[remoteJid].onlyAdmin ? '✅ Activado' : '❌ Desactivado';
            await socket.sendMessage(remoteJid, { text: `ℹ️ Modo *Solo Administradores*: ${currentStatus}\n\nUso:\n*.onlyadmin on* - Para activar\n*.onlyadmin off* - Para desactivar` }, { quoted: message });
        }
    }
};
