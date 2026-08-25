import { jidNormalizedUser } from "@whiskeysockets/baileys";
import { fytBold } from "../../models/TextStyle.js";
import { createCanvas } from "canvas";
import { getDBSync } from "../../models/db.js";
import { activeHangmanGames, gameKey } from "../../models/gameState.js";
import { hangmanWords } from "../../controllers/gameConfig.js";

const words = hangmanWords;

// ---------- Persistencia en DB ----------
// La persistencia se guarda por remoteJid+botId dentro de db.hangmanGames,
// usando la misma key compuesta que el Map en memoria.

function serializeGame(game) {
  return {
    word: game.word,
    guessedLetters: Array.from(game.guessedLetters),
    mistakes: game.mistakes,
    maxMistakes: game.maxMistakes,
  };
}

function deserializeGame(data) {
  return {
    word: data.word,
    guessedLetters: new Set(data.guessedLetters),
    mistakes: data.mistakes,
    maxMistakes: data.maxMistakes,
    lastMessage: null,
    timeoutTimer: null,
  };
}

export function persistGame(db, saveDB, key, game) {
  if (!db) return;
  db.hangmanGames = db.hangmanGames || {};
  db.hangmanGames[key] = serializeGame(game);
  if (saveDB) saveDB(db);
}

export function removePersistedGame(db, saveDB, key) {
  if (!db || !db.hangmanGames?.[key]) return;
  delete db.hangmanGames[key];
  if (saveDB) saveDB(db);
}

export function restoreGamesFromDB(db) {
  if (!db?.hangmanGames) return;
  for (const [key, data] of Object.entries(db.hangmanGames)) {
    if (!activeHangmanGames.has(key)) {
      activeHangmanGames.set(key, deserializeGame(data));
    }
  }
}

// ---------- Render del tablero ----------

