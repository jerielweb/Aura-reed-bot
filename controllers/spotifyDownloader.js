import spotifyUrlInfo from "spotify-url-info";
import axios from "axios";
import fs from "fs";
import path from "path";
import {
  ensureDirectory,
  firstSuccessfulPromise,
  downloadStreamToFile,
} from "./downloadUtils.js";

// Matches regular and international/localized Spotify track URLs
const SPOTIFY_REGEX =
  /open\.spotify\.com\/([a-zA-Z0-9-]+\/)?track\/([a-zA-Z0-9]+)/i;

class SpotifyDownloader {
  constructor() {
    this.tempDir = path.resolve("./tmp");
    ensureDirectory(this.tempDir);
  }

  extractTrackId(url) {
    if (!url) return null;
    const match = url.match(/track\/([a-zA-Z0-9]+)/);
    return match ? match[1] : null;
  }

  async getTrackMetadata(url) {
    const highQualityTasks = [
      // Method A: spotify-url-info
      (async () => {
        const { getPreview } = spotifyUrlInfo(fetch);
        const preview = await getPreview(url, {
          headers: {
            "user-agent":
              "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          },
        });
        if (preview && preview.title && preview.artist) {
          return {
            title: preview.title,
            artist: preview.artist,
            cover: preview.image,
            duration: preview.duration ? `${preview.duration}` : "N/A",
            url: url,
          };
        }
        throw new Error("spotify-url-info incompleto");
      })(),

      // Method B: Api Causas
      (async () => {
        const res = await axios.get(
          `https://rest.apicausas.xyz/api/v1/descargas/spotify?apikey=oboe&url=${encodeURIComponent(url)}`,
          { timeout: 10000 },
        );
        if (res.data?.status && res.data.data?.artist) {
          return {
            title: res.data.data.title,
            artist: res.data.data.artist,
            cover: res.data.data.thumbnail,
            duration: "N/A",
            url: url,
          };
        }
        throw new Error("Api Causas sin artista");
      })(),

      // Method C: Delirius
      (async () => {
        const res = await axios.get(
          `https://api.delirius.store/download/spotifydl?url=${encodeURIComponent(url)}`,
          { timeout: 10000 },
        );
        if (res.data?.status && res.data.data?.author) {
          const d = res.data.data;
          let durationStr = "N/A";
          if (d.duration) {
            const sec = Math.floor(d.duration / 1000);
            const min = Math.floor(sec / 60);
            const remSec = sec % 60;
            durationStr = `${min}:${remSec < 10 ? "0" : ""}${remSec}`;
          }
          return {
            title: d.title,
            artist: d.author,
            cover: d.image,
            duration: durationStr,
            url: url,
          };
        }
        throw new Error("Delirius sin autor");
      })(),

      // Method D: Alyacore
      (async () => {
        const res = await axios.get(
          `https://api.alyacore.xyz/dl/spotifyplay?query=${encodeURIComponent(url)}&key=oboe`,
          { timeout: 10000 },
        );
        if (res.data?.status && res.data.data?.artist) {
          const d = res.data.data;
          return {
            title: d.title,
            artist: d.artist,
            cover: d.cover,
            duration: d.duration || "N/A",
            url: url,
          };
        }
        throw new Error("Alyacore sin artista");
      })(),
    ];

    let metadata = null;
    try {
      metadata = await firstSuccessfulPromise(highQualityTasks);
    } catch (e) {
      console.warn(
        "[Spotify] Todos los metadatos de alta calidad fallaron en paralelo, intentando oEmbed:",
        e.message,
      );

      // Fallback to oEmbed as last resort
      try {
        const res = await axios.get(
          `https://open.spotify.com/oembed?url=${encodeURIComponent(url)}`,
          {
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            timeout: 8000,
          },
        );
        if (res.data?.title) {
          metadata = {
            title: res.data.title,
            artist: res.data.author_name || "Desconocido",
            cover: res.data.thumbnail_url,
            duration: "N/A",
            url: url,
          };
        }
      } catch (oe) {
        console.warn("[Spotify] oEmbed fallback también falló:", oe.message);
      }

      if (!metadata) {
        metadata = {
          title: "Canción de Spotify",
          artist: "Desconocido",
          cover: "https://open.spotify.com/favicon.ico",
          duration: "N/A",
          url: url,
        };
      }
    }
    if (
      metadata &&
      metadata.title &&
      metadata.artist &&
      metadata.artist !== "Desconocido" &&
      (metadata.duration === "N/A" || !metadata.duration)
    ) {
      try {
        const query = `${metadata.title} ${metadata.artist}`;
        console.log(
          `[Spotify Metadata] Enriqueciendo metadatos mediante búsqueda para: ${query}`,
        );
        const searchResults = await this.searchTracks(query);
        if (searchResults && searchResults.length > 0) {
          const firstMatch = searchResults[0];
          if (firstMatch.duration && firstMatch.duration !== "N/A") {
            metadata.duration = firstMatch.duration;
            console.log(
              `[Spotify Metadata] Duración enriquecida con éxito: ${metadata.duration}`,
            );
          }
          if (!metadata.cover && firstMatch.image) {
            metadata.cover = firstMatch.image;
          }
        }
      } catch (e) {
        console.warn(
          "[Spotify Metadata] Error al intentar enriquecer metadatos con búsqueda:",
          e.message,
        );
      }
    }

    return metadata;
  }

  async searchTracks(query) {
    const tasks = [
      // Method A: Delirius search
      (async () => {
        const res = await axios.get(
          `https://api.delirius.store/search/spotify?q=${encodeURIComponent(query)}&limit=10`,
          { timeout: 10000 },
        );
        if (
          res.data?.status &&
          Array.isArray(res.data.data) &&
          res.data.data.length > 0
        ) {
          return res.data.data.map((track) => ({
            id: track.id || this.extractTrackId(track.url),
            title: track.title,
            artist: track.artist || "Desconocido",
            album: track.album || "Desconocido",
            duration: track.duration || "N/A",
            publish: track.publish || "N/A",
            url: track.url,
            image:
              track.image ||
              track.cover ||
              "https://open.spotify.com/favicon.ico",
            source: "Delirius",
          }));
        }
        throw new Error("Delirius no encontró resultados");
      })(),

      // Method B: StellarWA search
      (async () => {
        const res = await axios.get(
          `https://api.stellarwa.xyz/search/spotify?query=${encodeURIComponent(query)}&key=api-7dSKm`,
          { timeout: 10000 },
        );
        if (
          res.data?.status &&
          Array.isArray(res.data.data) &&
          res.data.data.length > 0
        ) {
          return res.data.data.map((track) => ({
            id: track.id || this.extractTrackId(track.url),
            title: track.title,
            artist: track.artist || "Desconocido",
            album: track.album || "Desconocido",
            duration: track.duration || "N/A",
            publish: track.publish || "N/A",
            url: track.url,
            image:
              track.image ||
              track.cover ||
              "https://open.spotify.com/favicon.ico",
            source: "StellarWA",
          }));
        }
        throw new Error("StellarWA no encontró resultados");
      })(),

      // Method C: Alyacore play/download (only returns 1 result but better than nothing)
      (async () => {
        const res = await axios.get(
          `https://api.alyacore.xyz/dl/spotifyplay?query=${encodeURIComponent(query)}&key=oboe`,
          { timeout: 10000 },
        );
        if (res.data?.status && res.data.data) {
          const track = res.data.data;
          return [
            {
              id: null,
              title: track.title,
              artist: track.artist || "Desconocido",
              album: track.album || "Desconocido",
              duration: track.duration || "N/A",
              publish: track.year ? `${track.year}` : "N/A",
              url: null,
              image: track.cover || "https://open.spotify.com/favicon.ico",
              _directDownloadUrl: track.dl,
              source: "Alyacore",
            },
          ];
        }
        throw new Error("Alyacore no encontró resultados");
      })(),
    ];

    try {
      return await firstSuccessfulPromise(tasks);
    } catch (e) {
      console.error(
        "[Spotify] Todos los motores de búsqueda fallaron en paralelo:",
        e.message,
      );
      throw new Error("No se encontraron resultados para la búsqueda.");
    }
  }

  async searchTrack(query) {
    const tracks = await this.searchTracks(query);
    if (tracks && tracks.length > 0) {
      const first = tracks[0];
      return {
        title: first.title,
        artist: first.artist,
        cover: first.image,
        duration: first.duration,
        url: first.url,
        _directDownloadUrl: first._directDownloadUrl,
        source: first.source,
      };
    }
    throw new Error(
      "No se encontraron resultados para la canción especificada.",
    );
  }

  async download(urlOrQuery) {
    let metadata = null;
    let isLink = SPOTIFY_REGEX.test(urlOrQuery);
    let trackId = null;
    let downloadSource = "Desconocido";

    if (isLink) {
      trackId = this.extractTrackId(urlOrQuery);
      if (trackId) {
        const cachePath = path.join(this.tempDir, `spotify_${trackId}.mp3`);
        if (fs.existsSync(cachePath)) {
          console.log(
            `[Spotify Caché] Encontrado archivo local para Spotify ID: ${trackId}`,
          );
          try {
            metadata = await this.getTrackMetadata(urlOrQuery);
          } catch {
            metadata = {
              title: "Canción de Spotify",
              artist: "Desconocido",
              cover: null,
              duration: "N/A",
              url: urlOrQuery,
            };
          }
          return { metadata, path: cachePath, downloadSource: "Caché local" };
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
          console.log(
            `[Spotify Caché] Encontrado archivo local para Spotify ID: ${trackId}`,
          );
          return { metadata, path: cachePath, downloadSource: "Caché local" };
        }
      }
    }

    let downloadUrl = null;

    if (metadata._directDownloadUrl) {
      console.log("[Spotify] Usando enlace de descarga directa precargado...");
      downloadUrl = metadata._directDownloadUrl;
      downloadSource = metadata.source || "Alyacore (Directo)";
    } else {
      const dlTasks = [];

      if (metadata.url) {
        // API 1: Api Causas
        dlTasks.push(
          (async () => {
            const res = await axios.get(
              `https://rest.apicausas.xyz/api/v1/descargas/spotify?apikey=oboe&url=${encodeURIComponent(metadata.url)}`,
              { timeout: 15000 },
            );
            if (res.data?.status && res.data.data?.download?.url) {
              console.log("[Spotify] Api Causas resolvió descarga.");
              return { url: res.data.data.download.url, source: "Api Causas" };
            }
            throw new Error("Api Causas falló");
          })(),
        );

        // API 2: Delirius
        dlTasks.push(
          (async () => {
            const res = await axios.get(
              `https://api.delirius.store/download/spotifydl?url=${encodeURIComponent(metadata.url)}`,
              { timeout: 15000 },
            );
            if (res.data?.status && res.data.data?.download) {
              console.log("[Spotify] Delirius resolvió descarga.");
              return { url: res.data.data.download, source: "Delirius" };
            }
            throw new Error("Delirius falló");
          })(),
        );

        // API 3: MayAPI
        dlTasks.push(
          (async () => {
            const res = await axios.get(
              `https://mayapi.ooguy.com/spotifydl?query=${encodeURIComponent(metadata.url)}&apikey=may-dbd0e6be`,
              { timeout: 15000 },
            );
            if (res.data?.status && res.data.result?.downloadUrl) {
              console.log("[Spotify] MayAPI resolvió descarga.");
              return { url: res.data.result.downloadUrl, source: "MayAPI" };
            }
            throw new Error("MayAPI falló");
          })(),
        );
      }

      // API 4: Alyacore
      const queryForAlyacore = metadata.url || urlOrQuery;
      dlTasks.push(
        (async () => {
          const res = await axios.get(
            `https://api.alyacore.xyz/dl/spotifyplay?query=${encodeURIComponent(queryForAlyacore)}&key=oboe`,
            { timeout: 15000 },
          );
          if (res.data?.status && res.data.data?.dl) {
            if (!metadata.title && res.data.data.title) {
              metadata.title = res.data.data.title;
              metadata.artist = res.data.data.artist || "Desconocido";
              metadata.cover = res.data.data.cover;
              metadata.duration = res.data.data.duration || "N/A";
            }
            console.log("[Spotify] Alyacore resolvió descarga.");
            return { url: res.data.data.dl, source: "Alyacore" };
          }
          throw new Error("Alyacore falló");
        })(),
      );

      try {
        const resolved = await firstSuccessfulPromise(dlTasks);
        downloadUrl = resolved.url;
        downloadSource = resolved.source;
      } catch (e) {
        console.error(
          "[Spotify] Todos los métodos de descarga fallaron en paralelo:",
          e.message,
        );
      }
    }

    if (!downloadUrl) {
      throw new Error(
        "Todos los servidores de descarga de Spotify fallaron. Inténtalo de nuevo más tarde.",
      );
    }

    const fileId =
      trackId || this.extractTrackId(metadata.url) || `temp_${Date.now()}`;
    const cachePath = path.join(this.tempDir, `spotify_${fileId}.mp3`);

    console.log(
      `[Spotify] Descargando archivo de audio desde el servidor más rápido (${downloadSource})...`,
    );
    await downloadStreamToFile(downloadUrl, cachePath, { timeout: 60000 });
    console.log("[Spotify] Descarga de audio completada y guardada en caché.");

    return { metadata, path: cachePath, downloadSource };
  }
}

export default new SpotifyDownloader();
