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

// Convertidor con parámetros para FFmpeg (solo imágenes, videos o GIFs)
async function convertToSticker(inputPath, outputPath, isVideo, attempt = 1) {
  return new Promise((resolve, reject) => {
    let fps = 30;
    let quality = 40;
    let duration = 15;
    let scale = 512;

    if (attempt === 2) {
      fps = 20;
      quality = 30;
      duration = 8;
      scale = 480;
    } else if (attempt === 3) {
      fps = 10;
      quality = 20;
      duration = 5;
      scale = 320;
    } else if (attempt >= 4) {
      fps = 8;
      quality = 15;
      duration = 4;
      scale = 256;
    }

    const options = ["-an", "-c:v", "libwebp"];

    if (isVideo) {
      options.push(
        "-loop", "0",
        "-t", String(duration),
        "-q:v", String(quality),
        "-compression_level", "6"
      );
    } else {
      options.push("-q:v", "80");
    }

    // Tu filtro original intacto
    const filtroVideo = isVideo
      ? `fps=${fps},scale=${scale}:${scale}:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0,format=yuva420p`
      : `scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(ow-iw)/2:(oh-ih)/2:color=black@0,format=yuva420p`;

    ffmpeg(inputPath)
      .outputOptions(options)
      .videoFilters(filtroVideo)
      .toFormat("webp")
      .save(outputPath)
      .on("end", resolve)
      .on("error", (err) => {
        console.error("[FFmpeg Error Details]:", err);
        reject(err);
      });
  });
}

export default {
  name: ["s", "sticker", "stiker"],
  category: "sticker",
  description: "Convierte imágenes, videos o reescribe metadatos de stickers.",
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

    // SOLUCIÓN AL ERROR 69: Detección de extensión para el archivo temporal
    let ext = ".tmp";
    if (targetMessage.imageMessage) ext = ".jpg";
    else if (targetMessage.videoMessage) ext = ".mp4";
    else if (targetMessage.stickerMessage) ext = ".webp";
    else if (targetMessage.documentMessage) {
      const mime = targetMessage.documentMessage.mimetype || "";
      if (mime.includes("image")) ext = ".jpg";
      else if (mime.includes("video")) ext = ".mp4";
    }

    const tempId = Date.now();
    const tempInPath = path.join(os.tmpdir(), `aura-sticker-in-${tempId}${ext}`);
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

      let stickerBuffer;

      // SI YA ES UN STICKER: Nos saltamos FFmpeg para evitar cierres o fallos
      if (targetMessage.stickerMessage) {
        stickerBuffer = buffer;
      } else {
        // SI ES IMAGEN, VIDEO O DOCUMENTO: Procesamos con FFmpeg
        await fs.promises.writeFile(tempInPath, buffer);

        const isVideo =
          !!targetMessage.videoMessage ||
          (targetMessage.documentMessage &&
            targetMessage.documentMessage.mimetype?.startsWith("video/"));

        if (!isVideo) {
          await ffmpegSemaphore.run(() =>
            convertToSticker(tempInPath, tempOutPath, false),
          );
        } else {
          let attempt = 1;
          let fileSize = Infinity;

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
              "El video es demasiado pesado. Intenta con uno más corto.",
            );
          }
        }

        stickerBuffer = await fs.promises.readFile(tempOutPath);
      }

      // Reescritura / Inyección de Metadatos (Nombre del Pack y Autor)
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
        console.error("[Sticker] Error al inyectar metadatos:", err);
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