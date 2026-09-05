import { gacha } from "../../models/gachaDb.js";
import { box } from "../../models/gachaUI.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

async function getRandomImage(tag) {
  try {
    const res = await fetch(
      `https://konachan.net/post.json?tags=${encodeURIComponent(tag)}+rating:s&limit=50&page=1`,
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) return null;
    const posts = await res.json();
    if (!Array.isArray(posts) || posts.length === 0) return null;
    const valid = posts.filter((p) => {
      const tags = (p.tags || "").toLowerCase();
      return (
        (p.file_url || p.sample_url) &&
        !tags.includes("loli") &&
        !tags.includes("shota") &&
        !tags.includes("corrupt_file")
      );
    });
    if (valid.length === 0) return null;
    const pick = valid[Math.floor(Math.random() * valid.length)];
    return pick.file_url || pick.sample_url;
  } catch {
    return null;
  }
}

export default {
  name: ["dailyrw", "dailyroll", "drw", "dailychar", "diariorw"],
  category: "gacha",
  description: "🎁 Obtén un roll diario GRATIS (sin cooldown). .dailyrw",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const userId = ctx.sender;

    if (gacha.hasUsedDailyRoll(userId)) {
      await ctx.reply(
        box(
          "⏰",
          "DAILY RW",
          "Ya usaste tu roll diario hoy... ⏰",
          [],
          "💡 Vuelve mañana para otro roll gratis.\n> Usa *.rw* para hacer rolls con cooldown normal.",
        ),
      );
      return;
    }

    const char = gacha.getRandomCharacter();
    if (!char) {
      await ctx.reply(
        box(
          "❌",
          "DAILY RW",
          "Sin personajes...",
          [],
          "El owner debe usar *.genchar* para agregar personajes.",
        ),
      );
      return;
    }

    const imageUrl = await getRandomImage(char.booru_tag);
    if (!imageUrl) {
      await ctx.reply(
        box(
          "❌",
          "DAILY RW",
          "Sin imagen...",
          [],
          `No se encontró imagen para *${char.name}*. Intenta de nuevo.`,
        ),
      );
      return;
    }

    try {
      gacha.giveCharacter(userId, char.id);
    } catch {
      await ctx.reply(
        box(
          "⚠️",
          "DAILY RW",
          `Ya tienes a *${char.name}*...`,
          [],
          "Pero igual puedes verlo. 💡 Si lo vendes, ganarás monedas.",
        ),
      );

      const caption = box(
        "🎁",
        char.name,
        undefined,
        [
          `⚥GÉNERO › ${char.gender}`,
          `📖SERIE › ${char.series}`,
          `💴VALOR › ${char.value.toLocaleString()} ¥`,
          `⚠️ Ya lo tenías en tu harem`,
        ],
        "💡 Usa *.harem* para ver tu colección.",
      );

      await ctx.sock.sendMessage(
        ctx.chatId,
        {
          image: { url: imageUrl },
          caption,
        },
        { quoted: ctx.msg },
      );

      gacha.setDailyRollUsed(userId);
      return;
    }

    const bonus = Math.floor(Math.random() * 500) + 100;
    ctx.addCoins(bonus);

    gacha.updateGachaStats(userId, (s) => {
      s.totalClaimed += 1;
      s.totalValue += char.value;
    });

    gacha.setDailyRollUsed(userId);

    const caption = box(
      "🎁",
      "🎉 DAILY RW — PERSONAJE OBTENIDO 🎉",
      char.name,
      [
        `⚥GÉNERO › ${char.gender}`,
        `📖SERIE › ${char.series}`,
        `💴VALOR › ${char.value.toLocaleString()} ¥`,
        `💰 BONUS DIARIO › +${bonus.toLocaleString()} ¥`,
      ],
      "✅ El personaje se agregó directamente a tu harem. Vuelve mañana para otro daily.",
    );

    await ctx.sock.sendMessage(
      ctx.chatId,
      {
        image: { url: imageUrl },
        caption,
      },
      { quoted: ctx.msg },
    );
  },
};
