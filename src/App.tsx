import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  IfInSessionMode,
  PointerEvents,
  XR,
  XROrigin,
  noEvents,
  useXR,
} from '@react-three/xr'
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { BarGamesDrawer, type BarGamesTabId } from './components/ui/BarGamesDrawer'
import { CompanionOverlay } from './components/ui/CompanionOverlay'
import { PasscodeGate } from './components/ui/PasscodeGate'
import { AvatarManager } from './components/xr/AvatarManager'
import { BarGamesCorner3D } from './components/xr/BarGamesCorner3D'
import { BuildModePanel3D } from './components/xr/BuildModePanel3D'
import { CinemaRoom } from './components/xr/CinemaRoom'
import { SpatialChatPanel } from './components/xr/SpatialChatPanel'
import { SpatialControlDock } from './components/xr/SpatialControlDock'
import type { VRKeyboardMode } from './components/xr/VRKeyboard3D'
import { YouTubeBrowser3D } from './components/xr/YouTubeBrowser3D'
import {
  LIGHTING_PRESETS,
  ROOM_SIZE_SPECS,
  getCatalogEntry,
} from './constants/hangout'
import { useBarGames } from './hooks/useBarGames'
import { useMediaScreen } from './hooks/useMediaScreen'
import { useRoomSession, type JoinRoomOptions } from './hooks/useRoomSession'
import { useWebRTC } from './hooks/useWebRTC'
import {
  isDeviceUnlocked,
  isPasscodeGateEnabled,
  lockDevicePasscode,
} from './services/passcode'
import type { YouTubeVideoItem } from './services/youtube'
import { exitVRSession, xrStore } from './store/xrStore'
import type {
  ComputedSeat,
  FurnitureCatalogId,
  LightingPresetId,
  PlacedFurnitureItem,
  RoomArchitectureConfig,
  RoomLightingConfig,
  RoomScreenTransform,
  WebRTCSignalMessage,
} from './types/lounge'

class CanvasRootBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('CanvasRootBoundary caught unexpected 3D tree error:', error)
  }

  render() {
    if (this.state.hasError) {
      return <ambientLight intensity={1.2} />
    }
    return this.props.children
  }
}

class SceneSectionBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('3D panel boundary caught non-fatal error:', error)
  }

  render() {
    if (this.state.hasError) return null
    return <Suspense fallback={null}>{this.props.children}</Suspense>
  }
}

interface SeatRigProps {
  seat: ComputedSeat
  screenCenter: [number, number, number]
  recenterVersion: number
  onInVRChange: (inVR: boolean) => void
  children?: React.ReactNode
}

/**
 * Manages both:
 * 1. Smoothly damped `<XROrigin>` placement & physical headset recentering inside immersive VR
 * 2. Smoothly transitioning `<OrbitControls>` seated eye-level camera inside Desktop / Companion mode
 */
