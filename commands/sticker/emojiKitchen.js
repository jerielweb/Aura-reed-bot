import axios from "axios";
import fs from "fs";
import path from "path";
import { exec } from "child_process";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";
import { ffmpegSemaphore } from "../../controllers/downloadUtils.js";

const execAsync = promisify(exec);

const customTemp = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../../tmp",
);
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });

function extractEmojis(text) {
  // Expresión regular que detecta exactamente emojis Unicode válidos
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  const matches = text.match(emojiRegex);
  return matches || [];
}

export default {
  name: ["emojimix", "ekitchen", "emojikitchen"],
  category: "sticker",
  description:
    "Combina dos emojis y los convierte en un sticker usando Emoji Kitchen.",

  execute: async (sock, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    // Extraer la lista limpia de emojis
    const emojis = extractEmojis(text);

    // Validamos que tengamos al menos 2 emojis válidos en el texto
    if (emojis.length < 2) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: "╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀𝐍 𝐄𝐌𝐎𝐉𝐈𝐒\n╰━━━━━━━━━━━━⬣\n\n┃ > Envía dos emojis para combinar.\n┃ > Ejemplo: .emojimix 🥺+🔥\n",
        },
        { quoted: message },
      );
    }

    // Tomamos estrictamente los dos primeros
    const emoji1 = emojis[0];
    const emoji2 = emojis[1];

    await sock.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      const response = await axios.get(
        "https://api.alyacore.xyz/tools/emojimix",
        {
          params: {
            emoji1,
            emoji2,
            key: global.Apis?.apiAiya?.apikey || "oboe",
          },
          responseType: "arraybuffer",
          timeout: 60000,
        },
      );

      const rawBuffer = Buffer.from(response.data);
      if (!rawBuffer || rawBuffer.length < 100) {
        throw new Error("No se recibió una imagen válida de AlyaCore");
      }

      const tempId = Date.now();
      const inputPath = path.join(customTemp, `aura-emojimix-input-${tempId}`);
      const outputPath = path.join(
        customTemp,
        `aura-emojimix-output-${tempId}.webp`,
      );

      await fs.promises.writeFile(inputPath, rawBuffer);

      const filtroVideo = `format=rgba,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=0x000000@0,fps=15`;
      const cmd = `"${ffmpegStatic}" -y -i "${inputPath}" -vcodec libwebp -vf "${filtroVideo}" -loop 0 -preset default -an -vsync 0 -f webp "${outputPath}"`;

      await ffmpegSemaphore.run(() =>
        execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 }),
      );

      const webpStickerBuffer = await fs.promises.readFile(outputPath);

      const pushName = message.pushName || "Usuario";
      const packName = "𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝";
      const author = `@${pushName}`;

      let finalStickerBuffer;
      try {
        const { addStickerMetadata } =
          await import("../../controllers/stickerMetadata.js");
        finalStickerBuffer = await addStickerMetadata(
          webpStickerBuffer,
          packName,
          author,
        );
      } catch (err) {
        console.error("[EmojiKitchen] Error al inyectar metadatos:", err);
        finalStickerBuffer = webpStickerBuffer;
      }

      await sock.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
      await sock.sendMessage(
        remoteJid,
        { sticker: finalStickerBuffer, mimetype: "image/webp" },
        { quoted: message },
      );

      await Promise.allSettled([
        fs.promises.unlink(inputPath),
        fs.promises.unlink(outputPath),
      ]);
    } catch (error) {
      console.error("[EmojiKitchen] Error al crear sticker:", error);
      return await sock.sendMessage(
        remoteJid,
        {
          text: "╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐀𝐋 𝐂𝐑𝐄𝐀𝐑 𝐒𝐓𝐈𝐂𝐊𝐄𝐑\n╰━━━━━━━━━━━━⬣\n\n┃ > No pude combinar esos emojis.\n┃ > Intenta con otra combinación.\n",
        },
        { quoted: message },
      );
    }
  },
};
