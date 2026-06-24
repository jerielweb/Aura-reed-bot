import chalk from 'chalk';
import fs from 'fs';
import { fytBold } from '../models/TextStyle.js';

export async function handleGroupUpdate(sock, { id, participants, action }, getDB) {
    const db = await getDB();
    const groupData = db.groups[id];

    // Verificar si el bot actual es el primario asignado a este grupo
    const botId = sock.user?.id ? (sock.user.id.split('@')[0].split(':')[0] + '@s.whatsapp.net') : null;
    const groupPrimaryBot = groupData?.primaryBot;
    if (groupPrimaryBot && botId && groupPrimaryBot !== botId) {
        console.log(`[GROUP-EVENT] Ignorado por no ser bot primario. Bot actual: ${botId} | Primario: ${groupPrimaryBot}`);
        return;
    }

    console.log(chalk.gray(`[GROUP-EVENT] Acción: ${action} | Grupo: ${id} | Participants: ${participants.length}`));

    // 1. EVENTO: BIENVENIDA (add)
    if (action === 'add') {
        if (!groupData?.welcome) {
            console.log(chalk.gray(`[GROUP-EVENT] Bienvenida desactivada para este grupo.`));
            return;
        }

        console.log(chalk.gray(`[GROUP-EVENT] Procesando bienvenida para ${participants.length} integrantes...`));
        try {
            const metadata = await sock.groupMetadata(id);
            const groupName = metadata.subject;

            for (let participant of participants) {
                if (!participant) continue;
                
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
    
    // 2. EVENTO: DESPEDIDA (remove)
    else if (action === 'remove') {
        if (!groupData?.bye) {
            console.log(chalk.gray(`[GROUP-EVENT] Despedida desactivada para este grupo.`));
            return;
        }

        console.log(chalk.gray(`[GROUP-EVENT] Procesando despedida para ${participants.length} integrantes...`));

        try {
            const metadata = await sock.groupMetadata(id);
            const groupName = metadata.subject;
            
            for (let participant of participants) {
                if (!participant) continue;
                
                const jid = typeof participant === 'string' ? participant : (participant.id || participant.jid);
                if (!jid || typeof jid !== 'string') continue;

                const user = jid.split('@')[0];

                let text = `╭〔 😔 ${fytBold('SE NOS FUE UN GRANDE')} 〕⬣\n`;
                text += `┃ ✨ ${fytBold('HASTA PRONTO')}\n`;
                text += `╰━━━━━━━━━━━━⬣\n\n`;
                text += `┃ 👋 ${fytBold(`Adios @${user}`)}\n`;
                text += `┃ > ${fytBold('Es una pena que te vayas de:')}\n`;
                text += `┃ > *${groupName}*\n\n`;
                text += `┃ > ${fytBold('Nunca te olvidaremos')}\n\n`;
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
            console.error(chalk.red('[GROUP UPDATE] Error en despedida:'), e);
        }
    } 
    
    // 3. EVENTO: ASCENSO A ADMIN (promote)
    else if (action === 'promote') {
        if (!db.groups[id]?.alerts) {
            console.log(chalk.gray(`[GROUP-EVENT] Las alertas están desactivadas.`));
            return;
        }

        try {
            for (let participant of participants) {
                if (!participant) continue;

                const jid = typeof participant === 'string' ? participant : (participant.id || participant.jid);
                if (!jid || typeof jid !== 'string') continue;

                const user = jid.split('@')[0].split(':')[0];

                let text = `╭〔 🎉 𝐍𝐔𝐄𝐕𝐎 𝐀𝐃𝐌𝐈𝐍 〕⬣\n\n`;
                text += `┃ 👑 ¡Felicidades @${user}!\n`;
                text += `┃ > Has sido ascendido a Administrador.\n`;
                text += `┃ > Más te vale no abusar de tu poder.\n\n`;
                text += `╰━━〔 ⚡ ${fytBold('AURA NEWS')} 〕━━⬣`;

                await sock.sendMessage(id, { text, mentions: [jid] });
            }
        } catch (e) {
            console.error(chalk.red('[GROUP UPDATE] Error en promote:'), e);
        }
    }

    // 4. EVENTO: DEGRADACIÓN DE ADMIN (demote)
    else if (action === 'demote') {
        if (!db.groups[id]?.alerts) {
            console.log(chalk.gray(`[GROUP-EVENT] Las alertas están desactivadas.`));
            return;
        }

        try {
            for (let participant of participants) {
                if (!participant) continue;

                const jid = typeof participant === 'string' ? participant : (participant.id || participant.jid);
                if (!jid || typeof jid !== 'string') continue;

                const user = jid.split('@')[0].split(':')[0];

                let text = `╭〔 ⚠️ 𝐀𝐃𝐌𝐈𝐍 𝐃𝐄𝐆𝐑𝐀𝐃𝐀𝐃𝐎 〕⬣\n\n`;
                text += `┃ 📉 @${user} ya no es Administrador.\n`;
                text += `┃ > Se le han retirado sus privilegios.\n\n`;
                text += `╰━━〔 ⚡ ${fytBold('AURA NEWS')} 〕━━⬣`;

                await sock.sendMessage(id, { text, mentions: [jid] });
            }
        } catch (e) {
            console.error(chalk.red('[GROUP UPDATE] Error en demote:'), e);
        }
    }
}