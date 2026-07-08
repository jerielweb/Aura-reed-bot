export default {
  name: ["join", "unirse"],
  category: "owner",
  description: "Une al bot a un grupo mediante un enlace.",
  ownerOnly: true,

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const link = args[0];

    if (!link || !link.includes("chat.whatsapp.com/")) {
      let text = `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ❌ 𝐔𝐒𝐎 𝐈𝐍𝐂𝐎𝐑𝐑𝐄𝐂𝐓𝐎\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ➪ .join [link-del-grupo]\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    const code = link.split("chat.whatsapp.com/")[1];

    try {
      const res = await socket.groupAcceptInvite(code);
      let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ 🛡️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐉𝐎𝐈𝐍\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Me he unido al grupo\n`;
      text += `┃ > con éxito.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } catch (e) {
      let text = `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐉𝐎𝐈𝐍\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > No pude unirme al grupo.\n`;
      text += `┃ > Error: ${e.message}\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};
