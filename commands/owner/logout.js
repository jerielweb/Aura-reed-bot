import fs from 'fs';
import path from 'path';
import { Rstr } from '../../controllers/textBots.js';

export default {
    name: ['logout', 'cerrarsesion', 'desconectar'],
    description: 'Cierra sesión actual',
    ownerOnly: true,
    async execute(sock, m, args, { isOwner }) {
        const remoteJid = m.key.remoteJid;

        // Solo funciona si el mensaje lo envía el propio número del bot
        const isSelf = m.key.fromMe === true ||
            (m.key.participant || m.key.remoteJid)?.replace(/:\d+@/, '@') === sock.user?.id?.replace(/:\d+@/, '@');

        if (!isSelf) {
            let text = `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
            text += `┃ ❌ 𝐀𝐂𝐂𝐈𝐎́𝐍 𝐃𝐄𝐍𝐄𝐆𝐀𝐃𝐎\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > Este comando solo puede\n`;
            text += `┃ > ser ejecutado desde el\n`;
            text += `┃ > número principal del bot.\n\n`;
            text += `╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`;
            return sock.sendMessage(remoteJid, { text }, { quoted: m });
        }

        if (!isOwner) {
            return sock.sendMessage(remoteJid, { text: Rstr.onlyOwner }, { quoted: m });
        }

        await sock.sendMessage(remoteJid, {
            text: '🔴 *Cerrando sesión...*\n\nLa sesión ha sido eliminada. El bot se reiniciará y pedirá un nuevo vinculo de número.'
        }, { quoted: m });

        // Small delay so the message is sent before exiting
        setTimeout(async () => {
            try {
                // Log out from WhatsApp servers
                await sock.logout();
            } catch (_) {
                // Ignore errors — session may already be invalid
            }

            // Delete local auth folder
            const authFolder = path.resolve('./sessions/principal');
            if (fs.existsSync(authFolder)) {
                fs.rmSync(authFolder, { recursive: true, force: true });
                console.log('🗑️  Carpeta sessions/principal eliminada.');
            }

            console.log('🔴 Sesión cerrada. Reiniciando proceso...');
            process.exit(0);
        }, 2000);
    }
};
