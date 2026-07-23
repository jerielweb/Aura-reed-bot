import { box } from "../../models/gachaUI.js";
import { gacha } from "../../models/gachaDb.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

export default {
  name: ["ginfo", "char", "character", "personaje", "chara"],
  category: "gacha",
  description: "ℹ️ Muestra información detallada de un personaje de tu harem. .ginfo <número> | .ginfo <nombre>",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const userId = ctx.sender;
    const harem = gacha.getUserHarem(userId);

    if (harem.length === 0) {
      await ctx.reply(box("ℹ️", "INFO", "Tu harem está vacío...", [], "Consigue personajes con *.rw* primero."));
      return;
    }

    const arg = ctx.args.join(" ").trim().toLowerCase();

    if (!arg) {
      const stats = gacha.getGachaStats(userId);
      const fav = gacha.getFavorite(userId);
      const totalValue = harem.reduce((s, c) => s + c.value, 0);

      const fields = [
        `📦 Personajes: *${harem.length}*`,
        `💰 Valor total: *${totalValue.toLocaleString()} ¥*`,
        `🎲 Total rolls: *${stats.totalRolls}*`,
        `✅ Reclamados: *${stats.totalClaimed}*`,
        `💰 Vendidos: *${stats.totalSold.toLocaleString()} ¥*`,
      ];

      if (fav) fields.push(`💞 Favorito: *${fav.name}*`);

      await ctx.reply(box("ℹ️", "MIS ESTADÍSTICAS", ctx.sender.split("@")[0], fields, "Usa *.ginfo <número>* o *.ginfo <nombre>* para ver detalle."));
      return;
    }

    const num = parseInt(arg);
    if (!isNaN(num) && num >= 1 && num <= harem.length) {
      const char = harem[num - 1];
      const fav = gacha.getFavorite(userId);
      const isFav = fav && char.id === fav.id;

      await ctx.reply(box(isFav ? "💖" : "ℹ️", char.name, undefined, [
        `📖 SERIE › ${char.series}`,
        `⚥ GÉNERO › ${char.gender}`,
        `💴 VALOR › ${char.value.toLocaleString()} ¥`,
        `🏷️ TAG › ${char.booru_tag}`,
        isFav ? `💞 *FAVORITO*` : "💔 No es favorito",
        `🆔 ID › ${char.id}`,
      ], `📌 #${num} de ${harem.length} personajes. Usa *.fav ${num}* para hacerlo favorito.`));
      return;
    }

    const results = harem.filter((c) => c.name.toLowerCase().includes(arg) || c.series.toLowerCase().includes(arg));

    if (results.length === 0) {
      await ctx.reply(box("🔍", "INFO", `No encontré "${arg}" en tu harem...`, [], "Usa *.harem <nombre>* para buscar en el pool global."));
      return;
    }

    if (results.length === 1) {
      const char = results[0];
      const haremIndex = harem.findIndex((c) => c.id === char.id) + 1;
      const fav = gacha.getFavorite(userId);
      const isFav = fav && char.id === fav.id;

      await ctx.reply(box(isFav ? "💖" : "ℹ️", char.name, undefined, [
        `📖 SERIE › ${char.series}`,
        `⚥ GÉNERO › ${char.gender}`,
        `💴 VALOR › ${char.value.toLocaleString()} ¥`,
        `🏷️ TAG › ${char.booru_tag}`,
        isFav ? `💞 *FAVORITO*` : "💔 No es favorito",
        `🆔 ID › ${char.id}`,
      ], `📌 #${haremIndex} de ${harem.length}. Usa *.fav ${haremIndex}* para hacerlo favorito.`));
      return;
    }

    const fields = results.slice(0, 10).map((c) => {
      const idx = harem.findIndex((x) => x.id === c.id) + 1;
      return `• #${idx} *${c.name}* — ${c.series} — 💴 ${c.value.toLocaleString()} ¥`;
    });
    if (results.length > 10) fields.push(`...y ${results.length - 10} más`);

    await ctx.reply(box("🔍", "INFO", `Varios resultados para "${arg}"`, fields, `Usa *.ginfo <número>* para ver el que quieras.`));
  },
};
