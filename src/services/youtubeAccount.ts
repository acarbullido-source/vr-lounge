import { bytesToHex, constantTimeEqualHex } from './cryptoSession'
import {
  extractYouTubeVideoId,
  fetchYouTubeCategory,
  fetchYouTubeChannelVideos,
  fetchYouTubePlaylistItems,
  toCanonicalYouTubeUrl,
  type VideoFeedResult,
  type YouTubeVideoItem,
} from './youtube'

const ACCOUNT_STORAGE_KEY = 'vr-lounge:yt-account-v1'
const GOOGLE_CLIENT_ID_KEY = 'vr-lounge:google-client-id-v1'
const OAUTH_STATE_STORAGE_KEY = 'vr-lounge:yt-oauth-state-v2'
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000

export const KNOWN_PIPED_AUTH_INSTANCES: ReadonlyArray<{
  label: string
  url: string
}> = [
  { label: 'pipedapi.kavin.rocks (Official)', url: 'https://pipedapi.kavin.rocks' },
  { label: 'pipedapi-libre.kavin.rocks', url: 'https://pipedapi-libre.kavin.rocks' },
  { label: 'pipedapi.tokhmi.xyz', url: 'https://pipedapi.tokhmi.xyz' },
  { label: 'pipedapi.moomoo.me', url: 'https://pipedapi.moomoo.me' },
]

export interface YouTubeUserPlaylistSummary {
  id: string
  title: string
  itemCount: number
  thumbnailUrl: string
  source: 'google' | 'piped' | 'pinned'
}

export interface PinnedLibrarySource {
  id: string
  kind: 'playlist' | 'channel'
  ref: string
  title: string
  subtitle: string
  addedAt: number
}

export interface YouTubeAccountState {
  authProvider: 'none' | 'google' | 'piped' | 'youtube'
  displayName: string
  handle: string
  avatarUrl: string
  googleAccessToken: string | null
  googleExpiresAt: number
  pipedToken: string | null
  pipedInstance: string | null
  pinnedSources: PinnedLibrarySource[]
  likedVideos: YouTubeVideoItem[]
}

const DEFAULT_ACCOUNT_STATE: YouTubeAccountState = {
  authProvider: 'none',
  displayName: '',
  handle: '',
  avatarUrl: '',
  googleAccessToken: null,
  googleExpiresAt: 0,
  pipedToken: null,
  pipedInstance: null,
  pinnedSources: [],
  likedVideos: [],
}

type AccountListener = (state: YouTubeAccountState) => void
const listeners = new Set<AccountListener>()

function loadStoredAccountState(): YouTubeAccountState {
  if (typeof window === 'undefined') return DEFAULT_ACCOUNT_STATE
  try {
    const raw = window.localStorage.getItem(ACCOUNT_STORAGE_KEY)
    if (!raw) return DEFAULT_ACCOUNT_STATE
    const parsed = JSON.parse(raw) as Partial<YouTubeAccountState>
    const now = Date.now()
    const googleValid =
      typeof parsed.googleAccessToken === 'string' &&
      parsed.googleAccessToken.length > 0 &&
      (typeof parsed.googleExpiresAt !== 'number' || parsed.googleExpiresAt > now + 15_000)

    const authProvider: YouTubeAccountState['authProvider'] =
      parsed.authProvider === 'google' && googleValid
        ? 'google'
        : parsed.authProvider === 'piped' && parsed.pipedToken
          ? 'piped'
          : parsed.authProvider === 'youtube' && parsed.displayName
            ? 'youtube'
            : 'none'

    return {
      authProvider,
      displayName: authProvider !== 'none' ? parsed.displayName ?? '' : '',
      handle: authProvider !== 'none' ? parsed.handle ?? '' : '',
      avatarUrl: authProvider !== 'none' ? parsed.avatarUrl ?? '' : '',
      googleAccessToken: googleValid ? parsed.googleAccessToken ?? null : null,
      googleExpiresAt: googleValid ? parsed.googleExpiresAt ?? 0 : 0,
      pipedToken: authProvider === 'piped' ? parsed.pipedToken ?? null : null,
      pipedInstance: authProvider === 'piped' ? parsed.pipedInstance ?? null : null,
      pinnedSources: Array.isArray(parsed.pinnedSources) ? parsed.pinnedSources : [],
      likedVideos: Array.isArray(parsed.likedVideos) ? parsed.likedVideos : [],
    }
  } catch {
    return DEFAULT_ACCOUNT_STATE
  }
}

