import axios from "axios";
import FormData from "form-data";
import { downloadMediaMessage } from "@whiskeysockets/baileys";

export default {
  name: ["hd", "remini", "upscale", "enhance"],
  category: "tools",
  description: "Mejora la calidad de una imagen (Escala: 2 o 4).",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;

    const quoted = message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const isImage = message.message?.imageMessage;
    const isQuotedImage = quoted?.imageMessage;

    if (!isImage && !isQuotedImage) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐈𝐌𝐀𝐆𝐄𝐍\n╰━━━━━━━━━━━━⬣\n\n┃ > Responde a una imagen o envía una\n┃ > imagen con el comando .hd [2 o 4]\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
        },
        { quoted: message }
      );
    }

    // Validar que la escala sea estrictamente 2 o 4 (por defecto 2)
    let scale = 2;
    const inputScale = parseInt(args[0]);
    if (inputScale === 4) {
      scale = 4;
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
      form.append("method", "local");
      form.append("scale", scale.toString());
      form.append("file", mediaBuffer, {
        filename: "image.jpg",
        contentType: "image/jpeg",
      });

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
      console.error("Error en comando HD:", error?.response?.data ? Buffer.from(error.response.data).toString('utf-8') : error.message);
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
