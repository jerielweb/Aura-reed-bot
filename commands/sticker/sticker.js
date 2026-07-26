import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { fytBold } from "../../models/TextStyle.js";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "@ffprobe-installer/ffprobe";
import fs from "fs";
import path from "path";
import os from "os";
import { ffmpegSemaphore } from "../../controllers/downloadUtils.js";

ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

// Función para desempaquetar el mensaje multimedia
function unwrapMessage(msg) {
  if (!msg) return null;
  if (
    msg.imageMessage ||
    msg.videoMessage ||
    msg.documentMessage ||
    msg.stickerMessage
  ) {
    return msg;
  }
  if (msg.viewOnceMessageV2?.message) {
    return unwrapMessage(msg.viewOnceMessageV2.message);
  }
  if (msg.viewOnceMessage?.message) {
    return unwrapMessage(msg.viewOnceMessage.message);
  }
  if (msg.documentWithCaptionMessage?.message) {
    return unwrapMessage(msg.documentWithCaptionMessage.message);
  }
  return null;
}

// Convertidor con parámetros agresivos de compresión para animados
async function convertToSticker(inputPath, outputPath, isVideo, attempt = 1) {
  return new Promise((resolve, reject) => {
    let fps = 60;
    let quality = 50;
    let duration = 20;
    let scale = 512;

    // Niveles escalonados de compresión agresiva
    if (attempt === 2) {
      fps = 30;
      quality = 30;
      duration = 10;
      scale = 512;
    } else if (attempt === 3) {
      fps = 15;
      quality = 20;
      duration = 8;
      scale = 384; // Reduce resolución para bajar tamaño drásticamente
    } else if (attempt >= 4) {
      fps = 10;
      quality = 10;
      duration = 5;
      scale = 320;
    }

    const options = ["-vcodec libwebp", "-an", "-vsync 0"];

    if (isVideo) {
      options.push("-loop 0");
      options.push(`-t ${duration}`);
      options.push(`-q:v ${quality}`);
      options.push("-preset default");
      options.push("-compression_level 6"); // Máxima compresión WebP
    } else {
      options.push("-q:v 80");
    }

    const filtroVideo = isVideo
      ? `format=rgba,scale=${scale}:${scale}:force_original_aspect_ratio=decrease,fps=${fps},pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x000000@0`
      : `format=rgba,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=0x000000@0`;

    ffmpeg(inputPath)
      .outputOptions(options)
      .videoFilters(filtroVideo)
      .toFormat("webp")
      .save(outputPath)
      .on("end", resolve)
      .on("error", reject);
  });
}

export default {
  name: ["s", "sticker", "stiker"],
  category: "sticker",
  description: "Convierte imágenes, videos, GIFs o stickers animaciones en stickers.",
  execute: async (socket, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;

    const quoted =
      message.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const targetMessage = quoted
      ? unwrapMessage(quoted)
      : unwrapMessage(message.message);

    if (!targetMessage) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA MEDIO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, envía una imagen/video/sticker\n┃ > con la descripción *${prefix}s* o responde\n┃ > a un archivo con *${prefix}s*.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    const tempId = Date.now();
    const tempInPath = path.join(os.tmpdir(), `aura-sticker-in-${tempId}`);
    const tempOutPath = path.join(
      os.tmpdir(),
      `aura-sticker-out-${tempId}.webp`,
    );

    try {
      const downloadMsg = { key: message.key, message: targetMessage };
      const buffer = await downloadMediaMessage(
        downloadMsg,
        "buffer",
        {},
        { logger: console },
      );

      if (!buffer || buffer.length === 0) {
        throw new Error("No se pudo descargar el archivo o está vacío.");
      }

      await fs.promises.writeFile(tempInPath, buffer);

      // Detectar si es contenido animado (video, doc de video o sticker animado/isAnimated)
      const isVideo =
        !!targetMessage.videoMessage ||
        (targetMessage.documentMessage &&
          targetMessage.documentMessage.mimetype?.startsWith("video/")) ||
        (targetMessage.stickerMessage &&
          targetMessage.stickerMessage.isAnimated);

      if (!isVideo) {
        await ffmpegSemaphore.run(() =>
          convertToSticker(tempInPath, tempOutPath, false),
        );
      } else {
        let attempt = 1;
        let fileSize = Infinity;

        // Intentos progresivos hasta comprimir a < 1 MB (Límite de WhatsApp)
        while (fileSize > 1000000 && attempt <= 4) {
          if (fs.existsSync(tempOutPath)) {
            await fs.promises.unlink(tempOutPath);
          }

          await ffmpegSemaphore.run(() =>
            convertToSticker(tempInPath, tempOutPath, true, attempt),
          );

          fileSize = fs.statSync(tempOutPath).size;
          attempt++;
        }

        if (fileSize > 1000000) {
          throw new Error(
            "El video/sticker es demasiado pesado. Intenta con uno más corto.",
          );
        }
      }

      const stickerBuffer = await fs.promises.readFile(tempOutPath);

      const pushName = message.pushName || "Usuario";
      const packName = `${fytBold("AURA REED")} 🧠 ${fytBold("BOT")}`;
      const author = `@${pushName}`;

      let finalStickerBuffer;
      try {
        const { addStickerMetadata } =
          await import("../../controllers/stickerMetadata.js");
        finalStickerBuffer = await addStickerMetadata(
          stickerBuffer,
          packName,
          author,
        );
      } catch (err) {
        finalStickerBuffer = stickerBuffer;
      }

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          sticker: finalStickerBuffer,
          mimetype: "image/webp",
        },
        { quoted: message },
      );
    } catch (error) {
      console.error("Error al generar sticker:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR AL CREAR STICKER")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "No pude generar el sticker."}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    } finally {
      try {
        if (fs.existsSync(tempInPath)) await fs.promises.unlink(tempInPath);
        if (fs.existsSync(tempOutPath)) await fs.promises.unlink(tempOutPath);
      } catch (err) {
        console.error("Error al limpiar archivos temporales de sticker:", err);
      }
    }
  },
};
