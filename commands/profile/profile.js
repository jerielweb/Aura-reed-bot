// profile.js - VERSIÓN CORREGIDA
import { 
  getProfileUser, 
  formatProfileText
} from "../../models/profileUtils.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

export default {
  name: ["profile", "perfil", "pf"],
  category: "profile",
  description: "Muestra tu perfil o el de otro usuario.",
  execute: async (socket, message, args, { db, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    
    // ✅ Obtener el JID del remitente
    let targetJid = jidRemitente; // Usar el JID original sin modificar
    
    // ✅ Si hay mención, usar ese JID
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    if (ctx?.mentionedJid?.length > 0) {
      targetJid = ctx.mentionedJid[0];
    }
    
    // ✅ Normalizar SOLO para la clave en la DB
    const normalizedJid = jidNormalizedUser(targetJid);
    
    console.log('📝 [profile] JID original:', targetJid);
    console.log('📝 [profile] JID normalizado:', normalizedJid);
    
    // ✅ Obtener usuario con el JID normalizado
    const user = getProfileUser(db, remoteJid, normalizedJid);
    
    console.log('📝 [profile] Datos del usuario:', {
      genre: user.genre,
      birthday: user.birthday,
      marriedTo: user.marriedTo,
      xp: user.xp,
      level: user.level
    });
    
    // ✅ Generar texto del perfil
    const text = formatProfileText(user, null, normalizedJid);
    
    // ✅ Construir menciones (usar el JID original para menciones)
    const mentions = [targetJid];
    if (user.marriedTo) {
      const marriedJid = jidNormalizedUser(user.marriedTo);
      mentions.push(marriedJid);
    }
    
    // ✅ Enviar mensaje - SOLO TEXTO Y MENCIONES
    await socket.sendMessage(
      remoteJid,
      { 
        text: text,  // ✅ SOLO TEXTO
        mentions: mentions 
      },
      { quoted: message }
    );
  },
};