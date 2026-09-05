import axios from "axios";
import { fytBold } from "../../models/TextStyle.js";
import formatter from "../../controllers/functions/formatNumbers.js";

const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
const ALYACORE_KEY = "oboe";

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

function parseViews(views = "0") {
  return Number(String(views).replace(/[^\d]/g, "")) || 0;
}

async function searchYouTube(query) {
  const response = await axios.get(
    `https://api.alyacore.xyz/search/yt?query=${encodeURIComponent(query)}&key=${ALYACORE_KEY}`,
  );
  const results = response.data?.result;

  if (!response.data?.status || !Array.isArray(results) || !results.length) {
    throw new Error("No se encontró ningún video.");
  }

  return results[0]; // Retorna el objeto completo del video
}

export default {
  name: ["ytmp3", "play", "playaudio", "mp3", "yta", "audio"],
  category: "downloads",
  description: "Busca y descarga audio de YouTube usando API externa",
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
      let searchData = {};

      if (!YT_REGEX.test(text)) {
        searchData = await searchYouTube(text);
        finalUrl = searchData.url;
      } else {
        const videoId = extractVideoId(text);
        if (!videoId) throw new Error("URL de YouTube no válida");
        finalUrl = `https://youtube.com/watch?v=${videoId}`;
      }

      const apiResponse = await axios.get(
        `https://api.alyacore.xyz/dl/ytmp3converter?url=${encodeURIComponent(finalUrl)}&key=${ALYACORE_KEY}`,
      );
      const res = apiResponse.data;

      if (!res || !res.status || !res.data || !res.data.dl) {
        throw new Error("El servicio de descarga no respondió correctamente.");
      }

      const title = res.data.title || searchData.title || "Video de YouTube";
      const author = res.data.author || searchData.autor || "Desconocido";
      const duration = res.data.duration || searchData.duration || "??";
      const views = parseViews(searchData.views);
      const ytURL = searchData.url || finalUrl;
      const thumbnail =
        res.data.thumbnail ||
        searchData.banner ||
        `https://i.ytimg.com/vi/${extractVideoId(finalUrl)}/hqdefault.jpg`;
      const audioUrl = res.data.dl;

      let caption = `╭〔 🎵 ${fytBold("YOUTUBE PLAY")} 〕━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(title)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Canal")} › ${author}\n`;
      caption += `┃ > ${fytBold("Duración")} › ${duration}\n`;
      caption += `┃ > ${fytBold("Vistas")} › ${formatter(views)}\n`;
      caption += `┃ > ${fytBold("Calidad")} › ${res.data.quality || "128k"}\n`;
      caption += `┃ > ${fytBold("Url")} › ${ytURL}\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ⌛ Descargando audio...\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      await socket.sendMessage(
        remoteJid,
        { image: { url: thumbnail }, caption },
        { quoted: message },
      );

      const audio = await axios.get(audioUrl, {
        responseType: "arraybuffer",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Referer: "https://www.youtube.com/",
        },
      });
      const audioBuffer = Buffer.from(audio.data);

      await socket.sendMessage(
        remoteJid,
        {
          audio: audioBuffer,
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
