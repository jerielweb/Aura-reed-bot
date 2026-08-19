import { fytBold } from "../../models/TextStyle.js";

const USER_ID = "6679412";
const API_KEY = "2faa230764f8b4c823f54b2022fd240d2f9fa4a4e6fee5f89e76d0ca2fbf586967e3ccc14c5fa298239c87ffd8ae7256afd6ca49928b58ef2002ad1004c0da28"; // Ingresa tu API key si la requieres, o déjala vacía si tu cuenta no la pide

export default {
  name: ["rule34", "r34"],
  category: "downloads",
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
      const apiUrl = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(text)}&api_key=${API_KEY}&user_id=${USER_ID}`;
      
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

      // Selecciona un post aleatorio de los resultados obtenidos
      const randomPost = data[Math.floor(Math.random() * data.length)];
      const fileUrl = randomPost.file_url || randomPost.image;

      if (!fileUrl) {
        throw new Error("El post encontrado no tiene una URL de archivo válida.");
      }

      const caption = `╭〔 🔞 ${fytBold("RULE34 SEARCH")} 〕━⬣\n\n` +
                      `┃ > ${fytBold("ID")} › ${randomPost.id}\n` +
                      `┃ > ${fytBold("Tags")} › ${randomPost.tags.split(" ").slice(0, 5).join(", ")}...\n` +
                      `┣━━━━━━━━━━━━⬣\n` +
                      `┃ ⏳ Enviando resultado...\n` +
                      `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`;

      await socket.sendMessage(
        remoteJid,
        {
          image: { url: fileUrl },
          caption: caption,
        },
        { quoted: message },
      );

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