function SeatCameraAndOriginRig({
  seat,
  screenCenter,
  recenterVersion,
  onInVRChange,
  children,
}: SeatRigProps) {
  const { camera } = useThree()
  const xrSession = useXR((s) => s.session)
  const inVR = Boolean(xrSession)

  const originRef = useRef<THREE.Group>(null)
  const dockGroupRef = useRef<THREE.Group>(null)
  const orbitRef = useRef<OrbitControlsImpl>(null)
  const [vrLocalOffset, setVrLocalOffset] = useState<[number, number, number]>([0, 0, 0])

  const desktopTransitionRemainingRef = useRef(0)
  const desiredCamPos = useMemo(() => new THREE.Vector3(), [])
  const desiredLookTarget = useMemo(() => new THREE.Vector3(), [])
  const desiredOriginPos = useMemo(() => new THREE.Vector3(), [])
  const desiredDockPos = useMemo(() => new THREE.Vector3(), [])
  const desiredSeatQuat = useMemo(() => new THREE.Quaternion(), [])
  const tmpEuler = useMemo(() => new THREE.Euler(), [])

  const onInVRChangeRef = useRef(onInVRChange)
  onInVRChangeRef.current = onInVRChange

  useEffect(() => {
    onInVRChangeRef.current(inVR)
  }, [inVR])

  // Reset VR local drift offset when hopping to a different seat cushion
  useEffect(() => {
    setVrLocalOffset([0, 0, 0])
  }, [seat.id])

  // Trigger smooth ~0.45s desktop camera glide whenever seat or recenter changes
  useEffect(() => {
    if (inVR) return
    desktopTransitionRemainingRef.current = 0.45
  }, [
    inVR,
    recenterVersion,
    seat.id,
    seat.position[0],
    seat.position[1],
    seat.position[2],
    seat.seatHeightOffset,
  ])

  // Calibrate physical headset horizontal drift relative to seat when Recenter is clicked in VR
  useEffect(() => {
    if (!inVR || recenterVersion === 0 || !originRef.current) return
    const headWorld = new THREE.Vector3()
    camera.getWorldPosition(headWorld)
    const dx = seat.position[0] - headWorld.x
    const dz = seat.position[2] - headWorld.z
    setVrLocalOffset((prev) => [prev[0] + dx, 0, prev[2] + dz])
  }, [camera, inVR, recenterVersion, seat.position])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const rigAlpha = 1 - Math.exp(-11 * dt)
    const seatDeltaY = Math.max(0, seat.seatHeightOffset - 0.38)
    const ergonomicFloorY = seat.position[1] + seatDeltaY

    desiredOriginPos.set(
      seat.position[0] + vrLocalOffset[0],
      ergonomicFloorY + 0.06,
      seat.position[2] + vrLocalOffset[2],
    )
    desiredDockPos.set(seat.position[0], ergonomicFloorY, seat.position[2])
    desiredSeatQuat.setFromEuler(tmpEuler.set(0, seat.rotationY, 0))

    if (originRef.current) {
      originRef.current.position.lerp(desiredOriginPos, rigAlpha)
      originRef.current.quaternion.slerp(desiredSeatQuat, rigAlpha)
    }

    if (dockGroupRef.current) {
      dockGroupRef.current.position.lerp(desiredDockPos, rigAlpha)
      dockGroupRef.current.quaternion.slerp(desiredSeatQuat, rigAlpha)
    }

    if (!inVR && desktopTransitionRemainingRef.current > 0) {
      desktopTransitionRemainingRef.current = Math.max(
        0,
        desktopTransitionRemainingRef.current - dt,
      )
      const camAlpha = 1 - Math.exp(-9.5 * dt)
      const backSin = Math.sin(seat.rotationY)
      const backCos = Math.cos(seat.rotationY)

      desiredCamPos.set(
        seat.position[0] + backSin * 0.14,
        ergonomicFloorY + 1.38,
        seat.position[2] + backCos * 0.14,
      )
      if (seat.lookAtTarget) {
        desiredLookTarget.set(
          seat.lookAtTarget[0],
          seat.lookAtTarget[1],
          seat.lookAtTarget[2],
        )
      } else {
        desiredLookTarget.set(
          screenCenter[0],
          screenCenter[1] - 0.35,
          screenCenter[2] + 1.4,
        )
      }

      camera.position.lerp(desiredCamPos, camAlpha)
      if (orbitRef.current) {
        orbitRef.current.target.lerp(desiredLookTarget, camAlpha)
        orbitRef.current.update()
      } else {
        camera.lookAt(desiredLookTarget)
      }
    }
  })

  const initialErgonomicFloorY =
    seat.position[1] + Math.max(0, seat.seatHeightOffset - 0.38)

  return (
    <>
      <XROrigin
        ref={originRef}
        position={[
          seat.position[0] + vrLocalOffset[0],
          initialErgonomicFloorY + 0.06,
          seat.position[2] + vrLocalOffset[2],
        ]}
        rotation={[0, seat.rotationY, 0]}
      />

      {/* Ergonomic Spatial Dock & VR Panels anchored directly at the user's dynamic seat */}
      <group
        ref={dockGroupRef}
        position={[
          seat.position[0],
          initialErgonomicFloorY,
          seat.position[2],
        ]}
        rotation={[0, seat.rotationY, 0]}
      >
        {children}
      </group>

      {/* Desktop OrbitControls disabled automatically during immersive VR sessions */}
      <IfInSessionMode deny={['immersive-vr', 'immersive-ar']}>
        <OrbitControls
          ref={orbitRef}
          enablePan={false}
          minDistance={0.95}
          maxDistance={15.5}
          minPolarAngle={Math.PI * 0.14}
          maxPolarAngle={Math.PI * 0.78}
          rotateSpeed={0.62}
        />
      </IfInSessionMode>
    </>
  )
}

