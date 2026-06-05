import axios from 'axios';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from '@ffprobe-installer/ffprobe';
import fs from 'fs';
import path from 'path';
import { ensureDirectory, downloadStreamToFile, ffmpegSemaphore } from './downloadUtils.js';

// CONFIGURACIÓN CRUCIAL: Forzamos el uso de los binarios estáticos integrados con soporte AV1
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

class YTDownloader {
    constructor() {
        this.tempDir = path.resolve('./tmp');
        ensureDirectory(this.tempDir);
    }

    getVideoId(url) {
        if (!url) return null;
        const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(regex);
        return match ? match[1] : `yt_${Date.now()}`; 
    }

    async raceApis(url, type = 'audio') {
        const apis = [
            {
                name: 'ApiCausa',
                fn: async () => {
                    const endpoint = type === 'audio' ? 'api/v1/descargas/youtube' : 'api/v1/descargas/youtubev2';
                    const typeParam = type === 'audio' ? 'mp3' : 'video';
                    const qualityParam = type === 'audio' ? '' : '&quality=720';
                    const res = await axios.get(`${global.Apis.apiCausa.url}${endpoint}?apikey=${global.Apis.apiCausa.apikey}&url=${encodeURIComponent(url)}&type=${typeParam}${qualityParam}`, { timeout: 60000 });
                    return res.data?.data?.download?.url || res.data?.result?.url;
                }
            },
            {
                name: 'AppiFaa',
                fn: async () => {
                    const endpoint = type === 'audio' ? 'faa/ytmp3' : 'faa/ytmp4';
                    const res = await axios.get(`${global.Apis.appiFaa.url}${endpoint}?url=${encodeURIComponent(url)}`, { timeout: 20000 });
                    return res.data?.result?.download_url || res.data?.result?.url || res.data?.url;
                }
            },
            {
                name: 'Delirius',
                fn: async () => {
                    const endpoint = type === 'audio' ? 'download/ytmp3' : 'download/ytmp4';
                    const res = await axios.get(`${global.Apis.deliriusApi.url}${endpoint}?url=${encodeURIComponent(url)}`, { timeout: 20000 });
                    return res.data?.data?.download || res.data?.result?.url || res.data?.url;
                }
            }
        ];

        try {
            return await Promise.any(apis.map(api => api.fn().then(resUrl => {
                if (!resUrl || typeof resUrl !== 'string') throw new Error(`[${api.name}] No devolvió URL válida`);
                console.log(`[Carrera] Ganador: ${api.name}`);
                return resUrl;
            })));
        } catch (e) {
            console.error('[Carrera] Todas las APIs fallaron:', e.errors || e.message);
            throw new Error('Todas las APIs de descarga están saturadas o caídas. Intenta más tarde.');
        }
    }

    async getAudio(url) {
        const videoId = this.getVideoId(url);
        const cachePath = path.join(this.tempDir, `${videoId}.mp3`);

        if (fs.existsSync(cachePath)) {
            console.log(`[Caché] Cargando audio: ${videoId}`);
            return cachePath;
        }

        const downloadUrl = await this.raceApis(url, 'audio');
        await downloadStreamToFile(downloadUrl, cachePath, { timeout: 60000 });

        return cachePath;
    }

    async getVideo(url) {
        const videoId = this.getVideoId(url);
        const cachePath = path.join(this.tempDir, `${videoId}.mp4`);

        if (fs.existsSync(cachePath)) {
            console.log(`[Caché] Cargando video: ${videoId}`);
            return cachePath;
        }

        const downloadUrl = await this.raceApis(url, 'video');
        const tempIn = path.join(this.tempDir, `raw_${videoId}.mp4`);
        
        await downloadStreamToFile(downloadUrl, tempIn, { timeout: 60000 });

        await ffmpegSemaphore.run(() => new Promise((resolve, reject) => {
            ffmpeg(tempIn)
                .outputOptions([
                    '-c:v libx264',
                    '-preset ultrafast',
                    '-profile:v baseline',
                    '-level 3.0',
                    '-pix_fmt yuv420p',
                    '-c:a aac',
                    '-movflags +faststart'
                ])
                .on('error', (err) => {
                    console.error('[FFmpeg Error]:', err.message);
                    reject(err);
                })
                .on('end', resolve)
                .save(cachePath);
        }));

        if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
        return cachePath;
    }
}

export default new YTDownloader();