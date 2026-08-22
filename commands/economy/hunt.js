import { jidNormalizedUser } from "@whiskeysockets/baileys";
import formatNumber from "../../controllers/functions/formatNumbers.js";
import { economyTexts } from "../../models/economyTexts.js";
import { getGroupUser } from "../../models/groupDb.js";
import { getDBSync } from "../../models/db.js";

export default {
  name: ["hunt", "cazar", "caza"],
  category: "economy",
  description:
    "Entra en combate contra entidades y brawlers para obtener XP, monedas y drops legendarios.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const participantJid = jidRemitente;

    // 1. Obtener datos locales de economía del grupo
    const userEconomy = getGroupUser(db, remoteJid, participantJid, {
      coins: 0,
      bank: 0,
      lastHunt: 0,
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

    if (userEconomy.lastHunt && now - userEconomy.lastHunt < cooldown) {
      const timeLeft = cooldown - (now - userEconomy.lastHunt);
      const minutes = Math.floor(timeLeft / (1000 * 60));
      const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

      let menuCooldown = `╭〔 ⏳ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
      menuCooldown += `┃ 🧑‍⚕️ 𝐂𝐄𝐍𝐓𝐑𝐎 𝐌𝐄́𝐃𝐈𝐂𝐎\n`;
      menuCooldown += `╰━━━━━━━━━━━━⬣\n\n`;
      menuCooldown += `┃ ❌ ¡Estás gravemente herido por tu última batalla!\n`;
      menuCooldown += `┃ > Tiempo para terminar de curarse: *${minutes}m ${seconds}s*\n\n`;
      menuCooldown += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

      return await socket.sendMessage(
        remoteJid,
        { text: menuCooldown },
        { quoted: message },
      );
    }

    // Probabilidades y Rangos
    const ganoDinero = Math.random() > 0.3; // 70% de probabilidad de ganar el combate
    const xpGanado = Math.floor(Math.random() * (50 - 20 + 1)) + 20; // Entre 20 y 50 de XP

    let monedasGanadas = 0;
    let monedasLegendarias = 0;
    let recompensaLegendaria = null;
    let textoResultado = "";

    if (ganoDinero) {
      monedasGanadas = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;

      const listaExitos = economyTexts.hunt.success;
      const textoAzar =
        listaExitos[Math.floor(Math.random() * listaExitos.length)];
      textoResultado = `┃ ⚔️ ${textoAzar} +${formatNumber(monedasGanadas)} Monedas 💰\n`;
    } else {
      const listaFallos = economyTexts.hunt.fail;
      const textoAzar =
        listaFallos[Math.floor(Math.random() * listaFallos.length)];
      textoResultado = `┃ 🩸 ${textoAzar}\n`;
    }

    // Sistema de aventura: 5% de probabilidad de drop Legendario
    if (Math.random() <= 0.05) {
      const itemsLegendarios = [
        "📦 Caja Omega Abierta",
        "🛡️ Caparazón de Shulker",
        "🔑 Llave del Crucifijo",
        "👑 Aspecto Hipercarga",
      ];
      recompensaLegendaria =
        itemsLegendarios[Math.floor(Math.random() * itemsLegendarios.length)];
      monedasLegendarias =
        Math.floor(Math.random() * (50000 - 20000 + 1)) + 20000;
    }

    // 3. Guardar en Base de Datos (Economía local por grupo y XP global)
    userEconomy.lastHunt = now;

    // XP y Nivel se actualizan en el perfil global
    userGlobal.xp = (userGlobal.xp || 0) + xpGanado;
    userGlobal.level = Math.floor(userGlobal.xp / 150) + 1;

    // Sumar las monedas totales obtenidas a la economía local
    const totalAAsignar = monedasGanadas + monedasLegendarias;
    if (totalAAsignar > 0) {
      userEconomy.coins = (userEconomy.coins || 0) + totalAAsignar;
    }

    saveDB(db);

    // Armar el diseño visual
    let menuTexto = `╭〔 🏹 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
    menuTexto += `┃ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐃𝐄 𝐂𝐎𝐌𝐁𝐀𝐓𝐄\n`;
    menuTexto += `╰━━━━━━━━━━━━⬣\n\n`;
    menuTexto += `┃ 🕹️ Has entrado a la zona de combate...\n\n`;
    menuTexto += `┃ ✨ XP Ganado: +${xpGanado}\n`;
    menuTexto += textoResultado;

    // Bloque Extra Legendario
    if (recompensaLegendaria) {
      menuTexto += `\n╰━━━━ ⭐ ¡𝐃𝐑𝐎𝐏 𝐋𝐄𝐆𝐄𝐍𝐃𝐀𝐑𝐈𝐎! ⭐ ━━⬣\n`;
      menuTexto += `┃ 🎁 ¡RECOMPENSA DE EVENTO!\n`;
      menuTexto += `┃ 🔍 Encontraste un objeto único:\n`;
      menuTexto += `┃ > *${recompensaLegendaria}*\n`;
      menuTexto += `┃ 💰 Bonus de monedas: +${formatNumber(monedasLegendarias)} Monedas\n`;
    }

    menuTexto += `\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

    await socket.sendMessage(
      remoteJid,
      { text: menuTexto },
      { quoted: message },
    );
  },
};
