import { SAMPLE_MEDIA_PRESETS } from '../constants/cinema'

export type YouTubeCategory =
  | 'trending'
  | 'music'
  | 'gaming'
  | 'movies'
  | 'lofi'
  | 'openweb'
  | 'cinema'

export interface YouTubeVideoItem {
  id: string
  videoId: string
  title: string
  author: string
  durationSec: number
  views: number
  uploadedText: string
  thumbnailUrl: string
  fallbackThumbnailUrl?: string
  playUrl: string
  source: 'youtube' | 'peertube' | 'cinema'
}

export interface ResolvedStreamCandidate {
  streamUrl: string
  kind: 'hls' | 'mp4'
  audioUrl?: string
  qualityLabel: string
  provider: string
}

export interface ResolvedVideoMedia {
  title?: string
  author?: string
  durationSec?: number
  candidates: ResolvedStreamCandidate[]
  relatedVideos: YouTubeVideoItem[]
}

export interface VideoFeedResult {
  items: YouTubeVideoItem[]
  provider: string
  usedFallback?: boolean
  notice?: string
}

const CUSTOM_INSTANCE_STORAGE_KEY = 'vr-lounge:yt-instance'

const DEFAULT_PIPED_INSTANCES: readonly string[] = [
  'https://pipedapi.kavin.rocks',
  'https://pipedapi-libre.kavin.rocks',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.adminforge.de',
  'https://piped-api.privacy.com.de',
  'https://pipedapi.nosebs.ru',
  'https://api.piped.yt',
  'https://pipedapi.drgns.space',
  'https://pipedapi.ducks.party',
  'https://piped-api.codespace.cz',
  'https://pipedapi.reallyaweso.me',
  'https://api.piped.private.coffee',
  'https://pipedapi.darkness.services',
  'https://pipedapi.orangenet.cc',
  'https://pipedapi.owo.si',
]

const DEFAULT_INVIDIOUS_INSTANCES: readonly string[] = [
  'https://inv.thepixora.com',
  'https://invidious.nerdvpn.de',
  'https://invidious.tiekoetter.com',
  'https://yt.chocolatemoo53.com',
  'https://inv.nadeko.net',
  'https://invidious.f5.si',
  'https://yewtu.be',
]

let dynamicPipedInstances: string[] = [...DEFAULT_PIPED_INSTANCES]
let dynamicInvidiousInstances: string[] = [...DEFAULT_INVIDIOUS_INSTANCES]
let dynamicDiscoveryPromise: Promise<void> | null = null

let preferredPipedBase: string | null = null
let preferredInvidiousBase: string | null = null
const instanceCooldownUntil = new Map<string, number>()

const COOLDOWN_MS = 90_000
const REQUEST_TIMEOUT_MS = 4_800

