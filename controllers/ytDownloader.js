import axios from "axios";
import fs from "fs";
import path from "path";
import yts from "yt-search";
import { ensureDirectory, downloadStreamToFile } from "./downloadUtils.js";

class YTDownloader {
  constructor() {
    this.tempDir = path.resolve("./tmp");
    this.apiKey = "oboe";
    this.baseUrl = "https://api.alyacore.xyz/dl";
    ensureDirectory(this.tempDir);
  }

  getVideoId(url) {
    if (!url) return null;
    const regex =
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
  }

  /**
   * Obtiene la metadata completa usando yt-search
   */
  async getMetadata(queryOrUrl) {
    try {
      const videoId = this.getVideoId(queryOrUrl);
      let searchResult;

      if (videoId) {
        searchResult = await yts({ videoId });
      } else {
        const search = await yts(queryOrUrl);
        searchResult = search.videos?.[0];
      }

      if (searchResult) {
        return {
          title: searchResult.title || "Video de YouTube",
          author: searchResult.author?.name || searchResult.author || "Desconocido",
          duration: searchResult.duration?.timestamp || "??",
          views: typeof searchResult.views === "number" ? searchResult.views : 0,
          thumbnail: searchResult.thumbnail || searchResult.image || `https://i.ytimg.com/vi/${searchResult.videoId}/hqdefault.jpg`,
          url: searchResult.url || `https://youtu.be/${searchResult.videoId}`,
          videoId: searchResult.videoId,
        };
      }
    } catch (e) {
      console.error("[ytDownloader] Error al obtener metadata:", e.message);
    }

    return {
      title: "Video de YouTube",
      author: "Desconocido",
      duration: "??",
      views: 0,
      thumbnail: "https://i.ytimg.com/vi/default/hqdefault.jpg",
      url: queryOrUrl,
      videoId: this.getVideoId(queryOrUrl) || `yt_${Date.now()}`,
    };
  }

  /**
   * Descarga el audio (MP3) por Query o por URL
   */
  async getAudio(queryOrUrl) {
    const isUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(queryOrUrl);
    const videoId = this.getVideoId(queryOrUrl) || `yt_${Date.now()}`;
    const cachePath = path.join(this.tempDir, `${videoId}.mp3`);

    if (fs.existsSync(cachePath)) {
      console.log(`[Caché] Cargando audio: ${videoId}`);
      return cachePath;
    }

    let downloadUrl = null;

    if (isUrl) {
      // API por URL
      const res = await axios.get(
        `${this.baseUrl}/ytmp3v3?url=${encodeURIComponent(queryOrUrl)}&key=${this.apiKey}`,
        { timeout: 30000 }
      );
      downloadUrl = res.data?.data?.dl;
    } else {
      // API por Query
      const res = await axios.get(
        `${this.baseUrl}/youtubeplay?query=${encodeURIComponent(queryOrUrl)}&key=${this.apiKey}`,
        { timeout: 30000 }
      );
      downloadUrl = res.data?.data?.dl;
    }

    if (!downloadUrl) {
      throw new Error("No se pudo obtener el enlace de descarga del audio.");
    }

    await downloadStreamToFile(downloadUrl, cachePath, { timeout: 60000 });
    return cachePath;
  }

  /**
   * Descarga el video (MP4) por Query o por URL
   */
  async getVideo(queryOrUrl) {
    const isUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(queryOrUrl);
    const videoId = this.getVideoId(queryOrUrl) || `yt_${Date.now()}`;
    const cachePath = path.join(this.tempDir, `${videoId}.mp4`);

    if (fs.existsSync(cachePath)) {
      console.log(`[Caché] Cargando video: ${videoId}`);
      return cachePath;
    }

    let downloadUrl = null;

    if (isUrl) {
      // API por URL
      const res = await axios.get(
        `${this.baseUrl}/ytmp4?url=${encodeURIComponent(queryOrUrl)}&quality=720&key=${this.apiKey}`,
        { timeout: 30000 }
      );
      downloadUrl = res.data?.data?.dl;
    } else {
      // API por Query
      const res = await axios.get(
        `${this.baseUrl}/youtubeplayv2?query=${encodeURIComponent(queryOrUrl)}&type=mp4&quality=720&key=${this.apiKey}`,
        { timeout: 30000 }
      );
      downloadUrl = res.data?.data?.dl;
    }

    if (!downloadUrl) {
      throw new Error("No se pudo obtener el enlace de descarga del video.");
    }

    await downloadStreamToFile(downloadUrl, cachePath, { timeout: 60000 });
    return cachePath;
  }

  /**
   * Limpia un archivo temporal
   */
  cleanup(filePath) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error("[YTDownloader] Error limpiando archivo:", e.message);
    }
  }
}

export default new YTDownloader();
