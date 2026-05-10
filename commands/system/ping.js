export default {
    name: ['ping', 'p', 'latencia', 'lat'],
    description: 'muestra el tiempo de respuesta del bot',
    category: 'system',

    async execute(sock, m, args) {
        const start = Date.now();
        const { key } = await sock.sendMessage(m.key.remoteJid, {
            text: '¡Pong! 🏓\nCalculando Latencia...'
        }, { quoted: m });
        const end = Date.now();
        const latency = end - start;
        await sock.sendMessage(m.key.remoteJid, {
            text: `¡Pong! 🏓\nLatencia: *${latency}ms*`,
            edit: key
        }, { quoted: m });
    }
}