import fetch from "node-fetch";
import {
  generateWAMessageFromContent,
  generateWAMessage,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";
import crypto from "crypto";
import { fytBold } from "../../models/TextStyle.js";

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      "Accept-Encoding": "identity",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} - ${res.statusText}`);
  return await res.json();
}

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

export default {
  name: ["pin", "pinterest"],
  category: "search",
  description: "Busca imágenes en Pinterest.",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const query = args.join(" ").trim();

    if (!query) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BUSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona una consulta\n┃ > para buscar en Pinterest.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "🔍", key: message.key },
    });

    try {
      const url = `https://api.alyacore.xyz/search/pinterest?query=${encodeURIComponent(query)}&key=oboe`;
      const res = await fetchJson(url);

      if (!res.status || !Array.isArray(res.data) || res.data.length === 0) {
        throw new Error("Sin resultados");
      }

      // Limitado a 5 para mantener el álbum estable sin sobrecargar el servidor
      const items = res.data.slice(0, 10);
      
      let captionText = `╭━━〔 ${fytBold("PINTEREST SEARCH")} 〕━━⬣\n`;
      captionText += `┃ 🔍 Pin: ${query}\n`;
      captionText += `┃ ⚙️ Motor: › Alya Core\n`;
      captionText += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

      const mediaArray = items
        .map((item) => {
          const url = item.hd || item.mini || item.image || (typeof item === 'string' ? item : "");
          return { url };
        })
        .filter((m) => m.url && m.url.startsWith("http"));

      if (mediaArray.length === 0) {
        throw new Error("Sin imágenes válidas");
      }

      const album = mediaArray.map((m, i) => ({
        image: { url: m.url },
        caption: i === 0 ? captionText : "",
      }));

      if (album.length < 2) {
        await socket.sendMessage(remoteJid, {
          image: { url: album[0].image.url },
          caption: captionText
        }, { quoted: message });
      } else {
        await sendAlbumMessage(socket, remoteJid, album, message);
      }

      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error("Error en Pinterest API:", error.message);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      
      const isRateLimit = error.message.includes("429") || error.message.includes("rate-overlimit");
      const errorMsg = isRateLimit 
        ? "El servicio de Pinterest está saturado temporalmente." 
        : `No se encontraron resultados para "${query}".`;

      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR")} \n╰━━━━━━━━━━━━⬣\n\n┃ > ${errorMsg}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
