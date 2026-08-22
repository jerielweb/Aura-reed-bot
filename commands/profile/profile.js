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
  execute: async (socket, message, args, { db, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const normalizedSender = jidNormalizedUser(jidRemitente);
    let targetJid = await resolveTargetJid(
      message,
      socket,
      remoteJid,
      normalizedSender,
    );
    if (targetJid) targetJid = jidNormalizedUser(targetJid);
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
    if (user.marriedTo) mentions.push(user.marriedTo);

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
