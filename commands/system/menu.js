import fs from 'fs';
import { fyt } from "../../models/utils.js";

export default {
    name: ['menu', 'help', 'h'],
    description: 'Muestra el menú completo.',
    async execute(sock, m, args, { prefix }) {
        const BannerBot = './assets/img/BotBanner.png'
        const remoteJid = m.key.remoteJid;
        const pushName = m.pushName || 'Usuario';
        const categories = ['system', 'owner', 'group', 'fun', 'utility'];
        const tituloEstilizado = fyt('AURA REED BOT');

        let textoMenu = `
╭━━〔 ${tituloEstilizado} 〕━━⬣

┃ 👤 𝐔𝐬𝐮𝐚𝐫𝐢𝐨: @${m.pushName}
┃ 🤖 𝐁𝐨𝐭: 𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝
┃ 👑 𝐎𝐰𝐧𝐞𝐫: 𝐎𝐛𝐨𝐞 𝐁𝐨𝐲
┃ ⚡ 𝐏𝐫𝐞𝐟𝐢𝐱: [ ${prefix} ]
┃ 📆 𝐅𝐞𝐜𝐡𝐚: ${new Date().toLocaleDateString('es-CR')}
\n`;
        for (const cat of categories) {
            const folderPath = `./commands/${cat}`;

            if (fs.existsSync(folderPath)) {
                const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

                if (files.length > 0) {
                    textoMenu += `┏━━〔 ${fyt(cat.charAt(0).toUpperCase() + cat.slice(1))} 〕━━⬣\n`;

                    for (const file of files) {
                        try {
                            const { default: cmd } = await import(`../${cat}/${file}?update=${Date.now()}`);

                            if (cmd && cmd.name) {
                                const formattedNames = Array.isArray(cmd.name)
                                    ? cmd.name.map(n => prefix + n).join(' • ')
                                    : prefix + cmd.name;
                                    textoMenu += `┃ ➪ ${formattedNames}\n`;
                                if (cmd.description) {
                                    textoMenu += `┃ ✦ ${cmd.description}\n\n`;
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
            image: { url: BannerBot },
            caption: textoMenu,
            mentions: [m.key.participant || remoteJid]
        }, { quoted: m });
    }
};