export default {
    name: ['kick', 'sacar', 'quitar'],
    category: 'group',
    description: 'Expulsa a un integrante del grupo.',
    adminOnly: true,
    execute: async (socket, message, args) => {
        const remoteJid = message.key.remoteJid;

        if (!remoteJid.endsWith('@g.us')) {
            return socket.sendMessage(remoteJid, {
                text: '❌ Este comando solo funciona en grupos.'
            }, { quoted: message }
            );
        }

        let userToKick = null;

        if (message.message?.extendedTextMessage?.contextInfo?.participant) {
            userToKick = message.message.extendedTextMessage.contextInfo.participant;
        }

        else if (message.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0]) {
            userToKick = message.message.extendedTextMessage.contextInfo.mentionedJid[0];
        }

        if (!userToKick) {
            return socket.sendMessage(remoteJid, {
                text: '⚠️ Etiqueta o responde al mensaje de alguien para expulsarlo.'
            }, { quoted: message });
        }

        try {
            await socket.groupParticipantsUpdate(remoteJid, [userToKick], "remove");
            socket.sendMessage(remoteJid, {
                text: 'Integrante expulsado con exito!'},
                { quoted: message }
            );
        } catch (e) {
            if (e.message.includes('not an admin') || e.message.includes('admin')) {
                socket.sendMessage(remoteJid, { text: '❌ Debo de ser Admin para poder eliminar al usuario.' },
                    { quoted: message }
                );
            } else if (e.message.includes('not a participant')) {
                socket.sendMessage(remoteJid, { text: '❌ Ese usuario no está en el grupo.' },
                    { quoted: message }
                );
            } else {
                socket.sendMessage(remoteJid, { text: `❌ Debo de ser Admin para poder eliminar al usuario.` },
                    { quoted: message }
                );
            }
        }
    }
};