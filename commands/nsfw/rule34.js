import fetch from "node-fetch";
import {
  generateWAMessageFromContent,
  generateWAMessage,
  jidNormalizedUser,
} from "@whiskeysockets/baileys";
import crypto from "crypto";
import { fytBold } from "../../models/TextStyle.js";

const USER_ID = "6679412";
const API_KEY = "2faa230764f8b4c823f54b2022fd240d2f9fa4a4e6fee5f89e76d0ca2fbf586967e3ccc14c5fa298239c87ffd8ae7256afd6ca49928b58ef2002ad1004c0da28";

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
  name: ["rule34", "r34"],
  category: "nsfw",
  description: "Busca imágenes en Rule34.",
  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const query = args.join(" ").trim();

    if (!query) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ ❌ ${fytBold("FALTA BUSQUEDA")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, proporciona un\n┃ > término de búsqueda.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }

    await socket.sendMessage(remoteJid, {
      react: { text: "🔍", key: message.key },
    });

    try {
      const url = `https://api.rule34.xxx/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent(query)}&limit=100&api_key=${API_KEY}&user_id=${USER_ID}`;
      
      const res = await fetch(url);
      const data = await res.json();

      if (!data || !Array.isArray(data) || data.length === 0) {
        throw new Error("Sin resultados");
      }

      // Mezclamos y seleccionamos hasta 10 elementos aleatorios
      const shuffled = data.sort(() => 0.5 - Math.random());
      const items = shuffled.slice(0, 10);

      let captionText = `╭━━〔 ${fytBold("RULE34 SEARCH")} 〕━━⬣\n`;
      captionText += `┃ 🔞 Tag: ${query}\n`;
      captionText += `┃ ⚙️ Motor: › Rule34 API\n`;
      captionText += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

      const mediaArray = items
        .map((item) => {
          const url = item.file_url || item.image || "";
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
      console.error("Error en Rule34 API:", error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("SIN RESULTADOS")}\n╰━━━━━━━━━━━━⬣\n\n┃ > No se encontraron resultados para "${query}".\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
        },
        { quoted: message },
      );
    }
  },
};
