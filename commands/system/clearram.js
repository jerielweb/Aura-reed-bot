import { fytBold } from "../../models/TextStyle.js";

export default {
  name: ["clearram", "freeram", "cleanram"],
  category: "owner",
  description: "Fuerza al Garbage Collector a limpiar la memoria RAM sin apagar el bot.",
  ownerOnly: true,

  execute: async (socket, message, args) => {
    const remoteJid = message.key.remoteJid;
    const format = (bytes) => (bytes / 1024 / 1024).toFixed(2) + " MB";

    const before = process.memoryUsage().rss;
    let gcExposed = false;

    try {
      if (global.gc) {
        global.gc();
        gcExposed = true;
      }
    } catch (e) {}

    const after = process.memoryUsage().rss;
    const freed = before - after;

    let text = `╭〔 🧠 ${fytBold("AURA REED RAM")} 〕⬣\n\n`;
    text += `┃ 🔹 Uso anterior: ${format(before)}\n`;
    text += `┃ 🔹 Uso actual: ${format(after)}\n`;
    text += `┃ ♻️ Liberado: ${freed > 0 ? format(freed) : "0.00 MB"}\n\n`;

    if (!gcExposed) {
      text += `┃ ⚠️ ${fytBold("ADVERTENCIA")}\n`;
      text += `┃ > El Garbage Collector está bloqueado.\n`;
      text += `┃ > Ve al panel Pterodactyl y cambia el\n`;
      text += `┃ > comando de inicio a:\n`;
      text += `┃ > node --expose-gc index.js\n\n`;
    }

    text += `╰━━〔 ⚡ ${fytBold("SYSTEM")} 〕━━⬣`;

    await socket.sendMessage(remoteJid, { text }, { quoted: message });
  },
};

