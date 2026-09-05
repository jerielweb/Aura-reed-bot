import axios from "axios";

const API_BASE = "https://embed.dlsrv.online";
const YT_REGEX =
  /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function apiHeaders(videoId) {
  return {
    accept: "*/*",
    "accept-language": "es-419,es;q=0.9,es-ES;q=0.8,en;q=0.7",
    "content-type": "application/json",
    origin: API_BASE,
    referer: `${API_BASE}/v2/full?videoId=${videoId}`,
    "user-agent": USER_AGENT,
    "sec-ch-ua": '"Not_A Brand";v="8", "Chromium";v="120"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Windows"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
  };
}

function extractVideoId(url) {
  return String(url || "").match(YT_REGEX)?.[1] || null;
}

async function getInfo(videoId) {
  const res = await axios.post(
    `${API_BASE}/api/info`,
    { videoId },
    { headers: apiHeaders(videoId) },
  );

  const data = res.data;
  if (data.status !== "info" || !data.info)
    throw new Error("No se pudo obtener información del video.");

  const videos = [];
  for (const f of data.info.formats || []) {
    if (f.type === "video") {
      const q = String(f.quality).replace(/p$/i, "");
      videos.push({ quality: q, size: Number(f.fileSize) || 0 });
    }
  }
  videos.sort((a, b) => Number(b.quality) - Number(a.quality));

  return {
    videoId,
    title: data.info.title || "YouTube",
    author: data.info.author || "",
    duration: Number(data.info.duration) || 0,
    thumbnail:
      data.info.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    videos,
  };
}

async function getDownload(videoId, format, quality) {
  const res = await axios.post(
    `${API_BASE}/api/download/${format}`,
    { videoId, format, quality: String(quality) },
    { headers: apiHeaders(videoId) },
  );

  const data = res.data;
  if (data.status !== "tunnel" || !data.url)
    throw new Error("No se pudo obtener el enlace directo.");
  return {
    url: data.url,
    filename: data.filename || "",
    duration: Number(data.duration) || 0,
  };
}

export async function getVideo(url, quality = "1080") {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Enlace de YouTube inválido");

  const info = await getInfo(videoId);
  const available = info.videos.map((v) => v.quality);
  let q = String(quality).replace(/p$/i, "");
  if (available.length && !available.includes(q)) {
    q =
      available.find((a) => Number(a) <= Number(q)) ||
      available[available.length - 1];
  }

  const tunnel = await getDownload(videoId, "mp4", q);
  const size = info.videos.find((v) => v.quality === q)?.size || 0;
  return {
    ...info,
    quality: q,
    size,
    downloadUrl: tunnel.url,
    filename: tunnel.filename,
  };
}

export async function getAudio(url) {
  const videoId = extractVideoId(url);
  if (!videoId) throw new Error("Enlace de YouTube inválido");

  const info = await getInfo(videoId);
  const tunnel = await getDownload(videoId, "mp3", "128");
  return {
    ...info,
    bitrate: "128",
    downloadUrl: tunnel.url,
    filename: tunnel.filename,
  };
}

export function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0));
  const h = Math.floor(s / 3600);
  const min = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0
    ? `${h}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
    : `${min}:${String(sec).padStart(2, "0")}`;
}

export function formatSize(bytes) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`;
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}
