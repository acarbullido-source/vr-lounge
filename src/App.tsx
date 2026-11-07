import { OrbitControls } from '@react-three/drei'
import { Canvas, useThree } from '@react-three/fiber'
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
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { CompanionOverlay } from './components/ui/CompanionOverlay'
import { AvatarManager } from './components/xr/AvatarManager'
import { CinemaRoom } from './components/xr/CinemaRoom'
import { SpatialChatPanel } from './components/xr/SpatialChatPanel'
import { SpatialControlDock } from './components/xr/SpatialControlDock'
import type { VRKeyboardMode } from './components/xr/VRKeyboard3D'
import { LOUNGE_SEATS, SCREEN_CONFIG } from './constants/cinema'
import { useMediaScreen } from './hooks/useMediaScreen'
import { useRoomSession, type JoinRoomOptions } from './hooks/useRoomSession'
import { useWebRTC } from './hooks/useWebRTC'
import { exitVRSession, xrStore } from './store/xrStore'
import type { WebRTCSignalMessage } from './types/lounge'

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
      return (
        <ambientLight intensity={1.2} />
      )
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
  seatIndex: number
  recenterVersion: number
  onInVRChange: (inVR: boolean) => void
  children?: React.ReactNode
}

/**
 * Manages both:
 * 1. `<XROrigin>` placement & physical headset recentering inside immersive VR
 * 2. `<OrbitControls>` seated eye-level camera inside Desktop / Companion mode
 */
function SeatCameraAndOriginRig({
  seatIndex,
  recenterVersion,
  onInVRChange,
  children,
}: SeatRigProps) {
  const { camera } = useThree()
  const xrSession = useXR((s) => s.session)
  const inVR = Boolean(xrSession)

  const originRef = useRef<THREE.Group>(null)
  const orbitRef = useRef<OrbitControlsImpl>(null)
  const [vrLocalOffset, setVrLocalOffset] = useState<[number, number, number]>([0, 0, 0])

  const seat = LOUNGE_SEATS[seatIndex] ?? LOUNGE_SEATS[0]

  const onInVRChangeRef = useRef(onInVRChange)
  onInVRChangeRef.current = onInVRChange

  useEffect(() => {
    onInVRChangeRef.current(inVR)
  }, [inVR])

  // Reset VR local offset when hopping to a new lounge seat
  useEffect(() => {
    setVrLocalOffset([0, 0, 0])
  }, [seatIndex])

  // Position desktop camera cleanly in the selected lounge chair facing the screen
  useEffect(() => {
    if (inVR) return
    camera.position.set(
      seat.position[0],
      seat.position[1] + 1.24,
      seat.position[2] + 0.12,
    )
    if (orbitRef.current) {
      orbitRef.current.target.set(
        SCREEN_CONFIG.center[0],
        SCREEN_CONFIG.center[1] - 0.35,
        SCREEN_CONFIG.center[2] + 1.5,
      )
      orbitRef.current.update()
    } else {
      camera.lookAt(
        SCREEN_CONFIG.center[0],
        SCREEN_CONFIG.center[1] - 0.35,
        SCREEN_CONFIG.center[2] + 1.5,
      )
    }
  }, [camera, inVR, recenterVersion, seat.position])

  // Calibrate physical headset horizontal drift relative to seat when Recenter is clicked in VR
  useEffect(() => {
    if (!inVR || recenterVersion === 0 || !originRef.current) return
    const headWorld = new THREE.Vector3()
    camera.getWorldPosition(headWorld)
    const dx = seat.position[0] - headWorld.x
    const dz = seat.position[2] - headWorld.z
    setVrLocalOffset((prev) => [prev[0] + dx, 0, prev[2] + dz])
  }, [camera, inVR, recenterVersion, seat.position])

  return (
    <>
      <XROrigin
        ref={originRef}
        position={[
          seat.position[0] + vrLocalOffset[0],
          seat.position[1] + 0.08,
          seat.position[2] + vrLocalOffset[2],
        ]}
        rotation={[0, seat.rotationY, 0]}
      />

      {/* Ergonomic Spatial Dock anchored directly at the user's lounge chair */}
      <group position={seat.position} rotation={[0, seat.rotationY, 0]}>
        {children}
      </group>

      {/* Desktop OrbitControls disabled automatically during immersive VR sessions */}
      <IfInSessionMode deny={['immersive-vr', 'immersive-ar']}>
        <OrbitControls
          ref={orbitRef}
          enablePan={false}
          minDistance={2.5}
          maxDistance={12.5}
          minPolarAngle={Math.PI * 0.24}
          maxPolarAngle={Math.PI * 0.68}
          rotateSpeed={0.62}
        />
      </IfInSessionMode>
    </>
  )
}

