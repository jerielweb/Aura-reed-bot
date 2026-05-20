import { fyt } from "../../models/utils.js";

export default {
    name: ['report', 'bug', 'sugerencia', 'reportar', 'sugerir'],
    category: 'system',
    description: 'Envía un reporte de bug o sugerencia a los desarrolladores del bot.',
    async execute(sock, m, args, { prefix, owners, groupMetadata, jidRemitente }) {
        const remoteJid = m.key.remoteJid;
        const reportText = args.join(' ').trim();

        if (!reportText) {
            return await sock.sendMessage(remoteJid, {
                text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ ❌ 𝐅𝐀𝐋𝐓𝐀 𝐓𝐄𝐗𝐓𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ > Por favor, escribe tu reporte.\n┃ > Ejemplo: *${prefix}report El comando sticker no funciona con videos.*\n\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`
            }, { quoted: m });
        }

        // Reaccionar indicando procesamiento
        await sock.sendMessage(remoteJid, { react: { text: '📨', key: m.key } });

        // Identificar origen
        const isGroup = remoteJid.endsWith('@g.us');
        const origen = isGroup ? `Grupo: ${groupMetadata?.subject || 'Desconocido'} (${remoteJid})` : 'Chat Privado';
        const senderNumber = jidRemitente.split('@')[0];
        const pushName = m.pushName || 'Usuario';

        // Formatear mensaje para los propietarios
        let textForOwners = `╭〔 📢 𝐍𝐔𝐄𝐕𝐎 𝐑𝐄𝐏𝐎𝐑𝐓𝐄 〕━⬣\n\n`;
        textForOwners += `┃ 👤 𝐔𝐬𝐮𝐚𝐫𝐢𝐨 › @${senderNumber}\n`;
        textForOwners += `┃ 📛 𝐍𝐨𝐦𝐛𝐫𝐞 › ${pushName}\n`;
        textForOwners += `┃ 📍 𝐎𝐫𝐢𝐠𝐞𝐧 › ${origen}\n`;
        textForOwners += `┃ 🕒 𝐅𝐞𝐜𝐡𝐚 › ${new Date().toLocaleString('es-CR')}\n\n`;
        textForOwners += `┣━━━━━━━━━━━━⬣\n\n`;
        textForOwners += `┃ 📝 𝐌𝐞𝐧𝐬𝐚𝐣𝐞:\n`;
        textForOwners += `┃ > ${reportText}\n\n`;
        textForOwners += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

        let sentCount = 0;
        const targetOwners = Array.isArray(owners) ? owners : [];

        for (const ownerJid of targetOwners) {
            try {
                await sock.sendMessage(ownerJid, { 
                    text: textForOwners,
                    mentions: [jidRemitente]
                });
                sentCount++;
            } catch (err) {
                console.error(`[Report Command] Error al enviar reporte al dueño (${ownerJid}):`, err);
            }
        }

        if (sentCount > 0) {
            await sock.sendMessage(remoteJid, { react: { text: '✅', key: m.key } });
            await sock.sendMessage(remoteJid, {
                text: `╭〔 ✅ 𝐑𝐄𝐏𝐎𝐑𝐓𝐄 𝐄𝐍𝐕𝐈𝐀𝐃𝐎 〕━⬣\n\n┃ > Tu reporte ha sido enviado con éxito\n┃ > a los desarrolladores del bot.\n┃ > ¡Gracias por tu colaboración!\n\n╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`
            }, { quoted: m });
        } else {
            await sock.sendMessage(remoteJid, { react: { text: '❌', key: m.key } });
            await sock.sendMessage(remoteJid, {
                text: `╭〔 ❌ 𝐄𝐑𝐑𝐎𝐑 𝐃𝐄 𝐄𝐍𝐕𝐈́𝐎 〕━⬣\n\n┃ > No se pudo enviar el reporte a los\n┃ > propietarios. Inténtalo más tarde.\n\n╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`
            }, { quoted: m });
        }
    }
};
