import { exec } from 'child_process';

export default {
    name: ['update', 'actualizar'],
    category: 'owner',
    description: 'Actualiza el bot desde el repositorio (Git).',
    ownerOnly: true,

    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;

        let text = `╭〔 🚀 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
        text += `┃ ⚙️ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐔𝐏𝐃𝐀𝐓𝐄\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ > Buscando actualizaciones\n`;
        text += `┃ > en el repositorio...\n\n`;
        text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;

        await socket.sendMessage(remoteJid, { text }, { quoted: message });

        exec('git pull', async (err, stdout, stderr) => {
            if (err) {
                let textErr = `╭〔 ❌ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
                textErr += `┃ ⚠️ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐔𝐏𝐃𝐀𝐓𝐄\n`;
                textErr += `╰━━━━━━━━━━━━⬣\n\n`;
                textErr += `┃ > Error al actualizar:\n`;
                textErr += `┃ > ${err.message}\n\n`;
                textErr += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
                return await socket.sendMessage(remoteJid, { text: textErr }, { quoted: message });
            }

            if (stdout.includes('Already up to date')) {
                let textUp = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
                textUp += `┃ ✨ 𝐒𝐈𝐒𝐓𝐄𝐌𝐀 𝐔𝐏𝐃𝐀𝐓𝐄\n`;
                textUp += `╰━━━━━━━━━━━━⬣\n\n`;
                textUp += `┃ > El bot ya se encuentra\n`;
                textUp += `┃ > en su versión más reciente.\n\n`;
                textUp += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
                return await socket.sendMessage(remoteJid, { text: textUp }, { quoted: message });
            }

            let textSuccess = `╭〔 ✅ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            textSuccess += `┃ 🚀 𝐔𝐏𝐃𝐀𝐓𝐄 𝐂𝐎𝐌𝐏𝐋𝐄𝐓𝐎\n`;
            textSuccess += `╰━━━━━━━━━━━━⬣\n\n`;
            textSuccess += `┃ > Actualización exitosa.\n`;
            textSuccess += `┃ > Reinicie el bot para\n`;
            textSuccess += `┃ > aplicar los cambios.\n\n`;
            textSuccess += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            await socket.sendMessage(remoteJid, { text: textSuccess }, { quoted: message });
        });
    }
};
