import yts from "yt-search";
import formatter from "../../controllers/functions/formatNumbers.js";
import { fytBold } from "../../models/TextStyle.js";

const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
const LEMPI_API_KEY = "oboe";
const LEMPI_QUALITY = 1080;

// ... (extractVideoId se mantiene igual)

async function fetchLempiVideo(youtubeUrl, quality = LEMPI_QUALITY) {
  const apiUrl = `https://api.lempi.lat/dl/ytv?url=${encodeURIComponent(youtubeUrl)}&quality=${quality}&apikey=${LEMPI_API_KEY}`;
  const res = await fetch(apiUrl);
  if (!res.ok) throw new Error(`API respondió con estado ${res.status}`);
  const data = await res.json();
  if (!data?.status || !data?.datos?.url) {
    throw new Error("La API no pudo procesar el video.");
  }
  return data;
}

export default {
  name: ["ytmp4", "video", "playvideo", "mp4", "ytv", "play2"],
  category: "downloads",
  description: "Busca y descarga video de YouTube.",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(remoteJid, { text: "Falta búsqueda" }, { quoted: message });
    }

    await socket.sendMessage(remoteJid, { react: { text: "⏳", key: message.key } });

    try {
      let finalUrl = text;
      if (!YT_REGEX.test(text)) {
        const search = await yts(text);
        if (!search.videos?.length) throw new Error("No se encontró el video");
        finalUrl = search.videos[0].url;
      }

      const data = await fetchLempiVideo(finalUrl);
      const title = data.titulo || "Video";
      const videoUrl = data.datos.url;

      // --- CAMBIO AQUÍ: Descargar a Buffer ---
      const response = await fetch(videoUrl);
      if (!response.ok) throw new Error("No se pudo obtener el stream del video");
      const arrayBuffer = await response.arrayBuffer();
      const videoBuffer = Buffer.from(arrayBuffer);
      // ----------------------------------------

      // Enviar como buffer
      await socket.sendMessage(
        remoteJid,
        {
          video: videoBuffer, 
          mimetype: "video/mp4",
          fileName: `${title.replace(/[<>:"/\\|?*]/g, "")}.mp4`,
          caption: `🎬 *𝐓𝐢𝐭𝐮𝐥𝐨:* ${title}\n⚡ *𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝 𝐃𝐨𝐰𝐧𝐥𝐨𝐚𝐝𝐞𝐫*`,
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, { react: { text: "✅", key: message.key } });
    } catch (error) {
      console.error(error);
      await socket.sendMessage(remoteJid, { react: { text: "❌", key: message.key } });
    }
  },
};
