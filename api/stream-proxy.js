// Vercel Serverless Function for CORS-clean MP4 & HLS (.m3u8) VideoTexture proxying
import { Readable } from 'node:stream'

function isBlockedHost(hostname) {
  const lower = hostname.toLowerCase()
  if (
    lower === 'localhost' ||
    lower === '127.0.0.1' ||
    lower === '0.0.0.0' ||
    lower === '::1' ||
    lower === '[::1]' ||
    lower.endsWith('.localhost')
  ) {
    return true
  }
  if (/^10\./.test(lower) || /^192\.168\./.test(lower) || /^169\.254\./.test(lower)) {
    return true
  }
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(lower)) {
    return true
  }
  return false
}

function rewriteHlsManifest(manifestText, baseUrl) {
  return manifestText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (match, uriValue) => {
          try {
            const resolved = new URL(uriValue, baseUrl).toString()
            return `URI="/api/stream-proxy?url=${encodeURIComponent(resolved)}"`
          } catch {
            return match
          }
        })
      }
      try {
        const resolved = new URL(trimmed, baseUrl).toString()
        return `/api/stream-proxy?url=${encodeURIComponent(resolved)}`
      } catch {
        return line
      }
    })
    .join('\n')
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type')
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Content-Length, Content-Range, Accept-Ranges',
  )
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  const rawTarget = typeof req.query?.url === 'string' ? req.query.url : ''
  if (!rawTarget) {
    res.status(400).json({ error: 'Missing ?url= query parameter' })
    return
  }

  try {
    const targetUrl = new URL(rawTarget)
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      res.status(400).json({ error: 'Only http/https media URLs are supported' })
      return
    }
    if (isBlockedHost(targetUrl.hostname)) {
      res.status(403).json({ error: 'Private/loopback hosts cannot be proxied' })
      return
    }

    const headers = { 'User-Agent': 'VRLounge-StreamProxy/1.0' }
    if (typeof req.headers.range === 'string') {
      headers.Range = req.headers.range
    }

    const upstream = await fetch(targetUrl.toString(), {
      method: req.method === 'HEAD' ? 'HEAD' : 'GET',
      headers,
      redirect: 'follow',
    })

    const contentType = upstream.headers.get('content-type') || 'application/octet-stream'
    const isHls =
      contentType.includes('mpegurl') || targetUrl.pathname.toLowerCase().endsWith('.m3u8')

    for (const h of ['content-range', 'accept-ranges', 'cache-control']) {
      const v = upstream.headers.get(h)
      if (v) res.setHeader(h, v)
    }

    if (isHls && req.method !== 'HEAD') {
      const text = await upstream.text()
      const finalBase = new URL(upstream.url || targetUrl.toString())
      res.setHeader('Content-Type', 'application/vnd.apple.mpegurl; charset=utf-8')
      res.status(upstream.status).send(rewriteHlsManifest(text, finalBase))
      return
    }

    res.setHeader('Content-Type', contentType)
    const len = upstream.headers.get('content-length')
    if (len) res.setHeader('Content-Length', len)
    res.status(upstream.status)

    if (!upstream.body || req.method === 'HEAD') {
      res.end()
      return
    }

    Readable.fromWeb(upstream.body).pipe(res)
  } catch (err) {
    res.status(502).json({
      error: err instanceof Error ? err.message : 'Upstream stream proxy error',
    })
  }
}