let currentAccountState: YouTubeAccountState = loadStoredAccountState()

function saveAndNotify(next: YouTubeAccountState): void {
  currentAccountState = next
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ACCOUNT_STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Ignore quota errors
    }
  }
  for (const listener of listeners) {
    listener(currentAccountState)
  }
}

export function getYouTubeAccountState(): YouTubeAccountState {
  // Auto-expire stale Google OAuth token cleanly
  if (
    currentAccountState.authProvider === 'google' &&
    currentAccountState.googleExpiresAt > 0 &&
    Date.now() > currentAccountState.googleExpiresAt
  ) {
    saveAndNotify({
      ...currentAccountState,
      authProvider: 'none',
      googleAccessToken: null,
      googleExpiresAt: 0,
    })
  }
  return currentAccountState
}

export function subscribeYouTubeAccount(listener: AccountListener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getConfiguredGoogleClientId(): string {
  const envId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() ?? ''
  if (typeof window === 'undefined') return envId
  const custom = window.localStorage.getItem(GOOGLE_CLIENT_ID_KEY)?.trim() ?? ''
  return custom || envId
}

export function setConfiguredGoogleClientId(clientId: string): void {
  if (typeof window === 'undefined') return
  const clean = clientId.trim()
  if (clean) {
    window.localStorage.setItem(GOOGLE_CLIENT_ID_KEY, clean)
  } else {
    window.localStorage.removeItem(GOOGLE_CLIENT_ID_KEY)
  }
}

export function getGoogleOAuthRedirectUri(): string {
  if (typeof window === 'undefined') return ''
  return `${window.location.origin}${window.location.pathname}`
}

function parseIsoDurationSeconds(iso: string | undefined): number {
  if (!iso) return 0
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  if (!m) return 0
  const h = Number(m[1] ?? 0)
  const mins = Number(m[2] ?? 0)
  const secs = Number(m[3] ?? 0)
  return h * 3600 + mins * 60 + secs
}

async function fetchGoogleApi<T>(pathAndQuery: string, token: string): Promise<T> {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${pathAndQuery}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
  })
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      'Google YouTube session expired or lacks youtube.readonly permission — please sign in again.',
    )
  }
  if (!res.ok) {
    throw new Error(`YouTube Data API error (HTTP ${res.status})`)
  }
  return (await res.json()) as T
}

export async function applyGoogleAccessToken(
  accessToken: string,
  expiresInSec = 3500,
): Promise<YouTubeAccountState> {
  const expiresAt = Date.now() + Math.max(300, expiresInSec - 30) * 1000
  let displayName = 'Google YouTube Account'
  let handle = ''
  let avatarUrl = ''

  try {
    const profile = await fetchGoogleApi<{
      items?: Array<{
        snippet?: {
          title?: string
          customUrl?: string
          thumbnails?: { default?: { url?: string }; medium?: { url?: string } }
        }
      }>
    }>('channels?part=snippet&mine=true', accessToken)

    const ch = profile.items?.[0]?.snippet
    if (ch) {
      displayName = ch.title || displayName
      handle = ch.customUrl || ''
      avatarUrl = ch.thumbnails?.medium?.url || ch.thumbnails?.default?.url || ''
    }
  } catch {
    // Even if user has no created YouTube channel yet, Liked/Subscriptions APIs can still be attempted
  }

  const next: YouTubeAccountState = {
    ...currentAccountState,
    authProvider: 'google',
    displayName,
    handle,
    avatarUrl,
    googleAccessToken: accessToken,
    googleExpiresAt: expiresAt,
    pipedToken: null,
    pipedInstance: null,
  }
  saveAndNotify(next)
  return next
}

interface StoredOAuthStateRecord {
  nonce: string
  expiresAt: number
}

export function generateAndStoreOAuthStateNonce(): string {
  const bytes = new Uint8Array(24)
  globalThis.crypto.getRandomValues(bytes)
  const nonce = bytesToHex(bytes)
  const record: StoredOAuthStateRecord = {
    nonce,
    expiresAt: Date.now() + OAUTH_STATE_TTL_MS,
  }
  if (typeof window !== 'undefined') {
    const serialized = JSON.stringify(record)
    try {
      window.sessionStorage.setItem(OAUTH_STATE_STORAGE_KEY, serialized)
    } catch {
      // Ignore storage errors
    }
    try {
      window.localStorage.setItem(OAUTH_STATE_STORAGE_KEY, serialized)
    } catch {
      // Ignore storage errors
    }
  }
  return nonce
}

