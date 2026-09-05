import { parse, downloadInstagram, IG_REGEX } from "./instagram-downloader.js"; // Ajusta el nombre si tu archivo se llama diferente

async function runTest() {
  console.log("📸 Iniciando pruebas del módulo de VidsSave (Instagram)...\n");

  // Reemplaza con un enlace válido de prueba de Instagram (Reel o Post)
  const testUrl =
    "https://www.instagram.com/reel/Da7-hhiqfcv/?igsi=YmRxODZ1NmJsc280";

  if (!IG_REGEX.test(testUrl)) {
    console.log(
      "⚠️ El enlace de prueba no cumple con la expresión regular de Instagram, actualízalo para probar con uno real.",
    );
    return;
  }

  // 1. Probar el parseo de formatos y metadatos
  try {
    console.log(`1️⃣ Analizando enlace con parse()...`);
    const parsedData = await parse(testUrl);
    console.log(`- Título: ${parsedData.title}`);
    console.log(`- Duración: ${parsedData.duration} segundos`);
    console.log(`- Formatos encontrados: ${parsedData.formats.length}`);
    console.log("✅ parse() completado con éxito.\n");
  } catch (error) {
    console.error("❌ Error en parse():", error.message, "\n");
  }

  // 2. Probar la descarga completa optimizada (downloadInstagram)
  try {
    console.log(
      `2️⃣ Probando la extracción completa con downloadInstagram()...`,
    );
    const result = await downloadInstagram(testUrl);
    console.log(`- Tipo de contenido: ${result.type}`);
    console.log(`- Título: ${result.title}`);

    if (result.type === "video") {
      console.log(`- Calidad seleccionada: ${result.quality}`);
      console.log(`- Enlace de descarga directo: ${result.downloadUrl}`);
    } else if (result.type === "images") {
      console.log(`- Imágenes encontradas: ${result.images.length}`);
      console.log(`- Primera imagen: ${result.images[0]}`);
    }

    console.log("✅ downloadInstagram() completado con éxito.\n");
  } catch (error) {
    console.error("❌ Error en downloadInstagram():", error.message, "\n");
  }

  console.log("🏁 Pruebas de Instagram finalizadas.");
}

runTest();
