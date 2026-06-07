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
        const categories = ['system', 'owner', 'group', 'fun', 'utils', 'downloads', 'search', 'economy', 'sticker', 'profile', 'interaction', 'AI'];
        const tituloEstilizado = fytBold('AURA REED BOT');
        const chanellink = global.chanellink;

        // Mapear alias en español a carpetas en el proyecto
        const categoryAliases = {
            'descargas': 'downloads',
            'descarga': 'downloads',
            'sistema': 'system',
            'propietario': 'owner',
            'dueño': 'owner',
            'owner': 'owner',
            'grupo': 'group',
            'grupos': 'group',
            'diversion': 'fun',
            'diversiones': 'fun',
            'diversión': 'fun',
            'utilidades': 'utils',
            'utiles': 'utils',
            'busqueda': 'search',
            'buscador': 'search',
            'economia': 'economy',
            'economía': 'economy',
            'pegatinas': 'sticker',
            'stickers': 'sticker',
            'perfil': 'profile',
            'interacion': 'interaction',
            'interacciones': 'interaction',
            'interacción': 'interaction',
            'IA': 'AI',
            'ai': 'AI',
            'inteligencia artificial': 'AI',
            'inteligenciaartificial': 'AI'
        };

        const requested = args && args[0] ? args[0].toLowerCase() : null;
        let requestedCategory = null;
        if (requested) {
            requestedCategory = categoryAliases[requested] || requested;
        }

        let textoMenu = `
╭━━〔 ${tituloEstilizado} 〕━━⬣

┃ 👤 ${fytBold('Usuario:')} @${pushName}
┃ 🤖 ${fytBold('Bot:')} Aura Reed
┃ ⚡ ${fytBold('Version:')} ${global.version}
┃ 👑 ${fytBold('Owner:')} Jeriel B.
┃ ⚡ ${fytBold('Prefix:')} [ ${prefix} ]
┃ 📆 ${fytBold('Fecha:')} ${new Date().toLocaleDateString('es-CR')}
┃ 💬 ${fytBold('Channel:')} ${chanellink}
\n`;

        // Si se solicitó una categoría específica
        const catsToShow = requestedCategory ? [requestedCategory] : categories;

        // Validar categoría solicitada
        if (requestedCategory && !categories.includes(requestedCategory)) {
            let textErr = `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n`;
            textErr += `┃ ❌ ${fytBold('CATEGORÍA NO ENCONTRADA')}\n`;
            textErr += `╰━━━━━━━━━━━━⬣\n\n`;
            textErr += `┃ > Categorías disponibles:\n`;
            textErr += `┃ > ${categories.join(', ')}\n\n`;
            textErr += `╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣`;
            return await sock.sendMessage(remoteJid, { text: textErr }, { quoted: m });
        }

        for (const cat of catsToShow) {
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
                                    ? cmd.name.map(n => prefix + n).slice(0, 3).join(' • ')
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
        if (!requestedCategory) {
            textoMenu += `┏━━〔 ${fytBold('OTROS COMANDOS')} 〕━━⬣\n`;
            textoMenu += `┃ ➪ ${fytBold(prefix + 'menu <categoría>')}\n`;
            textoMenu += `┃ ✦ Muestra el menú de una categoría específica.\n\n`;
        }
        textoMenu += `╰〔 ⚡ ${fytBold('AURA REED BOT')} 〕⬣\n`;

        await sock.sendMessage(remoteJid, {
            image: { url: BannerBot },
            caption: textoMenu,
            mentions: [m.key.participant || remoteJid]
        }, { quoted: m });

        // Si el usuario pidió una categoría específica, evitamos el audio para no saturar
        if (!requestedCategory) {
            await sock.sendMessage(remoteJid, {
                audio: fs.readFileSync(BannerBotMp3),
                ptt: true,
                mimetype: 'audio/ogg; codecs=opus'
            }, { quoted: m });
        }
    }
}; 