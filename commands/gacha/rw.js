import { gacha } from "../../models/gachaDb.js";
import { box } from "../../models/gachaUI.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

const COOLDOWN = 15 * 60 * 1000;
const CLAIM_WINDOW = 20_000;
const rollLocks = new Map();

function formatCooldown(ms) {
  const s = Math.ceil(ms / 1000);
  const min = Math.floor(s / 60);
  const sec = s % 60;
  if (min > 0 && sec > 0) return `${min}m ${sec}s`;
  if (min > 0) return `${min} minuto${min !== 1 ? "s" : ""}`;
  return `${sec} segundo${sec !== 1 ? "s" : ""}`;
}

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
  name: ["rw", "rollwaifu", "roll", "waifu"],
  category: "gacha",
  description: "🎴 Genera un personaje aleatorio para reclamar. .rw",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const sender = ctx.sender;
    const now = Date.now();

    for (const [k, t] of rollLocks) {
      if (now - t > 30_000) rollLocks.delete(k);
    }
    if (rollLocks.has(sender)) return;

    const rwCooldowns = (global._rwCooldowns ??= new Map());
    const lastRoll = rwCooldowns.get(sender) ?? 0;

    if (now < lastRoll) {
      await ctx.reply(
        box(
          "⏱️",
          "ROLL WAIFU",
          "⏳ Espera...",
          [],
          `Tu próximo roll es en *${formatCooldown(lastRoll - now)}*`,
        ),
      );
      return;
    }

    rollLocks.set(sender, now);

    try {
      const char = gacha.getRandomCharacter();
      if (!char) {
        await ctx.reply(
          box(
            "❌",
            "ROLL WAIFU",
            "Sin personajes...",
            [],
            "No hay personajes en la base de datos. El owner debe usar *.genchar* o *.genrandom* para agregar.",
          ),
        );
        return;
      }

      const imageUrl = await getRandomImage(char.booru_tag);
      if (!imageUrl) {
        await ctx.reply(
          box(
            "❌",
            "ROLL WAIFU",
            "Sin imagen...",
            [],
            `No se encontró imagen para *${char.name}*. Intenta de nuevo.`,
          ),
        );
        return;
      }

      const claimKey = `${sender}__${char.id}`;
      const pendingClaims = (global._pendingClaims ??= new Map());
      pendingClaims.set(claimKey, {
        char,
        roller: sender,
        expiresAt: now + CLAIM_WINDOW,
      });
      setTimeout(() => pendingClaims.delete(claimKey), CLAIM_WINDOW);

      const caption = box(
        "✨",
        char.name,
        undefined,
        [
          `⚥GÉNERO › ${char.gender}`,
          `📖SERIE › ${char.series}`,
          `💴VALOR › ${char.value.toLocaleString()} ¥`,
        ],
        "🔒 Solo tú puedes reclamarlo, responde con *.claim*",
      );

      const sent = await ctx.sock.sendMessage(
        ctx.chatId,
        {
          image: { url: imageUrl },
          caption,
        },
        { quoted: ctx.msg },
      );

      const rwPending = (global._rwPending ??= new Map());
      rwPending.set(sent?.key?.id, claimKey);

      gacha.updateGachaStats(sender, (s) => {
        s.totalRolls += 1;
      });
      rwCooldowns.set(sender, now + COOLDOWN);
    } catch (e) {
      console.error("[rw]", e.message);
      await ctx.reply(
        box("❌", "ROLL WAIFU", "Error...", [], `Error: ${e.message}`),
      );
    } finally {
      rollLocks.delete(sender);
    }
  },
};
