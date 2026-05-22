import os from 'os';
import { fytBold } from '../../models/TextStyle.js';

export default {
    name: ['status', 'botstatus', 'estado'],
    category: 'owner',
    description: 'Muestra el estado del sistema y del bot.',
    ownerOnly: true,

    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;
        
        const uptime = process.uptime();
        const hours = Math.floor(uptime / 3600);
        const minutes = Math.floor((uptime % 3600) / 60);
        const seconds = Math.floor(uptime % 60);
        
        const usedMemory = process.memoryUsage().heapUsed / 1024 / 1024;
        const totalMemory = os.totalmem() / 1024 / 1024 / 1024;
        const freeMemory = os.freemem() / 1024 / 1024 / 1024;

        let text = `╭〔 📊 ${fytBold('AURA REED')} 〕⬣\n`;
        text += `┃ ⚙️ ${fytBold('ESTADO DEL SISTEMA')}\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ ⏱️ ${fytBold('Uptime:')} ${hours}h ${minutes}m ${seconds}s\n`;
        text += `┃ 🧠 ${fytBold('Mem. Usada:')} ${usedMemory.toFixed(2)} MB\n`;
        text += `┃ 🖥️ ${fytBold('S.O.:')} ${os.platform()} ${os.arch()}\n`;
        text += `┃ 💎 ${fytBold('Mem. Total:')} ${totalMemory.toFixed(2)} GB\n`;
        text += `┃ 🍃 ${fytBold('Mem. Libre:')} ${freeMemory.toFixed(2)} GB\n\n`;
        text += `╰〔 ⚡ ${fytBold('SYSTEM')} 〕⬣`;

        await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
};
