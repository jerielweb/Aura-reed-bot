import axios from "axios";
import FormData from "form-data";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export default {
  name: ["hd", "remini", "upscale", "enhance"],
  category: "tools",
  description: "Mejora la calidad de una imagen (escala del 1 al 20).",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = message.message?.imageMessage;
    const isQuotedImage = quoted?.imageMessage;

    if (!isImage && !isQuotedImage) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐈𝐌𝐀𝐆𝐄𝐍\n╰━━━━━━━━━━━━⬣\n\n┃ > Responde a una imagen o envía una\n┃ > imagen con el comando .hd [1-20]\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
        },
        { quoted: message }
      );
    }

    let scale = 2;
    const inputScale = parseInt(args[0]);
    if (!isNaN(inputScale) && inputScale >= 1 && inputScale <= 20) {
      scale = inputScale;
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      const targetMessage = isQuotedImage
        ? { message: { imageMessage: quoted.imageMessage } }
        : message;

      const mediaBuffer = await downloadMediaMessage(
        targetMessage,
        "buffer",
        {}
      );

      const form = new FormData();
      // 'method' requerido por el backend de AlyaCore para diferenciar URL de Archivo Local
      form.append("method", "file"); 
      form.append("image", mediaBuffer, {
        filename: "image.jpg",
        contentType: "image/jpeg",
      });
      form.append("scale", scale.toString());

      const response = await axios.post(
        "https://api.alyacore.xyz/tools/upscale?key=oboe",
        form,
        {
          headers: {
            ...form.getHeaders(),
          },
          responseType: "arraybuffer",
          timeout: 60000,
        }
      );

      const resultBuffer = Buffer.from(response.data);

      const contentType = response.headers["content-type"];
      if (contentType && contentType.includes("application/json")) {
        const errorJson = JSON.parse(resultBuffer.toString("utf-8"));
        throw new Error(errorJson.message || errorJson.error || "Error en la API");
      }

      await socket.sendMessage(
        remoteJid,
        {
          image: resultBuffer,
          caption: `╭〔 ✨ 𝐈𝐌𝐀𝐆𝐄 𝐇𝐃 〕━⬣\n┃ ➥ 𝐄𝐬𝐜𝐚𝐥𝐚 › ${scale}x\n╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`,
        },
        { quoted: message }
      );

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en comando HD:", error?.response?.status || error.message);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐇𝐃\n╰━━━━━━━━━━━━⬣\n\n┃ > No se pudo procesar la imagen.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
        },
        { quoted: message }
      );
    }
  },
};