export function App() {
  const signalHandlerRef = useRef<((signal: WebRTCSignalMessage) => void) | null>(null)

  const [selectedMicId, setSelectedMicId] = useState('')
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('')
  const [cinemaVolume, setCinemaVolume] = useState(0.8)
  const [voiceVolume, setVoiceVolume] = useState(0.9)
  const [inVRSession, setInVRSession] = useState(false)
  const [recenterVersion, setRecenterVersion] = useState(0)
  const [spatialChatOpen, setSpatialChatOpen] = useState(true)
  const [keyboardMode, setKeyboardMode] = useState<VRKeyboardMode | null>(null)
  const [statusBanner, setStatusBanner] = useState<string | null>(null)
  const [usingSimulator, setUsingSimulator] = useState(false)

  const room = useRoomSession(signalHandlerRef)

  const {
    joined: roomJoined,
    isLocalPresenter: roomIsLocalPresenter,
    presenterState: roomPresenterState,
    localProfile: roomLocalProfile,
    takeControl: roomTakeControl,
    updatePresenterMedia: roomUpdatePresenterMedia,
    updateLocalProfile: roomUpdateLocalProfile,
    joinRoom: roomJoinRoom,
  } = room

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

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#080a0d]">
      {/* Persistent WebGL / WebXR Canvas (mounted behind Lobby so store.enterVR() works on first click) */}
      <Canvas
        events={noEvents}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
        camera={{ fov: 62, near: 0.08, far: 60, position: [0, 1.35, 1.2] }}
      >
        <color attach="background" args={['#111724']} />
        <fog attach="fog" args={['#111724', 16, 38]} />

        <CanvasRootBoundary>
          <XR store={xrStore}>
            <PointerEvents batchEvents={false} />

            {/* Keep XROrigin & core CinemaRoom outside Suspense so VR renders on Frame 0 */}
            <SeatCameraAndOriginRig
              seatIndex={room.localProfile.seatIndex}
              recenterVersion={recenterVersion}
              onInVRChange={handleInVRChange}
            >
              {room.joined && (
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
                    keyboardMode={keyboardMode}
                    onSetKeyboardMode={setKeyboardMode}
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
                  />
                </SceneSectionBoundary>
              )}
            </SeatCameraAndOriginRig>

            <CinemaRoom
              roomCode={room.roomCode}
              presenterState={room.presenterState}
              videoTexture={media.videoTexture}
              hasVideoFrames={media.hasVideoFrames}
              mediaError={media.mediaError}
              needsAudioUnlock={media.needsAudioUnlock}
              localSeatIndex={room.localProfile.seatIndex}
              participants={room.participants}
              canTakeControl={room.canTakeControl}
              onTakeControl={() => room.takeControl()}
              onUnlockAudio={media.unlockAudio}
              onSelectSeat={room.selectSeat}
            />

            <SceneSectionBoundary>
              <AvatarManager
                joined={room.joined}
                localProfile={room.localProfile}
                participants={room.participants}
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

      {/* 2D Lobby & Desktop Companion Presenter Bar */}
      <CompanionOverlay
        joined={room.joined}
        connected={room.connected}
        inVRSession={inVRSession}
        roomCode={room.roomCode}
        transportMode={room.transportMode}
        localProfile={room.localProfile}
        participants={room.participants}
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
        onSelectMic={setSelectedMicId}
        onSelectSpeaker={setSelectedSpeakerId}
        onJoinRoom={handleJoinRoom}
        onEnterVR={handleEnterVR}
        onLeaveRoom={async () => {
          webrtc.stopTabShare()
          await room.leaveRoom()
        }}
        onToggleMute={handleToggleMute}
        onSelectSeat={room.selectSeat}
        onRecenterSeat={() => setRecenterVersion((v) => v + 1)}
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
      />

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
