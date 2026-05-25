import { resolveLidToRealJid } from '../../models/utils.js';
import { ensureGroup, getGroupUser } from '../../models/groupDb.js';
import {
    getMarriagePending,
    setMarriagePending,
    clearMarriagePending,
    formatTimeLeft
} from '../../models/marriageUtils.js';

async function resolveTargetFromMessage(message, socket, remoteJid, jidRemitente) {
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    let targetJid = null;
    if (ctx?.mentionedJid?.length > 0) targetJid = ctx.mentionedJid[0];
    else if (ctx?.participant) targetJid = ctx.participant;
    if (!targetJid) return null;
    return resolveLidToRealJid(targetJid, socket, remoteJid);
}

export default {
    name: ['marry', 'casar', 'matrimonio', 'divorce', 'divorciar', 'separar'],
    category: 'profile',
    description: 'Casarse o divorciarse.',
    execute: async (socket, message, args, { db, saveDB, jidRemitente, prefix }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            return await socket.sendMessage(remoteJid, { text: '❌ Este comando solo funciona en grupos.' }, { quoted: message });
        }

        const group = ensureGroup(db, remoteJid);
        const user = getGroupUser(db, remoteJid, jidRemitente, {});
        let targetJid = await resolveTargetFromMessage(message, socket, remoteJid, jidRemitente);
        const pending = getMarriagePending(group);

        // Confirmar solicitud pendiente (sin mención: acepta al que te pidió)
        if (!targetJid && pending?.to === jidRemitente) {
            targetJid = pending.from;
        }

        if (!targetJid) {
            if (user.marriedTo) {
                targetJid = user.marriedTo;
            } else {
                return await socket.sendMessage(remoteJid, {
                    text: '⚠️ Menciona o responde a la persona.\n┃ > Matrimonio: *${prefix}marry @usuario*\n┃ > Divorcio (casado): *${prefix}marry @pareja* o *${prefix}marry*'
                }, { quoted: message });
            }
        }

        if (targetJid === jidRemitente) {
            return await socket.sendMessage(remoteJid, { text: '❌ No puedes usar este comando contigo mismo.' }, { quoted: message });
        }

        const partner = getGroupUser(db, remoteJid, targetJid, {});

        // ——— Confirmar solicitud activa ———
        if (pending && pending.to === jidRemitente && pending.from === targetJid) {
            if (pending.type === 'marry') {
                if (user.marriedTo || partner.marriedTo) {
                    clearMarriagePending(group);
                    saveDB(db);
                    return await socket.sendMessage(remoteJid, { text: '❌ Ya no es posible casarse: uno de los dos ya está casado/a.' }, { quoted: message });
                }
                user.marriedTo = targetJid;
                partner.marriedTo = jidRemitente;
                clearMarriagePending(group);
                saveDB(db);
                const text = `╭〔 💍 𝐌𝐀𝐓𝐑𝐈𝐌𝐎𝐍𝐈𝐎 〕⬣\n┃ 💕 ¡𝐂𝐎𝐍𝐅𝐈𝐑𝐌𝐀𝐃𝐎!\n╰━━━━━━━━━━━━⬣\n\n┃ @${jidRemitente.split('@')[0]} 💕 @${targetJid.split('@')[0]}\n┃ Se han casado en este grupo.\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;
                return await socket.sendMessage(remoteJid, { text, mentions: [jidRemitente, targetJid] }, { quoted: message });
            }

            if (pending.type === 'divorce') {
                if (user.marriedTo !== targetJid || partner.marriedTo !== jidRemitente) {
                    clearMarriagePending(group);
                    saveDB(db);
                    return await socket.sendMessage(remoteJid, { text: '❌ El matrimonio ya no es válido o no coincide.' }, { quoted: message });
                }
                user.marriedTo = null;
                partner.marriedTo = null;
                clearMarriagePending(group);
                saveDB(db);
                const text = `╭〔 💔 𝐃𝐈𝐕𝐎𝐑𝐂𝐈𝐎 〕⬣\n┃ ✅ 𝐂𝐎𝐍𝐅𝐈𝐑𝐌𝐀𝐃𝐎\n╰━━━━━━━━━━━━⬣\n\n┃ @${jidRemitente.split('@')[0]} y @${targetJid.split('@')[0]}\n┃ han terminado su matrimonio.\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`;
                return await socket.sendMessage(remoteJid, { text, mentions: [jidRemitente, targetJid] }, { quoted: message });
            }
        }

        // Solicitud pendiente hacia otro (aún no confirman)
        if (pending && pending.from === jidRemitente) {
            const left = formatTimeLeft(pending.expiresAt);
            return await socket.sendMessage(remoteJid, {
                text: `⏳ Ya enviaste una solicitud de *${pending.type === 'marry' ? 'matrimonio' : 'divorcio'}*.\nEspera que @${pending.to.split('@')[0]} confirme con *${prefix}marry* (quedan *${left}*).`,
                mentions: [pending.to]
            }, { quoted: message });
        }

        if (pending && pending.from !== jidRemitente && pending.to !== jidRemitente) {
            const left = formatTimeLeft(pending.expiresAt);
            return await socket.sendMessage(remoteJid, {
                text: `⏳ Hay otra solicitud en curso entre @${pending.from.split('@')[0]} y @${pending.to.split('@')[0]} (*${left}* restantes).`
            }, { quoted: message });
        }

        // ——— Iniciar divorcio ———
        if (user.marriedTo) {
            if (user.marriedTo !== targetJid) {
                return await socket.sendMessage(remoteJid, {
                    text: `❌ Estás casado/a con @${user.marriedTo.split('@')[0]}. Usa *${prefix}marry @${user.marriedTo.split('@')[0]}* para solicitar divorcio.`,
                    mentions: [user.marriedTo]
                }, { quoted: message });
            }

            setMarriagePending(group, jidRemitente, targetJid, 'divorce');
            saveDB(db);
            const left = formatTimeLeft(group.marriagePending.expiresAt);
            return await socket.sendMessage(remoteJid, {
                text: `╭〔 💔 𝐃𝐈𝐕𝐎𝐑𝐂𝐈𝐎 〕⬣\n┃ ⏳ 𝐄𝐒𝐏𝐄𝐑𝐀𝐍𝐃𝐎 𝐂𝐎𝐍𝐅𝐈𝐑𝐌𝐀𝐂𝐈𝐎́𝐍\n╰━━━━━━━━━━━━⬣\n\n┃ @${jidRemitente.split('@')[0]} solicita divorcio.\n┃ @${targetJid.split('@')[0]} confirma con:\n┃ ➪ *${prefix}marry @${jidRemitente.split('@')[0]}*\n┃ ➪ o *${prefix}marry* (respondiendo)\n\n┃ ⏱️ Tiempo: *${left}*\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`,
                mentions: [jidRemitente, targetJid]
            }, { quoted: message });
        }

        // ——— Iniciar matrimonio ———
        if (partner.marriedTo) {
            return await socket.sendMessage(remoteJid, { text: '❌ Esa persona ya está casada en este grupo.' }, { quoted: message });
        }

        setMarriagePending(group, jidRemitente, targetJid, 'marry');
        saveDB(db);
        const left = formatTimeLeft(group.marriagePending.expiresAt);
        return await socket.sendMessage(remoteJid, {
            text: `╭〔 💍 𝐌𝐀𝐓𝐑𝐈𝐌𝐎𝐍𝐈𝐎 〕⬣\n┃ ⏳ 𝐄𝐒𝐏𝐄𝐑𝐀𝐍𝐃𝐎 𝐂𝐎𝐍𝐅𝐈𝐑𝐌𝐀𝐂𝐈𝐎́𝐍\n╰━━━━━━━━━━━━⬣\n\n┃ @${jidRemitente.split('@')[0]} quiere casarse contigo.\n┃ @${targetJid.split('@')[0]} acepta con:\n┃ ➪ *${prefix}marry @${jidRemitente.split('@')[0]}*\n┃ ➪ o *${prefix}marry* (respondiendo)\n\n┃ ⏱️ Tiempo: *${left}*\n\n╰〔 ⚡ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣`,
            mentions: [jidRemitente, targetJid]
        }, { quoted: message });
    }
};
