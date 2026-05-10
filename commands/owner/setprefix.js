import Settings from '../../models/settings.js';
export default {
    name: [ 'setprefix', 'prefix' ],
    description: 'Cambia el prefijo de los comandos',
    async execute(sock, m, args, { db, saveDB }) {
        const newPrefix = args[0];
        if (!newPrefix) return sock.sendMessage(m.key.remoteJid, {
            text: `ℹ️ Defina el prefijo que quieres usar.\n> Ejemplo: *${db.prefix}setprefix #*
            `
        }, { quoted: m });

        db.prefix = newPrefix;
        saveDB(db);
        await sock.sendMessage(m.key.remoteJid, {
            text: `✅ El prefijo ahora es *${newPrefix}*`
        }, { quoted: m });
    }
};