import { getProfileUser } from "../../models/profileUtils.js";
import { resolveLidToRealJid } from "../../models/utils.js";

const MAX_NAME_LENGTH = 40;

export default {
  name: ["setmyname", "name", "nombre"],
  category: "profile",
  description: "Define tu nombre global del perfil.",
  ownerOnly: false,

  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const name = args.join(" ").trim();

    if (!name) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "❌ Escribe un nombre. Ejemplo: .setname Aura Reed",
        },
        { quoted: message },
      );
    }

    if (name.length > MAX_NAME_LENGTH) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `❌ El nombre no puede superar ${MAX_NAME_LENGTH} caracteres.`,
        },
        { quoted: message },
      );
    }

    const realJid = await resolveLidToRealJid(jidRemitente, socket, remoteJid);
    const user = getProfileUser(db, remoteJid, realJid);
    user.name = name;

    if (typeof saveDB === "function") saveDB(db);

    await socket.sendMessage(
      remoteJid,
      {
        text: `✅ Tu nombre global fue actualizado a: *${name}*`,
        mentions: [realJid],
      },
      { quoted: message },
    );
  },
};
