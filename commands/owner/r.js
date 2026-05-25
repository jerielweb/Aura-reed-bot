import { exec } from 'child_process';
import { fytBold } from "../../models/TextStyle.js";

export default {
    name: ['r', 'run', 'exec', 'terminal'],
    category: 'owner',
    outerWidth: true,
    description: 'Ejecuta comandos en la terminal del servidor.',
    async execute(sock, m, args, { prefix }) {
        const remoteJid = m.key.remoteJid;
        const command = args.join(' ').trim();

        if (!command) {
            return await sock.sendMessage(remoteJid, {
                text: `╭〔 ⚠️ ${fytBold('AURA REED')} 〕⬣\n┃ ❌ ${fytBold('FALTA COMANDO')}\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, escribe el comando de terminal.\n┃ > Ejemplo: *${prefix}r pm2 restart all*\n\n╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣`
            }, { quoted: m });
        }

        // Reaccionar para indicar que se está procesando en la shell
        await sock.sendMessage(remoteJid, { react: { text: '💻', key: m.key } });

        exec(command, async (error, stdout, stderr) => {
            // Combinar la salida estándar y los errores si existen
            let respuestaTerminal = '';
            if (stdout) respuestaTerminal += stdout;
            if (stderr) respuestaTerminal += `\n[STDERR]\n${stderr}`;
            if (error) respuestaTerminal += `\n[ERROR CRÍTICO]\n${error.message}`;

            respuestaTerminal = respuestaTerminal.trim() || 'Comando ejecutado sin salida de texto.';

            // Responder con el resultado de la consola
            await sock.sendMessage(remoteJid, {
                text: `╭〔 🖥️ ${fytBold('TERMINAL EXEC')} 〕━⬣\n\n\`\`\`\n${respuestaTerminal}\n\`\`\`\n\n╰━━〔 ⚡ ${fytBold('SYSTEM')} 〕━━⬣`
            }, { quoted: m });
        });
    }
};