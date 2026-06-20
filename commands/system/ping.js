import fs from "fs";
import { fytBold } from '../../models/TextStyle.js';

function getMemoryInfo() {
    try {
        // Intentar Cgroups v2 (Sistemas modernos de contenedores/Pterodactyl)
        if (fs.existsSync("/sys/fs/cgroup/memory.max") && fs.existsSync("/sys/fs/cgroup/memory.current")) {
            let total = fs.readFileSync("/sys/fs/cgroup/memory.max", "utf8").trim();
            let used = fs.readFileSync("/sys/fs/cgroup/memory.current", "utf8").trim();

            if (total !== "max" && !isNaN(Number(total)) && Number(total) > 0) {
                return { 
                    total: Number(total) / 1024 / 1024, // Pasar a MB
                    used: Number(used) / 1024 / 1024   // Pasar a MB
                };
            }
        }

        // Intentar Cgroups v1 (Sistemas clásicos)
        if (fs.existsSync("/sys/fs/cgroup/memory/memory.limit_in_bytes")) {
            const total = fs.readFileSync("/sys/fs/cgroup/memory/memory.limit_in_bytes", "utf8").trim();
            const used = fs.readFileSync("/sys/fs/cgroup/memory/memory.usage_in_bytes", "utf8").trim();

            if (!isNaN(Number(total)) && Number(total) < 9223372036854771712 && Number(total) > 0) {
                return { 
                    total: Number(total) / 1024 / 1024, // Pasar a MB
                    used: Number(used) / 1024 / 1024   // Pasar a MB
                };
            }
        }
    } catch (e) {
        // Silenciar errores de lectura
    }

    // Fallback: Si no se puede leer el contenedor, usamos la RAM usada por el bot
    const used = process.memoryUsage().rss / 1024 / 1024;
    const total = 1750; // Fallback seguro con tus 1.71 GiB en MB
    return { total, used };
}

export default {
    name: ['ping', 'p', 'lat'],
    description: 'Velocidad del sistema.',
    category: 'system',

    async execute(sock, m, args) {
        const start = Date.now();

        // Mensaje de carga
        const { key } = await sock.sendMessage(m.key.remoteJid, {
            text: `⚡ ${fytBold('CALCULANDO VELOCIDAD DEL BOT')} ⚡\n\n╭━━〔 ${fytBold('AURA REED SYSTEM')} 〕━━⬣\n┃ 🚀 Espera un momento...\n┃ 📡 Analizando latencia\n┃ 💻 Comprobando servidor\n┃ ⚙️ Optimizando rendimiento\n╰━━━━━━━━━━━━━━━━⬣\n`
        }, { quoted: m });
        
        const end = Date.now();
        const latency = end - start;

        // Cálculo de Memoria RAM Real
        const memory = getMemoryInfo();
        const usedRAM = memory.used;
        const totalRAM = memory.total;

        // El porcentaje nos ayuda a calcular las condiciones de forma más justa sin importar el tamaño del host
        const ramPercent = (usedRAM / totalRAM) * 100;

        // Condiciones de RAM basadas en porcentaje consumido
        let ramStatus = '';
        if (ramPercent < 50) {
            ramStatus = '🟢 Óptimo';
        } else if (ramPercent < 80) {
            ramStatus = '🟠 Moderado';
        } else {
            ramStatus = '🔴 Crítico';
        }

        let status = '';
        let system = '';
        if (latency < 100) {
            status = '🟢 Excelente';
            system = 'Estable';
        } else if (latency < 500) {
            status = '🟠 Aceptable';
            system = 'Normal';
        } else {
            status = '🔴 Malo';
            system = 'En problemas';
        }

        // Mensaje con edición
        await sock.sendMessage(m.key.remoteJid, {
            text: `⚡ ${fytBold('RESULTADO DE LA PRUEBA')} ⚡\n\n╭━━〔 ${fytBold('AURA REED SYSTEM')} 〕━━⬣\n┃ ⚡ ${fytBold('Velocidad del Bot:')} *${latency}ms*\n┃ 📶 ${fytBold('Latencia:')} *${status}*\n┃ 🟢 ${fytBold('RAM Servidor:')} *${usedRAM.toFixed(0)} / ${totalRAM.toFixed(0)} MB* (${ramPercent.toFixed(1)}%)\n┃ 📊 ${fytBold('Estado RAM:')} ${ramStatus}\n┃ 🔥 ${fytBold('Sistema:')} *${system}*\n╰━━━━━━━━━━━━━━━━⬣`,
            edit: key
        }, { quoted: m });
    }
}