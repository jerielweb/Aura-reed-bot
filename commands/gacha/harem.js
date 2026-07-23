import { box } from "../../models/gachaUI.js";
import { gacha } from "../../models/gachaDb.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

const ITEMS_PER_PAGE = 15;

export default {
  name: ["harem", "coleccion", "waifus", "personajes"],
  category: "gacha",
  description: "👥 Muestra tu colección de personajes. .harem | .harem <nombre>",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const searchQuery = ctx.args.join(" ").trim();
    const userId = ctx.sender;

    const firstArg = ctx.args[0] || "";
    const pageNum = parseInt(firstArg);
    const isPageNumber = firstArg && !isNaN(pageNum) && pageNum > 0 && ctx.args.length === 1;

    if (searchQuery && !isPageNumber) {
      const results = gacha.searchCharacters(searchQuery);
      if (results.length === 0) {
        await ctx.reply(box("🔍", "BÚSQUEDA", `Sin resultados para "${searchQuery}"...`, [], "Usa *.harem* para ver tu colección."));
        return;
      }

      const fields = results.slice(0, 10).map((c) => `• *${c.name}* — ${c.series} (${c.gender}) — 💴 ${c.value.toLocaleString()} ¥`);
      if (results.length > 10) fields.push(`...y ${results.length - 10} más`);

      await ctx.reply(box("🔍", "BÚSQUEDA", `Resultados para "${searchQuery}"`, fields, `📦 ${results.length} personaje(s) encontrado(s)`));
      return;
    }

    const harem = gacha.getUserHarem(userId);
    const totalChars = gacha.getCharacterCount();

    if (harem.length === 0) {
      await ctx.reply(box("👥", "MI HAREM", "Está vacío... 😔", [], `Usa *.rw* para conseguir personajes. (${totalChars} disponibles en total)`));
      return;
    }

    const totalValue = harem.reduce((sum, c) => sum + c.value, 0);

    const page = isPageNumber ? pageNum : 1;
    const totalPages = Math.ceil(harem.length / ITEMS_PER_PAGE);
    const start = (page - 1) * ITEMS_PER_PAGE;
    const pageItems = harem.slice(start, start + ITEMS_PER_PAGE);

    const fields = pageItems.map((c, i) => `${start + i + 1}. *${c.name}* — ${c.series} (${c.gender}) — 💴 ${c.value.toLocaleString()} ¥`);

    const tip = `📦 ${harem.length} personajes · 💰 Valor total: ${totalValue.toLocaleString()} ¥ · 📄 Pág ${page}/${totalPages}\n> 💡 Usa *.fav <número>* para marcar favorito.`;

    await ctx.reply(box("👥", "MI HAREM", `${ctx.sender.split("@")[0]}`, fields, tip));
  },
};
