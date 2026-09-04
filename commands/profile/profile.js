// profile.js - VERSIÓN CORREGIDA
import { 
  getProfileUser, 
  formatProfileText,
  resolveTargetJid
} from "../../models/profileUtils.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

export default {
  name: ["profile", "perfil", "pf", "me"],
  category: "profile",
  description: "Muestra tu perfil o el de otro usuario.",
  execute: async (socket, message, args, { db, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    
    // ✅ IMPORTANTE: Si no hay mención, usar el JID del remitente
    let targetJid = null;
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    
    // ✅ Verificar si hay mención
    if (ctx?.mentionedJid?.length > 0) {
      targetJid = ctx.mentionedJid[0];
    } else {
      // ✅ Si no hay mención, usar el remitente
      targetJid = jidRemitente;
    }
    
    // ✅ Normalizar el JID
    targetJid = jidNormalizedUser(targetJid);
    
    console.log('📝 [profile] Usuario objetivo:', targetJid);
    console.log('📝 [profile] Remitente original:', jidRemitente);
    
    // ✅ Obtener usuario
    const user = getProfileUser(db, remoteJid, targetJid);
    
    console.log('📝 [profile] Datos del usuario:', {
      genre: user.genre,
      birthday: user.birthday,
      marriedTo: user.marriedTo,
      xp: user.xp,
      level: user.level
    });
    
    // ✅ Generar texto
    const text = formatProfileText(user, null, targetJid);
    
    // ✅ Menciones
    const mentions = [targetJid];
    if (user.marriedTo) {
      const marriedJid = jidNormalizedUser(user.marriedTo);
      mentions.push(marriedJid);
    }
    
    // ✅ Enviar mensaje
    await socket.sendMessage(
      remoteJid,
      { text, mentions },
      { quoted: message }
    );
  },
};