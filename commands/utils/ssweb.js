import axios from "axios";

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

    try {
      const apiUrl = `https://api.alyacore.xyz/tools/ssweb?url=${encodeURIComponent(url)}&device=pc&key=oboe`;

      const response = await axios.get(apiUrl, { responseType: "arraybuffer" });
      const imageBuffer = Buffer.from(response.data);

      await socket.sendMessage(
        remoteJid,
        {
          image: imageBuffer,
          caption: `🌐 *Captura realizada:* ${url}`
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
