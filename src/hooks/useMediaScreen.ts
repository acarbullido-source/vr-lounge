import type Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  getCinemaQuestCanvas,
  isAdventureMediaUrl,
} from '../games/adventure'
import {
  getNesEmulator,
  isNesMediaUrl,
  parseNesCartridgeIdFromUrl,
} from '../services/nesEmulator'
import {
  extractPeerTubeRef,
  extractYouTubeVideoId,
  isYouTubeWatchUrl,
  resolvePeerTubeStreams,
  resolveYouTubeStreams,
  type ResolvedStreamCandidate,
  type YouTubeVideoItem,
} from '../services/youtube'
import type { PresenterState } from '../types/lounge'

let hlsConstructorPromise: Promise<typeof Hls> | null = null

function loadHlsConstructor(): Promise<typeof Hls> {
  if (!hlsConstructorPromise) {
    hlsConstructorPromise = import('hls.js').then((mod) => mod.default)
  }
  return hlsConstructorPromise
}

function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(url) || url.includes('mpegurl')
}

export function isLocalStreamProxyAvailable(): boolean {
  if (!import.meta.env.DEV || typeof window === 'undefined') return false
  const host = window.location.hostname.toLowerCase()
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(host)
  )
}

export function resolvePlayableStreamUrl(
  rawUrl: string,
  useCorsProxy: boolean,
  canLocalProxy = isLocalStreamProxyAvailable(),
): string {
  if (!canLocalProxy || !useCorsProxy) return rawUrl
  return `/api/stream-proxy?url=${encodeURIComponent(rawUrl)}`
}

export interface UseMediaScreenOptions {
  presenterState: PresenterState
  localUserId: string
  localScreenStream: MediaStream | null
  remoteScreenStreams: Record<string, MediaStream>
  cinemaVolume: number
  selectedSpeakerId: string
  inVR?: boolean
  onPresenterProgress?: (currentTime: number, duration: number) => void
}

let sharedVideoEl: HTMLVideoElement | null = null
let sharedCompanionAudioEl: HTMLAudioElement | null = null
let sharedVideoTex: THREE.VideoTexture | null = null

function getCinemaScreenMedia(): {
  videoElement: HTMLVideoElement
  companionAudioElement: HTMLAudioElement
  videoTexture: THREE.VideoTexture
} {
  if (!sharedVideoEl) {
    const el = document.createElement('video')
    el.playsInline = true
    el.crossOrigin = 'anonymous'
    el.preload = 'auto'
    el.autoplay = false
    sharedVideoEl = el
  }
  if (!sharedCompanionAudioEl) {
    const audio = document.createElement('audio')
    audio.crossOrigin = 'anonymous'
    audio.preload = 'auto'
    audio.autoplay = false
    sharedCompanionAudioEl = audio
  }
  if (!sharedVideoTex) {
    const tex = new THREE.VideoTexture(sharedVideoEl)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    sharedVideoTex = tex
  }
  return {
    videoElement: sharedVideoEl,
    companionAudioElement: sharedCompanionAudioEl,
    videoTexture: sharedVideoTex,
  }
}

