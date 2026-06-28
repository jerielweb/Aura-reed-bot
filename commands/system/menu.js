import fs from 'fs';
import { fytBold } from "../../models/TextStyle.js";
import { prepareWAMessageMedia, generateWAMessageFromContent } from '@whiskeysockets/baileys';
import { categories, Aliases } from "./../../controllers/consts/cat.js";

let mediaCache = null;

export default {
    name: ['menu', 'help', 'h'],
    description: 'Muestra el menú completo.',
    async execute(sock, m, args, { prefix }) {
        const BannerBot = './assets/img/BotBanner.png';
        const BannerBotMp3 = './assets/audio/menu_music.opus';
        const remoteJid = m.key.remoteJid;
        const pushName = m.pushName || 'Usuario';
        const tituloEstilizado = fytBold('AURA REED BOT');
        const chanellink = global.chanellink || 'https://api.alyacore.xyz/a/10bfc2';

        const categoryAliases = Aliases;

        const requested = args && args[0] ? args[0].toLowerCase() : null;
        let requestedCategory = null;
        if (requested) {
            requestedCategory = categoryAliases[requested] || requested;
        }

        let textoMenu = `╭━━〔 ${tituloEstilizado} 〕━━⬣\n`
        textoMenu += `┃ 👤 ${fytBold('Usuario:')} @${pushName}\n`
        textoMenu += `┃ 🤖 ${fytBold('Bot:')} Aura Reed\n`
        textoMenu += `┃ ⚡ ${fytBold('Version:')} ${global.version}\n`
        textoMenu += `┃ 👑 ${fytBold('Owner:')} Jeriel B.\n`
        textoMenu += `┃ ⚡ ${fytBold('Prefix:')} [ ${prefix} ]\n`
        textoMenu += `┃ 📆 ${fytBold('Fecha:')} ${new Date().toLocaleDateString('es-CR')}\n`
        textoMenu += `╰━━━━━━━━━━━━━━━━━━⬣\n\n`;

        const catsToShow = requestedCategory ? [requestedCategory] : categories;

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
        textoMenu += `╰〔 ⚡ ${fytBold('AURA REED BOT')} 〕⬣\n\n`;

        textoMenu += `${chanellink}`;

        let imgBanner = mediaCache;
        if (!imgBanner && fs.existsSync(BannerBot)) {
            const mediaBanner = await prepareWAMessageMedia(
                { image: fs.readFileSync(BannerBot) },
                { upload: sock.waUploadToServer, mediaTypeOverride: "thumbnail-link" }
            );
            imgBanner = mediaBanner.imageMessage;
            mediaCache = imgBanner;
        }

        const getTs = (ts) => typeof ts === "object" ? Number(ts.low || ts) : Number(ts);

        const content = {
            extendedTextMessage: {
                text: textoMenu,
                matchedText: chanellink,
                canonicalUrl: chanellink,
                description: "Menú Oficial de Comandos e Información ✨",
                title: "AURA REED BOT",
                previewType: 0,
                jpegThumbnail: imgBanner?.jpegThumbnail,
                thumbnailDirectPath: imgBanner?.directPath,
                thumbnailSha256: imgBanner?.fileSha256,
                thumbnailEncSha256: imgBanner?.fileEncSha256,
                mediaKey: imgBanner?.mediaKey,
                mediaKeyTimestamp: imgBanner ? getTs(imgBanner.mediaKeyTimestamp) : 0,
                thumbnailHeight: imgBanner?.height || 1080,
                thumbnailWidth: imgBanner?.width || 1920,
                inviteLinkGroupTypeV2: 0,
                contextInfo: {
                    mentionedJid: [m.key.participant || remoteJid],
                    isForwarded: true,
                    forwardingScore: 1,
                    forwardedNewsletterMessageInfo: {
                        newsletterJid: "120363424808187278@newsletter",
                        newsletterName: "𝔸𝕦𝕣𝕒 ℂ𝕙𝕒𝕟𝕖𝕝 𝕆𝕗𝕚𝕔𝕚𝕒𝕝",
                        serverMessageId: -1
                    }
                }
            }
        };

        const waMsg = generateWAMessageFromContent(remoteJid, content, { userJid: sock.user?.id, quoted: m });
        await sock.relayMessage(remoteJid, waMsg.message, { messageId: waMsg.key.id });

        if (!requestedCategory && fs.existsSync(BannerBotMp3)) {
            await sock.sendMessage(remoteJid, {
                audio: fs.readFileSync(BannerBotMp3),
                ptt: true,
                mimetype: 'audio/ogg; codecs=opus'
            }, { quoted: m });
        }
    }
};
