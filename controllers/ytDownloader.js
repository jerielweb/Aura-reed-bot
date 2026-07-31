import { execSync } from "child_process";
import fs from "fs";
import path from "path";
import { ensureDirectory } from "./downloadUtils.js";

class YTDownloader {
  constructor() {
    this.tempDir = path.resolve("./tmp");
    ensureDirectory(this.tempDir);
  }

  getVideoId(url) {
    if (!url) return null;
    const regex =
      /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : `yt_${Date.now()}`;
  }

  /**
   * Descarga el audio de YouTube usando yt-dlp local
   */
  async getAudio(url) {
    const videoId = this.getVideoId(url);
    const cachePath = path.join(this.tempDir, `${videoId}.mp3`);

    if (fs.existsSync(cachePath)) {
      console.log(`[Caché] Cargando audio: ${videoId}`);
      return cachePath;
    }

    try {
      const command = `export PATH="/home/container/bin:$PATH" && /home/container/yt-dlp --cookies /home/container/cookies.txt --extractor-args "youtube:client=android_vr" -f "ba" -x --audio-format mp3 --audio-quality 128K -o "${cachePath}" "${url}"`;
      
      execSync(command, { stdio: "pipe" });

      if (fs.existsSync(cachePath)) {
        return cachePath;
      }
      throw new Error("No se pudo generar el archivo de audio.");
    } catch (error) {
      console.error("[yt-dlp Audio Error]:", error.stderr ? error.stderr.toString() : error.message);
      throw new Error("Error al procesar el audio con yt-dlp.");
    }
  }

  /**
   * Descarga el video de YouTube usando yt-dlp local
   */
  async getVideo(url) {
    const videoId = this.getVideoId(url);
    const cachePath = path.join(this.tempDir, `${videoId}.mp4`);

    if (fs.existsSync(cachePath)) {
      console.log(`[Caché] Cargando video: ${videoId}`);
      return cachePath;
    }

    try {
      const command = `export PATH="/home/container/bin:$PATH" && /home/container/yt-dlp --cookies /home/container/cookies.txt --extractor-args "youtube:client=android_vr" -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/b" -o "${cachePath}" "${url}"`;
      
      execSync(command, { stdio: "pipe" });

      if (fs.existsSync(cachePath)) {
        return cachePath;
      }
      throw new Error("No se pudo generar el archivo de video.");
    } catch (error) {
      console.error("[yt-dlp Video Error]:", error.stderr ? error.stderr.toString() : error.message);
      throw new Error("Error al procesar el video con yt-dlp.");
    }
  }

  /**
   * Elimina un archivo temporal de la carpeta tmp
   */
  cleanup(filePath) {
    try {
      if (filePath && fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error("[YTDownloader] Error eliminando archivo:", e.message);
    }
  }
}

export default new YTDownloader();
