import axios from "axios";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["ssweb", "ss", "webss"],
  category: "tools",
  description: "Captura de pantalla de una página web usando la API de AlyaCore.",
  ownerOnly: false,

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    let url = args[0];

    if (!url) {
      return await socket.sendMessage(
        remoteJid,
        { text: "❌ Ingresa una URL válida. Ejemplo: .ssweb https://google.com" },
        { quoted: message }
      );
    }

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    await socket.sendMessage(remoteJid, {
      react: { text: "🌐", key: message.key },
    });
    try {
      const apiUrl = `https://api.alyacore.xyz/tools/ssweb?url=${encodeURIComponent(url)}&device=pc&key=oboe`;

      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
      const imageBuffer = Buffer.from(response.data);
      
      let caption = `╭━〔 🌐 ${fytBold("SCREENSHOT WEB")} 〕━⬣\n`
      caption += `┃ ➥ ${fytBold("URL")} › ${url}\n`
      caption += `╰━━〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕━━⬣`
      
      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          image: imageBuffer,
          caption
        },
        { quoted: message }
      );

    } catch (error) {
      await socket.sendMessage(
        remoteJid,
        { text: "❌ Ocurrió un error al obtener la captura de pantalla." },
        { quoted: message }
      );
    }
  }
};
