import fs from 'fs';
import path from 'path';

export default {
    name: ['logout', 'cerrarsesion', 'desconectar'],
    description: 'Cierra la sesión del bot y elimina las credenciales guardadas',
    ownerOnly: true,
    async execute(sock, m, args, { isOwner }) {
        const remoteJid = m.key.remoteJid;

        // Solo funciona si el mensaje lo envía el propio número del bot
        const isSelf = m.key.fromMe === true ||
            (m.key.participant || m.key.remoteJid)?.replace(/:\d+@/, '@') === sock.user?.id?.replace(/:\d+@/, '@');

        if (!isSelf) {
            return sock.sendMessage(remoteJid, {
                text: '❌ Este comando solo puede ser ejecutado desde el número del bot.'
            }, { quoted: m });
        }

        if (!isOwner) {
            return sock.sendMessage(remoteJid, {
                text: '❌ Solo el dueño puede cerrar la sesión del bot.'
            }, { quoted: m });
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
            const authFolder = path.resolve('./auth_info_baileys');
            if (fs.existsSync(authFolder)) {
                fs.rmSync(authFolder, { recursive: true, force: true });
                console.log('🗑️  Carpeta auth_info_baileys eliminada.');
            }

            console.log('🔴 Sesión cerrada. Reiniciando proceso...');
            process.exit(0);
        }, 2000);
    }
};
