import { gacha } from "../../models/gachaDb.js";
import { box } from "../../models/gachaUI.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

export default {
  name: ["claim", "c", "reclamar"],
  category: "gacha",
  description: "🎴 Reclama el personaje del .rw respondiendo su imagen. .claim",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const quotedId =
      ctx.msg.message?.extendedTextMessage?.contextInfo?.stanzaId;

    if (!quotedId) {
      await ctx.reply(
        box(
          "🎴",
          "RECLAMAR",
          "❌ Falta la respuesta...",
          [],
          "↩️ Responde a la imagen del personaje que quieres reclamar.",
        ),
      );
      return;
    }

    const rwPending = (global._rwPending ??= new Map());
    const claimKey = rwPending.get(quotedId);

    if (!claimKey) {
      await ctx.reply(
        box(
          "🎴",
          "RECLAMAR",
          "⏰ No disponible...",
          [],
          "Este personaje ya no está disponible o expiró.",
        ),
      );
      return;
    }

    const pendingClaims = (global._pendingClaims ??= new Map());
    const pending = pendingClaims.get(claimKey);

    if (!pending || Date.now() > pending.expiresAt) {
      pendingClaims.delete(claimKey);
      rwPending.delete(quotedId);
      await ctx.reply(
        box(
          "🎴",
          "RECLAMAR",
          "⏰ Tiempo agotado...",
          [],
          "El tiempo para reclamar expiró.",
        ),
      );
      return;
    }

    if (pending.roller && pending.roller !== ctx.sender) {
      await ctx.reply(
        box(
          "🔒",
          "RECLAMAR",
          "🚫 No te pertenece...",
          [],
          "Solo quien usó *.rw* puede reclamar a este personaje.",
        ),
      );
      return;
    }

    const { char } = pending;

    try {
      await gacha.giveCharacter(ctx.sender, char.id);

      pendingClaims.delete(claimKey);
      rwPending.delete(quotedId);

      await ctx.reply(
        box(
          "✅",
          "PERSONAJE RECLAMADO",
          `💞 ${char.name}`,
          [
            `⚥GÉNERO › ${char.gender}`,
            `📖SERIE › ${char.series}`,
            `💴VALOR › ${char.value.toLocaleString()} ¥`,
          ],
          "💡 Usa *.harem* para ver tu colección.",
        ),
      );
    } catch (e) {
      if (e.message === "CHARACTER_ALREADY_OWNED") {
        await ctx.reply(
          box(
            "⚠️",
            "RECLAMAR",
            "Ya lo tienes...",
            [],
            `Ya tienes a *${char.name}* en tu harem.`,
          ),
        );
        return;
      }
      await ctx.reply(
        box("❌", "RECLAMAR", "Error...", [], `Error: ${e.message}`),
      );
    }
  },
};
