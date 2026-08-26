// Desarrollado por Ander

const API_URL = 'https://hub.convert1s.com/api/download'
const ORIGIN = 'https://real-y2mate.com'
const REFERER = 'https://real-y2mate.com/'
const YT_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0'
const VALID_QUALITIES = ['144p', '240p', '360p', '480p', '720p', '1080p', '1440p', '2160p']
const DEFAULT_QUALITY = '1080p'
const POLL_INTERVAL = 2500
const POLL_MAX = 80

function baseHeaders(extra = {}) {
  return {
    accept: 'application/json',
    'accept-language': 'es-419,es;q=0.9,es-ES;q=0.8,en;q=0.7',
    origin: ORIGIN,
    referer: REFERER,
    'user-agent': USER_AGENT,
    ...extra
  }
}

function extractVideoId(url) {
  return String(url || '').match(YT_REGEX)?.[1] || null
}

function normalizeQuality(quality) {
  const q = String(quality || '').replace(/p$/i, '')
  return q && VALID_QUALITIES.includes(`${q}p`) ? `${q}p` : DEFAULT_QUALITY
}

async function convert(url, quality = DEFAULT_QUALITY) {
  const videoId = extractVideoId(url)
  if (!videoId) throw new Error('Enlace de YouTube inválido')
  const q = normalizeQuality(quality)

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: baseHeaders({ 'content-type': 'application/json' }),
    body: JSON.stringify({
      url,
      os: 'windows',
      output: { type: 'video', format: 'mp4', quality: q },
      audio: { bitrate: '128k' }
    })
  })
  if (!res.ok) throw new Error(`El servicio respondió HTTP ${res.status}`)
  const data = await res.json()
  if (!data.statusUrl) throw new Error(data.error || 'No se pudo iniciar la conversión')

  let title = data.title || ''
  for (let i = 0; i < POLL_MAX; i++) {
    const statusRes = await fetch(data.statusUrl, { headers: baseHeaders() })
    if (!statusRes.ok) { await sleep(POLL_INTERVAL); continue }
    const status = await statusRes.json()
    if (status.title) title = status.title
    if (status.status === 'error' || status.status === 'failed') {
      throw new Error(status.error || 'La conversión falló')
    }
    if (status.status === 'completed' && status.downloadUrl) {
      return {
        videoId,
        downloadUrl: status.downloadUrl,
        title,
        selectedQuality: data.selectedQuality || q,
        duration: data.duration || status.duration || 0
      }
    }
    await sleep(POLL_INTERVAL)
  }
  throw new Error('La conversión tardó demasiado, intenta de nuevo')
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(s / 3600)
  const min = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return h > 0
    ? `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
    : `${min}:${String(sec).padStart(2, '0')}`
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

export { convert, extractVideoId, normalizeQuality, formatDuration, YT_REGEX, VALID_QUALITIES, DEFAULT_QUALITY }