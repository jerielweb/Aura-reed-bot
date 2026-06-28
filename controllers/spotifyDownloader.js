import spotifyUrlInfo from 'spotify-url-info';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { ensureDirectory, downloadStreamToFile } from './downloadUtils.js';

const SPOTIFY_REGEX = /open\.spotify\.com\/([a-zA-Z0-9-]+\/)?track\/([a-zA-Z0-9]+)/i;

class SpotifyDownloader {
    constructor() {
        this.tempDir = path.resolve('./tmp');
        ensureDirectory(this.tempDir);
    }

    extractTrackId(url) {
        if (!url) return null;
        const match = url.match(/track\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    }

    async getTrackMetadata(url) {
        try {
            const res = await axios.get(`https://api.alyacore.xyz/dl/spotifyplay?query=${encodeURIComponent(url)}&key=oboe`, { timeout: 10000 });
            if (res.data?.status && res.data.data?.artist) {
                const d = res.data.data;
                
                let directUrl = null;
                if (typeof d.dl === 'object' && d.dl !== null) {
                    directUrl = d.dl.mp3 || d.dl.link;
                } else if (typeof d.dl === 'string') {
                    directUrl = d.dl;
                }

                return {
                    title: d.title,
                    artist: d.artist,
                    album: d.album || 'Desconocido',
                    cover: d.cover,
                    duration: d.duration || 'N/A',
                    url: url,
                    _directDownloadUrl: directUrl
                };
            }
            throw new Error('Alyacore no devolvió estructura válida');
        } catch (e) {
            console.warn('[Spotify] Alyacore falló, intentando obtener previsualización básica:', e.message);
            try {
                const { getPreview } = spotifyUrlInfo(fetch);
                const preview = await getPreview(url, {
                    headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
                });
                return {
                    title: preview.title,
                    artist: preview.artist,
                    album: preview.album || 'Desconocido',
                    cover: preview.image,
                    duration: preview.duration ? `${preview.duration}` : 'N/A',
                    url: url
                };
            } catch {
                return {
                    title: 'Canción de Spotify',
                    artist: 'Desconocido',
                    album: 'Desconocido',
                    cover: null,
                    duration: 'N/A',
                    url: url
                };
            }
        }
    }

    async searchTracks(query) {
        try {
            // 1. Buscamos primero en la API para obtener el resultado y el enlace de descarga directa
            const res = await axios.get(`https://api.alyacore.xyz/dl/spotifyplay?query=${encodeURIComponent(query)}&key=oboe`, { timeout: 10000 });
            if (res.data?.status && res.data.data) {
                const track = res.data.data;
                
                let directUrl = null;
                if (typeof track.dl === 'object' && track.dl !== null) {
                    directUrl = track.dl.mp3 || track.dl.link;
                } else if (typeof track.dl === 'string') {
                    directUrl = track.dl;
                }

                let spotifyUrl = track.url || null;
                let albumName = track.album || 'Desconocido';
                let trackDuration = track.duration || 'N/A';

                // 🛠️ TRUCO CON LA LIBRERÍA: Si no hay URL o Album, usamos la librería para extraerlos de Spotify usando el título y artista exactos
                if (!spotifyUrl || albumName === 'Desconocido') {
                    try {
                        const { getPreview } = spotifyUrlInfo(fetch);
                        const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(`${track.title} ${track.artist}`)}`;
                        const preview = await getPreview(searchUrl, {
                            headers: { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
                        });
                        
                        if (preview) {
                            if (preview.link) spotifyUrl = preview.link;
                            if (preview.album) albumName = preview.album;
                            if (preview.duration) trackDuration = preview.duration;
                        }
                    } catch (libErr) {
                        console.warn('[Spotify Extraer] La librería no pudo raspar los datos adicionales:', libErr.message);
                    }
                }

                // Si de plano la librería tampoco lo pescó, ponemos un buscador web normal de respaldo
                if (!spotifyUrl) {
                    spotifyUrl = `https://open.spotify.com/search/${encodeURIComponent(`${track.title} ${track.artist}`)}`;
                }

                return [{
                    id: this.extractTrackId(spotifyUrl) || null,
                    title: track.title,
                    artist: track.artist || 'Desconocido',
                    album: albumName,
                    duration: trackDuration,
                    publish: track.year ? `${track.year}` : 'N/A',
                    url: spotifyUrl,
                    image: track.cover || null,
                    _directDownloadUrl: directUrl,
                    source: 'Alyacore + Spotify Info'
                }];
            }
            throw new Error('Sin resultados en Alyacore');
        } catch (e) {
            console.error('[Spotify Search] Error:', e.message);
            throw new Error('No se encontraron resultados para la búsqueda.');
        }
    }

    async searchTrack(query) {
        const tracks = await this.searchTracks(query);
        if (tracks && tracks.length > 0) {
            const first = tracks[0];
            return {
                title: first.title,
                artist: first.artist,
                album: first.album,
                cover: first.image,
                duration: first.duration,
                url: first.url,
                _directDownloadUrl: first._directDownloadUrl,
                source: first.source
            };
        }
        throw new Error('No se encontraron resultados para la canción especificada.');
    }

    async download(urlOrQuery) {
        let metadata = null;
        let isLink = SPOTIFY_REGEX.test(urlOrQuery);
        let trackId = null;

        if (isLink) {
            trackId = this.extractTrackId(urlOrQuery);
            if (trackId) {
                const cachePath = path.join(this.tempDir, `spotify_${trackId}.mp3`);
                if (fs.existsSync(cachePath)) {
                    try {
                        metadata = await this.getTrackMetadata(urlOrQuery);
                    } catch {
                        metadata = { title: 'Canción de Spotify', artist: 'Desconocido', album: 'Desconocido', cover: null, duration: 'N/A', url: urlOrQuery };
                    }
                    return { metadata, path: cachePath, downloadSource: 'Caché local' };
                }
            }
            metadata = await this.getTrackMetadata(urlOrQuery);
        } else {
            metadata = await this.searchTrack(urlOrQuery);
            if (metadata.url) {
                trackId = this.extractTrackId(metadata.url);
            }
            if (trackId) {
                const cachePath = path.join(this.tempDir, `spotify_${trackId}.mp3`);
                if (fs.existsSync(cachePath)) {
                    return { metadata, path: cachePath, downloadSource: 'Caché local' };
                }
            }
        }

        let downloadUrl = metadata._directDownloadUrl;
        if (!downloadUrl) {
            try {
                const res = await axios.get(`https://api.alyacore.xyz/dl/spotifyplay?query=${encodeURIComponent(metadata.url || urlOrQuery)}&key=oboe`, { timeout: 15000 });
                if (res.data?.status && res.data.data?.dl) {
                    const d = res.data.data;
                    if (typeof d.dl === 'object' && d.dl !== null) {
                        downloadUrl = d.dl.mp3 || d.dl.link;
                    } else if (typeof d.dl === 'string') {
                        downloadUrl = d.dl;
                    }
                }
            } catch (e) {
                console.error('[Spotify Download] Error al re-consultar enlace:', e.message);
            }
        }

        if (!downloadUrl) {
            throw new Error('No se pudo obtener un enlace de descarga válido desde el servidor.');
        }

        const fileId = trackId || `temp_${Date.now()}`;
        const cachePath = path.join(this.tempDir, `spotify_${fileId}.mp3`);

        console.log(`[Spotify] Descargando audio desde Alyacore...`);
        await downloadStreamToFile(downloadUrl, cachePath, { timeout: 60000 });

        return { metadata, path: cachePath, downloadSource: 'Alyacore' };
    }
}

export default new SpotifyDownloader();