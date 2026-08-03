import { getNsfwReactionGif } from "../../controllers/nsfwInteractionUtils.js";
import { resolveLidToRealJid } from "../../models/utils.js";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["cum", "venirse"],
  category: "nsfw",
  description: "Venirse",
  async execute(sock, m, args, { prefix, jidRemitente }) {
    const remoteJid = m.key.remoteJid;
    const ctx = m.message?.extendedTextMessage?.contextInfo;

    let targetJid = null;
    if (ctx?.mentionedJid?.length > 0) {
      targetJid = ctx.mentionedJid[0];
    } else if (ctx?.participant) {
      targetJid = ctx.participant;
    }
    if (targetJid) {
      targetJid = await resolveLidToRealJid(targetJid, sock, remoteJid);
    }

    try {
      const gifData = await getNsfwReactionGif("cum");

      const senderTag = "@" + jidRemitente.split("@")[0];
      const mentions = [jidRemitente];
      let caption;

      if (targetJid && targetJid !== jidRemitente) {
        mentions.push(targetJid);
        caption =
          senderTag +
          " " +
          fytBold("se vino en") +
          " @" +
          targetJid.split("@")[0] +
          " 🔞";
      } else {
        caption = senderTag + " " + fytBold("se vino 🔞");
      }

      await sock.sendMessage(
        remoteJid,
        { ...gifData, caption, mentions },
        { quoted: m },
      );
    } catch (e) {
      console.error("[NSFW Interacciones Error]:", e.message);
      await sock.sendMessage(
        remoteJid,
        { text: "❌ Hubo un error al intentar enviar la reacción NSFW." },
        { quoted: m },
      );
    }
  },
};
