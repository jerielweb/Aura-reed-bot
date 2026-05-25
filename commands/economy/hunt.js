import formatNumber from '../../controllers/functions/formatNumbers.js';
import { economyTexts } from '../../models/economyTexts.js';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database', 'groups.json');

export default {
    name: ['hunt', 'cazar', 'caza'],
    category: 'economy',
    description: 'Entra en combate contra entidades y brawlers para obtener XP, monedas y drops legendarios.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        // Cooldown de 30 minutos en milisegundos (30 * 60 * 1000)
        const tiempoCooldown = 30 * 60 * 1000;

        // 1. Verificar Cooldown (Tiempo en curarse)
        try {
            const dbData = JSON.parse(await fs.promises.readFile(dbPath, 'utf-8'));

            if (dbData.groups?.[remoteJid]?.users?.[sender]) {
                const usuario = dbData.groups[remoteJid].users[sender];
                const ultimaCaza = usuario.lastHunt || 0;
                const tiempoRestante = (ultimaCaza + tiempoCooldown) - Date.now();

                if (tiempoRestante > 0) {
                    const minutos = Math.floor(tiempoRestante / (60 * 1000));
                    const segundos = Math.floor((tiempoRestante % (60 * 1000)) / 1000);

                    let menuCooldown = `╭〔 ⏳ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
                    menuCooldown += `┃ 🧑‍⚕️ 𝐂𝐄𝐍𝐓𝐑𝐎 𝐌𝐄́𝐃𝐈𝐂𝐎\n`;
                    menuCooldown += `╰━━━━━━━━━━━━⬣\n\n`;
                    menuCooldown += `┃ ❌ ¡Estás gravemente herido por tu última batalla!\n`;
                    menuCooldown += `┃ > Tiempo para terminar de curarse: *${minutos}m ${segundos}s*\n\n`;
                    menuCooldown += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

                    return await socket.sendMessage(remoteJid, { text: menuCooldown }, { quoted: message });
                }
            }
        } catch (err) {
            console.error('Error verificando cooldown en hunt.js:', err);
        }

        // 2. Probabilidades y Rangos
        const ganoDinero = Math.random() > 0.3; // 70% de probabilidad de ganar el combate
        const xpGanado = Math.floor(Math.random() * (50 - 20 + 1)) + 20; // Entre 20 y 50 de XP

        let monedasGanadas = 0;
        let monedasLegendarias = 0;
        let recompensaLegendaria = null;
        let textoResultado = '';

        if (ganoDinero) {
            // Rango normal: 5,000 a 10,000 monedas
            monedasGanadas = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;

            const listaExitos = economyTexts.hunt.success;
            const textoAzar = listaExitos[Math.floor(Math.random() * listaExitos.length)];
            textoResultado = `┃ ⚔️ ${textoAzar} +${formatNumber(monedasGanadas)} Monedas 💰\n`;
        } else {
            const listaFallos = economyTexts.hunt.fail;
            const textoAzar = listaFallos[Math.floor(Math.random() * listaFallos.length)];
            textoResultado = `┃ 🩸 ${textoAzar}\n`;
        }

        // Sistema de aventura: 5% de probabilidad de drop Legendario
        if (Math.random() <= 0.05) {
            const itemsLegendarios = ['📦 Caja Omega Abierta', '🛡️ Caparazón de Shulker', '🔑 Llave del Crucifijo', '👑 Aspecto Hipercarga'];
            recompensaLegendaria = itemsLegendarios[Math.floor(Math.random() * itemsLegendarios.length)];
            // Rango legendario extra: 20,000 a 50,000 monedas
            monedasLegendarias = Math.floor(Math.random() * (50000 - 20000 + 1)) + 20000;
        }

        // 3. Guardar en la Base de Datos (groups.json)
        try {
            const dbData = JSON.parse(await fs.promises.readFile(dbPath, 'utf-8'));

            if (dbData.groups?.[remoteJid]) {
                if (!dbData.groups[remoteJid].users) dbData.groups[remoteJid].users = {};
                if (!dbData.groups[remoteJid].users[sender]) dbData.groups[remoteJid].users[sender] = {};

                const usuario = dbData.groups[remoteJid].users[sender];

                // Guardar tiempo actual de la batalla
                usuario.lastHunt = Date.now();

                // Actualizar XP
                usuario.xp = (usuario.xp || 0) + xpGanado;

                // Sumar las monedas totales obtenidas
                const totalAAsignar = monedasGanadas + monedasLegendarias;
                if (totalAAsignar > 0) {
                    usuario.coins = (usuario.coins || 0) + totalAAsignar;
                }

                await fs.promises.writeFile(dbPath, JSON.stringify(dbData, null, 2));
            }
        } catch (err) {
            console.error('Error actualizando base de datos en hunt.js:', err);
        }

        // 4. Armar el diseño visual
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

        await socket.sendMessage(remoteJid, { text: menuTexto }, { quoted: message });
    }
};