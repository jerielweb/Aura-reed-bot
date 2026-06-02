import fs from 'fs/promises';
import path from 'path';

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const CLEAN_DIRS = ['tmp', 'scratch'];

function isStale(mtimeMs) {
  return Date.now() - mtimeMs >= THIRTY_DAYS_MS;
}

async function removeOldEntries(folderPath) {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = path.join(folderPath, entry.name);
      try {
        const stats = await fs.stat(entryPath);

        if (entry.isDirectory()) {
          await removeOldEntries(entryPath);
          const remaining = await fs.readdir(entryPath);
          if (remaining.length === 0) {
            await fs.rmdir(entryPath);
            console.log(`[cleanCache] Removed empty folder: ${entryPath}`);
          }
        } else if (isStale(stats.mtimeMs)) {
          await fs.rm(entryPath, { force: true });
          console.log(`[cleanCache] Removed stale file: ${entryPath}`);
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(`[cleanCache] Error procesando ${entryPath}:`, err.message);
        }
      }
    }
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error(`[cleanCache] Error leyendo carpeta ${folderPath}:`, err.message);
    }
  }
}

async function cleanCache() {
  console.log('[cleanCache] Iniciando limpieza de cache...');
  for (const dir of CLEAN_DIRS) {
    const folderPath = path.resolve(dir);
    await removeOldEntries(folderPath);
  }
  console.log('[cleanCache] Limpieza de cache completada.');
}

export async function runCleanCacheIfNeeded(db, saveDB) {
  const now = Date.now();
  const lastRun = db.cleanCacheLastRun || 0;

  if (now - lastRun >= THIRTY_DAYS_MS) {
    await cleanCache();
    db.cleanCacheLastRun = now;
    await saveDB(db, { immediate: true });
    console.log('[cleanCache] Registro de última ejecución actualizado.');
  } else {
    const nextRun = THIRTY_DAYS_MS - (now - lastRun);
    console.log(`[cleanCache] No es necesario ejecutar aún. Próximo intento en ${Math.round(nextRun / 1000 / 60 / 60 / 24)} días.`);
  }
}

export function startCleanCacheInterval(db, saveDB) {
  setInterval(() => {
    runCleanCacheIfNeeded(db, saveDB).catch(err => console.error('[cleanCache] Error en intervalo:', err.message));
  }, THIRTY_DAYS_MS);
}
