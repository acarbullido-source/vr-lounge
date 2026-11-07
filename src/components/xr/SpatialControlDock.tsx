import { RoundedBox, Text } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { QUICK_REACTIONS } from '../../constants/cinema'
import { FREE_ROAM_SEAT_ID } from '../../constants/hangout'
import type { PresenterState } from '../../types/lounge'
import { VRKeyboard3D, type VRKeyboardMode } from './VRKeyboard3D'

function formatClock(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) return '0:00'
  const total = Math.floor(sec)
  const mins = Math.floor(total / 60)
  const rem = total % 60
  return `${mins}:${rem.toString().padStart(2, '0')}`
}

interface DockButtonProps {
  label: string
  sublabel?: string
  position: [number, number, number]
  width?: number
  height?: number
  variant?: 'default' | 'primary' | 'danger' | 'active'
  disabled?: boolean
  onClick: () => void
}

function DockButton({
  label,
  sublabel,
  position,
  width = 0.25,
  height = 0.11,
  variant = 'default',
  disabled = false,
  onClick,
}: DockButtonProps) {
  const [hovered, setHovered] = useState(false)

  const bgColor = disabled
    ? '#131720'
    : variant === 'primary'
      ? hovered
        ? '#F2BE5C'
        : '#E5A93C'
      : variant === 'active'
        ? hovered
          ? '#34425A'
          : '#273347'
        : variant === 'danger'
          ? hovered
            ? '#EA6B58'
            : '#E05A47'
          : hovered
            ? '#263042'
            : '#181E2A'

  const textColor = disabled
    ? '#525866'
    : variant === 'primary'
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
      <RoundedBox args={[width, height, 0.018]} radius={0.022} smoothness={3}>
        <meshBasicMaterial color={bgColor} />
      </RoundedBox>
      <Text
        position={[0, sublabel ? 0.014 : 0, 0.012]}
        fontSize={0.029}
        color={textColor}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      {sublabel && (
        <Text
          position={[0, -0.024, 0.012]}
          fontSize={0.02}
          color={variant === 'primary' ? '#1E2430' : '#9CA3AF'}
          anchorX="center"
          anchorY="middle"
        >
          {sublabel}
        </Text>
      )}
    </group>
  )
}

export interface SpatialControlDockProps {
  presenterState: PresenterState
  isLocalPresenter: boolean
  canTakeControl: boolean
  isMuted: boolean
  cinemaVolume: number
  voiceVolume: number
  localCurrentTime: number
  localDuration: number
  chatPanelOpen: boolean
  youtubeBrowserOpen: boolean
  buildModeOpen: boolean
  wardrobeOpen?: boolean
  youtubeSearchQuery: string
  posterInitialValue?: string
  keyboardMode: VRKeyboardMode | null
  onSetKeyboardMode: (mode: VRKeyboardMode | null) => void
  onToggleYouTubeBrowser: () => void
  onToggleBuildMode: () => void
  onToggleWardrobe?: () => void
  onSubmitYouTubeSearch: (query: string) => void
  onSubmitPosterValue?: (val: string) => void
  onTakeControl: () => void
  onReleaseControl: () => void
  onTogglePlayPause: () => void
  onSeekRelative: (deltaSec: number) => void
  onSeekFraction: (fraction: number) => void
  onSelectStreamUrl: (url: string, title?: string) => void
  onStartTabShare: () => void
  onToggleMute: () => void
  onChangeCinemaVolume: (next: number) => void
  onChangeVoiceVolume: (next: number) => void
  onSendReaction: (emoji: string) => void
  onSendChatMessage: (text: string) => void
  onToggleChatPanel: () => void
  onRecenterSeat: () => void
  localSeatId?: string
  onSelectSeat?: (seatId: string) => void
  atGameStation?: boolean
  isFreeRoaming?: boolean
  dockSummonToggleVersion?: number
}

