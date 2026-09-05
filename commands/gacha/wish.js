import { box } from "../../models/gachaUI.js";
import { gacha } from "../../models/gachaDb.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

export default {
  name: ["wish", "wishlist", "deseo", "desear"],
  category: "gacha",
  description:
    "⭐ Agrega personajes a tu lista de deseos. .wish add <nombre> | .wish | .wish remove <nº>",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const userId = ctx.sender;
    const sub = ctx.args[0]?.toLowerCase();
    const rest = ctx.args.slice(1).join(" ").trim();

    if (!sub) {
      const wishes = gacha.getWishlist(userId);
      if (wishes.length === 0) {
        await ctx.reply(
          box(
            "⭐",
            "WISHLIST",
            "Tu lista de deseos está vacía...",
            [],
            "Usa *.wish add <nombre>* para agregar personajes que quieras.",
          ),
        );
        return;
      }

      const fields = wishes.map(
        (w, i) => `${i + 1}. *${w.charName}* — ${w.series}`,
      );

      await ctx.reply(
        box(
          "⭐",
          "MI WISHLIST",
          `${wishes.length} deseo(s)`,
          fields,
          "💡 Usa *.wish remove <nº>* para quitar uno.",
        ),
      );
      return;
    }

    if (sub === "add" || sub === "+" || sub === "agregar") {
      if (!rest) {
        await ctx.reply(
          box(
            "⭐",
            "WISHLIST",
            "Uso: .wish add <nombre del personaje>",
            [],
            "Ej: *.wish add Asuna Sword Art Online*",
          ),
        );
        return;
      }

      const results = gacha.searchCharacters(rest);
      let charName = rest;
      let series = "?";

      if (results.length > 0) {
        charName = results[0].name;
        series = results[0].series;
      } else {
        const parts = rest.split(/[-–]/).map((s) => s.trim());
        charName = parts[0];
        series = parts[1] || "?";
      }

      try {
        gacha.addWish(userId, charName, series);
        const wishes = gacha.getWishlist(userId);

        await ctx.reply(
          box(
            "⭐",
            "WISHLIST",
            `*${charName}* agregado a tu lista`,
            [`📖 SERIE › ${series}`, `📋 Total deseos: ${wishes.length}`],
            "💡 Si alguien genera personajes similares, te llegará un aviso.",
          ),
        );
      } catch (e) {
        await ctx.reply(box("❌", "WISHLIST", "Error...", [], e.message));
      }
      return;
    }

    if (
      sub === "remove" ||
      sub === "del" ||
      sub === "rm" ||
      sub === "-" ||
      sub === "quitar"
    ) {
      const num = parseInt(ctx.args[1]);
      if (isNaN(num)) {
        await ctx.reply(
          box(
            "⭐",
            "WISHLIST",
            "Uso: .wish remove <nº>",
            [],
            "Los números los ves con *.wish*",
          ),
        );
        return;
      }

      const ok = gacha.removeWish(userId, num - 1);
      if (!ok) {
        await ctx.reply(
          box(
            "❌",
            "WISHLIST",
            "Número inválido...",
            [],
            "Usa *.wish* para ver tus deseos.",
          ),
        );
        return;
      }

      const remaining = gacha.getWishlist(userId).length;
      await ctx.reply(
        box(
          "✅",
          "WISHLIST",
          "Deseo eliminado ✅",
          [],
          `Te quedan ${remaining} deseo(s).`,
        ),
      );
      return;
    }

    if (sub === "match" || sub === "buscar") {
      const results = gacha.searchCharacters(rest);
      if (results.length === 0) {
        await ctx.reply(
          box(
            "⭐",
            "WISHLIST",
            `No se encontró "${rest}"...`,
            [],
            "Usa *.genchar* para generarlo.",
          ),
        );
        return;
      }

      const matches = gacha.matchWishlist(results[0].name, results[0].series);
      if (matches.length === 0) {
        await ctx.reply(
          box(
            "⭐",
            "WISHLIST",
            `Nadie tiene "${results[0].name}" en su wishlist`,
            [],
            "Puedes generar más personajes.",
          ),
        );
        return;
      }

      const fields = matches.map(
        (m) =>
          `• @${m.userId.split("@")[0]} quiere a *${m.charName}* de ${m.series}`,
      );
      await ctx.reply(
        box(
          "⭐",
          "WISHLIST",
          `${matches.length} coincidencia(s)`,
          fields,
          "💡 Los usuarios marcados quieren este personaje.",
        ),
      );
      return;
    }

    await ctx.reply(
      box(
        "⭐",
        "WISHLIST",
        "Subcomandos:",
        [
          "• *.wish* — Ver lista",
          "• *.wish add <nombre>* — Agregar deseo",
          "• *.wish remove <nº>* — Quitar deseo",
        ],
        "💡 Agrega personajes que te gustaría tener.",
      ),
    );
  },
};
