import { search, info, lyrics, related, download, extractVideoId } from './youtube-downloader-mp3-mp4.js'; // Ajusta si tu archivo tiene otro nombre

async function runTests() {
  console.log("🎵 Iniciando pruebas del módulo de YouTube Music...\n");

  const testQuery = "Never Gonna Give You Up";
  const testVideoId = "dQw4w9WgXcQ";

  // 1. Probar Búsqueda
  try {
    console.log(`1️⃣ Probando search ("${testQuery}")...`);
    const searchResult = await search(testQuery, 'songs');
    console.log(`- Total de resultados: ${searchResult.count}`);
    if (searchResult.results.length > 0) {
      const first = searchResult.results[0];
      console.log(`- Primer resultado: ${first.title} - ${first.artists?.[0]?.name || 'Desconocido'}`);
      console.log(`- VideoId: ${first.videoId}`);
    }
    console.log("✅ search completado con éxito.\n");
  } catch (error) {
    console.error("❌ Error en search:", error.message, "\n");
  }

  // 2. Probar Letras (Lyrics)
  try {
    console.log(`2️⃣ Probando lyrics para el ID: ${testVideoId}...`);
    const lyricsResult = await lyrics(testVideoId);
    console.log(`- Fuente: ${lyricsResult.source || 'No disponible'}`);
    console.log(`- Letra (extracto): ${lyricsResult.lyrics ? lyricsResult.lyrics.substring(0, 100) + '...' : 'No encontrada'}`);
    console.log("✅ lyrics completado con éxito.\n");
  } catch (error) {
    console.error("❌ Error en lyrics:", error.message, "\n");
  }

  // 3. Probar Canciones Relacionadas
  try {
    console.log(`3️⃣ Probando related para el ID: ${testVideoId}...`);
    const relatedResult = await related(testVideoId);
    console.log(`- Canciones en cola relacionadas: ${relatedResult.count}`);
    if (relatedResult.tracks.length > 0) {
      console.log(`- Siguiente sugerencia: ${relatedResult.tracks[0].title}`);
    }
    console.log("✅ related completado con éxito.\n");
  } catch (error) {
    console.error("❌ Error en related:", error.message, "\n");
  }

  // 4. Probar Descarga / Streams de Audio
  try {
    console.log(`4️⃣ Probando download (Player API) para el ID: ${testVideoId}...`);
    const downloadResult = await download(testVideoId);
    console.log(`- Título: ${downloadResult.title}`);
    console.log(`- Artista: ${downloadResult.artist}`);
    console.log(`- Formatos de audio disponibles: ${downloadResult.audioFormats?.length || 0}`);
    if (downloadResult.audioFormats?.[0]) {
      console.log(`- Ejemplo de mimesType: ${downloadResult.audioFormats[0].mimeType}`);
    }
    console.log("✅ download completado con éxito.\n");
  } catch (error) {
    console.error("❌ Error en download:", error.message, "\n");
  }

  console.log("🏁 Pruebas de YouTube Music finalizadas.");
}

runTests();
