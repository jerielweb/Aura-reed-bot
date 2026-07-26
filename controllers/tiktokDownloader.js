import axios from "axios";
import { Downloader } from "@tobyg74/tiktok-api-dl";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "ffmpeg-static";
import ffprobePath from "@ffprobe-installer/ffprobe";
import fs from "fs";
import path from "path";
import {
  ensureDirectory,
  downloadStreamToFile,
  ffmpegSemaphore,
} from "./downloadUtils.js";
import formatNumbers from "./functions/formatNumbers.js";

const getFirstNonEmpty = (...values) =>
  values.find((value) => value !== undefined && value !== null && String(value).trim() !== "");

const getFirstUrl = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) return getFirstUrl(value[0]);
  if (value.url_list && Array.isArray(value.url_list)) return getFirstUrl(value.url_list[0]);
  if (value.playUrl && Array.isArray(value.playUrl)) return getFirstUrl(value.playUrl[0]);
  if (typeof value === "object") return value.url || value.link || value.uri || null;
  return null;
};

const normalizeDuration = (value) => {
  if (value === undefined || value === null) return 0;
  const raw = String(value).trim();
  const match = raw.match(/(\d+(?:\.\d+)?)/);
  if (!match) return 0;
  const numero = Number(match[0]);
  if (!Number.isFinite(numero) || numero <= 0) return 0;
  return numero > 1000 ? Math.round(numero / 1000) : Math.round(numero);
};

const parseDelimitedNumber = (value) => {
  if (value === undefined || value === null) return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  if (/^\d{1,3}(?:\.\d{3})+$/.test(raw)) {
    return Number(raw.replace(/\./g, ""));
  }
  const normalized = raw.replace(/,/g, "");
  const numero = Number(normalized);
  return Number.isFinite(numero) ? numero : 0;
};

// Configurar rutas de FFmpeg
ffmpeg.setFfmpegPath(ffmpegPath);
ffmpeg.setFfprobePath(ffprobePath.path);

class TikTokDownloader {
  constructor() {
    this.tempDir = path.resolve("./tmp");
    ensureDirectory(this.tempDir);
  }

  async search(query) {
    const faaUrl = global.Apis?.appiFaa?.url || "https://api-faa.my.id/";
    const deliriusUrl =
      global.Apis?.deliriusApi?.url || "https://api.delirius.store/";

    const apis = [
      {
        name: "Delirius",
        fn: async () => {
          const res = await axios.get(
            `${deliriusUrl}search/tiktoksearch?query=${encodeURIComponent(query)}`,
            { timeout: 15000 },
          );
          const videos = res.data?.meta;
          if (!videos || videos.length === 0)
            throw new Error("No videos found in Delirius");
          const first = videos[0];
          return {
            url: first.url,
            title: first.title || "",
            author:
              first.author?.nickname || first.author?.username || "TikTok User",
            views: formatNumbers(parseDelimitedNumber(first.play || 0)),
            likes: formatNumbers(parseDelimitedNumber(first.like || 0)),
            duration: normalizeDuration(
              first.duration || first.videoDuration || first.dur || 0,
            ),
            cover: first.hd || first.cover || first.author?.avatar || "",
          };
        },
      },
      {
        name: "Faa",
        fn: async () => {
          const res = await axios.get(
            `${faaUrl}faa/tiktok-search?q=${encodeURIComponent(query)}`,
            { timeout: 15000 },
          );
          const videos = res.data?.result;
          if (!videos || videos.length === 0)
            throw new Error("No videos found in Faa");
          const first = videos[0];
          const username = first.author?.username || "";
          const id = first.id || "";
          if (!username || !id) throw new Error("Incomplete data in Faa");
          return {
            url: `https://www.tiktok.com/@${username}/video/${id}`,
            title: first.title || "",
            author: first.author?.nickname || username || "TikTok User",
            views: first.stats?.views || 0,
            likes: first.stats?.likes || 0,
            duration: normalizeDuration(
              first.duration || first.dur || first.stats?.duration || 0,
            ),
            cover: first.cover || "",
          };
        },
      },
    ];

    try {
      return await Promise.any(
        apis.map((api) =>
          api.fn().then((result) => {
            if (!result.url)
              throw new Error(`[${api.name}] No url returned in search`);
            console.log(`[TikTokDownloader Búsqueda] Ganador: ${api.name}`);
            return result;
          }),
        ),
      );
    } catch (e) {
      console.error(
        "[TikTokDownloader Búsqueda] Ambas APIs fallaron:",
        e.errors || e.message,
      );
      throw new Error(
        "No se encontraron resultados en TikTok para tu búsqueda.",
      );
    }
  }

