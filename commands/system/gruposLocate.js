import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["grupos", "groups", "listagrupos", "linkgrupos"],
  category: "system",
  description: "Muestra todos los grupos del bot y sus enlaces de invitación.",

  execute: async (sock, m, args, isOwner) => {
    try {
      const chatId = m?.key?.remoteJid;

      if (!isOwner) {
        return await sock.sendMessage(
          chatId,
          {
            text: `╭〔 ⚠️ ${fytBold("AURA REED")} 〕⬣\n┃ 🚫 ${fytBold("ACCESO DENEGADO")}\n╰━━━━━━━━━━━━⬣\n\n┃ > Solo el owner puede usar este comando.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
          },
          { quoted: m },
        );
      }

      await sock.sendMessage(chatId, { react: { text: "⏳", key: m.key } });

      const groups = await sock.groupFetchAllParticipating();
      const groupArray = Object.values(groups);

      if (groupArray.length === 0) {
        return await sock.sendMessage(
          chatId,
          {
            text: `╭〔 🌐 ${fytBold("AURA SYSTEM")} 〕⬣\n┃ ❌ ${fytBold("SIN GRUPOS")}\n╰━━━━━━━━━━━━⬣\n\n┃ > El bot no se encuentra en ningún grupo actualmente.\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
          },
          { quoted: m },
        );
      }

      let caption = `╭〔 🌐 ${fytBold("LISTA DE GRUPOS")} 〕⬣\n`;
      caption += `┃ 📊 ${fytBold("Total:")} ${groupArray.length}\n`;
      caption += `╰━━━━━━━━━━━━⬣\n\n`;

      for (let i = 0; i < groupArray.length; i++) {
        const group = groupArray[i];
        let link = "No disponible (Sin permisos)";

        try {
          const code = await sock.groupInviteCode(group.id);
          link = `https://chat.whatsapp.com/${code}`;
        } catch (err) {}

        caption += `┃ ${i + 1}. ${fytBold(group.subject)}\n`;
        caption += `┃ > ${fytBold("ID:")} ${group.id}\n`;
        caption += `┃ > ${fytBold("Enlace:")} ${link}\n`;
        caption += `┣━━━━━━━━━━━━⬣\n`;
      }

      caption += `\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`;

      await sock.sendMessage(chatId, { text: caption }, { quoted: m });
      await sock.sendMessage(chatId, { react: { text: "✅", key: m.key } });
    } catch (error) {
      if (sock && m) {
        await sock
          .sendMessage(
            m?.key?.remoteJid,
            {
              text: `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n┃ ⚠️ ${fytBold("ERROR")}\n╰━━━━━━━━━━━━⬣\n\n┃ > ${error?.message || error}\n\n╰〔 ⚡ ${fytBold("SYSTEM")} 〕⬣`,
            },
            { quoted: m },
          )
          .catch(() => {});
      }
    }
  },
};
