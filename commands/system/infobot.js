import fs from "fs";
import os from "os";
import process from "process";
import { fytBold } from "../../models/TextStyle.js";
import {
  prepareWAMessageMedia,
  generateWAMessageFromContent,
} from "@whiskeysockets/baileys";
import { categories } from "./../../controllers/consts/cat.js";

const mediaCacheMap = new Map();

// Detecta el nombre del Servidor / Host
function getServerName() {
  const envName = process.env.SERVER_NAME || process.env.P_SERVER_LOCATION || process.env.P_SERVER_NAME;
  if (envName) return envName;

  const host = os.hostname();
  // Si es un ID de contenedor (hash largo o UUID)
  if (host.includes("-") || host.length > 20 || /^[a-f0-9]+$/i.test(host)) {
    return "Akirax Node ⚡";
  }

  return host;
}

// Detecta el Sistema Operativo real (Ej: Ubuntu 22.04 LTS / Linux arm64)
function getOperatingSystem() {
  try {
    if (fs.existsSync("/etc/os-release")) {
      const releaseData = fs.readFileSync("/etc/os-release", "utf8");
      const match = releaseData.match(/PRETTY_NAME="?([^"\n]+)"?/);
      if (match && match[1]) {
        return `${match[1]} (${os.arch()})`;
      }
    }
  } catch (e) {}
  return `${os.type()} ${os.release()} (${os.arch()})`;
}

// Helper para formatear bytes a GB
function formatBytes(bytes) {
  if (!bytes || isNaN(bytes) || bytes === Infinity) return "0.00";
  return (bytes / 1024 / 1024 / 1024).toFixed(2);
}

// Helper para formatear tiempo
function formatTime(seconds) {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return `${d > 0 ? d + "d " : ""}${h}h ${m}m ${s}s`;
}

// Lectura de RAM Real
function getMemoryInfo() {
  try {
    if (
      fs.existsSync("/sys/fs/cgroup/memory.max") &&
      fs.existsSync("/sys/fs/cgroup/memory.current")
    ) {
      let total = fs.readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
      let used = fs
        .readFileSync("/sys/fs/cgroup/memory.current", "utf8")
        .trim();

      if (total !== "max" && !isNaN(Number(total)) && Number(total) > 0) {
        return { total: Number(total), used: Number(used) };
      }
    }

    if (fs.existsSync("/sys/fs/cgroup/memory/memory.limit_in_bytes")) {
      const total = fs
        .readFileSync("/sys/fs/cgroup/memory/memory.limit_in_bytes", "utf8")
        .trim();
      const used = fs
        .readFileSync("/sys/fs/cgroup/memory/memory.usage_in_bytes", "utf8")
        .trim();

      if (
        !isNaN(Number(total)) &&
        Number(total) < 9223372036854771712 &&
        Number(total) > 0
      ) {
        return { total: Number(total), used: Number(used) };
      }
    }
  } catch (e) {}

  const used = process.memoryUsage().rss;
  const total = os.totalmem();
  return { total, used };
}

// Conteo total de comandos
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

    // ── DATOS DEL SISTEMA Y HOST ──
    const serverHost = getServerName();
    const osSystem = getOperatingSystem();
    const botUp = process.uptime();
    const totalCmds = getTotalCommands();

    // Memoria RAM Real
    const memory = getMemoryInfo();
    const ramTotal = formatBytes(memory.total);
    const ramUsed = formatBytes(memory.used);
    const ramBot = formatBytes(process.memoryUsage().rss);
    const ramPercent =
      memory.total > 0
        ? ((memory.used / memory.total) * 100).toFixed(1)
        : "0.0";

    // ── ESTRUCTURA VISUAL UI ──
    let textoInfo = `╭━━〔 ${tituloEstilizado} 〕━━⬣\n`;
    textoInfo += `┃ > ${fytBold("Usuario:")} @${pushName}\n`;
    textoInfo += `┃ > ${fytBold("Bot:")} ${botType}\n`;
    textoInfo += `┃ > ${fytBold("Version:")} ${global.version || "1.0.0"}\n`;
    textoInfo += `┃ > ${fytBold("Owner:")} Jeriel B.\n`;
    textoInfo += `┃ > ${fytBold("Prefix:")} [ ${prefix} ]\n`;
    textoInfo += `┃ > ${fytBold("Fecha:")} ${new Date().toLocaleDateString("es-CR")}\n`;
    textoInfo += `┃ > ${fytBold("Url:")} ${chanellink}\n`;
    textoInfo += `╰━━━━━━━━━━━━━━━━━━⬣\n\n`;

    textoInfo += `┏━━〔 ${fytBold("DETALLES DEL SISTEMA")} 〕━━⬣\n`;
    textoInfo += `┃ ➪ ${fytBold("Servidor / Host:")}\n┃ ✦ ${serverHost}\n\n`;
    textoInfo += `┃ ➪ ${fytBold("Sistema Operativo:")}\n┃ ✦ ${osSystem}\n\n`;
    textoInfo += `┃ ➪ ${fytBold("Tiempo Activo (Bot):")}\n┃ ✦ ${formatTime(botUp)}\n\n`;
    textoInfo += `┃ ➪ ${fytBold("RAM Servidor:")}\n┃ ✦ ${ramUsed} GB / ${ramTotal} GB (${ramPercent}%)\n\n`;
    textoInfo += `┃ ➪ ${fytBold("RAM Bot:")}\n┃ ✦ ${ramBot} GB\n\n`;
    textoInfo += `┃ ➪ ${fytBold("Total Comandos:")}\n┃ ✦ ${totalCmds} comandos cargados\n\n`;
    textoInfo += `┃ ➪ ${fytBold("Estado de Instancia:")}\n┃ ✦ ${botType} - Operativo 🟢\n\n`;
    textoInfo += `╰〔 ⚡ ${fytBold(botName.toUpperCase() + " BOT")} 〕⬣\n\n`;

    // ── MANEJO DEL BANNER ──
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

    // ── RENDERIZADO DEL MENSAJE ──
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
