import fs from "fs/promises";
import path from "path";
import chalk from "chalk";

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const CLEAN_DIRS = ["tmp", "scratch"];

function isStale(mtimeMs) {
  return Date.now() - mtimeMs >= THIRTY_MINUTES_MS;
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
            console.log(
              chalk.gray(`[cleanCache] Removed empty folder: ${entryPath}`),
            );
          }
        } else if (isStale(stats.mtimeMs)) {
          await fs.rm(entryPath, { force: true });
          console.log(
            chalk.gray(`[cleanCache] Removed stale file: ${entryPath}`),
          );
        }
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error(
            chalk.red(`[cleanCache] Error procesando ${entryPath}:`),
            err.message,
          );
        }
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(
        chalk.red(`[cleanCache] Error leyendo carpeta ${folderPath}:`),
        err.message,
      );
    }
  }
}

let cleaningCache = false;
let cacheTimer = null;
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

async function cleanCache() {
  console.log(chalk.gray("[cleanCache] Iniciando limpieza de cache..."));
  for (const dir of CLEAN_DIRS) {
    const folderPath = path.resolve(dir);
    await removeOldEntries(folderPath);
  }
  console.log(chalk.gray("[cleanCache] Limpieza de cache completada."));
}

export async function runCleanCacheIfNeeded(db, saveDB) {
  if (cleaningCache) {
    return;
  }

  const now = Date.now();
  const lastRun = db.cleanCacheLastRun || 0;

  if (now - lastRun < THIRTY_MINUTES_MS) {
    return;
  }

  cleaningCache = true;
  try {
    await cleanCache();
    db.cleanCacheLastRun = now;
    await saveDB(db, { immediate: true });
    console.log(
      chalk.gray("[cleanCache] Registro de última ejecución actualizado."),
    );
  } catch (err) {
    console.error(
      chalk.red("[cleanCache] Error durante la limpieza:"),
      err.message,
    );
  } finally {
    cleaningCache = false;
  }
}

function scheduleNextRun(db, saveDB) {
  const now = Date.now();
  const lastRun = db.cleanCacheLastRun || 0;
  let delay = Math.max(0, THIRTY_MINUTES_MS - (now - lastRun));

  if (delay > MAX_TIMEOUT_MS) {
    delay = MAX_TIMEOUT_MS;
  }

  if (cacheTimer) {
    clearTimeout(cacheTimer);
  }

  cacheTimer = setTimeout(async () => {
    await runCleanCacheIfNeeded(db, saveDB);
    scheduleNextRun(db, saveDB);
  }, delay);
}

export function startCleanCacheTimer(db, saveDB) {
  scheduleNextRun(db, saveDB);
}
import fs from "fs/promises";
import path from "path";
import chalk from "chalk";

const THIRTY_MINUTES_MS = 30 * 60 * 1000;
const CLEAN_DIRS = ["tmp", "scratch"];

function isStale(mtimeMs) {
  return Date.now() - mtimeMs >= THIRTY_MINUTES_MS;
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
            console.log(
              chalk.gray(`[cleanCache] Removed empty folder: ${entryPath}`),
            );
          }
        } else if (isStale(stats.mtimeMs)) {
          await fs.rm(entryPath, { force: true });
          console.log(
            chalk.gray(`[cleanCache] Removed stale file: ${entryPath}`),
          );
        }
      } catch (err) {
        if (err.code !== "ENOENT") {
          console.error(
            chalk.red(`[cleanCache] Error procesando ${entryPath}:`),
            err.message,
          );
        }
      }
    }
  } catch (err) {
    if (err.code !== "ENOENT") {
      console.error(
        chalk.red(`[cleanCache] Error leyendo carpeta ${folderPath}:`),
        err.message,
      );
    }
  }
}

let cleaningCache = false;
let cacheTimer = null;
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

async function cleanCache() {
  console.log(chalk.gray("[cleanCache] Iniciando limpieza de cache..."));
  for (const dir of CLEAN_DIRS) {
    const folderPath = path.resolve(dir);
    await removeOldEntries(folderPath);
  }
  console.log(chalk.gray("[cleanCache] Limpieza de cache completada."));
}

export async function runCleanCacheIfNeeded(db, saveDB) {
  if (cleaningCache) {
    return;
  }

  const now = Date.now();
  const lastRun = db.cleanCacheLastRun || 0;

  if (now - lastRun < THIRTY_MINUTES_MS) {
    return;
  }

  cleaningCache = true;
  try {
    await cleanCache();
    db.cleanCacheLastRun = now;
    await saveDB(db, { immediate: true });
    console.log(
      chalk.gray("[cleanCache] Registro de última ejecución actualizado."),
    );
  } catch (err) {
    console.error(
      chalk.red("[cleanCache] Error durante la limpieza:"),
      err.message,
    );
  } finally {
    cleaningCache = false;
  }
}

function scheduleNextRun(db, saveDB) {
  const now = Date.now();
  const lastRun = db.cleanCacheLastRun || 0;
  let delay = Math.max(0, THIRTY_MINUTES_MS - (now - lastRun));

  if (delay > MAX_TIMEOUT_MS) {
    delay = MAX_TIMEOUT_MS;
  }

  if (cacheTimer) {
    clearTimeout(cacheTimer);
  }

  cacheTimer = setTimeout(async () => {
    await runCleanCacheIfNeeded(db, saveDB);
    scheduleNextRun(db, saveDB);
  }, delay);
}

export function startCleanCacheTimer(db, saveDB) {
  scheduleNextRun(db, saveDB);
}
