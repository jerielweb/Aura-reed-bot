import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["setprefix", "prefix"],
  description: "Modifica prefijo.",
  adminOnly: true,
  category: "system",

  async execute(sock, m, args, { db, saveDB }) {
    const remoteJid = m.key.remoteJid;
    const isGroup = remoteJid.endsWith("@g.us");

    if (!isGroup) {
      return await sock.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐂𝐎𝐌𝐀𝐍𝐃𝐎 𝐍𝐎 𝐕𝐀𝐋𝐈𝐃𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ > Este comando solo puede ejecutarse dentro de un grupo.\n┃ > Configura el prefijo específico del grupo usando este comando allí.`,
        },
        { quoted: m },
      );
    }
        // 🛑 VALIDACIÓN DE SEGURIDAD
    // 1 solo carácter, solo símbolos, pero PROHIBIDA la barra invertida (\)
    const isValidPrefix = /^[^a-zA-Z0-9\s]{1}$/.test(newPrefix) && newPrefix !== "\\";

    if (!isValidPrefix) {
      let text = `╭〔 ⚠️  ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ❌ ${fytBold("PREFIJO INVALIDO")}\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Porfavor defina un prefijo valido para el grupo.\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      return await sock.sendMessage(remoteJid, { text }, { quoted: m });
    }


    const input = args[0]?.toLowerCase();
    const currentPrefix = db.groups?.[remoteJid]?.prefix || "Multiprefijo (. # / !)";

    // Lógica para restablecer (reset) a multiprefijo
    if (["reset", "del", "delete", "off", "clear"].includes(input)) {
      if (db.groups?.[remoteJid]?.prefix) {
        delete db.groups[remoteJid].prefix;
        saveDB(db);
      }

      let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚙️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Se ha restablecido el prefijo por defecto.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      return await sock.sendMessage(remoteJid, { text }, { quoted: m });
    }

    if (!input) {
      let text = `╭〔 ℹ️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚙️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Defina el prefijo fijo que desea utilizar para este grupo.\n\n`;
      text += `┣━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ➪ Ejemplo: setprefix #\n`;
      text += `┃ ➪ Restablecer: setprefix reset\n\n`;
      text += `┃ > Prefijo actual en este grupo:\n`;
      text += `┃ > ${currentPrefix}\n\n`;
      text += `┃ > Si no hay prefijo de grupo, el bot usará los multiprefijos por defecto (. # / !).\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      return sock.sendMessage(remoteJid, { text }, { quoted: m });
    }

    const newPrefix = args[0];
    db.groups = db.groups || {};
    db.groups[remoteJid] = db.groups[remoteJid] || {};
    db.groups[remoteJid].prefix = newPrefix;
    saveDB(db);

    let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
    text += `┃ ⚙️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ > El prefijo de este grupo ha sido actualizado a: ${newPrefix}\n\n`;
    text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    await sock.sendMessage(remoteJid, { text }, { quoted: m });
  },
};
