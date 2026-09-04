// setBirth.js
import { getProfileUser, parseBirthday } from "../../models/profileUtils.js";
import { fytBold } from "../../models/TextStyle.js";
import { resolveToLid, resolveLidToRealJid } from "../../models/utils.js";

export default {
  name: ["setbirth", "setbirt", "cumple", "cumpleaños"],
  category: "profile",
  description: "Define tu fecha de cumpleaños.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const input = args.join(" ");

    if (!input) {
      let text = `╭〔 ⚠️ ${fytBold("FALTA INFORMACIÓN")} 〕⬣\n`;
      text += `┃ ${fytBold("FALTA FECHA DE CUMPLEAÑOS")} \n╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Proporciona tu fecha de cumpleaños.\n`;
      text += `┃ > Formato: *DD/MM* o *DD/MM/AAAA*\n\n`;
      text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const birthday = parseBirthday(input);
    if (!birthday) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "❌ Fecha inválida. Usa *DD/MM* o *DD/MM/AAAA*.",
        },
        { quoted: message },
      );
    }

    const lid = await resolveToLid(jidRemitente, socket, remoteJid);
    const user = getProfileUser(db, remoteJid, lid);
    user.birthday = birthday;

    if (typeof saveDB === "function") saveDB(db);

    const realJid = await resolveLidToRealJid(lid, socket, remoteJid);

    let text = `╭〔 🎂 ${fytBold("PERFIL")} 〕⬣\n`;
    text += `┃ ✅ ${fytBold("CUMPLEAÑOS GUARDADO")}\n╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ > Fecha: *${birthday}*\n\n`;
    text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text, mentions: [realJid] },
      { quoted: message },
    );
  },
};