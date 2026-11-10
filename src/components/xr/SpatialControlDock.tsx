import { RoundedBox, Text } from '@react-three/drei'
import { useEffect, useRef, useState } from 'react'
import { QUICK_REACTIONS } from '../../constants/cinema'
import { FREE_ROAM_SEAT_ID } from '../../constants/hangout'
import {
  ADVENTURE_CAMPAIGN_LIST,
  buildQuestMediaUrl,
  isAdventureMediaUrl,
  type AdventureArchetypeId,
  type AdventureCampaignId,
  type AdventureQuestState,
} from '../../games/adventure'
import {
  NES_LIBRARY_CARTRIDGES,
  getNesEmulator,
  isNesMediaUrl,
  parseNesCartridgeIdFromUrl,
} from '../../services/nesEmulator'
import { playSpatialUiFeedback } from '../../services/soundboardAudio'
import { clearSpatialUiHoverPrefix, setSpatialUiHovered } from '../../services/xrTracking'
import type {
  LightingPresetId,
  LoungeWingId,
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

export type SpatialDockTabId = 'media' | 'rooms' | 'social' | 'customize'

interface DockButtonProps {
  label: string
  sublabel?: string
  position: [number, number, number]
  width?: number
  height?: number
  fontSize?: number
  variant?: 'default' | 'primary' | 'danger' | 'active'
  disabled?: boolean
  soundKind?: 'ui-click' | 'teleport' | 'dice-roll'
  onClick: () => void
  onPointerDown?: () => void
  onPointerUp?: () => void
}

function DockButton({
  label,
  sublabel,
  position,
  width = 0.25,
  height = 0.095,
  fontSize = 0.026,
  variant = 'default',
  disabled = false,
  soundKind = 'ui-click',
  onClick,
  onPointerDown,
  onPointerUp,
}: DockButtonProps) {
  const [hovered, setHovered] = useState(false)
  const sourceId = `dock-btn-${label}`
  const isPressedRef = useRef(false)
  const onPointerUpRef = useRef(onPointerUp)

  useEffect(() => {
    onPointerUpRef.current = onPointerUp
  }, [onPointerUp])

  useEffect(() => {
    return () => {
      setSpatialUiHovered(false, sourceId)
      if (isPressedRef.current) {
        isPressedRef.current = false
        onPointerUpRef.current?.()
      }
    }
  }, [sourceId])

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
      scale={hovered && !disabled ? 1.04 : 1}
      pointerEventsType={{ deny: 'grab' }}
      onPointerOver={(e) => {
        if (disabled) return
        e.stopPropagation()
        setHovered(true)
        setSpatialUiHovered(true, sourceId)
      }}
      onPointerOut={() => {
        setHovered(false)
        setSpatialUiHovered(false, sourceId)
        if (isPressedRef.current) {
          isPressedRef.current = false
          onPointerUp?.()
        }
      }}
      onPointerCancel={() => {
        setHovered(false)
        setSpatialUiHovered(false, sourceId)
        if (isPressedRef.current) {
          isPressedRef.current = false
          onPointerUp?.()
        }
      }}
      onPointerDown={(e) => {
        if (disabled || !onPointerDown) return
        e.stopPropagation()
        isPressedRef.current = true
        onPointerDown()
      }}
      onPointerUp={(e) => {
        if (disabled || !onPointerUp) return
        e.stopPropagation()
        isPressedRef.current = false
        onPointerUp()
      }}
      onClick={(e) => {
        if (disabled) return
        e.stopPropagation()
        playSpatialUiFeedback(soundKind)
        onClick()
      }}
    >
      {(hovered || variant === 'active' || variant === 'primary') && !disabled && (
        <RoundedBox
          args={[width + 0.008, height + 0.008, 0.015]}
          radius={0.022}
          smoothness={3}
          position={[0, 0, -0.002]}
        >
          <meshBasicMaterial
            color={
              variant === 'danger'
                ? '#F87171'
                : variant === 'primary'
                  ? '#FDE68A'
                  : '#E5A93C'
            }
            transparent
            opacity={hovered ? 0.78 : 0.36}
          />
        </RoundedBox>
      )}
      <RoundedBox args={[width, height, 0.018]} radius={0.02} smoothness={3}>
        <meshBasicMaterial color={bgColor} />
      </RoundedBox>
      <Text
        position={[0, sublabel ? 0.012 : 0, 0.012]}
        fontSize={fontSize}
        color={textColor}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      {sublabel && (
        <Text
          position={[0, -0.02, 0.012]}
          fontSize={0.018}
          color={variant === 'primary' ? '#1E2430' : '#CBD5E1'}
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
  effectiveCinemaVolume?: number
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
  activeLoungeWing?: LoungeWingId
  onSelectSeat?: (seatId: string) => void
  onJumpToWing?: (wingId: LoungeWingId) => void
  activeLightingPreset?: string
  onApplyLightingPreset?: (presetId: LightingPresetId) => void
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
  adventureState?: AdventureQuestState
  onStartStoryQuest?: (campaignId?: AdventureCampaignId) => void
  onSelectAdventureArchetype?: (archetype: AdventureArchetypeId) => void
  onUseAdventureAbility?: () => void
  onRollAdventureD20?: () => void
  onAdvanceAdventureScene?: () => void
}

export function SpatialControlDock({
  presenterState,
  isLocalPresenter,
  canTakeControl,
  isMuted,
  cinemaVolume,
  effectiveCinemaVolume,
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
  activeLoungeWing = 'main-lounge',
  onSelectSeat,
  onJumpToWing,
  activeLightingPreset,
  onApplyLightingPreset,
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
  adventureState,
  onStartStoryQuest,
  onSelectAdventureArchetype,
  onUseAdventureAbility,
  onRollAdventureD20,
  onAdvanceAdventureScene,
}: SpatialControlDockProps) {
  const [minimized, setMinimized] = useState(() => Boolean(isFreeRoaming))
  const [activeTab, setActiveTab] = useState<SpatialDockTabId>('media')
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

  // Quest Left Y button toggles the floating controls dock open/closed from anywhere
  useEffect(() => {
    if (dockSummonToggleVersion !== prevSummonVersionRef.current) {
      prevSummonVersionRef.current = dockSummonToggleVersion
      setMinimized((v) => !v)
    }
  }, [dockSummonToggleVersion])

  useEffect(() => {
    clearSpatialUiHoverPrefix('dock-btn-')
    if (minimized || !isNesMediaUrl(presenterState.mediaUrl)) {
      const emu = getNesEmulator()
      emu.setButtonState('start', false)
      emu.setButtonState('a', false)
      emu.setButtonState('b', false)
    }
  }, [activeTab, minimized, presenterState.mediaUrl])

  useEffect(() => {
    return () => {
      clearSpatialUiHoverPrefix('dock-btn-')
      const emu = getNesEmulator()
      emu.setButtonState('start', false)
      emu.setButtonState('a', false)
      emu.setButtonState('b', false)
    }
  }, [])

  const progressRatio =
    localDuration > 0 ? Math.max(0, Math.min(1, localCurrentTime / localDuration)) : 0
  const displayedScreenVol = effectiveCinemaVolume ?? cinemaVolume
  const isQuietZoneMuted =
    effectiveCinemaVolume !== undefined &&
    effectiveCinemaVolume === 0 &&
    cinemaVolume > 0 &&
    (activeLoungeWing === 'library' || activeLoungeWing === 'game-room')

  const triggerNesLibraryOrCycle = () => {
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
    onSelectStreamUrl(`nes://${nextGame.id}`, `🕹 NES: ${nextGame.title}`)
  }

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
              ? '🚀 Fly Mode · Control Dock ▲'
              : isFreeRoaming
                ? '🚶 Walk Mode · Control Dock ▲'
                : '🎛 Open Control Dock ▲'
          }
          sublabel={
            flyMode
              ? 'Glance left wrist or press Left Y'
              : isFreeRoaming
                ? 'Tap or press Left Y'
                : 'Tap to expand controls'
          }
          position={[0, 0, 0]}
          width={0.54}
          height={isFreeRoaming ? 0.098 : 0.092}
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

      {/* Brushed Metallic Outer Console Bezel */}
      <RoundedBox
        args={[1.328, 0.668, 0.022]}
        position={[0, -0.04, -0.004]}
        radius={0.04}
        smoothness={3}
      >
        <meshStandardMaterial color="#1E293B" roughness={0.25} metalness={0.75} />
      </RoundedBox>

      {/* Angled Brushed Console Chassis (Single Clean Unified Backplate) */}
      <RoundedBox args={[1.3, 0.64, 0.026]} position={[0, -0.04, 0]} radius={0.036} smoothness={3}>
        <meshStandardMaterial color="#0D1118" roughness={0.42} metalness={0.38} />
      </RoundedBox>

      {/* Top Amber Accent Hairline */}
      <mesh position={[0, 0.272, 0.015]}>
        <boxGeometry args={[1.2, 0.005, 0.004]} />
        <meshBasicMaterial color="#E5A93C" />
      </mesh>

      {/* =====================================================================
          ROW 1 (PERSISTENT PRIMARY BAR): Presenter, Mic, Screen/Voice Vol, Recenter, Hide
          ===================================================================== */}
      <DockButton
        label={isLocalPresenter ? '👑 Release' : '👑 Take Control'}
        sublabel={
          isLocalPresenter
            ? 'Presenting'
            : presenterState.presenterName
              ? `Host: ${presenterState.presenterName.slice(0, 9)}`
              : 'Claim Screen'
        }
        position={[-0.495, 0.205, 0.016]}
        width={0.23}
        height={0.088}
        variant={isLocalPresenter ? 'active' : 'primary'}
        disabled={!isLocalPresenter && !canTakeControl}
        onClick={isLocalPresenter ? onReleaseControl : onTakeControl}
      />

      <DockButton
        label={isMuted ? '🔇 Mic Muted' : '🎙 Mic Live'}
        sublabel={isMuted ? 'Tap to Unmute' : 'Voice Active'}
        position={[-0.255, 0.205, 0.016]}
        width={0.21}
        height={0.088}
        variant={isMuted ? 'danger' : 'active'}
        onClick={onToggleMute}
      />

      <DockButton
        label={`🔊 Screen ${Math.round(displayedScreenVol * 100)}%`}
        sublabel={isQuietZoneMuted ? '🔥 Quiet Zone (0%)' : 'Tap to Step Vol'}
        position={[-0.025, 0.205, 0.016]}
        width={0.22}
        height={0.088}
        variant={isQuietZoneMuted ? 'active' : 'default'}
        onClick={() => {
          const next =
            cinemaVolume >= 0.95 ? 0.25 : Math.min(1, Number((cinemaVolume + 0.25).toFixed(2)))
          onChangeCinemaVolume(next)
        }}
      />

      <DockButton
        label={`🗣 Voice ${Math.round(voiceVolume * 100)}%`}
        sublabel="Voice Volume"
        position={[0.195, 0.205, 0.016]}
        width={0.195}
        height={0.088}
        onClick={() => {
          const next =
            voiceVolume >= 0.95 ? 0.25 : Math.min(1, Number((voiceVolume + 0.25).toFixed(2)))
          onChangeVoiceVolume(next)
        }}
      />

      <DockButton
        label="🎯 Recenter"
        sublabel="Align View"
        position={[0.388, 0.205, 0.016]}
        width={0.16}
        height={0.088}
        onClick={onRecenterSeat}
      />

      <DockButton
        label="▼ Hide"
        sublabel="Left Y"
        position={[0.548, 0.205, 0.016]}
        width={0.13}
        height={0.088}
        onClick={() => setMinimized(true)}
      />

      {/* =====================================================================
          ROW 2 (CONTEXT-SENSITIVE TRANSPORT): NES Pad / Adventure Quest / Video Scrub
          ===================================================================== */}
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
            <group position={[0, 0.095, 0.016]}>
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
                height={0.086}
                variant={isLocalP1 ? 'primary' : isP1Locked ? 'default' : 'active'}
                disabled={isP1Locked}
                onClick={() => {
                  onClaimNesPlayerSlot?.(isLocalP1 ? null : 1)
                }}
              />

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
                height={0.086}
                variant={isLocalP2 ? 'primary' : isP2Locked ? 'default' : 'active'}
                disabled={isP2Locked}
                onClick={() => {
                  onClaimNesPlayerSlot?.(isLocalP2 ? null : 2)
                }}
              />

              <DockButton
                label={nesLibraryOpen ? '🕹 Hide ROMs' : '🕹 36 ROMs'}
                sublabel="NES Console"
                position={[-0.088, 0, 0]}
                width={0.165}
                height={0.086}
                variant={nesLibraryOpen ? 'primary' : 'danger'}
                onClick={() => {
                  onToggleNesLibrary?.()
                }}
              />

              <DockButton
                label="START"
                sublabel="Play/Pause"
                position={[0.072, 0, 0]}
                width={0.118}
                height={0.086}
                variant="primary"
                onPointerDown={() => getNesEmulator().setButtonState('start', true)}
                onPointerUp={() => getNesEmulator().setButtonState('start', false)}
                onClick={() => {}}
              />

              <DockButton
                label="B"
                sublabel="Fire/Run"
                position={[0.19, 0, 0]}
                width={0.095}
                height={0.086}
                variant="danger"
                onPointerDown={() => getNesEmulator().setButtonState('b', true)}
                onPointerUp={() => getNesEmulator().setButtonState('b', false)}
                onClick={() => {}}
              />
              <DockButton
                label="A"
                sublabel="Jump"
                position={[0.295, 0, 0]}
                width={0.095}
                height={0.086}
                variant="danger"
                onPointerDown={() => getNesEmulator().setButtonState('a', true)}
                onPointerUp={() => getNesEmulator().setButtonState('a', false)}
                onClick={() => {}}
              />

              <DockButton
                label="💾 Save"
                sublabel="Slot 1"
                position={[0.41, 0, 0]}
                width={0.112}
                height={0.086}
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
                height={0.086}
                variant="default"
                onClick={() => {
                  void getNesEmulator().resumeMostRecentSave()
                }}
              />
            </group>
          )
        })()
      ) : isAdventureMediaUrl(presenterState.mediaUrl) ? (
        (() => {
          const myHero = localUserId
            ? adventureState?.players[localUserId]
            : undefined
          const arch = myHero?.archetype ?? 'vanguard'
          const abilityUsed =
            myHero?.abilityUsedInAct !== null &&
            myHero?.abilityUsedInAct !== undefined
          return (
            <group position={[0, 0.095, 0.016]}>
              <DockButton
                label="🗺 Campaign"
                sublabel="Switch Quest"
                position={[-0.495, 0, 0]}
                width={0.185}
                height={0.086}
                variant="active"
                onClick={() => {
                  const currIdx = ADVENTURE_CAMPAIGN_LIST.findIndex(
                    (c) => c.id === adventureState?.campaignId,
                  )
                  const nextCamp =
                    ADVENTURE_CAMPAIGN_LIST[
                      (currIdx + 1) % ADVENTURE_CAMPAIGN_LIST.length
                    ]
                  if (onStartStoryQuest) {
                    onStartStoryQuest(nextCamp.id)
                  } else {
                    onSelectStreamUrl(
                      buildQuestMediaUrl(nextCamp.id),
                      `⚔️ Quest: ${nextCamp.title}`,
                    )
                  }
                }}
              />

              <DockButton
                label={
                  arch === 'vanguard'
                    ? '🛡 Vanguard'
                    : arch === 'shadow'
                      ? '🗡 Shadow'
                      : arch === 'arcanist'
                        ? '🔮 Arcanist'
                        : '✨ Cleric'
                }
                sublabel="Tap Switch Class"
                position={[-0.295, 0, 0]}
                width={0.185}
                height={0.086}
                variant="default"
                onClick={() => {
                  const order: AdventureArchetypeId[] = [
                    'vanguard',
                    'shadow',
                    'arcanist',
                    'cleric',
                  ]
                  const nextArch = order[(order.indexOf(arch) + 1) % order.length]
                  onSelectAdventureArchetype?.(nextArch)
                }}
              />

              <DockButton
                label="⚡ Ability"
                sublabel={abilityUsed ? 'Used' : 'Class Power'}
                position={[-0.105, 0, 0]}
                width={0.165}
                height={0.086}
                variant={abilityUsed ? 'default' : 'active'}
                disabled={abilityUsed}
                onClick={() => onUseAdventureAbility?.()}
              />

              <DockButton
                label={myHero?.isGhost ? '👻 Ghost D20' : '🎲 Roll D20'}
                sublabel={
                  myHero?.totalRoll !== null && myHero?.totalRoll !== undefined
                    ? `Last: ${myHero.totalRoll}`
                    : 'Skill Check'
                }
                position={[0.11, 0, 0]}
                width={0.23}
                height={0.086}
                variant="primary"
                soundKind="dice-roll"
                onClick={() => onRollAdventureD20?.()}
              />

              <DockButton
                label="▶ Next Scene"
                sublabel="Advance Party"
                position={[0.395, 0, 0]}
                width={0.28}
                height={0.086}
                variant={adventureState?.phase === 'resolution' ? 'primary' : 'active'}
                onClick={() => onAdvanceAdventureScene?.()}
              />
            </group>
          )
        })()
      ) : (
        <group position={[0, 0.095, 0.016]}>
          <DockButton
            label={presenterState.isPlaying ? 'Pause ❚❚' : 'Play ▶'}
            position={[-0.48, 0, 0]}
            width={0.23}
            height={0.086}
            variant={isLocalPresenter ? 'primary' : 'default'}
            disabled={!isLocalPresenter || presenterState.screenMode !== 'url-sync'}
            onClick={onTogglePlayPause}
          />

          <DockButton
            label="-15s"
            position={[-0.29, 0, 0]}
            width={0.11}
            height={0.086}
            disabled={!isLocalPresenter || presenterState.screenMode !== 'url-sync'}
            onClick={() => onSeekRelative(-15)}
          />

          <DockButton
            label="+15s"
            position={[-0.16, 0, 0]}
            width={0.11}
            height={0.086}
            disabled={!isLocalPresenter || presenterState.screenMode !== 'url-sync'}
            onClick={() => onSeekRelative(15)}
          />

          {/* Interactive 3D Scrub Bar */}
          <group
            position={[0.25, 0, 0]}
            pointerEventsType={{ deny: 'grab' }}
            onClick={(e) => {
              if (!isLocalPresenter || presenterState.screenMode !== 'url-sync') return
              e.stopPropagation()
              playSpatialUiFeedback('ui-click')
              const localPt = e.object.worldToLocal(e.point.clone())
              const frac = Math.max(0, Math.min(1, (localPt.x + 0.31) / 0.62))
              onSeekFraction(frac)
            }}
          >
            <RoundedBox args={[0.64, 0.084, 0.012]} radius={0.018} smoothness={2}>
              <meshBasicMaterial color="#131822" />
            </RoundedBox>
            <mesh position={[0, -0.014, 0.008]}>
              <planeGeometry args={[0.56, 0.014]} />
              <meshBasicMaterial color="#273142" />
            </mesh>
            <mesh position={[-0.28 + (0.56 * progressRatio) / 2, -0.014, 0.01]}>
              <planeGeometry args={[Math.max(0.008, 0.56 * progressRatio), 0.014]} />
              <meshBasicMaterial color="#E5A93C" />
            </mesh>
            <Text
              position={[0, 0.015, 0.01]}
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
        </group>
      )}

      {/* =====================================================================
          ROW 3 (LEVEL 2 CATEGORY TABS): Media | Rooms & Stations | Social | Customize
          ===================================================================== */}
      <group position={[0, -0.005, 0.016]}>
        <DockButton
          label="🎬 Media & Games"
          position={[-0.456, 0, 0]}
          width={0.295}
          height={0.074}
          fontSize={0.024}
          variant={activeTab === 'media' ? 'primary' : 'active'}
          onClick={() => setActiveTab('media')}
        />
        <DockButton
          label="🚪 Rooms & Stations"
          position={[-0.148, 0, 0]}
          width={0.295}
          height={0.074}
          fontSize={0.024}
          variant={activeTab === 'rooms' ? 'primary' : 'active'}
          onClick={() => setActiveTab('rooms')}
        />
        <DockButton
          label="💬 Social & Avatar"
          position={[0.16, 0, 0]}
          width={0.295}
          height={0.074}
          fontSize={0.024}
          variant={activeTab === 'social' ? 'primary' : 'active'}
          onClick={() => setActiveTab('social')}
        />
        <DockButton
          label="🛠 Customize"
          position={[0.462, 0, 0]}
          width={0.28}
          height={0.074}
          fontSize={0.024}
          variant={activeTab === 'customize' ? 'primary' : 'active'}
          onClick={() => setActiveTab('customize')}
        />
      </group>

      {/* =====================================================================
          ROWS 4 & 5 (LEVEL 2 PROGRESSIVE DISCLOSURE TAB DRAWER)
          ===================================================================== */}
      {activeTab === 'media' && (
        <group position={[0, -0.105, 0.016]}>
          {/* Media Sub-Row A: Screen Sources & Interactive Experiences */}
          <DockButton
            label="▶ YouTube VR"
            sublabel="Search & Browse"
            position={[-0.485, 0, 0]}
            width={0.235}
            height={0.088}
            variant={youtubeBrowserOpen ? 'primary' : 'danger'}
            onClick={onToggleYouTubeBrowser}
          />
          <DockButton
            label="🔗 Stream URL"
            sublabel="MP4 / HLS Link"
            position={[-0.24, 0, 0]}
            width={0.225}
            height={0.088}
            variant={keyboardMode === 'url' ? 'primary' : 'default'}
            onClick={() => {
              if (!isLocalPresenter && canTakeControl) {
                onTakeControl()
              }
              onSetKeyboardMode(keyboardMode === 'url' ? null : 'url')
            }}
          />
          <DockButton
            label="🖥 Share Tab"
            sublabel="PC WebRTC"
            position={[-0.005, 0, 0]}
            width={0.215}
            height={0.088}
            variant={
              presenterState.screenMode === 'tab-stream' && isLocalPresenter
                ? 'primary'
                : 'default'
            }
            onClick={onStartTabShare}
          />
          <DockButton
            label={nesLibraryOpen ? '🕹 Hide NES' : '🕹 NES Console'}
            sublabel="36 Classic ROMs"
            position={[0.225, 0, 0]}
            width={0.225}
            height={0.088}
            variant={
              nesLibraryOpen || isNesMediaUrl(presenterState.mediaUrl)
                ? 'primary'
                : 'danger'
            }
            onClick={triggerNesLibraryOrCycle}
          />
          <DockButton
            label="⚔️ Story Quest"
            sublabel="4 Co-Op Campaigns"
            position={[0.475, 0, 0]}
            width={0.245}
            height={0.088}
            variant={isAdventureMediaUrl(presenterState.mediaUrl) ? 'primary' : 'active'}
            onClick={() => {
              if (onStartStoryQuest) {
                onStartStoryQuest()
              } else {
                const camp = ADVENTURE_CAMPAIGN_LIST[0]
                onSelectStreamUrl(
                  buildQuestMediaUrl(camp.id),
                  `⚔️ Quest: ${camp.title}`,
                )
              }
            }}
          />

          {/* Media Sub-Row B: Main Theater Stations & Bar Games Quick-Hop */}
          {onSelectSeat && (
            <group position={[0, -0.105, 0]}>
              <DockButton
                label="🚶 Walk Mode"
                sublabel="Free Roam"
                position={[-0.495, 0, 0]}
                width={0.185}
                height={0.084}
                variant={localSeatId === FREE_ROAM_SEAT_ID ? 'primary' : 'active'}
                onClick={() => onSelectSeat(FREE_ROAM_SEAT_ID)}
              />
              <DockButton
                label="🛋 Main Sofa"
                sublabel="Theater Seat"
                position={[-0.297, 0, 0]}
                width={0.185}
                height={0.084}
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
                label="🎯 Pro Darts"
                sublabel="301 / 501 / Cricket"
                position={[-0.099, 0, 0]}
                width={0.185}
                height={0.084}
                variant={localSeatId === 'station:darts-oche' ? 'primary' : 'default'}
                onClick={() => onSelectSeat('station:darts-oche')}
              />
              <DockButton
                label="⛳ Putting"
                sublabel="Golf Green"
                position={[0.099, 0, 0]}
                width={0.185}
                height={0.084}
                variant={localSeatId === 'station:putting-tee' ? 'primary' : 'default'}
                onClick={() => onSelectSeat('station:putting-tee')}
              />
              <DockButton
                label="🎲 Game Table"
                sublabel="21 / Poker / RPG"
                position={[0.297, 0, 0]}
                width={0.185}
                height={0.084}
                variant={localSeatId?.startsWith('game-table:') ? 'primary' : 'default'}
                onClick={() => onSelectSeat('game-table:seat-0')}
              />
              <DockButton
                label={flyMode ? '🚀 Fly: ON' : '🚀 Fly Mode'}
                sublabel="3D Free-Flight"
                position={[0.495, 0, 0]}
                width={0.185}
                height={0.084}
                variant={flyMode ? 'primary' : 'active'}
                onClick={() => onToggleFlyMode?.()}
              />
            </group>
          )}
        </group>
      )}

      {activeTab === 'rooms' && (
        <group position={[0, -0.105, 0.016]}>
          {/* Rooms Sub-Row A: 8-Room Teleport Strip */}
          <DockButton
            label="🎬 Theater"
            position={[-0.525, 0, 0]}
            width={0.14}
            height={0.088}
            fontSize={0.022}
            variant={activeLoungeWing === 'main-lounge' ? 'primary' : 'default'}
            soundKind="teleport"
            onClick={() =>
              onJumpToWing
                ? onJumpToWing('main-lounge')
                : onSelectSeat?.('furn-sofa-front:0')
            }
          />
          <DockButton
            label="🏛 Hallway"
            position={[-0.375, 0, 0]}
            width={0.14}
            height={0.088}
            fontSize={0.022}
            variant={activeLoungeWing === 'hallway' ? 'primary' : 'default'}
            soundKind="teleport"
            onClick={() =>
              onJumpToWing
                ? onJumpToWing('hallway')
                : onSelectSeat?.(FREE_ROAM_SEAT_ID)
            }
          />
          <DockButton
            label="💼 Board"
            position={[-0.225, 0, 0]}
            width={0.14}
            height={0.088}
            fontSize={0.022}
            variant={
              activeLoungeWing === 'boardroom' ||
              localSeatId?.startsWith('wing:boardroom')
                ? 'primary'
                : 'default'
            }
            soundKind="teleport"
            onClick={() =>
              onJumpToWing
                ? onJumpToWing('boardroom')
                : onSelectSeat?.('wing:boardroom-head')
            }
          />
          <DockButton
            label="🔥 Library"
            position={[-0.075, 0, 0]}
            width={0.14}
            height={0.088}
            fontSize={0.022}
            variant={
              activeLoungeWing === 'library' ||
              localSeatId?.startsWith('wing:library')
                ? 'primary'
                : 'default'
            }
            soundKind="teleport"
            onClick={() =>
              onJumpToWing
                ? onJumpToWing('library')
                : onSelectSeat?.('wing:library-chair-1')
            }
          />
          <DockButton
            label="🛰 Control"
            position={[0.075, 0, 0]}
            width={0.14}
            height={0.088}
            fontSize={0.022}
            variant={
              activeLoungeWing === 'command-center' ||
              localSeatId?.startsWith('wing:command')
                ? 'primary'
                : 'default'
            }
            soundKind="teleport"
            onClick={() =>
              onJumpToWing
                ? onJumpToWing('command-center')
                : onSelectSeat?.('wing:command-seat-1')
            }
          />
          <DockButton
            label="🕹 Game Rm"
            position={[0.225, 0, 0]}
            width={0.14}
            height={0.088}
            fontSize={0.022}
            variant={
              activeLoungeWing === 'game-room' ||
              localSeatId?.startsWith('wing:gameroom')
                ? 'primary'
                : 'default'
            }
            soundKind="teleport"
            onClick={() =>
              onJumpToWing
                ? onJumpToWing('game-room')
                : onSelectSeat?.('wing:gameroom-holo-1')
            }
          />
          <DockButton
            label="🎯 Range"
            position={[0.375, 0, 0]}
            width={0.14}
            height={0.088}
            fontSize={0.022}
            variant={
              activeLoungeWing === 'shooting-range' ||
              localSeatId?.startsWith('wing:shooting')
                ? 'primary'
                : 'default'
            }
            soundKind="teleport"
            onClick={() =>
              onJumpToWing
                ? onJumpToWing('shooting-range')
                : onSelectSeat?.('wing:shooting-booth-2')
            }
          />
          <DockButton
            label="🏔 Deck"
            position={[0.525, 0, 0]}
            width={0.14}
            height={0.088}
            fontSize={0.022}
            variant={
              activeLoungeWing === 'outdoor-deck' ||
              localSeatId?.startsWith('wing:deck')
                ? 'primary'
                : 'default'
            }
            soundKind="teleport"
            onClick={() =>
              onJumpToWing
                ? onJumpToWing('outdoor-deck')
                : onSelectSeat?.('wing:deck-chair-1')
            }
          />

          {/* Rooms Sub-Row B: Locomotion, Flight, Floor Recovery & Stations */}
          <group position={[0, -0.105, 0]}>
            <DockButton
              label="🚶 Walk Mode"
              sublabel="Free Roam"
              position={[-0.455, 0, 0]}
              width={0.28}
              height={0.084}
              variant={localSeatId === FREE_ROAM_SEAT_ID ? 'primary' : 'active'}
              onClick={() => onSelectSeat?.(FREE_ROAM_SEAT_ID)}
            />
            <DockButton
              label={flyMode ? '🚀 Fly Mode: ON' : '🚀 Fly Mode: OFF'}
              sublabel={flyMode ? 'R-Stick Ascend/Descend' : 'Untethered 3D Flight'}
              position={[-0.14, 0, 0]}
              width={0.31}
              height={0.084}
              variant={flyMode ? 'primary' : 'active'}
              onClick={() => onToggleFlyMode?.()}
            />
            <DockButton
              label="⬇ Drop to Floor"
              sublabel="Reset Y = 0"
              position={[0.165, 0, 0]}
              width={0.26}
              height={0.084}
              onClick={() => onDropToFloor?.()}
            />
            <DockButton
              label={wristHudHidden ? '⌚ Wrist HUD: OFF' : '⌚ Wrist HUD: ON'}
              sublabel={wristHudHidden ? 'Tap to Show' : 'Tap to Hide'}
              position={[0.455, 0, 0]}
              width={0.28}
              height={0.084}
              variant={wristHudHidden ? 'default' : 'active'}
              onClick={() => onToggleWristHud?.()}
            />
          </group>
        </group>
      )}

      {activeTab === 'social' && (
        <group position={[0, -0.105, 0.016]}>
          {/* Social Sub-Row A: Floating Emoji Reactions + Type Chat */}
          {QUICK_REACTIONS.map((emoji, idx) => (
            <DockButton
              key={emoji}
              label={emoji}
              position={[-0.51 + idx * 0.155, 0, 0]}
              width={0.135}
              height={0.086}
              onClick={() => onSendReaction(emoji)}
            />
          ))}
          <DockButton
            label="⌨ Type Chat"
            sublabel="3D Keyboard"
            position={[0.45, 0, 0]}
            width={0.26}
            height={0.086}
            variant={keyboardMode === 'chat' ? 'primary' : 'default'}
            onClick={() => onSetKeyboardMode(keyboardMode === 'chat' ? null : 'chat')}
          />

          {/* Social Sub-Row B: 3D Chat Panel, Avatar Wardrobe & Audio Controls */}
          <group position={[0, -0.105, 0]}>
            <DockButton
              label={chatPanelOpen ? '💬 Chat Wall: ON' : '💬 Chat Wall: OFF'}
              sublabel="3D Spatial Chat"
              position={[-0.43, 0, 0]}
              width={0.32}
              height={0.084}
              variant={chatPanelOpen ? 'primary' : 'default'}
              onClick={onToggleChatPanel}
            />
            <DockButton
              label={wardrobeOpen ? '👤 Close Mirror' : '👤 Avatar & Wardrobe'}
              sublabel="3D Vanity Mirror"
              position={[-0.075, 0, 0]}
              width={0.34}
              height={0.084}
              variant={wardrobeOpen ? 'primary' : 'active'}
              onClick={() => onToggleWardrobe?.()}
            />
            <DockButton
              label={isMuted ? '🔇 Unmute Mic' : '🎙 Mute Mic'}
              sublabel="Voice Status"
              position={[0.245, 0, 0]}
              width={0.25}
              height={0.084}
              variant={isMuted ? 'danger' : 'active'}
              onClick={onToggleMute}
            />
            <DockButton
              label={`🗣 Voice ${Math.round(voiceVolume * 100)}%`}
              sublabel="Step Gain"
              position={[0.49, 0, 0]}
              width={0.2}
              height={0.084}
              onClick={() => {
                const next =
                  voiceVolume >= 0.95
                    ? 0.25
                    : Math.min(1, Number((voiceVolume + 0.25).toFixed(2)))
                onChangeVoiceVolume(next)
              }}
            />
          </group>
        </group>
      )}

      {activeTab === 'customize' && (
        <group position={[0, -0.105, 0.016]}>
          {/* Customize Sub-Row A: Build Mode, Avatar Mirror & Lighting Presets */}
          <DockButton
            label={buildModeOpen ? '🛠 Exit Build Mode' : '🛠 Room Builder'}
            sublabel="Spawn & Move Decor"
            position={[-0.45, 0, 0]}
            width={0.29}
            height={0.088}
            variant={buildModeOpen ? 'primary' : 'active'}
            onClick={onToggleBuildMode}
          />
          <DockButton
            label={wardrobeOpen ? '👤 Exit Mirror' : '👤 Avatar Mirror'}
            sublabel="Customize Look"
            position={[-0.145, 0, 0]}
            width={0.28}
            height={0.088}
            variant={wardrobeOpen ? 'primary' : 'active'}
            onClick={() => onToggleWardrobe?.()}
          />
          <DockButton
            label={wristHudHidden ? '⌚ Wrist HUD: OFF' : '⌚ Wrist HUD: ON'}
            sublabel="Left Wrist Watch"
            position={[0.155, 0, 0]}
            width={0.28}
            height={0.088}
            variant={wristHudHidden ? 'default' : 'active'}
            onClick={() => onToggleWristHud?.()}
          />
          <DockButton
            label={flyMode ? '🚀 Fly Mode: ON' : '🚀 Fly Mode: OFF'}
            sublabel="3D Free-Flight"
            position={[0.45, 0, 0]}
            width={0.28}
            height={0.088}
            variant={flyMode ? 'primary' : 'active'}
            onClick={() => onToggleFlyMode?.()}
          />

          {/* Customize Sub-Row B: 5 Standardized Lighting Presets */}
          <group position={[0, -0.105, 0]}>
            {(
              [
                { id: 'movie', label: '🎬 Movie Dim', x: -0.48 },
                { id: 'cozy', label: '🛋 Cozy Hangout', x: -0.24 },
                { id: 'neon-pub', label: '⚡ Neon Pub', x: 0 },
                { id: 'daylight', label: '☀️ Studio Bright', x: 0.24 },
                { id: 'midnight-lofi', label: '🌙 Lo-Fi', x: 0.48 },
              ] as const
            ).map((preset) => (
              <DockButton
                key={preset.id}
                label={preset.label}
                sublabel="Lighting Mood"
                position={[preset.x, 0, 0]}
                width={0.225}
                height={0.084}
                fontSize={0.022}
                variant={activeLightingPreset === preset.id ? 'primary' : 'default'}
                onClick={() => {
                  if (onApplyLightingPreset) {
                    onApplyLightingPreset(preset.id)
                  } else {
                    onToggleBuildMode()
                  }
                }}
              />
            ))}
          </group>
        </group>
      )}
    </group>
  )
}
