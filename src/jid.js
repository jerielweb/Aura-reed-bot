import {
  jidNormalizedUser,
  isLidUser,
  resolveJid,
} from "@fer2809fl/baileys";

// ==================== Resolución de LID (Bail 7.x) ====================
// La versión nueva de Baileys ya no trae una función síncrona "lidToJid".
// Ahora la conversión LID -> número real vive en signalRepository.lidMapping
// (getPNForLID), que es asíncrona y solo tiene datos una vez que WhatsApp
// nos informó el mapeo (normalmente al recibir un mensaje de ese contacto).
//
// Para no tener que volver "async" a normalizeJid/addAllForms (usadas en
// más de 20 archivos de forma síncrona), mantenemos una caché en memoria
// que se llena sola en segundo plano. Si un LID todavía no se conoce,
// se devuelve tal cual (igual que pasaba antes con contactos nuevos) y
// queda resolviéndose para la próxima vez que se consulte.

const lidCache = new Map(); // lid completo -> jid normalizado (número real)
const pendingLookups = new Set(); // evita lanzar el mismo lookup varias veces
let signalRepository = null;

/**
 * Debe llamarse UNA vez, justo después de crear el socket:
 *   import { bindSignalRepository } from "./src/jid.js";
 *   bindSignalRepository(sock.signalRepository);
 */
export function bindSignalRepository(repo) {
  signalRepository = repo || null;
}

function scheduleLidResolution(lid) {
  if (!signalRepository?.lidMapping?.getPNForLID) return;
  if (pendingLookups.has(lid)) return;
  pendingLookups.add(lid);

  signalRepository.lidMapping
    .getPNForLID(lid)
    .then((pn) => {
      if (pn) lidCache.set(lid, jidNormalizedUser(pn));
    })
    .catch(() => {})
    .finally(() => pendingLookups.delete(lid));
}

// Reemplazo síncrono de la antigua lidToJid(): usa la caché si ya
// resolvimos ese LID antes; si no, dispara la resolución en segundo
// plano y devuelve el propio LID mientras tanto.
export function lidToJid(lid) {
  if (!lid || typeof lid !== "string") return lid;
  const cached = lidCache.get(lid);
  if (cached) return cached;
  scheduleLidResolution(lid);
  return lid;
}

export function normalizeJid(jid) {
  if (!jid || typeof jid !== "string") return jid;
  let result = jidNormalizedUser(jid);
  if (isLidUser(result)) result = lidToJid(result);
  return result;
}

export function jidToNumber(jid) {
  const normalized = normalizeJid(jid);
  return normalized ? normalized.split("@")[0] : "";
}

export function participantForms(participant) {
  const forms = new Set();
  for (const raw of [participant?.id, participant?.jid, participant?.lid]) {
    addAllForms(forms, raw);
  }
  return forms;
}

export function addAllForms(set, raw) {
  if (!raw || typeof raw !== "string") return;
  try {
    const norm = jidNormalizedUser(raw);
    set.add(norm);
    set.add(norm.split("@")[0]);
    if (isLidUser(norm)) {
      const asPn = lidToJid(norm);
      set.add(asPn);
      set.add(asPn.split("@")[0]);
    }
  } catch {
    set.add(raw);
    set.add(raw.split("@")[0]);
  }
}

export { resolveJid, jidNormalizedUser, isLidUser };
