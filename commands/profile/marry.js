import { resolveLidToRealJid } from '../../models/utils.js';
import { ensureGroup, getGroupUser } from '../../models/groupDb.js';
import { fytBold } from '../../models/TextStyle.js';
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
            return await socket.sendMessage(remoteJid, {
                text: `╭〔 ⚠️ ${fytBold('COMANDO INVÁLIDO')} 〕⬣
┃ > Este comando solo funciona en grupos.
╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`
            }, { quoted: message });
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
                    text: `╭〔 ⚠️ ${fytBold('FALTA OBJETIVO')} 〕⬣
┃ > Menciona o responde a la persona.
┃ > Matrimonio: *${prefix}marry @usuario*
┃ > Divorcio (casado): *${prefix}marry @pareja* o *${prefix}marry*
╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`
                }, { quoted: message });
            }
        }

        if (targetJid === jidRemitente) {
            return await socket.sendMessage(remoteJid, {
                text: `╭〔 ❌ ${fytBold('COMANDO INVÁLIDO')} 〕⬣
┃ > No puedes usar este comando contigo mismo.
╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`
            }, { quoted: message });
        }

        const partner = getGroupUser(db, remoteJid, targetJid, {});

        // ——— Confirmar solicitud activa ———
        if (pending && pending.to === jidRemitente && pending.from === targetJid) {
            if (pending.type === 'marry') {
                if (user.marriedTo || partner.marriedTo) {
                    clearMarriagePending(group);
                    saveDB(db);
                    return await socket.sendMessage(remoteJid, {
                        text: `╭〔 ❌ ${fytBold('OPERACIÓN NO PERMITIDA')} 〕⬣
┃ > Ya no es posible casarse: uno de los dos ya está casado/a.
╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`
                    }, { quoted: message });
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
                    return await socket.sendMessage(remoteJid, {
                        text: `╭〔 ❌ ${fytBold('ERROR')} 〕⬣
┃ > El matrimonio ya no es válido o no coincide.
╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`
                    }, { quoted: message });
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
                text: `╭〔 ⏳ ${fytBold('SOLICITUD PENDIENTE')} 〕⬣
┃ > Ya enviaste una solicitud de *${pending.type === 'marry' ? 'matrimonio' : 'divorcio'}*.
┃ > Espera que @${pending.to.split('@')[0]} confirme con *${prefix}marry*.
┃ > Tiempo restante: *${left}*
╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`,
                mentions: [pending.to]
            }, { quoted: message });
        }

        if (pending && pending.from !== jidRemitente && pending.to !== jidRemitente) {
            const left = formatTimeLeft(pending.expiresAt);
            return await socket.sendMessage(remoteJid, {
                text: `╭〔 ⏳ ${fytBold('SOLICITUD ACTIVA')} 〕⬣
┃ > Hay otra solicitud en curso entre @${pending.from.split('@')[0]} y @${pending.to.split('@')[0]}.
┃ > Tiempo restante: *${left}*
╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`
            }, { quoted: message });
        }

        // ——— Iniciar divorcio ———
        if (user.marriedTo) {
            if (user.marriedTo !== targetJid) {
                return await socket.sendMessage(remoteJid, {
                    text: `╭〔 ❌ ${fytBold('NO PUEDES DIVORCIAR')} 〕⬣
┃ > Estás casado/a con @${user.marriedTo.split('@')[0]}.
┃ > Usa *${prefix}marry @${user.marriedTo.split('@')[0]}* para solicitar divorcio.
╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`,
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
            return await socket.sendMessage(remoteJid, {
                text: `╭〔 ❌ ${fytBold('YA CASADO/A')} 〕⬣
┃ > Esa persona ya está casada en este grupo.
╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`
            }, { quoted: message });
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
