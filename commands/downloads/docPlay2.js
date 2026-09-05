import yts from "yt-search";
import formatter from "../../controllers/functions/formatNumbers.js";
import { fytBold } from "../../models/TextStyle.js";

const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
const LEMPI_API_KEY = "oboe";
const LEMPI_QUALITY = 1080;

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
  name: ["dytmp4", "docvideo", "docplayvideo", "docmp4", "dytv", "docplay2"],
  category: "downloads",
  description: "Busca y descarga video de YouTube.",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BUSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > nombre o enlace de video.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      let finalUrl = text;

      // Si NO es un link de YouTube, buscamos con yt-search para resolver la URL
      if (!YT_REGEX.test(text)) {
        const search = await yts(text);
        if (!search.videos?.length) {
          await socket.sendMessage(remoteJid, {
            react: { text: "❌", key: message.key },
          });
          return await socket.sendMessage(
            remoteJid,
            {
              text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("SIN RESULTADOS")}\n╰━━━━━━━━━━━━⬣\n\n┃ > No se encontro ningun video.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
            },
            { quoted: message },
          );
        }
        finalUrl = search.videos[0].url;
      } else {
        const videoId = extractVideoId(text);
        if (!videoId) throw new Error("URL de YouTube no válida");
        finalUrl = `https://youtu.be/${videoId}`;
      }

      // Descarga a través de la API de lempi (esta ya trae título, canal, miniatura, etc.)
      const data = await fetchLempiVideo(finalUrl);

      const title = data.titulo || "Video de YouTube";
      const author = data.canal || "Desconocido";
      const duration = data.duracion || "??";
      const thumbnail = data.miniatura;
      const size = data.datos?.tamaño || "??";
      const videoUrl = data.datos.url;

      let caption = `╭〔 🎬 ${fytBold("YOUTUBE PLAY")} 〕━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(title)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Canal")}› ${author}\n`;
      caption += `┃ > ${fytBold("Duración")} › ${duration}\n`;
      caption += `┃ > ${fytBold("Tamaño")} › ${size}\n`;
      caption += `┃ > ${fytBold("Tipo")} > Documento MP4\n`;
      caption += `┃ > ${fytBold("Url")} › ${finalUrl}\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ ⏳ Enviando video...\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      if (thumbnail) {
        await socket.sendMessage(
          remoteJid,
          { image: { url: thumbnail }, caption },
          { quoted: message },
        );
      }

      await socket.sendMessage(
        remoteJid,
        {
          document: { url: videoUrl },
          mimetype: "video/mp4",
          fileName: `${title.replace(/[<>:"/\\|?*]/g, "")}.mp4`,
          caption: `🎬 *𝐓𝐢𝐭𝐮𝐥𝐨:* ${title}\n⚡ *𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝 𝐃𝐨𝐰𝐧𝐥𝐨𝐚𝐝𝐞𝐫*`,
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en ytmp4:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR DE DESCARGA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Ocurrio un error inesperado."}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
