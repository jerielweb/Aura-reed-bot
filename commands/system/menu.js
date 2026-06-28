import fs from 'fs';
import { fytBold } from "../../models/TextStyle.js";
import { prepareWAMessageMedia, generateWAMessageFromContent } from '@whiskeysockets/baileys';
import { categories, Aliases } from "./../../controllers/consts/cat.js";

const mediaCacheMap = new Map();

export default {
    name: ['menu', 'help', 'h'],
    description: 'Muestra el menú completo.',
    async execute(sock, m, args, { prefix, db }) {
        const BannerBot = './assets/img/BotBanner.png';
        const BannerBotMp3 = './assets/audio/menu_music.opus';
        const remoteJid = m.key.remoteJid;
        const pushName = m.pushName || 'Usuario';
        const botName = db.botName || 'Aura Reed';
        const botType = sock.isSubBot ? 'Sub-Bot' : 'Principal';
        const tituloEstilizado = fytBold(`${botName.toUpperCase()} BOT`);
        const chanellink = global.chanellink || 'https://api.alyacore.xyz/a/10bfc2';

        const categoryAliases = Aliases;

        const requested = args && args[0] ? args[0].toLowerCase() : null;
        let requestedCategory = null;
        if (requested) {
            requestedCategory = categoryAliases[requested] || requested;
        }

        let textoMenu = `╭━━〔 ${tituloEstilizado} 〕━━⬣\n`
        textoMenu += `┃ > ${fytBold('Usuario:')} @${pushName}\n`
        textoMenu += `┃ > ${fytBold('Bot:')} ${botName} (${botType})\n`
        textoMenu += `┃ > ${fytBold('Version:')} ${global.version}\n`
        textoMenu += `┃ > ${fytBold('Owner:')} Jeriel B.\n`
        textoMenu += `┃ > ${fytBold('Prefix:')} [ ${prefix} ]\n`
        textoMenu += `┃ > ${fytBold('Fecha:')} ${new Date().toLocaleDateString('es-CR')}\n`
        textoMenu += `┃ > ${fytBold('Url:')} ${chanellink}\n`
        textoMenu += `╰━━━━━━━━━━━━━━━━━━⬣\n\n`;

        const catsToShow = requestedCategory ? [requestedCategory] : categories;

        if (requestedCategory && !categories.includes(requestedCategory)) {
            let textErr = `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n`;
            textErr += `┃ ❌ ${fytBold('CATEGORÍA NO ENCONTRADA')}\n`;
            textErr += `╰━━━━━━━━━━━━⬣\n\n`;
            textErr += `> Categorías disponibles:\n`;
            textErr += `${categories.join('\n')}\n\n`;
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
        textoMenu += `╰〔 ⚡ ${fytBold(botName.toUpperCase() + ' BOT')} 〕⬣\n\n`;


        let bannerPath = BannerBot;
        let isGif = false;
        if (db.customBanner && db.customBanner.path && fs.existsSync(db.customBanner.path)) {
            bannerPath = db.customBanner.path;
            isGif = db.customBanner.mimetype?.includes('gif') || bannerPath.endsWith('.gif');
        }

        let imgBanner = mediaCacheMap.get(bannerPath);
        if (!imgBanner && fs.existsSync(bannerPath)) {
            try {
                const mediaType = isGif ? { video: fs.readFileSync(bannerPath) } : { image: fs.readFileSync(bannerPath) };
                const mediaBanner = await prepareWAMessageMedia(
                    mediaType,
                    { upload: sock.waUploadToServer, mediaTypeOverride: "thumbnail-link" }
                );
                imgBanner = isGif ? mediaBanner.videoMessage : mediaBanner.imageMessage;
                if (imgBanner) {
                    mediaCacheMap.set(bannerPath, imgBanner);
                }
            } catch (err) {
                console.error('[menu.js] Error al preparar media del banner:', err);
            }
        }

        const getTs = (ts) => typeof ts === "object" ? Number(ts.low || ts) : Number(ts);

const content = {
            extendedTextMessage: {
                text: textoMenu,
                // Usamos un dominio espejo de alta confianza para obligar al cliente a renderizar el banner grande
                matchedText: chanellink,
                canonicalUrl: chanellink,
                description: "✦ 𝓐𝓾𝓻𝓪 𝓡𝓮𝓮𝓭 𝓟𝓸𝔀𝓮𝓻𝓮𝓭 𝓑𝔂 𝓙𝓮𝓻𝓲𝓮𝓵 𝓑. ✦",
                title: `${botName.toUpperCase()} BOT`,
                previewType: 1, // Mantiene la orden de renderizado expandido
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
                        newsletterName: "⋆ 𝔸𝕦𝕣𝕒 ℝ𝕖𝕖𝕕 ℂ𝕙𝕒𝕟𝕖𝕝𝕝 𝕆𝕗𝕚𝕔𝕚𝕒𝕝 ⋆",
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
