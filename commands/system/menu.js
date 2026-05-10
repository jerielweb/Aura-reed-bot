import fs from 'fs';

export default {
    name: ['menu', 'help', 'h', '?'],
    description: 'Muestra este menú de comandos',
    async execute(sock, m, args, { prefix }) {
        const remoteJid = m.key.remoteJid;
        const pushName = m.pushName || 'Usuario';

        const categories = ['system', 'owner', 'group', 'fun', 'utility'];

        let textoMenu = `
┏━━━━━━━━━━━━━━━━
┃ ✨ *HOLA, ${pushName.toUpperCase()}* ✨
┗━━━━━━━━━━━━━━━━
┃ 🤖 *BOTSITO:* Aᴜʀᴀ Rᴇᴇᴅ ʙᴏᴛ
┃ 🛠️ *PREFIJO:* [ *${prefix}* ]
┃ 📅 *FECHA:* ${new Date().toLocaleDateString('es-CR')}
┗━━━━━━━━━━━━━━━━

> *Lista de Comandos*
\n`;
        for (const cat of categories) {
            const folderPath = `./commands/${cat}`;

            if (fs.existsSync(folderPath)) {
                const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

                if (files.length > 0) {
                    textoMenu += `➢ *${cat.charAt(0).toUpperCase() + cat.slice(1)}*\n`;

                    for (const file of files) {
                        try {
                            const { default: cmd } = await import(`../${cat}/${file}?update=${Date.now()}`);

                            if (cmd && cmd.name) {
                                const formattedNames = Array.isArray(cmd.name)
                                    ? cmd.name.map(n => prefix + n).join(' • ')
                                    : prefix + cmd.name;
                                    textoMenu += `*\`${formattedNames}\`*\n`;
                                if (cmd.description) {
                                    textoMenu += `> ${cmd.description}\n`;
                                }
                            }
                        } catch (err) {
                            console.error(`Error al cargar ${file} en el menú:`, err);
                        }
                    }
                    textoMenu += `\n`;
                }
            }
        }

        textoMenu += `> Usa el prefijo antes de cada comando.`;

        await sock.sendMessage(remoteJid, {
            text: textoMenu,
            mentions: [m.key.participant || remoteJid]
        }, { quoted: m });
    }
};