import os from 'os';
import {fyt} from './../../models/utils.js'

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

        // ── MEMORIA RAM ──
        const totalMem = os.totalmem() / 1024 / 1024 / 1024;
        const freeMem  = os.freemem()  / 1024 / 1024 / 1024;
        const usedMem  = totalMem - freeMem;
        const usedPct  = ((usedMem / totalMem) * 100).toFixed(1);
        const botMem   = process.memoryUsage().heapUsed / 1024 / 1024 / 1024;

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
        text += `┣━━━━━ ${fyt('CPU')} ━━━━━⬣\n`;
        text += `┃ > *Modelo:* ${cpuModel}\n`;
        text += `┃ > *Núcleos:* ${cpuCores}\n`;
        text += `┃ > *Plataforma:* ${platform}\n\n`;

        // RAM
        text += `┣━━━━━ ${fyt('RAM')} ━━━━⬣\n`;
        text += `┃ > *Total:* ${totalMem.toFixed(2)} GB\n`;
        text += `┃ > *Usada:* ${usedMem.toFixed(2)} GB (${usedPct}%)\n`;
        text += `┃ > *Libre:* ${freeMem.toFixed(2)} GB\n`;
        text += `┃ > *Bot usa:* ${botMem.toFixed(2)} GB\n\n`;

        // UPTIME
        text += `┣━━━━ ${fyt('UPTIME')} ━━━━⬣\n`;
        text += `┃ > *Bot activo:* ${fmt(botUp)}\n`;
        text += `┃ > *Servidor:* ${fmt(sysUp)}\n\n`;

        // ENTORNO
        text += `┣━━━ ${fyt('ENTORNO')} ━━━━⬣\n`;
        text += `┃ > *Node.js:* ${nodeVersion}\n`;
        text += `┃ > *PID:* ${pid}\n\n`;


        text += `╰━━━━━━━━━━━━⬣`;

        await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
};
