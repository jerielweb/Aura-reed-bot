import { box } from "../../models/gachaUI.js";
import { gacha } from "../../models/gachaDb.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

export default {
  name: ["fuse", "fusion", "fusionar", "combinar"],
  category: "gacha",
  description:
    "🔀 Fusiona 2 personajes para crear uno más fuerte. .fuse <nº1> <nº2>",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const userId = ctx.sender;
    const harem = gacha.getUserHarem(userId);

    if (harem.length < 2) {
      await ctx.reply(
        box(
          "🔀",
          "FUSIÓN",
          "Necesitas al menos 2 personajes...",
          [],
          "Consigue más personajes con *.rw* o *.dailyrw*",
        ),
      );
      return;
    }

    const num1 = parseInt(ctx.args[0]);
    const num2 = parseInt(ctx.args[1]);

    if (
      isNaN(num1) ||
      isNaN(num2) ||
      num1 < 1 ||
      num2 < 1 ||
      num1 > harem.length ||
      num2 > harem.length
    ) {
      await ctx.reply(
        box(
          "🔀",
          "FUSIÓN",
          "Uso:",
          [
            "• *.fuse <nº1> <nº2>* — Fusionar 2 personajes",
            "",
            `📋 Tienes ${harem.length} personajes. Usa *.harem* para ver los números.`,
          ],
          "🔀 El resultado será más fuerte que la suma de ambos.",
        ),
      );
      return;
    }

    if (num1 === num2) {
      await ctx.reply(
        box(
          "🔀",
          "FUSIÓN",
          "No puedes fusionar un personaje consigo mismo...",
          [],
          "Elige 2 diferentes.",
        ),
      );
      return;
    }

    const char1 = harem[num1 - 1];
    const char2 = harem[num2 - 1];

    const fav = gacha.getFavorite(userId);
    if (fav && (char1.id === fav.id || char2.id === fav.id)) {
      await ctx.reply(
        box(
          "⚠️",
          "FUSIÓN",
          "No puedes fusionar a tu favorito... 💔",
          [],
          "Usa *.fav remove* primero.",
        ),
      );
      return;
    }

    try {
      const result = gacha.fusionCharacters(userId, char1.id, char2.id);
      const rarityEmoji = gacha.getRarityEmoji(result.rarity);

      await ctx.reply(
        box(
          "🔀",
          "⚡ FUSIÓN EXITOSA ⚡",
          result.name,
          [
            `📖 SERIE › ${result.series}`,
            `💴 VALOR › ${result.value.toLocaleString()} ¥`,
            `${rarityEmoji} RAREZA › ${result.rarity.toUpperCase()}`,
            "",
            `📊 Fusionaste:`,
            `  + *${char1.name}* (${char1.value.toLocaleString()} ¥)`,
            `  + *${char2.name}* (${char2.value.toLocaleString()} ¥)`,
          ],
          `🔥 El personaje fusionado vale un ${((result.value / (char1.value + char2.value)) * 100).toFixed(0)}% más que la suma original.`,
        ),
      );
    } catch (e) {
      await ctx.reply(box("❌", "FUSIÓN", "Error...", [], e.message));
    }
  },
};
