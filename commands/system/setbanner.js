import { downloadMediaMessage } from "@whiskeysockets/baileys";
import fs from "fs";
import path from "path";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["setbanner", "setbaner"],
  category: "system",
  description: "Cambia la imagen o gif del menú del bot.",
  execute: async (
    sock,
    m,
    args,
    { prefix, db, saveDB, isOwner, numeroReal },
  ) => {
    const remoteJid = m.key.remoteJid;
    const botNumber = sock.user.id.split("@")[0].split(":")[0];
    const isSubBot = !!sock.isSubBot;

    let hasPermission = false;
    if (isSubBot) {
      hasPermission = numeroReal === botNumber;
    } else {
      hasPermission = isOwner;
    }

    if (!hasPermission) {
      return await sock.sendMessage(
        remoteJid,
        { text: "⚠️ No tienes permisos para usar este comando." },
        { quoted: m },
      );
    }

    const quotedMsg =
      m.message?.extendedTextMessage?.contextInfo?.quotedMessage;
    const getMediaMessage = (msg) => {
      if (!msg) return null;
      const content = msg.message || msg;
      const unwrapped =
        content?.viewOnceMessage?.message ||
        content?.viewOnceMessageV2?.message ||
        content?.documentWithCaptionMessage?.message ||
        content;
      if (unwrapped?.imageMessage || unwrapped?.videoMessage) {
        return unwrapped;
      }
      return null;
    };

    const mediaMsg = quotedMsg
      ? getMediaMessage(quotedMsg)
      : getMediaMessage(m.message);

    if (!mediaMsg) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA IMAGEN/GIF")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Responde a una imagen o gif (o envíalo como comentario/caption) usando *${prefix}setbanner*.`,
        },
        { quoted: m },
      );
    }

    await sock.sendMessage(remoteJid, { react: { text: "⏳", key: m.key } });

    try {
      const isVideo = !!mediaMsg.videoMessage;
      const mimetype = isVideo
        ? mediaMsg.videoMessage.mimetype
        : mediaMsg.imageMessage.mimetype;
      const ext = isVideo ? "gif" : "png";

      const downloadMsg = { key: m.key, message: mediaMsg };
      const buffer = await downloadMediaMessage(
        downloadMsg,
        "buffer",
        {},
        { logger: console },
      );
      if (!buffer || buffer.length === 0)
        throw new Error("No se pudo descargar el archivo.");

      const botId = isSubBot ? sock.subBotId : "principal";
      const timestamp = Date.now();

      // Ensure database directory exists
      if (!fs.existsSync("./database")) {
        fs.mkdirSync("./database", { recursive: true });
      }

      // Remove any old banner files for this specific bot to prevent accumulation
      const dir = "./database";
      if (fs.existsSync(dir)) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          if (file.startsWith(`banner_${botId}_`)) {
            try {
              fs.unlinkSync(path.join(dir, file));
            } catch (err) {
              console.error("Error al eliminar banner viejo:", err);
            }
          }
        }
      }

      const filename = `banner_${botId}_${timestamp}.${ext}`;
      const bannerPath = path.resolve(dir, filename);
      fs.writeFileSync(bannerPath, buffer);

      db.customBanner = {
        path: bannerPath,
        mimetype: mimetype,
      };
      await saveDB(db);

      await sock.sendMessage(remoteJid, { react: { text: "✅", key: m.key } });
      await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ✅ ${fytBold("AURA REED")} 〕⬣\n┃ ⚡ ${fytBold("BANNER ACTUALIZADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > El banner del menú ha sido cambiado con éxito.`,
        },
        { quoted: m },
      );
    } catch (error) {
      console.error("[setbanner] Error:", error);
      await sock.sendMessage(remoteJid, { react: { text: "❌", key: m.key } });
      await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message || "No se pudo actualizar el banner."}`,
        },
        { quoted: m },
      );
    }
  },
};
