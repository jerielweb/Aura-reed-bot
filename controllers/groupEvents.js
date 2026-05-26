import chalk from 'chalk';
import fs from 'fs';

export async function handleGroupUpdate(sock, { id, participants, action }, getDB) {
    const db = await getDB();
    const groupData = db.groups[id];

    console.log(`[GROUP-EVENT] Acción: ${action} | Grupo: ${id} | Participants: ${participants.length}`);

    // Solo actuar si la bienvenida está activada
    if (!groupData?.welcome) {
        console.log(`[GROUP-EVENT] Bienvenida desactivada para este grupo.`);
        return;
    }

    // 'add' cubre añadidos, unión por link y comunidad
    if (action === 'add') {
        console.log(`[GROUP-EVENT] Procesando bienvenida para ${participants.length} integrantes...`);
        try {
            const metadata = await sock.groupMetadata(id);
            const groupName = metadata.subject;

            for (let participant of participants) {
                if (!participant) continue;
                
                // Extraer el JID de forma segura (por si es un objeto o un string)
                const jid = typeof participant === 'string' ? participant : (participant.id || participant.jid);
                if (!jid || typeof jid !== 'string') continue;

                const user = jid.split('@')[0];

                let text = `╭〔 👋 𝐁𝐈𝐄𝐍𝐕𝐄𝐍𝐈𝐃𝐎/𝐀 〕⬣\n`;
                text += `┃ ✨ 𝐀 𝐔𝐍 𝐍𝐔𝐄𝐕𝐎 𝐈𝐍𝐓𝐄𝐆𝐑𝐀𝐍𝐓𝐄\n`;
                text += `╰━━━━━━━━━━━━⬣\n\n`;
                text += `┃ 👋 𝐇𝐨𝐥𝐚 @${user}\n`;
                text += `┃ ✨ 𝐁𝐢𝐞𝐧𝐯𝐞𝐧𝐢𝐝𝐨/𝐚 𝐚:\n`;
                text += `┃ 🏰 *${groupName}*\n\n`;
                text += `┃ 📜 𝐍𝐨 𝐨𝐥𝐯𝐢𝐝𝐞𝐬 𝐥𝐞𝐞𝐫 𝐥𝐚𝐬 𝐫𝐞𝐠𝐥𝐚𝐬\n`;
                text += `┃ 𝐲 𝐝𝐢𝐬𝐟𝐫𝐮𝐭𝐚𝐫 𝐭𝐮 𝐞𝐬𝐭𝐚𝐧𝐜𝐢𝐚.\n\n`;
                text += `╰━━〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕━━⬣`;

                let ppUrl;
                try {
                    ppUrl = await sock.profilePictureUrl(jid, 'image');
                } catch {
                    ppUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
                }

                await sock.sendMessage(id, { 
                    image: { url: ppUrl }, 
                    caption: text,
                    mentions: [jid]
                });
            }
        } catch (e) {
            console.error(chalk.red('[GROUP UPDATE] Error en bienvenida:'), e);
        }
    }
}
