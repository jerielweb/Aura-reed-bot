import { box } from "../../models/gachaUI.js";
import { gacha } from "../../models/gachaDb.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

const TOP_LIMIT = 15;

export default {
  name: ["gachatop", "topgacha", "topwaifus", "gacharanking"],
  category: "gacha",
  description:
    "🏆 Muestra el ranking de usuarios con más personajes o mayor valor. .gachatop | .gachatop value",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const subcommand = ctx.args[0]?.toLowerCase();

    const allData = gacha.getAllHaremData();
    if (allData.length === 0) {
      await ctx.reply(
        box(
          "🏆",
          "RANKING",
          "No hay datos aún...",
          [],
          "Espera a que los usuarios reclamen personajes.",
        ),
      );
      return;
    }

    const sortByValue =
      subcommand === "value" || subcommand === "valor" || subcommand === "v";
    const sorted = [...allData].sort((a, b) =>
      sortByValue ? b.totalValue - a.totalValue : b.count - a.count,
    );

    const fields = [];
    const top = sorted.slice(0, TOP_LIMIT);
    const mentions = [];

    for (let i = 0; i < top.length; i++) {
      const entry = top[i];
      const userNumber = entry.userId.split("@")[0] ?? entry.userId;
      mentions.push(entry.userId);
      const medal =
        i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `${i + 1}.`;
      const countStr = `📦 ${entry.count} personaje${entry.count !== 1 ? "s" : ""}`;
      const valueStr = `💰 ${entry.totalValue.toLocaleString()} ¥`;
      const line = sortByValue
        ? `${medal} @${userNumber} — ${valueStr} (${countStr})`
        : `${medal} @${userNumber} — ${countStr} (${valueStr})`;
      fields.push(line);
    }

    const userPos = sorted.findIndex((e) => e.userId === ctx.sender);
    let tip = `📊 Total en ranking: ${allData.length} usuario(s)`;
    if (userPos !== -1) {
      const userEntry = sorted[userPos];
      tip += `\n📍 Tu posición: #${userPos + 1} — ${userEntry.count} personajes — ${userEntry.totalValue.toLocaleString()} ¥`;
    }
    tip += `\n> 💡 Usa *.gachatop value* para ranking por valor.`;

    await ctx.reply(
      box(
        "🏆",
        "RANKING GACHA",
        `${sortByValue ? "Por valor total 💰" : "Por cantidad de personajes 📦"}`,
        fields,
        tip,
      ),
      mentions,
    );
  },
};
