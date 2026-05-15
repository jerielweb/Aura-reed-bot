import os from 'os';

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

        let text = `╭〔 📊 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
        text += `┃ ⚙️ 𝐄𝐒𝐓𝐀𝐃𝐎 𝐃𝐄𝐋 𝐒𝐈𝐒𝐓𝐄𝐌𝐀\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ ⏱️ 𝐔𝐩𝐭𝐢𝐦𝐞: ${hours}h ${minutes}m ${seconds}s\n`;
        text += `┃ 🧠 𝐌𝐞𝐦. 𝐔𝐬𝐚𝐝𝐚: ${usedMemory.toFixed(2)} MB\n`;
        text += `┃ 🖥️ 𝐒.𝐎.: ${os.platform()} ${os.arch()}\n`;
        text += `┃ 💎 𝐌𝐞𝐦. 𝐓𝐨𝐭𝐚𝐥: ${totalMemory.toFixed(2)} GB\n`;
        text += `┃ 🍃 𝐌𝐞𝐦. 𝐋𝐢𝐛𝐫𝐞: ${freeMemory.toFixed(2)} GB\n\n`;
        text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

        await socket.sendMessage(remoteJid, { text }, { quoted: message });
    }
};
