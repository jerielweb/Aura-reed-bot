import formatNumber from "../../controllers/functions/formatNumbers.js";
import { economyTexts } from "../../models/economyTexts.js";
import { getGroupUser } from "../../models/groupDb.js";

export default {
  name: ["adventure", "aventura", "explorar"],
  category: "economy",
  description:
    "Embárcate en una misión RPG para conseguir XP, monedas y botín legendario.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const user = getGroupUser(
      db,
      remoteJid,
      message.key.participant || message.key.remoteJid,
      { coins: 0, bank: 0, xp: 0, lastAdventure: 0 },
    );

    // Cooldown de 2 horas (2 * 60 * 60 * 1000)
    const tiempoCooldown = 2 * 60 * 60 * 1000;

    // 1. Verificar Cooldown (lastAdventure)
    if (
      user.lastAdventure &&
      Date.now() - user.lastAdventure < tiempoCooldown
    ) {
      const timeLeft = tiempoCooldown - (Date.now() - user.lastAdventure);
      const horas = Math.floor(timeLeft / (60 * 60 * 1000));
      const minutos = Math.floor((timeLeft % (60 * 60 * 1000)) / (60 * 1000));
      const segundos = Math.floor((timeLeft % (60 * 1000)) / 1000);

      let menuCooldown = `╭〔 ⏳ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      menuCooldown += `┃ 𝐒𝐓𝐀𝐌𝐈𝐍𝐀 𝐈𝐍𝐒𝐔𝐅𝐈𝐂𝐈𝐄𝐍𝐓𝐄\n`;
      menuCooldown += `╰━━━━━━━━━━━━⬣\n\n`;
      menuCooldown += `┃ ❌ Tu héroe está descansando en la taberna.\n`;
      menuCooldown += `┃ > Cooldown: *${horas}h ${minutos}m ${segundos}s* para tu siguiente Raid.\n\n`;
      menuCooldown += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      return await socket.sendMessage(
        remoteJid,
        { text: menuCooldown },
        { quoted: message },
      );
    }

    // 2. Probabilidades y Rangos (Mismo formato que el minado)
    const ganoDinero = Math.random() > 0.3; // 70% de éxito
    const xpGanado = Math.floor(Math.random() * (80 - 40 + 1)) + 40; // Otorga entre 40 y 80 de XP

    let monedasGanadas = 0;
    let monedasLegendarias = 0;
    let recompensaLegendaria = null;
    let textoResultado = "";

    if (ganoDinero) {
      // Rango de monedas de aventura: entre 5,000 y 10,000 monedas
      monedasGanadas = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
      const listaExitos = economyTexts.adventure.success;
      const textoAzar =
        listaExitos[Math.floor(Math.random() * listaExitos.length)];
      textoResultado = `┃ ⚔️ ${textoAzar} +${formatNumber(monedasGanadas)} Monedas 💰\n`;
    } else {
      const listaFallos = economyTexts.adventure.fail;
      const textoAzar =
        listaFallos[Math.floor(Math.random() * listaFallos.length)];
      // No muestra "+0" igual que en mine
      textoResultado = `┃ 🛡️ ${textoAzar}\n`;
    }

    // 5% de probabilidad de Objeto Legendario RPG
    if (Math.random() <= 0.05) {
      const itemsLegendarios = [
        "🔥 Fragmento de Excalibur",
        "🛡️ Escudo de Aegis",
        "💍 Anillo del Señor Oscuro",
        "📜 Hechizo Prohibido",
      ];
      recompensaLegendaria =
        itemsLegendarios[Math.floor(Math.random() * itemsLegendarios.length)];
      // Rango legendario extra entre 20,000 y 50,000 monedas
      monedasLegendarias =
        Math.floor(Math.random() * (100000 - 40000 + 1)) + 40000;
    }

    // 3. Guardar en Base de Datos
    user.lastAdventure = Date.now();
    user.xp = (user.xp || 0) + xpGanado;
    const totalAAsignar = monedasGanadas + monedasLegendarias;
    if (totalAAsignar > 0) {
      user.coins = (user.coins || 0) + totalAAsignar;
    }
    saveDB(db);

    // 4. Diseño Visual RPG con estructura +=
    let menuTexto = `╭〔 🗺️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
    menuTexto += `┃ 𝐌𝐈𝐒𝐈𝐎́𝐍 𝐃𝐄 𝐀𝐕𝐄𝐍𝐓𝐔𝐑𝐀\n`;
    menuTexto += `╰━━━━━━━━━━━━⬣\n\n`;
    menuTexto += `┃ 🎮 Iniciando secuencia de exploración...\n\n`;
    menuTexto += `┃ ✨ EXP Recibida: +${xpGanado}\n`;
    menuTexto += textoResultado;

    if (recompensaLegendaria) {
      menuTexto += `\n╰━━━━ ⭐ ¡𝐋𝐎𝐎𝐓 𝐋𝐄𝐆𝐄𝐍𝐃𝐀𝐑𝐈𝐎! ⭐ ━━⬣\n`;
      menuTexto += `┃ 🎁 ¡DROP EXCEPCIONAL (0.05%)!\n`;
      menuTexto += `┃ 🔍 Item: *${recompensaLegendaria}*\n`;
      menuTexto += `┃ 💰 Oro de bonificación: +${formatNumber(monedasLegendarias)} Monedas\n`;
    }

    menuTexto += `\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text: menuTexto },
      { quoted: message },
    );
  },
};