async function generateHangmanImage(game) {
  const SIZE = 1440;
  const canvas = createCanvas(SIZE, SIZE);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, SIZE, SIZE);

  ctx.lineWidth = 24;
  ctx.strokeStyle = "#000000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Horca
  ctx.beginPath();
  ctx.moveTo(400, 1130);
  ctx.lineTo(1090, 1130);
  ctx.moveTo(930, 1130);
  ctx.lineTo(930, 200);
  ctx.lineTo(600, 200);
  ctx.lineTo(600, 280);
  ctx.stroke();

  const mistakes = game.mistakes;

  if (mistakes >= 1) {
    ctx.beginPath(); ctx.arc(600, 400, 120, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#000000";
    ctx.beginPath(); ctx.arc(556, 360, 17, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(644, 360, 17, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(600, 450, 35, Math.PI, 0); ctx.stroke();
  }
  if (mistakes >= 2) { ctx.beginPath(); ctx.moveTo(600, 520); ctx.lineTo(600, 800); ctx.stroke(); }
  if (mistakes >= 3) { ctx.beginPath(); ctx.moveTo(600, 570); ctx.lineTo(430, 740); ctx.stroke(); }
  if (mistakes >= 4) { ctx.beginPath(); ctx.moveTo(600, 570); ctx.lineTo(770, 740); ctx.stroke(); }
  if (mistakes >= 5) { ctx.beginPath(); ctx.moveTo(600, 800); ctx.lineTo(470, 1020); ctx.stroke(); }
  if (mistakes >= 6) { ctx.beginPath(); ctx.moveTo(600, 800); ctx.lineTo(730, 1020); ctx.stroke(); }

  const displayWord = game.word
    .split("")
    .map((letter) => (game.guessedLetters.has(letter) ? letter.toUpperCase() : "_"))
    .join(" ");

  ctx.font = "bold 90px 'DejaVu Sans'";
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.fillText(displayWord, SIZE / 2, 1320);

  return canvas.toBuffer("image/png");
}

function resetGameTimeout(socket, remoteJid, key, game, db, saveDB) {
  if (game.timeoutTimer) clearTimeout(game.timeoutTimer);

  game.timeoutTimer = setTimeout(async () => {
    if (activeHangmanGames.has(key)) {
      activeHangmanGames.delete(key);
      removePersistedGame(db, saveDB, key);
      await socket.sendMessage(remoteJid, {
        text: `╭〔 ⏰ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ > El juego ha expirado por inactividad (5 minutos).\n┃ > La palabra era: *${game.word.toUpperCase()}*\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
      });
    }
  }, 300000); // 5 minutos
}

async function sendGameState(socket, jid, game, statusMsg, quotedMsg, prefix, isOver = false) {
  const triesLeft = game.maxMistakes - game.mistakes;
  const hearts = "❤️".repeat(triesLeft) + "🖤".repeat(game.mistakes);

  let text = `╭〔 🎮 ${fytBold("AHORCADO")} 〕⬣\n`;
  text += `┃ 📌 ${statusMsg}\n`;
  text += `┃ 🩸 ${fytBold("Vidas")} › ${hearts}\n`;
  text += `┣━━━━━━━━━━━━⬣\n\n`;
  if (game.guessedLetters.size > 0 && !isOver) {
    const usedLetters = Array.from(game.guessedLetters).map((l) => l.toUpperCase()).join(", ");
    text += `┃ 🔤 ${fytBold("Letras usadas")} › ${usedLetters}\n`;
  }

  text += `\n┣━━━━━━━━━━━━⬣\n\n`;

  if (!isOver) {
    text += `┃ > Responde a este mensaje con una letra.\n`;
    text += `┃ > Usa *salir* para rendirte.\n\n`;
  }

  text += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━\n`;

  const imageBuffer = await generateHangmanImage(game);
  const targetQuoted = game.lastMessage || quotedMsg;

  const sentMessage = await socket.sendMessage(
    jid,
    { image: imageBuffer, caption: text },
    { quoted: targetQuoted }
  );

  if (sentMessage && !isOver) {
    game.lastMessage = sentMessage;
  } else if (isOver && game.timeoutTimer) {
    clearTimeout(game.timeoutTimer);
  }
}

// ---------- Lógica de intentos ----------

export async function processHangmanGuess(socket, message, rawInput, prefix, db, saveDB) {
  const remoteJid = message.key.remoteJid;
  const key = gameKey(socket, remoteJid);
  const game = activeHangmanGames.get(key);

  if (!game) return false;

  const input = rawInput.toLowerCase().trim();

  if (!input || (input.length > 1 && input.includes(" ") && input !== "rendirse" && input !== "salir")) {
    return false;
  }

  if (input === "salir" || input === "rendirse") {
    if (game.timeoutTimer) clearTimeout(game.timeoutTimer);
    const wordWas = game.word;
    activeHangmanGames.delete(key);
    removePersistedGame(db, saveDB, key);
    await socket.sendMessage(
      remoteJid,
      { text: `╭〔 🏳️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ > Te has rendido.\n┃ > La palabra era: *${wordWas.toUpperCase()}*\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` },
      { quoted: message }
    );
    return true;
  }

  if (input.length === 1) {
    if (!/^[a-zñ]$/.test(input)) return false;

    if (game.guessedLetters.has(input)) {
      await socket.sendMessage(
        remoteJid,
        { text: `⚠️ Ya intentaste con la letra *${input.toUpperCase()}*. Intenta con otra.` },
        { quoted: message }
      );
      return true;
    }

    game.guessedLetters.add(input);

    if (!game.word.includes(input)) {
      game.mistakes++;
    }
  } else {
    if (input === game.word.toLowerCase()) {
      game.word.split("").forEach((l) => game.guessedLetters.add(l));
    } else {
      game.mistakes++;
    }
  }

  const isWin = game.word.split("").every((letter) => game.guessedLetters.has(letter));
  const isLose = game.mistakes >= game.maxMistakes;

  if (isWin) {
    if (game.timeoutTimer) clearTimeout(game.timeoutTimer);
    activeHangmanGames.delete(key);
    removePersistedGame(db, saveDB, key);

    const participantJid = jidNormalizedUser(
      message.key.participant || message.key.remoteJid
    );

    // Otorgar XP al sistema global de usuarios
    const globalDb = getDBSync();
    if (!globalDb.users) globalDb.users = {};
    if (!globalDb.users[participantJid]) {
      globalDb.users[participantJid] = { xp: 0, level: 1 };
    }

    let earnedXp = 200;
    const user = globalDb.users[participantJid];
    user.xp = (user.xp || 0) + earnedXp;
    user.level = Math.floor(user.xp / 150) + 1;

    await sendGameState(socket, remoteJid, game, `¡Felicidades! Has ganado el juego. 🎉\n┃ 🎁 Recompensa: +${earnedXp} XP`, message, prefix, true);
  } else if (isLose) {
    if (game.timeoutTimer) clearTimeout(game.timeoutTimer);
    activeHangmanGames.delete(key);
    removePersistedGame(db, saveDB, key);
    await sendGameState(socket, remoteJid, game, `¡Perdiste! 💀 La palabra era: ${fytBold(game.word.toUpperCase())}`, message, prefix, true);
  } else {
    persistGame(db, saveDB, key, game);
    resetGameTimeout(socket, remoteJid, key, game, db, saveDB);
    await sendGameState(socket, remoteJid, game, "¡Sigue adivinando!", message, prefix);
  }

  return true;
}

// ---------- Comando ----------

export default {
  name: ["ahorcado", "hangman"],
  category: "games",
  description: "Juega ahorcado",
  execute: async (socket, message, args, { prefix, db, saveDB }) => {
    const remoteJid = message.key.remoteJid;
    const key = gameKey(socket, remoteJid);
    const input = args.join(" ").toLowerCase().trim();

    let game = activeHangmanGames.get(key);

    if (game) {
      if (!input) {
        return sendGameState(socket, remoteJid, game, "⚠️ Ya hay un juego en curso. Responde a la imagen o usa el comando con una letra.", message, prefix);
      }
      return await processHangmanGuess(socket, message, input, prefix, db, saveDB);
    }

    const secretWord = words[Math.floor(Math.random() * words.length)];
    game = {
      word: secretWord,
      guessedLetters: new Set(),
      mistakes: 0,
      maxMistakes: 6,
      lastMessage: null,
      timeoutTimer: null,
    };
    activeHangmanGames.set(key, game);
    persistGame(db, saveDB, key, game);
    resetGameTimeout(socket, remoteJid, key, game, db, saveDB);

    if (input && input !== "iniciar") {
      return await processHangmanGuess(socket, message, input, prefix, db, saveDB);
    }

    return sendGameState(socket, remoteJid, game, "¡Juego iniciado!", message, prefix);
  },
};
