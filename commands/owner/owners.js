export default {
  name: ["owners", "dueños", "propietarios"],
  category: "owner",
  description: "Muestra la información de los propietarios del bot.",
  ownerOnly: false,

  execute: async (socket, message, args, { db }) => {
    const remoteJid = message.key.remoteJid;

    const owners = db.owners || [];
    const ownerRoles = db.ownerRoles || {};

    if (owners.length === 0) {
      let text = `╭〔 👑 𝐎𝐖𝐍𝐄𝐑𝐒 〕⬣\n\n`;
      text += `┃ > No hay propietarios registrados.\n\n`;
      text += `╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    let text = `╭〔 👑 𝐎𝐖𝐍𝐄𝐑𝐒 〕⬣\n\n`;

    for (let i = 0; i < owners.length; i++) {
      const jid = owners[i];
      const numero = jid.split("@")[0];
      const rol =
        (ownerRoles[jid] || "Propietario")
          .split(" ")
          .filter((t) => !/^@?\d{5,}$/.test(t))
          .join(" ")
          .trim() || "Propietario";

      // Elegir ícono según el rol
      let icon = "👑";
      const rolLower = rol.toLowerCase();
      if (rolLower.includes("colaborador")) icon = "🤝";
      else if (rolLower.includes("diseñador") || rolLower.includes("disenador"))
        icon = "🎨";
      else if (rolLower.includes("moderador")) icon = "🛡️";
      else if (rolLower.includes("admin")) icon = "⚙️";
      else if (rolLower.includes("developer") || rolLower.includes("dev"))
        icon = "💻";

      text += `┃ ${icon} *${rol}*\n`;
      text += `┃ ➪ @${numero}\n`;
      text += `┃ 📞 +${numero}\n`;

      if (i < owners.length - 1) {
        text += `┃\n┣━━━━━━━━━━━━⬣\n┃\n`;
      }
    }

    text += `\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      {
        text,
        mentions: owners,
      },
      { quoted: message },
    );
  },
};
