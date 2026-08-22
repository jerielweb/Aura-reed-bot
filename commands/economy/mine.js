import { jidNormalizedUser } from "@whiskeysockets/baileys";
import formatNumber from "../../controllers/functions/formatNumbers.js";
import { economyTexts } from "../../models/economyTexts.js";
import { getGroupUser } from "../../models/groupDb.js";
import { getDBSync } from "../../models/db.js";

export default {
  name: ["mine", "minar", "chambear"],
  category: "economy",
  description:
    "Mina en las cuevas para conseguir XP, monedas y tal vez algo legendario.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const participantJid = jidRemitente;

    // 1. Obtener datos locales de economía del grupo
    const userEconomy = getGroupUser(db, remoteJid, participantJid, {
      coins: 0,
      bank: 0,
      lastMine: 0,
    });

    // 2. Obtener datos globales del perfil (XP, nivel)
    const globalDb = getDBSync();
    if (!globalDb.users) globalDb.users = {};
    if (!globalDb.users[participantJid]) {
      globalDb.users[participantJid] = { xp: 0, level: 1 };
    }
    const userGlobal = globalDb.users[participantJid];

    const now = Date.now();
    const cooldown = 30 * 60 * 1000; // 30 minutos

    if (userEconomy.lastMine && now - userEconomy.lastMine < cooldown) {
      const timeLeft = cooldown - (now - userEconomy.lastMine);
      const minutes = Math.floor(timeLeft / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

      let menuCooldown = `╭〔 ⏳ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      menuCooldown += `┃ 𝐂𝐎𝐎𝐋𝐃𝐎𝐖𝐍 𝐀𝐂𝐓𝐈𝐕𝐎\n`;
      menuCooldown += `╰━━━━━━━━━━━━⬣\n\n`;
      menuCooldown += `┃ ⏱️ ¡Agotado! Tus brazos necesitan descansar.\n`;
      menuCooldown += `┃ > Espera: *${minutes}m ${seconds}s* para volver al pozo.\n\n`;
      menuCooldown += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      return await socket.sendMessage(
        remoteJid,
        { text: menuCooldown },
        { quoted: message },
      );
    }

    // Probabilidades y Rangos del comando si no hay cooldown
    const ganoDinero = Math.random() > 0.3; // 70% de probabilidad de ganar dinero
    const xpGanado = Math.floor(Math.random() * (50 - 20 + 1)) + 20; // Siempre gana entre 20 y 50 de XP

    let monedasGanadas = 0;
    let monedasLegendarias = 0;
    let recompensaLegendaria = null;
    let textoResultado = "";

    if (ganoDinero) {
      monedasGanadas = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;

      const listaExitos = economyTexts.mine.success;
      const textoAzar =
        listaExitos[Math.floor(Math.random() * listaExitos.length)];
      textoResultado = `┃ ⛏️ ${textoAzar} +${formatNumber(monedasGanadas)} Monedas 💰\n`;
    } else {
      const listaFallos = economyTexts.mine.fail;
      const textoAzar =
        listaFallos[Math.floor(Math.random() * listaFallos.length)];
      textoResultado = `┃ 🪵 ${textoAzar}\n`;
    }

    if (Math.random() <= 0.05) {
      const itemsLegendarios = [
        "💎 Diamante Perfecto",
        "👑 Corona Antigua",
        "⚔️ Espada de Runas",
        "🔮 Cristal de Aura",
      ];
      recompensaLegendaria =
        itemsLegendarios[Math.floor(Math.random() * itemsLegendarios.length)];
      monedasLegendarias =
        Math.floor(Math.random() * (50000 - 20000 + 1)) + 20000;
    }

    // 3. Guardar en Base de Datos (Economía local por grupo y XP global)
    userEconomy.lastMine = now;

    // XP y Nivel se actualizan en el perfil global
    userGlobal.xp = (userGlobal.xp || 0) + xpGanado;
    userGlobal.level = Math.floor(userGlobal.xp / 150) + 1;

    const totalAAsignar = monedasGanadas + monedasLegendarias;
    if (totalAAsignar > 0) {
      userEconomy.coins = (userEconomy.coins || 0) + totalAAsignar;
    }

    saveDB(db);

    // 4. Armar el diseño visual con tu estructura de texto exacta con +=
    let menuTexto = `╭〔 ⚒️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
    menuTexto += `┃ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐃𝐄 𝐌𝐈𝐍𝐄𝐑Í𝐀\n`;
    menuTexto += `╰━━━━━━━━━━━━⬣\n\n`;
    menuTexto += `┃ 👷‍♂️ Has ido a explorar las profundidades...\n\n`;
    menuTexto += `┃ ✨ XP Obtenido: +${xpGanado}\n`;
    menuTexto += textoResultado;

    if (recompensaLegendaria) {
      menuTexto += `\n╰━━━━ ⭐ ¡𝐋𝐄𝐆𝐄𝐍𝐃𝐀𝐑𝐈𝐎! ⭐ ━━⬣\n`;
      menuTexto += `┃ 🎁 ¡SUERTE SUPREMA!\n`;
      menuTexto += `┃ 🔍 Encontraste un objeto único:\n`;
      menuTexto += `┃ > *${recompensaLegendaria}*\n`;
      menuTexto += `┃ 💰 Valor legendario: +${formatNumber(monedasLegendarias)} Monedas\n`;
    }

    menuTexto += `\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text: menuTexto },
      { quoted: message },
    );
  },
};
