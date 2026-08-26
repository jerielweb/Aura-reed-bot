import fs from "fs";
import { fytBold } from "../../models/TextStyle.js";

const badWordsData = JSON.parse(
  fs.readFileSync("./database/badWords.json", "utf-8"),
);

for (const level of Object.values(badWordsData.levels)) {
  level.normalizedWords = level.words.map((w) => ({
    full: normalizeText(w),
  }));
}

export default {
  name: ["antitoxic", "antitoxicos", "antitx"],
  category: "group",
  description: "Sistema anti-toxicidad.",
  adminOnly: true,

  execute: async (socket, message, args, { db, saveDB }) => {
    const remoteJid = message.key.remoteJid;
    if (!remoteJid.endsWith("@g.us")) {
      let text = `╭〔 ❌ ${fytBold("AURA REED")} 〕⬣\n`;
      text += `┃ ${fytBold("ACCION INCONPATIBLE")} \n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > Este comando solo funciona en grupos.\n\n`;
      text += `╰〔 ⚡ ${fytBold("SYSTEM ALERT")} 〕⬣`;

      return await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }

    if (!db.groups[remoteJid]) {
      db.groups[remoteJid] = {
        antilink: false,
        warnLimit: 3,
        warns: {},
        activity: {},
        onlyAdmin: false,
        antitoxic: false,
        botOn: true,
      };
    }

    const status = args[0]?.toLowerCase();

    if (
      status === "on" ||
      status === "1" ||
      status === "true" ||
      status === "activar" ||
      status === "enable"
    ) {
      db.groups[remoteJid].antitoxic = true;
      saveDB(db);

      let text = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ 🛡️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈𝐓𝐎𝐗𝐈𝐂\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > El sistema Antitoxic ha\n`;
      text += `┃ > sido activado con éxito.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } else if (
      status === "off" ||
      status === "0" ||
      status === "false" ||
      status === "desactivar" ||
      status === "disable"
    ) {
      db.groups[remoteJid].antitoxic = false;
      saveDB(db);

      let text = `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ 🛡️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈𝐓𝐎𝐗𝐈𝐂\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ > El sistema Antitoxic ha\n`;
      text += `┃ > sido desactivado con éxito.\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    } else {
      const currentStatus = db.groups[remoteJid]?.antitoxic
        ? "✅ Activado"
        : "❌ Desactivado";

      let text = `╭〔 🛡️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      text += `┃ ⚙️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐀𝐍𝐓𝐈𝐓𝐎𝐗𝐈𝐂\n`;
      text += `╰━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ℹ️ Estado actual: ${currentStatus}\n\n`;
      text += `┣━━━━━━━━━━━━⬣\n\n`;
      text += `┃ ➪ .antitoxic on\n`;
      text += `┃ ✦ Activar sistema antitoxic\n\n`;
      text += `┃ ➪ .antitoxic off\n`;
      text += `┃ ✦ Desactivar sistema antitoxic\n\n`;
      text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
  },

  middleware: async (socket, m, { db, saveDB, isAdmin, isBotAdmin, text }) => {
    const remoteJid = m.key.remoteJid;
    if (!remoteJid.endsWith("@g.us") || !db.groups[remoteJid]?.antitoxic)
      return;

    if (m.key.fromMe || m.key.participant === socket.user?.id) return;

    const prefix = db.groups?.[remoteJid]?.prefix || db.prefix;
    if (!text || text.startsWith(prefix)) return;

    if (isAdmin || !isBotAdmin) return;

    const normalizedText = normalizeText(text);
    const reversedText = normalizedText.split("").reverse().join("");

    for (const level of Object.values(badWordsData.levels)) {
      for (const wordObj of level.normalizedWords) {
        if (
          normalizedText.includes(wordObj.full) ||
          reversedText.includes(wordObj.full)
        ) {
          console.log(
            `[ANTITOXIC] Detectado: "${wordObj.full}" en "${text}" (Nivel: ${level.reason})`,
          );
          await handleToxic(socket, m, level, db, saveDB, text);
          return;
        }
      }
    }
  },
};

function normalizeText(text) {
  if (!text) return "";
  let normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .replace(/\s+/g, "");

  return normalized;
}

async function handleToxic(socket, m, level, db, saveDB, userMessage) {
  const remoteJid = m.key.remoteJid;
  const user = m.key.participant || remoteJid;
  const reason = level.reason;

  try {
    await socket.sendMessage(remoteJid, { delete: m.key });
  } catch (e) {}

  if (!db.groups[remoteJid].warns) db.groups[remoteJid].warns = {};
  if (!db.groups[remoteJid].warns[user])
    db.groups[remoteJid].warns[user] = [];

  const date = new Date().toLocaleDateString("es-CR", {
    timeZone: "America/Costa_Rica",
  });
  
  db.groups[remoteJid].warns[user].push({
    reason: `Toxicidad: ${reason}`,
    date,
  });
  saveDB(db);

  const limit = db.groups[remoteJid].warnLimit || 3;
  const count = db.groups[remoteJid].warns[user].length;
  const botJid = socket.user.id.split(":")[0] + "@s.whatsapp.net";

  let responseText = `╭〔 ⚠️ ${fytBold("ANTI-TOXIC SYSTEM")} 〕⬣\n`;
  responseText += `┃ 👤 Usuario: @${user.split("@")[0]}\n`;
  responseText += `┃ 💬 Dijo: "${userMessage || ""}"\n`;
  responseText += `┃ 🛡️ Admin: 𝐒𝐘𝐒𝐓𝐄𝐌 ⚡\n`;
  responseText += `┃ 📌 Acción: Advertencia agregada\n`;
  responseText += `┃ 📊 Warns: [ ${count}/${limit} ]\n`;
  responseText += `┃ 📝 Razón: ${reason}\n`;
  responseText += `┃ ⏰ Fecha: ${date}\n\n`;
  responseText += `┣━━━━━━━━━━━━━━━━⬣\n\n`;
  responseText += `┃ ⚠️ Se ha añadido una\n`;
  responseText += `┃ ⚠️ advertencia al usuario.\n`;
  responseText += `┣━━━━━━━━━━━━━━━━⬣\n\n`;
  responseText += `┃ ❗ El mensaje infractor\n`;
  responseText += `┃ ❗ ha sido eliminado.\n\n`;
  responseText += `╰〔 ${fytBold("SYSTEM ACTIVE")} 〕⬣`;

  await socket.sendMessage(remoteJid, { text: responseText, mentions: [user, botJid] });
}
