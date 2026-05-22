import { fytBold } from '../../models/TextStyle.js';

export default {
    name: ['ping', 'p', 'lat'],
    description: 'Velocidad del sistema.',
    category: 'system',

    async execute(sock, m, args) {
        const start = Date.now();

        //Mensaje de carga
        const { key } = await sock.sendMessage(m.key.remoteJid, {
            text: `⚡ ${fytBold('CALCULANDO VELOCIDAD DEL BOT')} ⚡\n\n╭━━〔 ${fytBold('AURA REED SYSTEM')} 〕━━⬣\n┃ 🚀 Espera un momento...\n┃ 📡 Analizando latencia\n┃ 💻 Comprobando servidor\n┃ ⚙️ Optimizando rendimiento\n╰━━━━━━━━━━━━━━━━⬣\n`
        }, { quoted: m });
        const end = Date.now();
        const latency = end - start;

        //Cálculo de Memoria RAM
        const usedRAM = (process.memoryUsage().rss / 1024 / 1024).toFixed(0); // MB actuales
        const totalRAM = 1750; // Los 1.71 GiB de tu VPS pasados a MB

        //Condiciones
        let ramStatus = '';
        if (usedRAM < 800) {
            ramStatus = '✅ Optimo'
        } else if (usedRAM < 1200) {
            ramStatus = '⚠️ Moderado'
        } else {
            ramStatus = '🆘 Critico'
        }

        let status = '';
        let system = '';
        if (latency < 100) {
            status = '✅ Exelente';
            system = 'Estable'
        } else if (latency < 500) {
            status = '⚠️ Aceptable';
            system = 'Normal'
        } else {
            status = '🆘 Malo';
            system = 'En problemas'
        }

        //Mensaje
        await sock.sendMessage(m.key.remoteJid, {
            text: `⚡ ${fytBold('RESULTADO DE LA PRUEBA')} ⚡\n\n╭━━〔 ${fytBold('AURA REED SYSTEM')} 〕━━⬣\n┃ ⚡ ${fytBold('Velocidad del Bot:')} *${latency}ms*\n┃ 📶 ${fytBold('Latencia:')} *${status}*\n┃ 🟢 ${fytBold('Estado:')} ${ramStatus}\n┃ 🔥 ${fytBold('Sistema:')} *${system}*\n╰━━━━━━━━━━━━━━━━⬣`,
            edit: key
        }, { quoted: m });
    }
}  