import axios from 'axios';
import { Downloader } from '@tobyg74/tiktok-api-dl';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import ffprobePath from '@ffprobe-installer/ffprobe';
import fs from 'fs';
import path from 'path';
import { ensureDirectory, downloadStreamToFile, ffmpegSemaphore } from './downloadUtils.js';

// Configurar rutas de FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

class TikTokDownloader {
    constructor() {
        this.tempDir = path.resolve('./tmp');
        ensureDirectory(this.tempDir);
    }

    async search(query) {
        const faaUrl = global.Apis?.appiFaa?.url || 'https://api-faa.my.id/';
        const deliriusUrl = global.Apis?.deliriusApi?.url || 'https://api.delirius.store/';

        const apis = [
            {
                name: 'Delirius',
                fn: async () => {
                    const res = await axios.get(`${deliriusUrl}search/tiktoksearch?query=${encodeURIComponent(query)}`, { timeout: 15000 });
                    const videos = res.data?.meta;
                    if (!videos || videos.length === 0) throw new Error('No videos found in Delirius');
                    const first = videos[0];
                    return {
                        url: first.url,
                        title: first.title || '',
                        author: first.author?.nickname || first.author?.username || 'TikTok User',
                        views: first.play || 0,
                        likes: first.like || 0,
                        cover: first.hd || ''
                    };
                }
            },
            {
                name: 'Faa',
                fn: async () => {
                    const res = await axios.get(`${faaUrl}faa/tiktok-search?q=${encodeURIComponent(query)}`, { timeout: 15000 });
                    const videos = res.data?.result;
                    if (!videos || videos.length === 0) throw new Error('No videos found in Faa');
                    const first = videos[0];
                    const username = first.author?.username || '';
                    const id = first.id || '';
                    if (!username || !id) throw new Error('Incomplete data in Faa');
                    return {
                        url: `https://www.tiktok.com/@${username}/video/${id}`,
                        title: first.title || '',
                        author: first.author?.nickname || username || 'TikTok User',
                        views: first.stats?.views || 0,
                        likes: first.stats?.likes || 0,
                        cover: first.cover || ''
                    };
                }
            }
        ];

        try {
            return await Promise.any(apis.map(api => api.fn().then(result => {
                if (!result.url) throw new Error(`[${api.name}] No url returned in search`);
                console.log(`[TikTokDownloader Búsqueda] Ganador: ${api.name}`);
                return result;
            })));
        } catch (e) {
            console.error('[TikTokDownloader Búsqueda] Ambas APIs fallaron:', e.errors || e.message);
            throw new Error('No se encontraron resultados en TikTok para tu búsqueda.');
        }
    }

