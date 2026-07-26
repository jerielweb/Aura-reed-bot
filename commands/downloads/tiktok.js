import Tiktok from "@tobyg74/tiktok-api-dl";
import formatter from "../../controllers/functions/formatNumbers.js";
import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import path from "path";
import os from "os";

const TIKTOK_REGEX = /^(https?:\/\/)?(www\.|vm\.|vt\.)?tiktok\.com\/.*$/i;

// Función auxiliar para re-procesar el video sin perder calidad pero haciéndolo compatible con WhatsApp
const processVideoForWhatsApp = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-c:v libx264",       // Códec estándar H.264 compatible con WhatsApp
        "-crf 20",            // Alta calidad (valores entre 18 y 22 son prácticamente visualmente idénticos al original)
        "-preset ultrafast",   // Procesamiento rápido en el servidor
        "-pix_fmt yuv420p",   // Pixel format obligatorio para reproducción móvil
        "-c:a aac",           // Códec de audio compatible
        "-b:a 128k"
      ])
      .toFormat("mp4")
      .on("end", () => resolve())
      .on("error", (err) => reject(err))
      .save(outputPath);
  });
};

export default {
  name: ["tiktok", "tt", "tk"],
  category: "downloads",
  description: "Busca y descarga videos de TikTok. Usa: .tiktok [enlace/búsqueda]",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐁𝐔́𝐒𝐐𝐔𝐄𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > enlace de TikTok o una búsqueda.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
        },
        { quoted: message }
      );
    }

    await socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

    // Archivos temporales para el procesamiento
    const tempInput = path.join(os.tmpdir(), `tt_raw_${Date.now()}.mp4`);
    const tempOutput = path.join(os.tmpdir(), `tt_fixed_${Date.now()}.mp4`);

    try {
      const isUrl = TIKTOK_REGEX.test(text);
      let targetUrl = text;

      if (!isUrl) {
        const searchRes = await Tiktok.Search(text, { type: "video" });
        const results = searchRes?.result;
        const first = Array.isArray(results) ? results[0] : results?.videos?.[0];

        if (!first) throw new Error("No se encontraron resultados para la búsqueda.");
        targetUrl = first.play || first.url || first.link || `https://www.tiktok.com/@${first.author?.username || 'user'}/video/${first.id}`;
      }

      const downloadData = await Tiktok.Downloader(targetUrl, { version: "v1" });

      if (downloadData?.status !== "success" || !downloadData?.result) {
        throw new Error(downloadData?.message || "No se pudo obtener la información del video.");
      }

      const res = downloadData.result;
      const videoUrl = res.video?.playAddr?.[0] || res.video?.downloadAddr?.[0];

      if (!videoUrl) {
        throw new Error("No se pudo extraer el enlace de descarga del video.");
      }

      const title = res.desc || "Video de TikTok";
      const author = res.author?.nickname || res.author?.username || "TikTok User";
      const duration = res.video?.duration ? `${res.video.duration}s` : "N/A";
      const views = res.statistics?.playCount || 0;
      const likes = res.statistics?.likeCount || 0;
      const thumbnail = res.cover?.[0] || res.dynamicCover?.[0] || res.originCover?.[0];

      const caption =
        `╭〔 🎬 𝐓𝐈𝐊𝐓𝐎𝐊 𝐕𝐈𝐃𝐄𝐎 〕━⬣\n\n` +
        `┃ ➥ 𝐃𝐞𝐬𝐜𝐚𝐫𝐠𝐚𝐧𝐝𝐨 › ${title}\n\n` +
        `┣━━━━━━━━━━━━⬣\n` +
        `┃ > 𝐀𝐮𝐭𝐨𝐫 › ${author}\n` +
        `┃ > 𝐃𝐮𝐫𝐚𝐜𝐢𝐨́𝐧 › ${duration}\n` +
        `┃ > 𝐕𝐢𝐬𝐭𝐚𝐬 › ${formatter(views)}\n` +
        `┃ > Likes › ${formatter(likes)}\n` +
        `┃ > 𝐌𝐨𝐝𝐨 › Video (MP4)\n` +
        `┃ > 𝐄𝐧𝐥𝐚𝐜𝐞 › ${targetUrl}\n` +
        `┣━━━━━━━━━━━━⬣\n` +
        `┃ ⏳ Descargando Video...\n` +
        `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

      const mediaPayload = thumbnail ? { image: { url: thumbnail }, caption } : { text: caption };
      await socket.sendMessage(remoteJid, mediaPayload, { quoted: message });

      // 1. Descargar video crudo a disco temporal
      const videoResponse = await fetch(videoUrl);
      if (!videoResponse.ok) throw new Error("Falló la descarga del archivo de video.");
      const buffer = Buffer.from(await videoResponse.arrayBuffer());
      await fs.writeFile(tempInput, buffer);

      // 2. Procesar con FFmpeg para asegurar compatibilidad de reproductor
      await processVideoForWhatsApp(tempInput, tempOutput);

      // 3. Leer el video arreglado y enviarlo
      const processedBuffer = await fs.readFile(tempOutput);

      await socket.sendMessage(
        remoteJid,
        {
          video: processedBuffer,
          mimetype: "video/mp4",
          fileName: `${title.replace(/[<>:"/\\|?*]/g, "")}.mp4`,
          caption: `🎬 *𝐓𝐢́𝐭𝐮𝐥𝐨:* ${title}\n⚡ *𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝 𝐃𝐨𝐰𝐧𝐥𝐨𝐚𝐝𝐞𝐫*`,
        },
        { quoted: message }
      );

      await socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } });
    } catch (error) {
      console.error("Error en tiktok command:", error);
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐃𝐄𝐒𝐂𝐀𝐑𝐆𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Ocurrió un error inesperado."}\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
        },
        { quoted: message }
      );
    } finally {
      // Limpieza de temporales para no llenar el almacenamiento de la VPS
      await fs.unlink(tempInput).catch(() => {});
      await fs.unlink(tempOutput).catch(() => {});
    }
  },
};
