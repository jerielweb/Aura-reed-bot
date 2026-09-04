import {
  resolveTargetJid,
  formatProfileText,
  getProfileUser,
  getProfilePictureUrl,
} from "../../models/profileUtils.js";
import { resolveToLid, resolveLidToRealJid } from "../../models/utils.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

export default {
  name: ["profile", "perfil", "me", "user", "whois"],
  category: "profile",
  description: "Muestra tu perfil o el de un usuario mencionado.",
  execute: async (socket, message, args, { db, jidRemitente, loadDB }) => {
    const remoteJid = message.key.remoteJid;

    // 🔄 IMPORTANTE: Recargar BD para asegurar que tiene cambios recientes (matrimonio/divorcio)
    if (typeof loadDB === "function") {
      const freshDb = await loadDB();
      if (freshDb.users) db.users = freshDb.users;
      if (freshDb.groups) db.groups = freshDb.groups;
    }

    // Clave LID del remitente. Se usa para saber si está viendo su propio
    // perfil y como clave de migración de datos guardados con el jid viejo.
    const senderLid = await resolveToLid(jidRemitente, socket, remoteJid);
    const legacySenderJid = jidNormalizedUser(jidRemitente);

    // targetJid es SIEMPRE un LID: es la única clave que usamos para leer/
    // guardar datos de usuario (coincide con lo que guarda marry.js/divorce.js).
    const targetJid = await resolveTargetJid(
      message,
      socket,
      remoteJid,
      jidRemitente,
    );

    // jid real (número), solo para llamadas a la API de WhatsApp: foto de
    // perfil y nombre de contacto. Nunca se usa para guardar datos.
    const targetRealJid = await resolveLidToRealJid(targetJid, socket, remoteJid);

    // Si es su propio perfil, la clave legacy es su jid real de siempre.
    // Si es el perfil de otra persona, no tenemos forma de saber su jid
    // legacy con certeza, así que usamos el real como mejor intento.
    const legacyJid = targetJid === senderLid ? legacySenderJid : targetRealJid;

    const user = getProfileUser(db, remoteJid, targetJid, legacyJid);

    let displayName = targetRealJid.split("@")[0];
    try {
      const contact =
        socket.store?.contacts?.get?.(targetRealJid) ||
        socket.store?.contacts?.[targetRealJid];
      displayName = contact?.notify || contact?.name || displayName;
    } catch {
      /* ignorar */
    }

    if (targetJid === senderLid) {
      displayName = message.pushName || displayName;
    }

    const mentions = [targetJid];
    // Verificar si está casado y agregar a menciones
    if (user.marriedTo) {
      mentions.push(user.marriedTo);
    }

    const caption = formatProfileText(user, displayName, targetRealJid);
    const ppUrl = await getProfilePictureUrl(socket, targetRealJid);

    await socket.sendMessage(
      remoteJid,
      {
        image: { url: ppUrl },
        caption,
        mentions,
      },
      { quoted: message },
    );
  },
};