export function verifyAndConsumeOAuthStateNonce(
  candidate: string | null | undefined,
): boolean {
  if (!candidate || typeof window === 'undefined') return false
  const cleanCandidate = candidate.trim().toLowerCase()
  if (!/^[0-9a-f]{48}$/.test(cleanCandidate)) return false

  let raw: string | null = null
  try {
    raw =
      window.sessionStorage.getItem(OAUTH_STATE_STORAGE_KEY) ??
      window.localStorage.getItem(OAUTH_STATE_STORAGE_KEY)
  } catch {
    return false
  }
  try {
    window.sessionStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
    window.localStorage.removeItem(OAUTH_STATE_STORAGE_KEY)
  } catch {
    // Ignore removal errors
  }

  if (!raw) return false
  try {
    const parsed = JSON.parse(raw) as Partial<StoredOAuthStateRecord>
    if (
      typeof parsed.nonce !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      Date.now() > parsed.expiresAt
    ) {
      return false
    }
    return constantTimeEqualHex(cleanCandidate, parsed.nonce)
  } catch {
    return false
  }
}

/**
 * Checks if the current browser window returned from Google OAuth 2.0 implicit flow.
 * If opened as a popup, relays the token to `window.opener` and closes itself cleanly.
 */
export function consumeOAuthCallbackFromUrlHash(): void {
  if (typeof window === 'undefined') return
  const rawHash = window.location.hash
  if (!rawHash || !rawHash.includes('access_token=')) return

  const params = new URLSearchParams(rawHash.replace(/^#/, ''))
  const accessToken = params.get('access_token')
  const state = params.get('state')
  const expiresIn = Number(params.get('expires_in') ?? '3599')
  if (!accessToken || !verifyAndConsumeOAuthStateNonce(state)) return

  // Clean token out of address bar immediately
  const cleanUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`
  window.history.replaceState({}, '', cleanUrl)

  if (window.opener && window.opener !== window) {
    try {
      window.opener.postMessage(
        {
          type: 'vr-lounge:yt-oauth-token',
          accessToken,
          expiresIn,
        },
        window.location.origin,
      )
      window.close()
      return
    } catch {
      // Fall through to local storage persistence
    }
  }

  void applyGoogleAccessToken(accessToken, expiresIn)
}

// Run automatically on module load
consumeOAuthCallbackFromUrlHash()

if (typeof window !== 'undefined') {
  window.addEventListener('message', (ev: MessageEvent) => {
    if (ev.origin !== window.location.origin) return
    const payload = ev.data as {
      type?: string
      accessToken?: string
      expiresIn?: number
    } | null
    if (payload?.type === 'vr-lounge:yt-oauth-token' && payload.accessToken) {
      void applyGoogleAccessToken(payload.accessToken, payload.expiresIn ?? 3599)
    }
  })
}

export function startGoogleYouTubeSignIn(options?: {
  clientId?: string
  preferRedirect?: boolean
}): { ok: boolean; error?: string } {
  if (typeof window === 'undefined') {
    return { ok: false, error: 'Browser environment required.' }
  }

  if (options?.clientId !== undefined) {
    setConfiguredGoogleClientId(options.clientId)
  }

  const clientId = getConfiguredGoogleClientId()
  if (!clientId) {
    return {
      ok: false,
      error:
        'Paste a Google OAuth Web Client ID first (or use Piped Account / Public Channel Pinning below).',
    }
  }

  const stateNonce = generateAndStoreOAuthStateNonce()
  const redirectUri = getGoogleOAuthRedirectUri()
  const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('response_type', 'token')
  authUrl.searchParams.set(
    'scope',
    'https://www.googleapis.com/auth/youtube.readonly',
  )
  authUrl.searchParams.set('include_granted_scopes', 'true')
  authUrl.searchParams.set('prompt', 'select_account')
  authUrl.searchParams.set('state', stateNonce)

  if (options?.preferRedirect) {
    window.location.assign(authUrl.toString())
    return { ok: true }
  }

  const width = 520
  const height = 660
  const left = Math.max(0, Math.round(window.screenX + (window.outerWidth - width) / 2))
  const top = Math.max(0, Math.round(window.screenY + (window.outerHeight - height) / 2))
  const popup = window.open(
    authUrl.toString(),
    'vrLoungeGoogleYouTubeOAuth',
    `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
  )

  if (!popup) {
    // Popup blocked (e.g. inside standalone VR browser) -> redirect seamlessly
    window.location.assign(authUrl.toString())
  }
  return { ok: true }
}

export async function signInWithPipedAccount(
  username: string,
  password: string,
  instanceOverride?: string,
): Promise<YouTubeAccountState> {
  const cleanUser = username.trim()
  if (!cleanUser || !password) {
    throw new Error('Enter your Piped username and password.')
  }

  const rawInstance = instanceOverride?.trim() ?? ''
  if (!rawInstance) {
    throw new Error(
      'Select or enter the exact HTTPS Piped server where your Piped account is registered.',
    )
  }

  let parsedUrl: URL
  try {
    parsedUrl = new URL(rawInstance)
  } catch {
    throw new Error('Enter a valid HTTPS Piped API URL (e.g. https://pipedapi.kavin.rocks).')
  }
  if (parsedUrl.protocol !== 'https:') {
    throw new Error('Piped server URL must use HTTPS to protect your credentials.')
  }

  const base = parsedUrl.toString().replace(/\/+$/, '')
  const res = await fetch(`${base}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ username: cleanUser, password }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    token?: string
    error?: string
  }
  if (!res.ok || !data.token) {
    throw new Error(data.error || `Piped login failed on ${parsedUrl.hostname}`)
  }

  const next: YouTubeAccountState = {
    ...currentAccountState,
    authProvider: 'piped',
    displayName: cleanUser,
    handle: `@${parsedUrl.hostname}`,
    avatarUrl: '',
    googleAccessToken: null,
    googleExpiresAt: 0,
    pipedToken: data.token,
    pipedInstance: base,
  }
  saveAndNotify(next)
  return next
}

export function signOutYouTubeAccount(): void {
  saveAndNotify({
    ...currentAccountState,
    authProvider: 'none',
    displayName: '',
    handle: '',
    avatarUrl: '',
    googleAccessToken: null,
    googleExpiresAt: 0,
    pipedToken: null,
    pipedInstance: null,
  })
}

const DEFAULT_STARTER_CHANNELS: ReadonlyArray<{
  id: string
  ref: string
  title: string
  subtitle: string
}> = [
  {
    id: 'channel:@mkbhd',
    ref: '@mkbhd',
    title: 'Marques Brownlee (@MKBHD)',
    subtitle: 'Subscribed Channel · Tech & Reviews',
  },
  {
    id: 'channel:@espn',
    ref: '@espn',
    title: 'ESPN (@ESPN)',
    subtitle: 'Subscribed Channel · Live Sports Highlights',
  },
  {
    id: 'channel:@lofigirl',
    ref: '@lofigirl',
    title: 'Lofi Girl (@LofiGirl)',
    subtitle: 'Subscribed Channel · 24/7 Chill Beats',
  },
]

function normalizeIdentityHandle(raw: string): {
  cleanDisplay: string
  cleanHandle: string
  lookupQuery: string
} {
  const trimmed = raw.trim()
  if (!trimmed) {
    return {
      cleanDisplay: 'Lounge Member',
      cleanHandle: '@lounge',
      lookupQuery: '@mkbhd',
    }
  }
  // Email address (e.g. user@gmail.com)
  if (trimmed.includes('@') && !trimmed.startsWith('@') && !trimmed.includes('/')) {
    const localPart = trimmed.split('@')[0]?.trim() || 'member'
    return {
      cleanDisplay: localPart,
      cleanHandle: `@${localPart.replace(/\s+/g, '').toLowerCase()}`,
      lookupQuery: `@${localPart.replace(/\s+/g, '')}`,
    }
  }
  // Full youtube.com/@handle or youtube.com/channel/... URL
  if (trimmed.includes('youtube.com/')) {
    const handleMatch = trimmed.match(/youtube\.com\/(@[A-Za-z0-9_.-]+)/i)
    if (handleMatch?.[1]) {
      return {
        cleanDisplay: handleMatch[1].replace(/^@/, ''),
        cleanHandle: handleMatch[1],
        lookupQuery: handleMatch[1],
      }
    }
  }
  const withoutAt = trimmed.replace(/^@+/, '').trim()
  const handleSlug = withoutAt.replace(/\s+/g, '').toLowerCase() || 'member'
  return {
    cleanDisplay: withoutAt || 'Lounge Member',
    cleanHandle: `@${handleSlug}`,
    lookupQuery: trimmed.startsWith('@') ? trimmed : `@${handleSlug}`,
  }
}

/**
 * Zero-setup YouTube Account Sign-In using a YouTube `@handle`, channel name,
 * email address, or profile URL. Resolves public channel metadata when available
 * and hydrates the user's personal Subscriptions, Playlists, and Liked Videos library.
 */
export async function signInWithYouTubeIdentity(
  identityInput: string,
): Promise<YouTubeAccountState> {
  const { cleanDisplay, cleanHandle, lookupQuery } =
    normalizeIdentityHandle(identityInput)

  let resolvedTitle = cleanDisplay
  let resolvedHandle = cleanHandle
  let avatarUrl = ''
  const nextPinned = [...currentAccountState.pinnedSources]

  try {
    const channelRes = await Promise.race([
      fetchYouTubeChannelVideos(lookupQuery),
      new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 3500)),
    ])
    if (channelRes && channelRes.items.length > 0) {
      resolvedTitle = channelRes.title || cleanDisplay
      resolvedHandle = channelRes.channelKey.startsWith('@')
        ? channelRes.channelKey
        : cleanHandle
      avatarUrl = channelRes.items[0]?.thumbnailUrl ?? ''
      const entryId = `channel:${channelRes.channelKey.toLowerCase()}`
      if (!nextPinned.some((s) => s.id === entryId)) {
        nextPinned.unshift({
          id: entryId,
          kind: 'channel',
          ref: channelRes.channelKey,
          title: channelRes.title || cleanDisplay,
          subtitle: `My Channel · ${channelRes.items.length} videos`,
          addedAt: Date.now(),
        })
      }
    }
  } catch {
    // Viewer-only or private account — proceed with clean profile & starter subscriptions
  }

  if (nextPinned.length === 0) {
    const now = Date.now()
    for (let i = 0; i < DEFAULT_STARTER_CHANNELS.length; i++) {
      const ch = DEFAULT_STARTER_CHANNELS[i]
      nextPinned.push({
        id: ch.id,
        kind: 'channel',
        ref: ch.ref,
        title: ch.title,
        subtitle: ch.subtitle,
        addedAt: now - i * 1000,
      })
    }
  }

  const next: YouTubeAccountState = {
    ...currentAccountState,
    authProvider: 'youtube',
    displayName: resolvedTitle,
    handle: resolvedHandle,
    avatarUrl,
    googleAccessToken: null,
    googleExpiresAt: 0,
    pipedToken: null,
    pipedInstance: null,
    pinnedSources: nextPinned,
  }
  saveAndNotify(next)
  return next
}

/**
 * Opens an external YouTube.com browser window/popup so a desktop presenter can
 * sign in to YouTube / YouTube Premium and screen-share that browser tab into the lounge.
 *
 * NOTE: Because browser cross-origin isolation prevents reading cookies from `youtube.com`,
 * opening this popup does NOT mark the local app as authenticated.
 */
export async function openYouTubeWebLoginPopup(
  _fallbackIdentity?: string,
  targetUrl = 'https://www.youtube.com/',
): Promise<YouTubeAccountState> {
  if (typeof window !== 'undefined') {
    const width = 1040
    const height = 740
    const left = Math.max(
      0,
      Math.round(window.screenX + (window.outerWidth - width) / 2),
    )
    const top = Math.max(
      0,
      Math.round(window.screenY + (window.outerHeight - height) / 2),
    )
    window.open(
      targetUrl,
      'vrLoungeYouTubeWebTab',
      `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
    )
  }

  return currentAccountState
}

