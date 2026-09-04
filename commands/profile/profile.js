// profile.js - VERSIÓN COMPLETA CORREGIDA
import { 
  getProfileUser, 
  formatProfileText, 
  resolveTargetJid  // ✅ IMPORTA ESTA FUNCIÓN
} from "../../models/profileUtils.js";
import { jidNormalizedUser } from "@whiskeysockets/baileys";

export default {
  name: ["profile", "perfil", "pf"],
  category: "profile",
  description: "Muestra tu perfil o el de otro usuario.",
  execute: async (socket, message, args, { db, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    
    // ✅ Resolver el JID objetivo
    let targetJid = await resolveTargetJid(
      message,
      socket,
      remoteJid,
      jidRemitente,
    );
    targetJid = jidNormalizedUser(targetJid);
    
    // ✅ LOG PARA DEBUG
    console.log('📝 [profile] Buscando usuario:', targetJid);
    
    // ✅ Obtener usuario
    const user = getProfileUser(db, remoteJid, targetJid);
    
    // ✅ LOG PARA DEBUG
    console.log('📝 [profile] Usuario obtenido:', {
      genre: user.genre,
      birthday: user.birthday,
      marriedTo: user.marriedTo,
      xp: user.xp,
      level: user.level
    });
    
    // ✅ Generar texto (pasamos null como pushName porque no lo usamos)
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