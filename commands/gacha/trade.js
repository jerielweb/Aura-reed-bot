import { box } from "../../models/gachaUI.js";
import { gacha } from "../../models/gachaDb.js";
import { makeGachaCtx } from "../../models/gachaCtx.js";

export default {
  name: ["trade", "gift", "regalar", "transferir", "give"],
  category: "gacha",
  description:
    "🎁 Regala un personaje a otro usuario. .trade <@usuario> <número>",
  execute: async (socket, message, args, extra) => {
    const ctx = makeGachaCtx(socket, message, args, extra);
    const cmdArgs = ctx.args;
    const userId = ctx.sender;

    let targetRaw = cmdArgs[0] || "";
    let targetNum = targetRaw.replace(/[^0-9]/g, "");

    if (!targetNum) {
      const quotedParticipant =
        ctx.msg.message?.extendedTextMessage?.contextInfo?.participant;
      if (quotedParticipant) {
        targetNum =
          quotedParticipant.split("@")[0]?.replace(/[^0-9]/g, "") || "";
      }
    }

    if (!targetNum) {
      await ctx.reply(
        box(
          "🎁",
          "TRADE",
          "Uso:",
          [
            `• *.trade @usuario <número>* — Regalar personaje`,
            `• Responde a un mensaje con *.trade <número>*`,
            ``,
            `💡 Usa *.harem* para ver los números de tus personajes.`,
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
          "TRADE",
          "No puedes regalarte a ti mismo...",
          [],
          "Usa *.dump* si quieres eliminar un personaje por dinero.",
        ),
      );
      return;
    }

    const num = parseInt(cmdArgs[1]);
    if (isNaN(num)) {
      await ctx.reply(
        box(
          "🎁",
          "TRADE",
          "Falta el número...",
          [],
          "Usa: *.trade @usuario <número>* — El número lo ves en *.harem*",
        ),
      );
      return;
    }

    const harem = gacha.getUserHarem(userId);
    if (harem.length === 0) {
      await ctx.reply(
        box(
          "🎁",
          "TRADE",
          "Tu harem está vacío...",
          [],
          "No tienes personajes para regalar.",
        ),
      );
      return;
    }

    if (num < 1 || num > harem.length) {
      await ctx.reply(
        box(
          "🎁",
          "TRADE",
          "Número inválido...",
          [],
          `Tienes ${harem.length} personajes. Usa *.harem* para ver los números.`,
        ),
      );
      return;
    }

    const char = harem[num - 1];

    try {
      gacha.transferCharacter(userId, targetJid, char.id);
      await ctx.reply(
        box(
          "✅",
          "TRADE COMPLETADO",
          `✨ *${char.name}* ha sido transferido(a)!`,
          [
            `📖SERIE › ${char.series}`,
            `💴VALOR › ${char.value.toLocaleString()} ¥`,
            `👤NUEVO DUEÑO › @${targetNum}`,
          ],
          `💡 El personaje ahora pertenece a @${targetNum}.`,
        ),
        [targetJid],
      );
    } catch (e) {
      await ctx.reply(
        box("❌", "TRADE", "Error...", [], `Error: ${e.message}`),
      );
    }
  },
};
