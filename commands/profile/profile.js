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

    try {
      // 1. Resolver el JID objetivo (LID por defecto en sistemas nuevos)
      const targetLid = await resolveTargetJid(
        message,
        socket,
        remoteJid,
        jidRemitente,
      );

      const user = getProfileUser(db, remoteJid, targetLid);
      const realJid = await resolveLidToRealJid(targetLid, socket, remoteJid);

      // 2. Obtener Nombre de Pantalla
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

      // 3. Preparar Menciones (Inclusión doble para evitar fallos de renderizado LID/PN)
      const mentions = [realJid, targetLid]; 
      
      if (result.marriedLid) {
        const marriedRealJid = await resolveLidToRealJid(
          result.marriedLid,
          socket,
          remoteJid,
        );
        mentions.push(marriedRealJid, result.marriedLid);
      }

      // Filtrar por si acaso algún resolver devolvió null o undefined
      const cleanMentions = mentions.filter(Boolean);

      // 4. Obtener foto de perfil con salvaguarda (Fallback)
      let ppUrl;
      try {
        ppUrl = await getProfilePictureUrl(socket, realJid);
      } catch (err) {
        // Imagen por defecto si el usuario la tiene privada o no tiene foto
        ppUrl = "https://pixabay.com";
      }

      // 5. Enviar Mensaje
      await socket.sendMessage(
        remoteJid,
        {
          image: { url: ppUrl },
          caption: result.text,
          mentions: cleanMentions, // Enviamos el array limpio y robusto
        },
        { quoted: message },
      );

    } catch (globalError) {
      console.error("Error crítico en comando profile:", globalError);
      await socket.sendMessage(remoteJid, { 
        text: "❌ Ocurrió un error al intentar cargar el perfil." 
      }, { quoted: message });
    }
  },
};