export function App() {
  const signalHandlerRef = useRef<((signal: WebRTCSignalMessage) => void) | null>(null)

  const [passcodeUnlocked, setPasscodeUnlocked] = useState<boolean>(() =>
    isDeviceUnlocked(),
  )
  const passcodeEnabled = isPasscodeGateEnabled()

  const [selectedMicId, setSelectedMicId] = useState('')
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('')
  const [cinemaVolume, setCinemaVolume] = useState(0.8)
  const [voiceVolume, setVoiceVolume] = useState(0.9)
  const [inVRSession, setInVRSession] = useState(false)
  const [recenterVersion, setRecenterVersion] = useState(0)
  const [spatialChatOpen, setSpatialChatOpen] = useState(true)
  const [youtubeBrowserOpen, setYoutubeBrowserOpen] = useState(false)
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState('')
  const [youtubeSearchTrigger, setYoutubeSearchTrigger] = useState(0)
  const [buildMode, setBuildMode] = useState(false)
  const [barGamesOpen, setBarGamesOpen] = useState(false)
  const [barGamesTab, setBarGamesTab] = useState<BarGamesTabId>('play')
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null)
  const [editingPosterItemId, setEditingPosterItemId] = useState<string | null>(null)
  const [keyboardMode, setKeyboardMode] = useState<VRKeyboardMode | null>(null)
  const [statusBanner, setStatusBanner] = useState<string | null>(null)
  const [usingSimulator, setUsingSimulator] = useState(false)

  const room = useRoomSession(signalHandlerRef)
  const barGames = useBarGames({
    roomCode: room.roomCode,
    joined: room.joined,
    localUserId: room.localUserId,
    localProfile: room.localProfile,
    barGamesBridgeRef: room.barGamesBridgeRef,
    broadcastBarGamesEvent: room.broadcastBarGamesEvent,
    appendSystemMessage: room.appendSystemMessage,
  })

  const {
    joined: roomJoined,
    isLocalPresenter: roomIsLocalPresenter,
    presenterState: roomPresenterState,
    localProfile: roomLocalProfile,
    roomCustomization,
    computedSeats,
    takeControl: roomTakeControl,
    updatePresenterMedia: roomUpdatePresenterMedia,
    updateLocalProfile: roomUpdateLocalProfile,
    updateRoomCustomization: roomUpdateCustomization,
    resetRoomCustomization: roomResetCustomization,
    importRoomCustomizationJson: roomImportBlueprintJson,
    joinRoom: roomJoinRoom,
  } = room

  const activeSeat = useMemo<ComputedSeat>(() => {
    const byId = roomLocalProfile.seatId
      ? computedSeats.find((s) => s.id === roomLocalProfile.seatId)
      : undefined
    return byId ?? computedSeats[roomLocalProfile.seatIndex] ?? computedSeats[0]
  }, [computedSeats, roomLocalProfile.seatId, roomLocalProfile.seatIndex])

  const skyBgColor =
    LIGHTING_PRESETS[roomCustomization.lighting.preset]?.skyBg ?? '#111724'

  const handleScreenShareEndedByBrowser = useCallback(() => {
    if (roomIsLocalPresenter && roomPresenterState.screenMode === 'tab-stream') {
      roomUpdatePresenterMedia({
        screenMode: 'idle',
        isPlaying: false,
      })
    }
  }, [roomIsLocalPresenter, roomPresenterState.screenMode, roomUpdatePresenterMedia])

  const webrtc = useWebRTC({
    joined: room.joined,
    inVRSession,
    localUserId: room.localUserId,
    participants: room.participants,
    activePresenterId: room.presenterState.activePresenterId,
    isMuted: room.localProfile.isMuted,
    selectedMicId,
    sendSignal: room.sendWebRTCSignal,
    onScreenShareEndedByBrowser: handleScreenShareEndedByBrowser,
  })

  const {
    localScreenStream: webrtcLocalScreenStream,
    startTabShare: webrtcStartTabShare,
    stopTabShare: webrtcStopTabShare,
  } = webrtc

  useEffect(() => {
    signalHandlerRef.current = webrtc.handleWebRTCSignal
  }, [webrtc.handleWebRTCSignal])

  const handlePresenterHeartbeatProgress = useCallback(
    (currentTime: number, duration: number) => {
      roomUpdatePresenterMedia(
        {
          currentTime,
          duration,
        },
        false,
      )
    },
    [roomUpdatePresenterMedia],
  )

  const media = useMediaScreen({
    presenterState: room.presenterState,
    localUserId: room.localUserId,
    localScreenStream: webrtc.localScreenStream,
    remoteScreenStreams: webrtc.remoteScreenStreams,
    cinemaVolume,
    selectedSpeakerId,
    onPresenterProgress: handlePresenterHeartbeatProgress,
  })

  const {
    localCurrentTime: mediaLocalCurrentTime,
    localDuration: mediaLocalDuration,
    seekLocalVideo: mediaSeekLocalVideo,
    unlockAudio: unlockMediaAudio,
  } = media

  const handleInVRChange = useCallback(
    (activeVR: boolean) => {
      setInVRSession(activeVR)
      if (!activeVR) {
        setUsingSimulator(false)
      }
      if (roomJoined) {
        roomUpdateLocalProfile({ inVR: activeVR })
      }
    },
    [roomJoined, roomUpdateLocalProfile],
  )

  const handleEnterVR = useCallback(
    async (
      vrAttemptPromise: Promise<{ ok: boolean; usedEmulator: boolean; error?: string }>,
    ) => {
      unlockMediaAudio()
      const res = await vrAttemptPromise
      if (res.ok) {
        setUsingSimulator(res.usedEmulator)
      } else if (res.error) {
        setStatusBanner(res.error)
      }
    },
    [unlockMediaAudio],
  )

  const handleJoinRoom = useCallback(
    async (
      opts: JoinRoomOptions,
      vrAttemptPromise: Promise<{
        ok: boolean
        usedEmulator: boolean
        error?: string
      }> | null,
    ) => {
      unlockMediaAudio()
      if (vrAttemptPromise) {
        const [, vrResult] = await Promise.all([roomJoinRoom(opts), vrAttemptPromise])
        if (vrResult.ok) {
          setUsingSimulator(vrResult.usedEmulator)
        } else {
          roomUpdateLocalProfile({ inVR: false })
          setStatusBanner(
            vrResult.error
              ? `Could not enter VR (${vrResult.error}) — joined room in 3D Desktop Mode.`
              : 'Could not start VR session — joined room in 3D Desktop Mode.',
          )
        }
      } else {
        await roomJoinRoom(opts)
      }
    },
    [roomJoinRoom, roomUpdateLocalProfile, unlockMediaAudio],
  )

  const handleStartTabShare = useCallback(async () => {
    if (!roomIsLocalPresenter) {
      const claimed = roomTakeControl('tab-stream')
      if (!claimed) return
    }
    const result = await webrtcStartTabShare()
    if (!result.ok) {
      setStatusBanner(result.error ?? 'Unable to share browser tab.')
      return
    }
    roomUpdatePresenterMedia({
      screenMode: 'tab-stream',
      mediaTitle: result.title ?? 'Live Browser Tab',
      isPlaying: true,
    })
  }, [roomIsLocalPresenter, roomTakeControl, roomUpdatePresenterMedia, webrtcStartTabShare])

  const handleStopTabShare = useCallback(() => {
    webrtcStopTabShare()
    if (roomIsLocalPresenter) {
      roomUpdatePresenterMedia({
        screenMode: 'idle',
        isPlaying: false,
      })
    }
  }, [roomIsLocalPresenter, roomUpdatePresenterMedia, webrtcStopTabShare])

  const handleLoadStreamUrl = useCallback(
    (url: string, title = 'Cinema Stream', useCorsProxy = false) => {
      if (!roomIsLocalPresenter) {
        const claimed = roomTakeControl('url-sync')
        if (!claimed) return
      }
      if (webrtcLocalScreenStream) {
        webrtcStopTabShare()
      }
      roomUpdatePresenterMedia({
        screenMode: 'url-sync',
        mediaUrl: url,
        mediaTitle: title,
        useCorsProxy,
        currentTime: 0,
        isPlaying: true,
      })
      unlockMediaAudio()
    },
    [
      roomIsLocalPresenter,
      roomTakeControl,
      roomUpdatePresenterMedia,
      unlockMediaAudio,
      webrtcLocalScreenStream,
      webrtcStopTabShare,
    ],
  )

  const handleTogglePlayPause = useCallback(() => {
    if (!roomIsLocalPresenter || roomPresenterState.screenMode !== 'url-sync') return
    const nextPlaying = !roomPresenterState.isPlaying
    roomUpdatePresenterMedia({
      isPlaying: nextPlaying,
      currentTime: mediaLocalCurrentTime,
      duration: mediaLocalDuration,
    })
  }, [
    mediaLocalCurrentTime,
    mediaLocalDuration,
    roomIsLocalPresenter,
    roomPresenterState.isPlaying,
    roomPresenterState.screenMode,
    roomUpdatePresenterMedia,
  ])

  const handleSeekTo = useCallback(
    (targetSeconds: number) => {
      if (!roomIsLocalPresenter || roomPresenterState.screenMode !== 'url-sync') return
      const clamped = Math.max(
        0,
        mediaLocalDuration > 0 ? Math.min(mediaLocalDuration, targetSeconds) : targetSeconds,
      )
      mediaSeekLocalVideo(clamped)
      roomUpdatePresenterMedia({
        currentTime: clamped,
        duration: mediaLocalDuration,
      })
    },
    [
      mediaLocalDuration,
      mediaSeekLocalVideo,
      roomIsLocalPresenter,
      roomPresenterState.screenMode,
      roomUpdatePresenterMedia,
    ],
  )

  const handleSeekRelative = useCallback(
    (deltaSeconds: number) => {
      handleSeekTo(mediaLocalCurrentTime + deltaSeconds)
    },
    [handleSeekTo, mediaLocalCurrentTime],
  )

  const handleSeekFraction = useCallback(
    (fraction: number) => {
      if (mediaLocalDuration <= 0) return
      handleSeekTo(fraction * mediaLocalDuration)
    },
    [handleSeekTo, mediaLocalDuration],
  )

  const handleToggleMute = useCallback(() => {
    roomUpdateLocalProfile({ isMuted: !roomLocalProfile.isMuted })
  }, [roomLocalProfile.isMuted, roomUpdateLocalProfile])

  const handleToggleYouTubeBrowser = useCallback(() => {
    setYoutubeBrowserOpen((open) => {
      const next = !open
      if (next) {
        setBuildMode(false)
      } else {
        setKeyboardMode((m) => (m === 'youtube' ? null : m))
      }
      return next
    })
  }, [])

  const handleOpenYouTubeBrowser = useCallback(() => {
    setBuildMode(false)
    setYoutubeBrowserOpen(true)
  }, [])

  const handleCloseYouTubeBrowser = useCallback(() => {
    setYoutubeBrowserOpen(false)
    setKeyboardMode((m) => (m === 'youtube' ? null : m))
  }, [])

  const handleOpenYouTubeSearchKeyboard = useCallback(() => {
    setYoutubeBrowserOpen(true)
    setKeyboardMode((m) => (m === 'youtube' ? null : 'youtube'))
  }, [])

  const handleSubmitYouTubeSearch = useCallback((query: string) => {
    setYoutubeSearchQuery(query.trim())
    setYoutubeSearchTrigger((n) => n + 1)
    setYoutubeBrowserOpen(true)
  }, [])

  const handleClearYouTubeSearch = useCallback(() => {
    setYoutubeSearchQuery('')
    setYoutubeSearchTrigger((n) => n + 1)
  }, [])

  const handleSelectYouTubeVideo = useCallback(
    (video: YouTubeVideoItem, keepOpen: boolean) => {
      handleLoadStreamUrl(video.playUrl, video.title, false)
      if (!keepOpen) {
        setYoutubeBrowserOpen(false)
      }
      setKeyboardMode(null)
    },
    [handleLoadStreamUrl],
  )

  // =========================================================================
  // HANGOUT BUILDER, ARCHITECTURE, SCREEN & MOOD HANDLERS
  // =========================================================================

  const handleToggleBuildMode = useCallback((enabled?: boolean) => {
    setBuildMode((prev) => {
      const next = typeof enabled === 'boolean' ? enabled : !prev
      if (next) {
        setYoutubeBrowserOpen(false)
        setBarGamesOpen(false)
      } else {
        setSelectedFurnitureId(null)
        setEditingPosterItemId(null)
        setKeyboardMode((m) => (m === 'poster' ? null : m))
      }
      return next
    })
  }, [])

  const handleSpawnFurniture = useCallback(
    (type: FurnitureCatalogId) => {
      const entry = getCatalogEntry(type)
      const newId = `furn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

      roomUpdateCustomization((prev) => {
        const sizeSpec =
          ROOM_SIZE_SPECS[prev.architecture.sizePreset] ?? ROOM_SIZE_SPECS.classic
        const halfW = sizeSpec.width / 2

        let spawnPos: [number, number, number]
        let spawnRotY = 0

        if (entry.placementSurface === 'wall') {
          const wallItemsCount = prev.furniture.filter(
            (f) => getCatalogEntry(f.type).placementSurface === 'wall',
          ).length
          const mountLeft = wallItemsCount % 2 === 0
          const wallX = mountLeft ? -(halfW - 0.1) : halfW - 0.1
          const wallZ = Number(
            Math.max(
              sizeSpec.frontZ + 2.2,
              Math.min(sizeSpec.backZ - 2.2, activeSeat.position[2] - 0.8),
            ).toFixed(2),
          )
          spawnPos = [Number(wallX.toFixed(2)), 2.75, wallZ]
          spawnRotY = mountLeft ? Math.PI / 2 : -Math.PI / 2
        } else {
          // Spawn ~2.0m in front of the user's current seat with slight jitter to avoid exact overlap
          const jitterX = (prev.furniture.length % 3 - 1) * 0.45
          const rawX =
            activeSeat.position[0] - Math.sin(activeSeat.rotationY) * 2.0 + jitterX
          const rawZ =
            activeSeat.position[2] - Math.cos(activeSeat.rotationY) * 2.0
          const clampedX = Number(
            Math.max(-(halfW - 0.9), Math.min(halfW - 0.9, rawX)).toFixed(2),
          )
          const clampedZ = Number(
            Math.max(
              sizeSpec.frontZ + 1.2,
              Math.min(sizeSpec.backZ - 1.2, rawZ),
            ).toFixed(2),
          )
          const onBalcony =
            prev.architecture.rearBalcony &&
            Math.abs(clampedX) < 4.7 &&
            clampedZ > sizeSpec.balconyZ - 1.65 &&
            clampedZ < sizeSpec.balconyZ + 1.65
          spawnPos = [clampedX, onBalcony ? 0.38 : 0, clampedZ]
          spawnRotY = Number(activeSeat.rotationY.toFixed(4))
        }

        const newItem: PlacedFurnitureItem = {
          id: newId,
          type,
          position: spawnPos,
          rotationY: spawnRotY,
          scale: 1,
          color: entry.defaultColor,
          imageUrl: entry.defaultImageUrl,
          label: entry.defaultLabel,
        }

        return {
          ...prev,
          furniture: [...prev.furniture, newItem],
        }
      })

      setBuildMode(true)
      setSelectedFurnitureId(newId)
    },
    [activeSeat.position, activeSeat.rotationY, roomUpdateCustomization],
  )

  const handleUpdateFurnitureItem = useCallback(
    (id: string, patch: Partial<PlacedFurnitureItem>) => {
      roomUpdateCustomization((prev) => ({
        ...prev,
        furniture: prev.furniture.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }))
    },
    [roomUpdateCustomization],
  )

  const handleDuplicateFurnitureItem = useCallback(
    (id: string) => {
      let clonedId: string | null = null
      roomUpdateCustomization((prev) => {
        const source = prev.furniture.find((f) => f.id === id)
        if (!source) return prev
        clonedId = `furn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
        const isWall = getCatalogEntry(source.type).placementSurface === 'wall'
        const clone: PlacedFurnitureItem = {
          ...source,
          id: clonedId,
          position: isWall
            ? [
                source.position[0],
                source.position[1],
                Number((source.position[2] + 1.6).toFixed(2)),
              ]
            : [
                Number((source.position[0] + 0.95).toFixed(2)),
                source.position[1],
                Number((source.position[2] + 0.35).toFixed(2)),
              ],
        }
        return {
          ...prev,
          furniture: [...prev.furniture, clone],
        }
      })
      if (clonedId) setSelectedFurnitureId(clonedId)
    },
    [roomUpdateCustomization],
  )

  const handleDeleteFurnitureItem = useCallback(
    (id: string) => {
      roomUpdateCustomization((prev) => ({
        ...prev,
        furniture: prev.furniture.filter((item) => item.id !== id),
      }))
      setSelectedFurnitureId((curr) => (curr === id ? null : curr))
    },
    [roomUpdateCustomization],
  )

  const handleEditFurnitureMediaInVR = useCallback((id: string) => {
    setEditingPosterItemId(id)
    setKeyboardMode('poster')
  }, [])

  const handleSubmitPosterKeyboardValue = useCallback(
    (val: string) => {
      const targetId = editingPosterItemId ?? selectedFurnitureId
      if (!targetId) return
      roomUpdateCustomization((prev) => ({
        ...prev,
        furniture: prev.furniture.map((item) => {
          if (item.id !== targetId) return item
          if (item.type === 'neon-sign') {
            return { ...item, label: val.toUpperCase().slice(0, 16) }
          }
          return { ...item, imageUrl: val }
        }),
      }))
      setEditingPosterItemId(null)
    },
    [editingPosterItemId, roomUpdateCustomization, selectedFurnitureId],
  )

  const handleUpdateArchitecture = useCallback(
    (patch: Partial<RoomArchitectureConfig>) => {
      roomUpdateCustomization((prev) => ({
        ...prev,
        architecture: {
          ...prev.architecture,
          ...patch,
        },
      }))
    },
    [roomUpdateCustomization],
  )

  const handleUpdateLighting = useCallback(
    (patch: Partial<RoomLightingConfig>) => {
      roomUpdateCustomization((prev) => ({
        ...prev,
        lighting: {
          ...prev.lighting,
          ...patch,
        },
      }))
    },
    [roomUpdateCustomization],
  )

  const handleApplyLightingPreset = useCallback(
    (presetId: LightingPresetId) => {
      const spec = LIGHTING_PRESETS[presetId]
      if (!spec) return
      roomUpdateCustomization((prev) => ({
        ...prev,
        lighting: {
          ...prev.lighting,
          preset: presetId,
          brightness: spec.brightness,
          accentColor: spec.accentColor,
          ambientTint: spec.ambientTint,
        },
      }))
    },
    [roomUpdateCustomization],
  )

  const handleUpdateScreen = useCallback(
    (patch: Partial<RoomScreenTransform>) => {
      roomUpdateCustomization((prev) => ({
        ...prev,
        screen: {
          ...prev.screen,
          ...patch,
        },
      }))
    },
    [roomUpdateCustomization],
  )

  const editingPosterInitialValue = useMemo(() => {
    const targetId = editingPosterItemId ?? selectedFurnitureId
    if (!targetId) return ''
    const item = roomCustomization.furniture.find((f) => f.id === targetId)
    if (!item) return ''
    return item.type === 'neon-sign' ? (item.label ?? '') : (item.imageUrl ?? '')
  }, [editingPosterItemId, roomCustomization.furniture, selectedFurnitureId])

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#080a0d]">
      {/* Persistent WebGL / WebXR Canvas (mounted behind Gate & Lobby so store.enterVR() works on click 0) */}
      <Canvas
        events={noEvents}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
        camera={{ fov: 62, near: 0.08, far: 65, position: [0, 1.35, 1.2] }}
      >
        <color attach="background" args={[skyBgColor]} />
        <fog attach="fog" args={[skyBgColor, 18, 44]} />

        <CanvasRootBoundary>
          <XR store={xrStore}>
            <PointerEvents batchEvents={false} />

            {/* Keep XROrigin & core CinemaRoom outside Suspense so VR renders on Frame 0 */}
            <SeatCameraAndOriginRig
              seat={activeSeat}
              screenCenter={roomCustomization.screen.position}
              recenterVersion={recenterVersion}
              onInVRChange={handleInVRChange}
            >
              {room.joined && (
                <>
                  <SceneSectionBoundary>
                    <YouTubeBrowser3D
                      visible={youtubeBrowserOpen}
                      keyboardOpenForSearch={keyboardMode === 'youtube'}
                      searchQuery={youtubeSearchQuery}
                      searchTrigger={youtubeSearchTrigger}
                      activeMediaUrl={room.presenterState.mediaUrl}
                      relatedVideos={media.relatedVideos}
                      onOpenSearchKeyboard={handleOpenYouTubeSearchKeyboard}
                      onVoiceSearchQuery={handleSubmitYouTubeSearch}
                      onClearSearch={handleClearYouTubeSearch}
                      onSelectVideo={handleSelectYouTubeVideo}
                      onClose={handleCloseYouTubeBrowser}
                    />
                  </SceneSectionBoundary>

                  <SceneSectionBoundary>
                    <BuildModePanel3D
                      visible={buildMode && inVRSession}
                      customization={roomCustomization}
                      selectedFurnitureId={selectedFurnitureId}
                      onSpawnFurniture={handleSpawnFurniture}
                      onUpdateFurnitureItem={handleUpdateFurnitureItem}
                      onDeleteFurnitureItem={handleDeleteFurnitureItem}
                      onEditFurnitureMedia={handleEditFurnitureMediaInVR}
                      onUpdateArchitecture={handleUpdateArchitecture}
                      onUpdateLighting={handleUpdateLighting}
                      onApplyLightingPreset={handleApplyLightingPreset}
                      onUpdateScreen={handleUpdateScreen}
                      onResetRoom={roomResetCustomization}
                      onClose={() => handleToggleBuildMode(false)}
                    />
                  </SceneSectionBoundary>

                  {(inVRSession ||
                    !activeSeat?.stationKind ||
                    activeSeat.stationKind === 'seat') && (
                    <SceneSectionBoundary>
                      <SpatialControlDock
                        presenterState={room.presenterState}
                        isLocalPresenter={room.isLocalPresenter}
                        canTakeControl={room.canTakeControl}
                        isMuted={room.localProfile.isMuted}
                        cinemaVolume={cinemaVolume}
                        voiceVolume={voiceVolume}
                        localCurrentTime={media.localCurrentTime}
                        localDuration={media.localDuration}
                        chatPanelOpen={spatialChatOpen}
                        youtubeBrowserOpen={youtubeBrowserOpen}
                        buildModeOpen={buildMode}
                        youtubeSearchQuery={youtubeSearchQuery}
                        posterInitialValue={editingPosterInitialValue}
                        keyboardMode={keyboardMode}
                        onSetKeyboardMode={setKeyboardMode}
                        onToggleYouTubeBrowser={handleToggleYouTubeBrowser}
                        onToggleBuildMode={() => handleToggleBuildMode()}
                        onSubmitYouTubeSearch={handleSubmitYouTubeSearch}
                        onSubmitPosterValue={handleSubmitPosterKeyboardValue}
                        onTakeControl={() => room.takeControl()}
                        onReleaseControl={() => {
                          webrtc.stopTabShare()
                          room.releaseControl()
                        }}
                        onTogglePlayPause={handleTogglePlayPause}
                        onSeekRelative={handleSeekRelative}
                        onSeekFraction={handleSeekFraction}
                        onSelectStreamUrl={(url, title) => handleLoadStreamUrl(url, title, false)}
                        onStartTabShare={() => void handleStartTabShare()}
                        onToggleMute={handleToggleMute}
                        onChangeCinemaVolume={setCinemaVolume}
                        onChangeVoiceVolume={setVoiceVolume}
                        onSendReaction={(emoji) => room.sendReaction(emoji)}
                        onSendChatMessage={room.sendChatMessage}
                        onToggleChatPanel={() => setSpatialChatOpen((v) => !v)}
                        onRecenterSeat={() => setRecenterVersion((v) => v + 1)}
                        localSeatId={room.localProfile.seatId}
                        onSelectSeat={room.selectSeat}
                        atGameStation={Boolean(
                          activeSeat?.stationKind && activeSeat.stationKind !== 'seat',
                        )}
                      />
                    </SceneSectionBoundary>
                  )}
                </>
              )}
            </SeatCameraAndOriginRig>

            <CinemaRoom
              roomCode={room.roomCode}
              presenterState={room.presenterState}
              roomCustomization={roomCustomization}
              computedSeats={computedSeats}
              videoTexture={media.videoTexture}
              hasVideoFrames={media.hasVideoFrames}
              isResolvingMedia={media.isResolvingMedia}
              activeStreamQuality={media.activeStreamQuality}
              mediaError={media.mediaError}
              needsAudioUnlock={media.needsAudioUnlock}
              localSeatId={room.localProfile.seatId}
              localSeatIndex={room.localProfile.seatIndex}
              participants={room.participants}
              canTakeControl={room.canTakeControl}
              buildMode={buildMode}
              selectedFurnitureId={selectedFurnitureId}
              onTakeControl={() => room.takeControl()}
              onOpenYouTubeBrowser={room.joined ? handleOpenYouTubeBrowser : undefined}
              onUnlockAudio={media.unlockAudio}
              onSelectSeat={room.selectSeat}
              onSelectFurniture={setSelectedFurnitureId}
              onUpdateFurnitureItem={handleUpdateFurnitureItem}
              onDuplicateFurnitureItem={handleDuplicateFurnitureItem}
              onDeleteFurnitureItem={handleDeleteFurnitureItem}
              onEditFurnitureMedia={handleEditFurnitureMediaInVR}
            />

            <SceneSectionBoundary>
              <BarGamesCorner3D
                localUserId={room.localUserId}
                localDisplayName={room.localProfile.displayName}
                localSeatId={room.localProfile.seatId}
                participants={room.participants}
                roomCustomization={roomCustomization}
                buildMode={buildMode}
                dartsState={barGames.dartsState}
                puttingState={barGames.puttingState}
                tabletopState={barGames.tabletopState}
                clubhouseState={barGames.clubhouseState}
                activeDartShot={barGames.activeDartShot}
                activePuttShot={barGames.activePuttShot}
                onSelectSeat={room.selectSeat}
                onOpen2DPropsDrawer={
                  !inVRSession
                    ? () => {
                        setBuildMode(false)
                        setBarGamesTab('props')
                        setBarGamesOpen(true)
                      }
                    : undefined
                }
                onLaunchDartShot={barGames.launchDartShot}
                onSettleDartShot={barGames.settleDartShot}
                onJoinDarts={barGames.joinDartsMatch}
                onConfigureDarts={barGames.configureDartsMatch}
                onResetDarts={barGames.resetDartsMatch}
                onLaunchPuttShot={barGames.launchPuttShot}
                onSettlePuttShot={barGames.settlePuttShot}
                onJoinPutting={barGames.joinPuttingMatch}
                onConfigurePutting={barGames.configurePuttingMatch}
                onResetBallToTee={barGames.resetPuttingBallToTee}
                onResetPutting={barGames.resetPuttingMatch}
                onRollDice={barGames.rollPolyhedralDice}
                onRerollSingleDie={barGames.rerollSingleDie}
                onSetSurface={barGames.setTableSurface}
                onShuffleDeck={barGames.shuffleDeck}
                onDrawCardToHand={barGames.drawCardToHand}
                onPlayCardFromHand={barGames.playCardFromHand}
                onDealCardToTable={barGames.dealCardToTable}
                onFlipTableCard={barGames.flipTableCard}
                onResetDeck={barGames.resetCardDeck}
                onSpawnToken={barGames.spawnTableToken}
                onMoveToken={barGames.moveTableToken}
                onCreateProp={barGames.createPredictionProp}
                onPickPropOption={barGames.pickPropOption}
                onLockProp={barGames.lockPredictionProp}
                onResolveProp={barGames.resolvePredictionProp}
              />
            </SceneSectionBoundary>

            <SceneSectionBoundary>
              <AvatarManager
                joined={room.joined}
                localProfile={room.localProfile}
                participants={room.participants}
                computedSeats={computedSeats}
                activePresenterId={room.presenterState.activePresenterId}
                remotePosesRef={room.remotePosesRef}
                remoteVoiceStreams={webrtc.remoteVoiceStreams}
                voiceVolume={voiceVolume}
                broadcastPose={room.broadcastPose}
              />
            </SceneSectionBoundary>

            <SceneSectionBoundary>
              <SpatialChatPanel
                visible={room.joined && spatialChatOpen}
                messages={room.messages}
                reactions={room.reactions}
                screenTransform={roomCustomization.screen}
                onSendReaction={(emoji) => room.sendReaction(emoji)}
                onOpenChatKeyboard={() => {
                  setSpatialChatOpen(true)
                  setKeyboardMode('chat')
                }}
                onClosePanel={() => setSpatialChatOpen(false)}
              />
            </SceneSectionBoundary>
          </XR>
        </CanvasRootBoundary>
      </Canvas>

      {/* Secret Passcode Gate (blocks unauthenticated visitors before Lobby while keeping Canvas alive) */}
      {!passcodeUnlocked && (
        <PasscodeGate onUnlocked={() => setPasscodeUnlocked(true)} />
      )}

      {/* 2D Lobby & Desktop Companion Presenter Bar */}
      {passcodeUnlocked && (
        <CompanionOverlay
          joined={room.joined}
          connected={room.connected}
          inVRSession={inVRSession}
          roomCode={room.roomCode}
          transportMode={room.transportMode}
          localProfile={room.localProfile}
          participants={room.participants}
          computedSeats={computedSeats}
          roomCustomization={roomCustomization}
          buildMode={buildMode}
          selectedFurnitureId={selectedFurnitureId}
          passcodeEnabled={passcodeEnabled}
          presenterState={room.presenterState}
          isLocalPresenter={room.isLocalPresenter}
          canTakeControl={room.canTakeControl}
          messages={room.messages}
          audioInputs={webrtc.audioInputs}
          audioOutputs={webrtc.audioOutputs}
          selectedMicId={selectedMicId}
          selectedSpeakerId={selectedSpeakerId}
          micPermissionError={webrtc.micPermissionError}
          localMicLevel={webrtc.localMicLevel}
          isSharingTab={Boolean(webrtc.localScreenStream)}
          cinemaVolume={cinemaVolume}
          voiceVolume={voiceVolume}
          localCurrentTime={media.localCurrentTime}
          localDuration={media.localDuration}
          mediaError={media.mediaError}
          needsAudioUnlock={media.needsAudioUnlock}
          statusBanner={statusBanner}
          onDismissBanner={() => setStatusBanner(null)}
          onLockPasscode={() => {
            lockDevicePasscode()
            setPasscodeUnlocked(false)
          }}
          onSelectMic={setSelectedMicId}
          onSelectSpeaker={setSelectedSpeakerId}
          onJoinRoom={handleJoinRoom}
          onEnterVR={handleEnterVR}
          onLeaveRoom={async () => {
            webrtc.stopTabShare()
            setBuildMode(false)
            setBarGamesOpen(false)
            setSelectedFurnitureId(null)
            await room.leaveRoom()
          }}
          onToggleMute={handleToggleMute}
          onSelectSeat={room.selectSeat}
          onRecenterSeat={() => setRecenterVersion((v) => v + 1)}
          onToggleBuildMode={handleToggleBuildMode}
          onSelectFurniture={setSelectedFurnitureId}
          onSpawnFurniture={handleSpawnFurniture}
          onUpdateFurnitureItem={handleUpdateFurnitureItem}
          onDuplicateFurnitureItem={handleDuplicateFurnitureItem}
          onDeleteFurnitureItem={handleDeleteFurnitureItem}
          onUpdateArchitecture={handleUpdateArchitecture}
          onUpdateLighting={handleUpdateLighting}
          onApplyLightingPreset={handleApplyLightingPreset}
          onUpdateScreen={handleUpdateScreen}
          onResetRoom={roomResetCustomization}
          onImportBlueprintJson={roomImportBlueprintJson}
          onTakeControl={() => room.takeControl()}
          onReleaseControl={() => {
            webrtc.stopTabShare()
            room.releaseControl()
          }}
          onToggleHostLock={room.toggleHostLock}
          onStartTabShare={handleStartTabShare}
          onStopTabShare={handleStopTabShare}
          onLoadStreamUrl={handleLoadStreamUrl}
          onTogglePlayPause={handleTogglePlayPause}
          onSeekTo={handleSeekTo}
          onChangeCinemaVolume={setCinemaVolume}
          onChangeVoiceVolume={setVoiceVolume}
          onUnlockAudio={media.unlockAudio}
          onSendChat={room.sendChatMessage}
          onSendReaction={(emoji) => room.sendReaction(emoji)}
          barGamesOpen={barGamesOpen}
          onToggleBarGames={() => setBarGamesOpen((v) => !v)}
        />
      )}

      {/* 2D Bar Games, Tabletop & Clubhouse Props Drawer */}
      {passcodeUnlocked && room.joined && !inVRSession && (
        <BarGamesDrawer
          open={barGamesOpen}
          activeTab={barGamesTab}
          onChangeTab={setBarGamesTab}
          onClose={() => setBarGamesOpen(false)}
          localUserId={room.localUserId}
          localDisplayName={room.localProfile.displayName}
          localSeatId={room.localProfile.seatId}
          roomCustomization={roomCustomization}
          dartsState={barGames.dartsState}
          puttingState={barGames.puttingState}
          tabletopState={barGames.tabletopState}
          clubhouseState={barGames.clubhouseState}
          hasActiveDartShot={Boolean(barGames.activeDartShot)}
          hasActivePuttShot={Boolean(barGames.activePuttShot)}
          onSelectSeat={room.selectSeat}
          onLaunchDartShot={barGames.launchDartShot}
          onJoinDarts={barGames.joinDartsMatch}
          onConfigureDarts={barGames.configureDartsMatch}
          onResetDarts={barGames.resetDartsMatch}
          onLaunchPuttShot={barGames.launchPuttShot}
          onJoinPutting={barGames.joinPuttingMatch}
          onConfigurePutting={barGames.configurePuttingMatch}
          onResetBallToTee={barGames.resetPuttingBallToTee}
          onResetPutting={barGames.resetPuttingMatch}
          onRollDice={barGames.rollPolyhedralDice}
          onSetSurface={barGames.setTableSurface}
          onShuffleDeck={barGames.shuffleDeck}
          onDrawCardToHand={barGames.drawCardToHand}
          onPlayCardFromHand={barGames.playCardFromHand}
          onDealCardToTable={barGames.dealCardToTable}
          onFlipTableCard={barGames.flipTableCard}
          onResetDeck={barGames.resetCardDeck}
          onSpawnToken={barGames.spawnTableToken}
          onMoveToken={barGames.moveTableToken}
          onClearTokens={barGames.clearTableTokens}
          onCreateProp={barGames.createPredictionProp}
          onPickPropOption={barGames.pickPropOption}
          onLockProp={barGames.lockPredictionProp}
          onResolveProp={barGames.resolvePredictionProp}
          onDeleteProp={barGames.deletePredictionProp}
        />
      )}

      {inVRSession && usingSimulator && (
        <button
          id="btn-exit-vr-simulator"
          type="button"
          onClick={() => exitVRSession()}
          style={{ zIndex: 1100 }}
          className="pointer-events-auto fixed bottom-4 left-4 flex items-center gap-2 rounded-xl border border-[#e5a93c]/50 bg-[#080a0d]/90 px-4 py-2.5 text-xs font-semibold text-[#f4f1ea] shadow-xl backdrop-blur-md transition hover:border-[#e5a93c] hover:bg-[#141922]"
        >
          <span className="h-2 w-2 rounded-full bg-[#e5a93c]" />
          <span>Exit Quest 3 Simulator (Return to 2D Controls)</span>
        </button>
      )}
    </div>
  )
}

export default App
