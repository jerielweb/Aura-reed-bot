import formatNumber from '../../controllers/functions/formatNumbers.js';
import { economyTexts } from '../../models/economyTexts.js';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database', 'groups.json');

export default {
    name: ['mine', 'minar', 'chambear'],
    category: 'economy',
    description: 'Mina en las cuevas para conseguir XP, monedas y tal vez algo legendario.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        // Tiempo de cooldown en milisegundos (30 minutos = 30 * 60 * 1000)
        const tiempoCooldown = 30 * 60 * 1000;

        // 1. Verificar Cooldown leyendo el archivo primero
        try {
            const dbData = JSON.parse(await fs.promises.readFile(dbPath, 'utf-8'));

            if (dbData.groups?.[remoteJid]?.users?.[sender]) {
                const usuario = dbData.groups[remoteJid].users[sender];
                const ultimoMinado = usuario.lastMine || 0; // Usamos lastMine para no chocar con lastWork
                const tiempoRestante = (ultimoMinado + tiempoCooldown) - Date.now();

                if (tiempoRestante > 0) {
                    // Convertir milisegundos restantes a minutos y segundos reales
                    const minutos = Math.floor(tiempoRestante / (60 * 1000));
                    const segundos = Math.floor((tiempoRestante % (60 * 1000)) / 1000);

                    let menuCooldown = `╭〔 ⏳ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
                    menuCooldown += `┃ 𝐂𝐎𝐎𝐋𝐃𝐎𝐖𝐍 𝐀𝐂𝐓𝐈𝐕𝐎\n`;
                    menuCooldown += `╰━━━━━━━━━━━━⬣\n\n`;
                    menuCooldown += `┃ ⏱️ ¡Agotado! Tus brazos necesitan descansar.\n`;
                    menuCooldown += `┃ > Espera: *${minutos}m ${segundos}s* para volver al pozo.\n\n`;
                    menuCooldown += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

                    return await socket.sendMessage(remoteJid, { text: menuCooldown }, { quoted: message });
                }
            }
        } catch (err) {
            console.error('Error verificando cooldown en mine.js:', err);
        }

        // 2. Probabilidades y Rangos del comando si no hay cooldown
        const ganoDinero = Math.random() > 0.3; // 70% de probabilidad de ganar dinero
        const xpGanado = Math.floor(Math.random() * (50 - 20 + 1)) + 20; // Siempre gana entre 20 y 50 de XP
        
        let monedasGanadas = 0;
        let monedasLegendarias = 0;
        let recompensaLegendaria = null;
        let textoResultado = '';

        if (ganoDinero) {
            monedasGanadas = Math.floor(Math.random() * (10000 - 5000 + 1)) + 5000;
            
            const listaExitos = economyTexts.mine.success;
            const textoAzar = listaExitos[Math.floor(Math.random() * listaExitos.length)];
            textoResultado = `┃ ⛏️ ${textoAzar} +${formatNumber(monedasGanadas)} Monedas 💰\n`;
        } else {
            const listaFallos = economyTexts.mine.fail;
            const textoAzar = listaFallos[Math.floor(Math.random() * listaFallos.length)];
            textoResultado = `┃ 🪵 ${textoAzar}\n`;
        }

        if (Math.random() <= 0.05) {
            const itemsLegendarios = ['💎 Diamante Perfecto', '👑 Corona Antigua', '⚔️ Espada de Runas', '🔮 Cristal de Aura'];
            recompensaLegendaria = itemsLegendarios[Math.floor(Math.random() * itemsLegendarios.length)];
            monedasLegendarias = Math.floor(Math.random() * (50000 - 20000 + 1)) + 20000;
        }

        // 3. Guardar Datos y Guardar la marca de tiempo actual (`lastMine`)
        try {
            const dbData = JSON.parse(await fs.promises.readFile(dbPath, 'utf-8'));

            if (dbData.groups?.[remoteJid]) {
                if (!dbData.groups[remoteJid].users) dbData.groups[remoteJid].users = {};
                if (!dbData.groups[remoteJid].users[sender]) dbData.groups[remoteJid].users[sender] = {};

                const usuario = dbData.groups[remoteJid].users[sender];

                // Guardar tiempo actual en milisegundos para bloquear el comando por 30m
                usuario.lastMine = Date.now();

                // Actualizar XP y monedas
                usuario.xp = (usuario.xp || 0) + xpGanado;

                const totalAAsignar = monedasGanadas + monedasLegendarias;
                if (totalAAsignar > 0) {
                    usuario.coins = (usuario.coins || 0) + totalAAsignar;
                }

                await fs.promises.writeFile(dbPath, JSON.stringify(dbData, null, 2));
            }
        } catch (err) {
            console.error('Error actualizando base de datos en mine.js:', err);
        }

        // 4. Armar el diseño visual con tu estructura de texto exacta con +=
        let menuTexto = `╭〔 ⚒️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
        menuTexto += `┃ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐃𝐄 𝐌𝐈𝐍𝐄𝐑Í𝐀\n`;
        menuTexto += `╰━━━━━━━━━━━━⬣\n\n`;
        menuTexto += `┃ 👷‍♂️ Has ido a explorar las profundidades...\n\n`;
        menuTexto += `┃ ✨ XP Obtenido: +${xpGanado}\n`;
        menuTexto += textoResultado;

        if (recompensaLegendaria) {
            menuTexto += `\n╰━━━━ ⭐ ¡𝐋𝐄𝐆𝐄𝐍𝐃𝐀𝐑block𝐈𝐎! ⭐ ━━⬣\n`;
            menuTexto += `┃ 🎁 ¡SUERTE SUPREMA!\n`;
            menuTexto += `┃ 🔍 Encontraste un objeto único:\n`;
            menuTexto += `┃ > *${recompensaLegendaria}*\n`;
            menuTexto += `┃ 💰 Valor legendario: +${formatNumber(monedasLegendarias)} Monedas\n`;
        }

        menuTexto += `\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

        await socket.sendMessage(remoteJid, { text: menuTexto }, { quoted: message });
    }
};