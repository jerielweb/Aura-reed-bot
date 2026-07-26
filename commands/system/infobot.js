import fs from "fs";
import os from "os";
import { fytBold } from "../../models/TextStyle.js";
import {
  prepareWAMessageMedia,
  generateWAMessageFromContent,
} from "@whiskeysockets/baileys";
import { categories } from "./../../controllers/consts/cat.js";

const mediaCacheMap = new Map();

// Función auxiliar para formatear el tiempo activo (Uptime)
function formatUptime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d > 0 ? d + "d " : ""}${h}h ${m}m ${s}s`;
}

// Función para contar el total de comandos disponibles en las carpetas
function getTotalCommands() {
  let total = 0;
  for (const cat of categories) {
    const folderPath = `./commands/${cat}`;
    if (fs.existsSync(folderPath)) {
      const files = fs
        .readdirSync(folderPath)
        .filter((file) => file.endsWith(".js"));
      total += files.length;
    }
  }
  return total;
}

export default {
  name: ["infobot", "botinfo", "info"],
  category: "info",
  description: "Muestra la información detallada y estadísticas del bot.",
  async execute(sock, m, args, { prefix, db }) {
    const BannerBot = "./assets/img/BotBanner.png";
    const remoteJid = m.key.remoteJid;
    const pushName = m.pushName || "Usuario";
    const botName = db.botName || "Aura Reed";
    const botType = sock.isSubBot ? "Sub-Bot" : "Principal";
    const tituloEstilizado = fytBold(`${botName.toUpperCase()} BOT`);
    const chanellink = global.chanellink || "https://api.alyacore.xyz/a/10bfc2";

    // Datos del sistema
    const platform = `${os.type()} (${os.arch()})`;
    const uptime = formatUptime(process.uptime());
    const totalCmds = getTotalCommands();
    const ramUsed = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2);
    const ramTotal = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);

    // Estructura visual de la UI idéntica al Menú
    let textoInfo = `╭━━〔 ${tituloEstilizado} 〕━━⬣\n`;
    textoInfo += `┃ > ${fytBold("Usuario:")} @${pushName}\n`;
    textoInfo += `┃ > ${fytBold("Bot:")} ${botType}\n`;
    textoInfo += `┃ > ${fytBold("Version:")} ${global.version || "1.0.0"}\n`;
    textoInfo += `┃ > ${fytBold("Owner:")} Jeriel B.\n`;
    textoInfo += `┃ > ${fytBold("Prefix:")} [ ${prefix} ]\n`;
    textoInfo += `┃ > ${fytBold("Fecha:")} ${new Date().toLocaleDateString("es-CR")}\n`;
    textoInfo += `┃ > ${fytBold("Url:")} ${chanellink}\n`;
    textoInfo += `╰━━━━━━━━━━━━━━━━━━⬣\n\n`;

    textoInfo += `┏━━〔 ${fytBold("ESTADÍSTICAS DEL SISTEMA")} 〕━━⬣\n`;
    textoInfo += `┃ ➪ ${fytBold("VPS / Sistema:")}\n┃ ✦ ${platform}\n\n`;
    textoInfo += `┃ ➪ ${fytBold("Tiempo Activo:")}\n┃ ✦ ${uptime}\n\n`;
    textoInfo += `┃ ➪ ${fytBold("Total Comandos:")}\n┃ ✦ ${totalCmds} comandos cargados\n\n`;
    textoInfo += `┃ ➪ ${fytBold("Uso de Memoria:")}\n┃ ✦ ${ramUsed} MB / ${ramTotal} GB\n\n`;
    textoInfo += `┃ ➪ ${fytBold("Estado de Instancia:")}\n┃ ✦ ${botType} - Operativo 🟢\n\n`;
    textoInfo += `╰〔 ⚡ ${fytBold(botName.toUpperCase() + " BOT")} 〕⬣\n\n`;

    // Carga de imagen para la vista previa
    let bannerPath = BannerBot;
    let isGif = false;
    if (
      db.customBanner &&
      db.customBanner.path &&
      fs.existsSync(db.customBanner.path)
    ) {
      bannerPath = db.customBanner.path;
      isGif =
        db.customBanner.mimetype?.includes("gif") ||
        bannerPath.endsWith(".gif");
    }

    let imgBanner = mediaCacheMap.get(bannerPath);
    if (!imgBanner && fs.existsSync(bannerPath)) {
      try {
        const mediaType = isGif
          ? { video: fs.readFileSync(bannerPath) }
          : { image: fs.readFileSync(bannerPath) };
        const mediaBanner = await prepareWAMessageMedia(mediaType, {
          upload: sock.waUploadToServer,
          mediaTypeOverride: "thumbnail-link",
        });
        imgBanner = isGif ? mediaBanner.videoMessage : mediaBanner.imageMessage;
        if (imgBanner) {
          mediaCacheMap.set(bannerPath, imgBanner);
        }
      } catch (err) {
        console.error("[infobot.js] Error al preparar media del banner:", err);
      }
    }

    const getTs = (ts) =>
      typeof ts === "object" ? Number(ts.low || ts) : Number(ts);

    // Renderizado del mensaje extendido con link preview y canal
    const content = {
      extendedTextMessage: {
        text: textoInfo,
        matchedText: chanellink,
        canonicalUrl: chanellink,
        description: "✦ 𝓐𝓾𝓻𝓪 𝓡𝓮𝓮𝓭 𝓟𝓸𝔀𝓮𝓻𝓮𝓭 𝓑𝔂 𝓙𝓮𝓻𝓲𝓮𝓵 𝓑. ✦",
        title: `${botName.toUpperCase()} BOT - SYSTEM INFO`,
        previewType: 1,
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
            serverMessageId: -1,
          },
        },
      },
    };

    const waMsg = generateWAMessageFromContent(remoteJid, content, {
      userJid: sock.user?.id,
      quoted: m,
    });

    await sock.relayMessage(remoteJid, waMsg.message, {
      messageId: waMsg.key.id,
    });
  },
};
