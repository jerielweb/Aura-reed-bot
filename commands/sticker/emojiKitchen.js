import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import { ffmpegSemaphore } from "../../controllers/downloadUtils.js";

ffmpeg.setFfmpegPath(ffmpegPath);

function extractEmojis(text) {
  // Eliminamos letras, números, espacios y el signo '+'
  const cleanedText = text.replace(/[a-zA-Z0-9\s+]/g, "");

  // Convertimos la cadena limpia en un array real (soporta cualquier versión de Node)
  // SIN usar 'Set' para permitir que combinen el mismo emoji (ej: 🤣 + 🤣)
  return Array.from(cleanedText);
}

async function raceEmojiApis(apis) {
  const runners = apis.map((api) =>
    api.request().then((res) => {
      const buffer = Buffer.from(res.data);
      if (!buffer || buffer.length < 100) {
        throw new Error(`[${api.name}] no devolvió imagen válida`);
      }
      return buffer;
    }),
  );

  if (typeof Promise.any === "function") {
    return Promise.any(runners);
  }

  const results = await Promise.allSettled(runners);
  for (const result of results) {
    if (result.status === "fulfilled") return result.value;
  }
  throw new Error(
    results
      .map((r) =>
        r.status === "rejected" ? r.reason?.message || String(r.reason) : "ok",
      )
      .join(", "),
  );
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

    const apis = [
      {
        name: "AlyaCore tools/emojimix",
        request: () =>
          axios.get("https://api.alyacore.xyz/tools/emojimix", {
            params: {
              emoji1,
              emoji2,
              key: global.Apis?.apiAiya?.apikey || "oboe",
            },
            responseType: "arraybuffer",
            timeout: 60000,
          }),
      },
      {
        name: "StellarWA tools/emojimix",
        request: () =>
          axios.get("https://api.stellarwa.xyz/tools/emojimix", {
            params: {
              emoji1,
              emoji2,
              key: "api-7C3jf",
            },
            responseType: "arraybuffer",
            timeout: 60000,
          }),
      },
    ];

    try {
      const rawBuffer = await raceEmojiApis(apis);

      const tempId = Date.now();
      const inputPath = path.join(os.tmpdir(), `aura-emojimix-input-${tempId}`);
      const outputPath = path.join(
        os.tmpdir(),
        `aura-emojimix-output-${tempId}.webp`,
      );

      await fs.promises.writeFile(inputPath, rawBuffer);

      await ffmpegSemaphore.run(
        () =>
          new Promise((resolve, reject) => {
            ffmpeg(inputPath)
              .outputOptions([
                "-vcodec libwebp",
                "-vf scale=512:512:force_original_aspect_ratio=decrease,fps=15",
                "-loop 0",
                "-preset default",
                "-an",
                "-vsync 0",
              ])
              .toFormat("webp")
              .save(outputPath)
              .on("end", resolve)
              .on("error", reject);
          }),
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