  async getDownloadInfo(url) {
    const faaUrl = global.Apis?.appiFaa?.url || "https://api-faa.my.id/";
    const deliriusUrl =
      global.Apis?.deliriusApi?.url || "https://api.delirius.store/";
    const alyacoreUrl =
      global.Apis?.apiAiya?.url || "https://api.alyacore.xyz/";

    // Intentar tobyg74/tiktok-api-dl primero
    try {
      console.log(
        "[TikTokDownloader] Intentando descargar metadatos con tobyg74/tiktok-api-dl...",
      );

      const result = await Downloader(url);
      const parsed = result.resultNotParsed || result.raw || result.result || result;

      const videoObj =
        result.video ||
        parsed.content?.video ||
        parsed.video ||
        parsed.playback ||
        {};
      const musicObj =
        result.music ||
        parsed.content?.music ||
        parsed.music ||
        parsed.music_info ||
        {};
      const stats =
        parsed.content?.statistics ||
        parsed.statistics ||
        result.statistics ||
        parsed.stats ||
        {};
      const authorObj =
        result.author ||
        parsed.content?.author ||
        parsed.author ||
        {};

      const videoUrl = getFirstUrl([
        videoObj.playAddr,
        videoObj.downloadAddr,
        videoObj.url,
        videoObj.play_addr,
        videoObj.download_addr,
        parsed.url,
        parsed.data?.video,
      ]);

      const videoID =
        parsed.content?.aweme_id ||
        parsed.id ||
        parsed.aweme_id ||
        result.id ||
        `tiktok_${Date.now()}`;

      const desc =
        getFirstNonEmpty(
          result.desc,
          parsed.content?.desc,
          parsed.title,
          result.title,
        ) || "";

      const authorName =
        getFirstNonEmpty(
          authorObj.nickname,
          authorObj.fullname,
          authorObj.username,
          authorObj.name,
          musicObj.author,
        ) || "TikTok User";

      const likesVal =
        stats?.digg_count ||
        stats?.likeCount ||
        stats?.like_count ||
        stats?.like ||
        stats?.likes ||
        0;

      const viewsVal =
        stats?.play_count ||
        stats?.playCount ||
        stats?.play ||
        stats?.views ||
        stats?.play_cnt ||
        0;

      const coverVal =
        getFirstUrl([
          videoObj.cover,
          videoObj.originCover,
          videoObj.dynamicCover,
          parsed.content?.video?.cover,
          parsed.cover,
          parsed.thumb,
          musicObj.coverLarge,
        ]) || "";

      // Extracción profunda para la URL de audio
      const audioUrl = getFirstUrl([
        musicObj.playUrl,
        musicObj.downloadUrl,
        musicObj.url,
        musicObj.play_url,
        parsed.content?.music?.play_url,
        parsed.music?.playUrl,
        parsed.musicUrl,
        parsed.audio,
      ]);

      const durationVal =
        videoObj.duration ||
        parsed.content?.video?.duration ||
        parsed.duration ||
        result.duration ||
        musicObj.duration ||
        0;

      if (videoUrl) {
        console.log("[TikTokDownloader] Éxito usando tobyg74/tiktok-api-dl");
        return {
          id: videoID,
          title: desc,
          author: authorName,
          likes: formatNumbers(parseDelimitedNumber(likesVal)),
          views: formatNumbers(parseDelimitedNumber(viewsVal)),
          cover: coverVal,
          videoUrl,
          audioUrl,
          duration: normalizeDuration(durationVal),
        };
      }
    } catch (e) {
      console.error(
        "[TikTokDownloader] tobyg74/tiktok-api-dl falló, usando APIs de respaldo:",
        e.message,
      );
    }

    // Carrera de APIs de respaldo
    const apis = [
      {
        name: "Alya Core",
        fn: async () => {
          const res = await axios.get(
            `${alyacoreUrl}dl/tiktokv2?url=${encodeURIComponent(url)}`,
            { timeout: 20000 },
          );

          const result = res.data;
          if (!result || !result.status)
            throw new Error("No data in Alya Core");

          let videoUrl = null;
          if (Array.isArray(result.data) && result.data[2]?.url) {
            videoUrl = result.data[2].url;
          }
          if (!videoUrl && Array.isArray(result.data)) {
            videoUrl = result.data[1]?.url || result.data[0]?.url;
          }

          if (!videoUrl) throw new Error("[Alya Core] No video URL found");

          return {
            id: result.id || `tiktok_${Date.now()}`,
            title: result.title || "",
            author:
              result.author?.fullname ||
              result.author?.nickname ||
              "TikTok User",
            cover: result.cover || "",
            views: formatNumbers(parseDelimitedNumber(result.stats?.views || 0)),
            likes: formatNumbers(parseDelimitedNumber(result.stats?.likes || 0)),
            videoUrl,
            audioUrl: getFirstUrl([result.music_info?.url, result.music?.url, result.audio]),
            duration: normalizeDuration(result.durations || result.duration || 0),
          };
        },
      },
      {
        name: "Delirius",
        fn: async () => {
          const res = await axios.get(
            `${deliriusUrl}download/tiktok?url=${encodeURIComponent(url)}`,
            { timeout: 20000 },
          );
          const data = res.data?.data;
          if (!data) throw new Error("No data in Delirius");

          let videoUrl = null;
          if (data.meta?.media && Array.isArray(data.meta.media)) {
            const videoMedia = data.meta.media.find((m) => m.type === "video");
            videoUrl = videoMedia?.org || videoMedia?.hd || videoMedia?.wm;
          }
          videoUrl = videoUrl || data.url;

          if (!videoUrl) throw new Error("[Delirius] No video URL found");

          return {
            id: data.id || `tiktok_${Date.now()}`,
            title: data.title || "",
            author:
              data.author?.nickname || data.author?.username || "TikTok User",
            cover: data.cover || "",
            views: formatNumbers(parseDelimitedNumber(data.repro || 0)),
            likes: formatNumbers(parseDelimitedNumber(data.like || 0)),
            videoUrl,
            audioUrl: getFirstUrl([data.music?.playUrl, data.music?.url, data.audio]),
            duration: normalizeDuration(data.duration || 0),
          };
        },
      },
      {
        name: "Faa",
        fn: async () => {
          const res = await axios.get(
            `${faaUrl}faa/tiktok?url=${encodeURIComponent(url)}`,
            { timeout: 20000 },
          );
          const result = res.data?.result;
          if (!result) throw new Error("No result in Faa");

          const videoUrl =
            result.alternatives?.selected || result.data || result.url;
          if (!videoUrl) throw new Error("[Faa] No video URL found");

          return {
            id: result.id || `tiktok_${Date.now()}`,
            title: result.title || "",
            author:
              result.author?.nickname ||
              result.author?.username ||
              "TikTok User",
            cover: result.cover || "",
            views: formatNumbers(parseDelimitedNumber(result.stats?.views || 0)),
            likes: formatNumbers(parseDelimitedNumber(result.stats?.likes || 0)),
            videoUrl,
            audioUrl: getFirstUrl([result.music_info?.url, result.music?.url]),
            duration: result.duration
              ? normalizeDuration(
                  parseInt(String(result.duration).match(/\d+/)?.[0] || 0),
                )
              : 0,
          };
        },
      },
    ];

    try {
      const winner = await Promise.any(
        apis.map((api) =>
          api.fn().then((info) => {
            if (!info.videoUrl)
              throw new Error(`[${api.name}] No videoUrl returned`);
            console.log(`[TikTokDownloader Descarga] Ganador: ${api.name}`);
            return { info, name: api.name };
          }),
        ),
      );

      let info = winner.info;

      // Fallback secundario para llenar faltantes en vistas, likes, autor, portada o audioUrl
      const viewsEmpty = !info.views || info.views === "0" || info.views === "0.0";
      const likesEmpty = !info.likes || info.likes === "0" || info.likes === "0.0";
      const audioEmpty = !info.audioUrl;

      if (viewsEmpty || likesEmpty || audioEmpty) {
        for (const api of apis) {
          if (api.name === winner.name) continue;
          try {
            const candidate = await api.fn();
            if (!candidate) continue;

            if (viewsEmpty && candidate.views && candidate.views !== "0") {
              info.views = candidate.views;
            }
            if (likesEmpty && candidate.likes && candidate.likes !== "0") {
              info.likes = candidate.likes;
            }
            if (audioEmpty && candidate.audioUrl) {
              info.audioUrl = candidate.audioUrl;
            }
            if ((!info.duration || info.duration === 0) && candidate.duration) {
              info.duration = candidate.duration;
            }
            if (!info.cover && candidate.cover) {
              info.cover = candidate.cover;
            }
            if (!info.title && candidate.title) {
              info.title = candidate.title;
            }
            if (!info.author && candidate.author) {
              info.author = candidate.author;
            }

            if (info.views !== "0" && info.likes !== "0" && info.audioUrl) break;
          } catch (e) {
            // Ignorar fallos de APIs secundarias
          }
        }
      }

      return info;
    } catch (e) {
      console.error(
        "[TikTokDownloader Descarga] Todas las fuentes de descarga fallaron:",
        e.errors || e.message,
      );
      throw new Error(
        "Todas las APIs de descarga de TikTok están saturadas o caídas. Intenta más tarde.",
      );
    }
  }