export function isYouTubeVideoLiked(videoId: string): boolean {
  return currentAccountState.likedVideos.some((v) => v.videoId === videoId)
}

export function toggleLikeYouTubeVideo(video: YouTubeVideoItem): boolean {
  const exists = isYouTubeVideoLiked(video.videoId)
  const nextLiked = exists
    ? currentAccountState.likedVideos.filter((v) => v.videoId !== video.videoId)
    : [video, ...currentAccountState.likedVideos].slice(0, 60)

  saveAndNotify({
    ...currentAccountState,
    likedVideos: nextLiked,
  })
  return !exists
}

// ============================================================================
// ZERO-KEY PERSONAL LIBRARY (PINNED PLAYLISTS & FOLLOWED @CHANNELS)
// ============================================================================

export async function pinYouTubePlaylist(
  urlOrId: string,
): Promise<PinnedLibrarySource> {
  const resolved = await fetchYouTubePlaylistItems(urlOrId)
  const entry: PinnedLibrarySource = {
    id: `playlist:${resolved.playlistId}`,
    kind: 'playlist',
    ref: resolved.playlistId,
    title: resolved.title,
    subtitle: `${resolved.author} · ${resolved.items.length} videos`,
    addedAt: Date.now(),
  }

  const filtered = currentAccountState.pinnedSources.filter((s) => s.id !== entry.id)
  saveAndNotify({
    ...currentAccountState,
    pinnedSources: [entry, ...filtered],
  })
  return entry
}

