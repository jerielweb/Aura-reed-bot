import axios from "axios";
import { fytBold } from "../../models/TextStyle.js";
import formatter from "../../controllers/functions/formatNumbers.js";

export default {
  name: ["ttsearch", "tiktoksearch", "tts"],
  category: "search",
  description: "Busca videos en TikTok usando la API de Alyacore",
  execute: async (socket, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;
    const query = args.join(" ").trim();

    if (!query) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BUSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > término de búsqueda para TikTok.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      const response = await axios.get(
        `https://api.alyacore.xyz/search/tiktok?query=${encodeURIComponent(query)}&key=oboe`,
      );
      const res = response.data;

      if (!res || !res.status || !res.data || res.data.length === 0) {
        throw new Error("No se encontraron resultados en TikTok.");
      }

      const results = res.data.slice(0, 5);

      let text = `╭━━〔 ${fytBold("TIKTOK SEARCH")} 〕━━⬣\n`;
      text += `┃ 🔍 ${fytBold("Búsqueda")} › ${query}\n`;
      text += `╰━━━━━━━━━━━━━━━━⬣\n\n`;

      results.forEach((video, i) => {
        text += `┃ ${i + 1}. ${fytBold(video.title || "Sin título")}\n`;
        text += `┃ ├ 👤 @${video.author?.unique_id || "desconocido"} (${video.author?.nickname || "Sin nombre"})\n`;
        text += `┃ ├ 👁️ ${formatter(video.stats?.plays || 0)}\n`;
        text += `┃ ├ ❤️ ${formatter(video.stats?.likes || 0)}\n`;
        text += `┃ ├ 🎵 ${(video.music?.title || "Desconocido").substring(0, 40)}${(video.music?.title || "").length > 40 ? "..." : ""}\n`;
        text += `┃ ├ ⏱️ ${video.duration || "0:00"}\n`;
        text += `┃ └ 🎥 ${video.url}\n\n`;
      });

      text += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      const coverUrl = results[0].cover;

      await socket.sendMessage(
        remoteJid,
        {
          image: { url: coverUrl },
          caption: text,
        },
        { quoted: message },
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en ttsearch:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR DE BÚSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Ocurrió un error inesperado."}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
