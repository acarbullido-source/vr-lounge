import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PresenterState } from '../../types/lounge'

export interface YouTubeEmbedPlayerOverlayProps {
  videoId: string
  presenterState: PresenterState
  cinemaVolume: number
  isLocalPresenter: boolean
  onDismissToWebGL: () => void
  onStartTabShare: () => void
}

type EmbedLayoutMode = 'theater' | 'pip'

export function YouTubeEmbedPlayerOverlay({
  videoId,
  presenterState,
  cinemaVolume,
  isLocalPresenter,
  onDismissToWebGL,
  onStartTabShare,
}: YouTubeEmbedPlayerOverlayProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [layoutMode, setLayoutMode] = useState<EmbedLayoutMode>('theater')
  const [playerReady, setPlayerReady] = useState(false)
  const lastSyncedSeekRef = useRef<number>(0)

  const initialStartSeconds = useMemo(() => {
    const base = Math.max(0, Math.floor(presenterState.currentTime || 0))
    return base > 2 ? base : 0
    // Only compute initial start param when videoId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId])

  const embedSrc = useMemo(() => {
    const origin =
      typeof window !== 'undefined' && window.location.origin
        ? window.location.origin
        : 'https://acarbullido-source.github.io'
    const params = new URLSearchParams({
      autoplay: presenterState.isPlaying ? '1' : '0',
      playsinline: '1',
      enablejsapi: '1',
      rel: '0',
      modestbranding: '1',
      iv_load_policy: '3',
      origin,
    })
    if (initialStartSeconds > 0) {
      params.set('start', String(initialStartSeconds))
    }
    return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`
  }, [initialStartSeconds, presenterState.isPlaying, videoId])

  const sendYouTubeCommand = useCallback((func: string, args: unknown[] = []) => {
    const win = iframeRef.current?.contentWindow
    if (!win) return
    try {
      win.postMessage(
        JSON.stringify({
          event: 'command',
          func,
          args,
        }),
        '*',
      )
    } catch {
      // Ignore cross-origin postMessage errors
    }
  }, [])

  // Subscribe to YouTube IFrame postMessage events (ready + embed restriction error failover)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (
        typeof event.origin === 'string' &&
        !event.origin.includes('youtube.com') &&
        !event.origin.includes('youtube-nocookie.com')
      ) {
        return
      }
      if (typeof event.data !== 'string') return
      try {
        const payload = JSON.parse(event.data) as {
          event?: string
          info?: number | { playerState?: number; currentTime?: number }
        }
        if (payload.event === 'onReady' || payload.event === 'initialDelivery') {
          setPlayerReady(true)
        } else if (payload.event === 'onError') {
          // Error 101 / 150 = video owner disabled embedding on external sites;
          // fall back immediately to the 3D WebGL Open Web HD stream
          onDismissToWebGL()
        }
      } catch {
        // Ignore non-JSON postMessages
      }
    }

    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [onDismissToWebGL])

  const handleIframeLoad = useCallback(() => {
    setPlayerReady(true)
    const win = iframeRef.current?.contentWindow
    if (win) {
      try {
        win.postMessage(JSON.stringify({ event: 'listening', id: 1 }), '*')
      } catch {
        // Ignore
      }
    }
    const volPercent = Math.round(Math.max(0, Math.min(1, cinemaVolume)) * 100)
    if (volPercent <= 0) {
      sendYouTubeCommand('mute')
    } else {
      sendYouTubeCommand('unMute')
      sendYouTubeCommand('setVolume', [volPercent])
    }
    if (presenterState.isPlaying) {
      sendYouTubeCommand('playVideo')
    } else {
      sendYouTubeCommand('pauseVideo')
    }
  }, [cinemaVolume, presenterState.isPlaying, sendYouTubeCommand])

  // Sync Play/Pause & Seek when room presenterState updates
  useEffect(() => {
    if (!playerReady) return
    if (presenterState.isPlaying) {
      sendYouTubeCommand('playVideo')
    } else {
      sendYouTubeCommand('pauseVideo')
    }
    const targetTime = Math.max(0, presenterState.currentTime || 0)
    if (Math.abs(targetTime - lastSyncedSeekRef.current) > 3.5) {
      lastSyncedSeekRef.current = targetTime
      sendYouTubeCommand('seekTo', [Math.floor(targetTime), true])
    }
  }, [
    playerReady,
    presenterState.currentTime,
    presenterState.isPlaying,
    presenterState.revision,
    sendYouTubeCommand,
  ])

  // Sync local Cinema Volume slider with the YouTube IFrame Player
  useEffect(() => {
    if (!playerReady) return
    const volPercent = Math.round(Math.max(0, Math.min(1, cinemaVolume)) * 100)
    if (volPercent <= 0) {
      sendYouTubeCommand('mute')
    } else {
      sendYouTubeCommand('unMute')
      sendYouTubeCommand('setVolume', [volPercent])
    }
  }, [cinemaVolume, playerReady, sendYouTubeCommand])

  const isTheater = layoutMode === 'theater'

  return (
    <div
      id="youtube-official-embed-overlay"
      data-video-id={videoId}
      data-layout-mode={layoutMode}
      className={
        isTheater
          ? 'pointer-events-auto fixed top-14 left-1/2 z-30 w-[92vw] max-w-2xl -translate-x-1/2 rounded-2xl border border-amber-400/40 bg-[#080b11]/95 shadow-[0_20px_60px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-all'
          : 'pointer-events-auto fixed top-16 right-4 z-30 w-80 sm:w-96 rounded-2xl border border-amber-400/40 bg-[#080b11]/95 shadow-[0_16px_45px_rgba(0,0,0,0.85)] backdrop-blur-xl transition-all'
      }
    >
      {/* Header Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="inline-flex h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" />
          <span className="truncate text-xs font-bold text-[#f4f1ea]">
            {presenterState.mediaTitle || 'YouTube Direct Player'}
          </span>
          <span className="hidden rounded-md bg-red-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-red-200 sm:inline-block">
            Official YouTube Stream
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            id="btn-yt-embed-toggle-layout"
            type="button"
            onClick={() =>
              setLayoutMode((prev) => (prev === 'theater' ? 'pip' : 'theater'))
            }
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-amber-400/50 hover:bg-white/10"
            title={
              isTheater
                ? 'Minimize to corner Picture-in-Picture so you can roam the 3D room'
                : 'Expand to centered Cinema Viewport'
            }
          >
            {isTheater ? '↘ Corner PiP' : '⤢ Theater View'}
          </button>

          {isLocalPresenter && (
            <button
              id="btn-yt-embed-share-tab"
              type="button"
              onClick={onStartTabShare}
              className="rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-2 py-1 text-[11px] font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
              title="Beam this browser tab directly into 3D WebXR headsets with full audio"
            >
              📡 Beam Tab to VR
            </button>
          )}

          <button
            id="btn-yt-embed-switch-webgl"
            type="button"
            onClick={onDismissToWebGL}
            className="rounded-lg border border-white/15 bg-white/5 px-2 py-1 text-[11px] font-semibold text-slate-300 transition hover:border-white/30 hover:bg-white/10"
            title="Hide 2D YouTube overlay and use the 3D WebGL screen stream"
          >
            3D Screen Only ✕
          </button>
        </div>
      </div>

      {/* Responsive 16:9 YouTube IFrame Viewport */}
      <div className="relative aspect-video w-full overflow-hidden rounded-b-2xl bg-black">
        <iframe
          ref={iframeRef}
          id="youtube-official-embed-iframe"
          src={embedSrc}
          title={presenterState.mediaTitle || `YouTube Video ${videoId}`}
          onLoad={handleIframeLoad}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="h-full w-full border-0"
        />
      </div>
    </div>
  )
}
