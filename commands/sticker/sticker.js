import { downloadMediaMessage } from "@whiskeysockets/baileys";
import { fytBold } from "../../models/TextStyle.js";
import { exec } from "child_process";
import { promisify } from "util";
import ffmpegStatic from "ffmpeg-static";
import fs from "fs";
import path from "path";
import { ffmpegSemaphore } from "../../controllers/downloadUtils.js";

const execAsync = promisify(exec);

const customTemp = path.join(path.dirname(new URL(import.meta.url).pathname), "../../tmp");
if (!fs.existsSync(customTemp)) fs.mkdirSync(customTemp, { recursive: true });

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

// Convertidor usando ffmpeg-static con comandos directos vía execAsync
async function convertToSticker(inputPath, outputPath, isVideo, attempt = 1) {
  let fps = 60;
  let quality = 90;
  let duration = 20;
  let scale = 512;

  if (attempt === 2) {
    fps = 30;
    quality = 60;
    duration = 10;
    scale = 512;
  } else if (attempt === 3) {
    fps = 15;
    quality = 40;
    duration = 8;
    scale = 384;
  } else if (attempt >= 4) {
    fps = 10;
    quality = 30;
    duration = 5;
    scale = 320;
  }

  let optionsStr = `-an -vsync 0`;

  if (isVideo) {
    optionsStr += ` -loop 0 -t ${duration} -q:v ${quality} -preset default -compression_level 6`;
  } else {
    optionsStr += ` -q:v 80`;
  }

  // Filtro inteligente: Mantiene el tamaño proporcional exacto (sin estirar ni deformar) 
  // respetando los límites de ${scale}x${scale}, y rellena el espacio sobrante del cuadro de 512x512 
  // con un fondo completamente transparente (0x000000@0).
  const filtroVideo = isVideo
    ? `format=rgba,scale=${scale}:${scale}:force_original_aspect_ratio=decrease,fps=${fps},pad=512:512:(512-iw)/2:(512-ih)/2:color=0x000000@0`
    : `format=rgba,scale=512:512:force_original_aspect_ratio=decrease,pad=512:512:(512-iw)/2:(512-ih)/2:color=0x000000@0`;

  const cmd = `"${ffmpegStatic}" -y -i "${inputPath}" ${optionsStr} -vf "${filtroVideo}" -f webp "${outputPath}"`;

  await execAsync(cmd, { maxBuffer: 1024 * 1024 * 10 });
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

    const tempId = Date.now();
    const tempInPath = path.join(customTemp, `aura-sticker-in-${tempId}`);
    const tempOutPath = path.join(
      customTemp,
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
