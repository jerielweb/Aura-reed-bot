// profile.js - VERSIÓN CORREGIDA
import { 
  getProfileUser, 
  formatProfileText,
  resolveTargetJid
} from "../../models/profileUtils.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

export default {
  name: ["profile", "perfil", "pf"],
  category: "profile",
  description: "Muestra tu perfil o el de otro usuario.",
  execute: async (socket, message, args, { db, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    
    // ✅ Obtener el JID objetivo
    let targetJid = jidNormalizedUser(jidRemitente);
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    
    if (ctx?.mentionedJid?.length > 0) {
      targetJid = jidNormalizedUser(ctx.mentionedJid[0]);
    }
    
    console.log('📝 [profile] Usuario objetivo:', targetJid);
    
    // ✅ Obtener usuario
    const user = getProfileUser(db, remoteJid, targetJid);
    
    console.log('📝 [profile] Datos del usuario:', {
      genre: user.genre,
      birthday: user.birthday,
      marriedTo: user.marriedTo,
      xp: user.xp,
      level: user.level
    });
    
    // ✅ OBTENER EL OBJETO COMPLETO (texto + mención de pareja)
    const result = formatProfileText(user, null, targetJid);
    
    // ✅ Construir menciones
    const mentions = [targetJid];
    
    // ✅ Si tiene pareja, agregarla a las menciones
    if (user.marriedTo) {
      const marriedJid = jidNormalizedUser(user.marriedTo);
      mentions.push(marriedJid);
    }
    
    // ✅ Enviar mensaje con el texto y las menciones
    await socket.sendMessage(
      remoteJid,
      { 
        text: result.text,  // ✅ USAR result.text
        mentions: mentions 
      },
      { quoted: message }
    );
  },
};