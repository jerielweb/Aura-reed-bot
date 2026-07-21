import axios from "axios";
import { Downloader } from "@tobyg74/tiktok-api-dl";
import formatNumbers from "./functions/formatNumbers.js";

const getFirstValue = (...values) =>
  values.find((value) => value !== undefined && value !== null);
const getFirstNonEmpty = (...values) =>
  values.find((value) => value !== undefined && value !== null && value !== "");
const getFirstUrl = (value) => {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value[0];
  if (value.url_list && Array.isArray(value.url_list)) return value.url_list[0];
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

export function parseDownloaderResult(result) {
  if (!result) return null;

  const parsed = result.resultNotParsed || result.raw || result;

  const videoObj =
    result.video ||
    parsed.content?.video ||
    parsed.video ||
    parsed.playback ||
    {};
  const musicObj = result.music || parsed.content?.music || parsed.music || {};
  const stats =
    parsed.content?.statistics || parsed.statistics || result.statistics || {};

  const videoUrl = getFirstUrl(
    videoObj.playAddr ||
      videoObj.downloadAddr ||
      videoObj.url ||
      videoObj.play_addr ||
      videoObj.download_addr ||
      parsed.url ||
      parsed.data?.video,
  );

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

  const likesVal =
    stats?.digg_count ||
    stats?.likeCount ||
    stats?.like_count ||
    stats?.like ||
    0;
  const viewsVal =
    stats?.play_count || stats?.playCount || stats?.play || stats?.views || 0;
  const coverVal =
    getFirstUrl(
      videoObj.cover ||
        parsed.content?.video?.cover ||
        parsed.cover ||
        parsed.thumb,
    ) || "";
  const audioUrl = getFirstUrl(
    musicObj.playUrl ||
      musicObj.downloadUrl ||
      musicObj.url ||
      parsed.content?.music?.play_url ||
      parsed.music?.playUrl ||
      parsed.playUrl,
  );
  const durationVal =
    parsed.content?.video?.duration ||
    parsed.duration ||
    result.duration ||
    parsed.content?.duration ||
    0;

  if (!videoUrl) return null;

  return {
    id: videoID,
    title: desc,
    likes: formatNumbers(likesVal || 0),
    views: formatNumbers(viewsVal || 0),
    cover: coverVal,
    videoUrl,
    audioUrl,
    duration: normalizeDuration(durationVal || 0),
  };
}

class TikTokDownloader {
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

    try {
      console.log(
        "[TikTokDownloader] Intentando descargar metadatos con tobyg74/tiktok-api-dl...",
      );

      const result = await Downloader(url);
      const parsed = result.resultNotParsed || result.raw || result;

      const videoObj =
        result.video ||
        parsed.content?.video ||
        parsed.video ||
        parsed.playback ||
        {};
      const musicObj =
        result.music || parsed.content?.music || parsed.music || {};
      const stats =
        parsed.content?.statistics ||
        parsed.statistics ||
        result.statistics ||
        {};

      const videoUrl = getFirstUrl(
        videoObj.playAddr ||
          videoObj.downloadAddr ||
          videoObj.url ||
          videoObj.play_addr ||
          videoObj.download_addr ||
          parsed.url ||
          parsed.data?.video,
      );

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

      const likesVal =
        stats?.digg_count ||
        stats?.likeCount ||
        stats?.like_count ||
        stats?.like ||
        0;
      const viewsVal =
        stats?.play_count ||
        stats?.playCount ||
        stats?.play ||
        stats?.views ||
        0;
      const coverVal =
        getFirstUrl(
          videoObj.cover ||
            parsed.content?.video?.cover ||
            parsed.cover ||
            parsed.thumb,
        ) || "";
      const audioUrl = getFirstUrl(
        musicObj.playUrl ||
          musicObj.downloadUrl ||
          musicObj.url ||
          parsed.content?.music?.play_url ||
          parsed.music?.playUrl ||
          parsed.playUrl,
      );
      const durationVal =
        parsed.content?.video?.duration ||
        parsed.duration ||
        result.duration ||
        parsed.content?.duration ||
        0;

      if (videoUrl) {
        console.log("[TikTokDownloader] Éxito usando tobyg74/tiktok-api-dl");
        return {
          id: videoID,
          title: desc,
          likes: formatNumbers(likesVal || 0),
          views: formatNumbers(viewsVal || 0),
          cover: coverVal,
          videoUrl,
          audioUrl,
          duration: normalizeDuration(durationVal || 0),
        };
      }
    } catch (e) {
      console.error(
        "[TikTokDownloader] tobyg74/tiktok-api-dl falló, usando APIs de respaldo:",
        e.message,
      );
    }

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
            views: formatNumbers(
              parseDelimitedNumber(result.stats?.views || 0),
            ),
            likes: formatNumbers(
              parseDelimitedNumber(result.stats?.likes || 0),
            ),
            videoUrl,
            audioUrl: result.music_info?.url || null,
            duration: normalizeDuration(
              result.durations || result.duration || 0,
            ),
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
            audioUrl: data.music?.playUrl?.[0] || data.music?.url,
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
            views: formatNumbers(result.stats?.views || 0),
            likes: formatNumbers(result.stats?.likes || 0),
            videoUrl,
            audioUrl: result.music_info?.url,
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

      const viewsEmpty =
        !info.views ||
        info.views === 0 ||
        info.views === "0" ||
        info.views === "0.0";
      const likesEmpty =
        !info.likes ||
        info.likes === 0 ||
        info.likes === "0" ||
        info.likes === "0.0";

      if (viewsEmpty || likesEmpty) {
        for (const api of apis) {
          if (api.name === winner.name) continue;
          try {
            const candidate = await api.fn();
            if (!candidate) continue;
            if (viewsEmpty && candidate.views) {
              info.views = candidate.views;
            }
            if (likesEmpty && candidate.likes) {
              info.likes = candidate.likes;
            }
            if ((!info.duration || info.duration === 0) && candidate.duration) {
              info.duration = candidate.duration;
            }
            if ((!info.cover || info.cover === "") && candidate.cover) {
              info.cover = candidate.cover;
            }
            if (
              (!info.audioUrl || info.audioUrl === "") &&
              candidate.audioUrl
            ) {
              info.audioUrl = candidate.audioUrl;
            }
            if ((!info.title || info.title === "") && candidate.title) {
              info.title = candidate.title;
            }
            if ((!info.author || info.author === "") && candidate.author) {
              info.author = candidate.author;
            }
            if (info.views && info.likes) break;
          } catch (e) {
            // Ignorar errores de candidatos secundarios
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
    const downloadUrl = info.audioUrl || info.videoUrl;

    if (!downloadUrl) {
      throw new Error("No se encontró URL directa para el audio.");
    }

    return { url: downloadUrl, info };
  }

  async getVideo(url) {
    const info = await this.getDownloadInfo(url);

    if (!info.videoUrl) {
      throw new Error("No se encontró URL directa para el video.");
    }

    return { url: info.videoUrl, info };
  }
}

export default new TikTokDownloader();
