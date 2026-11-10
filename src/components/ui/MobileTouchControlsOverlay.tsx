import { useEffect, useRef, useState } from 'react'
import { getShareableMobileUrl } from '../../services/mobileMode'
import type { LoungeWingId } from '../../types/lounge'

export interface MobileTouchLocomotionInput {
  moveX: number // -1 (left) .. +1 (right)
  moveY: number // -1 (back) .. +1 (forward)
  vertY: number // -1 (descend) .. +1 (ascend)
}

export interface MobileTouchControlsOverlayProps {
  activeLoungeWing: LoungeWingId
  flyMode: boolean
  isMuted: boolean
  effectiveCinemaVolume: number
  touchInputRef: React.MutableRefObject<MobileTouchLocomotionInput>
  onSwitchToPocket2D: () => void
  onToggleFlyMode: () => void
  onDropToFloor: () => void
  onJumpToWing: (wing: LoungeWingId) => void
  onToggleMute: () => void
  onToggleStreamMute: () => void
}

const ROOM_PILLS: ReadonlyArray<{ id: LoungeWingId; label: string }> = [
  { id: 'main-lounge', label: '🎬 Main Theater' },
  { id: 'library', label: '🔥 Quiet Library' },
  { id: 'shooting-range', label: '🎯 Shooting Range' },
  { id: 'outdoor-deck', label: '🏔 Lake Deck' },
  { id: 'command-center', label: '🛰 Control Room' },
  { id: 'game-room', label: '🕹 Game Room' },
  { id: 'boardroom', label: '💼 Boardroom' },
]

