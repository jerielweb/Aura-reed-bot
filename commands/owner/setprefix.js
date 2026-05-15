import Settings from '../../models/settings.js';
export default {
    name: [ 'setprefix', 'prefix' ],
    description: 'Modifica prefijo.',
    async execute(sock, m, args, { db, saveDB }) {
        const newPrefix = args[0];
        if (!newPrefix) {
            let text = `╭〔 ℹ️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ ⚙️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Defina el prefijo que\n`;
            text += `┃ > desea utilizar.\n\n`;
            text += `┣━━━━━━━━━━━━⬣\n\n`;
            text += `┃ ➪ Ejemplo: ${db.prefix}setprefix #\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            return sock.sendMessage(m.key.remoteJid, { text }, { quoted: m });
        }

        db.prefix = newPrefix;
        saveDB(db);
        
        let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
        text += `┃ ⚙️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > El prefijo ha sido\n`;
        text += `┃ > actualizado a: ${newPrefix}\n\n`;
        text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

        await sock.sendMessage(m.key.remoteJid, { text }, { quoted: m });
    }
};