function normalizeBaseUrl(raw: string): string | null {
  try {
    const trimmed = raw.trim().replace(/\/+$/, '')
    if (!trimmed) return null
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`
  } catch {
    return null
  }
}

export function getCustomYouTubeInstance(): string {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(CUSTOM_INSTANCE_STORAGE_KEY)?.trim()
    if (stored) return stored
  }
  const envVal = (import.meta.env.VITE_YOUTUBE_PROXY_URL as string | undefined)?.trim()
  return envVal || ''
}

export function setCustomYouTubeInstance(url: string): void {
  if (typeof window === 'undefined') return
  const clean = url.trim().replace(/\/+$/, '')
  if (clean) {
    window.localStorage.setItem(CUSTOM_INSTANCE_STORAGE_KEY, clean)
  } else {
    window.localStorage.removeItem(CUSTOM_INSTANCE_STORAGE_KEY)
  }
  instanceCooldownUntil.clear()
}

export function resetInstanceCooldowns(): void {
  instanceCooldownUntil.clear()
  preferredPipedBase = null
  preferredInvidiousBase = null
}

function isCoolingDown(base: string): boolean {
  const until = instanceCooldownUntil.get(base)
  if (!until) return false
  if (Date.now() >= until) {
    instanceCooldownUntil.delete(base)
    return false
  }
  return true
}

function markFailed(base: string): void {
  instanceCooldownUntil.set(base, Date.now() + COOLDOWN_MS)
  if (preferredPipedBase === base) preferredPipedBase = null
  if (preferredInvidiousBase === base) preferredInvidiousBase = null
}

function markHealthy(base: string, kind: 'piped' | 'invidious'): void {
  instanceCooldownUntil.delete(base)
  if (kind === 'piped') {
    preferredPipedBase = base
  } else {
    preferredInvidiousBase = base
  }
}

/**
 * Non-blocking background refresh of active public Piped & Invidious HTTPS API instances
 * from their official registries so static deployments self-heal as community servers rotate.
 */
function ensureDynamicInstancesLoaded(): Promise<void> {
  if (dynamicDiscoveryPromise) return dynamicDiscoveryPromise
  dynamicDiscoveryPromise = (async () => {
    try {
      const [pipedRes, invRes] = await Promise.allSettled([
        fetch(
          'https://raw.githubusercontent.com/TeamPiped/documentation/refs/heads/main/content/docs/public-instances/index.md',
          { signal: AbortSignal.timeout(4000) },
        ),
        fetch('https://api.invidious.io/instances.json?sort_by=type,users', {
          signal: AbortSignal.timeout(4000),
        }),
      ])

      if (pipedRes.status === 'fulfilled' && pipedRes.value.ok) {
        const md = await pipedRes.value.text()
        const discovered: string[] = []
        const regex = /\|\s*[^|]+\|\s*(https:\/\/[^\s|]+)\s*\|/g
        let match: RegExpExecArray | null
        while ((match = regex.exec(md)) !== null) {
          const norm = normalizeBaseUrl(match[1])
          if (norm && !discovered.includes(norm)) {
            discovered.push(norm)
          }
        }
        if (discovered.length > 0) {
          const merged = new Set([...discovered, ...DEFAULT_PIPED_INSTANCES])
          dynamicPipedInstances = Array.from(merged)
        }
      }

      if (invRes.status === 'fulfilled' && invRes.value.ok) {
        const json = (await invRes.value.json()) as Array<
          [string, { type?: string; api?: boolean; cors?: boolean; uri?: string }]
        >
        if (Array.isArray(json)) {
          const discovered: string[] = []
          for (const entry of json) {
            const meta = entry?.[1]
            if (meta?.type === 'https' && meta.api === true && meta.cors !== false && meta.uri) {
              const norm = normalizeBaseUrl(meta.uri)
              if (norm && !discovered.includes(norm)) {
                discovered.push(norm)
              }
            }
          }
          if (discovered.length > 0) {
            const merged = new Set([...discovered, ...DEFAULT_INVIDIOUS_INSTANCES])
            dynamicInvidiousInstances = Array.from(merged)
          }
        }
      }
    } catch {
      // Static defaults remain active if offline or blocked
    }
  })()
  return dynamicDiscoveryPromise
}

interface ProviderTarget {
  base: string
  kind: 'piped' | 'invidious'
}

function buildOrderedProviderList(): ProviderTarget[] {
  const custom = normalizeBaseUrl(getCustomYouTubeInstance())
  const fresh: ProviderTarget[] = []
  const cooling: ProviderTarget[] = []

  const pushTarget = (base: string, kind: 'piped' | 'invidious') => {
    if (fresh.some((t) => t.base === base) || cooling.some((t) => t.base === base)) return
    if (isCoolingDown(base)) {
      cooling.push({ base, kind })
    } else {
      fresh.push({ base, kind })
    }
  }

  if (custom) {
    const looksInvidious = custom.includes('inv') || custom.includes('yewtu')
    pushTarget(custom, looksInvidious ? 'invidious' : 'piped')
  }
  if (preferredPipedBase) pushTarget(preferredPipedBase, 'piped')
  if (preferredInvidiousBase) pushTarget(preferredInvidiousBase, 'invidious')

  // Interleave Piped and Invidious instances so waves test both architectures concurrently
  const maxLen = Math.max(dynamicPipedInstances.length, dynamicInvidiousInstances.length)
  for (let i = 0; i < maxLen; i++) {
    if (i < dynamicPipedInstances.length) {
      pushTarget(dynamicPipedInstances[i], 'piped')
    }
    if (i < dynamicInvidiousInstances.length) {
      pushTarget(dynamicInvidiousInstances[i], 'invidious')
    }
  }

  return [...fresh, ...cooling.slice(0, 4)]
}

async function fetchJsonStrict<T>(url: string, signal: AbortSignal): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal,
  })
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`)
  }
  const contentType = (res.headers.get('content-type') || '').toLowerCase()
  if (contentType.includes('text/html')) {
    throw new Error('Upstream returned HTML instead of JSON API')
  }
  return (await res.json()) as T
}

async function raceProviderWaves<T>(
  targets: ProviderTarget[],
  waveSize: number,
  runner: (target: ProviderTarget, signal: AbortSignal) => Promise<T>,
): Promise<{ result: T; provider: ProviderTarget }> {
  let lastError: unknown = new Error('No YouTube API instances reachable')

  for (let offset = 0; offset < targets.length; offset += waveSize) {
    const wave = targets.slice(offset, offset + waveSize)
    const controllers = wave.map(() => new AbortController())
    const timers = controllers.map((ctrl) =>
      globalThis.setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS),
    )

    try {
      const winner = await Promise.any(
        wave.map(async (target, idx) => {
          try {
            const result = await runner(target, controllers[idx].signal)
            markHealthy(target.base, target.kind)
            return { result, provider: target, idx }
          } catch (err) {
            if (!controllers[idx].signal.aborted) {
              markFailed(target.base)
            }
            throw err
          }
        }),
      )

      // Cancel slower requests in the winning wave
      controllers.forEach((ctrl, idx) => {
        if (idx !== winner.idx) ctrl.abort()
      })
      return { result: winner.result, provider: winner.provider }
    } catch (aggErr) {
      lastError = aggErr
    } finally {
      timers.forEach((t) => globalThis.clearTimeout(t))
    }
  }

  throw lastError
}

