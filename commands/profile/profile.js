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
      
      // Asegurarnos de tener un identificador con formato de teléfono (PN) para el texto visual
      // Si realJid o targetLid es un LID, intentamos obtener el PN o usar jidRemitente si es válido
      let displayJid = realJid;
      if (realJid?.includes("@lid")) {
        // Intentar buscar si el socket tiene mapeo o usar el remitente como respaldo si es PN
        const pnMapping = socket.signalRepository?.lidMapping?.getPNForLID 
          ? await socket.signalRepository.lidMapping.getPNForLID(realJid) 
          : null;
        displayJid = pnMapping || jidRemitente;
      }
      if (!displayJid || displayJid.includes("@lid")) {
        displayJid = "50600000000@s.whatsapp.net"; // Fallback seguro para evitar números de LID en texto
      }

      migrateProfileIdentity(db, remoteJid, targetLid, realJid);
      const user = getProfileUser(db, remoteJid, realJid);

      // 2. Obtener Nombre de Pantalla
      let displayName = displayJid.split("@")[0];
      try {
        const contact =
          socket.store?.contacts?.get?.(realJid) ||
          socket.store?.contacts?.[realJid] ||
          socket.store?.contacts?.get?.(displayJid);
        displayName = contact?.notify || contact?.name || displayName;
      } catch {}

      if (realJid === jidRemitente || displayJid === jidRemitente) {
        displayName = message.pushName || displayName;
      }

      // Pasamos el displayJid (que es PN) para que formatProfileText use números limpios
      const result = formatProfileText(user, displayName, displayJid);

      // 3. Preparar Menciones (Incluimos tanto el realJid, el targetLid y el displayJid para máxima compatibilidad)
      const mentions = [realJid, targetLid, displayJid];

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

      // 4. Obtener foto de perfil con salvaguarda (Fallback)
      let ppUrl;
      try {
        ppUrl = await getProfilePictureUrl(socket, realJid);
      } catch (err) {
        ppUrl = "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
      }

      // 5. Enviar Mensaje
      await socket.sendMessage(
        remoteJid,
        {
          image: { url: ppUrl },
          caption: result.text,
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
