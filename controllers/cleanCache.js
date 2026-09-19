import fs from "fs/promises";
import path from "path";
import chalk from "chalk";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

const CACHE_TTL_MS = Number(process.env.AURA_CACHE_TTL_MS || 1800000);
let cleaningCache = false;
let cacheTimer = null;

function getCleanDirs() {
  const configuredCacheDir = process.env.AURA_DOWNLOAD_CACHE;
  const dirs = ["cache", "scratch", "tmp", "temp"];

  if (configuredCacheDir) dirs.push(configuredCacheDir);

  return [...new Set(dirs.map(dir => {
    const resolved = path.resolve(projectRoot, dir);
    return resolved.startsWith(projectRoot) ? resolved : null;
  }).filter(Boolean))];
}

async function removeOldEntries(folderPath, threshold) {
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });

    await Promise.all(entries.map(async (entry) => {
      const entryPath = path.join(folderPath, entry.name);
      try {
        if (entry.isDirectory()) {
          await removeOldEntries(entryPath, threshold);
          const remaining = await fs.readdir(entryPath).catch(() => []);
          if (remaining.length === 0) {
            await fs.rm(entryPath, { recursive: true, force: true });
          }
        } else {
          const stats = await fs.stat(entryPath);
          if (stats.mtimeMs < threshold) {
            await fs.rm(entryPath, { force: true });
          }
        }
      } catch (err) {}
    }));
  } catch (err) {}
}

export async function runCleanCacheIfNeeded(db, saveDB) {
  if (cleaningCache) return;
  
  const now = Date.now();
  if (now - (db.cleanCacheLastRun || 0) < CACHE_TTL_MS) return;

  cleaningCache = true;
  try {
    const threshold = Date.now() - CACHE_TTL_MS;
    await Promise.all(getCleanDirs().map(dir => removeOldEntries(dir, threshold)));
    
    db.cleanCacheLastRun = Date.now();
    await saveDB(db, { immediate: true });
  } catch (err) {
    console.error(chalk.red("[cleanCache] Error:"), err.message);
  } finally {
    cleaningCache = false;
  }
}

function scheduleNextRun(db, saveDB) {
  const delay = Math.min(Math.max(0, CACHE_TTL_MS - (Date.now() - (db.cleanCacheLastRun || 0))), 2147483647);
  
  if (cacheTimer) clearTimeout(cacheTimer);
  
  cacheTimer = setTimeout(async () => {
    await runCleanCacheIfNeeded(db, saveDB);
    scheduleNextRun(db, saveDB);
  }, delay);
}

export function startCleanCacheTimer(db, saveDB) {
  scheduleNextRun(db, saveDB);
}
