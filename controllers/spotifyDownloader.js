import spotifyUrlInfo from 'spotify-url-info';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

const SPOTIFY_REGEX = /^(https?:\/\/)?(open\.spotify\.com)\/(track)\/([a-zA-Z0-9]+)/i;

class SpotifyDownloader {
    constructor() {
        this.tempDir = path.resolve('./tmp');
        if (!fs.existsSync(this.tempDir)) {
            fs.mkdirSync(this.tempDir, { recursive: true });
        }
    }

    extractTrackId(url) {
        const match = url.match(/track\/([a-zA-Z0-9]+)/);
        return match ? match[1] : null;
    }

    async getTrackMetadata(url) {
        try {
            console.log('[Spotify] Intentando extraer metadatos con spotify-url-info...');
            const { getPreview } = spotifyUrlInfo(fetch);
            const preview = await getPreview(url, {
                headers: {
                    'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
                }
            });
            if (!preview || !preview.title) throw new Error('No se obtuvieron metadatos válidos');
            
            return {
                title: preview.title,
                artist: preview.artist || 'Desconocido',
                cover: preview.image,
                duration: preview.duration ? `${preview.duration}` : 'N/A',
                url: url
            };
        } catch (e) {
            console.warn('[Spotify] spotify-url-info falló, usando oEmbed fallback:', e.message);
            try {
                const res = await axios.get(`https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                    },
                    timeout: 100000
                });
                if (res.data?.title) {
                    return {
                        title: res.data.title,
                        artist: res.data.author_name || 'Desconocido',
                        cover: res.data.thumbnail_url,
                        duration: 'N/A',
                        url: url
                    };
                }
            } catch (oe) {
                console.error('[Spotify] oEmbed fallback también falló:', oe.message);
            }
            throw new Error('No se pudo extraer la información del enlace de Spotify. Verifica que el enlace sea público.');
        }
    }

    async searchTrack(query) {
        try {
            console.log('[Spotify] Buscando en Delirius API...');
            const res = await axios.get(`https://api.delirius.store/search/spotify?q=${encodeURIComponent(query)}`, { timeout: 100000 });
            if (res.data?.status && res.data.data?.length > 0) {
                const first = res.data.data[0];
                return {
                    title: first.title,
                    artist: first.artist || 'Desconocido',
                    cover: first.image,
                    duration: first.duration || 'N/A',
                    url: first.url
                };
            }
        } catch (e) {
            console.error('[Spotify] Delirius search falló:', e.message);
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
                    console.log(`[Spotify Caché] Encontrado archivo local para Spotify ID: ${trackId}`);
                    try {
                        metadata = await this.getTrackMetadata(urlOrQuery);
                    } catch {
                        metadata = {
                            title: 'Canción de Spotify',
                            artist: 'Desconocido',
                            cover: null,
                            duration: 'N/A',
                            url: urlOrQuery
                        };
                    }
                    return { metadata, path: cachePath };
                }
            }
            metadata = await this.getTrackMetadata(urlOrQuery);
        } else {
            metadata = await this.searchTrack(urlOrQuery);
            if (metadata.url) {
                trackId = this.extractTrackId(metadata.url);
            }
        }

        if (trackId) {
            const cachePath = path.join(this.tempDir, `spotify_${trackId}.mp3`);
            if (fs.existsSync(cachePath)) {
                return { metadata, path: cachePath };
            }
        }

        if (!metadata.url) {
            throw new Error('No se pudo resolver el enlace de la canción para realizar la descarga.');
        }

        let downloadUrl = null;

        try {
            console.log(`[Spotify] Intentando descarga directa desde Delirius para ID: ${trackId || 'búsqueda'}`);
            const deliriusRes = await axios.get(`https://api.delirius.store/download/spotifydl?url=${encodeURIComponent(metadata.url)}`, { timeout: 200000 });
            if (deliriusRes.data?.status && deliriusRes.data.data?.download) {
                downloadUrl = deliriusRes.data.data.download;
            } else {
                throw new Error(deliriusRes.data?.msg || 'Respuesta de API inválida');
            }
        } catch (e) {
            console.error('[Spotify] Descarga directa de Delirius falló:', e.message);
            throw new Error('El servidor de descargas de Spotify (Delirius API) no se encuentra disponible. Inténtalo de nuevo más tarde.');
        }

        if (!downloadUrl) {
            throw new Error('La API de descarga no devolvió un enlace de descarga válido.');
        }

        const cachePath = path.join(this.tempDir, `spotify_${trackId || Date.now()}.mp3`);
        console.log('[Spotify] Descargando audio directo...');
        const res = await axios.get(downloadUrl, { responseType: 'arraybuffer', timeout: 60000 });
        fs.writeFileSync(cachePath, Buffer.from(res.data));
        console.log('[Spotify] Descarga directa completada y guardada en caché.');

        return { metadata, path: cachePath };
    }
}

export default new SpotifyDownloader();