/**
 * Extracts an 11-character YouTube video ID from any standard watch, short, live, embed,
 * or youtu.be URL (or returns null if not a YouTube URL).
 */
export function extractYouTubeVideoId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) {
    return trimmed
  }

  try {
    const parsed = new URL(trimmed)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '').replace(/^m\./, '')

    if (host === 'youtu.be') {
      const seg = parsed.pathname.split('/').filter(Boolean)[0] ?? ''
      return /^[A-Za-z0-9_-]{11}$/.test(seg) ? seg : null
    }

    if (
      host === 'youtube.com' ||
      host === 'music.youtube.com' ||
      host === 'youtube-nocookie.com'
    ) {
      const vParam = parsed.searchParams.get('v')
      if (vParam && /^[A-Za-z0-9_-]{11}$/.test(vParam)) {
        return vParam
      }
      const parts = parsed.pathname.split('/').filter(Boolean)
      if (
        parts.length >= 2 &&
        (parts[0] === 'shorts' ||
          parts[0] === 'embed' ||
          parts[0] === 'live' ||
          parts[0] === 'v')
      ) {
        return /^[A-Za-z0-9_-]{11}$/.test(parts[1]) ? parts[1] : null
      }
    }
  } catch {
    // Check relative Piped URL like "/watch?v=dQw4w9WgXcQ"
    const match = trimmed.match(/[?&]v=([A-Za-z0-9_-]{11})/)
    if (match) return match[1]
  }

  return null
}

export function isYouTubeWatchUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    const host = parsed.hostname.toLowerCase()
    return (
      host === 'youtu.be' ||
      host.endsWith('youtube.com') ||
      host.endsWith('youtube-nocookie.com')
    )
  } catch {
    return false
  }
}

