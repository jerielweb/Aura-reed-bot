import { getGroupUser } from "./groupDb.js";

/**
 * Crea un objeto "ctx" compatible con la lógica original del sistema gacha,
 * mapeado sobre las primitivas de Aura Reed (socket, message, args, extra).
 */
export function makeGachaCtx(socket, message, args, extra) {
  const { db, saveDB, jidRemitente, isOwner, prefix } = extra;
  const remoteJid = message.key.remoteJid;
  const sender = jidRemitente;

  const fullText =
    message.message?.conversation ||
    message.message?.extendedTextMessage?.text ||
    message.message?.imageMessage?.caption ||
    "";

  return {
    sender,
    args,
    msg: message,
    chatId: remoteJid,
    sock: socket,
    isOwner: !!isOwner,
    fullText,
    usedPrefix: prefix || ".",

    reply: async (text, mentions) =>
      socket.sendMessage(
        remoteJid,
        mentions && mentions.length ? { text, mentions } : { text },
        { quoted: message },
      ),

    /** Suma (o resta, con negativos) monedas al usuario dentro de la economía del grupo actual. */
    addCoins: (amount, targetJid = sender) => {
      const user = getGroupUser(db, remoteJid, targetJid, { coins: 0, bank: 0 });
      user.coins = Math.max(0, (user.coins || 0) + amount);
      saveDB(db);
      return user.coins;
    },

    getCoins: (targetJid = sender) => {
      const user = getGroupUser(db, remoteJid, targetJid, { coins: 0, bank: 0 });
      return user.coins || 0;
    },
  };
}
