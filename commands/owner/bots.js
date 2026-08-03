import fs from "fs";
import {
  countActiveSubBots,
  getMaxSubBots,
} from "../../models/subbotManager.js";

export default {
  name: ["bots", "subbots", "lista-bots"],
  category: "owner",
  description: "Muestra la lista de sub-bots activos/sesiones.",
  ownerOnly: false,

  execute: async (socket, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;
    const isGroup = remoteJid.endsWith("@g.us");
    const sessionsDir = "./sessions/subbots";

    if (!fs.existsSync(sessionsDir)) {
      let text = `╭〔 🔌 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚠️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐒𝐔𝐁-𝐁𝐎𝐓𝐒\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No se han encontrado\n`;
      text += `┃ > sesiones de sub-bots.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const files = fs.readdirSync(sessionsDir);
    const activeCount = countActiveSubBots();
    const maxSubs = getMaxSubBots();
    let mentions = [];

    let text = `╭〔 🔌 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;

    if (isGroup) {
      let botsInGroup = [];
      try {
        const groupMetadata = await socket.groupMetadata(remoteJid);
        const participantJids = groupMetadata.participants.map((p) => {
          const jid = (p.jid?.includes('s.whatsapp.net') ? p.jid : null) || p.phoneNumber || p.id;
          return jid ? String(jid).split("@")[0].split(":")[0] : null;
        }).filter(Boolean);

        // Filtra los bots que coinciden con los participantes del grupo
        botsInGroup = files.filter((file) => participantJids.includes(file));
      } catch (e) {
        console.error("Error al obtener metadata del grupo:", e);
      }

      text += `┃ 🤖 𝐒𝐔𝐁-𝐁𝐎𝐓𝐒 𝐄𝐍 𝐄𝐋 𝐆𝐑𝐔𝐏𝐎\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ 📊 𝐀𝐜𝐭𝐢𝐯𝐨𝐬 𝐠𝐥𝐨𝐛𝐚𝐥: *${activeCount}/${maxSubs}*\n`;
      text += `┃ ❏ 𝐄𝐧 𝐞𝐬𝐭𝐞 𝐠𝐫𝐮𝐩𝐨: *${botsInGroup.length}*\n\n`;

      if (botsInGroup.length === 0) {
        text += `┃ > No hay sub-bots aquí.\n`;
      } else {
        botsInGroup.forEach((file, index) => {
          text += `┃ ${index + 1}. @${file}\n`;
          mentions.push(`${file}`);
        });
      }
    } else {
      text += `┃ 🤖 𝐒𝐔𝐁-𝐁𝐎𝐓𝐒 𝐀𝐂𝐓𝐈𝐕𝐎𝐒\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ 📊 𝐒𝐞𝐬𝐢𝐨𝐧𝐞𝐬: *${activeCount}/${maxSubs}*\n\n`;

      if (files.length === 0) {
        text += `┃ > No hay sesiones activas.\n`;
      } else {
        files.forEach((file, index) => {
          text += `┃ ${index + 1}. @${file}\n`;
          mentions.push(`${file}`);
        });
      }
    }

    text += `\n> _Usa ${prefix}code o ${prefix}qr para tener tu sub-bot._\n\n`;
    text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text, mentions },
      { quoted: message },
    );
  },
};