  async getAudio(url) {
    const info = await this.getDownloadInfo(url);
    const cachePath = path.join(this.tempDir, `${info.id}.mp3`);

    if (fs.existsSync(cachePath)) {
      console.log(`[TikTok Caché] Cargando audio: ${info.id}`);
      return { path: cachePath, info };
    }

    const tempIn = path.join(this.tempDir, `raw_audio_${info.id}`);

    // Si no se extrajo URL directa de audio, usamos el video como origen para extraer la pista de sonido
    const downloadUrl = info.audioUrl || info.videoUrl;

    console.log(`[TikTokDownloader] Descargando audio/fuente desde: ${downloadUrl}`);
    await downloadStreamToFile(downloadUrl, tempIn, { timeout: 60000 });

    console.log("[TikTokDownloader] Transcodificando audio a MP3...");
    await ffmpegSemaphore.run(
      () =>
        new Promise((resolve, reject) => {
          ffmpeg(tempIn)
            .outputOptions([
              "-vn",
              "-preset ultrafast",
              "-acodec libmp3lame",
              "-ac 2",
              "-ab 192k",
              "-ar 44100",
            ])
            .on("error", reject)
            .on("end", resolve)
            .save(cachePath);
        }),
    );

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

    console.log("[TikTokDownloader] Transcodificando video con FFmpeg...");
    await ffmpegSemaphore.run(
      () =>
        new Promise((resolve, reject) => {
          ffmpeg(tempIn)
            .outputOptions([
              "-threads 2",
              "-c:v libx264",
              "-preset ultrafast",
              "-profile:v baseline",
              "-level 3.0",
              "-pix_fmt yuv420p",
              "-c:a aac",
              "-movflags +faststart",
              "-deadline realtime",
            ])
            .on("error", reject)
            .on("end", resolve)
            .save(cachePath);
        }),
    );

    if (fs.existsSync(tempIn)) fs.unlinkSync(tempIn);
    return { path: cachePath, info };
  }
}

export default new TikTokDownloader();
