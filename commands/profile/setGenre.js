// setGenre.js - VERSIÓN SIMPLIFICADA
import { getProfileUser, GENRES } from "../../models/profileUtils.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

export default {
  name: ["setgenre", "género", "genero", "setgen", "sg"],
  category: "profile",
  description: "Define tu género en el perfil del grupo.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const normalizedSender = jidNormalizedUser(jidRemitente);
    const choice = args[0]?.toLowerCase();

    if (!choice || !GENRES[choice]) {
      const options = Object.keys(GENRES)
        .filter((k, i, arr) => arr.indexOf(k) === i)
        .join(", ");
      return await socket.sendMessage(
        remoteJid,
        {
          text: `⚠️ Uso: *.setgenre [opción]*\nOpciones: *${options}*`,
        },
        { quoted: message },
      );
    }

    // ✅ Obtener usuario y asignar género
    const user = getProfileUser(db, remoteJid, normalizedSender);
    user.genre = choice; // Esto automáticamente guarda en db.users
    
    // ✅ Guardar en disco
    if (typeof saveDB === "function") saveDB(db);

    await socket.sendMessage(
      remoteJid,
      {
        text: `╭〔 👤 𝐏𝐄𝐑𝐅𝐈𝐋 〕⬣\n┃ ✅ 𝐆𝐞́𝐧𝐞𝐫𝐨 𝐚𝐜𝐭𝐮𝐚𝐥𝐢𝐳𝐚𝐝𝐨\n╰━━━━━━━━━━━━⬣\n\n┃ > Ahora eres: *${GENRES[choice]}*\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`,
        mentions: [normalizedSender],
      },
      { quoted: message },
    );
  },
};