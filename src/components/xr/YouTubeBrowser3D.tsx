import { RoundedBox, Text } from '@react-three/drei'
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  fetchYouTubeCategory,
  formatCompactViews,
  formatVideoDurationBadge,
  resetInstanceCooldowns,
  searchYouTubeVideos,
  type YouTubeCategory,
  type YouTubeVideoItem,
} from '../../services/youtube'
import {
  fetchPersonalYouTubeFeed,
  getYouTubeAccountState,
  openYouTubeWebLoginPopup,
  signInWithYouTubeIdentity,
  signOutYouTubeAccount,
  subscribeYouTubeAccount,
  type PersonalFeedSection,
  type YouTubeAccountState,
} from '../../services/youtubeAccount'

type BrowserTabId = YouTubeCategory | 'my-library' | 'upnext'

interface BrowserSpeechRecognitionAlternative {
  transcript: string
}

interface BrowserSpeechRecognitionResult {
  0: BrowserSpeechRecognitionAlternative
  length: number
}

interface BrowserSpeechRecognitionEvent {
  results: ArrayLike<BrowserSpeechRecognitionResult>
}

interface BrowserSpeechRecognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
}

type BrowserSpeechRecognitionConstructor = new () => BrowserSpeechRecognition

const MAX_THUMBNAIL_CACHE = 48
const thumbnailTextureCache = new Map<string, THREE.Texture>()

function rememberThumbnailTexture(url: string, tex: THREE.Texture) {
  if (thumbnailTextureCache.size >= MAX_THUMBNAIL_CACHE) {
    const oldestKey = thumbnailTextureCache.keys().next().value
    if (oldestKey) {
      const evicted = thumbnailTextureCache.get(oldestKey)
      evicted?.dispose()
      thumbnailTextureCache.delete(oldestKey)
    }
  }
  thumbnailTextureCache.set(url, tex)
}

/**
 * Safe non-suspending thumbnail loader for WebXR.
 * Never throws or suspends R3F if a CDN omits CORS headers — cleanly falls back
 * to secondary URL or procedural cinema card slate.
 */
function useThumbnailTexture(
  primaryUrl: string,
  fallbackUrl?: string,
): THREE.Texture | null {
  const [texture, setTexture] = useState<THREE.Texture | null>(() =>
    primaryUrl ? (thumbnailTextureCache.get(primaryUrl) ?? null) : null,
  )

  useEffect(() => {
    let cancelled = false

    if (!primaryUrl && !fallbackUrl) {
      setTexture(null)
      return
    }

    const cachedPrimary = primaryUrl ? thumbnailTextureCache.get(primaryUrl) : undefined
    if (cachedPrimary) {
      setTexture(cachedPrimary)
      return
    }

    const cachedFallback = fallbackUrl
      ? thumbnailTextureCache.get(fallbackUrl)
      : undefined
    if (cachedFallback) {
      setTexture(cachedFallback)
      return
    }

    setTexture(null)
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')

    const tryLoad = (targetUrl: string, nextFallback?: string) => {
      if (!targetUrl) {
        if (nextFallback) tryLoad(nextFallback)
        return
      }
      loader.load(
        targetUrl,
        (loaded) => {
          if (cancelled) {
            loaded.dispose()
            return
          }
          loaded.colorSpace = THREE.SRGBColorSpace
          loaded.minFilter = THREE.LinearFilter
          loaded.magFilter = THREE.LinearFilter
          loaded.generateMipmaps = false
          rememberThumbnailTexture(targetUrl, loaded)
          setTexture(loaded)
        },
        undefined,
        () => {
          if (cancelled) return
          if (nextFallback && nextFallback !== targetUrl) {
            tryLoad(nextFallback)
          }
        },
      )
    }

    tryLoad(primaryUrl, fallbackUrl)

    return () => {
      cancelled = true
    }
  }, [fallbackUrl, primaryUrl])

  return texture
}

function truncateLabel(text: string, maxChars: number): string {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (clean.length <= maxChars) return clean
  return `${clean.slice(0, maxChars - 1).trimEnd()}…`
}

interface PillButton3DProps {
  label: string
  position: [number, number, number]
  width: number
  height?: number
  fontSize?: number
  variant?: 'default' | 'amber' | 'crimson' | 'active'
  disabled?: boolean
  onClick: () => void
}

