import { categories, Aliases } from "./consts/cat.js";

export function isCategoryEnabled(remoteJid, category, db) {
  const protectedCategories = ["owner", "group", "system"];
  if (
    !remoteJid.endsWith("@g.us") ||
    protectedCategories.includes(category?.toLowerCase())
  )
    return true;

  const groupData = db.groups?.[remoteJid];

  // Si el grupo aún no existe en DB, "nsfw" inicia desactivada por defecto
  if (!groupData) {
    return category?.toLowerCase() !== "nsfw";
  }

  // Si el grupo existe pero no tiene el array inicializado, se le asigna "nsfw" por defecto
  if (!groupData.disabledCategories) {
    groupData.disabledCategories = ["nsfw"];
  }

  // Verificación insensible a mayúsculas/minúsculas
  const isDisabled = groupData.disabledCategories.some(
    (c) => c.toLowerCase() === category?.toLowerCase(),
  );

  return !isDisabled;
}

export default {
  name: ["cmds", "cmd", "cmdmanager"],
  category: "group",
  description: "Activa o desactiva comandos",
  adminOnly: true,

  execute: async (socket, message, args, { prefix, db, saveDB }) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) return;

    if (!db.groups[remoteJid]) {
      db.groups[remoteJid] = {
        antilink: false,
        warnLimit: 3,
        warns: {},
        activity: {},
        onlyAdmin: false,
        antitoxic: false,
        disabledCategories: ["nsfw"],
        botOn: true,
      };
    }

    if (!db.groups[remoteJid].disabledCategories) {
      db.groups[remoteJid].disabledCategories = ["nsfw"];
    }

    const action = args[0]?.toLowerCase();
    const rawCategory = args[1]?.toLowerCase();

    // 1. Busca en el objeto de Alias (convirtiendo las claves a minúsculas)
    const normalizedAliases = Object.fromEntries(
      Object.entries(Aliases).map(([k, v]) => [k.toLowerCase(), v]),
    );

    const targetCategory = normalizedAliases[rawCategory] || rawCategory;

    // 2. Encuentra la coincidencia exacta dentro del array `categories`
    const category = categories.find(
      (c) => c.toLowerCase() === targetCategory?.toLowerCase(),
    );

    const protectedCategories = ["owner", "group", "system"];

    if (!action || !rawCategory) {
      let text = `╭〔 ⚙️ 𝐂𝐌𝐃 𝐌𝐀𝐍𝐀𝐆𝐄𝐑 〕⬣\n`;
      text += `┃ 🛡️ 𝐆𝐄𝐒𝐓𝐈𝐎́𝐍 𝐃𝐄 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈́𝐀𝐒\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ➪ ${prefix}cmds on [cat]\n`;
      text += `┃ ✦ Habilitar comandos\n\n`;
      text += `┃ ➪ ${prefix}cmds off [cat]\n`;
      text += `┃ ✦ Deshabilitar comandos\n\n`;
      text += `╭━━━━━━━━━━━━⬣\n`;
      text += `┃ 📂 Categorías y Estado:\n`;
      categories.forEach((cat) => {
        const isDisabled = db.groups[remoteJid].disabledCategories.some(
          (c) => c.toLowerCase() === cat.toLowerCase(),
        );
        text += `┃ > ${isDisabled ? "❌" : "✅"} ${cat}\n`;
      });
      text += `╰━━━━━━━━━━━━⬣\n`;
      text += `\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    if (!category) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈́𝐀 𝐈𝐍𝐕𝐀́𝐋𝐈𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > La categoría *${rawCategory}*\n┃ > no existe.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
        },
        { quoted: message },
      );
    }

    if (protectedCategories.includes(category.toLowerCase())) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: "╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐀𝐂𝐂𝐈𝐎́𝐍 𝐏𝐑𝐎𝐇𝐈𝐁𝐈𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > No puedes desactivar las\n┃ > categorías de administración.\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
        },
        { quoted: message },
      );
    }

    if (["on", "1", "true", "activar", "enable"].includes(action)) {
      db.groups[remoteJid].disabledCategories = db.groups[
        remoteJid
      ].disabledCategories.filter(
        (c) => c.toLowerCase() !== category.toLowerCase(),
      );
      saveDB(db);
      let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ 🛡️ 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈́𝐀 𝐇𝐀𝐁𝐈𝐋𝐈𝐓𝐀𝐃𝐀\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > La categoría *${category}* ha\n`;
      text += `┃ > sido habilitada con éxito.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } else if (
      ["off", "0", "false", "desactivar", "disable"].includes(action)
    ) {
      const alreadyDisabled = db.groups[remoteJid].disabledCategories.some(
        (c) => c.toLowerCase() === category.toLowerCase(),
      );
      if (!alreadyDisabled) {
        db.groups[remoteJid].disabledCategories.push(category);
      }
      saveDB(db);
      let text = `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ 🛡️ 𝐂𝐀𝐓𝐄𝐆𝐎𝐑𝐈́𝐀 𝐁𝐋𝐎𝐐𝐔𝐄𝐀𝐃𝐀\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > La categoría *${category}* ha\n`;
      text += `┃ > sido bloqueada en este grupo.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },
};
