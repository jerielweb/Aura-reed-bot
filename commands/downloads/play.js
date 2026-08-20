import yts from "yt-search";
import yt from "@vreden/youtube_scraper";
import { fytBold } from "../../models/TextStyle.js";
import formatter from "../../controllers/functions/formatNumbers.js";

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
  name: ["ytmp3", "play", "playaudio", "mp3", "yta", "audio"],
  category: "downloads",
  description: "Busca y descarga audio de YouTube usando @vreden/youtube_scraper.",
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

      // Solicitud a máxima calidad según la librería
      const res = await yt.ytmp3(finalUrl, 320);
      
      // Validación corregida para acceder a res.download.url
      if (!res || !res.status || !res.download || !res.download.url) {
        throw new Error("El servicio de descarga no respondió correctamente.");
      }

      const title = videoData.title || res.metadata?.title || "Video de YouTube";
      const author = videoData.author?.name || res.metadata?.author?.name || "Desconocido";
      const duration = videoData.duration?.timestamp || res.metadata?.timestamp || "??";
      const views = typeof videoData.views === "number" ? videoData.views : (res.metadata?.views || 0);
      const ytURL = `https://youtu.be/${videoData.videoId}`
      const thumbnail = videoData.thumbnail || videoData.image || res.metadata?.thumbnail || `https://i.ytimg.com/vi/${extractVideoId(finalUrl)}/hqdefault.jpg`;
      
      // Enlace directo corregido
      const audioUrl = res.download.url;

      let caption = `╭〔 🎵 ${fytBold("YT DOWNLOADER")} 〕━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(title)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Canal")} › ${author}\n`;
      caption += `┃ > ${fytBold("Duración")} › ${duration}\n`;
      caption += `┃ > ${fytBold("Vistas")} › ${formatter(views)}\n`;
      caption += `┃ > ${fytBold("Calidad")} › 320 kbps\n`;
      caption += `┃ > ${fytBold("Url")} › ${ytURL}\n`
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ⌛ Enviando audio...\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      await socket.sendMessage(
        remoteJid,
        { image: { url: thumbnail }, caption },
        { quoted: message },
      );

      await socket.sendMessage(
        remoteJid,
        {
          audio: { url: audioUrl },
          mimetype: "audio/mpeg",
          fileName: `${title.replace(/[<>:"/\\|?*]/g, "")}.mp3`,
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en ytmp3:", error);
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