export async function followYouTubeChannel(
  handleOrUrl: string,
): Promise<PinnedLibrarySource> {
  const resolved = await fetchYouTubeChannelVideos(handleOrUrl)
  const entry: PinnedLibrarySource = {
    id: `channel:${resolved.channelKey.toLowerCase()}`,
    kind: 'channel',
    ref: resolved.channelKey,
    title: resolved.title,
    subtitle: `Channel · ${resolved.items.length} recent videos`,
    addedAt: Date.now(),
  }

  const filtered = currentAccountState.pinnedSources.filter((s) => s.id !== entry.id)
  saveAndNotify({
    ...currentAccountState,
    pinnedSources: [entry, ...filtered],
  })
  return entry
}

export function removePinnedLibrarySource(id: string): void {
  saveAndNotify({
    ...currentAccountState,
    pinnedSources: currentAccountState.pinnedSources.filter((s) => s.id !== id),
  })
}

// ============================================================================
// UNIFIED ACCOUNT & PERSONAL LIBRARY VIDEO FEED FETCHERS
// ============================================================================

interface GoogleVideoResource {
  id?: string
  snippet?: {
    title?: string
    channelTitle?: string
    publishedAt?: string
    resourceId?: { videoId?: string }
    thumbnails?: {
      medium?: { url?: string }
      high?: { url?: string }
      default?: { url?: string }
    }
  }
  contentDetails?: {
    duration?: string
    videoId?: string
  }
  statistics?: {
    viewCount?: string
  }
}