export function SpatialControlDock({
  presenterState,
  isLocalPresenter,
  canTakeControl,
  isMuted,
  cinemaVolume,
  voiceVolume,
  localCurrentTime,
  localDuration,
  chatPanelOpen,
  youtubeBrowserOpen,
  buildModeOpen,
  wardrobeOpen = false,
  youtubeSearchQuery,
  posterInitialValue = '',
  keyboardMode,
  onSetKeyboardMode,
  onToggleYouTubeBrowser,
  onToggleBuildMode,
  onToggleWardrobe,
  onSubmitYouTubeSearch,
  onSubmitPosterValue,
  onTakeControl,
  onReleaseControl,
  onTogglePlayPause,
  onSeekRelative,
  onSeekFraction,
  onSelectStreamUrl,
  onStartTabShare,
  onToggleMute,
  onChangeCinemaVolume,
  onChangeVoiceVolume,
  onSendReaction,
  onSendChatMessage,
  onToggleChatPanel,
  onRecenterSeat,
  localSeatId,
  onSelectSeat,
  atGameStation = false,
  isFreeRoaming = false,
  dockSummonToggleVersion = 0,
}: SpatialControlDockProps) {
  const [minimized, setMinimized] = useState(() => Boolean(isFreeRoaming))
  const prevRoamingRef = useRef(isFreeRoaming)
  const prevSummonVersionRef = useRef(dockSummonToggleVersion)

  // Auto-collapse console into a compact waist pill when starting to walk around,
  // and auto-restore when sitting back down on a lounge chair
  useEffect(() => {
    if (isFreeRoaming && !prevRoamingRef.current) {
      setMinimized(true)
    } else if (!isFreeRoaming && prevRoamingRef.current && !atGameStation) {
      setMinimized(false)
    }
    prevRoamingRef.current = isFreeRoaming
  }, [atGameStation, isFreeRoaming])

  // Quest B/Y button toggles the floating controls dock open/closed from anywhere
  useEffect(() => {
    if (dockSummonToggleVersion !== prevSummonVersionRef.current) {
      prevSummonVersionRef.current = dockSummonToggleVersion
      setMinimized((v) => !v)
    }
  }, [dockSummonToggleVersion])

  const progressRatio =
    localDuration > 0 ? Math.max(0, Math.min(1, localCurrentTime / localDuration)) : 0

  if (minimized) {
    return (
      <group
        position={
          isFreeRoaming
            ? [0, 0.72, -0.56]
            : atGameStation
              ? [-0.52, 0.62, -0.45]
              : [0, 0.72, -0.68]
        }
        rotation={atGameStation && !isFreeRoaming ? [-0.42, 0.28, 0] : [-0.45, 0, 0]}
      >
        <DockButton
          label={isFreeRoaming ? '🚶 Walking · Controls ▲' : 'Open Lounge Controls ▲'}
          sublabel={isFreeRoaming ? 'Tap or press B/Y' : undefined}
          position={[0, 0, 0]}
          width={0.48}
          height={isFreeRoaming ? 0.098 : 0.09}
          variant="active"
          onClick={() => setMinimized(false)}
        />
      </group>
    )
  }

  return (
    <group
      name="spatial-control-dock"
      position={
        isFreeRoaming
          ? [0, 0.92, -0.66]
          : atGameStation
            ? [-0.64, 0.62, -0.46]
            : [0, 0.76, -0.72]
      }
      rotation={
        isFreeRoaming
          ? [-0.32, 0, 0]
          : atGameStation
            ? [-0.42, 0.32, 0]
            : [-0.46, 0, 0]
      }
      scale={isFreeRoaming ? 0.82 : atGameStation ? 0.74 : 1}
    >
      {/* Floating 3D Virtual Keyboard above dock when active */}
      {keyboardMode && (
        <group position={[0, 0.68, 0.08]} rotation={[0.24, 0, 0]}>
          <VRKeyboard3D
            mode={keyboardMode}
            initialValue={
              keyboardMode === 'url'
                ? presenterState.mediaUrl
                : keyboardMode === 'youtube'
                  ? youtubeSearchQuery
                  : keyboardMode === 'poster'
                    ? posterInitialValue
                    : ''
            }
            onSubmitUrl={(url, title) => {
              onSelectStreamUrl(url, title)
              onSetKeyboardMode(null)
            }}
            onSubmitChat={(msg) => {
              onSendChatMessage(msg)
              onSetKeyboardMode(null)
            }}
            onSubmitYouTubeSearch={(query) => {
              onSubmitYouTubeSearch(query)
              onSetKeyboardMode(null)
            }}
            onSubmitPosterValue={(val) => {
              onSubmitPosterValue?.(val)
              onSetKeyboardMode(null)
            }}
            onClose={() => onSetKeyboardMode(null)}
          />
        </group>
      )}

      {/* Angled Brushed Console Chassis */}
      <RoundedBox args={[1.28, 0.5, 0.026]} radius={0.036} smoothness={3}>
        <meshStandardMaterial color="#0D1118" roughness={0.58} metalness={0.32} />
      </RoundedBox>

      {/* Top Amber Accent Hairline */}
      <mesh position={[0, 0.244, 0.015]}>
        <boxGeometry args={[1.18, 0.005, 0.004]} />
        <meshBasicMaterial color="#E5A93C" />
      </mesh>

      {/* Top Row: Presenter Control Handoff + YouTube VR Deck + Source Switchers + Build + Avatar + Minimize */}
      <DockButton
        label={isLocalPresenter ? 'Release' : 'Control'}
        sublabel={
          isLocalPresenter
            ? 'Presenting'
            : presenterState.presenterName
              ? `${presenterState.presenterName.slice(0, 9)}`
              : 'Claim screen'
        }
        position={[-0.505, 0.165, 0.016]}
        width={0.185}
        variant={isLocalPresenter ? 'active' : 'primary'}
        disabled={!isLocalPresenter && !canTakeControl}
        onClick={isLocalPresenter ? onReleaseControl : onTakeControl}
      />

      <DockButton
        label="▶ YouTube"
        sublabel="VR Browse"
        position={[-0.305, 0.165, 0.016]}
        width={0.185}
        variant={youtubeBrowserOpen ? 'primary' : 'danger'}
        onClick={onToggleYouTubeBrowser}
      />

      <DockButton
        label="URL / HLS"
        sublabel="Direct Link"
        position={[-0.115, 0.165, 0.016]}
        width={0.165}
        variant={keyboardMode === 'url' ? 'primary' : 'default'}
        onClick={() => {
          if (!isLocalPresenter && canTakeControl) {
            onTakeControl()
          }
          onSetKeyboardMode(keyboardMode === 'url' ? null : 'url')
        }}
      />

      <DockButton
        label="Share Tab"
        sublabel="PC WebRTC"
        position={[0.06, 0.165, 0.016]}
        width={0.155}
        variant={presenterState.screenMode === 'tab-stream' && isLocalPresenter ? 'primary' : 'default'}
        onClick={onStartTabShare}
      />

      <DockButton
        label={buildModeOpen ? '🛠 Done' : '🛠 Build'}
        sublabel="Room"
        position={[0.23, 0.165, 0.016]}
        width={0.155}
        variant={buildModeOpen ? 'primary' : 'active'}
        onClick={onToggleBuildMode}
      />

      <DockButton
        label={wardrobeOpen ? '👤 Done' : '👤 Avatar'}
        sublabel="3D Mirror"
        position={[0.4, 0.165, 0.016]}
        width={0.155}
        variant={wardrobeOpen ? 'primary' : 'active'}
        onClick={() => onToggleWardrobe?.()}
      />

      <DockButton
        label="Hide ▾"
        position={[0.548, 0.165, 0.016]}
        width={0.11}
        onClick={() => setMinimized(true)}
      />

      {/* Second Row: Playback Transport & Interactive Timeline Scrub Bar */}
      <DockButton
        label={presenterState.isPlaying ? 'Pause ❚❚' : 'Play ▶'}
        position={[-0.48, 0.035, 0.016]}
        width={0.23}
        height={0.092}
        variant={isLocalPresenter ? 'primary' : 'default'}
        disabled={!isLocalPresenter || presenterState.screenMode !== 'url-sync'}
        onClick={onTogglePlayPause}
      />

      <DockButton
        label="-15s"
        position={[-0.29, 0.035, 0.016]}
        width={0.11}
        height={0.092}
        disabled={!isLocalPresenter || presenterState.screenMode !== 'url-sync'}
        onClick={() => onSeekRelative(-15)}
      />

      <DockButton
        label="+15s"
        position={[-0.16, 0.035, 0.016]}
        width={0.11}
        height={0.092}
        disabled={!isLocalPresenter || presenterState.screenMode !== 'url-sync'}
        onClick={() => onSeekRelative(15)}
      />

      {/* Interactive 3D Scrub Bar */}
      <group
        position={[0.25, 0.035, 0.016]}
        pointerEventsType={{ deny: 'grab' }}
        onClick={(e) => {
          if (!isLocalPresenter || presenterState.screenMode !== 'url-sync') return
          e.stopPropagation()
          const localPt = e.object.worldToLocal(e.point.clone())
          const frac = Math.max(0, Math.min(1, (localPt.x + 0.31) / 0.62))
          onSeekFraction(frac)
        }}
      >
        <RoundedBox args={[0.64, 0.088, 0.012]} radius={0.018} smoothness={2}>
          <meshBasicMaterial color="#131822" />
        </RoundedBox>
        {/* Track groove */}
        <mesh position={[0, -0.014, 0.008]}>
          <planeGeometry args={[0.56, 0.014]} />
          <meshBasicMaterial color="#273142" />
        </mesh>
        {/* Progress fill */}
        <mesh
          position={[-0.28 + (0.56 * progressRatio) / 2, -0.014, 0.01]}
        >
          <planeGeometry args={[Math.max(0.008, 0.56 * progressRatio), 0.014]} />
          <meshBasicMaterial color="#E5A93C" />
        </mesh>
        <Text
          position={[0, 0.016, 0.01]}
          fontSize={0.022}
          color="#C7C2B8"
          anchorX="center"
          anchorY="middle"
        >
          {presenterState.screenMode === 'tab-stream'
            ? 'LIVE WEBRTC STREAM'
            : `${formatClock(localCurrentTime)} / ${formatClock(localDuration)}`}
        </Text>
      </group>

      {/* Third Row: Mic Mute, Cinema vs Voice Audio Mixers, Chat & Recenter Seat */}
      <DockButton
        label={isMuted ? 'Mic Muted' : 'Mic Live'}
        position={[-0.48, -0.09, 0.016]}
        width={0.23}
        height={0.092}
        variant={isMuted ? 'danger' : 'active'}
        onClick={onToggleMute}
      />

      {/* Screen Volume Stepper */}
      <DockButton
        label={`Screen ${Math.round(cinemaVolume * 100)}%`}
        sublabel="Tap to cycle"
        position={[-0.21, -0.09, 0.016]}
        width={0.25}
        height={0.092}
        onClick={() => {
          const next = cinemaVolume >= 0.95 ? 0.25 : Math.min(1, Number((cinemaVolume + 0.25).toFixed(2)))
          onChangeCinemaVolume(next)
        }}
      />

      {/* Spatial Voice Volume Stepper */}
      <DockButton
        label={`Voice ${Math.round(voiceVolume * 100)}%`}
        sublabel="Spatial Gain"
        position={[0.06, -0.09, 0.016]}
        width={0.25}
        height={0.092}
        onClick={() => {
          const next = voiceVolume >= 0.95 ? 0.25 : Math.min(1, Number((voiceVolume + 0.25).toFixed(2)))
          onChangeVoiceVolume(next)
        }}
      />

      {/* Toggle 3D Chat Panel */}
      <DockButton
        label={chatPanelOpen ? 'Chat On' : 'Chat Off'}
        position={[0.3, -0.09, 0.016]}
        width={0.18}
        height={0.092}
        variant={chatPanelOpen ? 'active' : 'default'}
        onClick={onToggleChatPanel}
      />

      {/* Recenter Seat */}
      <DockButton
        label="Recenter"
        sublabel="Seat Align"
        position={[0.5, -0.09, 0.016]}
        width={0.18}
        height={0.092}
        onClick={onRecenterSeat}
      />

      {/* Bottom Row: Quick Floating Emoji Reactions + Chat Compose */}
      <group position={[0, -0.198, 0.016]}>
        {QUICK_REACTIONS.map((emoji, idx) => (
          <DockButton
            key={emoji}
            label={emoji}
            position={[-0.51 + idx * 0.155, 0, 0]}
            width={0.135}
            height={0.074}
            onClick={() => onSendReaction(emoji)}
          />
        ))}
        <DockButton
          label="Type Chat ⌨"
          position={[0.45, 0, 0]}
          width={0.26}
          height={0.074}
          variant={keyboardMode === 'chat' ? 'primary' : 'default'}
          onClick={() => onSetKeyboardMode(keyboardMode === 'chat' ? null : 'chat')}
        />
      </group>

      {/* VR Bar Games, Free-Roam & Lounge Station Quick-Hop Strip */}
      {onSelectSeat && (
        <group position={[0, -0.305, 0.016]}>
          <RoundedBox args={[1.24, 0.088, 0.018]} radius={0.022} smoothness={2}>
            <meshBasicMaterial color="#0A0E15" />
          </RoundedBox>
          <DockButton
            label="🚶 Walk"
            position={[-0.495, 0, 0.008]}
            width={0.185}
            height={0.068}
            variant={localSeatId === FREE_ROAM_SEAT_ID ? 'primary' : 'active'}
            onClick={() => onSelectSeat(FREE_ROAM_SEAT_ID)}
          />
          <DockButton
            label="🛋 Sofa"
            position={[-0.297, 0, 0.008]}
            width={0.185}
            height={0.068}
            variant={
              localSeatId &&
              localSeatId !== FREE_ROAM_SEAT_ID &&
              !localSeatId.startsWith('station:') &&
              !localSeatId.startsWith('game-table:')
                ? 'primary'
                : 'default'
            }
            onClick={() => onSelectSeat('furn-sofa-front:0')}
          />
          <DockButton
            label="🎯 Darts"
            position={[-0.099, 0, 0.008]}
            width={0.185}
            height={0.068}
            variant={localSeatId === 'station:darts-oche' ? 'primary' : 'default'}
            onClick={() => onSelectSeat('station:darts-oche')}
          />
          <DockButton
            label="⛳ Putting"
            position={[0.099, 0, 0.008]}
            width={0.185}
            height={0.068}
            variant={localSeatId === 'station:putting-tee' ? 'primary' : 'default'}
            onClick={() => onSelectSeat('station:putting-tee')}
          />
          <DockButton
            label="🎲 Table"
            position={[0.297, 0, 0.008]}
            width={0.185}
            height={0.068}
            variant={localSeatId?.startsWith('game-table:') ? 'primary' : 'default'}
            onClick={() => onSelectSeat('game-table:seat-0')}
          />
          <DockButton
            label="📋 Props"
            position={[0.495, 0, 0.008]}
            width={0.185}
            height={0.068}
            variant={localSeatId === 'station:chalkboard' ? 'primary' : 'default'}
            onClick={() => onSelectSeat('station:chalkboard')}
          />
        </group>
      )}
    </group>
  )
}
