import { stopSubBot } from "../../models/subbotManager.js";

export default {
  name: ["stopsub", "logoutsub", "detenersub"],
  category: "system",
  description: "Detiene y cierra la sesión de tu sub-bot.",
  execute: async (socket, message, args, { numeroReal, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const senderId = jidRemitente.split("@")[0].split(":")[0];

    await socket.sendMessage(
      remoteJid,
      { text: "🔄 Intentando detener tu sub-bot y cerrar la sesión..." },
      { quoted: message },
    );

    try {
      const success = await stopSubBot(senderId);
      if (success) {
        await socket.sendMessage(
          remoteJid,
          {
            text: "╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ 🔌 𝐒𝐔𝐁-𝐁𝐎𝐓 𝐃𝐄𝐓𝐄𝐍𝐈𝐃𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ > Tu sub-bot ha sido detenido\n┃ > y la sesión fue eliminada correctamente\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
          },
          { quoted: message },
        );
      } else {
        await socket.sendMessage(
          remoteJid,
          {
            text: "╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ 🔌 𝐒𝐔𝐁-𝐁𝐎𝐓 𝐍𝐎 𝐃𝐄𝐓𝐄𝐍𝐈𝐃𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ > No se encontró una sesión activa de sub-bot para tu número.\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
          },
          { quoted: message },
        );
      }
    } catch (error) {
      console.error("Error en comando stopsub:", error);
      await socket.sendMessage(
        remoteJid,
        {
          text: "╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ 🔌 𝐒𝐔𝐁-𝐁𝐎𝐓 𝐍𝐎 𝐃𝐄𝐓𝐄𝐍𝐈𝐃𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ > Ocurrió un error al intentar detener el sub-bot.\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣",
        },
        { quoted: message },
      );
    }
  },
};
