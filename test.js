import fs from "fs";

function getFreeSpaceMB(dirPath) {
  try {
    const stats = fs.statfsSync(dirPath);
    // Multiplicamos los bloques libres por el tamaño de cada bloque, y lo pasamos a MB
    const freeSpaceMB = (stats.bfree * stats.bsize) / (1024 * 1024);
    return freeSpaceMB;
  } catch (error) {
    // Si por permisos o compatibilidad del sistema operativo falla, devolvemos un número alto para que no bloquee
    return 999999; 
  }
}