export function toCanonicalYouTubeUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`
}

export interface PeerTubeVideoRef {
  origin: string
  uuid: string
}

export function extractPeerTubeRef(url: string): PeerTubeVideoRef | null {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
    const parts = parsed.pathname.split('/').filter(Boolean)
    // Matches /w/{uuid} or /videos/watch/{uuid} or /videos/embed/{uuid}
    if (parts.length >= 2 && parts[0] === 'w' && parts[1].length >= 8) {
      return { origin: parsed.origin, uuid: parts[1] }
    }
    if (
      parts.length >= 3 &&
      parts[0] === 'videos' &&
      (parts[1] === 'watch' || parts[1] === 'embed') &&
      parts[2].length >= 8
    ) {
      return { origin: parsed.origin, uuid: parts[2] }
    }
  } catch {
    // Not a PeerTube watch URL
  }
  return null
}

function shortProviderHost(base: string): string {
  try {
    return new URL(base).hostname
  } catch {
    return base
  }
}

interface RawPipedStreamItem {
  url?: string
  type?: string
  title?: string
  thumbnail?: string
  uploaderName?: string
  uploader?: string
  duration?: number
  views?: number
  uploadedDate?: string
}

function mapPipedItem(item: RawPipedStreamItem, base: string): YouTubeVideoItem | null {
  if (item.type && item.type !== 'stream') return null
  const videoId = item.url ? extractYouTubeVideoId(item.url) : null
  if (!videoId || !item.title) return null

  const fallbackThumb = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
  let thumb = item.thumbnail?.trim() || fallbackThumb
  if (thumb.startsWith('/')) {
    thumb = `${base}${thumb}`
  }

  return {
    id: `yt:${videoId}`,
    videoId,
    title: item.title,
    author: item.uploaderName || item.uploader || 'YouTube Creator',
    durationSec: typeof item.duration === 'number' && item.duration > 0 ? item.duration : 0,
    views: typeof item.views === 'number' && item.views >= 0 ? item.views : 0,
    uploadedText: item.uploadedDate || '',
    thumbnailUrl: thumb,
    fallbackThumbnailUrl: fallbackThumb,
    playUrl: toCanonicalYouTubeUrl(videoId),
    source: 'youtube',
  }
}

interface RawInvidiousVideoItem {
  type?: string
  videoId?: string
  title?: string
  author?: string
  lengthSeconds?: number
  viewCount?: number
  publishedText?: string
  videoThumbnails?: Array<{ quality?: string; url?: string }>
}

function mapInvidiousItem(
  item: RawInvidiousVideoItem,
  base: string,
): YouTubeVideoItem | null {
  if (item.type && item.type !== 'video' && item.type !== 'shortVideo') return null
  const videoId = item.videoId?.trim()
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId) || !item.title) return null

  const fallbackThumb = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
  const proxiedThumb = `${base}/vi/${videoId}/mqdefault.jpg`
  const rawThumb =
    item.videoThumbnails?.find((t) => t.quality === 'medium')?.url ||
    item.videoThumbnails?.[0]?.url
  let thumb = proxiedThumb
  if (rawThumb) {
    if (rawThumb.startsWith('/')) {
      thumb = `${base}${rawThumb}`
    } else if (!rawThumb.includes('ytimg.com')) {
      thumb = rawThumb
    }
  }

  return {
    id: `yt:${videoId}`,
    videoId,
    title: item.title,
    author: item.author || 'YouTube Creator',
    durationSec:
      typeof item.lengthSeconds === 'number' && item.lengthSeconds > 0
        ? item.lengthSeconds
        : 0,
    views: typeof item.viewCount === 'number' && item.viewCount >= 0 ? item.viewCount : 0,
    uploadedText: item.publishedText || '',
    thumbnailUrl: thumb,
    fallbackThumbnailUrl: fallbackThumb,
    playUrl: toCanonicalYouTubeUrl(videoId),
    source: 'youtube',
  }
}

function rewriteInvidiousProxyUrl(rawUrl: string, invidiousBase: string): string {
  const target = new URL(rawUrl, invidiousBase)
  const base = new URL(invidiousBase)
  target.protocol = base.protocol
  target.host = base.host
  if (!target.searchParams.has('local')) {
    target.searchParams.set('local', 'true')
  }
  return target.toString()
}

export function getCinemaShowcaseVideos(): YouTubeVideoItem[] {
  const extraShowcases: YouTubeVideoItem[] = [
    {
      id: 'cinema:cosmos-laundromat',
      videoId: 'cosmos-laundromat',
      title: 'Cosmos Laundromat — Blender Studio Sci-Fi Short',
      author: 'Blender Open Movie',
      durationSec: 730,
      views: 2_400_000,
      uploadedText: 'Cinema Reference',
      thumbnailUrl:
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/BigBuckBunny.jpg',
      playUrl:
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      source: 'cinema',
    },
    {
      id: 'cinema:for-bigger-escapes',
      videoId: 'for-bigger-escapes',
      title: 'Grand Escape — Cinema Stereo Showcase',
      author: 'Lounge Reference HD',
      durationSec: 15,
      views: 840_000,
      uploadedText: 'Instant HD',
      thumbnailUrl:
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerEscapes.jpg',
      playUrl:
        'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
      source: 'cinema',
    },
  ]

  const presetItems: YouTubeVideoItem[] = SAMPLE_MEDIA_PRESETS.map((preset) => {
    const minsParts = preset.durationHint.split(':').map(Number)
    const durationSec =
      minsParts.length === 2 ? minsParts[0] * 60 + minsParts[1] : 600
    const thumbName = preset.id.includes('sintel')
      ? 'Sintel.jpg'
      : preset.id.includes('elephants')
        ? 'ElephantsDream.jpg'
        : preset.id.includes('cosmos')
          ? 'BigBuckBunny.jpg'
          : 'TearsOfSteel.jpg'

    return {
      id: `cinema:${preset.id}`,
      videoId: preset.id,
      title: preset.title,
      author: preset.subtitle,
      durationSec,
      views: 1_500_000,
      uploadedText: preset.kind.toUpperCase(),
      thumbnailUrl: `https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/${thumbName}`,
      playUrl: preset.url,
      source: 'cinema',
    }
  })

  return [...presetItems, ...extraShowcases]
}

interface RawSepiaSearchResponse {
  data?: Array<{
    uuid?: string
    shortUUID?: string
    name?: string
    url?: string
    duration?: number
    views?: number
    publishedAt?: string
    thumbnailUrl?: string
    previewUrl?: string
    channel?: { displayName?: string; name?: string }
    account?: { displayName?: string; name?: string; host?: string }
  }>
}

/**
 * Searches federated PeerTube instances via SepiaSearch (100% CORS-enabled HLS/MP4 streams
 * with zero YouTube datacenter bot blocks).
 */
export async function searchPeerTubeVideos(query: string): Promise<VideoFeedResult> {
  const cleanQuery = query.trim() || 'cinema short film'
  const apiUrl = `https://sepiasearch.org/api/v1/search/videos?search=${encodeURIComponent(
    cleanQuery,
  )}&count=18&nsfw=false&sort=-match`

  const res = await fetchJsonStrict<RawSepiaSearchResponse>(
    apiUrl,
    AbortSignal.timeout(5500),
  )

  const items: YouTubeVideoItem[] = []
  for (const entry of res.data ?? []) {
    const uuid = entry.shortUUID || entry.uuid
    if (!uuid || !entry.name || !entry.url) continue
    let origin = ''
    try {
      origin = new URL(entry.url).origin
    } catch {
      continue
    }
    const thumb = entry.thumbnailUrl || entry.previewUrl || ''
    items.push({
      id: `pt:${origin}:${uuid}`,
      videoId: uuid,
      title: entry.name,
      author:
        entry.channel?.displayName ||
        entry.account?.displayName ||
        entry.account?.host ||
        'PeerTube Creator',
      durationSec: typeof entry.duration === 'number' ? entry.duration : 0,
      views: typeof entry.views === 'number' ? entry.views : 0,
      uploadedText: entry.account?.host || 'Open Web',
      thumbnailUrl: thumb,
      playUrl: `${origin}/w/${uuid}`,
      source: 'peertube',
    })
  }

  return {
    items,
    provider: 'sepiasearch.org (Open Web)',
  }
}

interface RawPeerTubeVideoDetails {
  name?: string
  duration?: number
  account?: { displayName?: string }
  channel?: { displayName?: string }
  streamingPlaylists?: Array<{
    playlistUrl?: string
    files?: Array<{ fileUrl?: string; fileDownloadUrl?: string; resolution?: { label?: string; id?: number } }>
  }>
  files?: Array<{
    fileUrl?: string
    fileDownloadUrl?: string
    resolution?: { label?: string; id?: number }
  }>
}

export async function resolvePeerTubeStreams(
  ref: PeerTubeVideoRef,
): Promise<ResolvedVideoMedia> {
  const apiUrl = `${ref.origin}/api/v1/videos/${encodeURIComponent(ref.uuid)}`
  const data = await fetchJsonStrict<RawPeerTubeVideoDetails>(
    apiUrl,
    AbortSignal.timeout(5500),
  )

  const candidates: ResolvedStreamCandidate[] = []
  const hostLabel = shortProviderHost(ref.origin)

  for (const playlist of data.streamingPlaylists ?? []) {
    if (playlist.playlistUrl) {
      candidates.push({
        streamUrl: playlist.playlistUrl,
        kind: 'hls',
        qualityLabel: 'Adaptive HLS',
        provider: hostLabel,
      })
    }
    for (const f of playlist.files ?? []) {
      const fUrl = f.fileUrl || f.fileDownloadUrl
      if (fUrl) {
        candidates.push({
          streamUrl: fUrl,
          kind: 'mp4',
          qualityLabel: f.resolution?.label || 'MP4',
          provider: hostLabel,
        })
      }
    }
  }

  const directFiles = [...(data.files ?? [])].sort(
    (a, b) => (b.resolution?.id ?? 0) - (a.resolution?.id ?? 0),
  )
  for (const f of directFiles) {
    const fUrl = f.fileUrl || f.fileDownloadUrl
    if (fUrl) {
      candidates.push({
        streamUrl: fUrl,
        kind: 'mp4',
        qualityLabel: f.resolution?.label || 'Direct MP4',
        provider: hostLabel,
      })
    }
  }

  if (candidates.length === 0) {
    throw new Error(`No playable HLS or MP4 streams returned by ${hostLabel}`)
  }

  return {
    title: data.name,
    author: data.channel?.displayName || data.account?.displayName,
    durationSec: data.duration,
    candidates,
    relatedVideos: [],
  }
}

/**
 * Searches YouTube videos across the healthy Piped + Invidious instance pool.
 * If the query itself is a YouTube video URL or ID, resolves that exact video directly.
 */
export async function searchYouTubeVideos(query: string): Promise<VideoFeedResult> {
  const trimmed = query.trim()
  if (!trimmed) {
    return fetchYouTubeCategory('trending')
  }

  void ensureDynamicInstancesLoaded()

  // Direct YouTube URL / 11-char ID paste handling
  const pastedVideoId = isYouTubeWatchUrl(trimmed)
    ? extractYouTubeVideoId(trimmed)
    : /^[A-Za-z0-9_-]{11}$/.test(trimmed)
      ? trimmed
      : null

  if (pastedVideoId) {
    try {
      const media = await resolveYouTubeStreams(pastedVideoId)
      const directItem: YouTubeVideoItem = {
        id: `yt:${pastedVideoId}`,
        videoId: pastedVideoId,
        title: media.title || `YouTube Video (${pastedVideoId})`,
        author: media.author || 'YouTube',
        durationSec: media.durationSec ?? 0,
        views: 0,
        uploadedText: 'Direct Link',
        thumbnailUrl: `https://i.ytimg.com/vi/${pastedVideoId}/mqdefault.jpg`,
        fallbackThumbnailUrl: `https://i.ytimg.com/vi/${pastedVideoId}/hqdefault.jpg`,
        playUrl: toCanonicalYouTubeUrl(pastedVideoId),
        source: 'youtube',
      }
      return {
        items: [directItem, ...media.relatedVideos],
        provider: media.candidates[0]?.provider ?? 'YouTube Direct',
      }
    } catch {
      // Fall through to keyword search if ID lookup failed
    }
  }

  const targets = buildOrderedProviderList()

  try {
    const { result, provider } = await raceProviderWaves(
      targets,
      4,
      async (target, signal) => {
        if (target.kind === 'piped') {
          const data = await fetchJsonStrict<{ items?: RawPipedStreamItem[] }>(
            `${target.base}/search?q=${encodeURIComponent(trimmed)}&filter=videos`,
            signal,
          )
          const mapped = (data.items ?? [])
            .map((it) => mapPipedItem(it, target.base))
            .filter((x): x is YouTubeVideoItem => x !== null)
          if (mapped.length === 0) throw new Error('Empty Piped search items')
          return mapped
        }

        const data = await fetchJsonStrict<RawInvidiousVideoItem[]>(
          `${target.base}/api/v1/search?q=${encodeURIComponent(trimmed)}&type=video&region=US`,
          signal,
        )
        if (!Array.isArray(data)) throw new Error('Invalid Invidious search payload')
        const mapped = data
          .map((it) => mapInvidiousItem(it, target.base))
          .filter((x): x is YouTubeVideoItem => x !== null)
        if (mapped.length === 0) throw new Error('Empty Invidious search items')
        return mapped
      },
    )

    return {
      items: result.slice(0, 24),
      provider: shortProviderHost(provider.base),
    }
  } catch {
    // Automatic graceful fallback to federated Open Web video search so VR users never hit a dead end
    try {
      const openWeb = await searchPeerTubeVideos(trimmed)
      if (openWeb.items.length > 0) {
        return {
          items: openWeb.items,
          provider: openWeb.provider,
          usedFallback: true,
          notice:
            'Public YouTube relays are busy — showing playable Open Web HD videos for your search.',
        }
      }
    } catch {
      // Ignore secondary fallback failure
    }

    return {
      items: getCinemaShowcaseVideos(),
      provider: 'Cinema Presets',
      usedFallback: true,
      notice:
        'Unable to reach public YouTube relays right now — showing instant Cinema Reference streams.',
    }
  }
}

