import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const customTemp = path.join(__dirname, "../../temp");

// Forzamos sistema a usar temp
process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import crypto from "crypto";
import formatter from "../../controllers/functions/formatNumbers.js";
import { fytBold } from "../../models/TextStyle.js";

const execAsync = promisify(exec);
const tmp = customTemp;

if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

function validateTikTokUrl(url) {
  if (!url) return null;
  const regex = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/[\w\d@?=&/.-]+/i;
  const match = url.match(regex);
  return match ? match[0] : null;
}

async function DL_TIKTOK(input) {
  try {
    let targetUrl = validateTikTokUrl(input);

    if (!targetUrl) {
      const alyaUrl = `https://api.alyacore.xyz/search/tiktok?query=${encodeURIComponent(input)}&key=oboe`;
      const { data: alyaData } = await axios.get(alyaUrl, { timeout: 15000 });

      if (alyaData.status && Array.isArray(alyaData.data) && alyaData.data.length > 0) {
        targetUrl = alyaData.data[0].url;
      }
    }

    if (!targetUrl) {
      throw new Error("No se encontró ningún enlace válido para la búsqueda.");
    }

    const URL_TIKTOK = `https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}`;
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
        time: dateCreate(r.create_time || 0),
        tk_url: `https://www.tiktok.com/@${r.author.unique_id}/video/${r.id}`
      };
    }
    throw new Error("No se pudieron extraer los datos del video con TikWM.");
  } catch (error) {
    throw new Error(`TikTok DL error: ${error.message}`);
  }
}

async function descargarAArchivo(url, destPath) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  });

  if (!response.ok) {
    throw new Error(`Error al descargar el archivo: ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  if (fs.existsSync(destPath)) {
    try { fs.unlinkSync(destPath); } catch {}
  }
  
  fs.writeFileSync(destPath, buffer);
}

async function processVideoFile(inputP, outP) {
  // Forzamos un reencodeo limpio para evitar errores con framerates raros (como 120fps) y WhatsApp
  await execAsync(
    `ffmpeg -i "${inputP}" -vf "scale='min(1280,iw)':-2" -threads 3 -c:v libx264 -preset veryfast ` +
    `-crf 23 -c:a aac -b:a 128k -movflags +faststart "${outP}" -y`,
    { maxBuffer: 1024 * 1024 * 10 } // Ampliamos el búfer a 10MB para que no salte el error de maxBuffer
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
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BÚSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona una búsqueda o\n┃ > un enlace válido de TikTok.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
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
      const result = await DL_TIKTOK(text);

      await descargarAArchivo(result.video_dl, inputP);

      const sizeMB = fs.statSync(inputP).size / (1024 * 1024);

      if (sizeMB > MAX_INPUT_MB) {
        await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
        try { fs.unlinkSync(inputP); } catch {}
        return await socket.sendMessage(
          remoteJid,
          { text: `😦 !Mae Ponete serio! 💀🙏\n Este video pesa mas que una vieja de Kilos Mortales.` },
          { quoted: message }
        );
      }

      // Procesamos siempre el video para asegurar compatibilidad total con WhatsApp
      let finalPath = outP;
      try {
        await processVideoFile(inputP, outP);
      } catch (e) {
        console.error('No se pudo procesar el video, usando original:', e.message);
        finalPath = inputP; // Respaldo por si acaso
      }

      let caption = `╭〔 🎥 ${fytBold("TIKTOK VIDEO")} 〕━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(result.title)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Autor")} › ${result.authorNick}\n`;
      caption += `┃ > ${fytBold("Fecha")} › ${result.time}\n` 
      caption += `┃ > ${fytBold("Vistas")} › ${result.views}\n`;
      caption += `┃ > ${fytBold("Likes")} › ${result.likes}\n`;
      caption += `┃ > ${fytBold("Comentarios")} › ${result.comments}\n`;
      caption += `┃ > ${fytBold("Favoritos")} › ${result.collect}\n`;
      caption += `┃ > ${fytBold("Compartidos")} › ${result.shares}\n`;
      caption += `┃ > ${fytBold("Url")} › ${result.tk_url}\n`
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ✅ Video listo\n`;
      caption += `╰〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕⬣`;

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
      console.error("Error detallado en tiktok:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });

      const errorMsg = error.message || JSON.stringify(error) || "Ocurrió un error inesperado.";

      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR REAL")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${errorMsg}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    } finally {
      try { if (fs.existsSync(inputP)) fs.unlinkSync(inputP); } catch {}
      try { if (fs.existsSync(outP)) fs.unlinkSync(outP); } catch {}
    }
  },
};
