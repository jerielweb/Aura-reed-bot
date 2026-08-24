import fs from "fs";
import path from "path";

// Asegúrate de poner la ruta real de tu carpeta tmp aquí
const tmpDir = path.join(process.cwd(), "tmp"); 

try {
  const stats = fs.statfsSync(tmpDir);
  const freeMB = (stats.bfree * stats.bsize) / (1024 * 1024);
  const totalMB = (stats.blocks * stats.bsize) / (1024 * 1024);
  const usedMB = totalMB - freeMB;

  console.log(`Espacio total del disco: ${totalMB.toFixed(2)} MB`);
  console.log(`Espacio usado: ${usedMB.toFixed(2)} MB`);
  console.log(`¡Espacio libre real: ${freeMB.toFixed(2)} MB!`);
} catch (e) {
  console.error("Error leyendo el disco:", e.message);
}