export async function fetchYouTubeCategory(
  category: YouTubeCategory,
): Promise<VideoFeedResult> {
  if (category === 'cinema') {
    return {
      items: getCinemaShowcaseVideos(),
      provider: 'Built-in HD',
    }
  }

  if (category === 'openweb') {
    try {
      return await searchPeerTubeVideos('animation short film music')
    } catch {
      return {
        items: getCinemaShowcaseVideos(),
        provider: 'Built-in HD',
        usedFallback: true,
      }
    }
  }

  if (category === 'lofi') {
    return searchYouTubeVideos('lofi hip hop chill beats mix')
  }

  if (category === 'movies') {
    return searchYouTubeVideos('official movie trailer 4K')
  }

  if (category === 'music') {
    return searchYouTubeVideos('official music video live session')
  }

  if (category === 'gaming') {
    return searchYouTubeVideos('gaming showcase trailer gameplay')
  }

  void ensureDynamicInstancesLoaded()
  const targets = buildOrderedProviderList()

  try {
    const { result, provider } = await raceProviderWaves(
      targets,
      4,
      async (target, signal) => {
        if (target.kind === 'piped') {
          const data = await fetchJsonStrict<RawPipedStreamItem[]>(
            `${target.base}/trending?region=US`,
            signal,
          )
          if (!Array.isArray(data)) throw new Error('Invalid Piped trending array')
          const mapped = data
            .map((it) => mapPipedItem(it, target.base))
            .filter((x): x is YouTubeVideoItem => x !== null)
          if (mapped.length === 0) throw new Error('Empty Piped trending list')
          return mapped
        }

        const data = await fetchJsonStrict<RawInvidiousVideoItem[]>(
          `${target.base}/api/v1/trending?region=US`,
          signal,
        )
        if (!Array.isArray(data)) throw new Error('Invalid Invidious trending array')
        const mapped = data
          .map((it) => mapInvidiousItem(it, target.base))
          .filter((x): x is YouTubeVideoItem => x !== null)
        if (mapped.length === 0) throw new Error('Empty Invidious trending list')
        return mapped
      },
    )

    return {
      items: result.slice(0, 24),
      provider: shortProviderHost(provider.base),
    }
  } catch {
    return searchYouTubeVideos('trending viral 4K')
  }
}

