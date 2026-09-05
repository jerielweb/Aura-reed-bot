// profile.js
import {
  resolveTargetJid,
  formatProfileText,
  getProfileUser,
  getProfilePictureUrl,
  migrateProfileIdentity,
} from "../../models/profileUtils.js";
import { resolveLidToRealJid } from "../../models/utils.js";

export default {
  name: ["profile", "perfil", "me", "user", "whois"],
  category: "profile",
  description: "Muestra tu perfil o el de un usuario mencionado.",
  execute: async (socket, message, args, { db, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;

    try {
      // 1. Resolver el JID objetivo (LID por defecto en sistemas nuevos)
      const targetLid = await resolveTargetJid(
        message,
        socket,
        remoteJid,
        jidRemitente,
      );

      const realJid = await resolveLidToRealJid(targetLid, socket, remoteJid);
      migrateProfileIdentity(db, remoteJid, targetLid, realJid);
      const user = getProfileUser(db, remoteJid, realJid);

      // 2. Obtener Nombre de Pantalla
      let displayName = realJid.split("@")[0];
      try {
        const contact =
          socket.store?.contacts?.get?.(realJid) ||
          socket.store?.contacts?.[realJid];
        displayName = contact?.notify || contact?.name || displayName;
      } catch {}

      if (realJid === jidRemitente) {
        displayName = message.pushName || displayName;
      }

      const result = formatProfileText(user, displayName, realJid);

      // 3. Preparar Menciones (Inclusión doble para LID y PN)
      const mentions = [realJid, targetLid];

      if (result.marriedLid) {
        const marriedRealJid = await resolveLidToRealJid(
          result.marriedLid,
          socket,
          remoteJid,
        );
        mentions.push(marriedRealJid, result.marriedLid);
      }

      // Filtrar duplicados y valores nulos
      const cleanMentions = [...new Set(mentions.filter(Boolean))];

      // 4. Asegurar que el texto use el formato de mención correcto con el número real (PN)
      // para que WhatsApp lo convierta en mención interactiva en lugar de mostrar el LID largo.
      let captionText = result.text;
      const phoneNum = realJid.split("@")[0];

      // Si tu función formatProfileText deja el ID crudo del LID, lo reemplazamos por el formato de mención del PN
      if (targetLid) {
        const rawLidNum = targetLid.split("@")[0];
        captionText = captionText.replaceAll(`@${rawLidNum}`, `@${phoneNum}`);
      }

      // 5. Obtener foto de perfil con salvaguarda (Fallback)
      let ppUrl;
      try {
        ppUrl = await getProfilePictureUrl(socket, realJid);
      } catch (err) {
        ppUrl = "https://pixabay.com";
      }

      // 6. Enviar Mensaje
      await socket.sendMessage(
        remoteJid,
        {
          image: { url: ppUrl },
          caption: captionText,
          mentions: cleanMentions, 
        },
        { quoted: message },
      );
    } catch (globalError) {
      console.error("Error crítico en comando profile:", globalError);
      await socket.sendMessage(
        remoteJid,
        {
          text: "❌ Ocurrió un error al intentar cargar el perfil.",
        },
        { quoted: message },
      );
    }
  },
};
