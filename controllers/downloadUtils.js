import axios from 'axios';
import fs from 'fs';
import { pipeline } from 'stream/promises';

export function ensureDirectory(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

export async function fetchJson(url, timeout = 30000) {
    const res = await axios.get(url, {
        timeout,
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
    });
    return res.data;
}

export async function firstSuccessfulPromise(promises) {
    return new Promise((resolve, reject) => {
        const errors = [];
        let completed = 0;

        if (!Array.isArray(promises) || promises.length === 0) {
            reject(new Error('No hay tareas disponibles para procesar.'));
            return;
        }

        promises.forEach((promise) => {
            Promise.resolve(promise)
                .then((result) => {
                    if (result) {
                        resolve(result);
                    } else {
                        throw new Error('Respuesta vacía o inválida');
                    }
                })
                .catch((error) => {
                    errors.push(error);
                })
                .finally(() => {
                    completed += 1;
                    if (completed === promises.length) {
                        reject(new Error('Todos los servidores fallaron: ' + errors.map((e) => e.message).join(' | ')));
                    }
                });
        });
    });
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
            if (typeof resolve === 'function') resolve();
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
        const response = await axios.get(url, {
            url,
            method: 'GET',
            responseType: 'stream',
            timeout,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...headers
            }
        });

        await pipeline(response.data, fs.createWriteStream(filePath));
        return filePath;
    });
}