interface RawPipedStreamsPayload {
  title?: string
  uploader?: string
  duration?: number
  hls?: string
  videoStreams?: Array<{
    url?: string
    format?: string
    quality?: string
    mimeType?: string
    codec?: string
    videoOnly?: boolean
    height?: number
  }>
  audioStreams?: Array<{
    url?: string
    mimeType?: string
    bitrate?: number
  }>
  relatedStreams?: RawPipedStreamItem[]
}

interface RawInvidiousVideoPayload {
  title?: string
  author?: string
  lengthSeconds?: number
  hlsUrl?: string
  formatStreams?: Array<{
    url?: string
    itag?: string
    type?: string
    qualityLabel?: string
  }>
  adaptiveFormats?: Array<{
    url?: string
    type?: string
    qualityLabel?: string
    bitrate?: string
  }>
  recommendedVideos?: RawInvidiousVideoItem[]
}

function extractPipedCandidates(
  data: RawPipedStreamsPayload,
  base: string,
): ResolvedVideoMedia {
  const provider = shortProviderHost(base)
  const candidates: ResolvedStreamCandidate[] = []

  // 1. Proxied adaptive HLS manifest (muxed HD video + stereo audio with CORS *)
  if (typeof data.hls === 'string' && data.hls.startsWith('http')) {
    candidates.push({
      streamUrl: data.hls,
      kind: 'hls',
      qualityLabel: 'Adaptive HD (HLS)',
      provider,
    })
  }

  // 2. Progressive muxed MP4/WebM streams (videoOnly === false)
  const muxed = (data.videoStreams ?? [])
    .filter((s) => s.url && s.videoOnly === false)
    .sort((a, b) => {
      const aMp4 = a.mimeType?.includes('mp4') ? 1000 : 0
      const bMp4 = b.mimeType?.includes('mp4') ? 1000 : 0
      return bMp4 + (b.height ?? 360) - (aMp4 + (a.height ?? 360))
    })

  for (const s of muxed) {
    if (s.url) {
      candidates.push({
        streamUrl: s.url,
        kind: 'mp4',
        qualityLabel: s.quality || 'MP4',
        provider,
      })
    }
  }

  // 3. Adaptive HD H.264 MP4 + synced M4A audio stream
  const bestAudio = (data.audioStreams ?? [])
    .filter((a) => a.url && (a.mimeType?.includes('mp4') || a.mimeType?.includes('m4a')))
    .sort((a, b) => (b.bitrate ?? 0) - (a.bitrate ?? 0))[0]

  if (bestAudio?.url) {
    const hdVideo = (data.videoStreams ?? [])
      .filter(
        (v) =>
          v.url &&
          v.videoOnly === true &&
          v.mimeType?.includes('mp4') &&
          (!v.codec || v.codec.startsWith('avc1')) &&
          (v.height ?? 720) <= 1080,
      )
      .sort((a, b) => {
        // Prefer 720p for smooth 72Hz/90Hz Quest 3 hardware decode, then 1080p
        const score = (h = 0) => (h === 720 ? 2000 : h === 1080 ? 1800 : h)
        return score(b.height) - score(a.height)
      })[0]

    if (hdVideo?.url) {
      candidates.push({
        streamUrl: hdVideo.url,
        audioUrl: bestAudio.url,
        kind: 'mp4',
        qualityLabel: `${hdVideo.quality || '720p'} HD`,
        provider,
      })
    }
  }

  if (candidates.length === 0) {
    throw new Error('Piped returned no playable stream URLs')
  }

  const relatedVideos = (data.relatedStreams ?? [])
    .map((it) => mapPipedItem(it, base))
    .filter((x): x is YouTubeVideoItem => x !== null)
    .slice(0, 12)

  return {
    title: data.title,
    author: data.uploader,
    durationSec: data.duration,
    candidates,
    relatedVideos,
  }
}

