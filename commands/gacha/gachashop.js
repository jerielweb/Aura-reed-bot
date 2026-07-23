import { box } from "../../models/gachaUI.js";
import { gacha } from "../../models/gachaDb.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

export default {
  name: ["gachashop", "gshop", "subastar", "mercado", "shopgacha"],
  category: "gacha",
  description: "🏪 Mercado de personajes entre usuarios. .gshop list <nº> <precio> | .gshop buy <nº> | .gshop",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const userId = ctx.sender;
    const cmdArgs = ctx.args;
    const sub = cmdArgs[0]?.toLowerCase();

    if (!sub) {
      const listings = gacha.getShopListings();
      if (listings.length === 0) {
        await ctx.reply(box("🏪", "GACHA SHOP", "El mercado está vacío... 📭", [], "Usa *.gshop list <nº> <precio>* para vender un personaje."));
        return;
      }

      const fields = listings.slice(0, 15).map((l, i) => {
        const sellerNum = l.seller.split("@")[0] ?? "???";
        const rarityEmoji = gacha.getRarityEmoji(l.char.rarity);
        return `${i + 1}. ${rarityEmoji} *${l.char.name}* — ${l.char.series} — 💴 ${l.price.toLocaleString()} ¥ (vendedor: @${sellerNum})`;
      });

      return ctx.reply(box("🏪", "GACHA SHOP", `${listings.length} personaje(s) en venta`, fields, "Usa *.gshop buy <nº>* para comprar. Usa *.gshop list <nº> <precio>* para vender."));
    }

    if (sub === "list" || sub === "vender" || sub === "add") {
      const harem = gacha.getUserHarem(userId);
      if (harem.length === 0) {
        return ctx.reply(box("🏪", "GACHA SHOP", "Tu harem está vacío...", [], "No tienes personajes para vender."));
      }

      const num = parseInt(cmdArgs[1]);
      const price = parseInt(cmdArgs[2]);

      if (isNaN(num) || num < 1 || num > harem.length) {
        const fields = harem.slice(0, 8).map((c, i) => `${i + 1}. *${c.name}* — 💴 ${c.value.toLocaleString()} ¥`);
        return ctx.reply(box("🏪", "GACHA SHOP", "Uso: .gshop list <nº> <precio>", [
          "",
          "📋 Tus personajes:",
          ...fields,
        ], "💡 El precio mínimo es 100 ¥."));
      }

      if (isNaN(price) || price < 100) {
        return ctx.reply(box("🏪", "GACHA SHOP", "Precio inválido...", [], "El precio mínimo es 100 ¥. Ej: *.gshop list 1 5000*"));
      }

      const char = harem[num - 1];
      const fav = gacha.getFavorite(userId);
      if (fav && char.id === fav.id) {
        return ctx.reply(box("⚠️", "GACHA SHOP", "No puedes vender a tu favorito...", [], "Usa *.fav remove* primero."));
      }

      try {
        gacha.listInShop(userId, char.id, price);
        return ctx.reply(box("✅", "GACHA SHOP", `*${char.name}* listado en venta`, [
          `💴 PRECIO › ${price.toLocaleString()} ¥`,
          `📖 SERIE › ${char.series}`,
        ], "Cuando alguien lo compre, recibirás el dinero automáticamente."));
      } catch (e) {
        return ctx.reply(box("❌", "GACHA SHOP", "Error...", [], e.message));
      }
    }

    if (sub === "buy" || sub === "comprar") {
      const num = parseInt(cmdArgs[1]);
      if (isNaN(num) || num < 1) {
        return ctx.reply(box("🏪", "GACHA SHOP", "Uso: .gshop buy <nº>", [], "Los números los ves en *.gshop*"));
      }

      const listings = gacha.getShopListings();
      if (num > listings.length) {
        return ctx.reply(box("🏪", "GACHA SHOP", "Ese listing no existe...", [], `Hay ${listings.length} personajes en venta.`));
      }

      const listing = listings[num - 1];
      const balance = ctx.getCoins();

      if (balance < listing.price) {
        return ctx.reply(box("💰", "GACHA SHOP", "No tienes suficiente dinero...", [
          `💴 PRECIO › ${listing.price.toLocaleString()} ¥`,
          `💵 TIENES › ${balance.toLocaleString()} ¥`,
        ], "Gana más dinero con *.work*, *.daily* o *.rw* y vende personajes."));
      }

      try {
        const { char } = gacha.buyFromShop(userId, num - 1);

        ctx.addCoins(-listing.price);
        ctx.addCoins(listing.price, listing.seller);

        return ctx.reply(box("✅", "COMPRA EXITOSA", `*${char.name}* adquirido(a)`, [
          `📖 SERIE › ${char.series}`,
          `💴 PAGASTE › ${listing.price.toLocaleString()} ¥`,
          `${gacha.getRarityEmoji(char.rarity)} RAREZA › ${(char.rarity ?? "common").toUpperCase()}`,
        ], `💡 El personaje se agregó a tu harem.`));
      } catch (e) {
        return ctx.reply(box("❌", "GACHA SHOP", "Error...", [], e.message));
      }
    }

    if (sub === "unlist" || sub === "retirar" || sub === "cancel") {
      const num = parseInt(cmdArgs[1]);
      if (isNaN(num) || num < 1) {
        return ctx.reply(box("🏪", "GACHA SHOP", "Uso: .gshop unlist <nº>", [], "El número corresponde al listing en *.gshop*"));
      }

      try {
        const char = gacha.unlistFromShop(userId, num - 1);
        return ctx.reply(box("✅", "GACHA SHOP", `*${char.name}* retirado del mercado`, [], "El personaje volvió a tu harem."));
      } catch (e) {
        return ctx.reply(box("❌", "GACHA SHOP", "Error...", [], e.message));
      }
    }

    return ctx.reply(box("🏪", "GACHA SHOP", "Subcomandos:", [
      "• *.gshop* — Ver mercado",
      "• *.gshop list <nº> <precio>* — Vender",
      "• *.gshop buy <nº>* — Comprar",
      "• *.gshop unlist <nº>* — Retirar venta",
    ], "💡 Compra y vende personajes con otros usuarios."));
  },
};
