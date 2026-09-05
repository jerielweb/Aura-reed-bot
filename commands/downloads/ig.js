import fetch from "node-fetch";
import {
  generateWAMessageFromContent,
  generateWAMessage,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";
import crypto from "crypto";
import { fytBold } from "../../models/TextStyle.js";

const IG_REGEX =
  /(?:instagram\.com|instagr\.am)\/(?:(?:reels?|p|tv)\/([A-Za-z0-9_-]+)|stories\/[^/]+\/(\d+))/;

async function sendAlbumMessage(socket, jid, array, quoted) {
  const userJid = jidNormalizedUser(
    socket.user?.id || socket.authState?.creds?.me?.id || "",
  );
  const album = await generateWAMessageFromContent(
    jid,
    {
      messageContextInfo: {
        messageSecret: crypto.randomBytes(32),
      },
      albumMessage: {
        expectedImageCount: array.filter((a) => "image" in a).length,
        expectedVideoCount: array.filter((a) => "video" in a).length,
      },
    },
    { quoted, userJid },
  );

  await socket.relayMessage(jid, album.message, {
    messageId: album.key.id,
  });

  for (let item of array) {
    const img = await generateWAMessage(jid, item, {
      upload: socket.waUploadToServer,
      userJid,
    });
    img.message.messageContextInfo = {
      messageSecret: crypto.randomBytes(32),
      messageAssociation: {
        associationType: 1,
        parentMessageKey: album.key,
      },
    };
    await socket.relayMessage(jid, img.message, {
      messageId: img.key.id,
    });
  }
  return album;
}

async function downloadInstagram(url) {
  if (!IG_REGEX.test(url)) throw new Error("Enlace de Instagram inválido.");

  const apiRes = await fetch(
    `https://api.delirius.online/download/instagramv2?url=${encodeURIComponent(url)}`,
  );
  const apiJson = await apiRes.json();

  if (!apiJson || !apiJson.status || !apiJson.data || !apiJson.data.download) {
    throw new Error(
      "No se pudo procesar el enlace con el servicio de descarga.",
    );
  }

  const data = apiJson.data;
  const downloadItems = data.download;

  const images = downloadItems
    .filter((item) => item.type === "image" && item.url)
    .map((item) => item.url);

  if (images.length > 0) {
    return {
      type: "images",
      title: data.caption || "",
      images: images,
    };
  }

  const videoItem = downloadItems.find(
    (item) => item.type === "video" && item.url,
  );
  if (videoItem) {
    return {
      type: "video",
      title: data.caption || "Sin título",
      downloadUrl: videoItem.url,
    };
  }

  throw new Error(
    "No se encontró contenido multimedia disponible en este enlace.",
  );
}

export default {
  name: ["ig", "instagram"],
  category: "downloads",
  description: "Descarga videos, reels o imágenes de Instagram.",

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const text = args.join(" ").trim();

    if (!text || !IG_REGEX.test(text)) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA ENLACE")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un enlace\n┃ > válido de Instagram.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      const result = await downloadInstagram(text);

      if (result.type === "video") {
        const caption = `╭〔 📸 ${fytBold("INSTAGRAM VIDEO")} 〕━⬣\n\n┃ ➥ ${fytBold(result.title || "Sin título")}\n\n╰〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕⬣`;

        await socket.sendMessage(
          remoteJid,
          {
            video: { url: result.downloadUrl },
            mimetype: "video/mp4",
            caption: caption,
          },
          { quoted: message },
        );
      } else if (result.type === "images") {
        const mediaArray = result.images
          .map((imgUrl) => ({ url: imgUrl }))
          .filter((m) => m.url && m.url.startsWith("http"));

        if (mediaArray.length === 0) {
          throw new Error("Sin imágenes válidas");
        }

        const albumCaption = `╭〔 📸 ${fytBold("INSTAGRAM POST")} 〕━⬣\n\n┃ ➥ ${fytBold(result.title || "Sin título")}\n\n┃ > ${fytBold("Total")} › ${mediaArray.length} imágenes\n╰〔 ⚡ ${fytBold("SYSTEM ACTIVE")} 〕⬣`;

        const album = mediaArray.map((m, i) => ({
          image: { url: m.url },
          caption: i === 0 ? albumCaption : "",
        }));

        if (album.length < 2) {
          await socket.sendMessage(
            remoteJid,
            {
              image: { url: album[0].image.url },
              caption: albumCaption,
            },
            { quoted: message },
          );
        } else {
          await sendAlbumMessage(socket, remoteJid, album, message);
        }
      }

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en ig:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });

      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR")} \n╰━━━━━━━━━━━━⬣\n\n┃ > ${error.message}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