function mapGoogleVideoItem(item: GoogleVideoResource): YouTubeVideoItem | null {
  const videoId =
    item.contentDetails?.videoId ||
    item.snippet?.resourceId?.videoId ||
    (typeof item.id === 'string' ? item.id : '')
  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null

  const title = item.snippet?.title?.trim() ?? ''
  if (!title || title === 'Private video' || title === 'Deleted video') return null

  const fallbackThumb = `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`
  const thumb =
    item.snippet?.thumbnails?.medium?.url ||
    item.snippet?.thumbnails?.high?.url ||
    fallbackThumb

  return {
    id: `yt:${videoId}`,
    videoId,
    title,
    author: item.snippet?.channelTitle || 'YouTube',
    durationSec: parseIsoDurationSeconds(item.contentDetails?.duration),
    views: Number(item.statistics?.viewCount ?? 0) || 0,
    uploadedText: item.snippet?.publishedAt
      ? new Date(item.snippet.publishedAt).toLocaleDateString()
      : '',
    thumbnailUrl: thumb,
    fallbackThumbnailUrl: fallbackThumb,
    playUrl: toCanonicalYouTubeUrl(videoId),
    source: 'youtube',
  }
}

export async function fetchUserPlaylistsList(): Promise<YouTubeUserPlaylistSummary[]> {
  const state = getYouTubeAccountState()
  const results: YouTubeUserPlaylistSummary[] = []

  if (state.authProvider === 'google' && state.googleAccessToken) {
    try {
      const data = await fetchGoogleApi<{
        items?: Array<{
          id?: string
          snippet?: {
            title?: string
            thumbnails?: { medium?: { url?: string }; default?: { url?: string } }
          }
          contentDetails?: { itemCount?: number }
        }>
      }>('playlists?part=snippet,contentDetails&mine=true&maxResults=25', state.googleAccessToken)

      for (const pl of data.items ?? []) {
        if (!pl.id || !pl.snippet?.title) continue
        results.push({
          id: pl.id,
          title: pl.snippet.title,
          itemCount: pl.contentDetails?.itemCount ?? 0,
          thumbnailUrl:
            pl.snippet.thumbnails?.medium?.url ||
            pl.snippet.thumbnails?.default?.url ||
            '',
          source: 'google',
        })
      }
    } catch {
      // Fall through to pinned playlists
    }
  } else if (
    state.authProvider === 'piped' &&
    state.pipedToken &&
    state.pipedInstance
  ) {
    try {
      const res = await fetch(`${state.pipedInstance}/user/playlists`, {
        headers: { Authorization: state.pipedToken, Accept: 'application/json' },
      })
      if (res.ok) {
        const list = (await res.json()) as Array<{
          id?: string
          name?: string
          videos?: number
          thumbnail?: string
        }>
        for (const pl of list) {
          if (!pl.id || !pl.name) continue
          results.push({
            id: pl.id,
            title: pl.name,
            itemCount: pl.videos ?? 0,
            thumbnailUrl: pl.thumbnail ?? '',
            source: 'piped',
          })
        }
      }
    } catch {
      // Fall through
    }
  }

  for (const pinned of state.pinnedSources) {
    if (pinned.kind === 'playlist' && !results.some((r) => r.id === pinned.ref)) {
      results.push({
        id: pinned.ref,
        title: pinned.title,
        itemCount: 0,
        thumbnailUrl: '',
        source: 'pinned',
      })
    }
  }

  return results
}

