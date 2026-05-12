const groupMetadataCache = new Map();
const lidCache = new Map();
const metadataTTL = 5000; 

function normalizeToJid(phone) {
    if (!phone) return null;
    const base = typeof phone === 'number' ? phone.toString() : phone.replace(/\D/g, '');
    return base ? `${base}@s.whatsapp.net` : null;
}

export async function resolveLidToRealJid(lid, client, remoteJid) {
    const input = lid?.toString().trim();
    if (!input) return input;

    const isGroup = remoteJid?.endsWith('@g.us');

    // CASO 1: Chat Privado (Limpieza de :1 o similares)
    if (!isGroup) {
        const numeroLimpio = input.split('@')[0].split(':')[0];
        return `${numeroLimpio}@s.whatsapp.net`;
    }

    // CASO 2: Grupos (Resolución de LID a número real)
    if (input.endsWith('@s.whatsapp.net') && !input.includes(':')) return input;
    if (lidCache.has(input)) return lidCache.get(input);

    const lidBase = input.split('@')[0].split(':')[0];
    let cached = groupMetadataCache.get(remoteJid);
    let metadata;

    if (!cached || Date.now() - cached.timestamp > metadataTTL) {
        try {
            metadata = await client.groupMetadata(remoteJid);
            groupMetadataCache.set(remoteJid, { metadata, timestamp: Date.now() });
        } catch {
            return `${lidBase}@s.whatsapp.net`;
        }
    } else {
        metadata = cached.metadata;
    }

    for (const p of metadata.participants || []) {
        const idBase = p?.id?.split('@')[0]?.split(':')[0];
        const phone = normalizeToJid(p?.phoneNumber || p?.lid);
        if (idBase === lidBase && phone) {
            lidCache.set(input, phone);
            return phone;
        }
    }

    return `${lidBase}@s.whatsapp.net`;
}