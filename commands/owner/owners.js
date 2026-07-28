export default {
  name: ["owners", "dueños", "propietarios", "owner"],
  category: "owner",
  description: "Muestra la información de los propietarios del bot como tarjetas de contacto.",
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

    const senderJid = message.key.participant || message.key.remoteJid;

    const contactsList = await Promise.all(
      owners.map(async (jid) => {
        const numero = jid.split("@")[0];
        const rol =
          (ownerRoles[jid] || "Propietario")
            .split(" ")
            .filter((t) => !/^@?\d{5,}$/.test(t))
            .join(" ")
            .trim() || "Propietario";

        // Búsqueda del pushName por prioridad: mensaje actual > función getName > caché de contactos > número de teléfono
        let pushName = "";
        if (jid === senderJid && message.pushName) {
          pushName = message.pushName;
        } else if (typeof socket.getName === "function") {
          pushName = await socket.getName(jid);
        } else {
          pushName =
            socket.contacts?.[jid]?.pushName ||
            socket.contacts?.[jid]?.name ||
            socket.contacts?.[jid]?.notify ||
            `+${numero}`;
        }

        const vcard = 
`BEGIN:VCARD
VERSION:3.0
FN:${pushName}
ORG:${rol};
TEL;type=CELL;type=VOICE;waid=${numero}:+${numero}
END:VCARD`;

        return { vcard };
      })
    );

    await socket.sendMessage(
      remoteJid,
      {
        contacts: {
          displayName: `Información de los contactos`,
          contacts: contactsList,
        },
      },
      { quoted: message }
    );
  },
};
