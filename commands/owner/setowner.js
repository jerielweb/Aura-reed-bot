import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["setowner", "newowner", "addowner"],
  category: "owner",
  description: "Añade un nuevo owner al bot con un rol opcional.",
  ownerOnly: true,

  execute: async (sock, m, args, { db, saveDB, owners }) => {
    const remoteJid = m.key.remoteJid;
    const ctx = m.message?.extendedTextMessage?.contextInfo || {};
    const replied = ctx.participant;
    const mentioned = ctx.mentionedJid?.[0];
    const rawArg = args[0]?.replace(/\D/g, "");

    let targetJid = replied || mentioned || (rawArg?.length >= 7 ? `${rawArg}@s.whatsapp.net` : null);

    // SANITIZACIÓN ESTRICTA: Purga espacios y símbolos para arreglar el tag
    if (targetJid) {
      const cleanNumbers = targetJid.replace(/[^0-9]/g, "");
      if (cleanNumbers.length >= 7) {
        targetJid = `${cleanNumbers}@s.whatsapp.net`;
      } else {
        targetJid = null;
      }
    }

    if (!targetJid) {
      const text = `╭〔 👑 ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("USO INCORRECTO")}\n╰━━━━━━━━━━━━⬣\n\n┃ ➪ .setowner @usuario Colaborador\n┃ ✦ Responde a alguien con el rol\n\n┃ ➪ .setowner 50612345678 Colaborador\n┃ ✦ Por número con el rol\n\n┃ ✦ Si no pones rol, se usa Propietario\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return await sock.sendMessage(remoteJid, { text }, { quoted: m });
    }

    const targetNum = targetJid.split("@")[0];
    const cleanArgs = args.filter((a) => !/^@?\d{5,}$/.test(a.replace(/\D/g, "")) && a.replace(/\D/g, "") !== targetNum);
    const role = cleanArgs.length > 0 ? cleanArgs.join(" ") : "Propietario";

    db.owners = db.owners || [];
    db.ownerRoles = db.ownerRoles || {};

    const isAlreadyOwner = db.owners.includes(targetJid) || db.owners.includes(targetNum);

    if (isAlreadyOwner) {
      const rolAnterior = db.ownerRoles[targetJid] || db.ownerRoles[targetNum] || "Propietario";
      
      if (rolAnterior === role) {
        const text = `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ 👑 ${fytBold("ERROR DE OWNER")}\n╰━━━━━━━━━━━━⬣\n\n┃ > @${targetNum} ya es\n┃ > *${role}* del bot.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
        return await sock.sendMessage(remoteJid, { text, mentions: [targetJid] }, { quoted: m });
      }

      db.ownerRoles[targetJid] = role;
      db.ownerRoles[targetNum] = role;
      await saveDB(db, { immediate: true });

      const text = `╭〔 👑 ${fytBold("AURA REED")} 〕⬣\n┃ 🔄 ${fytBold("ROL ACTUALIZADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > @${targetNum}\n┃ > *${rolAnterior}* ➜ *${role}*\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
      return await sock.sendMessage(remoteJid, { text, mentions: [targetJid] }, { quoted: m });
    }

    if (!db.owners.includes(targetNum)) db.owners.push(targetNum);
    if (!db.owners.includes(targetJid)) db.owners.push(targetJid);
    
    db.ownerRoles[targetJid] = role;
    db.ownerRoles[targetNum] = role;

    // SINCRONIZACIÓN DE RAM: Inyecta el permiso para uso instantáneo
    if (owners && Array.isArray(owners)) {
        if (!owners.includes(targetNum)) owners.push(targetNum);
        if (!owners.includes(targetJid)) owners.push(targetJid);
    }
    
    await saveDB(db, { immediate: true });

    const text = `╭〔 👑 ${fytBold("AURA REED")} 〕⬣\n┃ ✅ ${fytBold("NUEVO OWNER")}\n╰━━━━━━━━━━━━⬣\n\n┃ > @${targetNum} ha sido\n┃ > ascendido como *${role}*.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;
    await sock.sendMessage(remoteJid, { text, mentions: [targetJid] }, { quoted: m });
  }
};
