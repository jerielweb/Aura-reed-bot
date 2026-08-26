import { convert, extractVideoId, formatDuration } from './youtube-downloader-mp3-mp4.js';

async function runTest() {
  try {
    console.log("Probando conversión...");
    const result = await convert("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "720p");
    console.log("¡Éxito!", result);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

runTest();