function extractInvidiousCandidates(
  videoId: string,
  data: RawInvidiousVideoPayload,
  base: string,
): ResolvedVideoMedia {
  const provider = shortProviderHost(base)
  const candidates: ResolvedStreamCandidate[] = []

  // 1. Proxied HLS manifest when offered
  if (typeof data.hlsUrl === 'string' && data.hlsUrl.length > 0) {
    candidates.push({
      streamUrl: rewriteInvidiousProxyUrl(data.hlsUrl, base),
      kind: 'hls',
      qualityLabel: 'Adaptive HLS',
      provider,
    })
  }

  // 2. Proxied progressive formatStreams (muxed MP4 with audio, local=true for CORS)
  const muxed = (data.formatStreams ?? [])
    .filter((f) => f.url && (!f.type || f.type.includes('mp4')))
    .sort((a, b) => {
      const a720 = a.qualityLabel?.includes('720') ? 1 : 0
      const b720 = b.qualityLabel?.includes('720') ? 1 : 0
      return b720 - a720
    })

  for (const f of muxed) {
    if (f.url) {
      candidates.push({
        streamUrl: rewriteInvidiousProxyUrl(f.url, base),
        kind: 'mp4',
        qualityLabel: f.qualityLabel || 'MP4',
        provider,
      })
    }
  }

  // 3. Direct Invidious /latest_version local=true progressive MP4 endpoint
  candidates.push({
    streamUrl: `${base}/latest_version?id=${encodeURIComponent(videoId)}&itag=18&local=true`,
    kind: 'mp4',
    qualityLabel: '360p Direct',
    provider,
  })

  // 4. Adaptive 720p H.264 + M4A audio (both rewritten onto local=true proxy)
  const bestAudio = (data.adaptiveFormats ?? []).find(
    (a) => a.url && a.type?.includes('audio/mp4'),
  )
  const hdVideo = (data.adaptiveFormats ?? []).find(
    (v) =>
      v.url &&
      v.type?.includes('video/mp4') &&
      v.type?.includes('avc1') &&
      (v.qualityLabel?.includes('720') || v.qualityLabel?.includes('480')),
  )
  if (hdVideo?.url && bestAudio?.url) {
    candidates.push({
      streamUrl: rewriteInvidiousProxyUrl(hdVideo.url, base),
      audioUrl: rewriteInvidiousProxyUrl(bestAudio.url, base),
      kind: 'mp4',
      qualityLabel: `${hdVideo.qualityLabel || '720p'} HD`,
      provider,
    })
  }

  const relatedVideos = (data.recommendedVideos ?? [])
    .map((it) => mapInvidiousItem(it, base))
    .filter((x): x is YouTubeVideoItem => x !== null)
    .slice(0, 12)

  return {
    title: data.title,
    author: data.author,
    durationSec: data.lengthSeconds,
    candidates,
    relatedVideos,
  }
}

