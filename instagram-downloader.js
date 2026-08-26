// Desarrollado por Ander

import got from 'got'
import { CookieJar } from 'tough-cookie'
import { HttpsProxyAgent } from 'hpagent'

const API_BASE = 'https://api.vidssave.com/api/contentsite_api/media'
const SSE_BASE = 'https://api.vidssave.com/sse/contentsite_api/media'
const VIDSSAVE_AUTH = process.env.VIDSSAVE_AUTH || '20250901majwlqo'
const VIDSSAVE_DOMAIN = 'api-ak.vidssave.com'
const DOWNLOAD_DOMAIN = 'vidssave.com'
const VIDSSAVE_PROXY = process.env.VIDSSAVE_PROXY || ''
const IG_REGEX = /(?:instagram\.com|instagr\.am)\/(?:(?:reels?|p|tv)\/([A-Za-z0-9_-]+)|stories\/[^/]+\/(\d+))/
const MAX_VIDEO_BYTES = 280 * 1024 * 1024

const PARSE_ATTEMPTS = 3
const PARSE_RETRY_DELAY = 1500
const SSE_TIMEOUT = 90000
const SSE_ATTEMPTS = 2
const SSE_RETRY_DELAY = 1500

const cookieJar = new CookieJar()

const client = got.extend({
  http2: !VIDSSAVE_PROXY,
  cookieJar,
  timeout: { request: 60000 },
  retry: { limit: 2, methods: ['GET', 'POST'] },
  headers: {
    accept: '*/*',
    'accept-language': 'es-419,es;q=0.9,es-ES;q=0.8,en;q=0.7',
    origin: 'https://vidssave.com',
    referer: 'https://vidssave.com/',
    'sec-ch-ua': '"Not;A=Brand";v="8", "Chromium";v="150", "Microsoft Edge";v="150"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-site',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0.0.0 Safari/537.36 Edg/150.0.0.0'
  },
  ...(VIDSSAVE_PROXY ? { agent: { https: new HttpsProxyAgent({ proxy: VIDSSAVE_PROXY }) } } : {})
})

async function postForm(endpoint, fields) {
  const body = new URLSearchParams(fields).toString()
  const raw = await client.post(endpoint, {
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body
  }).text()
  return safeJson(raw)
}

function safeJson(raw) {
  try {
    return JSON.parse(raw)
  } catch {
    try {
      return JSON.parse(Buffer.from(raw, 'base64').toString('utf-8'))
    } catch {
      return null
    }
  }
}

async function parse(url) {
  let data = null
  let formats = []
  for (let i = 0; i < PARSE_ATTEMPTS; i++) {
    const json = await postForm(`${API_BASE}/parse`, {
      auth: VIDSSAVE_AUTH,
      domain: VIDSSAVE_DOMAIN,
      origin: 'source',
      link: url
    })
    if (json?.status === 1 && json.data) {
      const f = collectFormats(json.data)
      if (f.length) { data = json.data; formats = f; break }
    }
    if (i < PARSE_ATTEMPTS - 1) await sleep(PARSE_RETRY_DELAY)
  }
  if (!formats.length) throw new Error('VidsSave no devolvió formatos')
  return {
    id: data.id,
    title: data.title || '',
    thumbnail: data.thumbnail || '',
    duration: Number(data.duration) || 0,
    formats
  }
}

function collectFormats(data) {
  const map = new Map()
  const push = (raw, type) => {
    const token = raw?.resource_content || raw?.download_url
    if (!token) return
    const kind = type || raw.type || 'video'
    const entry = {
      type: kind,
      quality: raw.quality || '',
      format: raw.format,
      size: Number(raw.size) || 0,
      token: raw?.resource_content || '',
      directUrl: raw.download_url || ''
    }
    const key = `${entry.type}:${entry.quality}:${entry.size}:${entry.directUrl}`
    const existing = map.get(key)
    if (!existing || (!existing.directUrl && entry.directUrl)) map.set(key, entry)
  }
  for (const r of data.resources || []) push(r)
  for (const group of data.media || []) {
    // Si el grupo contiene recursos internos (carruseles)
    if (group.resources && Array.isArray(group.resources)) {
      for (const r of group.resources) push(r, group.type || r.type)
    } else {
      push(group, group.type)
    }
  }
  return [...map.values()]
}


