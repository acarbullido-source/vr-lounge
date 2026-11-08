import type Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
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

  const hlsRef = useRef<Hls | null>(null)
  const loadedSourceKeyRef = useRef<string>('')
  const autoProxiedUrlRef = useRef<string>('')
  const candidatesRef = useRef<ResolvedStreamCandidate[]>([])
  const candidateIndexRef = useRef<number>(0)
  const hasCompanionAudioRef = useRef<boolean>(false)
  const attachCandidateRef = useRef<((index: number) => void) | null>(null)

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
  }, [companionAudioElement])

  // Route audio output device when supported by Chromium
  useEffect(() => {
    const sinkableVideo = videoElement as HTMLVideoElement & {
      setSinkId?: (sinkId: string) => Promise<void>
    }
    const sinkableAudio = companionAudioElement as HTMLAudioElement & {
      setSinkId?: (sinkId: string) => Promise<void>
    }
    if (selectedSpeakerId) {
      if (typeof sinkableVideo.setSinkId === 'function') {
        void sinkableVideo.setSinkId(selectedSpeakerId).catch(() => undefined)
      }
      if (typeof sinkableAudio.setSinkId === 'function') {
        void sinkableAudio.setSinkId(selectedSpeakerId).catch(() => undefined)
      }
    }
  }, [companionAudioElement, selectedSpeakerId, videoElement])

  // Apply cinema volume (mute local presenter's own tab preview to prevent doubled audio)
  useEffect(() => {
    const muteSelfTabLoopback =
      presenterState.screenMode === 'tab-stream' && isLocalPresenter
    if (muteSelfTabLoopback) {
      videoElement.muted = true
      videoElement.volume = 0
      companionAudioElement.muted = true
      companionAudioElement.volume = 0
      getNesEmulator().setMasterVolume(0)
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
    isLocalPresenter,
    needsAudioUnlock,
    presenterState.mediaUrl,
    presenterState.screenMode,
    videoElement,
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
      const candidate = candidatesRef.current[index]
      if (!candidate) return

      candidateIndexRef.current = index
      destroyHls()
      clearCompanionAudio()
      videoElement.srcObject = null
      setMediaError(null)
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
              hls.loadSource(finalUrl)
              hls.attachMedia(videoElement)
              hls.on(HlsCtor.Events.MANIFEST_PARSED, () => {
                if (cancelled) return
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

      if (mode === 'idle' || !activePresenterId) {
        getNesEmulator().setConsumerActive('screen', false)
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
        getNesEmulator().setConsumerActive('screen', false)
        destroyHls()
        clearCompanionAudio()
        candidatesRef.current = []
        setIsResolvingMedia(false)
        setActiveStreamQuality('Live WebRTC Tab')

        const targetStream = isLocalPresenter
          ? localScreenStream
          : remoteScreenStreams[activePresenterId] ?? null

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
        getNesEmulator().setConsumerActive('screen', false)
        setHasVideoFrames(false)
        setIsResolvingMedia(false)
        return
      }

      const sourceKey = `url:${rawUrl}:proxy=${presenterState.useCorsProxy}`
      if (loadedSourceKeyRef.current === sourceKey) {
        sourceAttached = true
        return
      }

      loadedSourceKeyRef.current = sourceKey
      setMediaError(null)
      setHasVideoFrames(false)
      setActiveStreamQuality(null)
      destroyHls()
      clearCompanionAudio()
      videoElement.srcObject = null

      if (isNesMediaUrl(rawUrl)) {
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
              },
            ]
          } else {
            const resolved = await resolveYouTubeStreams(ytVideoId)
            if (cancelled) return
            candidatesRef.current = resolved.candidates
            if (resolved.relatedVideos.length > 0) {
              setRelatedVideos(resolved.relatedVideos)
            }
          }
        } catch (err) {
          if (!cancelled) {
            setIsResolvingMedia(false)
            setMediaError(
              err instanceof Error
                ? `Could not resolve YouTube stream (${err.message}). Try Open Web tab or another video.`
                : 'Unable to resolve YouTube stream right now.',
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
      attachCandidateRef.current = null
      if (!sourceAttached) {
        loadedSourceKeyRef.current = ''
      }
    }
  }, [
    clearCompanionAudio,
    companionAudioElement,
    destroyHls,
    isLocalPresenter,
    localScreenStream,
    presenterState.activePresenterId,
    presenterState.mediaUrl,
    presenterState.screenMode,
    presenterState.useCorsProxy,
    remoteScreenStreams,
    videoElement,
  ])

  // Synchronize Play/Pause & Drift Correction (> 0.5s) in Mode 2
  useEffect(() => {
    if (
      presenterState.screenMode !== 'url-sync' ||
      !presenterState.activePresenterId ||
      isResolvingMedia ||
      isNesMediaUrl(presenterState.mediaUrl)
    ) {
      return
    }

    const elapsedSec = presenterState.isPlaying
      ? Math.max(0, (Date.now() - presenterState.updatedAt) / 1000)
      : 0
    const targetTime = Math.max(0, presenterState.currentTime + elapsedSec)

    if (
      videoElement.readyState >= 1 &&
      Number.isFinite(targetTime) &&
      Math.abs(videoElement.currentTime - targetTime) > 0.5
    ) {
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
    isResolvingMedia,
    presenterState.activePresenterId,
    presenterState.currentTime,
    presenterState.isPlaying,
    presenterState.mediaUrl,
    presenterState.revision,
    presenterState.screenMode,
    presenterState.updatedAt,
    videoElement,
  ])

  // Video element DOM events, companion audio lip-sync & presenter 2s drift heartbeat
  useEffect(() => {
    const onLoadedData = () => {
      setHasVideoFrames(true)
      setLocalDuration(Number.isFinite(videoElement.duration) ? videoElement.duration : 0)
      const { currentTime, isPlaying } = latestPlaybackRef.current
      if (
        presenterState.screenMode === 'url-sync' &&
        !isNesMediaUrl(presenterState.mediaUrl) &&
        currentTime > 0.5 &&
        Math.abs(videoElement.currentTime - currentTime) > 0.6
      ) {
        try {
          videoElement.currentTime = currentTime
          if (hasCompanionAudioRef.current) {
            companionAudioElement.currentTime = currentTime
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

    const onPause = () => {
      if (hasCompanionAudioRef.current && !companionAudioElement.paused) {
        companionAudioElement.pause()
      }
    }

    const onSeeking = () => {
      if (hasCompanionAudioRef.current) {
        try {
          companionAudioElement.currentTime = videoElement.currentTime
        } catch {
          // Ignore
        }
      }
    }

    const onTimeUpdate = () => {
      setLocalCurrentTime(videoElement.currentTime)
      if (Number.isFinite(videoElement.duration) && videoElement.duration > 0) {
        setLocalDuration(videoElement.duration)
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
        isNesMediaUrl(presenterState.mediaUrl)
      ) {
        return
      }

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

      setMediaError(
        'Unable to decode or fetch video stream with WebGL CORS headers. Try another video or Open Web stream.',
      )
    }

    videoElement.addEventListener('loadeddata', onLoadedData)
    videoElement.addEventListener('loadedmetadata', onLoadedData)
    videoElement.addEventListener('play', onPlay)
    videoElement.addEventListener('pause', onPause)
    videoElement.addEventListener('seeking', onSeeking)
    videoElement.addEventListener('timeupdate', onTimeUpdate)
    videoElement.addEventListener('error', onError)

    const heartbeat = window.setInterval(() => {
      if (
        isLocalPresenter &&
        presenterState.screenMode === 'url-sync' &&
        !isNesMediaUrl(presenterState.mediaUrl) &&
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
      videoElement.removeEventListener('pause', onPause)
      videoElement.removeEventListener('seeking', onSeeking)
      videoElement.removeEventListener('timeupdate', onTimeUpdate)
      videoElement.removeEventListener('error', onError)
    }
  }, [
    companionAudioElement,
    isLocalPresenter,
    presenterState.mediaUrl,
    presenterState.screenMode,
    presenterState.useCorsProxy,
    videoElement,
  ])

  const unlockAudio = useCallback(() => {
    setNeedsAudioUnlock(false)
    const muteSelfTabLoopback =
      presenterState.screenMode === 'tab-stream' && isLocalPresenter
    const muted = muteSelfTabLoopback || cinemaVolume <= 0.001
    const vol = muteSelfTabLoopback
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
    isLocalPresenter,
    presenterState.isPlaying,
    presenterState.screenMode,
    videoElement,
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

  useEffect(() => {
    return () => {
      destroyHls()
      clearCompanionAudio()
      videoElement.pause()
      videoElement.srcObject = null
      videoElement.removeAttribute('src')
    }
  }, [clearCompanionAudio, destroyHls, videoElement])

  const isNesStreamActive =
    presenterState.screenMode === 'url-sync' &&
    Boolean(presenterState.activePresenterId) &&
    isNesMediaUrl(presenterState.mediaUrl)

  // Automatically resume active video/audio or NES PAPU audio when a VR headset wakes up
  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState !== 'visible') return
      videoTexture.needsUpdate = true
      if (isNesStreamActive) {
        getNesEmulator().wakeAudioAndTexture()
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
    isNesStreamActive,
    presenterState.activePresenterId,
    presenterState.screenMode,
    videoElement,
    videoTexture,
  ])

  return {
    videoElement,
    videoTexture: isNesStreamActive
      ? (getNesEmulator().texture as unknown as THREE.VideoTexture)
      : videoTexture,
    hasVideoFrames: isNesStreamActive ? true : hasVideoFrames,
    isResolvingMedia: isNesStreamActive ? false : isResolvingMedia,
    activeStreamQuality: isNesStreamActive ? '60fps JSNES Hardware' : activeStreamQuality,
    relatedVideos,
    localCurrentTime,
    localDuration,
    mediaError: isNesStreamActive ? null : mediaError,
    needsAudioUnlock: isNesStreamActive ? false : needsAudioUnlock,
    unlockAudio,
    seekLocalVideo,
  }
}
