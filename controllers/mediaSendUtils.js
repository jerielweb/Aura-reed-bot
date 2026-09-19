import crypto from "crypto";
import {
  generateWAMessage,
  generateWAMessageFromContent,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";

const ALBUM_DELAY = Number(process.env.ALBUM_ITEM_DELAY_MS || 900);
const MAX_ITEMS = Number(process.env.MAX_ALBUM_ITEMS || 6);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function isRateLimitError(err) {
  if (!err) return false;
  const status = err.status || err.statusCode || err?.output?.statusCode;
  if (status === 429) return true;
  
  const text = String(err.message || err.data?.message || "").toLowerCase();
  return text.includes("429") || text.includes("rate") || text.includes("too many");
}

async function relayWithRateLimit(socket, jid, message, messageId) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      return await socket.relayMessage(jid, message, { messageId });
    } catch (error) {
      if (attempt === 3 || !isRateLimitError(error)) throw error;
      
      const retryHeader = Number(error?.response?.headers?.["retry-after"] || error?.headers?.["retry-after"] || 0);
      const delay = Math.max(retryHeader * 1000, 1500 * (2 ** (attempt - 1)));
      await sleep(delay);
    }
  }
}

export async function sendAlbumMessage(socket, jid, items, quoted) {
  if (!Array.isArray(items) || items.length === 0) return null;

  const albumItems = items.slice(0, MAX_ITEMS);
  const userJid = jidNormalizedUser(socket.user?.id || "");
  
  const expectedImageCount = albumItems.filter((i) => i.image).length;
  const expectedVideoCount = albumItems.filter((i) => i.video).length;

  if (expectedImageCount === 0 && expectedVideoCount === 0) return null;

  const album = await generateWAMessageFromContent(
    jid,
    {
      messageContextInfo: { messageSecret: crypto.randomBytes(32) },
      albumMessage: { expectedImageCount, expectedVideoCount },
    },
    { quoted, userJid }
  );

  await relayWithRateLimit(socket, jid, album.message, album.key.id);

  for (let i = 0; i < albumItems.length; i++) {
    if (i > 0) await sleep(ALBUM_DELAY);

    try {
      const mediaMessage = await generateWAMessage(jid, albumItems[i], {
        upload: socket.waUploadToServer,
        userJid,
      });

      mediaMessage.message.messageContextInfo = {
        messageSecret: crypto.randomBytes(32),
        messageAssociation: {
          associationType: 1,
          parentMessageKey: album.key,
        },
      };

      await relayWithRateLimit(
        socket,
        jid,
        mediaMessage.message,
        mediaMessage.key.id
      );
    } catch (err) {}
  }

  return album;
}
