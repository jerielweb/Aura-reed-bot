import os from "os";
import path from "path";
import { fileURLToPath } from "url";
import axios from "axios";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs";
import crypto from "crypto";
import http from "http";
import https from "https";
import stream from "stream";
import formatter from "../../controllers/functions/formatNumbers.js";
import { setDownloadCacheEnv } from "../../controllers/downloadUtils.js";
import { fytBold } from "../../models/TextStyle.js";

const tmp = setDownloadCacheEnv();

const execAsync = promisify(exec);
const pipelineAsync = promisify(stream.pipeline);

if (!fs.existsSync(tmp)) fs.mkdirSync(tmp, { recursive: true });

const httpAgent = new http.Agent({ keepAlive: true, maxSockets: 100 });
const httpsAgent = new https.Agent({ keepAlive: true, maxSockets: 100 });
const apiAxios = axios.create({ httpAgent, httpsAgent });

function validateTikTokUrl(url) {
  if (!url) return null;
  const regex = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/[\w\d@?=&/.-]+/i;
  const match = url.match(regex);
  return match ? match[0] : null;
}

const formatSize = (bytes) => {
  if (bytes >= 1073741824) return (bytes / 1073741824).toFixed(2) + " GB";
  if (bytes >= 1048576) return (bytes / 1048576).toFixed(2) + " MB";
  if (bytes >= 1024) return (bytes / 1024).toFixed(2) + " KB";
  return bytes + " B";
};

async function DL_TIKTOK(input) {
  try {
    let targetUrl = validateTikTokUrl(input);

    if (!targetUrl) {
      const APIKEY = global.Apis.apiAiya.apikey;
      const alyaUrl = `https://api.alyacore.xyz/search/tiktok?query=${encodeURIComponent(input)}&key=${APIKEY}`;
      const { data: alyaData } = await apiAxios.get(alyaUrl, {
        timeout: 35000, 
      });

      if (alyaData.status && Array.isArray(alyaData.data) && alyaData.data.length > 0) {
        targetUrl = alyaData.data[0].url;
      }
    }

    if (!targetUrl) {
      throw new Error("No se encontró ningún enlace válido para la búsqueda.");
    }

    const URL_TIKTOK = `https://api.alyacore.xyz/dl/tiktokv2?url=${encodeURIComponent(targetUrl)}&key=${global.Apis.apiAiya.apikey}`;
    const dateCreate = (ts) => new Date(Number(ts) * 1000).toLocaleDateString("es-ES");

    const { data } = await apiAxios.get(URL_TIKTOK, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
      },
      timeout: 35000, 
    });

    if (data.status && Array.isArray(data.data) && data.data.length > 0) {
      const r = data;
      const videoUrl = r.data[2]?.url || r.data[1]?.url || r.data[0]?.url;
      if (!videoUrl) throw new Error("No se encontró URL de descarga en la API.");

      return {
        video_dl: videoUrl,
        title: r.title || "Video de TikTok",
        authorNick: r.author?.nickname || r.author?.fullname || "Desconocido",
        likes: formatter(r.stats?.likes || r.digg_count || 0),
        views: formatter(r.stats?.views || r.play_count || 0),
        shares: formatter(r.stats?.share || r.share_count || 0),
        collect: formatter(r.stats?.download || r.collect_count || 0),
        comments: formatter(r.stats?.comment || r.comment_count || 0),
        time: dateCreate(r.taken_at || r.create_time || 0),
        tk_url: `https://www.tiktok.com/@${r.author?.fullname || "user"}/video/${r.id || ""}`,
      };
    }
    throw new Error("La API externa no devolvió datos válidos.");
  } catch (error) {
    throw new Error(`TikTok DL error: ${error.message}`);
  }
}

async function descargarAArchivoSeguro(url, destPath) {
  const response = await apiAxios({
    url,
    method: "GET",
    responseType: "stream",
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
      "Accept-Language": "es-ES,es;q=0.9",
      Referer: "https://www.tikwm.com/",
      Connection: "keep-alive",
    },
    timeout: 60000, 
  });

  const writer = fs.createWriteStream(destPath);
  return new Promise((resolve, reject) => {
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
    response.data.on("error", reject);
  });
}

export default {
  name: ["tk", "tt", "ttv", "tiktok", "tkmp4"],
  category: "downloads",
  description: "Busca y descarga videos de TikTok sin límites de tamaño.",

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

    await socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

    const id = crypto.randomBytes(8).toString("hex");
    const inputP = path.join(tmp, `tt_${id}.mp4`);
    const whatsappReadyPath = path.join(tmp, `tt_${id}_wa.mp4`);

    try {
      const result = await DL_TIKTOK(text);
      await descargarAArchivoSeguro(result.video_dl, inputP);

      const sizeMB = fs.statSync(inputP).size / (1024 * 1024);
      let finalPath = inputP;

      try {
        if (sizeMB > 60) {
          await socket.sendMessage(remoteJid, { react: { text: "🗜️", key: message.key } });
          
          await execAsync(
            `ffmpeg -y -i "${finalPath}" -c:v libx264 -crf 26 -preset fast -c:a aac -b:a 128k -movflags +faststart -threads 0 "${whatsappReadyPath}"`,
            { maxBuffer: 1024 * 1024 * 50 }
          );
          finalPath = whatsappReadyPath;
        } else {
          const { stdout: codecInfo } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=codec_name -of default=noprint_wrappers=1:nokey=1 "${finalPath}"`);
          const codec = codecInfo.trim().toLowerCase();

          if (codec === "h264") {
            await execAsync(
              `ffmpeg -y -i "${finalPath}" -c copy -movflags +faststart -threads 0 "${whatsappReadyPath}"`,
              { maxBuffer: 1024 * 1024 * 50 }
            );
          } else {
            await execAsync(
              `ffmpeg -y -i "${finalPath}" -c:v libx264 -preset fast -c:a aac -b:a 128k -movflags +faststart -threads 0 "${whatsappReadyPath}"`,
              { maxBuffer: 1024 * 1024 * 50 }
            );
          }
          finalPath = whatsappReadyPath;
        }
      } catch (e) {
        finalPath = inputP;
      }

      let caption = `╭〔 🎥 ${fytBold("TIKTOK VIDEO")} 〕━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(result.title)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Autor")} › ${result.authorNick}\n`;
      caption += `┃ > ${fytBold("Fecha")} › ${result.time}\n`;
      caption += `┃ > ${fytBold("Vistas")} › ${result.views}\n`;
      caption += `┃ > ${fytBold("Likes")} › ${result.likes}\n`;
      caption += `┃ > ${fytBold("Comentarios")} › ${result.comments}\n`;
      caption += `┃ > ${fytBold("Compartidos")} › ${result.shares}\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${result.tk_url}\n`;
      caption += `╰〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕⬣`;

      await socket.sendMessage(
        remoteJid,
        {
          video: { url: finalPath },
          caption: caption,
          mimetype: "video/mp4",
          fileName: "tiktok.mp4",
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } });
    } catch (error) {
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
      const errorMsg = error.message || "Ocurrió un error inesperado.";
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR REAL")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${errorMsg}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    } finally {
      try { if (fs.existsSync(inputP)) fs.unlinkSync(inputP); } catch {}
      try { if (fs.existsSync(whatsappReadyPath)) fs.unlinkSync(whatsappReadyPath); } catch {}
    }
  },
};
