import yts from "yt-search";
import { fytBold } from "../../models/TextStyle.js";
import formatter from "../../controllers/functions/formatNumbers.js";

const YT_REGEX = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/;
const API_URL = "https://api.alyacore.xyz/dl/youtubeplayv2";
const API_KEY = "oboe";

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
  name: ["docytmp3", "docplay", "docplayaudio", "dmp3", "dyta", "docaudio"],
  category: "downloads",
  description: "Busca y descarga audio de YouTube.",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BUSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > nombre o enlace de cancion.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
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
        videoData = search.videos[0];
        finalUrl = videoData.url;
      } else {
        const videoId = extractVideoId(text);
        if (!videoId) throw new Error("URL de YouTube no válida");
        finalUrl = `https://youtube.com/watch?v=${videoId}`;

        try {
          const searchById = await yts({ videoId });
          if (searchById?.title) {
            videoData = searchById;
          }
        } catch {}

        if (!videoData) {
          try {
            const searchFallback = await yts(videoId);
            if (searchFallback.videos?.length) {
              videoData =
                searchFallback.videos.find((v) => v.videoId === videoId) ||
                searchFallback.videos[0];
            }
          } catch {}
        }

        if (!videoData) {
          videoData = {
            title: "Video de YouTube",
            author: { name: "Desconocido" },
            duration: { timestamp: "??" },
            views: 0,
            thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            url: finalUrl,
          };
        }
      }

      const response = await fetch(`${API_URL}?query=${encodeURIComponent(finalUrl)}&type=mp3&quality=auto&key=${API_KEY}`);
      const json = await response.json();
      
      if (!json.status || !json.data) throw new Error("La API no pudo procesar el audio.");

      const title = json.data.title || videoData.title || "Video de YouTube";
      const author = json.data.author || videoData.author?.name || videoData.author || "Desconocido";
      const duration = json.data.duration || videoData.duration?.timestamp || "??";
      const views = typeof videoData.views === "number" ? videoData.views : 0;
      const thumbnail = json.data.thumbnail || videoData.thumbnail || videoData.image || `https://i.ytimg.com/vi/${extractVideoId(finalUrl) || "default"}/hqdefault.jpg`;
      const audioUrl = json.data.dl;

      let caption = `╭〔 🎵 ${fytBold("YOUTUBE PLAY")} 〕━⬣\n\n`;
      caption += `┃ ➥ ${fytBold(title)}\n\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ${fytBold("Canal")} › ${author}\n`;
      caption += `┃ > ${fytBold("Duración")} › ${duration}\n`;
      caption += `┃ > ${fytBold("Vistas")} › ${formatter(views)}\n`;
      caption += `┃ > ${fytBold("Tipo")} › Documento MP3\n`
      caption += `┃ > ${fytBold("Url")} › ${finalUrl}\n`;
      caption += `┣━━━━━━━━━━━━⬣\n`;
      caption += `┃ > ⌛ Descargando audio...\n`;
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      await socket.sendMessage(
        remoteJid,
        { image: { url: thumbnail }, caption },
        { quoted: message },
      );

      await socket.sendMessage(
        remoteJid,
        {
          document: { url: audioUrl },
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
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR DE DESCARGA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Ocurrio un error inesperado."}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