/**
 * Resolves a YouTube videoId into an ordered list of CORS-enabled HLS/MP4 stream candidates
 * across multiple healthy Piped & Invidious instances so `<video crossOrigin="anonymous">`
 * + `THREE.VideoTexture` can play and automatically fail over if any single stream URL stalls.
 */
export async function resolveYouTubeStreams(videoId: string): Promise<ResolvedVideoMedia> {
  void ensureDynamicInstancesLoaded()
  const targets = buildOrderedProviderList()

  // First, race for the fastest primary provider response
  const primary = await raceProviderWaves(targets, 4, async (target, signal) => {
    if (target.kind === 'piped') {
      const data = await fetchJsonStrict<RawPipedStreamsPayload>(
        `${target.base}/streams/${encodeURIComponent(videoId)}`,
        signal,
      )
      return extractPipedCandidates(data, target.base)
    }

    const data = await fetchJsonStrict<RawInvidiousVideoPayload>(
      `${target.base}/api/v1/videos/${encodeURIComponent(videoId)}?local=true`,
      signal,
    )
    return extractInvidiousCandidates(videoId, data, target.base)
  })

  // Also grab one backup provider from a different host (best-effort, max 1.8s) so if the
  // primary proxy's media CDN returns 403 mid-stream, useMediaScreen immediately fails over!
  const remainingTargets = targets
    .filter((t) => t.base !== primary.provider.base && !isCoolingDown(t.base))
    .slice(0, 3)

  let backupCandidates: ResolvedStreamCandidate[] = []
  if (remainingTargets.length > 0) {
    try {
      const backup = await Promise.race([
        raceProviderWaves(remainingTargets, 3, async (target, signal) => {
          if (target.kind === 'piped') {
            const data = await fetchJsonStrict<RawPipedStreamsPayload>(
              `${target.base}/streams/${encodeURIComponent(videoId)}`,
              signal,
            )
            return extractPipedCandidates(data, target.base)
          }
          const data = await fetchJsonStrict<RawInvidiousVideoPayload>(
            `${target.base}/api/v1/videos/${encodeURIComponent(videoId)}?local=true`,
            signal,
          )
          return extractInvidiousCandidates(videoId, data, target.base)
        }),
        new Promise<null>((resolve) => globalThis.setTimeout(() => resolve(null), 1600)),
      ])
      if (backup) {
        backupCandidates = backup.result.candidates
      }
    } catch {
      // Primary candidates are already ready
    }
  }

  return {
    ...primary.result,
    candidates: [...primary.result.candidates, ...backupCandidates],
  }
}

export function formatCompactViews(views: number): string {
  if (!Number.isFinite(views) || views <= 0) return ''
  if (views >= 1_000_000) return `${(views / 1_000_000).toFixed(1)}M views`
  if (views >= 1_000) return `${Math.round(views / 1_000)}K views`
  return `${views} views`
}

export function formatVideoDurationBadge(durationSec: number): string {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return 'LIVE'
  const total = Math.floor(durationSec)
  const hrs = Math.floor(total / 3600)
  const mins = Math.floor((total % 3600) / 60)
  const secs = total % 60
  if (hrs > 0) {
    return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`
}
