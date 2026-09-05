import { box } from "../../models/gachaUI.js";
import { gacha } from "../../models/gachaDb.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

export default {
  name: ["giftwrap", "wrap", "obsequiar", "present"],
  category: "gacha",
  description:
    "🎁 Regala un personaje con un mensaje especial. .giftwrap @usuario <nº> <mensaje>",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const userId = ctx.sender;
    const harem = gacha.getUserHarem(userId);

    if (harem.length === 0) {
      await ctx.reply(
        box(
          "🎁",
          "GIFT WRAP",
          "Tu harem está vacío...",
          [],
          "No tienes personajes para regalar.",
        ),
      );
      return;
    }

    let targetNum = ctx.args[0]?.replace(/[^0-9]/g, "") || "";

    if (!targetNum) {
      const quotedParticipant =
        ctx.msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (quotedParticipant)
        targetNum =
          quotedParticipant.split("@")[0]?.replace(/[^0-9]/g, "") || "";
    }

    if (!targetNum) {
      await ctx.reply(
        box(
          "🎁",
          "GIFT WRAP",
          "Uso:",
          [
            "• *.giftwrap @usuario <nº> <mensaje>*",
            "• Responde a alguien con *.giftwrap <nº> <mensaje>*",
            "",
            "💡 El mensaje aparecerá en la tarjeta de regalo.",
          ],
          "Solo puedes regalar personajes de tu harem.",
        ),
      );
      return;
    }

    const targetJid = `${targetNum}@s.whatsapp.net`;
    if (targetJid === userId) {
      await ctx.reply(
        box(
          "🎁",
          "GIFT WRAP",
          "No puedes regalarte a ti mismo...",
          [],
          "Usa *.favorite* para marcar tu favorito.",
        ),
      );
      return;
    }

    const charNum = parseInt(ctx.args[1]);
    if (isNaN(charNum) || charNum < 1 || charNum > harem.length) {
      await ctx.reply(
        box(
          "🎁",
          "GIFT WRAP",
          "Número inválido...",
          [],
          `Tienes ${harem.length} personajes. Usa *.harem* para ver números.`,
        ),
      );
      return;
    }

    const msgParts = ctx.args.slice(2);
    const customMsg =
      msgParts.length > 0 ? msgParts.join(" ") : "¡Disfruta este regalo! 🎉";

    const char = harem[charNum - 1];

    const fav = gacha.getFavorite(userId);
    if (fav && char.id === fav.id) {
      await ctx.reply(
        box(
          "⚠️",
          "GIFT WRAP",
          "No puedes regalar a tu favorito... 💔",
          [],
          "Usa *.fav remove* primero.",
        ),
      );
      return;
    }

    try {
      gacha.transferCharacter(userId, targetJid, char.id);

      const senderNum = userId.split("@")[0] ?? "Alguien";

      await ctx.reply(
        box(
          "✅",
          "REGALO ENVIADO 🎁",
          `*${char.name}* enviado a @${targetNum}`,
          [
            `📖 SERIE › ${char.series}`,
            `💴 VALOR › ${char.value.toLocaleString()} ¥`,
            `💬 MENSAJE › "${customMsg}"`,
          ],
          `🎀 @${targetNum} recibirá tu regalo.`,
        ),
        [targetJid],
      );

      try {
        const rarityEmoji = gacha.getRarityEmoji(char.rarity);
        const giftCard = box(
          "🎁",
          "🎀 ¡RECIBISTE UN REGALO! 🎀",
          `*${char.name}*`,
          [
            `📖 SERIE › ${char.series}`,
            `💴 VALOR › ${char.value.toLocaleString()} ¥`,
            `${rarityEmoji} RAREZA › ${(char.rarity ?? "common").toUpperCase()}`,
            "",
            `💬 *Mensaje de @${senderNum}:*`,
            `"${customMsg}"`,
          ],
          "💡 Usa *.harem* para ver tu nuevo personaje.",
        );

        await ctx.sock.sendMessage(targetJid, { text: giftCard });
      } catch {
        // El destinatario puede no tener DM abierto; se ignora.
      }
    } catch (e) {
      await ctx.reply(box("❌", "GIFT WRAP", "Error...", [], e.message));
    }
  },
};