export function MobileTouchControlsOverlay({
  activeLoungeWing,
  flyMode,
  isMuted,
  effectiveCinemaVolume,
  touchInputRef,
  onSwitchToPocket2D,
  onToggleFlyMode,
  onDropToFloor,
  onJumpToWing,
  onToggleMute,
  onToggleStreamMute,
}: MobileTouchControlsOverlayProps) {
  const stickBaseRef = useRef<HTMLDivElement>(null)
  const [knobOffset, setKnobOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  })
  const [copiedLink, setCopiedLink] = useState(false)
  const activePointerIdRef = useRef<number | null>(null)

  const maxRadius = 42

  const updateStickFromPoint = (clientX: number, clientY: number) => {
    const base = stickBaseRef.current
    if (!base) return
    const rect = base.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const dx = clientX - cx
    const dy = clientY - cy
    const dist = Math.hypot(dx, dy)
    const clampedDist = Math.min(maxRadius, dist)
    const angle = Math.atan2(dy, dx)
    const kx = dist > 1 ? Math.cos(angle) * clampedDist : 0
    const ky = dist > 1 ? Math.sin(angle) * clampedDist : 0

    setKnobOffset({ x: kx, y: ky })
    touchInputRef.current.moveX = Number((kx / maxRadius).toFixed(3))
    touchInputRef.current.moveY = Number((-ky / maxRadius).toFixed(3))
  }

  const resetStick = () => {
    activePointerIdRef.current = null
    setKnobOffset({ x: 0, y: 0 })
    touchInputRef.current.moveX = 0
    touchInputRef.current.moveY = 0
  }

  useEffect(() => {
    if (!flyMode) {
      touchInputRef.current.vertY = 0
    }
  }, [flyMode, touchInputRef])

  useEffect(() => {
    const touchRef = touchInputRef
    const clearAllTouchInputs = () => {
      activePointerIdRef.current = null
      setKnobOffset({ x: 0, y: 0 })
      touchRef.current.moveX = 0
      touchRef.current.moveY = 0
      touchRef.current.vertY = 0
    }
    window.addEventListener('blur', clearAllTouchInputs)
    document.addEventListener('visibilitychange', clearAllTouchInputs)
    return () => {
      window.removeEventListener('blur', clearAllTouchInputs)
      document.removeEventListener('visibilitychange', clearAllTouchInputs)
      touchRef.current.moveX = 0
      touchRef.current.moveY = 0
      touchRef.current.vertY = 0
    }
  }, [touchInputRef])

  const handleCopyMobileLink = () => {
    const url = getShareableMobileUrl()
    void navigator.clipboard?.writeText(url).catch(() => undefined)
    setCopiedLink(true)
    window.setTimeout(() => setCopiedLink(false), 2000)
  }

  return (
    <div
      id="mobile-3d-touch-hud"
      className="pointer-events-none fixed inset-0 z-40 flex flex-col justify-between p-2.5 select-none"
    >
      {/* Top Bar: Mode Switcher + Room Teleport Strip */}
      <div className="flex flex-col gap-1.5">
        <div className="pointer-events-auto lounge-dock-bar flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-slate-900/80 px-3 py-2 shadow-xl backdrop-blur-xl">
          <button
            id="btn-switch-to-pocket-2d"
            type="button"
            onClick={onSwitchToPocket2D}
            className="lounge-btn flex items-center gap-1.5 rounded-xl bg-[#e5a93c] px-3 py-1.5 text-xs font-bold text-[#090c10] shadow-md shadow-[#e5a93c]/15 active:scale-95"
          >
            <span>📱 Mobile Companion</span>
          </button>

          <div className="flex items-center gap-1.5">
            <button
              id="btn-mobile-3d-mic"
              type="button"
              onClick={onToggleMute}
              className={`lounge-btn rounded-xl px-2.5 py-1.5 text-xs font-semibold ${
                isMuted
                  ? 'border border-red-400/40 bg-red-500/25 text-red-200'
                  : 'border border-emerald-400/40 bg-emerald-500/25 text-emerald-200'
              }`}
            >
              {isMuted ? '🔇 Mic Off' : '🎙 Mic On'}
            </button>
            <button
              id="btn-mobile-3d-stream-mute"
              type="button"
              onClick={onToggleStreamMute}
              className="lounge-btn rounded-xl border border-white/10 bg-zinc-900/85 px-2.5 py-1.5 text-xs font-semibold text-[#f4f1ea] hover:bg-slate-800/85"
            >
              {activeLoungeWing === 'library'
                ? '🔇 Quiet Zone'
                : effectiveCinemaVolume > 0
                  ? '🔊 TV On'
                  : '🔇 TV Off'}
            </button>
            <button
              id="btn-mobile-3d-copy-link"
              type="button"
              onClick={handleCopyMobileLink}
              className="lounge-btn rounded-xl border border-sky-400/35 bg-sky-500/15 px-2.5 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/25"
            >
              {copiedLink ? '✓ Copied' : '🔗 Link'}
            </button>
          </div>
        </div>

        {/* One-Tap Room Teleport Strip */}
        <div className="pointer-events-auto flex items-center gap-1.5 overflow-x-auto rounded-2xl border border-white/10 bg-zinc-900/85 px-2.5 py-1.5 shadow-lg backdrop-blur-xl">
          {ROOM_PILLS.map((rm) => {
            const active = activeLoungeWing === rm.id
            return (
              <button
                key={rm.id}
                type="button"
                onClick={() => onJumpToWing(rm.id)}
                className={`lounge-btn shrink-0 rounded-xl px-2.5 py-1 text-xs font-semibold ${
                  active
                    ? 'bg-[#e5a93c] text-[#090d14] font-bold shadow-sm'
                    : 'border border-white/10 bg-slate-900/80 text-slate-200 hover:bg-slate-800/90'
                }`}
              >
                {rm.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Bottom Controls: Left Virtual Thumbstick + Right Flight/Altitude Pad */}
      <div className="mb-14 flex items-end justify-between px-2">
        {/* Left Virtual Touch Joystick */}
        <div className="pointer-events-auto flex flex-col items-center gap-1">
          <div
            ref={stickBaseRef}
            onPointerDown={(e) => {
              e.stopPropagation()
              try {
                e.currentTarget.setPointerCapture(e.pointerId)
              } catch {
                // Ignore synthetic pointer events
              }
              activePointerIdRef.current = e.pointerId
              updateStickFromPoint(e.clientX, e.clientY)
            }}
            onPointerMove={(e) => {
              if (activePointerIdRef.current !== e.pointerId) return
              updateStickFromPoint(e.clientX, e.clientY)
            }}
            onPointerUp={(e) => {
              if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
                return
              }
              resetStick()
            }}
            onPointerCancel={(e) => {
              if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
                return
              }
              resetStick()
            }}
            onLostPointerCapture={(e) => {
              if (activePointerIdRef.current !== null && activePointerIdRef.current !== e.pointerId) {
                return
              }
              resetStick()
            }}
            style={{ touchAction: 'none' }}
            className="relative flex h-28 w-28 items-center justify-center rounded-full border border-white/15 bg-slate-900/80 shadow-2xl backdrop-blur-xl"
          >
            <div className="pointer-events-none h-12 w-12 rounded-full border border-white/10 bg-white/5" />
            <div
              style={{
                transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
              }}
              className={`pointer-events-none absolute h-11 w-11 rounded-full border-2 shadow-lg transition-colors ${
                flyMode
                  ? 'border-sky-300 bg-sky-400/80'
                  : 'border-[#f2be5c] bg-[#e5a93c]/85'
              }`}
            />
          </div>
          <span className="rounded-full border border-white/10 bg-zinc-900/85 px-2.5 py-0.5 text-[10px] font-semibold text-slate-300 backdrop-blur-md">
            {flyMode ? '🕹 Fly Move · Drag Screen to Look' : '🕹 Walk · Drag Screen to Look'}
          </span>
        </div>

        {/* Right Flight & Vertical Altitude Controls */}
        <div className="pointer-events-auto flex flex-col items-end gap-2">
          <button
            id="btn-mobile-3d-fly-toggle"
            type="button"
            onClick={onToggleFlyMode}
            className={`lounge-btn rounded-2xl border px-3.5 py-2 text-xs font-bold shadow-xl backdrop-blur-xl active:scale-95 ${
              flyMode
                ? 'border-sky-300 bg-sky-500 text-slate-950'
                : 'border-white/15 bg-slate-900/85 text-[#f4f1ea]'
            }`}
          >
            {flyMode ? '🚀 Fly Mode: ON' : '🚀 Fly Mode: OFF'}
          </button>

          {flyMode && (
            <div className="flex items-center gap-1.5">
              <button
                id="btn-mobile-fly-up"
                type="button"
                onPointerDown={() => {
                  touchInputRef.current.vertY = 1
                }}
                onPointerUp={() => {
                  touchInputRef.current.vertY = 0
                }}
                onPointerLeave={() => {
                  touchInputRef.current.vertY = 0
                }}
                onPointerCancel={() => {
                  touchInputRef.current.vertY = 0
                }}
                style={{ touchAction: 'none' }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/50 bg-[#090d14]/90 text-sm font-bold text-sky-200 shadow-lg active:bg-sky-500/40"
              >
                ▲ UP
              </button>
              <button
                id="btn-mobile-fly-down"
                type="button"
                onPointerDown={() => {
                  touchInputRef.current.vertY = -1
                }}
                onPointerUp={() => {
                  touchInputRef.current.vertY = 0
                }}
                onPointerLeave={() => {
                  touchInputRef.current.vertY = 0
                }}
                onPointerCancel={() => {
                  touchInputRef.current.vertY = 0
                }}
                style={{ touchAction: 'none' }}
                className="flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-400/50 bg-[#090d14]/90 text-sm font-bold text-sky-200 shadow-lg active:bg-sky-500/40"
              >
                ▼ DN
              </button>
            </div>
          )}

          <button
            id="btn-mobile-drop-floor"
            type="button"
            onClick={onDropToFloor}
            className="rounded-xl border border-white/15 bg-[#090d14]/85 px-3 py-1.5 text-xs font-semibold text-slate-200 shadow-lg backdrop-blur-md active:scale-95"
          >
            ⬇ Drop to Floor
          </button>
        </div>
      </div>
    </div>
  )
}
