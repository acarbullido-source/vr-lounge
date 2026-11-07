import Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import type { PresenterState } from '../types/lounge'

function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
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

function isHlsUrl(url: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(url) || url.includes('mpegurl')
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
let sharedVideoTex: THREE.VideoTexture | null = null

function getCinemaScreenMedia(): {
  videoElement: HTMLVideoElement
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
  if (!sharedVideoTex) {
    const tex = new THREE.VideoTexture(sharedVideoEl)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    sharedVideoTex = tex
  }
  return { videoElement: sharedVideoEl, videoTexture: sharedVideoTex }
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
  const { videoElement, videoTexture } = getCinemaScreenMedia()

  const [hasVideoFrames, setHasVideoFrames] = useState(false)
  const [localCurrentTime, setLocalCurrentTime] = useState(0)
  const [localDuration, setLocalDuration] = useState(0)
  const [mediaError, setMediaError] = useState<string | null>(null)
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false)

  const hlsRef = useRef<Hls | null>(null)
  const loadedSourceKeyRef = useRef<string>('')
  const autoProxiedUrlRef = useRef<string>('')
  const progressCallbackRef = useRef(onPresenterProgress)

  useEffect(() => {
    progressCallbackRef.current = onPresenterProgress
  }, [onPresenterProgress])

  const isLocalPresenter = presenterState.activePresenterId === localUserId

  // Route audio output device when supported by Chromium
  useEffect(() => {
    const sinkable = videoElement as HTMLVideoElement & {
      setSinkId?: (sinkId: string) => Promise<void>
    }
    if (selectedSpeakerId && typeof sinkable.setSinkId === 'function') {
      void sinkable.setSinkId(selectedSpeakerId).catch(() => undefined)
    }
  }, [selectedSpeakerId, videoElement])

  // Apply cinema volume (mute local presenter's own tab preview to prevent doubled audio)
  useEffect(() => {
    const muteSelfTabLoopback =
      presenterState.screenMode === 'tab-stream' && isLocalPresenter
    if (muteSelfTabLoopback) {
      videoElement.muted = true
      videoElement.volume = 0
    } else if (!needsAudioUnlock) {
      videoElement.muted = cinemaVolume <= 0.001
      videoElement.volume = Math.max(0, Math.min(1, cinemaVolume))
    }
  }, [
    cinemaVolume,
    isLocalPresenter,
    needsAudioUnlock,
    presenterState.screenMode,
    videoElement,
  ])

  const destroyHls = useCallback(() => {
    if (hlsRef.current) {
      hlsRef.current.destroy()
      hlsRef.current = null
    }
  }, [])

  // Bind Mode 1 (WebRTC MediaStream) vs Mode 2 (MP4 / HLS / Proxied URL)
  useEffect(() => {
    let cancelled = false

    const attachMedia = async () => {
      const mode = presenterState.screenMode
      const activePresenterId = presenterState.activePresenterId

      if (mode === 'idle' || !activePresenterId) {
        destroyHls()
        loadedSourceKeyRef.current = ''
        videoElement.pause()
        videoElement.srcObject = null
        videoElement.removeAttribute('src')
        setHasVideoFrames(false)
        setMediaError(null)
        return
      }

      if (mode === 'tab-stream') {
        destroyHls()
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
          videoElement.removeAttribute('src')
          videoElement.srcObject = targetStream
          videoElement.muted = isLocalPresenter || cinemaVolume <= 0.001
          setMediaError(null)
        }

        try {
          await videoElement.play()
          if (!cancelled) setHasVideoFrames(true)
        } catch {
          // Retry muted to satisfy autoplay policy, then prompt audio unlock
          videoElement.muted = true
          await videoElement.play().catch(() => undefined)
          if (!cancelled) {
            setHasVideoFrames(true)
            if (!isLocalPresenter) setNeedsAudioUnlock(true)
          }
        }
        return
      }

      // Mode 2: Synchronized URL Player
      const rawUrl = presenterState.mediaUrl.trim()
      if (!rawUrl) {
        setHasVideoFrames(false)
        return
      }

      const sourceKey = `url:${rawUrl}:proxy=${presenterState.useCorsProxy}`
      if (loadedSourceKeyRef.current === sourceKey) {
        return
      }
      loadedSourceKeyRef.current = sourceKey
      setMediaError(null)
      setHasVideoFrames(false)
      destroyHls()
      videoElement.srcObject = null

      let effectiveUrl = rawUrl

      if (isYouTubeUrl(rawUrl)) {
        const ytResolver = (
          import.meta.env.VITE_YOUTUBE_PROXY_URL as string | undefined
        )?.trim()
        if (!ytResolver) {
          setMediaError(
            'YouTube embeds restrict WebGL textures via CORS. Click "Share Browser Tab" (Mode 1) to watch YouTube/Netflix together, or configure VITE_YOUTUBE_PROXY_URL.',
          )
          return
        }
        try {
          const resp = await fetch(`${ytResolver}${encodeURIComponent(rawUrl)}`)
          if (!resp.ok) throw new Error(`Resolver HTTP ${resp.status}`)
          const data = (await resp.json()) as { streamUrl?: string }
          if (!data.streamUrl) throw new Error('Resolver returned no streamUrl')
          effectiveUrl = data.streamUrl
        } catch (err) {
          if (!cancelled) {
            setMediaError(
              err instanceof Error
                ? `YouTube resolver failed: ${err.message}`
                : 'Unable to resolve YouTube stream URL',
            )
          }
          return
        }
      }

      const shouldProxy =
        presenterState.useCorsProxy || autoProxiedUrlRef.current === rawUrl
      const finalUrl = shouldProxy
        ? `/api/stream-proxy?url=${encodeURIComponent(effectiveUrl)}`
        : effectiveUrl

      if (isHlsUrl(effectiveUrl)) {
        if (Hls.isSupported()) {
          const hls = new Hls({
            enableWorker: true,
            lowLatencyMode: false,
          })
          hlsRef.current = hls
          hls.loadSource(finalUrl)
          hls.attachMedia(videoElement)
          hls.on(Hls.Events.MANIFEST_PARSED, () => {
            if (cancelled) return
            setHasVideoFrames(true)
            if (presenterState.currentTime > 0.5) {
              videoElement.currentTime = presenterState.currentTime
            }
            if (presenterState.isPlaying) {
              void videoElement.play().catch(() => {
                videoElement.muted = true
                setNeedsAudioUnlock(true)
                void videoElement.play().catch(() => undefined)
              })
            }
          })
          hls.on(Hls.Events.ERROR, (_event, data) => {
            if (cancelled || !data.fatal) return
            if (autoProxiedUrlRef.current !== rawUrl && !presenterState.useCorsProxy) {
              autoProxiedUrlRef.current = rawUrl
              loadedSourceKeyRef.current = ''
              void attachMedia()
              return
            }
            setMediaError(`HLS stream error (${data.details}). Try enabling CORS Proxy or Mode 1 Tab Share.`)
          })
        } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
          videoElement.src = finalUrl
          videoElement.load()
        } else {
          setMediaError('HLS playback is not supported in this browser.')
        }
      } else {
        videoElement.src = finalUrl
        videoElement.load()
      }
    }

    void attachMedia()

    return () => {
      cancelled = true
    }
  }, [
    cinemaVolume,
    destroyHls,
    isLocalPresenter,
    localScreenStream,
    presenterState.activePresenterId,
    presenterState.currentTime,
    presenterState.isPlaying,
    presenterState.mediaUrl,
    presenterState.screenMode,
    presenterState.useCorsProxy,
    remoteScreenStreams,
    videoElement,
  ])

  // Synchronize Play/Pause & Drift Correction (> 0.5s) in Mode 2
  useEffect(() => {
    if (presenterState.screenMode !== 'url-sync' || !presenterState.activePresenterId) {
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
      } catch {
        // Ignore seek before metadata loaded
      }
    }

    if (presenterState.isPlaying) {
      if (videoElement.paused) {
        void videoElement.play().catch(() => {
          videoElement.muted = true
          setNeedsAudioUnlock(true)
          void videoElement.play().catch(() => undefined)
        })
      }
    } else if (!videoElement.paused) {
      videoElement.pause()
    }
  }, [
    presenterState.activePresenterId,
    presenterState.currentTime,
    presenterState.isPlaying,
    presenterState.revision,
    presenterState.screenMode,
    presenterState.updatedAt,
    videoElement,
  ])

  // Video element DOM events & presenter 2s drift heartbeat
  useEffect(() => {
    const onLoadedData = () => {
      setHasVideoFrames(true)
      setLocalDuration(Number.isFinite(videoElement.duration) ? videoElement.duration : 0)
    }
    const onTimeUpdate = () => {
      setLocalCurrentTime(videoElement.currentTime)
      if (Number.isFinite(videoElement.duration) && videoElement.duration > 0) {
        setLocalDuration(videoElement.duration)
      }
    }
    const onError = () => {
      const rawUrl = presenterState.mediaUrl.trim()
      if (
        presenterState.screenMode === 'url-sync' &&
        rawUrl &&
        autoProxiedUrlRef.current !== rawUrl &&
        !presenterState.useCorsProxy
      ) {
        autoProxiedUrlRef.current = rawUrl
        loadedSourceKeyRef.current = ''
        videoElement.src = `/api/stream-proxy?url=${encodeURIComponent(rawUrl)}`
        videoElement.load()
        return
      }
      if (presenterState.screenMode === 'url-sync') {
        setMediaError(
          'Unable to decode or fetch video URL with WebGL CORS headers. Try toggling Proxy or use "Share Browser Tab".',
        )
      }
    }

    videoElement.addEventListener('loadeddata', onLoadedData)
    videoElement.addEventListener('loadedmetadata', onLoadedData)
    videoElement.addEventListener('timeupdate', onTimeUpdate)
    videoElement.addEventListener('error', onError)

    const heartbeat = window.setInterval(() => {
      if (
        isLocalPresenter &&
        presenterState.screenMode === 'url-sync' &&
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
      videoElement.removeEventListener('timeupdate', onTimeUpdate)
      videoElement.removeEventListener('error', onError)
    }
  }, [
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
    videoElement.muted = muteSelfTabLoopback || cinemaVolume <= 0.001
    videoElement.volume = muteSelfTabLoopback
      ? 0
      : Math.max(0, Math.min(1, cinemaVolume))
    if (presenterState.isPlaying || presenterState.screenMode === 'tab-stream') {
      void videoElement.play().catch(() => undefined)
    }
  }, [cinemaVolume, isLocalPresenter, presenterState.isPlaying, presenterState.screenMode, videoElement])

  const seekLocalVideo = useCallback(
    (timeSeconds: number) => {
      const clamped = Math.max(0, timeSeconds)
      try {
        videoElement.currentTime = clamped
        setLocalCurrentTime(clamped)
      } catch {
        // Ignore
      }
    },
    [videoElement],
  )

  useEffect(() => {
    return () => {
      destroyHls()
      videoElement.pause()
      videoElement.srcObject = null
      videoElement.removeAttribute('src')
    }
  }, [destroyHls, videoElement])

  return {
    videoElement,
    videoTexture,
    hasVideoFrames,
    localCurrentTime,
    localDuration,
    mediaError,
    needsAudioUnlock,
    unlockAudio,
    seekLocalVideo,
  }
}
