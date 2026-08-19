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
      // Pedimos un límite mayor a la API (ej. 100) para tener de dónde escoger aleatoriamente
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

      // Mezclamos el array aleatoriamente y tomamos un máximo de 10
      const shuffled = data.sort(() => 0.5 - Math.random());
      const selectedPosts = shuffled.slice(0, 10);

      // Enviamos cada imagen en un bucle
      for (const [index, post] of selectedPosts.entries()) {
        const fileUrl = post.file_url || post.image;
        if (!fileUrl) continue;

        const caption = `╭〔 🔞 ${fytBold(`RULE34 (${index + 1}/${selectedPosts.length})`)} 〕━⬣\n\n` +
                        `┃ > ${fytBold("ID")} › ${post.id}\n` +
                        `┃ > ${fytBold("Tags")} › ${post.tags.split(" ").slice(0, 5).join(", ")}...\n` +
                        `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

        await socket.sendMessage(
          remoteJid,
          {
            image: { url: fileUrl },
            caption: caption,
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