const groupMetadataCache = new Map();
const lidCache = new Map();

const metadataTTL = 300000; // 5 minutos

const pendingMetadataRequests = new Map();

/**
 * Convierte un número/JID normal a JID de WhatsApp.
 *
 * Si recibe un @lid, no intenta convertirlo aquí porque
 * necesita información adicional para resolverlo.
 */
function normalizeToJid(phone) {
  if (!phone) return null;

  if (
    typeof phone === "string" &&
    phone.endsWith("@lid")
  ) {
    return null;
  }

  const base =
    typeof phone === "number"
      ? phone.toString()
      : phone.replace(/\D/g, "");

  return base
    ? `${base}@s.whatsapp.net`
    : null;
}

/**
 * Resuelve un LID de WhatsApp a su JID real.
 *
 * Orden:
 *
 * 1. Cache
 * 2. signalRepository.lidMapping
 * 3. Metadata del grupo
 * 4. Fallback al LID si no se pudo resolver
 */
export async function resolveLidToRealJid(
  lid,
  client,
  remoteJid,
) {
  const input = lid?.toString().trim();

  if (!input) {
    return input;
  }

  const isGroup =
    remoteJid?.endsWith("@g.us");

  const isLid =
    input.endsWith("@lid") ||
    input.includes("@hosted.lid");

  /*
   * ============================================================
   * NO ES LID
   * ============================================================
   */

  if (!isLid) {
    const base = input
      .split("@")[0]
      .split(":")[0];

    if (!base) {
      return input;
    }

    return `${base}@s.whatsapp.net`;
  }

  /*
   * ============================================================
   * CACHE DE LIDS
   * ============================================================
   */

  if (lidCache.has(input)) {
    return lidCache.get(input);
  }

  /*
   * ============================================================
   * RESOLVER MEDIANTE SIGNAL REPOSITORY
   * ============================================================
   */

  if (
    client?.signalRepository?.lidMapping?.getPNForLID
  ) {
    try {
      const cleanLid =
        `${input.split("@")[0].split(":")[0]}@lid`;

      const pn =
        await client.signalRepository
          .lidMapping
          .getPNForLID(cleanLid);

      if (pn) {
        const resolvedJid =
          pn.split(":")[0];

        const resolvedNormalized =
          resolvedJid.endsWith("@s.whatsapp.net")
            ? resolvedJid
            : `${resolvedJid}@s.whatsapp.net`;

        lidCache.set(
          input,
          resolvedNormalized,
        );

        return resolvedNormalized;
      }
    } catch (e) {
      console.error(
        "[resolveLidToRealJid] Error resolviendo LID mediante signalRepository:",
        e,
      );
    }
  }

  /*
   * ============================================================
   * CHAT PRIVADO
   * ============================================================
   *
   * Si no es grupo y no pudimos resolver el LID,
   * devolvemos el LID limpio.
   */

  if (!isGroup) {
    return `${input
      .split("@")[0]
      .split(":")[0]}@lid`;
  }

  /*
   * ============================================================
   * GRUPOS
   * ============================================================
   */

  if (
    input.endsWith("@s.whatsapp.net") &&
    !input.includes(":")
  ) {
    return input;
  }

  const cached =
    groupMetadataCache.get(remoteJid);

  let metadata;

  /*
   * ============================================================
   * OBTENER METADATA DEL GRUPO
   * ============================================================
   */

  if (
    !cached ||
    Date.now() - cached.timestamp > metadataTTL
  ) {
    /*
     * Evitar varias solicitudes simultáneas
     * de metadata para el mismo grupo.
     */

    if (
      pendingMetadataRequests.has(remoteJid)
    ) {
      metadata =
        await pendingMetadataRequests.get(
          remoteJid,
        );
    } else {
      const fetchPromise =
        (async () => {
          try {
            const res =
              await client.groupMetadata(
                remoteJid,
              );

            groupMetadataCache.set(
              remoteJid,
              {
                metadata: res,
                timestamp: Date.now(),
              },
            );

            return res;
          } catch (error) {
            if (cached?.metadata) {
              return cached.metadata;
            }

            throw error;
          } finally {
            pendingMetadataRequests.delete(
              remoteJid,
            );
          }
        })();

      pendingMetadataRequests.set(
        remoteJid,
        fetchPromise,
      );

      try {
        metadata =
          await fetchPromise;
      } catch {
        return `${input
          .split("@")[0]
          .split(":")[0]}@lid`;
      }
    }
  } else {
    metadata = cached.metadata;
  }

  if (!metadata) {
    return `${input
      .split("@")[0]
      .split(":")[0]}@lid`;
  }

  /*
   * ============================================================
   * BUSCAR EL LID ENTRE LOS PARTICIPANTES
   * ============================================================
   */

  const lidBase =
    input
      .split("@")[0]
      .split(":")[0];

  for (
    const p of metadata.participants || []
  ) {
    const pIdBase =
      p?.id
        ?.split("@")[0]
        ?.split(":")[0];

    const pJidBase =
      p?.jid
        ?.split("@")[0]
        ?.split(":")[0];

    /*
     * Intentar obtener el número real.
     */

    const phone =
      normalizeToJid(
        p?.phoneNumber,
      ) ||
      (
        pJidBase &&
        !p?.jid?.endsWith("@lid")
          ? `${pJidBase}@s.whatsapp.net`
          : null
      );

    /*
     * Encontramos al participante.
     */

    if (
      pIdBase === lidBase ||
      pJidBase === lidBase
    ) {
      /*
       * Si tenemos teléfono real,
       * guardarlo en cache.
       */

      if (phone) {
        lidCache.set(
          input,
          phone,
        );

        return phone;
      }

      /*
       * ========================================================
       * FALLBACK
       * ========================================================
       *
       * Si no tenemos teléfono pero el participante
       * sí posee un LID válido, conservar ese LID.
       */

      const fallbackLid =
        p?.id?.endsWith("@lid")
          ? p.id
          : (
              p?.jid?.endsWith("@lid")
                ? p.jid
                : null
            );

      if (fallbackLid) {
        const cleanFallback =
          `${fallbackLid
            .split("@")[0]
            .split(":")[0]}@lid`;

        lidCache.set(
          input,
          cleanFallback,
        );

        return cleanFallback;
      }
    }
  }

  /*
   * ============================================================
   * ÚLTIMO FALLBACK
   * ============================================================
   */

  const cleanInput =
    `${lidBase}@lid`;

  return cleanInput;
}

