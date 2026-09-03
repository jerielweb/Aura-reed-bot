import {
  resolveTargetJid,
  formatProfileText,
  getProfileUser,
  getProfilePictureUrl,
} from "../../models/profileUtils.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

export default {
  name: ["profile", "perfil", "me", "user", "whois"],
  category: "profile",
  description: "Muestra tu perfil o el de un usuario mencionado.",
  execute: async (socket, message, args, { db, jidRemitente, loadDB }) => {
    const remoteJid = message.key.remoteJid;
    const normalizedSender = jidNormalizedUser(jidRemitente);
    
    // 🔄 IMPORTANTE: Recargar BD para asegurar que tiene cambios recientes (matrimonio/divorcio)
    if (typeof loadDB === "function") {
      const freshDb = await loadDB();
      // Actualizar la instancia actual con datos frescos
      if (freshDb.users) {
        db.users = freshDb.users;
      }
      if (freshDb.groups) {
        db.groups = freshDb.groups;
      }
    }

    let targetJid = await resolveTargetJid(
      message,
      socket,
      remoteJid,
      normalizedSender,
    );
    if (targetJid) targetJid = jidNormalizedUser(targetJid);
    
    // Obtener el usuario con datos sincronizados
    const user = getProfileUser(db, remoteJid, targetJid);

    let displayName = targetJid.split("@")[0];
    try {
      const contact =
        socket.store?.contacts?.get?.(targetJid) ||
        socket.store?.contacts?.[targetJid];
      displayName = contact?.notify || contact?.name || displayName;
    } catch {
      /* ignorar */
    }

    if (targetJid === normalizedSender) {
      displayName = message.pushName || displayName;
    }

    const mentions = [targetJid];
    // Verificar si está casado y agregar a menciones
    if (user.marriedTo) {
      mentions.push(user.marriedTo);
    }

    const caption = formatProfileText(user, displayName, targetJid);
    const ppUrl = await getProfilePictureUrl(socket, targetJid);

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
