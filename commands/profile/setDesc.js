import { getProfileUser } from "../../models/profileUtils.js";
import { resolveLidToRealJid } from "../../models/utils.js";

const MAX_DESCRIPTION_LENGTH = 150;

export default {
  name: ["setdesc", "desc", "bio", "descripcion"],
  category: "profile",
  description: "Define tu descripción global del perfil.",
  ownerOnly: false,

  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const description = args.join(" ").trim();

    if (!description) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "❌ Escribe una descripción. Ejemplo: .setdesc Me gusta la música",
        },
        { quoted: message },
      );
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `❌ La descripción no puede superar ${MAX_DESCRIPTION_LENGTH} caracteres.`,
        },
        { quoted: message },
      );
    }

    const realJid = await resolveLidToRealJid(jidRemitente, socket, remoteJid);
    const user = getProfileUser(db, remoteJid, realJid);
    user.description = description;

    if (typeof saveDB === "function") saveDB(db);

    await socket.sendMessage(
      remoteJid,
      {
        text: `✅ Tu descripción global fue actualizada:\n\n_${description}_`,
        mentions: [realJid],
      },
      { quoted: message },
    );
  },
};