/**
 * Limpia caches de LID.
 *
 * Se puede utilizar cuando Baileys actualice
 * información de participantes.
 */
export function clearLidCache() {
  lidCache.clear();
}

/**
 * Limpia metadata cacheada de un grupo específico.
 */
export function clearGroupMetadataCache(
  remoteJid,
) {
  if (remoteJid) {
    groupMetadataCache.delete(
      remoteJid,
    );
  }
}

/**
 * Script de estilos
 */
export const fyt = (texto) => {
  const mapa = {
    a: "𝐚",
    b: "𝐛",
    c: "𝐜",
    d: "𝐝",
    e: "𝐞",
    f: "𝐟",
    g: "𝐠",
    h: "𝐡",
    i: "𝐢",
    j: "𝐣",
    k: "𝐤",
    l: "𝐥",
    m: "𝐦",
    n: "𝐧",
    o: "𝐨",
    p: "𝐩",
    q: "𝐪",
    r: "𝐫",
    s: "𝐬",
    t: "𝐭",
    u: "𝐮",
    v: "𝐯",
    w: "𝐰",
    x: "𝐱",
    y: "𝐲",
    z: "𝐳",

    A: "𝐀",
    B: "𝐁",
    C: "𝐂",
    D: "𝐃",
    E: "𝐄",
    F: "𝐅",
    G: "𝐆",
    H: "𝐇",
    I: "𝐈",
    J: "𝐉",
    K: "𝐊",
    L: "𝐋",
    M: "𝐌",
    N: "𝐍",
    O: "𝐎",
    P: "𝐏",
    Q: "𝐐",
    R: "𝐑",
    S: "𝐒",
    T: "𝐓",
    U: "𝐔",
    V: "𝐕",
    W: "𝐖",
    X: "𝐗",
    Y: "𝐘",
    Z: "𝐙",
  };

  return texto
    .split("")
    .map(
      (letra) =>
        mapa[letra] || letra,
    )
    .join("");
};