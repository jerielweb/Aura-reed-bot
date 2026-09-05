// Desarrollado por Ander
// Solo funciona con URL de Spotify (open.spotify.com/track/...)

const API_BASE = "https://spotifyapi.sistemasolutions.com/api";
const SITE = "https://www.spotify-downloads.com";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36";
const SP_REGEX = /open\.spotify\.com\/(?:intl-[a-z]+\/)?track\/([a-zA-Z0-9]+)/i;
const QUALITY = "320k";
const POLL_INTERVAL = 3000;
const POLL_MAX = 60;
const MAX_BYTES = 100 * 1024 * 1024;

function apiHeaders(extra = {}) {
  return {
    accept: "*/*",
    "user-agent": UA,
    origin: SITE,
    referer: `${SITE}/`,
    ...extra,
  };
}

async function createJob(url) {
  const res = await fetch(`${API_BASE}/download`, {
    method: "POST",
    headers: apiHeaders({ "content-type": "application/json" }),
    body: JSON.stringify({ url, quality: QUALITY }),
  });

  const texto = await res.text();
  if (!res.ok) throw new Error(`La API respondió HTTP ${res.status}`);

  let data = null;
  try {
    data = JSON.parse(texto);
  } catch {}

  if (data?.error) throw new Error(data.error);
  if (!data?.job_id) throw new Error("No se obtuvo job_id");

  return data.job_id;
}

async function pollJob(jobId) {
  for (let i = 0; i < POLL_MAX; i++) {
    const res = await fetch(`${API_BASE}/status/${jobId}`, {
      headers: apiHeaders(),
    });

    if (res.ok) {
      let data = null;
      try {
        data = JSON.parse(await res.text());
      } catch {}

      if (data) {
        if (data.error) throw new Error(data.error);

        const estado = String(data.status || "");
        const song = data.songs?.[0];

        if (estado === "ready" || estado === "done" || estado === "completed") {
          return {
            name: data.name || song?.name || "Spotify Track",
            artist: data.artist || song?.artist || "Desconocido",
            album: data.album || "",
            duration: data.duration || "",
          };
        }

        if (estado === "failed" || estado === "error") {
          throw new Error(data.error || "la conversión falló");
        }
      }
    }

    await sleep(POLL_INTERVAL);
  }

  throw new Error("la conversión tardó demasiado");
}

async function downloadFile(jobId) {
  const res = await fetch(`${API_BASE}/file/${jobId}`, {
    headers: apiHeaders(),
    redirect: "follow",
  });

  if (!res.ok)
    throw new Error(`No se pudo descargar el archivo (HTTP ${res.status})`);

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_BYTES)
    throw new Error(`Archivo demasiado grande: ${formatSize(buffer.length)}`);
  if (buffer.length < 1024)
    throw new Error(`Archivo inválido (${buffer.length} bytes)`);

  const ct = String(res.headers.get("content-type") || "");
  const esId3 = buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33;
  const esFrame = buffer[0] === 0xff && ((buffer[1] ?? 0) & 0xe0) === 0xe0;

  if (
    !esId3 &&
    !esFrame &&
    !ct.includes("audio") &&
    !ct.includes("octet-stream")
  ) {
    throw new Error(
      `No parece un MP3 válido (content-type: ${ct || "desconocido"})`,
    );
  }

  return buffer;
}

function deleteJob(jobId) {
  fetch(`${API_BASE}/file/${jobId}`, {
    method: "DELETE",
    headers: apiHeaders(),
  }).catch(() => {});
}

export async function spotifyDownload(url) {
  if (!SP_REGEX.test(url)) throw new Error("Enlace de Spotify inválido");

  const jobId = await createJob(url);
  const info = await pollJob(jobId);
  const buffer = await downloadFile(jobId);

  deleteJob(jobId);

  return {
    name: info.name,
    artist: info.artist,
    album: info.album,
    duration: info.duration,
    quality: QUALITY,
    size: buffer.length,
    buffer,
  };
}

export function formatSize(bytes) {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`;
  return `${Math.ceil(bytes / 1024)} KB`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export { SP_REGEX };
