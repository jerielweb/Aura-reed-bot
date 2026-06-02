import { resolveLidToRealJid } from '../../models/utils.js';
import { ensureGroup, getGroupUser } from '../../models/groupDb.js';
import { fytBold } from '../../models/TextStyle.js';
import {
    getMarriagePending,
    setMarriagePending,
    clearMarriagePending,
    formatTimeLeft
} from '../../models/marriageUtils.js';

async function resolveTargetFromMessage(message, socket, remoteJid) {
    const ctx = message.message?.extendedTextMessage?.contextInfo;
    let targetJid = null;
    if (ctx?.mentionedJid?.length > 0) targetJid = ctx.mentionedJid[0];
    else if (ctx?.participant) targetJid = ctx.participant;
    if (!targetJid) return null;
    return resolveLidToRealJid(targetJid, socket, remoteJid);
}

export default {
    name: ['divorce', 'divorciar', 'separar'],
    category: 'profile',
    description: 'Solicitar divorcio.',
    execute: async (socket, message, args, { db, saveDB, jidRemitente, prefix }) => {
        const remoteJid = message.key.remoteJid;
        if (!remoteJid.endsWith('@g.us')) {
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕━━⬣\n`;
            text += `${fytBold('ACCION INCONPATIBLE')} \n╰━━━━━━━━━━━━⬣\n\n`;
            text += `> Este comando solo funciona en grupos.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ALERT')} 〕⬣`;
            return await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        const group = ensureGroup(db, remoteJid);
        const user = getGroupUser(db, remoteJid, jidRemitente, {});
        let targetJid = await resolveTargetFromMessage(message, socket, remoteJid);
        const pending = getMarriagePending(group);

        if (!targetJid && pending?.to === jidRemitente) {
            targetJid = pending.from;
        }

        if (!targetJid) {
            if (user.marriedTo) {
                targetJid = user.marriedTo;
            } else {
                let text = `╭〔 ⚠️ ${fytBold('FALTA OBJETIVO')} 〕⬣\n`;
                text += `┃ > Menciona o responde a la persona.\n`;
                text += `┃ > Divorcio: *${prefix}divorce @pareja*\n`;
                text += `┃ > Matrimonio: *${prefix}marry @usuario*\n`;
                text += `╰〔 ⚡ ${fytBold('SYSTEM INFO')} 〕⬣`;
                return await socket.sendMessage(remoteJid, { text }, { quoted: message });
            }
        }

        if (targetJid === jidRemitente) {
            let text = `╭〔 ❌ ${fytBold('AURA REED')} 〕⬣\n`;
            text += `${fytBold('ACCIÓN INVÁLIDA')}\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ > No puedes usar este comando contigo mismo.\n\n`;
            text += `╰〔 ⚡ ${fytBold('SYSTEM ERROR')} 〕⬣`;
            return await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        const partner = getGroupUser(db, remoteJid, targetJid, {});

        if (pending && pending.to === jidRemitente && pending.from === targetJid) {
            if (pending.type !== 'divorce') {
                let text = `╭〔 ❌ ${fytBold('ERROR')} 〕⬣\n`;
                text += `┃ > Esta solicitud no es de divorcio.\n`;
                text += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;
                return await socket.sendMessage(remoteJid, { text }, { quoted: message });
            }

            if (user.marriedTo !== targetJid || partner.marriedTo !== jidRemitente) {
                clearMarriagePending(group);
                saveDB(db);
                let text = `╭〔 ❌ ${fytBold('ERROR')} 〕⬣\n`;
                text += `┃ > El matrimonio ya no es válido o no coincide.\n`;
                text += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;
                return await socket.sendMessage(remoteJid, { text }, { quoted: message });
            }

            user.marriedTo = null;
            partner.marriedTo = null;
            clearMarriagePending(group);
            saveDB(db);

            let text = `╭〔 💔 ${fytBold('DIVORCIO')} 〕⬣\n`;
            text += `┃ ✅ ${fytBold('CONFIRMADO')}\n`;
            text += `╰━━━━━━━━━━━━⬣\n\n`;
            text += `┃ @${jidRemitente.split('@')[0]} y @${targetJid.split('@')[0]}\n`;
            text += `┃ han terminado su matrimonio.\n\n`;
            text += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;
            return await socket.sendMessage(remoteJid, { text, mentions: [jidRemitente, targetJid] }, { quoted: message });
        }

        if (pending && pending.from === jidRemitente) {
            if (pending.type === 'divorce') {
                const left = formatTimeLeft(pending.expiresAt);
                let text = `╭〔 ⏳ ${fytBold('SOLICITUD PENDIENTE')} 〕⬣\n`;
                text += `┃ > Ya enviaste una solicitud de divorcio.\n`;
                text += `┃ > Espera que @${pending.to.split('@')[0]} confirme con *${prefix}divorce*.\n`;
                text += `┃ > Tiempo restante: *${left}*\n`;
                text += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;
                return await socket.sendMessage(remoteJid, { text, mentions: [pending.to] }, { quoted: message });
            }
        }

        if (pending && pending.from !== jidRemitente && pending.to !== jidRemitente) {
            const left = formatTimeLeft(pending.expiresAt);
            let text = `╭〔 ⏳ ${fytBold('SOLICITUD ACTIVA')} 〕⬣\n`;
            text += `┃ > Hay otra solicitud en curso entre @${pending.from.split('@')[0]} y @${pending.to.split('@')[0]}.\n`;
            text += `┃ > Tiempo restante: *${left}*\n`;
            text += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;
            return await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        if (!user.marriedTo) {
            let text = `╭〔 ❌ ${fytBold('NO ESTÁS CASAD@')} 〕⬣\n`;
            text += `┃ > No estás casado/a en este grupo.\n`;
            text += `┃ > Usa *${prefix}marry @usuario* para solicitar matrimonio.\n`;
            text += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;
            return await socket.sendMessage(remoteJid, { text }, { quoted: message });
        }

        if (user.marriedTo !== targetJid) {
            let text = `╭〔 ❌ ${fytBold('NO PUEDES DIVORCIAR')} 〕⬣\n`;
            text += `┃ > Estás casado/a con @${user.marriedTo.split('@')[0]}.\n`;
            text += `┃ > Usa *${prefix}divorce @${user.marriedTo.split('@')[0]}* para solicitar el divorcio correcto.\n`;
            text += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;
            return await socket.sendMessage(remoteJid, { text, mentions: [user.marriedTo] }, { quoted: message });
        }

        setMarriagePending(group, jidRemitente, targetJid, 'divorce');
        saveDB(db);
        const left = formatTimeLeft(group.marriagePending.expiresAt);
        let text = `╭〔 💔 ${fytBold('DIVORCIO')} 〕⬣\n`;
        text += `┃ ⏳ ${fytBold('ESPERANDO CONFIRMACIÓN')}\n`;
        text += `╰━━━━━━━━━━━━⬣\n\n`;
        text += `┃ @${jidRemitente.split('@')[0]} solicita divorcio.\n`;
        text += `┃ @${targetJid.split('@')[0]} confirma con:\n`;
        text += `┃ ➪ *${prefix}divorce @${jidRemitente.split('@')[0]}*\n`;
        text += `┃ ➪ o *${prefix}divorce* (respondiendo)\n\n`;
        text += `┃ ⏱️ Tiempo: *${left}*\n\n`;
        text += `╰〔 ⚡ ${fytBold('AURA REED')} 〕⬣`;
        return await socket.sendMessage(remoteJid, { text, mentions: [jidRemitente, targetJid] }, { quoted: message });
    }
};
