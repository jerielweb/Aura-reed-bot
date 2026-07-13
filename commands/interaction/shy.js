import { getReactionGif } from "../../controllers/interactionsUtils.js";
import { resolveLidToRealJid } from "../../models/utils.js";
import { fytBold } from "../../models/TextStyle.js";

export default {
  name: [
    "shy",
    "timido",
    "timida",
    "tímido",
    "tímida",
    "apenado",
    "apenada",
    "timidez",
  ],
  category: "interaction",
  description: "Estar Tímido/a",
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
      // { video, mimetype, gifPlayback } — Baileys necesita 'video' para reproducir como GIF animado
      const gifData = await getReactionGif("shy");

      const senderTag = "@" + jidRemitente.split("@")[0];
      const mentions = [jidRemitente];
      let caption;

      if (targetJid && targetJid !== jidRemitente) {
        mentions.push(targetJid);
        caption =
          senderTag +
          " " +
          fytBold("se siente tímido/a ante") +
          " @" +
          targetJid.split("@")[0];
      } else {
        caption = senderTag + " " + fytBold("está tímido/a 👉👈");
      }

      await sock.sendMessage(
        remoteJid,
        {
          ...gifData,
          caption,
          mentions,
        },
        { quoted: m },
      );
    } catch (e) {
      console.error("[Interacciones Error]:", e.message);
      await sock.sendMessage(
        remoteJid,
        {
          text: "❌ Hubo un error al intentar enviar la reacción.",
        },
        { quoted: m },
      );
    }
  },
};
