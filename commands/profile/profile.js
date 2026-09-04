// profile.js
import {
  resolveTargetJid,
  formatProfileText,
  getProfileUser,
  getProfilePictureUrl,
} from "../../models/profileUtils.js";
import { resolveLidToRealJid } from "../../models/utils.js";

export default {
  name: ["profile", "perfil", "me", "user", "whois"],
  category: "profile",
  description: "Muestra tu perfil o el de un usuario mencionado.",
  execute: async (socket, message, args, { db, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;

    const targetLid = await resolveTargetJid(
      message,
      socket,
      remoteJid,
      jidRemitente,
    );

    const user = getProfileUser(db, remoteJid, targetLid);
    const realJid = await resolveLidToRealJid(targetLid, socket, remoteJid);

    let displayName = realJid.split("@")[0];
    try {
      const contact =
        socket.store?.contacts?.get?.(realJid) ||
        socket.store?.contacts?.[realJid];
      displayName = contact?.notify || contact?.name || displayName;
    } catch {}

    if (targetLid === jidRemitente) {
      displayName = message.pushName || displayName;
    }

    const result = formatProfileText(user, displayName, targetLid);

    const mentions = [realJid];
    if (result.marriedLid) {
      const marriedRealJid = await resolveLidToRealJid(
        result.marriedLid,
        socket,
        remoteJid,
      );
      mentions.push(marriedRealJid);
    }

    const ppUrl = await getProfilePictureUrl(socket, realJid);

    await socket.sendMessage(
      remoteJid,
      {
        image: { url: ppUrl },
        caption: result.text,
        mentions,
      },
      { quoted: message },
    );
  },
};