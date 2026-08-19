import { fytBold } from "../../models/TextStyle.js";

const USER_ID = "6679412";
const API_KEY = "2faa230764f8b4c823f54b2022fd240d2f9fa4a4e6fee5f89e76d0ca2fbf586967e3ccc14c5fa298239c87ffd8ae7256afd6ca49928b58ef2002ad1004c0da28";

export default {
  name: ["rule34", "r34"],
  category: "nsfw",
  description: "Busca imágenes en Rule34.",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BUSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > término de búsqueda.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(text)}&limit=100&api_key=${API_KEY}&user_id=${USER_ID}`;
      
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!data || data.length === 0) {
        await socket.sendMessage(remoteJid, {
          react: { text: "❌", key: message.key },
        });
        return await socket.sendMessage(
          remoteJid,
          {
            text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("SIN RESULTADOS")}\n╰━━━━━━━━━━━━⬣\n\n┃ > No se encontro ninguna imagen.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
          },
          { quoted: message },
        );
      }

      // Mezclamos y seleccionamos 4 o hasta 10 imágenes para el álbum
      const shuffled = data.sort(() => 0.5 - Math.random());
      const selectedPosts = shuffled.slice(0, 4); // WhatsApp suele agrupar visualmente muy bien de 4 en adelante (tipo collage)

      // Preparamos el texto del pie de página (caption) similar al estilo de tu captura
      const caption = `╭───〔 🔞 ${fytBold("RULE34 SEARCH")} 〕───⬣\n` +
                      `┃ 🔍 Búsqueda: ${text}\n` +
                      `┃ ⚙️ Motor: › Rule34 API\n` +
                      `╰───〔 ⚡ ${fytBold("AURA REED")} 〕───⬣`;

      // Enviamos el álbum utilizando la estructura compatible con Baileys
      for (let i = 0; i < selectedPosts.length; i++) {
        const post = selectedPosts[i];
        const fileUrl = post.file_url || post.image;
        if (!fileUrl) continue;

        // Si es la primera imagen, adjuntamos el banner/caption principal
        await socket.sendMessage(
          remoteJid,
          {
            image: { url: fileUrl },
            caption: i === 0 ? caption : undefined,
          },
          { quoted: message },
        );
      }

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en rule34:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR DE BÚSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "Ocurrio un error inesperado."}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
