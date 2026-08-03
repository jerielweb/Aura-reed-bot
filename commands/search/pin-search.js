import fetch from "node-fetch";
import { fytBold } from "../../models/TextStyle.js";

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "Accept-Encoding": "identity",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
  return await res.json();
}

export default {
  name: ["pin", "pinterest"],
  category: "search",
  description: "Busca una imagen en Pinterest.",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const query = args.join(" ").trim();

    if (!query) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BUSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona una consulta\n┃ > para buscar en Pinterest.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "🔍", key: message.key },
    });

    try {
      const url = `https://api.alyacore.xyz/search/pinterest?query=${encodeURIComponent(query)}&key=oboe`;
      const res = await fetchJson(url);

      if (!res.status || !Array.isArray(res.data) || res.data.length === 0) {
        throw new Error("Sin resultados");
      }

      const item = res.data[0];
      const imageUrl = item.hd || item.mini || item.image;

      if (!imageUrl) {
        throw new Error("Imagen no disponible");
      }

      let captionText = `╭━━〔 ${fytBold("PINTEREST SEARCH")} 〕━━⬣\n`;
      captionText += `┃ 🔍 Pin: ${query}\n`;
      captionText += `┃ ⚙️ Motor: › Alya Core\n`;
      captionText += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

      await socket.sendMessage(
        remoteJid,
        {
          image: { url: imageUrl },
          caption: captionText,
        },
        { quoted: message }
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en Pinterest API:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("SIN RESULTADOS")}\n╰━━━━━━━━━━━━⬣\n\n┃ > No se encontraron resultados para "${query}".\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
