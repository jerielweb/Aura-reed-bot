import { box } from "../../models/gachaUI.js";
import { gacha } from "../../models/gachaDb.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

export default {
  name: ["dump", "dumpear", "deshacer"],
  category: "gacha",
  description:
    "🗑️ Elimina un personaje de tu harem a cambio de dinero. .dump <número> | .dump all",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const argsStr = ctx.args.join(" ").trim().toLowerCase();
    const userId = ctx.sender;

    const harem = gacha.getUserHarem(userId);
    if (harem.length === 0) {
      await ctx.reply(
        box(
          "🗑️",
          "DUMP",
          "Tu harem está vacío...",
          [],
          "No tienes personajes.",
        ),
      );
      return;
    }

    if (argsStr === "all" || argsStr === "todo" || argsStr === "-a") {
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
            "🗑️",
            "DUMP",
            "No se pudo eliminar nada...",
            errors.length ? errors : [],
            "Revisa tu harem.",
          ),
        );
        return;
      }

      ctx.addCoins(totalGanancia);

      const lines = [`💰 Recuperaste: *${totalGanancia.toLocaleString()} ¥*`];
      if (errors.length) lines.push(...errors.map((e) => `⚠️ ${e}`));

      await ctx.reply(
        box(
          "🗑️",
          "DUMP MASIVO",
          `${vendidos} personaje(s) eliminado(s)`,
          lines,
          `💵 Se agregaron *${totalGanancia.toLocaleString()} ¥* a tu billetera.`,
        ),
      );
      return;
    }

    const num = parseInt(argsStr);
    if (isNaN(num) || num < 1 || num > harem.length) {
      const fields = harem
        .slice(0, 10)
        .map(
          (c, i) => `${i + 1}. *${c.name}* — 💴 ${c.value.toLocaleString()} ¥`,
        );
      if (harem.length > 10) fields.push(`...y ${harem.length - 10} más`);

      await ctx.reply(
        box(
          "🗑️",
          "DUMP",
          "Uso:",
          [
            `• *.dump <número>* — Eliminar por dinero`,
            `• *.dump all* — Eliminar TODOS (excepto fav)`,
            ``,
            `📋 Tus personajes:`,
            ...fields,
          ],
          `💰 Recibirás entre 50%-70% del valor.`,
        ),
      );
      return;
    }

    const fav = gacha.getFavorite(userId);
    const char = harem[num - 1];
    if (fav && char.id === fav.id) {
      await ctx.reply(
        box(
          "⚠️",
          "DUMP",
          `No puedes eliminar a tu favorito 💔`,
          [],
          "Usa *.fav remove* primero.",
        ),
      );
      return;
    }

    const price = gacha.sellCharacter(userId, char.id);
    ctx.addCoins(price);

    await ctx.reply(
      box(
        "🗑️",
        "DUMP COMPLETADO",
        `*${char.name}* eliminado`,
        [
          `📖SERIE › ${char.series}`,
          `💰 RECIBISTE › *${price.toLocaleString()} ¥*`,
        ],
        `💵 Tienes ${gacha.getUserHaremCount(userId)} personajes restantes.`,
      ),
    );
  },
};
