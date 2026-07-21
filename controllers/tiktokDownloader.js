import axios from "axios";
import formatNumbers from "./functions/formatNumbers.js";

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
    const alyacoreUrl =
      global.Apis?.apiAiya?.url || "https://api.alyacore.xyz/";

    try {
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
    } catch (e) {
      console.error(
        "[TikTokDownloader Descarga] Error con Alya Core:",
        e.message,
      );
      throw new Error(
        "La API de descarga de TikTok (Alya Core) falló o está fuera de servicio.",
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
