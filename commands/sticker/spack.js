import axios from "axios";
import sharp from "sharp";
import { fytBold } from "../../models/TextStyle.js";

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const toBuffer = async (url) =>
  Buffer.from((await axios.get(url, { responseType: "arraybuffer" })).data);

const toWebp = async (buffer, isAnimated = false) => {
  const base = sharp(buffer, isAnimated ? { animated: true } : {})
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 80, ...(isAnimated ? { loop: 0 } : {}) });
  return base.toBuffer();
};

const withRetry = async (fn, attempt = 1) => {
  try {
    return await fn();
  } catch (e) {
    if (e.response?.status === 429 && attempt <= 3) {
      await delay((e.response.headers["retry-after"] || 5) * 1000);
      return withRetry(fn, attempt + 1);
    }
    throw e;
  }
};

const searchStickerly = (query) =>
  withRetry(async () => {
    const { data } = await axios.get(
      "https://api.alyacore.xyz/stickerly/search",
      {
        params: { query, key: "oboe" },
      }
    );
    return data;
  });

const getPackDetail = (url) =>
  withRetry(async () => {
    // Extrae únicamente el ID/código del pack (ej. "L9B53U" de "https://sticker.ly/s/L9B53U")
    const packCode = url.split("/").pop();

    const { data } = await axios.get(
      "https://api.alyacore.xyz/stickerly/detail",
      {
        params: { url: packCode, key: "oboe" },
      }
    );
    return data;
  });

export default {
  name: ["stickersearch", "buscars", "spack"],
  description: "Busca e instala packs de stickers desde Sticker.ly.",
  adminOnly: false,

  execute: async (socket, message, args, { db, prefix }) => {
    const remoteJid = message.key.remoteJid;
    const query = args.join(" ");

    if (!query) {
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("FALTA BÚSQUEDA")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Debes ingresar el nombre del pack a buscar.\n`;
      text += `┃ > Ejemplo: ${prefix || "."}spack gatos\n\n`;
      text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;

      return await socket.sendMessage(
        remoteJid,
        { text },
        { quoted: message }
      );
    }

    // Reacción de espera
    await socket.sendMessage(remoteJid, {
      react: { text: "⏳", key: message.key },
    });

    try {
      const search = await searchStickerly(query);
      const resultados = search.resultados || search.result || [];
      const freePacks = resultados.filter((p) => !p.isPaid);

      if (!freePacks.length) {
        await socket.sendMessage(remoteJid, {
          react: { text: "❌", key: message.key },
        });
        let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
        text += `┃ ⚠️ ${fytBold("SIN RESULTADOS")}\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > No se encontraron packs para: "${query}".\n\n`;
        text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;

        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message }
        );
      }

      // Probar iterativamente los packs hasta encontrar uno que no dé error 500
      let detail = null;
      for (const pack of freePacks) {
        try {
          const res = await getPackDetail(pack.url);
          if (res?.status && res?.detalles?.stickers?.length) {
            detail = res;
            break; // Se encontró un pack válido
          }
        } catch (e) {
          // Si el pack da error 500 u otro fallo, continúa con el siguiente resultado
          continue;
        }
      }

      if (!detail) {
        await socket.sendMessage(remoteJid, {
          react: { text: "❌", key: message.key },
        });
        let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
        text += `┃ ⚠️ ${fytBold("ERROR DE LECTURA")}\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > No se pudo obtener el contenido de ningún paquete de la búsqueda.\n\n`;
        text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;

        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message }
        );
      }

      // Metadata del usuario / DB
      const senderNum =
        message.key.participant ||
        message.key.remoteJid.replace(/@s.whatsapp.net|@g.us/, "");
      const user = db?.users?.[senderNum] || {};

      const packName = user.text1 || global.packname || "Aura Reed";
      const authorName = user.text2 || global.author || `@${senderNum}`;

      const { detalles } = detail;
      const stickers = detalles.stickers.slice(0, 30);

      let infoText = `╭〔 📦 ${fytBold("AURA REED")} 〕⬣\n`;
      infoText += `┃ 🏷️ ${fytBold("PROCESANDO PACK")}\n`;
      infoText += `╰━━━━━━━━━━━━⬣\n\n`;
      infoText += `┃ 📌 Pack: ${detalles.name}\n`;
      infoText += `┃ 🖼️ Stickers: ${stickers.length}\n`;
      infoText += `┃ ⏳ Descargando y convirtiendo elementos...\n\n`;
      infoText += `╰〔 ⚡${fytBold("SYSTEM INFO")} 〕⬣`;

      await socket.sendMessage(
        remoteJid,
        { text: infoText },
        { quoted: message }
      );

      const stickerList = (
        await Promise.allSettled(
          stickers.map(async (s) => {
            const buf = await toBuffer(s.imageUrl);
            const webp = await toWebp(buf, s.isAnimated);
            return {
              sticker: webp,
              isAnimated: s.isAnimated || false,
              isLottie: false,
              emojis: ["🎭"],
            };
          })
        )
      )
        .filter((r) => r.status === "fulfilled")
        .map((r) => r.value);

      if (!stickerList.length) {
        await socket.sendMessage(remoteJid, {
          react: { text: "❌", key: message.key },
        });
        let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
        text += `┃ ⚠️ ${fytBold("ERROR DE PROCESAMIENTO")}\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > No se pudo convertir ningún sticker del paquete.\n\n`;
        text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;

        return await socket.sendMessage(
          remoteJid,
          { text },
          { quoted: message }
        );
      }

      const cover = await sharp(await toBuffer(detalles.thumbnailUrl))
        .resize(96, 96, { fit: "cover" })
        .webp({ quality: 80 })
        .toBuffer();

      // Envío del paquete de stickers completo vía Baileys
      await socket.sendMessage(
        remoteJid,
        {
          stickerPack: {
            name: packName,
            publisher: authorName,
            description: `${detalles.name} • ${global.botname || "Aura Reed"}`,
            cover,
            stickers: stickerList,
          },
        },
        { quoted: message }
      );

      // Reacción de éxito
      await socket.sendMessage(remoteJid, {
        react: { text: "✅", key: message.key },
      });
    } catch (error) {
      console.error(error);
      await socket.sendMessage(remoteJid, {
        react: { text: "❌", key: message.key },
      });

      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ⚠️ ${fytBold("ERROR DE SISTEMA")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > ${error.message}\n\n`;
      text += `╰〔 ⚡${fytBold("SYSTEM ALERT")} 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};