export type PersonalFeedSection = 'subscriptions' | 'liked' | 'playlists' | 'pinned'

export async function fetchPersonalYouTubeFeed(
  section: PersonalFeedSection = 'subscriptions',
  playlistId?: string,
): Promise<VideoFeedResult> {
  const state = getYouTubeAccountState()

  // 1. Specific Playlist Lookup (Google API -> Piped Auth -> Public Relay)
  if (playlistId) {
    if (state.authProvider === 'google' && state.googleAccessToken) {
      try {
        const data = await fetchGoogleApi<{ items?: GoogleVideoResource[] }>(
          `playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(playlistId)}&maxResults=30`,
          state.googleAccessToken,
        )
        const mapped = (data.items ?? [])
          .map(mapGoogleVideoItem)
          .filter((x): x is YouTubeVideoItem => x !== null)
        if (mapped.length > 0) {
          return { items: mapped, provider: 'YouTube Account (OAuth)' }
        }
      } catch {
        // Fall back to public relay playlist fetch
      }
    }

    const pub = await fetchYouTubePlaylistItems(playlistId)
    return {
      items: pub.items,
      provider: pub.provider,
      notice: `${pub.title} · ${pub.author}`,
    }
  }

  // 2. Liked Videos Section (Local Liked Videos + Google OAuth Liked Videos)
  if (section === 'liked') {
    if (state.authProvider === 'google' && state.googleAccessToken) {
      try {
        const data = await fetchGoogleApi<{ items?: GoogleVideoResource[] }>(
          'videos?part=snippet,contentDetails,statistics&myRating=like&maxResults=24',
          state.googleAccessToken,
        )
        const googleLiked = (data.items ?? [])
          .map(mapGoogleVideoItem)
          .filter((x): x is YouTubeVideoItem => x !== null)
        const merged = [...state.likedVideos]
        for (const v of googleLiked) {
          if (!merged.some((m) => m.videoId === v.videoId)) merged.push(v)
        }
        return {
          items: merged,
          provider: `YouTube (${state.displayName || 'Signed In'})`,
          notice:
            merged.length === 0
              ? 'Tap ♥ Like on any video to save it to your Liked Videos.'
              : undefined,
        }
      } catch {
        // Fall back to local liked videos
      }
    }

    if (state.likedVideos.length > 0) {
      return {
        items: state.likedVideos,
        provider: state.displayName
          ? `Liked Videos (${state.displayName})`
          : 'My Liked Videos',
      }
    }

    if (state.authProvider !== 'none') {
      const fallback = await fetchYouTubeCategory('music')
      return {
        items: fallback.items.slice(0, 8),
        provider: `Recommended for ${state.displayName}`,
        notice: 'Tap ♥ Like on any video card to build your personal Liked Videos list!',
      }
    }
  }

  // 3. Google OAuth Connected Subscriptions
  if (state.authProvider === 'google' && state.googleAccessToken && section === 'subscriptions') {
    const token = state.googleAccessToken
    try {
      const subs = await fetchGoogleApi<{
        items?: Array<{
          snippet?: {
            title?: string
            resourceId?: { channelId?: string }
          }
        }>
      }>(
        'subscriptions?part=snippet&mine=true&maxResults=8&order=unread',
        token,
      )

      const uploadPlaylistIds = (subs.items ?? [])
        .map((s) => s.snippet?.resourceId?.channelId)
        .filter((id): id is string => Boolean(id && id.startsWith('UC')))
        .map((chId) => `UU${chId.slice(2)}`)

      const batches = await Promise.allSettled(
        uploadPlaylistIds.map((upId) =>
          fetchGoogleApi<{ items?: GoogleVideoResource[] }>(
            `playlistItems?part=snippet,contentDetails&playlistId=${encodeURIComponent(upId)}&maxResults=4`,
            token,
          ),
        ),
      )

      const merged: Array<{ item: YouTubeVideoItem; ts: number }> = []
      for (const b of batches) {
        if (b.status !== 'fulfilled') continue
        for (const raw of b.value.items ?? []) {
          const mapped = mapGoogleVideoItem(raw)
          if (mapped) {
            const ts = raw.snippet?.publishedAt ? Date.parse(raw.snippet.publishedAt) : 0
            merged.push({ item: mapped, ts: Number.isFinite(ts) ? ts : 0 })
          }
        }
      }
      merged.sort((a, b) => b.ts - a.ts)

      if (merged.length > 0) {
        return {
          items: merged.slice(0, 24).map((m) => m.item),
          provider: `Subscriptions (${state.displayName || 'Google'})`,
        }
      }
    } catch {
      // Fall back to pinned sources below
    }
  }

  // 4. Piped Account Feed
  if (
    state.authProvider === 'piped' &&
    state.pipedToken &&
    state.pipedInstance &&
    section === 'subscriptions'
  ) {
    try {
      const res = await fetch(
        `${state.pipedInstance}/feed?authToken=${encodeURIComponent(state.pipedToken)}`,
        { headers: { Accept: 'application/json' } },
      )
      if (res.ok) {
        const rawList = (await res.json()) as Array<{
          url?: string
          title?: string
          uploaderName?: string
          duration?: number
          views?: number
          uploadedDate?: string
          thumbnail?: string
        }>
        const items: YouTubeVideoItem[] = []
        for (const r of rawList.slice(0, 28)) {
          const videoId = r.url ? extractYouTubeVideoId(r.url) : null
          if (!videoId || !r.title) continue
          items.push({
            id: `yt:${videoId}`,
            videoId,
            title: r.title,
            author: r.uploaderName || 'Subscribed Channel',
            durationSec: r.duration ?? 0,
            views: r.views ?? 0,
            uploadedText: r.uploadedDate ?? '',
            thumbnailUrl:
              r.thumbnail || `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            fallbackThumbnailUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
            playUrl: toCanonicalYouTubeUrl(videoId),
            source: 'youtube',
          })
        }
        return {
          items,
          provider: `Piped (${state.displayName})`,
        }
      }
    } catch {
      // Fall back to pinned sources below
    }
  }

  // 5. Pinned Playlists & Subscribed @Channels Library (works for YouTube Handle sign-in & zero-key pins)
  if (state.pinnedSources.length > 0) {
    const sources = state.pinnedSources.slice(0, 5)
    const settled = await Promise.allSettled(
      sources.map(async (src) => {
        if (src.kind === 'playlist') {
          const pl = await fetchYouTubePlaylistItems(src.ref)
          return pl.items.slice(0, 8)
        }
        const ch = await fetchYouTubeChannelVideos(src.ref)
        return ch.items.slice(0, 6)
      }),
    )

    const seen = new Set<string>()
    const combined: YouTubeVideoItem[] = []
    for (const s of settled) {
      if (s.status !== 'fulfilled') continue
      for (const item of s.value) {
        if (!seen.has(item.videoId)) {
          seen.add(item.videoId)
          combined.push(item)
        }
      }
    }

    if (combined.length > 0) {
      return {
        items: combined.slice(0, 24),
        provider:
          state.authProvider !== 'none'
            ? `Subscriptions (${state.displayName})`
            : 'My Pinned Library',
      }
    }
  }

  // 6. If signed in via YouTube handle/profile and relays are busy, return curated feed
  if (state.authProvider !== 'none') {
    const fallback = await fetchYouTubeCategory('trending')
    return {
      items: fallback.items,
      provider: `YouTube (${state.displayName})`,
      notice: `Signed in as ${state.displayName} (${state.handle}) — pin any @Channel or Playlist to customize your feed!`,
    }
  }

  return {
    items: [],
    provider: 'My YouTube Library',
    notice:
      'Sign in with your YouTube @handle / Google account or pin any Playlist or @Channel!',
  }
}
