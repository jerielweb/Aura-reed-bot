import { fytBold } from "../../models/TextStyle.js";
import { createCanvas } from "canvas";

// Map global para mantener los juegos activos por chat
export const activeHangmanGames = new Map();

// Diccionario de palabras para el juego
const words = [
  "javascript", "programacion", "teclado", "servidor", "codigo",
  "computadora", "desarrollo", "internet", "aplicacion", "tecnologia",
  "whatsapp", "bot", "inteligencia", "sistema", "variable"
];

// Generar la imagen con Canvas recreando la base del diseño
async function generateHangmanImage(game) {
  const canvas = createCanvas(800, 800);
  const ctx = canvas.getContext("2d");

  // Fondo blanco
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, 800, 800);

  // Estilos de línea
  ctx.lineWidth = 15;
  ctx.strokeStyle = "#000000";
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  // Estructura de la horca (siempre visible)
  ctx.beginPath();
  ctx.moveTo(250, 650); // Base izquierda
  ctx.lineTo(650, 650); // Base derecha
  ctx.moveTo(550, 650); // Poste vertical
  ctx.lineTo(550, 100);
  ctx.lineTo(350, 100); // Viga superior
  ctx.lineTo(350, 150); // Cuerda
  ctx.stroke();

  const mistakes = game.mistakes;

  // Dibujar las partes del cuerpo según las vidas perdidas
  if (mistakes >= 1) { 
    // Cabeza
    ctx.beginPath(); 
    ctx.arc(350, 220, 70, 0, Math.PI * 2); 
    ctx.stroke();
    // Cara
    ctx.fillStyle = "#000000";
    ctx.beginPath(); ctx.arc(325, 200, 10, 0, Math.PI * 2); ctx.fill(); // Ojo izq
    ctx.beginPath(); ctx.arc(375, 200, 10, 0, Math.PI * 2); ctx.fill(); // Ojo der
    ctx.beginPath(); ctx.arc(350, 250, 20, Math.PI, 0); ctx.stroke();  // Boca triste
  }
  if (mistakes >= 2) { 
    // Cuerpo
    ctx.beginPath(); ctx.moveTo(350, 290); ctx.lineTo(350, 450); ctx.stroke(); 
  }
  if (mistakes >= 3) { 
    // Brazo izquierdo
    ctx.beginPath(); ctx.moveTo(350, 320); ctx.lineTo(250, 420); ctx.stroke(); 
  }
  if (mistakes >= 4) { 
    // Brazo derecho
    ctx.beginPath(); ctx.moveTo(350, 320); ctx.lineTo(450, 420); ctx.stroke(); 
  }
  if (mistakes >= 5) { 
    // Pierna izquierda
    ctx.beginPath(); ctx.moveTo(350, 450); ctx.lineTo(270, 580); ctx.stroke(); 
  }
  if (mistakes >= 6) { 
    // Pierna derecha
    ctx.beginPath(); ctx.moveTo(350, 450); ctx.lineTo(430, 580); ctx.stroke(); 
  }

  // Palabra censurada en la parte inferior
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

// Temporizador de inactividad de 5 minutos (300,000 ms)
function resetGameTimeout(socket, remoteJid, game) {
  if (game.timeoutTimer) clearTimeout(game.timeoutTimer);

  game.timeoutTimer = setTimeout(async () => {
    if (activeHangmanGames.has(remoteJid)) {
      activeHangmanGames.delete(remoteJid);
      await socket.sendMessage(remoteJid, {
        text: `╭〔 ⏰ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ > El juego ha expirado por inactividad (5 minutos).\n┃ > La palabra era: *${game.word.toUpperCase()}*\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣`,
      });
    }
  }, 300000);
}

// Función auxiliar para enviar o actualizar la imagen del juego
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
    text += `┃ > Responde a este mensaje con una letra o usa *${prefix}hangman [letra]*.\n`;
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
    resetGameTimeout(socket, jid, game);
  } else if (isOver && game.timeoutTimer) {
    clearTimeout(game.timeoutTimer);
  }
}

// Procesador de jugadas principal (interceptado o por comando)
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
    await socket.sendMessage(
      remoteJid,
      { text: `╭〔 🏳️ 𝐀𝐔𝐑𝐀 𝐑𝐄𝐄𝐃 〕⬣\n┃ > Te has rendido.\n┃ > La palabra era: *${wordWas.toUpperCase()}*\n╰〔 ⚡ 𝐒𝐘𝐒𝐓𝐄𝐌 〕⬣` },
      { quoted: message }
    );
    return true;
  }

  // Evaluar si es letra individual o palabra completa
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
    // Si escribe la palabra completa
    if (input === game.word.toLowerCase()) {
      game.word.split("").forEach((l) => game.guessedLetters.add(l));
    } else {
      game.mistakes++;
    }
  }

  // Verificar estado del juego (Victoria / Derrota) antes de borrar el map
  const isWin = game.word.split("").every((letter) => game.guessedLetters.has(letter));
  const isLose = game.mistakes >= game.maxMistakes;

  if (isWin) {
    if (game.timeoutTimer) clearTimeout(game.timeoutTimer);
    activeHangmanGames.delete(remoteJid);

    // 🎁 RECOMPENSA DE XP EN LA BASE DE DATOS
    const sender = message.key.participant || message.key.remoteJid;
    let earnedXp = 150; // Cantidad de XP de recompensa por ganar

    try {
      if (db) {
        db.users ??= {};
        db.users[sender] ??= { xp: 0, level: 1 };
        db.users[sender].xp += earnedXp;
        if (typeof saveDB === "function") saveDB(db);
      }
    } catch (e) {
      console.error("[Hangman] Error al otorgar XP:", e);
    }

    await sendGameState(socket, remoteJid, game, `¡Felicidades! Has ganado el juego. 🎉\n┃ 🎁 Recompensa: +${earnedXp} XP`, message, prefix, true);
  } else if (isLose) {
    if (game.timeoutTimer) clearTimeout(game.timeoutTimer);
    activeHangmanGames.delete(remoteJid);
    await sendGameState(socket, remoteJid, game, `¡Perdiste! 💀 La palabra era: ${fytBold(game.word.toUpperCase())}`, message, prefix, true);
  } else {
    await sendGameState(socket, remoteJid, game, "¡Sigue adivinando!", message, prefix);
  }

  return true;
}

export default {
  name: ["ahorcado", "juego-ahorcado", "hangman"],
  category: "games",
  description: "Juega al juego del ahorcado con tablero interactivo.",
  execute: async (socket, message, args, { prefix, db, saveDB }) => {
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

      // Crear nuevo juego
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
      return sendGameState(socket, remoteJid, game, "¡Juego iniciado! Escribe una letra o responde a la imagen.", message, prefix);
    }

    if (!input) {
      return sendGameState(socket, remoteJid, game, "Ya hay un juego en curso. Responde a la imagen o usa el comando con una letra.", message, prefix);
    }

    // Procesar la letra enviada mediante comando (ej. .hangman b)
    await processHangmanGuess(socket, message, input, prefix, db, saveDB);
  },
};