function PillButton3D({
  label,
  position,
  width,
  height = 0.058,
  fontSize = 0.022,
  variant = 'default',
  disabled = false,
  onClick,
}: PillButton3DProps) {
  const [hovered, setHovered] = useState(false)

  const bg = disabled
    ? '#111620'
    : variant === 'amber'
      ? hovered
        ? '#F2BE5C'
        : '#E5A93C'
      : variant === 'crimson'
        ? hovered
          ? '#EA6B58'
          : '#E05A47'
        : variant === 'active'
          ? hovered
            ? '#2F3D56'
            : '#253147'
          : hovered
            ? '#232D3F'
            : '#161C28'

  const fg = disabled
    ? '#4E5666'
    : variant === 'amber'
      ? '#0B0D10'
      : '#F4F1EA'

  return (
    <group
      position={position}
      pointerEventsType={{ deny: 'grab' }}
      onPointerOver={(e) => {
        if (disabled) return
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        if (disabled) return
        e.stopPropagation()
        onClick()
      }}
    >
      <RoundedBox args={[width, height, 0.014]} radius={0.016} smoothness={2}>
        <meshBasicMaterial color={bg} />
      </RoundedBox>
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.01]}
          fontSize={fontSize}
          color={fg}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Suspense>
    </group>
  )
}

interface VideoCard3DProps {
  item: YouTubeVideoItem
  position: [number, number, number]
  isPlayingNow: boolean
  onSelect: (item: YouTubeVideoItem) => void
}

function VideoCard3D({
  item,
  position,
  isPlayingNow,
  onSelect,
}: VideoCard3DProps) {
  const [hovered, setHovered] = useState(false)
  const thumbTex = useThumbnailTexture(item.thumbnailUrl, item.fallbackThumbnailUrl)

  const durationText = formatVideoDurationBadge(item.durationSec)
  const viewsText = formatCompactViews(item.views)
  const metaLine = [item.author, viewsText].filter(Boolean).join(' · ')

  const borderColor = isPlayingNow
    ? '#49B384'
    : hovered
      ? '#E5A93C'
      : '#1E2738'

  const badgeBg =
    item.source === 'youtube'
      ? '#E05A47'
      : item.source === 'peertube'
        ? '#3FB8AF'
        : '#E5A93C'
  const badgeFg = item.source === 'youtube' ? '#F4F1EA' : '#080A0D'
  const badgeLabel =
    item.source === 'youtube'
      ? 'YT'
      : item.source === 'peertube'
        ? 'OPEN'
        : 'HD'

  return (
    <group
      position={position}
      pointerEventsType={{ deny: 'grab' }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        onSelect(item)
      }}
    >
      {/* Accent border plate */}
      <RoundedBox args={[0.514, 0.288, 0.01]} radius={0.02} smoothness={2}>
        <meshBasicMaterial color={borderColor} />
      </RoundedBox>

      {/* Card body */}
      <RoundedBox
        args={[0.504, 0.278, 0.012]}
        radius={0.018}
        smoothness={2}
        position={[0, 0, 0.002]}
      >
        <meshBasicMaterial color={hovered ? '#192232' : '#121824'} />
      </RoundedBox>

      {/* 16:9 Thumbnail Viewport */}
      <mesh position={[0, 0.046, 0.01]}>
        <planeGeometry args={[0.478, 0.17]} />
        {thumbTex ? (
          <meshBasicMaterial key={thumbTex.uuid} map={thumbTex} toneMapped={false} />
        ) : (
          <meshBasicMaterial
            key="placeholder"
            color={hovered ? '#222E44' : '#192233'}
          />
        )}
      </mesh>

      {/* Stylized center play glyph when thumbnail is still loading or hovered */}
      {(!thumbTex || hovered || isPlayingNow) && (
        <group position={[0, 0.046, 0.014]}>
          <mesh>
            <circleGeometry args={[0.032, 24]} />
            <meshBasicMaterial
              color={isPlayingNow ? '#49B384' : '#0B0D10'}
              transparent
              opacity={0.82}
            />
          </mesh>
          <Suspense fallback={null}>
            <Text
              position={[0.002, 0, 0.004]}
              fontSize={0.026}
              color={isPlayingNow ? '#080A0D' : '#E5A93C'}
              anchorX="center"
              anchorY="middle"
            >
              ▶
            </Text>
          </Suspense>
        </group>
      )}

      {/* Top-left Source Pill */}
      <group position={[-0.196, 0.108, 0.014]}>
        <RoundedBox args={[0.072, 0.028, 0.004]} radius={0.007} smoothness={2}>
          <meshBasicMaterial color={badgeBg} />
        </RoundedBox>
        <Suspense fallback={null}>
          <Text
            position={[0, 0, 0.004]}
            fontSize={0.015}
            color={badgeFg}
            anchorX="center"
            anchorY="middle"
          >
            {badgeLabel}
          </Text>
        </Suspense>
      </group>

      {/* Bottom-right Duration Pill */}
      <group position={[0.18, -0.018, 0.014]}>
        <RoundedBox args={[0.104, 0.028, 0.004]} radius={0.007} smoothness={2}>
          <meshBasicMaterial color="#07090D" transparent opacity={0.88} />
        </RoundedBox>
        <Suspense fallback={null}>
          <Text
            position={[0, 0, 0.004]}
            fontSize={0.0155}
            color={isPlayingNow ? '#49B384' : '#F4F1EA'}
            anchorX="center"
            anchorY="middle"
          >
            {isPlayingNow ? 'PLAYING' : durationText}
          </Text>
        </Suspense>
      </group>

      {/* Title & Creator Metadata */}
      <Suspense fallback={null}>
        <Text
          position={[-0.236, -0.048, 0.012]}
          fontSize={0.019}
          lineHeight={1.16}
          maxWidth={0.472}
          color="#F4F1EA"
          anchorX="left"
          anchorY="top"
        >
          {truncateLabel(item.title, 44)}
        </Text>
        <Text
          position={[-0.236, -0.118, 0.012]}
          fontSize={0.0155}
          maxWidth={0.472}
          color={isPlayingNow ? '#49B384' : '#9CA3AF'}
          anchorX="left"
          anchorY="middle"
        >
          {truncateLabel(metaLine, 46)}
        </Text>
      </Suspense>
    </group>
  )
}

