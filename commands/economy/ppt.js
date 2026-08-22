import { jidNormalizedUser } from "@whiskeysockets/baileys";
import formatNumber from "../../controllers/functions/formatNumbers.js";
import { getGroupUser } from "../../models/groupDb.js";

const opciones = ["piedra", "papel", "tijera"];
const emojis = { piedra: "🪨", papel: "📄", tijera: "✂️" };

export default {
  name: ["ppt", "juego", "rps", "desafio", "retar"],
  category: "economy",
  description:
    "Juega a Piedra, Papel o Tijera contra Aura Reed con premios random.",
  execute: async (
    socket,
    message,
    args,
    { db, saveDB, jidRemitente, prefix },
  ) => {
    const remoteJid = message.key.remoteJid;
    const participantJid = jidRemitente;

    const user = getGroupUser(db, remoteJid, participantJid, {
      coins: 0,
      bank: 0,
      lastPpt: 0,
    });
    const eleccionUsuario = args[0]?.toLowerCase();
    const now = Date.now();
    const cooldown = 10 * 60 * 1000; // 10 minutos

    // Validar cooldown
    if (user.lastPpt && now - user.lastPpt < cooldown) {
      const timeLeft = cooldown - (now - user.lastPpt);
      const minutes = Math.floor(timeLeft / 60000);
      const seconds = Math.floor((timeLeft % 60000) / 1000);
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 ⏱️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⏳ 𝐄𝐍 𝐂𝐎𝐎𝐋𝐃𝐎𝐖𝐍\n╰━━━━━━━━━━━━⬣\n┃ > Espera ${minutes}m ${seconds}s para jugar de nuevo.\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
        },
        { quoted: message },
      );
    }

    // 1. Validar entrada
    if (!eleccionUsuario || !opciones.includes(eleccionUsuario)) {
      return await socket.sendMessage(
        remoteJid,
        {
          text: `╭〔 🎮 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐄𝐋𝐄𝐂𝐂𝐈Ó𝐍 𝐈𝐍𝐕Á𝐋𝐈𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, Elige una opción válida:\n┃ > *${prefix}ppt piedra*\n┃ > *${prefix}ppt papel*\n┃ > *${prefix}ppt tijera*\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
        },
        { quoted: message },
      );
    }

    const eleccionBot = opciones[Math.floor(Math.random() * opciones.length)];
    let resultado = "";
    let monedasGanadas = 0;

    // 2. Lógica del juego
    if (eleccionUsuario === eleccionBot) {
      resultado = "¡𝐄𝐒 𝐔𝐍 𝐄𝐌𝐏𝐀𝐓𝐄! 🤝\n┃ > No dejes que Aura te gane.";
    } else if (
      (eleccionUsuario === "piedra" && eleccionBot === "tijera") ||
      (eleccionUsuario === "papel" && eleccionBot === "piedra") ||
      (eleccionUsuario === "tijera" && eleccionBot === "papel")
    ) {
      monedasGanadas = Math.floor(Math.random() * (1500 - 100 + 1)) + 100;
      const monedasFormateadas = formatNumber(monedasGanadas);
      resultado = `¡𝐇𝐀𝐒 𝐆𝐀𝐍𝐀𝐃𝐎! 🎉\n┃ > Recompensa: +${monedasFormateadas} Monedas 💰`;
    } else {
      resultado = "¡𝐇𝐀𝐒 𝐏𝐄𝐑𝐃𝐈𝐃𝐎! ❌\n┃ > Aura Reed leyó tus movimientos.";
    }

    // 3. Siempre guardar el cooldown
    user.lastPpt = now;

    // Solo actualizar monedas si ganó
    if (monedasGanadas > 0) {
      user.coins = (user.coins || 0) + monedasGanadas;
    }

    saveDB(db);

    // 4. Tu diseño de menú de texto exacto
    let menuTexto = `╭〔 🎮 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
    menuTexto += `┃ 𝐏𝐈𝐄𝐃𝐑𝐀, 𝐏𝐀𝐏𝐄𝐋 𝐎 𝐓𝐈𝐉𝐄𝐑𝐀\n`;
    menuTexto += `╰━━━━━━━━━━━━⬣\n\n`;
    menuTexto += `┃ 👤 Tu elección: ${emojis[eleccionUsuario]} *${eleccionUsuario.toUpperCase()}*\n`;
    menuTexto += `┃ 🤖 Aura Reed: ${emojis[eleccionBot]} *${eleccionBot.toUpperCase()}*\n\n`;
    menuTexto += `╰━━━━━━━━━━━━⬣\n`;
    menuTexto += `┃  ${resultado}\n`;
    menuTexto += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text: menuTexto },
      { quoted: message },
    );
  },
};