    async getDownloadInfo(url) {
        const faaUrl = global.Apis?.appiFaa?.url || 'https://api-faa.my.id/';
        const deliriusUrl = global.Apis?.deliriusApi?.url || 'https://api.delirius.store/';

        // Intentar tobyg74/tiktok-api-dl primero (Scraper Local)
        try {
            console.log('[TikTokDownloader] Intentando descargar metadatos con tobyg74/tiktok-api-dl...');
            const dlResult = await Downloader(url);
            if (dlResult && dlResult.status === 'success' && dlResult.result) {
                const res = dlResult.result;
                const vUrl = res.video?.playAddr?.[0] || res.video?.downloadAddr?.[0];
                if (vUrl) {
                    console.log('[TikTokDownloader] Éxito usando tobyg74/tiktok-api-dl');
                    return {
                        id: res.id,
                        title: res.desc || '',
                        author: res.author?.nickname || res.author?.username || 'TikTok User',
                        cover: res.video?.cover?.[0] || res.music?.coverThumb?.[0] || '',
                        views: res.statistics?.playCount || 0,
                        likes: res.statistics?.likeCount || 0,
                        videoUrl: vUrl,
                        audioUrl: res.music?.playUrl?.[0],
                        duration: res.music?.duration || Math.round((res.video?.duration || 0) / 1000) || 0
                    };
                }
            }
        } catch (e) {
            console.error('[TikTokDownloader] tobyg74/tiktok-api-dl falló, usando APIs de respaldo:', e.message);
        }

        // Carrera de APIs de respaldo si falla el scraper local
        const apis = [
            {
                name: 'Delirius',
                fn: async () => {
                    const res = await axios.get(`${deliriusUrl}download/tiktok?url=${encodeURIComponent(url)}`, { timeout: 20000 });
                    const data = res.data?.data;
                    if (!data) throw new Error('No data in Delirius');
                    const videoUrl = data.meta?.media?.find(m => m.type === 'video')?.org || data.meta?.media?.[0]?.org || data.url;
                    return {
                        id: data.id || `tiktok_${Date.now()}`,
                        title: data.title || '',
                        author: data.author?.nickname || data.author?.username || 'TikTok User',
                        cover: '',
                        views: data.repro || 0,
                        likes: data.like || 0,
                        videoUrl,
                        audioUrl: data.music?.url || data.music_info?.url,
                        duration: data.duration || 0
                    };
                }
            },
            {
                name: 'Faa',
                fn: async () => {
                    const res = await axios.get(`${faaUrl}faa/tiktok?url=${encodeURIComponent(url)}`, { timeout: 20000 });
                    const result = res.data?.result;
                    if (!result) throw new Error('No result in Faa');
                    return {
                        id: result.id || `tiktok_${Date.now()}`,
                        title: result.title || '',
                        author: result.author?.nickname || result.author?.username || 'TikTok User',
                        cover: result.cover || '',
                        views: result.stats?.views || 0,
                        likes: result.stats?.likes || 0,
                        videoUrl: result.data || result.url,
                        audioUrl: result.music_info?.url,
                        duration: result.duration ? parseInt(result.duration) : 0
                    };
                }
            }
        ];

        try {
            return await Promise.any(apis.map(api => api.fn().then(info => {
                if (!info.videoUrl) throw new Error(`[${api.name}] No videoUrl returned`);
                console.log(`[TikTokDownloader Descarga] Ganador: ${api.name}`);
                return info;
            })));
        } catch (e) {
            console.error('[TikTokDownloader Descarga] Todas las fuentes de descarga fallaron:', e.errors || e.message);
            throw new Error('Todas las APIs de descarga de TikTok están saturadas o caídas. Intenta más tarde.');
        }
    }

    async getAudio(url) {
        const info = await this.getDownloadInfo(url);
        const cachePath = path.join(this.tempDir, `${info.id}.mp3`);

        if (fs.existsSync(cachePath)) {
            console.log(`[TikTok Cacho] Cargando audio: ${info.id}`);
            return { path: cachePath, info };
        }

        const tempIn = path.join(this.tempDir, `raw_audio_${info.id}`);

        // Si tenemos URL de audio directo, lo descargamos y lo convertimos/guardamos
        // Si no, descargamos el video y le extraemos el audio
        const downloadUrl = info.audioUrl || info.videoUrl;
        const isMp3Direct = !!info.audioUrl;

        console.log(`[TikTokDownloader] Descargando audio desde: ${downloadUrl}`);
        await downloadStreamToFile(downloadUrl, tempIn, { timeout: 60000 });

        // Transcodificar a mp3 para compatibilidad absoluta
        console.log('[TikTokDownloader] Transcodificando audio a MP3...');
        await ffmpegSemaphore.run(() => new Promise((resolve, reject) => {
            ffmpeg(tempIn)
                .outputOptions([
                    '-vn',
                    '-acodec libmp3lame',
                    '-ac 2',
                    '-ab 192k',
                    '-ar 44100'
                ])
                .on('error', reject)
                .on('end', resolve)
                .save(cachePath);
        }));

        if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
        return { path: cachePath, info };
    }

    async getVideo(url) {
        const info = await this.getDownloadInfo(url);
        const cachePath = path.join(this.tempDir, `${info.id}.mp4`);

        if (fs.existsSync(cachePath)) {
            console.log(`[TikTok Caché] Cargando video: ${info.id}`);
            return { path: cachePath, info };
        }

        const tempIn = path.join(this.tempDir, `raw_${info.id}.mp4`);
        
        console.log(`[TikTokDownloader] Descargando video desde: ${info.videoUrl}`);
        await downloadStreamToFile(info.videoUrl, tempIn, { timeout: 60000 });

        console.log('[TikTokDownloader] Transcodificando video con FFmpeg...');
        await ffmpegSemaphore.run(() => new Promise((resolve, reject) => {
            ffmpeg(tempIn)
                .outputOptions([
                    '-c:v libx264',
                    '-profile:v baseline',
                    '-level 3.0',
                    '-pix_fmt yuv420p',
                    '-c:a aac',
                    '-movflags +faststart'
                ])
                .on('error', reject)
                .on('end', resolve)
                .save(cachePath);
        }));

        if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
        return { path: cachePath, info };
    }
}

export default new TikTokDownloader();
