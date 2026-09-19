import axios from "axios";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { pipeline } from "stream/promises";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const defaultDownloadCacheDir = path.join(projectRoot, "cache");

export function getDownloadCacheDir() {
  const cacheDir = process.env.AURA_DOWNLOAD_CACHE || defaultDownloadCacheDir;
  fs.mkdirSync(cacheDir, { recursive: true });
  return cacheDir;
}

export function getDownloadCachePath(fileName) {
  const safeFileName = path.basename(fileName);
  return path.join(getDownloadCacheDir(), safeFileName);
}

export function setDownloadCacheEnv() {
  const cacheDir = getDownloadCacheDir();
  process.env.TMPDIR = cacheDir;
  process.env.TEMP = cacheDir;
  process.env.TMP = cacheDir;
  return cacheDir;
}

export function ensureDirectory(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

export async function fetchJson(url, timeout = 30000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  try {
    const res = await axios.get(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    return res.data;
  } finally {
    clearTimeout(id);
  }
}

export async function firstSuccessfulPromise(promises) {
  if (!Array.isArray(promises) || promises.length === 0) {
    throw new Error("No hay tareas disponibles para procesar.");
  }

  try {
    return await Promise.any(
      promises.map(async (p) => {
        const result = await p;
        if (!result) throw new Error("Respuesta vacía o inválida");
        return result;
      })
    );
  } catch (error) {
    const errorMessages = error.errors ? error.errors.map(e => e.message).join(" | ") : error.message;
    throw new Error(`Todos los servidores fallaron: ${errorMessages}`);
  }
}

class Semaphore {
  constructor(maxConcurrency = 2) {
    this.maxConcurrency = maxConcurrency;
    this.current = 0;
    this.queue = [];
  }

  async acquire() {
    if (this.current < this.maxConcurrency) {
      this.current += 1;
      return;
    }
    await new Promise((resolve) => this.queue.push(resolve));
    this.current += 1;
  }

  release() {
    this.current = Math.max(this.current - 1, 0);
    if (this.queue.length > 0) {
      const resolve = this.queue.shift();
      if (typeof resolve === "function") resolve();
    }
  }

  async run(fn) {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }
}

export const downloadSemaphore = new Semaphore(Number(process.env.DOWNLOAD_CONCURRENCY || 3));
export const ffmpegSemaphore = new Semaphore(Number(process.env.FFMPEG_CONCURRENCY || 1));

export async function downloadStreamToFile(url, filePath, options = {}) {
  const { timeout = 60000, headers = {}, semaphore = downloadSemaphore } = options;

  return semaphore.run(async () => {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await axios({
        url,
        method: "GET",
        responseType: "stream",
        signal: controller.signal,
        headers: {
          "User-Agent": `AuraReedBot/${global.version || "1.0"} (https://github.com/this-xys/baileys)`,
          ...headers,
        },
      });

      await pipeline(response.data, fs.createWriteStream(filePath));
      return filePath;
    } finally {
      clearTimeout(id);
    }
  });
}
