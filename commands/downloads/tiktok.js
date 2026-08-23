import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";
import formatter from "../../controllers/functions/formatNumbers.js";
import { fytBold } from "../../models/TextStyle.js";

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const tmp = path.join(__dirname, "../../tmp");

if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

function validateTikTokUrl(url) {
  if (!url) return null;
  const regex = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/[\w\d@?=&/.-]+/i;
  const match = url.match(regex);
  return match ? match[0] : null;
}

async function DL_TIKTOK(url) {
  try {
    const URL_TIKTOK = `https://www.tikwm.com/api/?url=${encodeURIComponent(url)}`;
    const dateCreate = (ts) => new Date(Number(ts) * 1000).toLocaleDateString('es-ES');
    const { data } = await axios.get(URL_TIKTOK, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'application/json, text/plain, */*',
        'Referer': 'https://www.tikwm.com/',
        'Origin': 'https://www.tikwm.com'
      },
      timeout: 15000
    });
    
    if (data.code === 0 && data.data && data.data.play) {
      const r = data.data;
      return {
        video_dl: r.play,
        title: r.title || "Video de TikTok",
        authorNick: r.author?.nickname || 'Desconocido',
        likes: formatter(r.digg_count || 0),
        views: formatter(r.play_count || 0),
        shares: formatter(r.share_count || 0),
        collect: formatter(r.collect_count || 0),
        comments: formatter(r.comment_count || 0),
        time: dateCreate(r.create_time || 0)
      };
    }
    throw new Error("No se encontraron los datos del video.");
  } catch (error) {
    throw new Error(`TikWM API error: ${error.message}`);
  }
}

async function descargarAArchivo(url, destPath) {
  const response = await axios.get(url, {
    responseType: 'stream',
    timeout: 60000,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  await pipeline(response.data, fs.createWriteStream(destPath));
}

async function processVideoFile(inputP, outP) {
  const MAX_SIZE_MB = 50;
  const originalSizeMB = fs.statSync(inputP).size / (1024 * 1024);

  if (originalSizeMB <= MAX_SIZE_MB) {
    await execAsync(`ffmpeg -i "${inputP}" -c copy -movflags +faststart "${outP}" -y`);
    return;
  }

  const { stdout } = await execAsync(
    `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${inputP}"`
  );
  const duration = parseFloat(stdout.trim());

  const targetSizeBits = MAX_SIZE_MB * 8 * 1024 * 1024 * 0.85;
  const audioBitrate = 96;
  const videoBitrate = Math.max(330, Math.floor(targetSizeBits / duration / 1000) - audioBitrate);

  await execAsync(
    `ffmpeg -i "${inputP}" -vf "scale='min(1920,iw)':-2" -threads 2 -c:v libx264 -preset veryfast ` +
    `-b:v ${videoBitrate}k -maxrate ${Math.floor(videoBitrate * 1.5)}k -bufsize ${videoBitrate * 2}k ` +
    `-c:a aac -b:a ${audioBitrate}k -movflags +faststart "${outP}" -y`
  );
}


const MAX_INPUT_MB = 500;

export default {
  name: ["tk", "tt", "tta", "tiktok", "tkmp4"],
  category: "downloads",
  description: "Busca y descarga videos de TikTok.",
  
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BÚSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > enlace válido de TikTok.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
    
    const validUrl = validateTikTokUrl(text);
    if (!validUrl) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("ENLACE INVÁLIDO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > El enlace proporcionado\n┃ > no corresponde a TikTok.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    const id = crypto.randomBytes(8).toString('hex');
    const inputP = path.join(tmp, `tt_${id}.mp4`);
    const outP = path.join(tmp, `tt_${id}_out.mp4`);
    
    try {
      const result = await DL_TIKTOK(validUrl);

      await descargarAArchivo(result.video_dl, inputP);

      const sizeMB = fs.statSync(inputP).size / (1024 * 1024);

      if (sizeMB > MAX_INPUT_MB) {
        await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
        try { fs.unlinkSync(inputP); } catch {}
        return await socket.sendMessage(
          remoteJid,
          { text: `😦 !Mae Ponete serio! 💀🙏\n Este video pesa mas que una vieja de Kilos Mortales.\nMekor ` },
          { quoted: message }
        );
      }

      if (sizeMB > 50) {
        await socket.sendMessage(remoteJid, {
          react: { text: "⚠️", key: message.key },
        });
        await socket.sendMessage(
          remoteJid,
          { text: `¡Uy mae! Este video pesa mucho, voy a tener que hacerlo más liviano.\nDame chance ....` },
          { quoted: message }
        );
      }

      let finalPath = inputP;
      try {
        await processVideoFile(inputP, outP);
        finalPath = outP;
      } catch (e) {
        console.error('No se pudo procesar el video, se manda el original:', e.message);
      }

      let caption = `╭〔 🎥 ${fytBold("TIKTOK DOWNLOAD")} 〕━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(result.title)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Autor")} › ${result.authorNick}\n`;
      caption += `┃ > ${fytBold("Fecha")} › ${result.time}\n` 
      caption += `┃ > ${fytBold("Vistas")} › ${result.views}\n`;
      caption += `┃ > ${fytBold("Likes")} › ${result.likes}\n`;
      caption += `┃ > ${fytBold("Comentarios")} › ${result.comments}\n`;
      caption += `┃ > ${fytBold("Favoritos")} › ${result.collect}\n`;
      caption += `┃ > ${fytBold("Compartidos")} › ${result.shares}\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ✅ Video listo\n`;
      caption += `╰〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕⬣`;

      // Se usa la ruta directa ({ url: finalPath }) para evitar saturar la memoria RAM con Buffers gigantes
      await socket.sendMessage(
        remoteJid,
        {
          video: { url: finalPath },
          caption: caption,
          mimetype: "video/mp4",
          fileName: "tiktok.mp4"
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en tiktok:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });

      // Condición específica para cuando el servidor se queda sin espacio o disco lleno
      let errorMsg = error.message || "Ocurrió un error inesperado.";
      if (error.code === 'ENOSPC' || errorMsg.includes('no space left on device')) {
        errorMsg = "El servidor se quedó sin espacio temporal en disco para procesar este video.";
      }

      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR DE DESCARGA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${errorMsg}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    } finally {
      try { fs.unlinkSync(inputP); } catch {}
      try { fs.unlinkSync(outP); } catch {}
    }
  },
};
