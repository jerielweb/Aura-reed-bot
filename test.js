import { getInfo, getVideo, getAudio, extractVideoId } from './youtubeplay-mp3-mp4.js'; // Ajusta la ruta si tu archivo se llama diferente

async function runTests() {
  console.log("🧪 Iniciando pruebas del módulo de YouTube...\n");

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

  // 2. Probar obtención de información del video
  try {
    console.log("2️⃣ Probando getInfo...");
    const info = await getInfo(testUrl);
    console.log(`- Título: ${info.title}`);
    console.log(`- Autor: ${info.author}`);
    console.log(`- Duración: ${info.duration} segundos`);
    console.log(`- Calidades de video disponibles:`, info.videos);
    console.log("✅ getInfo completado con éxito.\n");
  } catch (error) {
    console.error("❌ Error en getInfo:", error.message, "\n");
  }

  // 3. Probar obtención de enlace de descarga de Video
  try {
    console.log("3️⃣ Probando getVideo (calidad 360p)...");
    const videoData = await getVideo(testUrl, '360');
    console.log(`- Título: ${videoData.title}`);
    console.log(`- Calidad seleccionada: ${videoData.quality}p`);
    console.log(`- URL de descarga directa: ${videoData.downloadUrl.substring(0, 60)}...`);
    console.log("✅ getVideo completado con éxito.\n");
  } catch (error) {
    console.error("❌ Error en getVideo:", error.message, "\n");
  }

  // 4. Probar obtención de enlace de descarga de Audio
  try {
    console.log("4️⃣ Probando getAudio (MP3)...");
    const audioData = await getAudio(testUrl);
    console.log(`- Título: ${audioData.title}`);
    console.log(`- Bitrate: ${audioData.bitrate} kbps`);
    console.log(`- URL de descarga directa: ${audioData.downloadUrl.substring(0, 60)}...`);
    console.log("✅ getAudio completado con éxito.\n");
  } catch (error) {
    console.error("❌ Error en getAudio:", error.message, "\n");
  }

  console.log("🏁 Pruebas finalizadas.");
}

runTests();
