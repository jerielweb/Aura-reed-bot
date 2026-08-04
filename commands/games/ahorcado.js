import { fytBold } from "../../models/TextStyle.js";
import { createCanvas } from "canvas";

// 📌 Exportamos el mapa para poder saber desde tu index/handler si hay un juego activo
export const activeHangmanGames = new Map();

const words = [
  "javascript", "programacion", "teclado", "servidor", "codigo",
  "computadora", "desarrollo", "internet", "aplicacion", "tecnologia",
  "whatsapp", "bot", "inteligencia", "sistema", "variable"
];

// Función para generar la imagen dinámica con Canvas
async function generateHangmanImage(game) {
  const canvas = createCanvas(800, 800);
  const ctx = canvas.getContext("2d");

  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, 800, 800);

  ctx.lineWidth = 15;
  ctx.strokeStyle = "#000000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Base y poste
  ctx.beginPath();
  ctx.moveTo(250, 650);
  ctx.lineTo(650, 650);
  ctx.moveTo(550, 650);
  ctx.lineTo(550, 100);
  ctx.lineTo(350, 100);
  ctx.lineTo(350, 150);
  ctx.stroke();

  const mistakes = game.mistakes;

  // Cuerpo
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

  // Palabra censurada
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

async function sendGameState(socket, jid, game, statusMsg, quotedMsg, prefix, isOver = false) {
  const triesLeft = game.maxMistakes - game.mistakes;
  const hearts = "❤️".repeat(triesLeft) + "🖤".repeat(game.mistakes);

  let text = `╭〔 🎮 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n`;
  text += `┃ 🔤 𝐉𝐔𝐄𝐆𝐎 𝐀𝐇𝐎𝐑𝐂𝐀𝐃𝐎\n`;
  text += `╰━━━━━━━━━━━━⬣\n\n`;
  text += `┃ 📌 ${statusMsg}\n`;
  text += `┃ 🩸 ${fytBold("Vidas")} › ${hearts}\n`;

  if (game.guessedLetters.size > 0 && !isOver) {
    const usedLetters = Array.from(game.guessedLetters).map(l => l.toUpperCase()).join(", ");
    text += `┃ 🔤 ${fytBold("Letras usadas")} › ${usedLetters}\n`;
  }

  text += `\n┣━━━━━━━━━━━━⬣\n\n`;

  if (!isOver) {
    text += `┃ > Responde solo con una letra para jugar.\n`;
    text += `┃ > Usa *salir* para rendirte.\n\n`;
  }

  text += `╰━━〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 𝐀𝐂𝐓𝐈𝐕𝐄 〕━━⬣`;

  const imageBuffer = await generateHangmanImage(game);
  await socket.sendMessage(jid, { image: imageBuffer, caption: text }, { quoted: quotedMsg });
}

// 📌 Exportamos la lógica principal para que pueda usarse sin prefijo
export async function processHangmanGuess(socket, message, rawInput, prefix) {
  const input = rawInput.toLowerCase().trim();
  const remoteJid = message.key.remoteJid;
  const game = activeHangmanGames.get(remoteJid);

  if (!game) return false;

  // Evitar que el bot reste vidas si están teniendo una conversación normal en el grupo
  if (input.length > 1 && input.includes(" ") && input !== "rendirse" && input !== "salir") {
    return false;
  }

  if (input === "salir" || input === "rendirse") {
    const wordWas = game.word;
    activeHangmanGames.delete(remoteJid);
    await socket.sendMessage(
      remoteJid,
      { text: `╭〔 🏳️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ > Te has rendido.\n┃ > La palabra era: *${wordWas}*\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` },
      { quoted: message }
    );
    return true;
  }

  if (input.length === 1) {
    if (game.guessedLetters.has(input)) {
      await socket.sendMessage(remoteJid, { text: `⚠️ Ya intentaste con la letra *${input.toUpperCase()}*. Intenta con otra.` }, { quoted: message });
      return true;
    }
    game.guessedLetters.add(input);
    if (!game.word.includes(input)) game.mistakes++;
  } else {
    // Intenta adivinar la palabra entera
    if (input === game.word) {
      game.guessedLetters = new Set(game.word.split("")); 
    } else {
      game.mistakes++;
    }
  }

  const isWin = game.word.split("").every((letter) => game.guessedLetters.has(letter));
  const isLose = game.mistakes >= game.maxMistakes;

  if (isWin) {
    activeHangmanGames.delete(remoteJid);
    await sendGameState(socket, remoteJid, game, "¡Felicidades! Has ganado el juego. 🎉", message, prefix, true);
  } else if (isLose) {
    activeHangmanGames.delete(remoteJid);
    await sendGameState(socket, remoteJid, game, `¡Perdiste! 💀 La palabra era: ${fytBold(game.word)}`, message, prefix, true);
  } else {
    await sendGameState(socket, remoteJid, game, "¡Sigue adivinando!", message, prefix);
  }
  return true;
}

export default {
  name: ["ahorcado", "juego-ahorcado", "hangman"],
  category: "games",
  description: "Juega al clásico juego del ahorcado.",
  execute: async (socket, message, args, { prefix }) => {
    const remoteJid = message.key.remoteJid;
    const input = args.join(" ").toLowerCase().trim();

    let game = activeHangmanGames.get(remoteJid);

    if (!game) {
      if (input && input !== "iniciar") {
        return await socket.sendMessage(
          remoteJid,
          { text: `╭〔 ⚠️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ > No hay ningún juego activo.\n┃ > Usa *${prefix}ahorcado* para empezar.\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` },
          { quoted: message }
        );
      }

      const secretWord = words[Math.floor(Math.random() * words.length)];
      game = {
        word: secretWord,
        guessedLetters: new Set(),
        mistakes: 0,
        maxMistakes: 6,
      };
      activeHangmanGames.set(remoteJid, game);
      return sendGameState(socket, remoteJid, game, "¡Juego iniciado! Escribe una letra o la palabra completa en el chat.", message, prefix);
    }

    if (!input) {
      return sendGameState(socket, remoteJid, game, "Ya hay un juego en curso. Escribe una letra sin usar el comando.", message, prefix);
    }

    // Si escribe ".ahorcado a", también lo procesamos
    await processHangmanGuess(socket, message, input, prefix);
  },
};
