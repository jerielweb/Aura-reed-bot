import { box } from "../../models/gachaUI.js";
import { gacha } from "../../models/gachaDb.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

export default {
  name: ["sell", "vender", "venderpersonaje"],
  category: "gacha",
  description: "💰 Vende un personaje de tu harem por monedas. .sell <número>",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const userId = ctx.sender;
    const harem = gacha.getUserHarem(userId);

    if (harem.length === 0) {
      await ctx.reply(
        box(
          "💰",
          "VENTA",
          "Tu harem está vacío...",
          [],
          "No tienes personajes para vender.",
        ),
      );
      return;
    }

    const arg = ctx.args[0]?.toLowerCase();

    if (!arg) {
      const fields = harem
        .slice(0, 10)
        .map(
          (c, i) =>
            `${i + 1}. *${c.name}* — 💴 ${c.value.toLocaleString()} ¥ (venta ~${Math.floor(c.value * 0.6).toLocaleString()} ¥)`,
        );
      if (harem.length > 10) fields.push(`...y ${harem.length - 10} más`);

      await ctx.reply(
        box(
          "💰",
          "VENTA",
          "Uso:",
          [
            "• *.sell <número>* — Vender personaje",
            `• *.sell all* — Vender TODOS (excepto favorito)`,
            "",
            "📋 Tus personajes:",
            ...fields,
          ],
          "💰 Recibirás entre 50% y 70% del valor original.",
        ),
      );
      return;
    }

    if (arg === "all" || arg === "todo" || arg === "-a") {
      const fav = gacha.getFavorite(userId);
      let totalGanancia = 0;
      let vendidos = 0;
      const errors = [];

      for (const c of harem) {
        if (fav && c.id === fav.id) {
          errors.push(`${c.name} (es tu favorito, protegido)`);
          continue;
        }
        try {
          const price = gacha.sellCharacter(userId, c.id);
          totalGanancia += price;
          vendidos++;
        } catch (e) {
          errors.push(`${c.name} (${e.message})`);
        }
      }

      if (vendidos === 0) {
        await ctx.reply(
          box(
            "💰",
            "VENTA",
            "No se pudo vender nada...",
            errors.length ? errors : [],
            "Revisa tu harem e intenta de nuevo.",
          ),
        );
        return;
      }

      ctx.addCoins(totalGanancia);

      const lines = [
        `💴 Ganancia total: *${totalGanancia.toLocaleString()} ¥*`,
      ];
      if (errors.length) lines.push(...errors.map((e) => `⚠️ ${e}`));

      await ctx.reply(
        box(
          "💰",
          `VENTA MASIVA COMPLETADA`,
          `${vendidos} personaje(s) vendido(s)`,
          lines,
          `💵 Se agregaron *${totalGanancia.toLocaleString()} ¥* a tu billetera.`,
        ),
      );
      return;
    }

    const num = parseInt(arg);
    if (isNaN(num) || num < 1 || num > harem.length) {
      await ctx.reply(
        box(
          "💰",
          "VENTA",
          "Número inválido...",
          [],
          `Tienes ${harem.length} personajes. Usa *.harem* para ver los números.`,
        ),
      );
      return;
    }

    const char = harem[num - 1];

    const fav = gacha.getFavorite(userId);
    if (fav && char.id === fav.id) {
      await ctx.reply(
        box(
          "⚠️",
          "VENTA",
          `No puedes vender a tu favorito... 💔`,
          [],
          "Usa *.fav remove* primero si quieres venderlo.",
        ),
      );
      return;
    }

    try {
      const price = gacha.sellCharacter(userId, char.id);
      ctx.addCoins(price);

      await ctx.reply(
        box(
          "💰",
          "VENTA COMPLETADA",
          `*${char.name}* ha sido vendido(a)`,
          [
            `📖SERIE › ${char.series}`,
            `💴 VALOR ORIGINAL › ${char.value.toLocaleString()} ¥`,
            `💰 GANANCIA › *${price.toLocaleString()} ¥*`,
          ],
          `💵 El dinero se agregó a tu billetera.`,
        ),
      );
    } catch (e) {
      await ctx.reply(box("❌", "VENTA", "Error...", [], e.message));
    }
  },
};