export interface YouTubeBrowser3DProps {
  visible: boolean
  keyboardOpenForSearch: boolean
  searchQuery: string
  searchTrigger: number
  activeMediaUrl: string
  relatedVideos: YouTubeVideoItem[]
  localDisplayName?: string
  onOpenSearchKeyboard: () => void
  onVoiceSearchQuery: (query: string) => void
  onClearSearch: () => void
  onSelectVideo: (video: YouTubeVideoItem, keepOpen: boolean) => void
  onOpen2DAccountLogin?: () => void
  onClose: () => void
}

const BASE_TABS: ReadonlyArray<{ id: BrowserTabId; label: string }> = [
  { id: 'trending', label: '🔥 Trending' },
  { id: 'my-library', label: '⭐ My YouTube' },
  { id: 'music', label: '🎵 Music' },
  { id: 'gaming', label: '🎮 Gaming' },
  { id: 'movies', label: '🎬 Trailers' },
  { id: 'lofi', label: '☕ Lo-Fi' },
  { id: 'openweb', label: '🌐 Open Web' },
  { id: 'cinema', label: '🎞 Cinema' },
]

const PAGE_SIZE = 6

export function YouTubeBrowser3D({
  visible,
  keyboardOpenForSearch,
  searchQuery,
  searchTrigger,
  activeMediaUrl,
  relatedVideos,
  localDisplayName,
  onOpenSearchKeyboard,
  onVoiceSearchQuery,
  onClearSearch,
  onSelectVideo,
  onOpen2DAccountLogin,
  onClose,
}: YouTubeBrowser3DProps) {
  const [activeTab, setActiveTab] = useState<BrowserTabId>('trending')
  const [vrPersonalSection, setVrPersonalSection] =
    useState<PersonalFeedSection>('subscriptions')
  const [accountState, setAccountState] = useState<YouTubeAccountState>(() =>
    getYouTubeAccountState(),
  )
  const [items, setItems] = useState<YouTubeVideoItem[]>([])
  const [providerName, setProviderName] = useState<string>('Connecting…')
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [page, setPage] = useState<number>(0)
  const [keepPinned, setKeepPinned] = useState<boolean>(false)
  const [listeningVoice, setListeningVoice] = useState<boolean>(false)
  const [searchHovered, setSearchHovered] = useState<boolean>(false)
  const [refreshNonce, setRefreshNonce] = useState<number>(0)

  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null)
  const hasFetchedOnceRef = useRef<boolean>(false)

  useEffect(() => {
    return subscribeYouTubeAccount((next) => {
      setAccountState(next)
      setRefreshNonce((n) => n + 1)
    })
  }, [])

  const tabs = useMemo(() => {
    if (relatedVideos.length > 0) {
      return [...BASE_TABS, { id: 'upnext' as const, label: '⚡ Up Next' }]
    }
    return BASE_TABS
  }, [relatedVideos.length])

  // Load feed when opened, when tab changes, or when search query submits
  useEffect(() => {
    if (!visible && hasFetchedOnceRef.current && searchTrigger === 0) {
      return
    }
    if (!visible) return

    hasFetchedOnceRef.current = true

    if (activeTab === 'upnext' && !searchQuery.trim()) {
      setItems(relatedVideos)
      setProviderName('Related Queue')
      setNotice(null)
      setPage(0)
      return
    }

    let cancelled = false
    setLoading(true)
    setNotice(null)

    const run = async () => {
      try {
        const trimmedQuery = searchQuery.trim()
        const feed = trimmedQuery
          ? await searchYouTubeVideos(trimmedQuery)
          : activeTab === 'my-library'
            ? await fetchPersonalYouTubeFeed(vrPersonalSection)
            : await fetchYouTubeCategory(
                activeTab === 'upnext' ? 'trending' : activeTab,
              )

        if (cancelled) return
        setItems(feed.items)
        setProviderName(feed.provider)
        setNotice(feed.notice ?? null)
        setPage(0)
      } catch (err) {
        if (cancelled) return
        setNotice(
          err instanceof Error ? err.message : 'Unable to load video feed right now.',
        )
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void run()

    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    accountState.authProvider,
    accountState.pinnedSources.length,
    refreshNonce,
    relatedVideos,
    searchQuery,
    searchTrigger,
    visible,
    vrPersonalSection,
  ])

  const handleVoiceSearch = useCallback(() => {
    if (listeningVoice && recognitionRef.current) {
      recognitionRef.current.stop()
      setListeningVoice(false)
      return
    }

    const speechWindow = window as unknown as {
      SpeechRecognition?: BrowserSpeechRecognitionConstructor
      webkitSpeechRecognition?: BrowserSpeechRecognitionConstructor
    }
    const SpeechCtor =
      speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!SpeechCtor) {
      setNotice('Voice dictation unavailable here — tap Search bar for 3D Keyboard.')
      onOpenSearchKeyboard()
      return
    }

    try {
      const recognition = new SpeechCtor()
      recognition.lang = 'en-US'
      recognition.interimResults = false
      recognition.maxAlternatives = 1
      recognitionRef.current = recognition
      setListeningVoice(true)
      setNotice('Listening… speak a YouTube video or channel name')

      recognition.onresult = (event) => {
        const spoken = event.results?.[0]?.[0]?.transcript?.trim() ?? ''
        setListeningVoice(false)
        if (spoken) {
          setNotice(null)
          onVoiceSearchQuery(spoken)
        }
      }
      recognition.onerror = () => {
        setListeningVoice(false)
        setNotice('Could not hear voice query — tap Search bar to type in VR.')
      }
      recognition.onend = () => {
        setListeningVoice(false)
      }
      recognition.start()
    } catch {
      setListeningVoice(false)
      onOpenSearchKeyboard()
    }
  }, [listeningVoice, onOpenSearchKeyboard, onVoiceSearchQuery])

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop()
    }
  }, [])

  if (!visible) return null

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages - 1)
  const visibleSlice = items.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  )

  const tabCount = tabs.length
  const tabWidth = tabCount >= 9 ? 0.172 : tabCount >= 8 ? 0.194 : 0.214
  const tabSpan = tabCount >= 9 ? 1.5 : 1.48
  const tabFontSize = tabCount >= 9 ? 0.0168 : 0.0185
  const tabStep = tabCount > 1 ? tabSpan / (tabCount - 1) : 0
  const fallbackHandle =
    searchQuery.trim() || localDisplayName?.trim() || '@dingbaum'

  return (
    <group
      name="youtube-browser-3d"
      position={[0, keyboardOpenForSearch ? 1.92 : 1.62, keyboardOpenForSearch ? -1.72 : -1.62]}
      rotation={[-0.04, 0, 0]}
    >
      {/* Main Spatial Browser Chassis */}
      <RoundedBox args={[1.74, 1.06, 0.026]} radius={0.036} smoothness={3}>
        <meshStandardMaterial color="#0B0F17" roughness={0.62} metalness={0.28} />
      </RoundedBox>

      {/* Top YouTube Crimson-to-Amber Accent Bar */}
      <mesh position={[-0.42, 0.522, 0.015]}>
        <boxGeometry args={[0.82, 0.006, 0.004]} />
        <meshBasicMaterial color="#E05A47" />
      </mesh>
      <mesh position={[0.42, 0.522, 0.015]}>
        <boxGeometry args={[0.82, 0.006, 0.004]} />
        <meshBasicMaterial color="#E5A93C" />
      </mesh>

      {/* Row 1: Header & YouTube Account Login / Relay Controls */}
      <group position={[0, 0.462, 0.015]}>
        {/* Play icon badge */}
        <RoundedBox
          args={[0.068, 0.046, 0.008]}
          radius={0.01}
          smoothness={2}
          position={[-0.78, 0, 0]}
        >
          <meshBasicMaterial
            color={accountState.authProvider !== 'none' ? '#49B384' : '#E05A47'}
          />
        </RoundedBox>
        <Suspense fallback={null}>
          <Text
            position={[-0.778, 0, 0.008]}
            fontSize={0.024}
            color="#F4F1EA"
            anchorX="center"
            anchorY="middle"
          >
            ▶
          </Text>
          <Text
            position={[-0.72, 0, 0.006]}
            fontSize={0.024}
            maxWidth={0.55}
            color="#F4F1EA"
            anchorX="left"
            anchorY="middle"
          >
            {accountState.authProvider !== 'none'
              ? `YT · ${truncateLabel(accountState.handle || accountState.displayName, 16)}`
              : 'YOUTUBE & VR DECK'}
          </Text>
        </Suspense>

        {/* Dedicated 3D YouTube Login / Account Button */}
        <PillButton3D
          label={
            accountState.authProvider !== 'none'
              ? `✅ ${truncateLabel(accountState.handle || accountState.displayName, 12)}`
              : '🔑 YouTube Login'
          }
          position={[-0.08, 0, 0]}
          width={0.25}
          height={0.052}
          fontSize={0.0185}
          variant={accountState.authProvider !== 'none' ? 'active' : 'crimson'}
          onClick={() => {
            if (searchQuery.trim()) {
              onClearSearch()
            }
            setActiveTab('my-library')
            setPage(0)
          }}
        />

        {activeTab === 'my-library' && !searchQuery.trim() ? (
          <PillButton3D
            label={
              vrPersonalSection === 'subscriptions'
                ? '📺 Feed: Subs ↻'
                : vrPersonalSection === 'liked'
                  ? '👍 Feed: Liked ↻'
                  : '📌 Feed: Pinned ↻'
            }
            position={[0.19, 0, 0]}
            width={0.23}
            height={0.052}
            fontSize={0.018}
            variant="active"
            onClick={() => {
              setVrPersonalSection((prev) =>
                prev === 'subscriptions'
                  ? 'liked'
                  : prev === 'liked'
                    ? 'pinned'
                    : 'subscriptions',
              )
              setPage(0)
            }}
          />
        ) : (
          <PillButton3D
            label="↻ Switch Relay"
            position={[0.19, 0, 0]}
            width={0.22}
            height={0.052}
            fontSize={0.018}
            onClick={() => {
              resetInstanceCooldowns()
              setRefreshNonce((n) => n + 1)
            }}
          />
        )}

        <PillButton3D
          label={keepPinned ? '📌 Pinned' : 'Auto-Hide'}
          position={[0.45, 0, 0]}
          width={0.21}
          height={0.052}
          fontSize={0.018}
          variant={keepPinned ? 'active' : 'default'}
          onClick={() => setKeepPinned((p) => !p)}
        />

        <PillButton3D
          label="Close ✕"
          position={[0.71, 0, 0]}
          width={0.19}
          height={0.052}
          fontSize={0.02}
          onClick={onClose}
        />
      </group>

      {/* Row 2: Interactive 3D Search Input + Voice Dictation + Clear/Keyboard */}
      <group position={[0, 0.372, 0.015]}>
        <group
          position={[-0.22, 0, 0]}
          pointerEventsType={{ deny: 'grab' }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setSearchHovered(true)
          }}
          onPointerOut={() => setSearchHovered(false)}
          onClick={(e) => {
            e.stopPropagation()
            onOpenSearchKeyboard()
          }}
        >
          <RoundedBox args={[1.18, 0.068, 0.012]} radius={0.016} smoothness={2}>
            <meshBasicMaterial
              color={
                keyboardOpenForSearch
                  ? '#1A2436'
                  : searchHovered
                    ? '#161F2E'
                    : '#07090D'
              }
            />
          </RoundedBox>
          <Suspense fallback={null}>
            <Text
              position={[-0.55, 0, 0.009]}
              fontSize={0.022}
              color={searchQuery ? '#F4F1EA' : '#9CA3AF'}
              maxWidth={1.1}
              anchorX="left"
              anchorY="middle"
            >
              {searchQuery
                ? `🔍 ${truncateLabel(searchQuery, 48)}`
                : '🔍 Search YouTube videos, @handle, or paste link (opens 3D Keyboard)…'}
            </Text>
          </Suspense>
        </group>

        <PillButton3D
          label={listeningVoice ? '🎙 Listening…' : '🎤 Voice'}
          position={[0.5, 0, 0]}
          width={0.19}
          height={0.068}
          fontSize={0.021}
          variant={listeningVoice ? 'crimson' : 'default'}
          onClick={handleVoiceSearch}
        />

        {searchQuery ? (
          <PillButton3D
            label="Clear ✕"
            position={[0.71, 0, 0]}
            width={0.19}
            height={0.068}
            fontSize={0.021}
            onClick={onClearSearch}
          />
        ) : (
          <PillButton3D
            label="Type ⌨"
            position={[0.71, 0, 0]}
            width={0.19}
            height={0.068}
            fontSize={0.021}
            variant={keyboardOpenForSearch ? 'amber' : 'default'}
            onClick={onOpenSearchKeyboard}
          />
        )}
      </group>

      {/* Row 3: Category Filter Pills */}
      <group position={[0, 0.282, 0.015]}>
        {tabs.map((tab, idx) => {
          const x = -tabSpan / 2 + idx * tabStep
          const isSelected = !searchQuery.trim() && activeTab === tab.id
          return (
            <PillButton3D
              key={tab.id}
              label={tab.label}
              position={[x, 0, 0]}
              width={tabWidth}
              height={0.054}
              fontSize={tabFontSize}
              variant={isSelected ? 'amber' : 'default'}
              onClick={() => {
                if (searchQuery.trim()) {
                  onClearSearch()
                }
                setActiveTab(tab.id)
                setPage(0)
              }}
            />
          )
        })}
      </group>

      {/* Rows 4 & 5: 3x2 Paginated Spatial Video Cards OR 3D YouTube Login Panel */}
      {loading ? (
        <group position={[0, -0.07, 0.016]}>
          <RoundedBox args={[0.92, 0.22, 0.012]} radius={0.024} smoothness={2}>
            <meshBasicMaterial color="#121824" />
          </RoundedBox>
          <Suspense fallback={null}>
            <Text
              position={[0, 0.03, 0.01]}
              fontSize={0.03}
              color="#E5A93C"
              anchorX="center"
              anchorY="middle"
            >
              Fetching YouTube Feed…
            </Text>
            <Text
              position={[0, -0.035, 0.01]}
              fontSize={0.02}
              color="#9CA3AF"
              anchorX="center"
              anchorY="middle"
            >
              Connecting to fastest CORS-enabled cinema relay
            </Text>
          </Suspense>
        </group>
      ) : activeTab === 'my-library' &&
        !searchQuery.trim() &&
        accountState.authProvider === 'none' &&
        visibleSlice.length === 0 ? (
        <group name="youtube-3d-login-panel" position={[0, -0.075, 0.016]}>
          <RoundedBox args={[1.54, 0.56, 0.014]} radius={0.024} smoothness={2}>
            <meshBasicMaterial color="#121824" />
          </RoundedBox>
          <Suspense fallback={null}>
            <Text
              position={[0, 0.21, 0.01]}
              fontSize={0.028}
              color="#F4F1EA"
              anchorX="center"
              anchorY="middle"
            >
              🔑 Sign In to Your YouTube Account
            </Text>
            <Text
              position={[0, 0.145, 0.01]}
              fontSize={0.018}
              maxWidth={1.38}
              color="#9CA3AF"
              anchorX="center"
              anchorY="middle"
            >
              Sign in instantly with your YouTube @handle, channel, or Google account to load your personal Subscriptions, Liked Videos &amp; Pinned Channels.
            </Text>
          </Suspense>

          <PillButton3D
            label={`🔑 1-Click Sign In (${truncateLabel(fallbackHandle, 22)})`}
            position={[-0.36, 0.03, 0.01]}
            width={0.68}
            height={0.074}
            fontSize={0.02}
            variant="crimson"
            onClick={() => {
              void signInWithYouTubeIdentity(fallbackHandle)
            }}
          />

          <PillButton3D
            label="🌐 Sign In on YouTube.com (Popup)"
            position={[0.36, 0.03, 0.01]}
            width={0.68}
            height={0.074}
            fontSize={0.02}
            variant="amber"
            onClick={() => {
              openYouTubeWebLoginPopup(fallbackHandle)
            }}
          />

          <PillButton3D
            label="⌨ Type Custom @Handle / Email"
            position={[-0.36, -0.075, 0.01]}
            width={0.68}
            height={0.068}
            fontSize={0.019}
            variant="active"
            onClick={() => {
              onOpenSearchKeyboard()
            }}
          />

          <PillButton3D
            label="🖥 Open Full 2D Account & YouTube TV"
            position={[0.36, -0.075, 0.01]}
            width={0.68}
            height={0.068}
            fontSize={0.019}
            variant="default"
            onClick={() => {
              onOpen2DAccountLogin?.()
            }}
          />

          <Suspense fallback={null}>
            <Text
              position={[0, -0.19, 0.01]}
              fontSize={0.0165}
              color="#E5A93C"
              anchorX="center"
              anchorY="middle"
            >
              Tip: You can also click "🔑 YouTube Login" in the top-left bar at any time.
            </Text>
          </Suspense>
        </group>
      ) : visibleSlice.length === 0 ? (
        <group position={[0, -0.07, 0.016]}>
          <Suspense fallback={null}>
            <Text
              position={[0, 0.02, 0.01]}
              fontSize={0.028}
              color="#F4F1EA"
              anchorX="center"
              anchorY="middle"
            >
              No videos matched that search.
            </Text>
            <Text
              position={[0, -0.035, 0.01]}
              fontSize={0.02}
              color="#9CA3AF"
              anchorX="center"
              anchorY="middle"
            >
              Try another keyword or tap 🌐 Open Web / 🎞 Cinema tabs above.
            </Text>
          </Suspense>
        </group>
      ) : (
        <group name="youtube-video-grid">
          {visibleSlice.map((item, idx) => {
            const col = idx % 3
            const row = Math.floor(idx / 3)
            const x = -0.54 + col * 0.54
            const y = row === 0 ? 0.085 : -0.225
            return (
              <VideoCard3D
                key={item.id}
                item={item}
                position={[x, y, 0.014]}
                isPlayingNow={activeMediaUrl === item.playUrl}
                onSelect={(picked) => onSelectVideo(picked, keepPinned)}
              />
            )
          })}
        </group>
      )}

      {/* Row 6: Pagination & Relay Status Footer */}
      <group position={[0, -0.452, 0.015]}>
        <PillButton3D
          label="◀ Prev"
          position={[-0.69, 0, 0]}
          width={0.22}
          height={0.058}
          disabled={safePage <= 0 || loading}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        />

        {activeTab === 'my-library' && accountState.authProvider !== 'none' ? (
          <PillButton3D
            label="Sign Out YT"
            position={[-0.44, 0, 0]}
            width={0.2}
            height={0.052}
            fontSize={0.0175}
            onClick={() => signOutYouTubeAccount()}
          />
        ) : null}

        <Suspense fallback={null}>
          <Text
            position={[
              activeTab === 'my-library' && accountState.authProvider !== 'none'
                ? 0.08
                : 0,
              0,
              0.008,
            ]}
            fontSize={0.018}
            maxWidth={
              activeTab === 'my-library' && accountState.authProvider !== 'none'
                ? 0.88
                : 1.06
            }
            color={notice ? '#E5A93C' : '#9CA3AF'}
            anchorX="center"
            anchorY="middle"
          >
            {notice
              ? truncateLabel(notice, 64)
              : `Page ${safePage + 1} of ${totalPages} · ${items.length} videos · Source: ${providerName}`}
          </Text>
        </Suspense>

        <PillButton3D
          label="Next ▶"
          position={[0.69, 0, 0]}
          width={0.22}
          height={0.058}
          disabled={safePage >= totalPages - 1 || loading}
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        />
      </group>
    </group>
  )
}
