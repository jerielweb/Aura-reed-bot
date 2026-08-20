import yts from "yt-search";
import yt from "@vreden/youtube_scraper";
import { fytBold } from "../../models/TextStyle.js";
import formatter from "../../controllers/functions/formatNumbers.js";
import ffmpeg from "fluent-ffmpeg";
import { Readable } from "stream";

const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
    /youtube\.com\/live\/([a-zA-Z0-9_-]{11})/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }
  return null;
}

export default {
  name: ["ytmp4", "play2", "playvideo", "mp4", "ytv", "video"],
  category: "downloads",
  description: "Busca y descarga videos de YouTube",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BUSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > nombre o enlace de canción.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      let finalUrl = text;
      let videoData = null;

      if (!YT_REGEX.test(text)) {
        const search = await yts(text);
        if (!search.videos?.length) throw new Error("No se encontró ningún video.");
        videoData = search.videos[0];
        finalUrl = videoData.url;
      } else {
        const videoId = extractVideoId(text);
        if (!videoId) throw new Error("URL de YouTube no válida");
        finalUrl = `https://youtube.com/watch?v=${videoId}`;
        videoData = await yts({ videoId });
      }

      const res = await yt.ytmp4(finalUrl, 720);
      
      if (!res || !res.status || !res.download || !res.download.url) {
        throw new Error("El servicio de descarga no respondió correctamente.");
      }

      const title = videoData.title || res.metadata?.title || "Video de YouTube";
      const author = videoData.author?.name || res.metadata?.author?.name || "Desconocido";
      const duration = videoData.duration?.timestamp || res.metadata?.timestamp || "??";
      const views = typeof videoData.views === "number" ? videoData.views : (res.metadata?.views || 0);
      const ytURL = `https://youtu.be/${videoData.videoId || extractVideoId(finalUrl)}`;
      const quality = res.download.quality || "720p";
      const thumbnail = videoData.thumbnail || videoData.image || res.metadata?.thumbnail || `https://i.ytimg.com/vi/${extractVideoId(finalUrl)}/hqdefault.jpg`;
      const videoUrl = res.download.url;

      let caption = `╭〔 🎵 ${fytBold("YT DOWNLOADER")} 〕━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(title)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Canal")} › ${author}\n`;
      caption += `┃ > ${fytBold("Duración")} › ${duration}\n`;
      caption += `┃ > ${fytBold("Vistas")} › ${formatter(views)}\n`;
      caption += `┃ > ${fytBold("Calidad")} › ${quality}\n`;
      caption += `┃ > ${fytBold("Url")} › ${ytURL}\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ⌛ Procesando en memoria...\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      await socket.sendMessage(
        remoteJid,
        { image: { url: thumbnail }, caption },
        { quoted: message },
      );

      // Descargar stream del video desde el CDN
      const fetchResponse = await fetch(videoUrl);
      if (!fetchResponse.ok) throw new Error("No se pudo obtener el archivo del CDN.");
      const inputStream = Readable.fromWeb(fetchResponse.body);

      // Procesar con FFmpeg totalmente en memoria (sin usar disco duro / tmp)
      const chunks = [];
      await new Promise((resolve, reject) => {
        ffmpeg(inputStream)
          .outputOptions([
            "-c:v libx264",
            "-preset ultrafast",
            "-crf 26",
            "-pix_fmt yuv420p",
            "-c:a aac",
            "-b:a 128k",
            "-movflags +faststart",
            "-f matroska" // Contenedor intermedio en buffer
          ])
          .format("mp4")
          .on("data", (chunk) => chunks.push(chunk))
          .on("end", resolve)
          .on("error", reject)
          .pipe();
      });

      const processedBuffer = Buffer.concat(chunks);

      await socket.sendMessage(
        remoteJid,
        {
          video: processedBuffer,
          mimetype: "video/mp4",
          fileName: `${title.replace(/[<>:"/\\|?*]/g, "")}.mp4`,
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });

    } catch (error) {
      console.error("Error en ytmp4 con FFmpeg stream:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR DE DESCARGA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Ocurrió un error inesperado."}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
