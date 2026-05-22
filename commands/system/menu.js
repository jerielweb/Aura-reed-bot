import fs from 'fs';
import { fytBold } from "../../models/TextStyle.js";

export default {
    name: ['menu', 'help', 'h'],
    description: 'Muestra el menú completo.',
    async execute(sock, m, args, { prefix }) {
        const BannerBot = './assets/img/BotBanner.png'
        const BannerBotMp3 = './assets/audio/menu_music.opus'
        const remoteJid = m.key.remoteJid;
        const pushName = m.pushName || 'Usuario';
        const categories = ['system', 'owner', 'group', 'fun', 'utility', 'downloads', 'search', 'economy', 'sticker'];
        const tituloEstilizado = fytBold('AURA REED BOT');
        const chanellink = global.chanellink;

        let textoMenu = `
╭━━〔 ${tituloEstilizado} 〕━━⬣

┃ 👤 ${fytBold('Usuario:')} @${pushName}
┃ 🤖 ${fytBold('Bot:')} Aura Reed
┃ ⚡ ${fytBold('Version:')} ${global.version}
┃ 👑 ${fytBold('Owner:')} Oboe Boy
┃ ⚡ ${fytBold('Prefix:')} [ ${prefix} ]
┃ 📆 ${fytBold('Fecha:')} ${new Date().toLocaleDateString('es-CR')}
┃ 💬 ${fytBold('Channel:')} ${chanellink}
\n`;
        for (const cat of categories) {
            const folderPath = `./commands/${cat}`;

            if (fs.existsSync(folderPath)) {
                const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));

                if (files.length > 0) {
                    textoMenu += `┏━━〔 ${fytBold(cat.charAt(0).toUpperCase() + cat.slice(1))} 〕━━⬣\n`;

                    for (const file of files) {
                        try {
                            const { default: cmd } = await import(`../${cat}/${file}?update=${Date.now()}`);

                            if (cmd && cmd.name) {
                                const formattedNames = Array.isArray(cmd.name)
                                    ? cmd.name.map(n => prefix + n).join(' • ')
                                    : prefix + cmd.name;
                                    textoMenu += `┃ ➪ ${fytBold(formattedNames)}\n`;
                                if (cmd.description) {
                                    textoMenu += `┃ ✦ ${cmd.description}\n\n`;
                                }
                            }
                        } catch (err) {
                            console.error(`Error al cargar ${file} en el menú:`, err);
                        }
                    }
                }
            }
        }

        await sock.sendMessage(remoteJid, {
            image: { url: BannerBot },
            caption: textoMenu,
            mentions: [m.key.participant || remoteJid]
        }, { quoted: m });

        await sock.sendMessage(remoteJid, {
            audio: fs.readFileSync(BannerBotMp3),
            ptt: true,
            mimetype: 'audio/ogg; codecs=opus'
        }, { quoted: m });
    }
}; 