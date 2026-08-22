import Import formatNumber from "../../controllers/functions/formatNumbers.js";
import { economyTexts } from "../../models/economyTexts.js";
import { getGroupUser } from "../../models/groupDb.js";
import { getDBSync } from "../../models/db.js";

export default {
  name: ["adventure", "aventura", "explorar"],
  category: "economy",
  description:
    "Embárcate en una misión RPG para conseguir XP, monedas y botín legendario.",
  execute: async (socket, message, args, { db, saveDB, jidRemitente }) => {
    const remoteJid = message.key.remoteJid;
    const participantJid = message.key.participant || message.key.remoteJid;

    // 1. Obtener datos de economía locales del grupo
    const userEconomy = getGroupUser(
      db,
      remoteJid,
      participantJid,
      { coins: 0, bank: 0, lastAdventure: 0 },
    );

    // 2. Obtener datos globales del perfil (XP, nivel)
    const globalDb = getDBSync();
    if (!globalDb.users) globalDb.users = {};
    if (!globalDb.users[participantJid]) {
      globalDb.users[participantJid] = { xp: 0, level: 1 };
    }
    const userGlobal = globalDb.users[participantJid];

    // Cooldown de 2 horas (2 * 60 * 60 * 1000)
    const tiempoCooldown = 2 * 60 * 60 * 1000;

    // 3. Verificar Cooldown (lastAdventure)
    if (
      userEconomy.lastAdventure &&
      Date.now() - userEconomy.lastAdventure < tiempoCooldown
    ) {
      const timeLeft = tiempoCooldown - (Date.now() - userEconomy.lastAdventure);
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

    // 4. Probabilidades y Rangos
    const ganoDinero = Math.random() > 0.3; // 70% de éxito
    const xpGanado = Math.floor(Math.random() * (80 - 40 + 1)) + 40; // Otorga entre 40 y 80 de XP

    let monedasGanadas = 0;
    let monedasLegendarias = 0;
    let recompensaLegendaria = null;
    let textoResultado = "";

    if (ganoDinero) {
      monedasGanadas = Math.floor(Math.random() * (20000 - 10000 + 1)) + 10000;
      const listaExitos = economyTexts.adventure.success;
      const textoAzar =
        listaExits[Math.floor(Math.random() * listaExits.length)];
      textoResultado = `┃ ⚔️ ${textoAzar} +${formatNumber(monedasGanadas)} Monedas 💰\n`;
    } else {
      const listaFallos = economyTexts.adventure.fail;
      const textoAzar =
        listaFallos[Math.floor(Math.random() * listaFallos.length)];
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
      monedasLegendarias =
        Math.floor(Math.random() * (100000 - 40000 + 1)) + 40000;
    }

    // 5. Guardar en Base de Datos (Economía local por grupo y XP global)
    userEconomy.lastAdventure = Date.now();
    
    // XP y Nivel se actualizan en el perfil global
    userGlobal.xp = (userGlobal.xp || 0) + xpGanado;
    userGlobal.level = Math.floor(userGlobal.xp / 150) + 1;

    // Monedas se guardan en la economía local del grupo
    const totalAAsignar = monedasGanadas + monedasLegendarias;
    if (totalAAsignar > 0) {
      userEconomy.coins = (userEconomy.coins || 0) + totalAAsignar;
    }
    
    saveDB(db);

    // 6. Diseño Visual RPG con estructura +=
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
