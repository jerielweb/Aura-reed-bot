import os from 'os';
import fs from 'fs';
import {fytBold} from './../../models/TextStyle.js';

export default {
    name: ['system', 'sys', 'info'],
    category: 'system',
    description: 'Muestra componentes del sistema.',
    ownerOnly: true,

    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;

        // ── CPU ──
        const cpus = os.cpus();
        const cpuModel = cpus[0]?.model?.trim() || 'Desconocido';
        const cpuCores = cpus.length;
        const platform = `${os.platform()} (${os.arch()})`;

        // ── MEMORIA RAM DEL SERVIDOR (CGROUP) ──
        let totalMem, usedMem, freeMem, usedPct;

        try {
            // Intentar leer los límites del contenedor/panel (Valores en bytes)
            const memLimit = parseInt(fs.readFileSync('/sys/fs/cgroup/memory/memory.limit_in_bytes', 'utf8'), 10);
            const memUsage = parseInt(fs.readFileSync('/sys/fs/cgroup/memory/memory.usage_in_bytes', 'utf8'), 10);

            // Si el host no tiene límites estrictos puede dar un número absurdamente gigante, validamos:
            if (memLimit && memLimit < 9000000000000000) {
                totalMem = memLimit / 1024 / 1024 / 1024;
                usedMem  = memUsage / 1024 / 1024 / 1024;
                freeMem  = totalMem - usedMem;
                usedPct  = ((usedMem / totalMem) * 100).toFixed(1);
            } else {
                // Fallback por si cgroups da un valor ilimitado
                totalMem = os.totalmem() / 1024 / 1024 / 1024;
                freeMem  = os.freemem()  / 1024 / 1024 / 1024;
                usedMem  = totalMem - freeMem;
                usedPct  = ((usedMem / totalMem) * 100).toFixed(1);
            }
        } catch (e) {
            // Fallback tradicional usando 'os' por si no está en Linux/Docker
            totalMem = os.totalmem() / 1024 / 1024 / 1024;
            freeMem  = os.freemem()  / 1024 / 1024 / 1024;
            usedMem  = totalMem - freeMem;
            usedPct  = ((usedMem / totalMem) * 100).toFixed(1);
        }

        const botMem = process.memoryUsage().heapUsed / 1024 / 1024 / 1024;

        // ── UPTIME ──
        const botUp  = process.uptime();
        const sysUp  = os.uptime();

        const fmt = (s) => {
            const h = Math.floor(s / 3600);
            const m = Math.floor((s % 3600) / 60);
            const sec = Math.floor(s % 60);
            return `${h}h ${m}m ${sec}s`;
        };

        // ── ENTORNO ──
        const nodeVersion = process.version;
        const pid = process.pid;

        let text = `╭━〔 🖥️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐑𝐄𝐄𝐃 〕━⬣\n\n`;

        // CPU
        text += `┣━━━━━ ${fytBold('CPU')} ━━━━━⬣\n`;
        text += `┃ > ${fytBold('Modelo:')} ${cpuModel}\n`;
        text += `┃ > ${fytBold('Núcleos:')} ${cpuCores}\n`;
        text += `┃ > ${fytBold('Plataforma:')} ${platform}\n\n`;

        // RAM
        text += `┣━━━━━ ${fytBold('RAM')} ━━━━⬣\n`;
        text += `┃ > ${fytBold('Total:')} ${totalMem.toFixed(2)} GB\n`;
        text += `┃ > ${fytBold('Usada:')} ${usedMem.toFixed(2)} GB (${usedPct}%)\n`;
        text += `┃ > ${fytBold('Libre:')} ${freeMem.toFixed(2)} GB\n`;
        text += `┃ > ${fytBold('Bot usa:')} ${botMem.toFixed(2)} GB\n\n`;

        // UPTIME
        text += `┣━━━━ ${fytBold('UPTIME')} ━━━━⬣\n`;
        text += `┃ > ${fytBold('Bot activo:')} ${fmt(botUp)}\n`;
        text += `┃ > ${fytBold('Servidor:')} ${fmt(sysUp)}\n\n`;

        // ENTORNO
        text += `┣━━━ ${fytBold('ENTORNO')} ━━━━⬣\n`;
        text += `┃ > ${fytBold('Node.js:')} ${nodeVersion}\n`;
        text += `┃ > ${fytBold('PID:')} ${pid}\n\n`;

        text += `╰━━━━━━━━━━━━⬣`;

        await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
};