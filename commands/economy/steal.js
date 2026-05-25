import formatNumber from '../../controllers/functions/formatNumbers.js';
import fs from 'fs';
import path from 'path';

const dbPath = path.join(process.cwd(), 'database', 'groups.json');

export default {
    name: ['steal', 'robar'],
    category: 'economy',
    description: 'Intenta robarle AuraCoins a otro usuario de su cartera.',
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        const sender = message.key.participant || message.key.remoteJid;

        // 1. Validar que se haya mencionado a alguien
        const mencionado = message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
        if (!mencionado) {
            return await socket.sendMessage(remoteJid, { text: `⚠️ Debes mencionar a un usuario con *@tag* para robarle.` }, { quoted: message });
        }

        if (mencionado === sender) {
            return await socket.sendMessage(remoteJid, { text: `🧠 No puedes robarte a ti mismo.` }, { quoted: message });
        }

        const cooldownHora = 60 * 60 * 1000; // 1 hora de cooldown

        try {
            const dbData = JSON.parse(await fs.promises.readFile(dbPath, 'utf-8'));
            const grupo = dbData.groups?.[remoteJid];

            if (!grupo) return;

            if (!grupo.users) grupo.users = {};
            if (!grupo.users[sender]) grupo.users[sender] = {};
            if (!grupo.users[mencionado]) grupo.users[mencionado] = {};

            const ladron = grupo.users[sender];
            const victima = grupo.users[mencionado];

            // 2. Verificar Cooldown del ladrón (Usando lastSteal)
            const ultimoRobo = ladron.lastSteal || 0;
            const tiempoRestante = (ultimoRobo + cooldownHora) - Date.now();

            if (tiempoRestante > 0) {
                const minutos = Math.floor(tiempoRestante / (60 * 1000));
                const segundos = Math.floor((tiempoRestante % (60 * 1000)) / 1000);

                let menuCooldown = `╭〔 ⏳ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
                menuCooldown += `┃ 𝐂𝐎𝐎𝐋𝐃𝐎𝐖𝐍 𝐀𝐂𝐓𝐈𝐕𝐎\n`;
                menuCooldown += `╰━━━━━━━━━━━━⬣\n\n`;
                menuCooldown += `┃ ⏱️ La policía te está buscando. Mantén un perfil bajo.\n`;
                menuCooldown += `┃ > Espera: *${minutos}m ${segundos}s* para volver a las andadas.\n\n`;
                menuCooldown += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

                return await socket.sendMessage(remoteJid, { text: menuCooldown }, { quoted: message });
            }

            // 3. Verificar si la víctima tiene monedas sueltas en su cartera
            const monedasVictima = victima.coins || 0;
            if (monedasVictima < 500) {
                return await socket.sendMessage(remoteJid, { text: `🪵 La cartera de este usuario está vacía o tiene menos de ₡500. ¡No vale la pena el riesgo!` }, { quoted: message });
            }

            // Registrar el tiempo actual del intento de robo
            ladron.lastSteal = Date.now();

            // 4. Lógica de éxito o fracaso (40% de éxito)
            const exito = Math.random() <= 0.40;
            let menuTexto = `╭〔 👤 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            menuTexto += `┃ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐃𝐄 𝐀𝐒𝐀𝐋𝐓𝐎𝐒\n`;
            menuTexto += `╰━━━━━━━━━━━━⬣\n\n`;

            if (exito) {
                // Roba un porcentaje aleatorio entre el 10% y el 35% de lo que tiene la víctima en su cartera
                const porcentaje = Math.random() * (0.35 - 0.10) + 0.10;
                const monedasRobadas = Math.floor(monedasVictima * porcentaje);

                // Actualizar saldos en la base de datos
                victima.coins = monedasVictima - monedasRobadas;
                ladron.coins = (ladron.coins || 0) + monedasRobadas;

                menuTexto += `┃ ⚔️ ¡Asalto exitoso!\n`;
                menuTexto += `┃ 🥷 Te escabulliste sigilosamente y extrajiste dinero de la billetera de *@${mencionado.split('@')[0] || ''}*.\n\n`;
                menuTexto += `┃ 💰 Botín conseguido: +${formatNumber(monedasRobadas)} Monedas\n`;
            } else {
                // Penalización por fallar: El ladrón pierde un monto aleatorio entre 2,000 y 5,000 monedas por concepto de fianza
                const multa = Math.floor(Math.random() * (5000 - 2000 + 1)) + 2000;
                const monedasLadron = ladron.coins || 0;
                
                // Restar la fianza (puede quedar en 0 si no tiene suficiente)
                ladron.coins = Math.max(0, monedasLadron - multa);

                menuTexto += `┃ 🚨 ¡El plan falló!\n`;
                menuTexto += `┃ 👮‍♂️ *@${mencionado.split('@')[0] || ''}* se dio cuenta y alertó a los guardias locales.\n\n`;
                menuTexto += `┃ 💸 Tuviste que pagar una fianza de escape de: -${formatNumber(multa)} Monedas\n`;
            }

            menuTexto += `\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

            // Guardar cambios en el JSON
            await fs.promises.writeFile(dbPath, JSON.stringify(dbData, null, 2));

            // Enviar mensaje mencionando a la víctima
            await socket.sendMessage(remoteJid, { 
                text: menuTexto, 
                contextInfo: { mentionedJid: [mencionado] } 
            }, { quoted: message });

        } catch (err) {
            console.error('Error ejecutando steal.js:', err);
        }
    }
};