import type { IncomingMessage, ServerResponse } from 'node:http'
import { Readable } from 'node:stream'
import type { ReadableStream as NodeReadableStream } from 'node:stream/web'
import tailwindcss from '@tailwindcss/vite'
import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vite'

function isBlockedHost(hostname: string): boolean {
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

function rewriteHlsManifest(manifestText: string, baseUrl: URL): string {
  return manifestText
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim()
      if (!trimmed) return line
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uriValue: string) => {
          try {
            const resolved = new URL(uriValue, baseUrl).toString()
            return `URI="/api/stream-proxy?url=${encodeURIComponent(resolved)}"`
          } catch {
            return _match
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

function streamCorsProxyPlugin(): Plugin {
  const handler = async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (!req.url || !req.url.startsWith('/api/stream-proxy')) {
      next()
      return
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
      })
      res.end()
      return
    }

    try {
      const parsedReq = new URL(req.url, 'https://localhost')
      const rawTarget = parsedReq.searchParams.get('url')
      if (!rawTarget) {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Missing ?url= query parameter' }))
        return
      }

      const targetUrl = new URL(rawTarget)
      if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        res.writeHead(400, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Only http/https media URLs are supported' }))
        return
      }

      if (isBlockedHost(targetUrl.hostname)) {
        res.writeHead(403, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ error: 'Private/loopback hosts cannot be proxied' }))
        return
      }

      const upstreamHeaders: Record<string, string> = {
        'User-Agent': 'VRLounge-StreamProxy/1.0',
      }
      if (typeof req.headers.range === 'string') {
        upstreamHeaders.Range = req.headers.range
      }

      const upstream = await fetch(targetUrl.toString(), {
        method: req.method === 'HEAD' ? 'HEAD' : 'GET',
        headers: upstreamHeaders,
        redirect: 'follow',
      })

      const contentType = upstream.headers.get('content-type') ?? 'application/octet-stream'
      const isHls =
        contentType.includes('mpegurl') ||
        targetUrl.pathname.toLowerCase().endsWith('.m3u8')

      const responseHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Expose-Headers': 'Content-Length, Content-Range, Accept-Ranges',
        'Cross-Origin-Resource-Policy': 'cross-origin',
        'Content-Type': contentType,
      }

      for (const passthrough of ['content-range', 'accept-ranges', 'cache-control']) {
        const val = upstream.headers.get(passthrough)
        if (val) responseHeaders[passthrough] = val
      }

      if (isHls && req.method !== 'HEAD') {
        const text = await upstream.text()
        const finalBase = new URL(upstream.url || targetUrl.toString())
        const rewritten = rewriteHlsManifest(text, finalBase)
        responseHeaders['Content-Type'] = 'application/vnd.apple.mpegurl; charset=utf-8'
        res.writeHead(upstream.status, responseHeaders)
        res.end(rewritten)
        return
      }

      const contentLength = upstream.headers.get('content-length')
      if (contentLength) {
        responseHeaders['Content-Length'] = contentLength
      }

      res.writeHead(upstream.status, responseHeaders)
      if (!upstream.body || req.method === 'HEAD') {
        res.end()
        return
      }

      const nodeStream = Readable.fromWeb(upstream.body as unknown as NodeReadableStream)
      req.on('close', () => {
        nodeStream.destroy()
      })
      nodeStream.pipe(res)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upstream stream proxy error'
      if (!res.headersSent) {
        res.writeHead(502, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        })
      }
      res.end(JSON.stringify({ error: message }))
    }
  }

  return {
    name: 'vr-lounge-stream-cors-proxy',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [basicSsl(), tailwindcss(), react(), streamCorsProxyPlugin()],
  server: {
    host: true,
    port: 5173,
  },
  preview: {
    host: true,
    port: 4173,
  },
})
