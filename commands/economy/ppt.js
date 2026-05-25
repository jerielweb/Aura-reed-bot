import formatNumber from '../../controllers/functions/formatNumbers.js';
import fs from 'fs';
import path from 'path';

const opciones = ['piedra', 'papel', 'tijera'];
const emojis = { piedra: '🪨', papel: '📄', tijera: '✂️' };

const dbPath = path.join(process.cwd(), 'database', 'groups.json');

export default {
    name: ['ppt', 'juego', 'rps', 'desafio', 'retar'],
    category: 'economy',
    description: 'Juega a Piedra, Papel o Tijera contra Aura Reed con premios random.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;
        const eleccionUsuario = args[0]?.toLowerCase();

        // 0. Validar cooldown de 10 minutos
        try {
            const dbData = JSON.parse(await fs.promises.readFile(dbPath, 'utf-8'));
            const ahora = Date.now();
            const lastPPT = dbData.groups?.[remoteJid]?.users?.[sender]?.lastPPT || 0;
            const cooldownMs = 10 * 60 * 1000; // 10 minutos en milisegundos
            const tiempoRestante = lastPPT + cooldownMs - ahora;

            if (tiempoRestante > 0) {
                const minutos = Math.floor(tiempoRestante / 60000);
                const segundos = Math.floor((tiempoRestante % 60000) / 1000);
                return await socket.sendMessage(remoteJid, {
                    text: `╭〔 ⏱️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ⏳ 𝐄𝐍 𝐂𝐎𝐎𝐋𝐃𝐎𝐖𝐍\n╰━━━━━━━━━━━━⬣\n┃ > Espera ${minutos}m ${segundos}s para jugar de nuevo.\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`
                }, { quoted: message });
            }
        } catch (err) {
            console.error('Error verificando cooldown en ppt.js:', err);
        }

        // 1. Validar entrada
        if (!eleccionUsuario || !opciones.includes(eleccionUsuario)) {
            return await socket.sendMessage(remoteJid, {
                text: `╭〔 🎮 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐄𝐋𝐄𝐂𝐂𝐈Ó𝐍 𝐈𝐍𝐕Á𝐋𝐈𝐃𝐀\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, Elige una opción válida:\n┃ > *#ppt piedra*\n┃ > *#ppt papel*\n┃ > *#ppt tijera*\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`
            }, { quoted: message });
        }

        const eleccionBot = opciones[Math.floor(Math.random() * opciones.length)];
        let resultado = '';
        let monedasGanadas = 0;

        // 2. Lógica del juego
        if (eleccionUsuario === eleccionBot) {
            resultado = '¡𝐄𝐒 𝐔𝐍 𝐄𝐌𝐏𝐀𝐓𝐄! 🤝\n┃ > No dejes que Aura te gane.';
        } else if (
            (eleccionUsuario === 'piedra' && eleccionBot === 'tijera') ||
            (eleccionUsuario === 'papel' && eleccionBot === 'piedra') ||
            (eleccionUsuario === 'tijera' && eleccionBot === 'papel')
        ) {
            monedasGanadas = Math.floor(Math.random() * (1500 - 100 + 1)) + 100;
            const monedasFormateadas = formatNumber(monedasGanadas);
            resultado = `¡𝐇𝐀𝐒 𝐆𝐀𝐍𝐀𝐃𝐎! 🎉\n┃ > Recompensa: +${monedasFormateadas} Monedas 💰`;
        } else {
            resultado = '¡𝐇𝐀𝐒 𝐏𝐄𝐑𝐃𝐈𝐃𝐎! ❌\n┃ > Aura Reed leyó tus movimientos.';
        }

        // 3. Guardar en la base de datos (cooldown + monedas si ganó)
        try {
            const dbData = JSON.parse(await fs.promises.readFile(dbPath, 'utf-8'));

            if (dbData.groups?.[remoteJid]) {
                if (!dbData.groups[remoteJid].users) dbData.groups[remoteJid].users = {};
                if (!dbData.groups[remoteJid].users[sender]) dbData.groups[remoteJid].users[sender] = {};

                // Siempre guardar el cooldown
                dbData.groups[remoteJid].users[sender].lastPPT = Date.now();

                // Solo actualizar monedas si ganó
                if (monedasGanadas > 0) {
                    const monedasActuales = dbData.groups[remoteJid].users[sender].coins || 0;
                    dbData.groups[remoteJid].users[sender].coins = monedasActuales + monedasGanadas;
                }

                await fs.promises.writeFile(dbPath, JSON.stringify(dbData, null, 2));
            }
        } catch (err) {
            console.error('Error actualizando datos en ppt.js:', err);
        }

        // 4. Tu diseño de menú de texto exacto
        let menuTexto = `╭〔 🎮 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
        menuTexto += `┃ 𝐏𝐈𝐄𝐃𝐑𝐀, 𝐏𝐀𝐏𝐄𝐋 𝐎 𝐓𝐈𝐉𝐄𝐑𝐀\n`;
        menuTexto += `╰━━━━━━━━━━━━⬣\n\n`;
        menuTexto += `┃ 👤 Tu elección: ${emojis[eleccionUsuario]} *${eleccionUsuario.toUpperCase()}*\n`;
        menuTexto += `┃ 🤖 Aura Reed: ${emojis[eleccionBot]} *${eleccionBot.toUpperCase()}*\n\n`;
        menuTexto += `╰━━━━━━━━━━━━⬣\n`;
        menuTexto += `┃  ${resultado}\n`;
        menuTexto += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

        await socket.sendMessage(remoteJid, { text: menuTexto }, { quoted: message });
    }
};