function qualityValue(q) {
  const n = parseInt(String(q).replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : 0
}

function pickBestVideo(videos) {
  return [...videos].sort((a, b) => {
    const qa = qualityValue(a.quality), qb = qualityValue(b.quality)
    if (qb !== qa) return qb - qa
    return (b.size || 0) - (a.size || 0)
  })[0]
}

async function resolveDownload(token) {
  let lastErr = null
  for (let i = 0; i < SSE_ATTEMPTS; i++) {
    try {
      const taskId = await requestDownload(token)
      return await readSSE(taskId)
    } catch (e) {
      lastErr = e
      await sleep(SSE_RETRY_DELAY)
    }
  }
  throw new Error(`procesamiento falló tras ${SSE_ATTEMPTS} intentos: ${lastErr?.message || ''}`)
}

async function requestDownload(token) {
  const json = await postForm(`${API_BASE}/download`, {
    auth: VIDSSAVE_AUTH,
    domain: VIDSSAVE_DOMAIN,
    request: token,
    no_encrypt: '1'
  })
  if (json?.status !== 1 || !json.data?.task_id) throw new Error('no se obtuvo task_id')
  return json.data.task_id
}

function readSSE(taskId) {
  const sseUrl = `${SSE_BASE}/download_query?` + new URLSearchParams({
    auth: VIDSSAVE_AUTH,
    domain: VIDSSAVE_DOMAIN,
    task_id: taskId,
    download_domain: DOWNLOAD_DOMAIN,
    origin: 'content_site'
  }).toString()

  return new Promise((resolve, reject) => {
    const stream = client.stream(sseUrl, { headers: { accept: 'text/event-stream' } })
    let buffer = ''
    let settled = false
    const timer = setTimeout(() => finish(reject, new Error('timeout de procesamiento')), SSE_TIMEOUT)
    const finish = (fn, arg) => { if (!settled) { settled = true; clearTimeout(timer); stream.destroy(); fn(arg) } }

    stream.on('data', chunk => {
      buffer += chunk.toString()
      let idx
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const rawEvent = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        const dataLine = rawEvent.split('\n').find(l => l.startsWith('data:'))
        if (!dataLine) continue
        let payload
        try { payload = JSON.parse(dataLine.slice(5).trim()) } catch { continue }
        if (payload.status === 'success' && payload.download_link) {
          finish(resolve, {
            link: payload.download_link,
            filesize: payload.filesize || 0,
            type: payload.download_type || ''
          })
        } else if (payload.status === 'error' || payload.status === 'failed') {
          finish(reject, new Error('procesamiento falló'))
        }
      }
    })
    stream.on('error', e => finish(reject, e))
    stream.on('end', () => finish(reject, new Error('stream terminó sin success')))
  })
}

async function downloadInstagram(url) {
  if (!IG_REGEX.test(url)) throw new Error('Enlace de Instagram inválido')
  const info = await parse(url)

    const videos = info.formats.filter(f => f.type === 'video')
  if (!videos.length) {
    const imageFormats = info.formats.filter(f => f.type === 'image' || f.type === 'photo')
    if (!imageFormats.length) throw new Error('No hay video ni imágenes disponibles')
    
    const images = []
    for (const imgF of imageFormats.slice(0, 10)) {
      if (imgF.directUrl) {
        images.push(imgF.directUrl)
      } else if (imgF.token) {
        try {
          const resolved = await resolveDownload(imgF.token)
          if (resolved.link) images.push(resolved.link)
        } catch (e) {
          if (imgF.directUrl) images.push(imgF.directUrl)
        }
      }
    }

    if (!images.length) throw new Error('No se pudieron resolver los enlaces de las imágenes')
    return { type: 'images', title: info.title, thumbnail: info.thumbnail, images }
  }


  const target = pickBestVideo(videos)
  let downloadUrl = null
  let filesize = target.size || 0
  try {
    const resolved = await resolveDownload(target.token)
    downloadUrl = resolved.link
    filesize = resolved.filesize || filesize
  } catch (e) {
    if (!target.directUrl) throw e
    downloadUrl = target.directUrl
  }

  if (filesize && filesize > MAX_VIDEO_BYTES) throw new Error(`Archivo demasiado grande: ${formatSize(filesize)}`)

  return {
    type: 'video',
    title: info.title,
    thumbnail: info.thumbnail,
    duration: info.duration,
    quality: target.quality,
    filesize,
    downloadUrl
  }
}

function formatDuration(seconds) {
  const s = Math.max(0, Math.floor(seconds || 0))
  const h = Math.floor(s / 3600), min = Math.floor((s % 3600) / 60), sec = s % 60
  return h > 0 ? `${h}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${min}:${String(sec).padStart(2, '0')}`
}

function formatSize(bytes) {
  if (bytes >= 1073741824) return `${(bytes / 1073741824).toFixed(2)} GB`
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`
  return `${Math.ceil(bytes / 1024)} KB`
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

export {
  parse, downloadInstagram, resolveDownload, collectFormats, pickBestVideo,
  formatDuration, formatSize, IG_REGEX
}