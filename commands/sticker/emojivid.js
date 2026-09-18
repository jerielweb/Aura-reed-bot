import axios from "axios";
import fs from "fs";
import path from "path";

function extractEmojis(text) {
  const emojiRegex = /\p{Extended_Pictographic}/gu;
  return text.match(emojiRegex) || [];
}

const customTemp = path.join(
  path.dirname(new URL(import.meta.url).pathname),
  "../../cache",
);

if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });

export default {
  name: ["emojivid", "emoji", "emoji-video", "emojivideo"],
  category: "sticker",
  description:
    "Genera un sticker animado a partir de un emoji usando AlyaCore.",

  execute: async (sock, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;
    const rawText = args.join(" ").trim();
    const emojis = extractEmojis(rawText);
    const emoji = emojis[0] || rawText;

    if (!emoji || !/\p{Extended_Pictographic}/u.test(emoji)) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐄𝐌𝐎𝐉𝐈\n╰━━━━━━━━━━━━⬣\n\n┃ > Envía un emoji para crear el sticker.\n┃ > Ejemplo: ${prefix}emojivid ❤️\n`,
        },
        { quoted: message },
      );
    }

    await sock.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      const response = await axios.get(
        "https://api.alyacore.xyz/whatsapp/emoji",
        {
          params: {
            emoji,
            key: global.Apis?.apiAiya?.apikey,
          },
          responseType: "arraybuffer",
          timeout: 60000,
        },
      );

      const stickerBuffer = Buffer.from(response.data);
      if (!stickerBuffer || stickerBuffer.length < 100) {
        throw new Error("No se recibió un sticker válido de AlyaCore");
      }

      if (
        stickerBuffer.subarray(0, 4).toString("ascii") !== "RIFF" ||
        stickerBuffer.toString("ascii", 8, 12) !== "WEBP"
      ) {
        throw new Error("La API respondió con contenido no compatible");
      }

      const tempId = Date.now();
      const outputPath = path.join(customTemp, `aura-emojivid-${tempId}.webp`);
      await fs.promises.writeFile(outputPath, stickerBuffer);

      const pushName = message.pushName || "Usuario";
      const packName = "𝐀𝐮𝐫𝐚 𝐑𝐞𝐞𝐝";
      const author = `@${pushName}`;

      let finalStickerBuffer = stickerBuffer;
      try {
        const { addStickerMetadata } =
          await import("../../controllers/stickerMetadata.js");
        finalStickerBuffer = await addStickerMetadata(
          stickerBuffer,
          packName,
          author,
        );
      } catch (err) {
        console.error("[EmojiVid] Error al inyectar metadatos:", err);
      }

      await sock.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });

      await sock.sendMessage(
        remoteJid,
        { sticker: finalStickerBuffer, mimetype: "image/webp" },
        { quoted: message },
      );

      await fs.promises.unlink(outputPath).catch(() => {});
    } catch (error) {
      console.error("[EmojiVid] Error al crear sticker:", error);
      return await sock.sendMessage(
        remoteJid,
        {
          text: "╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐀𝐋 𝐂𝐑𝐄𝐀𝐑 𝐒𝐓𝐈𝐂𝐊𝐄𝐑\n╰━━━━━━━━━━━━⬣\n\n┃ > No pude generar el sticker con ese emoji.\n┃ > Prueba con otro emoji o intenta más tarde.\n",
        },
        { quoted: message },
      );
    }
  },
};
