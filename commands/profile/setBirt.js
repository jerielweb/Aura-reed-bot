// setBirth.js - CORREGIDO
import { getProfileUser, parseBirthday } from "../../models/profileUtils.js";
import { fytBold } from "../../models/TextStyle.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

export default {
  name: ["setbirth", "setbirt", "cumple", "cumpleaños"],
  category: "profile",
  description: "Define tu fecha de cumpleaños.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const normalizedSender = jidNormalizedUser(jidRemitente);
    const input = args.join(" ");

    console.log('📝 [setBirth] Usuario:', normalizedSender);
    console.log('📝 [setBirth] Fecha ingresada:', input);

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
          text: "❌ Fecha inválida. Usa el formato *DD/MM* o *DD/MM/AAAA*.",
        },
        { quoted: message },
      );
    }

    // ✅ Obtener usuario y asignar cumpleaños
    const user = getProfileUser(db, remoteJid, normalizedSender);
    user.birthday = birthday;
    
    console.log('📝 [setBirth] Guardado:', {
      jid: normalizedSender,
      birthday: birthday,
      dbUsers: db.users[normalizedSender]
    });
    
    // ✅ Guardar en disco
    if (typeof saveDB === "function") saveDB(db);

    let text = `╭〔 🎂 ${fytBold("PERFIL")} 〕\n`;
    text += `┃ ✅ ${fytBold("CUMPLEAÑOS GUARDADO")}\n╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ > Fecha: *${birthday}*\n\n`;
    text += `╰〔 ⚡ ${fytBold("AURA REED")} 〕⬣`;
    
    await socket.sendMessage(
      remoteJid,
      { text, mentions: [normalizedSender] },
      { quoted: message },
    );
  },
};