export function useMediaScreen({
  presenterState,
  localUserId,
  localScreenStream,
  remoteScreenStreams,
  cinemaVolume,
  selectedSpeakerId,
  inVR = false,
  onPresenterProgress,
}: UseMediaScreenOptions) {
  const { videoElement, companionAudioElement, videoTexture } = getCinemaScreenMedia()

  const [hasVideoFrames, setHasVideoFrames] = useState(false)
  const [isResolvingMedia, setIsResolvingMedia] = useState(false)
  const [activeStreamQuality, setActiveStreamQuality] = useState<string | null>(null)
  const [relatedVideos, setRelatedVideos] = useState<YouTubeVideoItem[]>([])
  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const [localDuration, setLocalDuration] = useState(0)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false)
  const [youtubeEmbedVideoId, setYoutubeEmbedVideoId] = useState<string | null>(null)

  const hlsRef = useRef<Hls | null>(null)
  const loadedSourceKeyRef = useRef<string>('')
  const autoProxiedUrlRef = useRef<string>('')
  const candidatesRef = useRef<ResolvedStreamCandidate[]>([])
  const candidateIndexRef = useRef<number>(0)
  const hasCompanionAudioRef = useRef<boolean>(false)
  const attachCandidateRef = useRef<((index: number) => void) | null>(null)
  const activeYouTubeVideoIdRef = useRef<string | null>(null)
  const candidateWatchdogRef = useRef<number | null>(null)

  const clearCandidateWatchdog = useCallback(() => {
    if (candidateWatchdogRef.current !== null) {
      window.clearTimeout(candidateWatchdogRef.current)
      candidateWatchdogRef.current = null
    }
  }, [])

  const progressCallbackRef = useRef(onPresenterProgress)
  useEffect(() => {
    progressCallbackRef.current = onPresenterProgress
  }, [onPresenterProgress])

  const latestPlaybackRef = useRef({
    currentTime: presenterState.currentTime,
    isPlaying: presenterState.isPlaying,
    cinemaVolume,
  })
  useEffect(() => {
    latestPlaybackRef.current = {
      currentTime: presenterState.currentTime,
      isPlaying: presenterState.isPlaying,
      cinemaVolume,
    }
  }, [cinemaVolume, presenterState.currentTime, presenterState.isPlaying])

  const isLocalPresenter = presenterState.activePresenterId === localUserId

  const clearCompanionAudio = useCallback(() => {
    hasCompanionAudioRef.current = false
    companionAudioElement.pause()
    companionAudioElement.removeAttribute('src')
    companionAudioElement.load()
  }, [companionAudioElement])

  // Route audio output device when supported by Chromium (including '' for Default)
  useEffect(() => {
    const sinkableVideo = videoElement as HTMLVideoElement & {
      setSinkId?: (sinkId: string) => Promise<void>
    }
    const sinkableAudio = companionAudioElement as HTMLAudioElement & {
      setSinkId?: (sinkId: string) => Promise<void>
    }
    const targetSink = selectedSpeakerId || ''
    if (typeof sinkableVideo.setSinkId === 'function') {
      void sinkableVideo.setSinkId(targetSink).catch(() => undefined)
    }
    if (typeof sinkableAudio.setSinkId === 'function') {
      void sinkableAudio.setSinkId(targetSink).catch(() => undefined)
    }
  }, [companionAudioElement, selectedSpeakerId, videoElement])

  // Apply cinema volume (mute local presenter's own tab preview or background WebGL video when 2D YouTube IFrame is active)
  useEffect(() => {
    const muteSelfTabLoopback =
      presenterState.screenMode === 'tab-stream' && isLocalPresenter
    const muteFor2DYouTubeEmbed = Boolean(youtubeEmbedVideoId && !inVR)
    if (muteSelfTabLoopback || muteFor2DYouTubeEmbed) {
      videoElement.muted = true
      videoElement.volume = 0
      companionAudioElement.muted = true
      companionAudioElement.volume = 0
      if (muteSelfTabLoopback) {
        getNesEmulator().setMasterVolume(0)
      }
    } else if (!needsAudioUnlock) {
      const muted = cinemaVolume <= 0.001
      const clampedVol = Math.max(0, Math.min(1, cinemaVolume))
      videoElement.muted = muted
      videoElement.volume = clampedVol
      companionAudioElement.muted = muted
      companionAudioElement.volume = clampedVol
      getNesEmulator().setMasterVolume(
        presenterState.screenMode === 'url-sync' && isNesMediaUrl(presenterState.mediaUrl)
          ? clampedVol
          : 0,
      )
    }
  }, [
    cinemaVolume,
    companionAudioElement,
    inVR,
    isLocalPresenter,
    needsAudioUnlock,
    presenterState.mediaUrl,
    presenterState.screenMode,
    videoElement,
    youtubeEmbedVideoId,
  ])

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [])

  // Bind Mode 1 (WebRTC MediaStream) vs Mode 2 (MP4 / HLS / Native YouTube & Open Web Resolver)
  useEffect(() => {
    let cancelled = false
    let sourceAttached = false

    const applyCandidate = (index: number) => {
      if (cancelled) return
      clearCandidateWatchdog()
      const candidate = candidatesRef.current[index]
      if (!candidate) {
        if (activeYouTubeVideoIdRef.current) {
          setYoutubeEmbedVideoId(activeYouTubeVideoIdRef.current)
          setHasVideoFrames(true)
          setMediaError(null)
        }
        return
      }

      candidateIndexRef.current = index
      destroyHls()
      clearCompanionAudio()
      videoElement.srcObject = null
      setMediaError(null)

      if (activeYouTubeVideoIdRef.current) {
        if (candidate.isFallbackStream) {
          setYoutubeEmbedVideoId(activeYouTubeVideoIdRef.current)
        } else {
          setYoutubeEmbedVideoId(null)
          // 4.5s watchdog: if a direct Piped/Invidious stream stalls or hangs on 403, advance to next candidate
          candidateWatchdogRef.current = window.setTimeout(() => {
            if (cancelled || candidateIndexRef.current !== index) return
            if (videoElement.readyState < 2) {
              const nextIdx = index + 1
              if (nextIdx < candidatesRef.current.length) {
                applyCandidate(nextIdx)
              } else if (activeYouTubeVideoIdRef.current) {
                setYoutubeEmbedVideoId(activeYouTubeVideoIdRef.current)
                setHasVideoFrames(true)
              }
            }
          }, 4500)
        }
      } else {
        setYoutubeEmbedVideoId(null)
      }

      setActiveStreamQuality(
        candidate.provider !== 'Direct'
          ? `${candidate.qualityLabel} · ${candidate.provider}`
          : candidate.qualityLabel,
      )

      const canLocalProxy = isLocalStreamProxyAvailable()
      const shouldProxy =
        canLocalProxy &&
        (presenterState.useCorsProxy ||
          autoProxiedUrlRef.current === candidate.streamUrl)
      const finalUrl = resolvePlayableStreamUrl(
        candidate.streamUrl,
        shouldProxy,
        canLocalProxy,
      )

      if (candidate.audioUrl) {
        hasCompanionAudioRef.current = true
        const finalAudioUrl = resolvePlayableStreamUrl(
          candidate.audioUrl,
          shouldProxy,
          canLocalProxy,
        )
        companionAudioElement.src = finalAudioUrl
        companionAudioElement.muted =
          Boolean(activeYouTubeVideoIdRef.current && candidate.isFallbackStream && !inVR) ||
          latestPlaybackRef.current.cinemaVolume <= 0.001
        companionAudioElement.volume = Math.max(
          0,
          Math.min(1, latestPlaybackRef.current.cinemaVolume),
        )
        companionAudioElement.load()
      }

      if (candidate.kind === 'hls' || isHlsUrl(candidate.streamUrl)) {
        void loadHlsConstructor()
          .then((HlsCtor) => {
            if (cancelled || candidateIndexRef.current !== index) return
            if (HlsCtor.isSupported()) {
              const hls = new HlsCtor({
                enableWorker: true,
                lowLatencyMode: false,
              })
              hlsRef.current = hls
              let netRetries = 0
              let mediaRetries = 0
              hls.loadSource(finalUrl)
              hls.attachMedia(videoElement)
              hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
                if (cancelled) return
                netRetries = 0
                mediaRetries = 0
                clearCandidateWatchdog()
                setHasVideoFrames(true)
                const { currentTime, isPlaying } = latestPlaybackRef.current
                if (currentTime > 0.5) {
                  videoElement.currentTime = currentTime
                }
                if (isPlaying) {
                  void videoElement.play().catch(() => {
                    videoElement.muted = true
                    companionAudioElement.muted = true
                    setNeedsAudioUnlock(true)
                    void videoElement.play().catch(() => undefined)
                  })
                }
              })
              hls.on(HlsCtor.Events.ERROR, (_event, data) => {
                if (cancelled || !data.fatal) return
                if (data.type === HlsCtor.ErrorTypes.NETWORK_ERROR && netRetries < 2) {
                  netRetries += 1
                  hls.startLoad()
                  return
                }
                if (data.type === HlsCtor.ErrorTypes.MEDIA_ERROR && mediaRetries < 2) {
                  mediaRetries += 1
                  if (mediaRetries === 2) {
                    hls.swapAudioCodec()
                  }
                  hls.recoverMediaError()
                  return
                }
                clearCandidateWatchdog()
                // Fail over to next stream candidate if available!
                const nextIdx = candidateIndexRef.current + 1
                if (nextIdx < candidatesRef.current.length) {
                  applyCandidate(nextIdx)
                  return
                }
                if (
                  canLocalProxy &&
                  autoProxiedUrlRef.current !== candidate.streamUrl &&
                  !presenterState.useCorsProxy
                ) {
                  autoProxiedUrlRef.current = candidate.streamUrl
                  applyCandidate(candidateIndexRef.current)
                  return
                }
                if (activeYouTubeVideoIdRef.current) {
                  setYoutubeEmbedVideoId(activeYouTubeVideoIdRef.current)
                  setHasVideoFrames(true)
                  setMediaError(null)
                  return
                }
                setMediaError(
                  `HLS stream error (${data.details}). Try selecting another stream or switch relay.`,
                )
              })
            } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
              videoElement.src = finalUrl
              videoElement.load()
            } else {
              const nextIdx = candidateIndexRef.current + 1
              if (nextIdx < candidatesRef.current.length) {
                applyCandidate(nextIdx)
                return
              }
              setMediaError('HLS playback is not supported in this browser.')
            }
          })
          .catch(() => {
            if (cancelled || candidateIndexRef.current !== index) return
            if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
              videoElement.src = finalUrl
              videoElement.load()
            } else {
              const nextIdx = candidateIndexRef.current + 1
              if (nextIdx < candidatesRef.current.length) {
                applyCandidate(nextIdx)
                return
              }
              setMediaError('Unable to load HLS player module.')
            }
          })
      } else {
        videoElement.src = finalUrl
        videoElement.load()
      }
    }

    attachCandidateRef.current = (nextIndex: number) => {
      applyCandidate(nextIndex)
    }

    const attachMedia = async () => {
      const mode = presenterState.screenMode
      const activePresenterId = presenterState.activePresenterId
      const hasUrlSyncMedia =
        mode === 'url-sync' && Boolean(presenterState.mediaUrl.trim())

      if (mode === 'idle' || (!activePresenterId && !hasUrlSyncMedia)) {
        clearCandidateWatchdog()
        activeYouTubeVideoIdRef.current = null
        setYoutubeEmbedVideoId(null)
        getNesEmulator().setConsumerActive('screen', false)
        getCinemaQuestCanvas().setConsumerActive('screen', false)
        destroyHls()
        clearCompanionAudio()
        candidatesRef.current = []
        candidateIndexRef.current = 0
        loadedSourceKeyRef.current = ''
        videoElement.pause()
        videoElement.srcObject = null
        videoElement.removeAttribute('src')
        setIsResolvingMedia(false)
        setActiveStreamQuality(null)
        setHasVideoFrames(false)
        setMediaError(null)
        return
      }

      if (mode === 'tab-stream') {
        clearCandidateWatchdog()
        activeYouTubeVideoIdRef.current = null
        setYoutubeEmbedVideoId(null)
        getNesEmulator().setConsumerActive('screen', false)
        getCinemaQuestCanvas().setConsumerActive('screen', false)
        destroyHls()
        clearCompanionAudio()
        candidatesRef.current = []
        setIsResolvingMedia(false)
        setActiveStreamQuality('Live WebRTC Tab')

        const targetStream = isLocalPresenter
          ? localScreenStream
          : activePresenterId
            ? (remoteScreenStreams[activePresenterId] ?? null)
            : null

        if (!targetStream) {
          videoElement.srcObject = null
          setHasVideoFrames(false)
          setMediaError(null)
          return
        }

        const streamKey = `stream:${targetStream.id}:${targetStream.getTracks().length}`
        if (loadedSourceKeyRef.current !== streamKey) {
          loadedSourceKeyRef.current = streamKey
          sourceAttached = true
          videoElement.removeAttribute('src')
          videoElement.srcObject = targetStream
          videoElement.muted =
            isLocalPresenter || latestPlaybackRef.current.cinemaVolume <= 0.001
          setMediaError(null)
        }

        try {
          await videoElement.play()
          if (!cancelled) setHasVideoFrames(true)
        } catch {
          videoElement.muted = true
          await videoElement.play().catch(() => undefined)
          if (!cancelled) {
            setHasVideoFrames(true)
            if (!isLocalPresenter) setNeedsAudioUnlock(true)
          }
        }
        return
      }

      // Mode 2: Synchronized URL / Native YouTube / PeerTube Player
      const rawUrl = presenterState.mediaUrl.trim()
      if (!rawUrl) {
        clearCandidateWatchdog()
        activeYouTubeVideoIdRef.current = null
        setYoutubeEmbedVideoId(null)
        getNesEmulator().setConsumerActive('screen', false)
        getCinemaQuestCanvas().setConsumerActive('screen', false)
        setHasVideoFrames(false)
        setIsResolvingMedia(false)
        return
      }

      const sourceKey = `url:${rawUrl}:proxy=${presenterState.useCorsProxy}`
      if (loadedSourceKeyRef.current === sourceKey) {
        if (isNesMediaUrl(rawUrl)) {
          const nes = getNesEmulator()
          nes.setConsumerActive('screen', true)
          const cartId = parseNesCartridgeIdFromUrl(rawUrl)
          if (
            cartId !== 'custom-rom' &&
            (nes.getActiveCartridge().id !== cartId || !nes.isRomLoaded())
          ) {
            nes.loadLibraryCartridge(cartId)
          }
          if (!cancelled) {
            setHasVideoFrames(true)
          }
        } else if (isAdventureMediaUrl(rawUrl)) {
          getCinemaQuestCanvas().setConsumerActive('screen', true)
          if (!cancelled) {
            setHasVideoFrames(true)
          }
        }
        sourceAttached = true
        return
      }

      loadedSourceKeyRef.current = sourceKey
      clearCandidateWatchdog()
      setMediaError(null)
      setHasVideoFrames(false)
      setActiveStreamQuality(null)
      destroyHls()
      clearCompanionAudio()
      videoElement.srcObject = null

      if (isAdventureMediaUrl(rawUrl)) {
        activeYouTubeVideoIdRef.current = null
        setYoutubeEmbedVideoId(null)
        getNesEmulator().setConsumerActive('screen', false)
        const questCanvas = getCinemaQuestCanvas()
        questCanvas.setConsumerActive('screen', true)
        sourceAttached = true
        setIsResolvingMedia(false)
        setActiveStreamQuality('1080p Story Quest Engine')
        videoElement.pause()
        videoElement.removeAttribute('src')
        videoElement.srcObject = null
        if (!cancelled) {
          setHasVideoFrames(true)
        }
        return
      }
      getCinemaQuestCanvas().setConsumerActive('screen', false)

      if (isNesMediaUrl(rawUrl)) {
        activeYouTubeVideoIdRef.current = null
        setYoutubeEmbedVideoId(null)
        const nes = getNesEmulator()
        nes.setConsumerActive('screen', true)
        const cartId = parseNesCartridgeIdFromUrl(rawUrl)
        if (cartId !== 'custom-rom') {
          nes.loadLibraryCartridge(cartId)
        }
        sourceAttached = true
        setIsResolvingMedia(false)
        setActiveStreamQuality('60fps JSNES Hardware')
        videoElement.pause()
        videoElement.removeAttribute('src')
        videoElement.srcObject = null
        if (!cancelled) {
          setHasVideoFrames(true)
        }
        return
      }
      getNesEmulator().setConsumerActive('screen', false)

      const ytVideoId = isYouTubeWatchUrl(rawUrl)
        ? extractYouTubeVideoId(rawUrl)
        : null
      activeYouTubeVideoIdRef.current = ytVideoId
      if (!ytVideoId) {
        setYoutubeEmbedVideoId(null)
      }
      const peerTubeRef = !ytVideoId ? extractPeerTubeRef(rawUrl) : null

      if (ytVideoId) {
        setIsResolvingMedia(true)
        try {
          // Support legacy ?url= custom endpoint if explicitly configured that way
          const customEnv = (
            import.meta.env.VITE_YOUTUBE_PROXY_URL as string | undefined
          )?.trim()
          if (customEnv && customEnv.includes('?')) {
            const resp = await fetch(`${customEnv}${encodeURIComponent(rawUrl)}`)
            if (!resp.ok) throw new Error(`Custom resolver HTTP ${resp.status}`)
            const data = (await resp.json()) as { streamUrl?: string }
            if (!data.streamUrl) throw new Error('Resolver returned no streamUrl')
            if (cancelled) return
            candidatesRef.current = [
              {
                streamUrl: data.streamUrl,
                kind: isHlsUrl(data.streamUrl) ? 'hls' : 'mp4',
                qualityLabel: 'Custom Proxy',
                provider: 'Custom',
                isFallbackStream: false,
              },
            ]
          } else {
            const resolved = await resolveYouTubeStreams(
              ytVideoId,
              presenterState.mediaTitle,
            )
            if (cancelled) return
            candidatesRef.current = resolved.candidates
            if (resolved.relatedVideos.length > 0) {
              setRelatedVideos(resolved.relatedVideos)
            }
          }
        } catch {
          if (cancelled) return
          // Even if a custom endpoint failed, fall back to resolveYouTubeStreams
          const resolved = await resolveYouTubeStreams(
            ytVideoId,
            presenterState.mediaTitle,
          )
          if (cancelled) return
          candidatesRef.current = resolved.candidates
        }
        if (cancelled) return
        setIsResolvingMedia(false)
        sourceAttached = true
        applyCandidate(0)
        return
      }

      if (peerTubeRef) {
        setIsResolvingMedia(true)
        try {
          const resolved = await resolvePeerTubeStreams(peerTubeRef)
          if (cancelled) return
          candidatesRef.current = resolved.candidates
        } catch (err) {
          if (!cancelled) {
            setIsResolvingMedia(false)
            setMediaError(
              err instanceof Error
                ? `Open Web stream error: ${err.message}`
                : 'Unable to resolve Open Web video stream.',
            )
          }
          return
        }
        if (cancelled) return
        setIsResolvingMedia(false)
        sourceAttached = true
        applyCandidate(0)
        return
      }

      // Standard direct MP4 or HLS .m3u8 URL
      setIsResolvingMedia(false)
      candidatesRef.current = [
        {
          streamUrl: rawUrl,
          kind: isHlsUrl(rawUrl) ? 'hls' : 'mp4',
          qualityLabel: isHlsUrl(rawUrl) ? 'Adaptive HLS' : 'Direct MP4',
          provider: 'Direct',
        },
      ]
      sourceAttached = true
      applyCandidate(0)
    }

    void attachMedia()

    return () => {
      cancelled = true
      clearCandidateWatchdog()
      attachCandidateRef.current = null
      if (!sourceAttached) {
        loadedSourceKeyRef.current = ''
      }
    }
  }, [
    clearCandidateWatchdog,
    clearCompanionAudio,
    companionAudioElement,
    destroyHls,
    inVR,
    isLocalPresenter,
    localScreenStream,
    presenterState.activePresenterId,
    presenterState.mediaTitle,
    presenterState.mediaUrl,
    presenterState.screenMode,
    presenterState.useCorsProxy,
    remoteScreenStreams,
    videoElement,
  ])

  const lastSyncedRevisionRef = useRef<number>(-1)

  // Synchronize Play/Pause & Clock-Skew-Free Drift Correction in Mode 2
  useEffect(() => {
    if (
      presenterState.screenMode !== 'url-sync' ||
      !presenterState.activePresenterId ||
      isResolvingMedia ||
      isNesMediaUrl(presenterState.mediaUrl) ||
      isAdventureMediaUrl(presenterState.mediaUrl)
    ) {
      return
    }

    const revisionChanged =
      lastSyncedRevisionRef.current !== presenterState.revision
    lastSyncedRevisionRef.current = presenterState.revision

    // Measure elapsed time strictly via local monotonic performance.now() since packet receipt
    // so cross-device wall-clock skew (PC vs. Quest headset) never triggers 2s seek thrashing.
    const elapsedSec =
      presenterState.isPlaying && typeof presenterState.receivedAtPerfMs === 'number'
        ? Math.max(0, (performance.now() - presenterState.receivedAtPerfMs) / 1000)
        : 0
    const rawTargetTime = Math.max(0, presenterState.currentTime + elapsedSec)
    const targetTime =
      Number.isFinite(videoElement.duration) && videoElement.duration > 0.5
        ? Math.min(rawTargetTime, Math.max(0, videoElement.duration - 0.25))
        : rawTargetTime

    // Local presenter only seeks its own <video> on explicit revision jumps (e.g. scrubber seek),
    // never on its own periodic progress heartbeats. Viewers allow 1.75s steady jitter tolerance.
    const driftThreshold = revisionChanged ? 0.65 : 1.75
    const shouldSeek =
      (!isLocalPresenter || revisionChanged) &&
      videoElement.readyState >= 1 &&
      Number.isFinite(targetTime) &&
      Math.abs(videoElement.currentTime - targetTime) > driftThreshold

    if (shouldSeek) {
      try {
        videoElement.currentTime = targetTime
        if (hasCompanionAudioRef.current) {
          companionAudioElement.currentTime = targetTime
        }
      } catch {
        // Ignore seek before metadata loaded
      }
    }

    if (presenterState.isPlaying) {
      if (videoElement.paused) {
        void videoElement.play().catch(() => {
          videoElement.muted = true
          companionAudioElement.muted = true
          setNeedsAudioUnlock(true)
          void videoElement.play().catch(() => undefined)
        })
      }
      if (hasCompanionAudioRef.current && companionAudioElement.paused) {
        void companionAudioElement.play().catch(() => undefined)
      }
    } else {
      if (!videoElement.paused) {
        videoElement.pause()
      }
      if (hasCompanionAudioRef.current && !companionAudioElement.paused) {
        companionAudioElement.pause()
      }
    }
  }, [
    companionAudioElement,
    isLocalPresenter,
    isResolvingMedia,
    presenterState.activePresenterId,
    presenterState.currentTime,
    presenterState.isPlaying,
    presenterState.mediaUrl,
    presenterState.receivedAtPerfMs,
    presenterState.revision,
    presenterState.screenMode,
    videoElement,
  ])

  // Video element DOM events, companion audio lip-sync & presenter 2s drift heartbeat
  useEffect(() => {
    const onLoadedData = () => {
      clearCandidateWatchdog()
      setHasVideoFrames(true)
      videoTexture.needsUpdate = true
      setLocalDuration(Number.isFinite(videoElement.duration) ? videoElement.duration : 0)
      const { currentTime, isPlaying } = latestPlaybackRef.current
      if (
        presenterState.screenMode === 'url-sync' &&
        !isNesMediaUrl(presenterState.mediaUrl) &&
        !isAdventureMediaUrl(presenterState.mediaUrl) &&
        currentTime > 0.5 &&
        Math.abs(videoElement.currentTime - currentTime) > 0.75
      ) {
        try {
          const safeTarget =
            Number.isFinite(videoElement.duration) && videoElement.duration > 0.5
              ? Math.min(currentTime, Math.max(0, videoElement.duration - 0.25))
              : currentTime
          videoElement.currentTime = safeTarget
          if (hasCompanionAudioRef.current) {
            companionAudioElement.currentTime = safeTarget
          }
        } catch {
          // Ignore
        }
      }
      if (presenterState.screenMode === 'url-sync' && isPlaying && videoElement.paused) {
        void videoElement.play().catch(() => {
          videoElement.muted = true
          companionAudioElement.muted = true
          setNeedsAudioUnlock(true)
          void videoElement.play().catch(() => undefined)
        })
      }
    }

    const onPlay = () => {
      if (hasCompanionAudioRef.current) {
        if (Math.abs(companionAudioElement.currentTime - videoElement.currentTime) > 0.28) {
          try {
            companionAudioElement.currentTime = videoElement.currentTime
          } catch {
            // Ignore
          }
        }
        void companionAudioElement.play().catch(() => undefined)
      }
    }

    const onWaiting = () => {
      if (hasCompanionAudioRef.current && !companionAudioElement.paused) {
        companionAudioElement.pause()
      }
    }

    const onPlaying = () => {
      videoTexture.needsUpdate = true
      if (hasCompanionAudioRef.current && !videoElement.paused) {
        if (Math.abs(companionAudioElement.currentTime - videoElement.currentTime) > 0.25) {
          try {
            companionAudioElement.currentTime = videoElement.currentTime
          } catch {
            // Ignore
          }
        }
        if (companionAudioElement.paused) {
          void companionAudioElement.play().catch(() => undefined)
        }
      }
    }

    const onPause = () => {
      if (hasCompanionAudioRef.current && !companionAudioElement.paused) {
        companionAudioElement.pause()
      }
    }

    const onSeeking = () => {
      videoTexture.needsUpdate = true
      if (hasCompanionAudioRef.current) {
        try {
          companionAudioElement.currentTime = videoElement.currentTime
        } catch {
          // Ignore
        }
      }
    }

    const onCompanionAudioError = () => {
      if (!hasCompanionAudioRef.current) return
      hasCompanionAudioRef.current = false
      const nextIdx = candidateIndexRef.current + 1
      if (nextIdx < candidatesRef.current.length && attachCandidateRef.current) {
        attachCandidateRef.current(nextIdx)
      }
    }

    let lastReportedTime = -1
    const onTimeUpdate = () => {
      const cur = videoElement.currentTime
      if (cur === 0 || Math.abs(cur - lastReportedTime) >= 0.45) {
        lastReportedTime = cur
        setLocalCurrentTime(cur)
      }
      if (Number.isFinite(videoElement.duration) && videoElement.duration > 0) {
        setLocalDuration((prev) =>
          Math.abs(prev - videoElement.duration) < 0.05 ? prev : videoElement.duration,
        )
      }
      if (
        hasCompanionAudioRef.current &&
        !videoElement.paused &&
        companionAudioElement.readyState >= 2 &&
        Math.abs(companionAudioElement.currentTime - videoElement.currentTime) > 0.3
      ) {
        try {
          companionAudioElement.currentTime = videoElement.currentTime
        } catch {
          // Ignore
        }
      }
    }

    const onError = () => {
      if (
        presenterState.screenMode !== 'url-sync' ||
        isNesMediaUrl(presenterState.mediaUrl) ||
        isAdventureMediaUrl(presenterState.mediaUrl)
      ) {
        return
      }
      clearCandidateWatchdog()

      // Try next resolved stream candidate first!
      const nextIdx = candidateIndexRef.current + 1
      if (nextIdx < candidatesRef.current.length && attachCandidateRef.current) {
        attachCandidateRef.current(nextIdx)
        return
      }

      const currentCandidate = candidatesRef.current[candidateIndexRef.current]
      const targetStreamUrl = currentCandidate?.streamUrl || presenterState.mediaUrl.trim()

      if (
        isLocalStreamProxyAvailable() &&
        targetStreamUrl &&
        autoProxiedUrlRef.current !== targetStreamUrl &&
        !presenterState.useCorsProxy
      ) {
        autoProxiedUrlRef.current = targetStreamUrl
        videoElement.src = resolvePlayableStreamUrl(targetStreamUrl, true, true)
        videoElement.load()
        return
      }

      if (activeYouTubeVideoIdRef.current) {
        setYoutubeEmbedVideoId(activeYouTubeVideoIdRef.current)
        setHasVideoFrames(true)
        setMediaError(null)
        return
      }

      setMediaError(
        'Unable to decode or fetch video stream with WebGL CORS headers. Try another video or Open Web stream.',
      )
    }

    videoElement.addEventListener('loadeddata', onLoadedData)
    videoElement.addEventListener('loadedmetadata', onLoadedData)
    videoElement.addEventListener('play', onPlay)
    videoElement.addEventListener('waiting', onWaiting)
    videoElement.addEventListener('playing', onPlaying)
    videoElement.addEventListener('pause', onPause)
    videoElement.addEventListener('seeking', onSeeking)
    videoElement.addEventListener('timeupdate', onTimeUpdate)
    videoElement.addEventListener('error', onError)
    companionAudioElement.addEventListener('error', onCompanionAudioError)

    const heartbeat = window.setInterval(() => {
      const currentCandidate = candidatesRef.current[candidateIndexRef.current]
      const isYoutubeFallbackClip =
        Boolean(currentCandidate?.isFallbackStream) &&
        Boolean(activeYouTubeVideoIdRef.current)

      if (
        isLocalPresenter &&
        presenterState.screenMode === 'url-sync' &&
        !isNesMediaUrl(presenterState.mediaUrl) &&
        !isAdventureMediaUrl(presenterState.mediaUrl) &&
        !isYoutubeFallbackClip &&
        !videoElement.paused &&
        videoElement.readyState >= 2
      ) {
        progressCallbackRef.current?.(
          videoElement.currentTime,
          Number.isFinite(videoElement.duration) ? videoElement.duration : 0,
        )
      }
    }, 2000)

    return () => {
      window.clearInterval(heartbeat)
      videoElement.removeEventListener('loadeddata', onLoadedData)
      videoElement.removeEventListener('loadedmetadata', onLoadedData)
      videoElement.removeEventListener('play', onPlay)
      videoElement.removeEventListener('waiting', onWaiting)
      videoElement.removeEventListener('playing', onPlaying)
      videoElement.removeEventListener('pause', onPause)
      videoElement.removeEventListener('seeking', onSeeking)
      videoElement.removeEventListener('timeupdate', onTimeUpdate)
      videoElement.removeEventListener('error', onError)
      companionAudioElement.removeEventListener('error', onCompanionAudioError)
    }
  }, [
    clearCandidateWatchdog,
    companionAudioElement,
    isLocalPresenter,
    presenterState.mediaUrl,
    presenterState.screenMode,
    presenterState.useCorsProxy,
    videoElement,
    videoTexture,
  ])

  const unlockAudio = useCallback(() => {
    setNeedsAudioUnlock(false)
    const muteSelfTabLoopback =
      presenterState.screenMode === 'tab-stream' && isLocalPresenter
    const muteFor2DYouTubeEmbed = Boolean(youtubeEmbedVideoId && !inVR)
    const muted = muteSelfTabLoopback || muteFor2DYouTubeEmbed || cinemaVolume <= 0.001
    const vol =
      muteSelfTabLoopback || muteFor2DYouTubeEmbed
        ? 0
        : Math.max(0, Math.min(1, cinemaVolume))
    videoElement.muted = muted
    videoElement.volume = vol
    companionAudioElement.muted = muted
    companionAudioElement.volume = vol
    if (presenterState.isPlaying || presenterState.screenMode === 'tab-stream') {
      void videoElement.play().catch(() => undefined)
      if (hasCompanionAudioRef.current) {
        void companionAudioElement.play().catch(() => undefined)
      }
    }
  }, [
    cinemaVolume,
    companionAudioElement,
    inVR,
    isLocalPresenter,
    presenterState.isPlaying,
    presenterState.screenMode,
    videoElement,
    youtubeEmbedVideoId,
  ])

  const seekLocalVideo = useCallback(
    (timeSeconds: number) => {
      const clamped = Math.max(0, timeSeconds)
      try {
        videoElement.currentTime = clamped
        if (hasCompanionAudioRef.current) {
          companionAudioElement.currentTime = clamped
        }
        setLocalCurrentTime(clamped)
      } catch {
        // Ignore
      }
    },
    [companionAudioElement, videoElement],
  )

  const dismissYouTubeEmbed = useCallback(() => {
    setYoutubeEmbedVideoId(null)
  }, [])

  const openYouTubeEmbed = useCallback(() => {
    if (activeYouTubeVideoIdRef.current) {
      setYoutubeEmbedVideoId(activeYouTubeVideoIdRef.current)
    }
  }, [])

  useEffect(() => {
    return () => {
      clearCandidateWatchdog()
      destroyHls()
      clearCompanionAudio()
      videoElement.pause()
      videoElement.srcObject = null
      videoElement.removeAttribute('src')
    }
  }, [clearCandidateWatchdog, clearCompanionAudio, destroyHls, videoElement])

  const isNesStreamActive =
    presenterState.screenMode === 'url-sync' &&
    Boolean(presenterState.activePresenterId) &&
    isNesMediaUrl(presenterState.mediaUrl)

  const isAdventureStreamActive =
    presenterState.screenMode === 'url-sync' &&
    Boolean(presenterState.activePresenterId) &&
    isAdventureMediaUrl(presenterState.mediaUrl)

  // Automatically resume active video/audio or NES PAPU audio when a VR headset wakes up
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      videoTexture.needsUpdate = true
      if (isNesStreamActive) {
        getNesEmulator().wakeAudioAndTexture()
        return
      }
      if (isAdventureStreamActive) {
        getCinemaQuestCanvas().texture.needsUpdate = true
        return
      }
      const { isPlaying } = latestPlaybackRef.current
      if (
        presenterState.activePresenterId &&
        (presenterState.screenMode === 'tab-stream' || isPlaying) &&
        videoElement.paused
      ) {
        void videoElement.play().catch(() => undefined)
        if (hasCompanionAudioRef.current && companionAudioElement.paused) {
          void companionAudioElement.play().catch(() => undefined)
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => document.removeEventListener('visibilitychange', onVisibilityChange)
  }, [
    companionAudioElement,
    isAdventureStreamActive,
    isNesStreamActive,
    presenterState.activePresenterId,
    presenterState.screenMode,
    videoElement,
    videoTexture,
  ])

  const isInteractiveCanvasStream = isNesStreamActive || isAdventureStreamActive

  return {
    videoElement,
    videoTexture: isNesStreamActive
      ? (getNesEmulator().texture as unknown as THREE.VideoTexture)
      : isAdventureStreamActive
        ? (getCinemaQuestCanvas().texture as unknown as THREE.VideoTexture)
        : videoTexture,
    hasVideoFrames: isInteractiveCanvasStream
      ? true
      : Boolean(youtubeEmbedVideoId) || hasVideoFrames,
    isResolvingMedia: isInteractiveCanvasStream ? false : isResolvingMedia,
    activeStreamQuality: isNesStreamActive
      ? '60fps JSNES Hardware'
      : isAdventureStreamActive
        ? '1080p Story Quest Engine'
        : activeStreamQuality,
    relatedVideos,
    localCurrentTime,
    localDuration,
    mediaError: isInteractiveCanvasStream ? null : mediaError,
    needsAudioUnlock: isInteractiveCanvasStream
      ? false
      : Boolean(youtubeEmbedVideoId && !inVR)
        ? false
        : needsAudioUnlock,
    youtubeEmbedVideoId: isInteractiveCanvasStream ? null : youtubeEmbedVideoId,
    dismissYouTubeEmbed,
    openYouTubeEmbed,
    unlockAudio,
    seekLocalVideo,
  }
}
