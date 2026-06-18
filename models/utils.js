import fs from 'fs';
import path from 'path';

const groupMetadataCache = new Map();
const lidCache = new Map();
const metadataTTL = 5000; 

const LID_MAP_PATH = path.resolve('./database/lidMap.json');

// Cargar el mapa de LIDs al iniciar el módulo
try {
    if (fs.existsSync(LID_MAP_PATH)) {
        const raw = fs.readFileSync(LID_MAP_PATH, 'utf-8');
        const data = JSON.parse(raw);
        for (const [lid, jid] of Object.entries(data)) {
            lidCache.set(lid, jid);
        }
    }
} catch (e) {
    console.error('[LID-CACHE] Error cargando lidMap.json:', e);
}

// Guardar el mapa de LIDs
function saveLidCache() {
    try {
        const obj = Object.fromEntries(lidCache.entries());
        fs.mkdirSync(path.dirname(LID_MAP_PATH), { recursive: true });
        fs.writeFileSync(LID_MAP_PATH, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (e) {
        console.error('[LID-CACHE] Error guardando lidMap.json:', e);
    }
}

// Agregar una relación de LID a JID real
export function addLidMapping(lid, jid) {
    if (!lid || !jid) return;
    const cleanLid = lid.split('@')[0].split(':')[0] + '@lid';
    const cleanJid = jid.split('@')[0].split(':')[0] + '@s.whatsapp.net';
    if (cleanLid.endsWith('@lid') && cleanJid.endsWith('@s.whatsapp.net')) {
        if (lidCache.get(cleanLid) !== cleanJid) {
            lidCache.set(cleanLid, cleanJid);
            lidCache.set(lid, cleanJid); // También mapear el original por comodidad
            saveLidCache();
        }
    }
}

// Obtener JID real a partir de un LID
export function getRealJid(lid) {
    if (!lid || typeof lid !== 'string') return lid;
    if (lid.endsWith('@s.whatsapp.net') && !lid.includes(':')) return lid;
    
    // Si viene con agente o dispositivo :1, :2 etc, limpiamos
    const cleanLid = lid.split('@')[0].split(':')[0] + '@lid';
    
    if (lidCache.has(cleanLid)) return lidCache.get(cleanLid);
    if (lidCache.has(lid)) return lidCache.get(lid);
    
    return null;
}

function normalizeToJid(phone) {
    if (!phone) return null;
    const base = typeof phone === 'number' ? phone.toString() : phone.replace(/\D/g, '');
    return base ? `${base}@s.whatsapp.net` : null;
}

export async function resolveLidToRealJid(lid, client, remoteJid) {
    const input = lid?.toString().trim();
    if (!input) return input;

    // Si ya es un JID real de whatsapp, lo devolvemos limpio (sin :1 etc)
    if (input.endsWith('@s.whatsapp.net') && !input.includes(':')) {
        return input;
    }
    if (input.includes('@s.whatsapp.net')) {
        return input.split('@')[0].split(':')[0] + '@s.whatsapp.net';
    }

    // Intentar resolver desde caché persistente
    const cached = getRealJid(input);
    if (cached) return cached;

    // Si no está en caché y estamos en un grupo, intentamos poblar con metadata
    const isGroup = remoteJid?.endsWith('@g.us');
    if (isGroup && client) {
        try {
            const lidBase = input.split('@')[0].split(':')[0];
            let cachedMeta = groupMetadataCache.get(remoteJid);
            let metadata;

            if (!cachedMeta || Date.now() - cachedMeta.timestamp > metadataTTL) {
                metadata = await client.groupMetadata(remoteJid);
                groupMetadataCache.set(remoteJid, { metadata, timestamp: Date.now() });
            } else {
                metadata = cachedMeta.metadata;
            }

            for (const p of metadata.participants || []) {
                if (p.lid && p.id) {
                    addLidMapping(p.lid, p.id);
                }
            }

            const resolved = getRealJid(input);
            if (resolved) return resolved;
        } catch {
            // Silenciar error de metadata
        }
    }

    // Fallback: si no se pudo resolver, limpiamos el LID y le ponemos @s.whatsapp.net temporalmente
    const lidBase = input.split('@')[0].split(':')[0];
    return `${lidBase}@s.whatsapp.net`;
}

// Extrae asociaciones LID -> JID real del mensaje actual
export function extractLidMappingsFromMessage(m) {
    if (!m) return;
    
    // 1. Claves del mensaje
    if (m.key) {
        if (m.key.remoteJid?.endsWith('@lid') && m.key.remoteJidAlt?.endsWith('@s.whatsapp.net')) {
            addLidMapping(m.key.remoteJid, m.key.remoteJidAlt);
        }
        if (m.key.participant?.endsWith('@lid') && m.key.participantAlt?.endsWith('@s.whatsapp.net')) {
            addLidMapping(m.key.participant, m.key.participantAlt);
        }
    }
    
    // 2. ContextInfo del mensaje principal y de los tipos de mensaje conocidos
    const contextInfo = m.message?.extendedTextMessage?.contextInfo || 
                        m.message?.imageMessage?.contextInfo || 
                        m.message?.videoMessage?.contextInfo || 
                        m.message?.documentMessage?.contextInfo || 
                        m.message?.stickerMessage?.contextInfo || 
                        m.message?.audioMessage?.contextInfo || 
                        m.message?.contactMessage?.contextInfo || 
                        m.message?.contactsArrayMessage?.contextInfo;

    if (contextInfo) {
        if (contextInfo.participant?.endsWith('@lid') && contextInfo.participantAlt?.endsWith('@s.whatsapp.net')) {
            addLidMapping(contextInfo.participant, contextInfo.participantAlt);
        }
        // También del mensaje citado en contextInfo si tiene alt
        if (contextInfo.quotedMessage && contextInfo.key) {
            const qKey = contextInfo.key;
            if (qKey.remoteJid?.endsWith('@lid') && qKey.remoteJidAlt?.endsWith('@s.whatsapp.net')) {
                addLidMapping(qKey.remoteJid, qKey.remoteJidAlt);
            }
            if (qKey.participant?.endsWith('@lid') && qKey.participantAlt?.endsWith('@s.whatsapp.net')) {
                addLidMapping(qKey.participant, qKey.participantAlt);
            }
        }
    }
}

// Decorador para interceptar llamadas y resolver LIDs automáticamente en metadata
export function decorateSocketForLidResolution(sock) {
    if (!sock) return;

    const originalGroupMetadata = sock.groupMetadata;
    sock.groupMetadata = async function(jid) {
        const metadata = await originalGroupMetadata.call(sock, jid);
        if (metadata && Array.isArray(metadata.participants)) {
            for (const p of metadata.participants) {
                if (p.lid && p.id) {
                    addLidMapping(p.lid, p.id);
                }
                if (p.id && p.id.endsWith('@lid')) {
                    const realJid = getRealJid(p.id);
                    if (realJid) {
                        p.id = realJid;
                    }
                }
            }
        }
        return metadata;
    };
}


// Scrip de estilos
export const fyt = (texto) => {
    const mapa = {
        'a': '𝐚', 'b': '𝐛', 'c': '𝐜',
        'd': '𝐝', 'e': '𝐞', 'f': '𝐟',
        'g': '𝐠', 'h': '𝐡', 'i': '𝐢', 
        'j': '𝐣', 'k': '𝐤', 'l': '𝐥',
        'm': '𝐦', 'n': '𝐧', 'o': '𝐨',
        'p': '𝐩', 'q': '𝐪', 'r': '𝐫', 
        's': '𝐬', 't': '𝐭', 'u': '𝐮',
        'v': '𝐯', 'w': '𝐰', 'x': '𝐱',
        'y': '𝐲', 'z': '𝐳',

        'A': '𝐀', 'B': '𝐁', 'C': '𝐂',
        'D': '𝐃', 'E': '𝐄', 'F': '𝐅',
        'G': '𝐆', 'H': '𝐇', 'I': '𝐈', 
        'J': '𝐉', 'K': '𝐊', 'L': '𝐋',
        'M': '𝐌', 'N': '𝐍', 'O': '𝐎',
        'P': '𝐏', 'Q': '𝐐', 'R': '𝐑', 
        'S': '𝐒', 'T': '𝐓', 'U': '𝐔',
        'V': '𝐕', 'W': '𝐖', 'X': '𝐗',
        'Y': '𝐘', 'Z': '𝐙'
    };
    return texto.split('').map(letra => mapa[letra] || letra).join('');
};