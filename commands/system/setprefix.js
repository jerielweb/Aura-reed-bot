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

    const newPrefix = args[0];
    const currentPrefix = db.groups?.[remoteJid]?.prefix || db.prefix;

    if (!newPrefix) {
      let text = `╭〔 ℹ️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚙️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Defina el prefijo que\n`;
      text += `┃ > desea utilizar para este grupo.\n\n`;
      text += `┣━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ➪ Ejemplo: ${currentPrefix}setprefix #\n\n`;
      text += `┃ > Si no se define prefijo de grupo,\n`;
      text += `┃ > el bot usará el prefijo global actual.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      return sock.sendMessage(remoteJid, { text }, { quoted: m });
    }

    db.groups = db.groups || {};
    db.groups[remoteJid] = db.groups[remoteJid] || {};
    db.groups[remoteJid].prefix = newPrefix;
    saveDB(db);

    let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
    text += `┃ ⚙️ 𝐂𝐎𝐍𝐅𝐈𝐆𝐔𝐑𝐀𝐂𝐈𝐎́𝐍\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ > El prefijo de este grupo ha sido\n`;
    text += `┃ > actualizado a: ${newPrefix}\n\n`;
    text += `┃ > En este grupo ahora funciona solo\n`;
    text += `┃ > con el prefijo específico configurado.\n\n`;
    text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    await sock.sendMessage(remoteJid, { text }, { quoted: m });
  },
};
