import { convert, extractVideoId, formatDuration } from './youtube-downloader-mp3-mp4.js'; // Ajusta la ruta si tu archivo se llama diferente

async function runTests() {
  console.log("🧪 Iniciando pruebas del nuevo módulo de conversión...\n");

  const testUrl = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";

  // 1. Probar extracción de ID
  console.log("1️⃣ Probando extractVideoId...");
  const videoId = extractVideoId(testUrl);
  console.log(`- URL: ${testUrl}`);
  console.log(`- ID Extraído: ${videoId}\n`);

  if (!videoId) {
    console.error("❌ Error: No se pudo extraer el ID. Se detienen las pruebas.");
    return;
  }

  // 2. Probar proceso de conversión y obtención de enlace directo
  try {
    console.log("2️⃣ Probando convert (esto puede tardar unos segundos mientras el servidor procesa)...");
    const startTime = Date.now();
    
    // Puedes cambiar '720p' o '1080p' según lo que necesites
    const result = await convert(testUrl, '720p');
    
    const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log(`- Título: ${result.title}`);
    console.log(`- ID del Video: ${result.videoId}`);
    console.log(`- Calidad seleccionada: ${result.selectedQuality}`);
    console.log(`- Duración: ${formatDuration(result.duration)} (${result.duration}s)`);
    console.log(`- URL de descarga directa: ${result.downloadUrl.substring(0, 60)}...`);
    console.log(`⏱️ Tiempo de proceso: ${elapsedTime} segundos`);
    console.log("✅ ¡Conversión completada con éxito!\n");
  } catch (error) {
    console.error("❌ Error en convert:", error.message, "\n");
  }

  console.log("🏁 Pruebas finalizadas.");
}

runTests();
