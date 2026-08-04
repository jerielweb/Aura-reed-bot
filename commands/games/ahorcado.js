import { fytBold } from "../../models/TextStyle.js";
import { createCanvas } from "canvas";
import { getGroupUser } from "../../models/groupDb.js";
import { activeHangmanGames } from "../../models/gameState.js";

const words = [
  "javascript", "programacion", "teclado", "servidor", "codigo",
  "computadora", "desarrollo", "internet", "aplicacion", "tecnologia",
  "whatsapp", "bot", "inteligencia", "sistema", "variable"
];

// ---------- Persistencia en DB ----------

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

export function persistGame(db, saveDB, remoteJid, game) {
  if (!db) return;
  db.hangmanGames = db.hangmanGames || {};
  db.hangmanGames[remoteJid] = serializeGame(game);
  if (saveDB) saveDB(db);
}

export function removePersistedGame(db, saveDB, remoteJid) {
  if (!db || !db.hangmanGames?.[remoteJid]) return;
  delete db.hangmanGames[remoteJid];
  if (saveDB) saveDB(db);
}

export function restoreGamesFromDB(db) {
  if (!db?.hangmanGames) return;
  for (const [jid, data] of Object.entries(db.hangmanGames)) {
    if (!activeHangmanGames.has(jid)) {
      activeHangmanGames.set(jid, deserializeGame(data));
    }
  }
}

// ---------- Render del tablero ----------

