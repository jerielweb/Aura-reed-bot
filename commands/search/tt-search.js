import axios from "axios";
import formatter from "../../controllers/functions/formatNumbers.js";

export default {
  name: ["ttsearch", "tiktoksearch", "tts"],
  category: "search",
  description: "Busca videos en TikTok.",
  execute: async (socket, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;
    const query = args.join(" ");

    if (!query) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `⚠️ Debes especificar qué buscar.\nEjemplo: *${prefix}ttsearch bomboclat*`,
        },
        { quoted: message },
      );
    }

    console.log(`[TikTok Search] Iniciando búsqueda: "${query}"`);
    await socket.sendMessage(
      remoteJid,
      { text: "🔍 Buscando en TikTok..." },
      { quoted: message },
    );

    // Funciones para ambas APIs
    const searchAlyacore = async () => {
      try {
        console.log("[TikTok API] Intentando Faa...");
        const res = await axios.get("https://api-faa.my.id/faa/tiktok-search", {
          params: {
            q: query,
          },
          timeout: 10000,
        });

        console.log(
          `[Faa Response] Status: ${res.status}, Resultados: ${res.data?.result?.length || 0}`,
        );

        if (res.data?.status && res.data?.result?.length > 0) {
          return {
            source: "Faa TikTok API",
            results: res.data.result.slice(0, 5).map((video) => ({
              title: video.title,
              author: video.author.nickname,
              username: video.author.username,
              views: video.stats?.views || "0",
              likes: video.stats?.likes || "0",
              duration: video.duration || "N/A",
              music: video.music?.title || "Desconocido",
              tiktok_url: `https://www.tiktok.com/@${video.author.username}/video/${video.id}`,
              cover: video.cover,
            })),
          };
        }
      } catch (err) {
        console.log("[Faa Error]:", err.message);
      }
      return null;
    };

    const searchDelirius = async () => {
      try {
        console.log("[TikTok API] Intentando Delirius...");
        const res = await axios.get(
          "https://api.delirius.store/search/tiktoksearch",
          {
            params: {
              query: query,
            },
            timeout: 10000,
          },
        );

        console.log(
          `[Delirius Response] Status: ${res.status}, Resultados: ${res.data?.meta?.length || 0}`,
        );

        if (res.data?.meta?.length > 0) {
          return {
            source: "Delirius API",
            results: res.data.meta.slice(0, 5).map((video) => ({
              title: video.title,
              author: video.author.nickname,
              username: video.author.username,
              views: formatter(video.play),
              likes: formatter(video.like),
              duration: formatDuration(video.duration),
              music: video.music.title,
              tiktok_url: video.url,
              cover: video.hd,
            })),
          };
        }
      } catch (err) {
        console.log("[Delirius Error]:", err.message);
      }
      return null;
    };

    // Esperar ambas y seleccionar la que tenga resultados
    const results = await Promise.allSettled([
      searchAlyacore(),
      searchDelirius(),
    ]);

    console.log("[TikTok Search] Resultados de ambas APIs:", {
      alyacore:
        results[0].status === "fulfilled"
          ? results[0].value
            ? "✅ Con datos"
            : "⚠️ Sin datos"
          : "❌ Error",
      delirius:
        results[1].status === "fulfilled"
          ? results[1].value
            ? "✅ Con datos"
            : "⚠️ Sin datos"
          : "❌ Error",
    });

    // Seleccionar la primera que tenga datos
    const result = results.find(
      (r) => r.status === "fulfilled" && r.value?.results?.length > 0,
    )?.value;

    if (!result) {
      console.log(
        "[TikTok Search] No se encontraron resultados en ninguna API",
      );
      return await socket.sendMessage(
        remoteJid,
        { text: "❌ No se encontraron resultados o error en las APIs." },
        { quoted: message },
      );
    }
    // Formatear respuesta
    let text = `╭━━〔 𝐓𝐈𝐊𝐓𝐎𝐊 𝐒𝐄𝐀𝐑𝐂𝐇 〕━━⬣\n`;
    text += `┃ 🔍 𝐏𝐨𝐫: ${result.source}\n`;
    text += `┃ 🎬 𝐁úsqueda: ${query}\n`;
    text += `╰━━━━━━━━━━━━━━━━⬣\n\n`;

    result.results.forEach((video, i) => {
      text += `┃ ${i + 1}. ${video.title}\n`;
      text += `┃ ├ 👤 @${video.username} (${video.author})\n`;
      text += `┃ ├ 👁️ ${video.views}\n`;
      text += `┃ ├ ❤️ ${video.likes}\n`;
      text += `┃ ├ 🎵 ${video.music.substring(0, 40)}${video.music.length > 40 ? "..." : ""}\n`;
      text += `┃ ├ ⏱️ ${video.duration}\n`;
      text += `┃ └ 🎥 ${video.tiktok_url}\n\n`;
    });

    text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    console.log(
      `[TikTok Search] Enviando ${result.results.length} resultados desde ${result.source}`,
    );
    console.log(
      "[TikTok Search] Videos encontrados:",
      result.results.map((v) => ({ title: v.title, author: v.author })),
    );

    await socket.sendMessage(
      remoteJid,
      {
        image: { url: result.results[0].cover },
        caption: text,
      },
      { quoted: message },
    );
  },
};

/**
 * Convierte segundos a formato MM:SS
 * @param {number} seconds - Segundos
 * @returns {string} - Formato MM:SS
 */
function formatDuration(seconds) {
  if (!seconds) return "0:00";
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}
