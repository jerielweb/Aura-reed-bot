import axios from "axios";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["x", "twitter", "xdl"],
  category: "downloads",
  description: "Descarga videos o imágenes de Twitter / X",

  execute: async (socket, message, args) => {
    const text = args.join(" ");
    if (!text) {
      let errorText = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n`;
      errorText += `┃ ❌ ${fytBold("FALTA ENLACE")}\n`;
      errorText += `╰━━━━━━━━━━━━⬣\n\n`;
      errorText += `┃ > Por favor, proporciona un\n`;
      errorText += `┃ > enlace de Twitter\n\n`;
      errorText += `╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return sock.sendMessage(m.key.remoteJid, { text: errorText }, { quoted: m });
    }

    try {
      const apiKey = "oboe";
      const apiUrl = `https://api.alyacore.xyz/dl/twitter?url=${encodeURIComponent(text)}&key=${apiKey}`;

      const { data: res } = await axios.get(apiUrl);

      if (!res || !res.status || !res.data) {
        return sock.sendMessage(m.key.remoteJid, { text: "❌ No se pudo obtener el contenido. Verifica el enlace." }, { quoted: m });
      }

      const { type, result, thumbnail } = res.data;

      // Si es un video
      if (type === "video" && Array.isArray(result) && result.length > 0) {
        // Ordena los videos extrayendo el número de la calidad (ej: "900p" -> 900) de mayor a menor
        const sortedVideos = [...result].sort((a, b) => {
          const resA = parseInt(a.quality) || 0;
          const resB = parseInt(b.quality) || 0;
          return resB - resA;
        });

        // Selecciona el primero que es el de más alta resolución
        const bestVideo = sortedVideos[0];

        return sock.sendMessage(
          m.key.remoteJid,
          {
            video: { url: bestVideo.url },
            caption: `╭〔 ♞ 𝐀𝐔𝐑𝐀 𝐃𝐎𝐌𝐀𝐈𝐍𝐒 〕⬣\n┃\n┃ 🎥 *Twitter Video*\n┃ ⚙️ *Calidad:* ${bestVideo.quality || "Máxima"}\n┃\n╰━━━━━━━━━━━━━━━━━━⬣`,
          },
          { quoted: m }
        );
      }

      // Si es una imagen
      if (type === "image" || (typeof result === "string" && result.match(/\.(jpg|jpeg|png|webp)/i))) {
        const imageUrl = typeof result === "string" ? result : (Array.isArray(result) ? result[0]?.url || result[0] : thumbnail);

        return sock.sendMessage(
          m.key.remoteJid,
          {
            image: { url: imageUrl },
            caption: `╭〔 ♞ 𝐀𝐔𝐑𝐀 𝐃𝐎𝐌𝐀𝐈𝐍𝐒 〕⬣\n┃\n┃ 🖼️ *Twitter Image*\n┃\n╰━━━━━━━━━━━━━━━━━━⬣`,
          },
          { quoted: m }
        );
      }

      // Estructura alternada
      if (Array.isArray(result) && result.length > 0) {
        const mediaUrl = result[0].url || result[0];
        const isVid = type === "video" || mediaUrl.includes(".mp4");

        return sock.sendMessage(
          m.key.remoteJid,
          {
            [isVid ? "video" : "image"]: { url: mediaUrl },
            caption: `╭〔 ♞ 𝐀𝐔𝐑𝐀 𝐃𝐎𝐌𝐀𝐈𝐍𝐒 〕⬣\n┃\n┃ 📥 *Twitter Media*\n┃\n╰━━━━━━━━━━━━━━━━━━⬣`,
          },
          { quoted: m }
        );
      }

      return sock.sendMessage(m.key.remoteJid, { text: "❌ No se encontró ningún medio descargable en esa URL." }, { quoted: m });

    } catch (error) {
      console.error("[TWITTER CMD ERROR]:", error);
      return sock.sendMessage(m.key.remoteJid, { text: "❌ Ocurrió un error al procesar la solicitud." }, { quoted: m });
    }
  },
};
