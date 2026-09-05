export const activeHangmanGames = new Map();

export function getBotId(sock) {
  // Los sub-bots tienen subBotId propio; el bot principal usa su jid
  return sock.subBotId || sock.user?.id?.split(":")[0] || "main";
}

export function gameKey(sock, remoteJid) {
  return `${getBotId(sock)}:${remoteJid}`;
}
