import { RoundedBox, Text } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { QUICK_REACTIONS } from '../../constants/cinema'
import { FREE_ROAM_SEAT_ID } from '../../constants/hangout'
import {
  NES_LIBRARY_CARTRIDGES,
  getNesEmulator,
  isNesMediaUrl,
  parseNesCartridgeIdFromUrl,
} from '../../services/nesEmulator'
import type {
  NesMultiplayerState,
  ParticipantProfile,
  PresenterState,
} from '../../types/lounge'
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
  onPointerDown?: () => void
  onPointerUp?: () => void
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
  onPointerDown,
  onPointerUp,
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
      onPointerOut={() => {
        setHovered(false)
        onPointerUp?.()
      }}
      onPointerDown={(e) => {
        if (disabled || !onPointerDown) return
        e.stopPropagation()
        onPointerDown()
      }}
      onPointerUp={(e) => {
        if (disabled || !onPointerUp) return
        e.stopPropagation()
        onPointerUp()
      }}
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
  nesLibraryOpen?: boolean
  buildModeOpen: boolean
  wardrobeOpen?: boolean
  youtubeSearchQuery: string
  posterInitialValue?: string
  keyboardMode: VRKeyboardMode | null
  onSetKeyboardMode: (mode: VRKeyboardMode | null) => void
  onToggleYouTubeBrowser: () => void
  onToggleNesLibrary?: () => void
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
  flyMode?: boolean
  onToggleFlyMode?: () => void
  onDropToFloor?: () => void
  wristHudHidden?: boolean
  onToggleWristHud?: () => void
  dockSummonToggleVersion?: number
  localUserId?: string
  participants?: ParticipantProfile[]
  nesMultiplayerState?: NesMultiplayerState
  engagedNesSlot?: 1 | 2 | null
  onClaimNesPlayerSlot?: (slot: 1 | 2 | null) => boolean | void
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
  nesLibraryOpen = false,
  buildModeOpen,
  wardrobeOpen = false,
  youtubeSearchQuery,
  posterInitialValue = '',
  keyboardMode,
  onSetKeyboardMode,
  onToggleYouTubeBrowser,
  onToggleNesLibrary,
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
  flyMode = false,
  onToggleFlyMode,
  onDropToFloor,
  wristHudHidden = false,
  onToggleWristHud,
  dockSummonToggleVersion = 0,
  localUserId,
  participants = [],
  nesMultiplayerState,
  engagedNesSlot = null,
  onClaimNesPlayerSlot,
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
          label={
            flyMode
              ? '🚀 Flying · Controls ▲'
              : isFreeRoaming
                ? '🚶 Walking · Controls ▲'
                : 'Open Lounge Controls ▲'
          }
          sublabel={
            flyMode
              ? 'Glance left wrist or press B/Y'
              : isFreeRoaming
                ? 'Tap or press B/Y'
                : undefined
          }
          position={[0, 0, 0]}
          width={0.5}
          height={isFreeRoaming ? 0.098 : 0.09}
          variant={flyMode ? 'primary' : 'active'}
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

      {/* Second Row: Dedicated 3D NES Controller Engagement, Library & Save Deck when NES is Active, or Video Playback Transport */}
      {isNesMediaUrl(presenterState.mediaUrl) ? (
        (() => {
          const activeIds = new Set(participants.map((p) => p.userId))
          const p1Id =
            nesMultiplayerState?.player1Id &&
            (nesMultiplayerState.player1Id === localUserId ||
              activeIds.size === 0 ||
              activeIds.has(nesMultiplayerState.player1Id))
              ? nesMultiplayerState.player1Id
              : null
          const p2Id =
            nesMultiplayerState?.player2Id &&
            (nesMultiplayerState.player2Id === localUserId ||
              activeIds.size === 0 ||
              activeIds.has(nesMultiplayerState.player2Id))
              ? nesMultiplayerState.player2Id
              : null
          const isLocalP1 =
            engagedNesSlot === 1 || (Boolean(localUserId) && p1Id === localUserId)
          const isLocalP2 =
            engagedNesSlot === 2 || (Boolean(localUserId) && p2Id === localUserId)
          const isP1Locked = Boolean(p1Id && p1Id !== localUserId)
          const isP2Locked = Boolean(p2Id && p2Id !== localUserId)

          return (
            <group position={[0, 0.035, 0.016]}>
              {/* Engage / Disengage Player 1 Controllers */}
              <DockButton
                label={
                  isLocalP1
                    ? '🟢 P1 Active'
                    : isP1Locked
                      ? '🔒 P1 Locked'
                      : '🎮 Engage P1'
                }
                sublabel={
                  isLocalP1
                    ? 'Hold R-Grip=Exit'
                    : isP1Locked
                      ? (nesMultiplayerState?.player1Name ?? 'In Use').slice(0, 10)
                      : 'Quest Pad → P1'
                }
                position={[-0.495, 0, 0]}
                width={0.195}
                height={0.092}
                variant={isLocalP1 ? 'primary' : isP1Locked ? 'default' : 'active'}
                disabled={isP1Locked}
                onClick={() => {
                  onClaimNesPlayerSlot?.(isLocalP1 ? null : 1)
                }}
              />

              {/* Engage / Disengage Player 2 Controllers */}
              <DockButton
                label={
                  isLocalP2
                    ? '🟢 P2 Active'
                    : isP2Locked
                      ? '🔒 P2 Locked'
                      : '🎮 Engage P2'
                }
                sublabel={
                  isLocalP2
                    ? 'Hold R-Grip=Exit'
                    : isP2Locked
                      ? (nesMultiplayerState?.player2Name ?? 'In Use').slice(0, 10)
                      : 'Quest Pad → P2'
                }
                position={[-0.285, 0, 0]}
                width={0.195}
                height={0.092}
                variant={isLocalP2 ? 'primary' : isP2Locked ? 'default' : 'active'}
                disabled={isP2Locked}
                onClick={() => {
                  onClaimNesPlayerSlot?.(isLocalP2 ? null : 2)
                }}
              />

              {/* Open 3D VR NES ROM Library (36 Games) */}
              <DockButton
                label={nesLibraryOpen ? '🕹 Hide ROMs' : '🕹 36 ROMs'}
                sublabel="VR Library"
                position={[-0.088, 0, 0]}
                width={0.165}
                height={0.092}
                variant={nesLibraryOpen ? 'primary' : 'danger'}
                onClick={() => {
                  onToggleNesLibrary?.()
                }}
              />

              {/* START */}
              <DockButton
                label="START"
                sublabel="Play/Pause"
                position={[0.072, 0, 0]}
                width={0.118}
                height={0.092}
                variant="primary"
                onPointerDown={() => getNesEmulator().setButtonState('start', true)}
                onPointerUp={() => getNesEmulator().setButtonState('start', false)}
                onClick={() => getNesEmulator().tapButton('start')}
              />

              {/* B & A Action Buttons */}
              <DockButton
                label="B"
                sublabel="Fire/Run"
                position={[0.19, 0, 0]}
                width={0.095}
                height={0.092}
                variant="danger"
                onPointerDown={() => getNesEmulator().setButtonState('b', true)}
                onPointerUp={() => getNesEmulator().setButtonState('b', false)}
                onClick={() => getNesEmulator().tapButton('b')}
              />
              <DockButton
                label="A"
                sublabel="Jump"
                position={[0.295, 0, 0]}
                width={0.095}
                height={0.092}
                variant="danger"
                onPointerDown={() => getNesEmulator().setButtonState('a', true)}
                onPointerUp={() => getNesEmulator().setButtonState('a', false)}
                onClick={() => getNesEmulator().tapButton('a')}
              />

              {/* Save State & Load State */}
              <DockButton
                label="💾 Save"
                sublabel="Slot 1"
                position={[0.41, 0, 0]}
                width={0.112}
                height={0.092}
                variant="active"
                onClick={() => {
                  void getNesEmulator().saveSlot('slot-1')
                }}
              />
              <DockButton
                label="📂 Load"
                sublabel="Resume"
                position={[0.532, 0, 0]}
                width={0.112}
                height={0.092}
                variant="default"
                onClick={() => {
                  void getNesEmulator().resumeMostRecentSave()
                }}
              />
            </group>
          )
        })()
      ) : (
        <>
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
        </>
      )}

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
              !localSeatId.startsWith('game-table:') &&
              !localSeatId.startsWith('wing:')
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

          {/* Clubhouse Expansion Wing Rooms + 36-ROM NES Quick-Hop Strip */}
          <RoundedBox
            args={[1.24, 0.084, 0.018]}
            position={[0, -0.096, 0]}
            radius={0.022}
            smoothness={2}
          >
            <meshBasicMaterial color="#080C13" />
          </RoundedBox>
          <DockButton
            label="💼 Board"
            position={[-0.51, -0.096, 0.008]}
            width={0.158}
            height={0.064}
            variant={localSeatId?.startsWith('wing:boardroom') ? 'primary' : 'default'}
            onClick={() => onSelectSeat('wing:boardroom-head')}
          />
          <DockButton
            label="🔥 Library"
            position={[-0.34, -0.096, 0.008]}
            width={0.158}
            height={0.064}
            variant={localSeatId?.startsWith('wing:library') ? 'primary' : 'default'}
            onClick={() => onSelectSeat('wing:library-chair-1')}
          />
          <DockButton
            label="🕹 Game Rm"
            position={[-0.17, -0.096, 0.008]}
            width={0.158}
            height={0.064}
            variant={localSeatId?.startsWith('wing:gameroom') ? 'primary' : 'default'}
            onClick={() => onSelectSeat('wing:gameroom-holo-1')}
          />
          <DockButton
            label="🎯 Range"
            position={[0, -0.096, 0.008]}
            width={0.158}
            height={0.064}
            variant={localSeatId?.startsWith('wing:shooting') ? 'primary' : 'default'}
            onClick={() => onSelectSeat('wing:shooting-booth-2')}
          />
          <DockButton
            label="🛰 Command"
            position={[0.17, -0.096, 0.008]}
            width={0.158}
            height={0.064}
            variant={localSeatId?.startsWith('wing:command') ? 'primary' : 'default'}
            onClick={() => onSelectSeat('wing:command-seat-1')}
          />
          <DockButton
            label="🏔 Deck"
            position={[0.34, -0.096, 0.008]}
            width={0.158}
            height={0.064}
            variant={localSeatId?.startsWith('wing:deck') ? 'primary' : 'default'}
            onClick={() => onSelectSeat('wing:deck-chair-1')}
          />
          <DockButton
            label={nesLibraryOpen ? '🕹 Hide NES' : '🕹 NES ROMs'}
            position={[0.51, -0.096, 0.008]}
            width={0.158}
            height={0.064}
            variant={
              nesLibraryOpen || isNesMediaUrl(presenterState.mediaUrl)
                ? 'primary'
                : 'danger'
            }
            onClick={() => {
              if (onToggleNesLibrary) {
                onToggleNesLibrary()
                return
              }
              if (!isLocalPresenter && canTakeControl) {
                onTakeControl()
              }
              const currentId = isNesMediaUrl(presenterState.mediaUrl)
                ? parseNesCartridgeIdFromUrl(presenterState.mediaUrl)
                : null
              const currentIdx = currentId
                ? NES_LIBRARY_CARTRIDGES.findIndex((g) => g.id === currentId)
                : -1
              const nextGame =
                currentIdx >= 0
                  ? NES_LIBRARY_CARTRIDGES[(currentIdx + 1) % NES_LIBRARY_CARTRIDGES.length]
                  : NES_LIBRARY_CARTRIDGES[0]
              getNesEmulator().loadLibraryCartridge(nextGame.id)
              onSelectStreamUrl(
                `nes://${nextGame.id}`,
                `🕹 NES: ${nextGame.title}`,
              )
            }}
          />

          {/* 3D Untethered Flight, Floor Recovery & Wrist HUD Toggle Strip */}
          {onToggleFlyMode && (
            <>
              <RoundedBox
                args={[1.24, 0.08, 0.018]}
                position={[0, -0.188, 0]}
                radius={0.022}
                smoothness={2}
              >
                <meshBasicMaterial color="#070A10" />
              </RoundedBox>
              <DockButton
                label={flyMode ? '🚀 Fly Mode: ON' : '🚀 Fly Mode: OFF'}
                sublabel={flyMode ? '3D Free-Flight' : 'Soar Above Lounge'}
                position={[-0.425, -0.188, 0.008]}
                width={0.35}
                height={0.064}
                variant={flyMode ? 'primary' : 'active'}
                onClick={onToggleFlyMode}
              />
              <DockButton
                label="⬇ Drop Floor"
                sublabel="Reset Y = 0"
                position={[-0.095, -0.188, 0.008]}
                width={0.27}
                height={0.064}
                variant="default"
                onClick={() => onDropToFloor?.()}
              />
              <DockButton
                label="🎯 Recenter"
                sublabel="Align Horizon"
                position={[0.185, -0.188, 0.008]}
                width={0.25}
                height={0.064}
                variant="default"
                onClick={onRecenterSeat}
              />
              <DockButton
                label={wristHudHidden ? '⌚ Wrist: OFF' : '⌚ Wrist: ON'}
                sublabel={wristHudHidden ? 'Tap to Show' : 'Tap to Hide'}
                position={[0.465, -0.188, 0.008]}
                width={0.27}
                height={0.064}
                variant={wristHudHidden ? 'default' : 'active'}
                onClick={() => onToggleWristHud?.()}
              />
            </>
          )}
        </group>
      )}
    </group>
  )
}
