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
      // 1. Resolver el JID objetivo
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

      // 3. Preparar Menciones y corregir el texto para que WhatsApp lo renderice
      const mentions = [realJid, targetLid];
      let captionText = result.text;

      // Si el usuario está casado y tiene un marriedLid
      if (result.marriedLid) {
        const marriedRealJid = await resolveLidToRealJid(
          result.marriedLid,
          socket,
          remoteJid,
        );

        // Si logramos obtener el número real (PN) del matrimonio, reemplazamos el LID en el texto 
        // por el PN para que WhatsApp renderice la mención correctamente, y guardamos ambos en mentions.
        if (marriedRealJid && !marriedRealJid.includes("@lid")) {
          const lidNum = result.marriedLid.split("@")[0];
          const realNum = marriedRealJid.split("@")[0];
          
          // Reemplazamos el número largo del LID en el texto por el número real para que WhatsApp lo pinte
          captionText = captionText.replace(`@${lidNum}`, `@${realNum}`);
          
          mentions.push(marriedRealJid, result.marriedLid);
        } else {
          mentions.push(result.marriedLid);
        }
      }

      // Filtrar duplicados y valores nulos
      const cleanMentions = [...new Set(mentions.filter(Boolean))];

      // 4. Obtener foto de perfil con salvaguarda (Fallback)
      let ppUrl;
      try {
        ppUrl = await getProfilePictureUrl(socket, realJid);
      } catch (err) {
        ppUrl = "https://pixabay.com";
      }

      // 5. Enviar Mensaje
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
