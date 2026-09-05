import { box } from "../../models/gachaUI.js";
import { gacha } from "../../models/gachaDb.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

export default {
  name: ["favorite", "fav", "esposa", "husbando"],
  category: "gacha",
  description:
    "💞 Marca un personaje como favorito. .fav <número> | .fav (ver actual)",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const userId = ctx.sender;
    const harem = gacha.getUserHarem(userId);

    if (harem.length === 0) {
      await ctx.reply(
        box(
          "💞",
          "FAVORITE",
          "Tu harem está vacío...",
          [],
          "Consigue personajes con *.rw* primero.",
        ),
      );
      return;
    }

    const arg = ctx.args[0]?.toLowerCase();

    if (!arg) {
      const fav = gacha.getFavorite(userId);
      if (!fav) {
        await ctx.reply(
          box(
            "💞",
            "FAVORITE",
            "No tienes favorito 💔",
            [],
            "Usa *.fav <número>* para marcar uno. Los números los ves en *.harem*",
          ),
        );
        return;
      }
      await ctx.reply(
        box(
          "💞",
          "TU FAVORITO 💖",
          `*${fav.name}*`,
          [
            `📖SERIE › ${fav.series}`,
            `⚥GÉNERO › ${fav.gender}`,
            `💴VALOR › ${fav.value.toLocaleString()} ¥`,
          ],
          "Usa *.fav <número>* para cambiarlo.",
        ),
      );
      return;
    }

    if (
      arg === "remove" ||
      arg === "reset" ||
      arg === "del" ||
      arg === "quitar"
    ) {
      const current = gacha.getFavorite(userId);
      if (!current) {
        await ctx.reply(
          box(
            "💞",
            "FAVORITE",
            "No tienes favorito...",
            [],
            "Usa *.fav <número>* para marcar uno.",
          ),
        );
        return;
      }
      gacha.removeFavorite(userId);
      await ctx.reply(
        box(
          "💔",
          "FAVORITE",
          "Has quitado tu favorito 💔",
          [],
          `*${current.name}* ya no es tu favorito.`,
        ),
      );
      return;
    }

    const num = parseInt(arg);
    if (isNaN(num) || num < 1 || num > harem.length) {
      await ctx.reply(
        box(
          "💞",
          "FAVORITE",
          "Número inválido...",
          [],
          `Tienes ${harem.length} personajes. Usa *.harem* para ver los números.`,
        ),
      );
      return;
    }

    const char = harem[num - 1];
    try {
      gacha.setFavorite(userId, char.id);
      await ctx.reply(
        box(
          "💞",
          "💖 FAVORITO ACTUALIZADO 💖",
          `*${char.name}* es ahora tu favorito(a)! 💕`,
          [
            `📖SERIE › ${char.series}`,
            `⚥GÉNERO › ${char.gender}`,
            `💴VALOR › ${char.value.toLocaleString()} ¥`,
          ],
          `💞 ${char.name} 🌟`,
        ),
      );
    } catch (e) {
      await ctx.reply(box("❌", "FAVORITE", "Error...", [], e.message));
    }
  },
};
