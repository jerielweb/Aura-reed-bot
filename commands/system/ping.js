export default {
    name: ['ping', 'p', 'lat'],
    description: 'Velocidad del sistema.',
    category: 'system',

    async execute(sock, m, args) {
        const start = Date.now();

        //Mensaje de carga
        const { key } = await sock.sendMessage(m.key.remoteJid, {
            text: '⚡ 𝐂𝐀𝐋𝐂𝐔𝐋𝐀𝐍𝐃𝐎 𝐕𝐄𝐋𝐎𝐂𝐈𝐃𝐀𝐃 𝐃𝐄𝐋 𝐁𝐎𝐓 ⚡\n\n╭━━〔 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 𝐒𝐘𝐒𝐓𝐄𝐌 〕━━⬣\n┃ 🚀 𝐄𝐬𝐩𝐞𝐫𝐚 𝐮𝐧 𝐦𝐨𝐦𝐞𝐧𝐭𝐨...\n┃ 📡 𝐀𝐧𝐚𝐥𝐢𝐳𝐚𝐧𝐝𝐨 𝐥𝐚𝐭𝐞𝐧𝐜𝐢𝐚\n┃ 💻 𝐂𝐨𝐦𝐩𝐫𝐨𝐛𝐚𝐧𝐝𝐨 𝐬𝐞𝐫𝐯𝐢𝐝𝐨𝐫\n┃ ⚙️ 𝐎𝐩𝐭𝐢𝐦𝐢𝐳𝐚𝐧𝐝𝐨 𝐫𝐞𝐧𝐝𝐢𝐦𝐢𝐞𝐧𝐭𝐨\n╰━━━━━━━━━━━━━━━━⬣\n'
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
            text: `⚡ 𝐑𝐄𝐒𝐔𝐋𝐓𝐀𝐃𝐎 𝐃𝐄 𝐋𝐀 𝐏𝐑𝐔𝐄𝐁𝐀 ⚡\n\n╭━━〔 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 𝐒𝐘𝐒𝐓𝐄𝐌 〕━━⬣\n┃ ⚡ 𝐕𝐞𝐥𝐨𝐜𝐢𝐝𝐚𝐝 𝐝𝐞𝐥 𝐁𝐨𝐭: *${latency}ms*\n┃ 📶 𝐋𝐚𝐭𝐞𝐧𝐜𝐢𝐚: *${status}*\n┃ 🟢 𝐄𝐬𝐭𝐚𝐝𝐨: ${ramStatus}\n┃ 🔥 𝐒𝐢𝐬𝐭𝐞𝐦𝐚: *${system}*\n╰━━━━━━━━━━━━━━━━⬣`,
            edit: key
        }, { quoted: m });
    }
}  