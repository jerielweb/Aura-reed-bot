// Desarrollado por Ander

const API_BASE = 'https://embed.dlsrv.online'
const YT_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|live\/|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0'
const VIDEO_QUALITIES = ['144', '240', '360', '480', '720', '1080']
const DEFAULT_VIDEO_QUALITY = '1080'
const AUDIO_QUALITY = '128'

function apiHeaders(videoId) {
  return {
    accept: '*/*',
    'accept-language': 'es-419,es;q=0.9,es-ES;q=0.8,en;q=0.7',
    'content-type': 'application/json',
    origin: API_BASE,
    referer: `${API_BASE}/v2/full?videoId=${videoId}`,
    'user-agent': USER_AGENT
  }
}

function extractVideoId(url) {
  return String(url || '').match(YT_REGEX)?.[1] || null
}

async function getInfo(videoId) {
  const res = await fetch(`${API_BASE}/api/info`, {
    method: 'POST',
    headers: apiHeaders(videoId),
    body: JSON.stringify({ videoId })
  })
  if (!res.ok) throw new Error(`El servicio respondió HTTP ${res.status}`)
  const data = await res.json()
  if (data.status !== 'info' || !data.info) throw new Error('No se pudo obtener la información del video')

  const videos = []
  for (const f of data.info.formats || []) {
    if (f.type === 'video') {
      const q = String(f.quality).replace(/p$/i, '')
      videos.push({ quality: q, size: Number(f.fileSize) || 0 })
    }
  }
  videos.sort((a, b) => Number(b.quality) - Number(a.quality))

  return {
    videoId,
    title: data.info.title || 'YouTube',
    author: data.info.author || '',
    duration: Number(data.info.duration) || 0,
    thumbnail: data.info.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    videos
  }
}

async function getDownload(videoId, format, quality) {
  const res = await fetch(`${API_BASE}/api/download/${format}`, {
    method: 'POST',
    headers: apiHeaders(videoId),
    body: JSON.stringify({ videoId, format, quality: String(quality) })
  })
  if (!res.ok) throw new Error(`El servicio rechazó la descarga (HTTP ${res.status})`)
  const data = await res.json()
  if (data.status !== 'tunnel' || !data.url) throw new Error('No se pudo generar el enlace de descarga')
  return { url: data.url, filename: data.filename || '', duration: Number(data.duration) || 0 }
}

async function getVideo(url, quality = DEFAULT_VIDEO_QUALITY) {
  const videoId = extractVideoId(url)
  if (!videoId) throw new Error('Enlace de YouTube inválido')

  const info = await getInfo(videoId)
  const available = info.videos.map(v => v.quality)
  let q = VIDEO_QUALITIES.includes(String(quality).replace(/p$/i, '')) ? String(quality).replace(/p$/i, '') : DEFAULT_VIDEO_QUALITY
  if (available.length && !available.includes(q)) {
    q = available.find(a => Number(a) <= Number(q)) || available[available.length - 1]
  }

  const tunnel = await getDownload(videoId, 'mp4', q)
  const size = info.videos.find(v => v.quality === q)?.size || 0
  return { ...info, quality: q, size, downloadUrl: tunnel.url, filename: tunnel.filename }
}

async function getAudio(url) {
  const videoId = extractVideoId(url)
  if (!videoId) throw new Error('Enlace de YouTube inválido')

  const info = await getInfo(videoId)
  const tunnel = await getDownload(videoId, 'mp3', AUDIO_QUALITY)
  return { ...info, bitrate: AUDIO_QUALITY, downloadUrl: tunnel.url, filename: tunnel.filename }
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

function formatSize(bytes) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${Math.ceil(bytes / 1024)} KB`
}

export {
  getInfo, getDownload, getVideo, getAudio, extractVideoId,
  formatDuration, formatSize, YT_REGEX, VIDEO_QUALITIES, DEFAULT_VIDEO_QUALITY, AUDIO_QUALITY
}