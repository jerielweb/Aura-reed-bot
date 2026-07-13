export default {
  name: ["restart", "reiniciar"],
  category: "owner",
  description: "Reinicia el bot.",
  ownerOnly: true,

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;

    let text = `╭〔 🔄 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
    text += `┃ ⚙️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐑𝐄𝐒𝐓𝐀𝐑𝐓\n`;
    text += `╰━━━━━━━━━━━━⬣\n\n`;
    text += `┃ > El bot se está reiniciando\n`;
    text += `┃ > espere un momento...\n\n`;
    text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    await socket.sendMessage(remoteJid, { text }, { quoted: message });

    setTimeout(() => {
      process.exit(0);
    }, 1000);
  },
};
