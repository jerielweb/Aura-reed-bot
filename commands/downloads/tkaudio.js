import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import crypto from "crypto";
import formatter from "../../controllers/functions/formatNumbers.js";
import { fytBold } from "../../models/TextStyle.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const customTemp = path.join(__dirname, "../../temp");

process.env.TMPDIR = customTemp;
process.env.TEMP = customTemp;
process.env.TMP = customTemp;

const execAsync = promisify(exec);
const tmp = customTemp;

if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

function validateTikTokUrl(url) {
  if (!url) return null;
  const regex = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/[\w\d@?=&/.-]+/i;
  const match = url.match(regex);
  return match ? match[0] : null;
}

async function DL_TIKTOK_AUDIO(input) {
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
        title: r.title || "Audio de TikTok",
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
    throw new Error(`TikTok Audio DL error: ${error.message}`);
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

  const fileStream = fs.createWriteStream(destPath);
  await new Promise((resolve, reject) => {
    const reader = response.body.getReader();
    function pump() {
      reader.read().then(({ done, value }) => {
        if (done) {
          fileStream.end();
          resolve();
          return;
        }
        fileStream.write(Buffer.from(value));
        pump();
      }).catch(reject);
    }
    pump();
  });
}

async function processAudioFile(inputP, outP) {
  // Extrae el audio del video descargado y lo convierte a mp3 limpio con buen bitrate
  await execAsync(
    `ffmpeg -y -i "${inputP}" -vn -c:a libmp3lame -b:a 128k "${outP}"`,
    { maxBuffer: 1024 * 1024 * 10 }
  );
}

const MAX_INPUT_MB = 500;

export default {
  name: ["tka", "ttaudio", "tkmusic", "tiktokaudio"],
  category: "downloads",
  description: "Descarga el audio de un video de TikTok manteniendo metadatos y formato de audio.",
  
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
    const inputP = path.join(tmp, `tta_in_${id}.mp4`);
    const outP = path.join(tmp, `tta_out_${id}.mp3`);
    
    try {
      const result = await DL_TIKTOK_AUDIO(text);

      await descargarAArchivo(result.video_dl, inputP);

      const sizeMB = fs.statSync(inputP).size / (1024 * 1024);

      if (sizeMB > MAX_INPUT_MB) {
        await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
        try { fs.unlinkSync(inputP); } catch {}
        return await socket.sendMessage(
          remoteJid,
          { text: `😦 ¡Mae ponete serio! 💀🙏\n Este video pesa más que una vieja de Kilos Mortales.` },
          { quoted: message }
        );
      }

      // Convertimos el video a audio MP3 limpio
      await processAudioFile(inputP, outP);

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
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Url")} › ${result.tk_url}\n`
      caption += `╰〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕⬣`;

      await socket.sendMessage(
        remoteJid,
        {
          audio: { url: outP },
          mimetype: "audio/mp4",
          fileName: "tiktok.mp3",
          ptt: false,
          caption: caption
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error detallado en tiktok audio:", error);
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