async function generateHangmanImage(game) {
  const canvas = createCanvas(800, 800);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, 800, 800);

  ctx.lineWidth = 15;
  ctx.strokeStyle = "#000000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  ctx.moveTo(250, 650);
  ctx.lineTo(650, 650);
  ctx.moveTo(550, 650);
  ctx.lineTo(550, 100);
  ctx.lineTo(350, 100);
  ctx.lineTo(350, 150);
  ctx.stroke();

  const mistakes = game.mistakes;

  if (mistakes >= 1) {
    ctx.beginPath(); ctx.arc(350, 220, 70, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = "#000000";
    ctx.beginPath(); ctx.arc(325, 200, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(375, 200, 10, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(350, 250, 20, Math.PI, 0); ctx.stroke();
  }
  if (mistakes >= 2) { ctx.beginPath(); ctx.moveTo(350, 290); ctx.lineTo(350, 450); ctx.stroke(); }
  if (mistakes >= 3) { ctx.beginPath(); ctx.moveTo(350, 320); ctx.lineTo(250, 420); ctx.stroke(); }
  if (mistakes >= 4) { ctx.beginPath(); ctx.moveTo(350, 320); ctx.lineTo(450, 420); ctx.stroke(); }
  if (mistakes >= 5) { ctx.beginPath(); ctx.moveTo(350, 450); ctx.lineTo(270, 580); ctx.stroke(); }
  if (mistakes >= 6) { ctx.beginPath(); ctx.moveTo(350, 450); ctx.lineTo(430, 580); ctx.stroke(); }

  const displayWord = game.word
    .split("")
    .map((letter) => (game.guessedLetters.has(letter) ? letter.toUpperCase() : "_"))
    .join(" ");

  ctx.font = "bold 80px Arial";
  ctx.fillStyle = "#000000";
  ctx.textAlign = "center";
  ctx.fillText(displayWord, 400, 750);

  return canvas.toBuffer("image/png");
}

function resetGameTimeout(socket, remoteJid, game, db, saveDB) {
  if (game.timeoutTimer) clearTimeout(game.timeoutTimer);

  game.timeoutTimer = setTimeout(async () => {
    if (activeHangmanGames.has(remoteJid)) {
      activeHangmanGames.delete(remoteJid);
      removePersistedGame(db, saveDB, remoteJid);
      await socket.sendMessage(remoteJid, {
        text: `╭〔 ⏰ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ > El juego ha expirado por inactividad (5 minutos).\n┃ > La palabra era: *${game.word.toUpperCase()}*\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
      });
    }
  }, 300000); // 5 minutos
}

async function sendGameState(socket, jid, game, statusMsg, quotedMsg, prefix, isOver = false) {
  const triesLeft = game.maxMistakes - game.mistakes;
  const hearts = "❤️".repeat(triesLeft) + "🖤".repeat(game.mistakes);

  let text = `╭〔 🎮 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
  text += `┃ 🔤 𝐉𝐔𝐄𝐆𝐎 𝐀𝐇𝐎𝐑𝐂𝐀𝐃𝐎\n`;
  text += `╰━━━━━━━━━━━━⬣\n\n`;
  text += `┃ 📌 ${statusMsg}\n`;
  text += `┃ 🩸 ${fytBold("Vidas")} › ${hearts}\n`;

  if (game.guessedLetters.size > 0 && !isOver) {
    const usedLetters = Array.from(game.guessedLetters).map((l) => l.toUpperCase()).join(", ");
    text += `┃ 🔤 ${fytBold("Letras usadas")} › ${usedLetters}\n`;
  }

  text += `\n┣━━━━━━━━━━━━⬣\n\n`;

  if (!isOver) {
    text += `┃ > Responde a este mensaje con una letra o usa *${prefix}ahorcado [letra]*.\n`;
    text += `┃ > Usa *salir* para rendirte.\n\n`;
  }

  text += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

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
  const game = activeHangmanGames.get(remoteJid);

  if (!game) return false;

  const input = rawInput.toLowerCase().trim();

  if (!input || (input.length > 1 && input.includes(" ") && input !== "rendirse" && input !== "salir")) {
    return false;
  }

  if (input === "salir" || input === "rendirse") {
    if (game.timeoutTimer) clearTimeout(game.timeoutTimer);
    const wordWas = game.word;
    activeHangmanGames.delete(remoteJid);
    removePersistedGame(db, saveDB, remoteJid);
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
    activeHangmanGames.delete(remoteJid);
    removePersistedGame(db, saveDB, remoteJid);

    const user = getGroupUser(
      db,
      remoteJid,
      message.key.participant || message.key.remoteJid,
      { xp: 0 }
    );

    let earnedXp = 200;
    user.xp = (user.xp || 0) + earnedXp;
    saveDB(db);

    await sendGameState(socket, remoteJid, game, `¡Felicidades! Has ganado el juego. 🎉\n┃ 🎁 Recompensa: +${earnedXp} XP`, message, prefix, true);
  } else if (isLose) {
    if (game.timeoutTimer) clearTimeout(game.timeoutTimer);
    activeHangmanGames.delete(remoteJid);
    removePersistedGame(db, saveDB, remoteJid);
    await sendGameState(socket, remoteJid, game, `¡Perdiste! 💀 La palabra era: ${fytBold(game.word.toUpperCase())}`, message, prefix, true);
  } else {
    persistGame(db, saveDB, remoteJid, game);
    resetGameTimeout(socket, remoteJid, game, db, saveDB);
    await sendGameState(socket, remoteJid, game, "¡Sigue adivinando!", message, prefix);
  }

  return true;
}

// ---------- Comando ----------

export default {
  name: ["ahorcado", "juego-ahorcado", "hangman"],
  category: "games",
  description: "Juega al juego del ahorcado con tablero interactivo.",
  execute: async (socket, message, args, { prefix, db, saveDB }) => {
    const remoteJid = message.key.remoteJid;
    const input = args.join(" ").toLowerCase().trim();

    let game = activeHangmanGames.get(remoteJid);

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
    activeHangmanGames.set(remoteJid, game);
    persistGame(db, saveDB, remoteJid, game);
    resetGameTimeout(socket, remoteJid, game, db, saveDB);

    if (input && input !== "iniciar") {
      return await processHangmanGuess(socket, message, input, prefix, db, saveDB);
    }

    return sendGameState(socket, remoteJid, game, "¡Juego iniciado! Escribe una letra o responde a la imagen.", message, prefix);
  },
};