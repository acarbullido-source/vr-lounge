import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { resolveAvatarCustomization } from '../../constants/avatars'
import { FREE_ROAM_SEAT_ID } from '../../constants/hangout'
import { readXRSpaceWorldPose } from '../../services/xrTracking'
import type {
  AvatarPose6DoF,
  ComputedSeat,
  ParticipantProfile,
  Transform6DoF,
} from '../../types/lounge'
import { AvatarHand3D, AvatarHead3D, AvatarTorso3D } from './AvatarCharacterParts3D'

export interface AvatarManagerProps {
  joined: boolean
  localProfile: ParticipantProfile
  participants: ParticipantProfile[]
  computedSeats: ComputedSeat[]
  activePresenterId: string | null
  remotePosesRef: React.RefObject<Map<string, AvatarPose6DoF>>
  localRoamPoseRef?: React.RefObject<{
    position: [number, number, number]
    yaw: number
  }>
  isFlying?: boolean
  spectralGhostUserIds?: string[]
  remoteVoiceStreams: Record<string, MediaStream>
  voiceVolume: number
  selectedSpeakerId?: string
  broadcastPose: (pose: AvatarPose6DoF) => void
}

const activeVoiceAudioElements = new Set<HTMLAudioElement>()
const activeAudioContexts = new Set<AudioContext>()
let globalVoiceUnlockInstalled = false

export function resumeAllVoiceAudioOutputs(): void {
  for (const audioEl of activeVoiceAudioElements) {
    if (audioEl.paused && audioEl.srcObject) {
      void audioEl.play().catch(() => undefined)
    }
  }
  for (const ctx of activeAudioContexts) {
    if (ctx.state === 'suspended' || (ctx.state as string) === 'interrupted') {
      void ctx.resume().catch(() => undefined)
    }
  }
}

function ensureGlobalVoiceUnlockListener(): void {
  if (globalVoiceUnlockInstalled || typeof window === 'undefined') return
  globalVoiceUnlockInstalled = true

  window.addEventListener('pointerdown', resumeAllVoiceAudioOutputs, { passive: true })
  window.addEventListener('keydown', resumeAllVoiceAudioOutputs, { passive: true })
  window.addEventListener('touchstart', resumeAllVoiceAudioOutputs, { passive: true })
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        resumeAllVoiceAudioOutputs()
      }
    })
  }
}

function resolveParticipantSeat(
  participant: Pick<ParticipantProfile, 'seatId' | 'seatIndex'>,
  computedSeats: ComputedSeat[],
): ComputedSeat {
  const byId =
    participant.seatId && participant.seatId !== FREE_ROAM_SEAT_ID
      ? computedSeats.find((s) => s.id === participant.seatId)
      : undefined
  const byIndex =
    participant.seatIndex >= 0 ? computedSeats[participant.seatIndex] : undefined
  return (
    byId ??
    byIndex ??
    computedSeats[0] ?? {
      id: 'fallback:0',
      index: 0,
      furnitureId: 'fallback',
      furnitureType: 'fallback',
      label: 'Lounge Spot 1',
      position: [0, 0, 0.5],
      localCushionOffset: [0, 0, 0],
      seatHeightOffset: 0,
      rotationY: 0,
    }
  )
}

interface RemoteAvatarProps {
  participant: ParticipantProfile
  computedSeats: ComputedSeat[]
  isPresenter: boolean
  isSpectralGhost: boolean
  remotePosesRef: React.RefObject<Map<string, AvatarPose6DoF>>
  voiceStream: MediaStream | undefined
  listener: THREE.AudioListener
  voiceVolume: number
  selectedSpeakerId?: string
}

function RemoteAvatar({
  participant,
  computedSeats,
  isPresenter,
  isSpectralGhost,
  remotePosesRef,
  voiceStream,
  listener,
  voiceVolume,
  selectedSpeakerId,
}: RemoteAvatarProps) {
  const headGroupRef = useRef<THREE.Group>(null)
  const torsoGroupRef = useRef<THREE.Group>(null)
  const leftHandRef = useRef<THREE.Group>(null)
  const rightHandRef = useRef<THREE.Group>(null)
  const nameplateRef = useRef<THREE.Group>(null)
  const speakRingRef = useRef<THREE.Mesh>(null)
  const hoverRingRef = useRef<THREE.Group>(null)
  const speakLevelRef = useRef(0)
  const voiceAudioRef = useRef<HTMLAudioElement | null>(null)
  const distanceGainRef = useRef(1)
  const voiceVolumeRef = useRef(voiceVolume)
  const isMutedRef = useRef(participant.isMuted)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const freqBinsRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

  useEffect(() => {
    voiceVolumeRef.current = voiceVolume
    isMutedRef.current = participant.isMuted
  }, [participant.isMuted, voiceVolume])

  const cust = resolveAvatarCustomization(participant.avatarCustomization)
  const hasTallHat =
    cust.hat === 'wizard' || cust.hat === 'top-hat' || cust.hat === 'party-cone'
  const nameplateOffsetY = hasTallHat ? 0.44 : cust.hat !== 'none' ? 0.35 : 0.3

  const seat = resolveParticipantSeat(participant, computedSeats)
  const seatHeadY = seat.position[1] + seat.seatHeightOffset + 1.16

  const targetHeadPos = useMemo(
    () => new THREE.Vector3(seat.position[0], seatHeadY, seat.position[2]),
    [seat.position, seatHeadY],
  )
  const targetHeadQuat = useMemo(() => {
    const q = new THREE.Quaternion()
    q.setFromEuler(new THREE.Euler(0, seat.rotationY, 0))
    return q
  }, [seat.rotationY])

  const tmpPos = useMemo(() => new THREE.Vector3(), [])
  const tmpQuat = useMemo(() => new THREE.Quaternion(), [])
  const tmpEuler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])

  // Attach WebRTC voice MediaStream to native HTML <audio> output + decoupled Web Audio AnalyserNode
  useEffect(() => {
    if (!voiceStream) {
      voiceAudioRef.current = null
      analyserRef.current = null
      freqBinsRef.current = null
      return
    }

    ensureGlobalVoiceUnlockListener()

    // Primary audible voice playback via native HTMLAudioElement (immune to Web Audio
    // AudioContext suspension & works even when Three.js Canvas frameloop="never" on mobile)
    const voiceAudio = document.createElement('audio')
    voiceAudio.srcObject = voiceStream
    voiceAudio.autoplay = true
    voiceAudio.muted = false
    voiceAudio.setAttribute('playsinline', 'true')
    const initialVol = isMutedRef.current
      ? 0
      : Math.min(1, Math.max(0, voiceVolumeRef.current * distanceGainRef.current))
    voiceAudio.volume = initialVol

    if (selectedSpeakerId) {
      const sinkCapable = voiceAudio as HTMLAudioElement & {
        setSinkId?: (sinkId: string) => Promise<void>
      }
      if (typeof sinkCapable.setSinkId === 'function') {
        void sinkCapable.setSinkId(selectedSpeakerId).catch(() => undefined)
      }
    }

    voiceAudioRef.current = voiceAudio
    activeVoiceAudioElements.add(voiceAudio)

    const tryPlayVoice = () => {
      if (voiceAudio.srcObject) {
        void voiceAudio.play().catch(() => undefined)
      }
    }
    tryPlayVoice()

    const audioTrack = voiceStream.getAudioTracks()[0]
    if (audioTrack) {
      audioTrack.addEventListener('unmute', tryPlayVoice)
    }

    let sourceNode: MediaStreamAudioSourceNode | null = null
    let analyser: AnalyserNode | null = null

    try {
      const ctx = listener.context as AudioContext
      activeAudioContexts.add(ctx)
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined)
      }

      // Connect ONLY to AnalyserNode (not ctx.destination) so speaking ring & mouth animate
      // without causing double audio or muting when AudioContext is suspended.
      sourceNode = ctx.createMediaStreamSource(voiceStream)
      analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.6
      sourceNode.connect(analyser)
      analyserRef.current = analyser
      freqBinsRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
    } catch (err) {
      console.warn('Voice analyser attach warning:', err)
    }

    return () => {
      if (audioTrack) {
        audioTrack.removeEventListener('unmute', tryPlayVoice)
      }
      activeVoiceAudioElements.delete(voiceAudio)
      voiceAudio.pause()
      voiceAudio.srcObject = null
      if (voiceAudioRef.current === voiceAudio) {
        voiceAudioRef.current = null
      }
      analyserRef.current = null
      freqBinsRef.current = null
      if (sourceNode) {
        try {
          sourceNode.disconnect()
        } catch {
          // Ignore already disconnected
        }
      }
    }
  }, [listener, participant.userId, selectedSpeakerId, voiceStream])

  // Dynamically update voice <audio> volume when volume slider or mute state changes
  useEffect(() => {
    const audioEl = voiceAudioRef.current
    if (!audioEl) return
    audioEl.volume = participant.isMuted
      ? 0
      : Math.min(1, Math.max(0, voiceVolume * distanceGainRef.current))
    if (!participant.isMuted && audioEl.paused && audioEl.srcObject) {
      void audioEl.play().catch(() => undefined)
    }
  }, [participant.isMuted, voiceVolume])

  // Dynamically switch audio output device (setSinkId) when selectedSpeakerId changes (including '' for Default)
  useEffect(() => {
    const audioEl = voiceAudioRef.current
    if (!audioEl || selectedSpeakerId === undefined) return
    const sinkCapable = audioEl as HTMLAudioElement & {
      setSinkId?: (sinkId: string) => Promise<void>
    }
    if (typeof sinkCapable.setSinkId === 'function') {
      void sinkCapable.setSinkId(selectedSpeakerId).catch(() => undefined)
    }
  }, [selectedSpeakerId])

  useFrame(({ camera }, delta) => {
    const alpha = 1 - Math.exp(-14 * Math.min(delta, 0.1))
    const pose = remotePosesRef.current?.get(participant.userId)

    if (pose) {
      targetHeadPos.set(pose.head.position[0], pose.head.position[1], pose.head.position[2])
      targetHeadQuat.set(
        pose.head.quaternion[0],
        pose.head.quaternion[1],
        pose.head.quaternion[2],
        pose.head.quaternion[3],
      )
    } else {
      targetHeadPos.set(seat.position[0], seatHeadY, seat.position[2])
      targetHeadQuat.setFromEuler(tmpEuler.set(0, seat.rotationY, 0))
    }

    if (headGroupRef.current) {
      headGroupRef.current.position.lerp(targetHeadPos, alpha)
      headGroupRef.current.quaternion.slerp(targetHeadQuat, alpha)

      // Gentle Clubhouse-wide proximity curve:
      // 100% volume within 12m, tapering smoothly to a 78% floor across distant rooms/wings
      // so participants never become inaudible when exploring other rooms or game stations.
      const dist = camera.position.distanceTo(headGroupRef.current.position)
      const nextGain =
        dist <= 12 ? 1 : Math.max(0.78, 1 - ((dist - 12) / 30) * 0.22)
      if (Math.abs(nextGain - distanceGainRef.current) > 0.015) {
        distanceGainRef.current = nextGain
        if (voiceAudioRef.current) {
          voiceAudioRef.current.volume = isMutedRef.current
            ? 0
            : Math.min(1, Math.max(0, voiceVolumeRef.current * nextGain))
        }
      }
    }

    // Torso follows head horizontally with yaw-only orientation
    if (torsoGroupRef.current && headGroupRef.current) {
      torsoGroupRef.current.position.set(
        headGroupRef.current.position.x,
        headGroupRef.current.position.y - 0.34,
        headGroupRef.current.position.z,
      )
      tmpEuler.setFromQuaternion(headGroupRef.current.quaternion, 'YXZ')
      torsoGroupRef.current.rotation.set(0, tmpEuler.y, 0)
    }

    // Left & Right tracked VR controllers / hands
    if (leftHandRef.current && headGroupRef.current) {
      if (pose?.leftHand) {
        leftHandRef.current.visible = true
        tmpPos.set(
          pose.leftHand.position[0],
          pose.leftHand.position[1],
          pose.leftHand.position[2],
        )
        tmpQuat.set(
          pose.leftHand.quaternion[0],
          pose.leftHand.quaternion[1],
          pose.leftHand.quaternion[2],
          pose.leftHand.quaternion[3],
        )
        leftHandRef.current.position.lerp(tmpPos, alpha)
        leftHandRef.current.quaternion.slerp(tmpQuat, alpha)
      } else {
        leftHandRef.current.visible = Boolean(pose?.inVR)
      }
    }

    if (rightHandRef.current && headGroupRef.current) {
      if (pose?.rightHand) {
        rightHandRef.current.visible = true
        tmpPos.set(
          pose.rightHand.position[0],
          pose.rightHand.position[1],
          pose.rightHand.position[2],
        )
        tmpQuat.set(
          pose.rightHand.quaternion[0],
          pose.rightHand.quaternion[1],
          pose.rightHand.quaternion[2],
          pose.rightHand.quaternion[3],
        )
        rightHandRef.current.position.lerp(tmpPos, alpha)
        rightHandRef.current.quaternion.slerp(tmpQuat, alpha)
      } else {
        rightHandRef.current.visible = Boolean(pose?.inVR)
      }
    }

    // Billboard nameplate toward local viewer's camera (auto-elevated above tall hats!)
    if (nameplateRef.current && headGroupRef.current) {
      nameplateRef.current.position.set(
        headGroupRef.current.position.x,
        headGroupRef.current.position.y + nameplateOffsetY,
        headGroupRef.current.position.z,
      )
      nameplateRef.current.lookAt(camera.position)
    }

    // Speaking indicator ring + voice-reactive LED mouth level driven by Web Audio AnalyserNode
    let level = 0
    if (!participant.isMuted && analyserRef.current && freqBinsRef.current) {
      analyserRef.current.getByteFrequencyData(freqBinsRef.current)
      let sum = 0
      for (let i = 0; i < freqBinsRef.current.length; i++) {
        sum += freqBinsRef.current[i]
      }
      level = Math.min(1, sum / (freqBinsRef.current.length * 80))
    }
    speakLevelRef.current = level

    if (speakRingRef.current && headGroupRef.current) {
      speakRingRef.current.position.set(
        headGroupRef.current.position.x,
        headGroupRef.current.position.y - 0.14,
        headGroupRef.current.position.z,
      )
      const speaking = level > 0.06
      const scale = speaking ? 1 + level * 0.42 : 0.88
      speakRingRef.current.scale.setScalar(scale)
      const mat = speakRingRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = speaking ? Math.min(0.95, 0.38 + level * 0.75) : 0.12
      mat.color.set(speaking ? '#52B788' : participant.avatarColor)
    }

    // Antigravity Hover Ring & Thruster Glow when remote player is flying in 3D space
    if (hoverRingRef.current && headGroupRef.current) {
      const airborne = Boolean(
        pose?.isFlying || (pose && pose.head.position[1] > 2.15),
      )
      hoverRingRef.current.visible = airborne
      if (airborne) {
        hoverRingRef.current.position.set(
          headGroupRef.current.position.x,
          headGroupRef.current.position.y - 0.68,
          headGroupRef.current.position.z,
        )
        hoverRingRef.current.rotation.y += delta * 2.4
      }
    }
  })

  const latestPose = remotePosesRef.current?.get(participant.userId)
  const isRemoteFlying = Boolean(
    latestPose?.isFlying || (latestPose && latestPose.head.position[1] > 2.15),
  )

  const statusTag = [
    participant.inVR ? 'VR' : 'DESKTOP',
    isSpectralGhost ? '👻 GHOST' : null,
    isRemoteFlying
      ? '🚀 FLYING'
      : participant.seatId === FREE_ROAM_SEAT_ID
        ? 'WALKING'
        : null,
    isPresenter ? 'PRESENTING' : null,
    participant.isMuted ? 'MUTED' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  const nameplateTitle = cust.flairEmoji
    ? `${cust.flairEmoji} ${participant.displayName}`
    : participant.displayName

  return (
    <group name={`remote-avatar-${participant.userId}`}>
      {/* Modular 3D Head + Face + Hat + Spatial Audio mount */}
      <group
        ref={headGroupRef}
        position={[seat.position[0], seat.position[1] + 1.16, seat.position[2]]}
      >
        <AvatarHead3D
          style={participant.avatarStyle}
          accentColor={isSpectralGhost ? '#22D3EE' : participant.avatarColor}
          customization={cust}
          speakLevelRef={speakLevelRef}
        />
      </group>

      {/* Modular 3D Outfit + Floating Accessory Aura */}
      <group
        ref={torsoGroupRef}
        position={[seat.position[0], seat.position[1] + 0.82, seat.position[2]]}
      >
        <AvatarTorso3D
          accentColor={isSpectralGhost ? '#22D3EE' : participant.avatarColor}
          customization={cust}
        />
      </group>

      {/* Speaking volume indicator ring */}
      <mesh ref={speakRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.205, 28]} />
        <meshBasicMaterial
          color={participant.avatarColor}
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Airborne Antigravity Hover Thruster Disc (visible when remote player is in Fly Mode) */}
      <group ref={hoverRingRef} visible={false}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.24, 0.34, 28]} />
          <meshBasicMaterial
            color="#38BDF8"
            transparent
            opacity={0.72}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
          <ringGeometry args={[0.12, 0.2, 24]} />
          <meshBasicMaterial
            color="#E5A93C"
            transparent
            opacity={0.62}
            side={THREE.DoubleSide}
          />
        </mesh>
      </group>

      {/* Tracked Left Hand / Controller */}
      <group ref={leftHandRef} visible={false}>
        <AvatarHand3D
          accentColor={participant.avatarColor}
          bodyColor={cust.bodyColor}
          isSpectralGhost={isSpectralGhost}
        />
      </group>

      {/* Tracked Right Hand / Controller */}
      <group ref={rightHandRef} visible={false}>
        <AvatarHand3D
          accentColor={participant.avatarColor}
          bodyColor={cust.bodyColor}
          isSpectralGhost={isSpectralGhost}
        />
      </group>

      {/* Billboarded Floating Nameplate */}
      <group ref={nameplateRef}>
        <RoundedBox args={[0.78, 0.19, 0.015]} radius={0.045} smoothness={2}>
          <meshBasicMaterial color="#0B0E13" transparent opacity={0.86} />
        </RoundedBox>
        <Text
          position={[0, 0.032, 0.012]}
          fontSize={0.064}
          color={isSpectralGhost ? '#67E8F9' : '#F4F1EA'}
          maxWidth={0.72}
          anchorX="center"
          anchorY="middle"
        >
          {nameplateTitle}
        </Text>
        <Text
          position={[0, -0.042, 0.012]}
          fontSize={0.042}
          color={isSpectralGhost ? '#22D3EE' : isPresenter ? '#E5A93C' : participant.avatarColor}
          anchorX="center"
          anchorY="middle"
        >
          {statusTag}
        </Text>
      </group>
    </group>
  )
}

export function AvatarManager({
  joined,
  localProfile,
  participants,
  computedSeats,
  activePresenterId,
  remotePosesRef,
  localRoamPoseRef,
  isFlying = false,
  spectralGhostUserIds = [],
  remoteVoiceStreams,
  voiceVolume,
  selectedSpeakerId,
  broadcastPose,
}: AvatarManagerProps) {
  const { camera, gl } = useThree()
  const xrSession = useXR((s) => s.session)
  const xrOrigin = useXR((s) => s.origin)
  const xrOriginRefSpace = useXR((s) => s.originReferenceSpace)
  const inXRSession = Boolean(xrSession)

  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')
  const leftHand = useXRInputSourceState('hand', 'left')
  const rightHand = useXRInputSourceState('hand', 'right')
  const localLeftGhostHandRef = useRef<THREE.Group>(null)
  const localRightGhostHandRef = useRef<THREE.Group>(null)
  const isLocalSpectralGhost = spectralGhostUserIds.includes(localProfile.userId)

  // Single THREE.AudioListener mounted to the local viewer's camera for 3D spatial voice
  const audioListener = useMemo(() => new THREE.AudioListener(), [])

  useEffect(() => {
    camera.add(audioListener)
    return () => {
      camera.remove(audioListener)
    }
  }, [audioListener, camera])

  // Pre-allocated scratch math objects (zero per-frame heap allocations)
  const lastBroadcastTimeRef = useRef(0)
  const lastSentPoseSnapshotRef = useRef<{
    headPos: [number, number, number]
    headQuat: [number, number, number, number]
    leftPos: [number, number, number] | null
    rightPos: [number, number, number] | null
    seatId: string | undefined
    inVR: boolean
    isFlying: boolean
    sentAtElapsed: number
  } | null>(null)
  const scratchHeadPos = useMemo(() => new THREE.Vector3(), [])
  const scratchHeadQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchLeftPos = useMemo(() => new THREE.Vector3(), [])
  const scratchLeftQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchRightPos = useMemo(() => new THREE.Vector3(), [])
  const scratchRightQuat = useMemo(() => new THREE.Quaternion(), [])

  const remoteParticipants = useMemo(
    () => participants.filter((p) => p.userId !== localProfile.userId),
    [localProfile.userId, participants],
  )

  // Throttled ~20Hz (50ms) local 6DoF capture & broadcast with delta-threshold compression
  useFrame(({ clock }) => {
    // Update local VR Spectral Ghost hand overlays every frame if local player is a Spectral Ghost
    if (inXRSession && isLocalSpectralGhost) {
      const lObj = leftController?.object ?? leftHand?.object
      if (localLeftGhostHandRef.current && lObj) {
        lObj.getWorldPosition(localLeftGhostHandRef.current.position)
        lObj.getWorldQuaternion(localLeftGhostHandRef.current.quaternion)
        localLeftGhostHandRef.current.visible = true
      }
      const rObj = rightController?.object ?? rightHand?.object
      if (localRightGhostHandRef.current && rObj) {
        rObj.getWorldPosition(localRightGhostHandRef.current.position)
        rObj.getWorldQuaternion(localRightGhostHandRef.current.quaternion)
        localRightGhostHandRef.current.visible = true
      }
    } else {
      if (localLeftGhostHandRef.current) localLeftGhostHandRef.current.visible = false
      if (localRightGhostHandRef.current) localRightGhostHandRef.current.visible = false
    }

    // Never broadcast 6DoF poses when not joined or when alone in the room (0 remote participants)
    if (!joined || remoteParticipants.length === 0) return
    const nowElapsed = clock.elapsedTime
    if (nowElapsed - lastBroadcastTimeRef.current < 0.05) return
    lastBroadcastTimeRef.current = nowElapsed

    const isRoaming = localProfile.seatId === FREE_ROAM_SEAT_ID
    const seat = resolveParticipantSeat(localProfile, computedSeats)

    if (inXRSession) {
      camera.getWorldPosition(scratchHeadPos)
      camera.getWorldQuaternion(scratchHeadQuat)
    } else if (isRoaming && localRoamPoseRef?.current) {
      // Desktop Free-Roam / Fly Mode: broadcast live 3D world coordinates across the lounge
      const roamPos = localRoamPoseRef.current.position
      scratchHeadPos.set(roamPos[0], roamPos[1] + 1.54, roamPos[2])
      camera.getWorldQuaternion(scratchHeadQuat)
    } else {
      // Desktop Seated: anchor avatar body at chosen lounge chair while mirroring camera look direction
      scratchHeadPos.set(
        seat.position[0],
        seat.position[1] + seat.seatHeightOffset + 1.16,
        seat.position[2],
      )
      camera.getWorldQuaternion(scratchHeadQuat)
    }

    const xrFrame = inXRSession ? gl.xr.getFrame?.() : null
    const refSpace = inXRSession
      ? (xrOriginRefSpace ?? gl.xr.getReferenceSpace?.())
      : null

    let leftTransform: Transform6DoF | null = null
    const leftObj = leftController?.object ?? leftHand?.object
    if (inXRSession && leftObj) {
      leftObj.getWorldPosition(scratchLeftPos)
      leftObj.getWorldQuaternion(scratchLeftQuat)
      leftTransform = {
        position: [
          Number(scratchLeftPos.x.toFixed(4)),
          Number(scratchLeftPos.y.toFixed(4)),
          Number(scratchLeftPos.z.toFixed(4)),
        ],
        quaternion: [
          Number(scratchLeftQuat.x.toFixed(4)),
          Number(scratchLeftQuat.y.toFixed(4)),
          Number(scratchLeftQuat.z.toFixed(4)),
          Number(scratchLeftQuat.w.toFixed(4)),
        ],
      }
    } else if (inXRSession && xrFrame && refSpace) {
      const leftSrc = leftController?.inputSource ?? leftHand?.inputSource
      const leftSpace = leftSrc?.gripSpace ?? leftSrc?.targetRaySpace
      if (
        readXRSpaceWorldPose(
          xrFrame,
          leftSpace,
          refSpace,
          xrOrigin,
          scratchLeftPos,
          scratchLeftQuat,
        )
      ) {
        leftTransform = {
          position: [
            Number(scratchLeftPos.x.toFixed(4)),
            Number(scratchLeftPos.y.toFixed(4)),
            Number(scratchLeftPos.z.toFixed(4)),
          ],
          quaternion: [
            Number(scratchLeftQuat.x.toFixed(4)),
            Number(scratchLeftQuat.y.toFixed(4)),
            Number(scratchLeftQuat.z.toFixed(4)),
            Number(scratchLeftQuat.w.toFixed(4)),
          ],
        }
      }
    }

    let rightTransform: Transform6DoF | null = null
    const rightObj = rightController?.object ?? rightHand?.object
    if (inXRSession && rightObj) {
      rightObj.getWorldPosition(scratchRightPos)
      rightObj.getWorldQuaternion(scratchRightQuat)
      rightTransform = {
        position: [
          Number(scratchRightPos.x.toFixed(4)),
          Number(scratchRightPos.y.toFixed(4)),
          Number(scratchRightPos.z.toFixed(4)),
        ],
        quaternion: [
          Number(scratchRightQuat.x.toFixed(4)),
          Number(scratchRightQuat.y.toFixed(4)),
          Number(scratchRightQuat.z.toFixed(4)),
          Number(scratchRightQuat.w.toFixed(4)),
        ],
      }
    } else if (inXRSession && xrFrame && refSpace) {
      const rightSrc = rightController?.inputSource ?? rightHand?.inputSource
      const rightSpace = rightSrc?.gripSpace ?? rightSrc?.targetRaySpace
      if (
        readXRSpaceWorldPose(
          xrFrame,
          rightSpace,
          refSpace,
          xrOrigin,
          scratchRightPos,
          scratchRightQuat,
        )
      ) {
        rightTransform = {
          position: [
            Number(scratchRightPos.x.toFixed(4)),
            Number(scratchRightPos.y.toFixed(4)),
            Number(scratchRightPos.z.toFixed(4)),
          ],
          quaternion: [
            Number(scratchRightQuat.x.toFixed(4)),
            Number(scratchRightQuat.y.toFixed(4)),
            Number(scratchRightQuat.z.toFixed(4)),
            Number(scratchRightQuat.w.toFixed(4)),
          ],
        }
      }
    }

    const headPosTuple: [number, number, number] = [
      Number(scratchHeadPos.x.toFixed(4)),
      Number(scratchHeadPos.y.toFixed(4)),
      Number(scratchHeadPos.z.toFixed(4)),
    ]
    const headQuatTuple: [number, number, number, number] = [
      Number(scratchHeadQuat.x.toFixed(4)),
      Number(scratchHeadQuat.y.toFixed(4)),
      Number(scratchHeadQuat.z.toFixed(4)),
      Number(scratchHeadQuat.w.toFixed(4)),
    ]
    const effectiveSeatId = isRoaming ? FREE_ROAM_SEAT_ID : seat.id
    const effectiveFlying = Boolean(isFlying && isRoaming)

    // Delta-threshold compression: if head and hands have not moved (>1.5mm) or rotated (>0.0025 rad)
    // and seat/VR/fly state is unchanged, only send a periodic 5.0s keepalive snapshot.
    const prevSnap = lastSentPoseSnapshotRef.current
    if (prevSnap && nowElapsed - prevSnap.sentAtElapsed < 5.0) {
      const headMoved =
        Math.abs(headPosTuple[0] - prevSnap.headPos[0]) > 0.0015 ||
        Math.abs(headPosTuple[1] - prevSnap.headPos[1]) > 0.0015 ||
        Math.abs(headPosTuple[2] - prevSnap.headPos[2]) > 0.0015
      const headRotated =
        Math.abs(headQuatTuple[0] - prevSnap.headQuat[0]) > 0.0025 ||
        Math.abs(headQuatTuple[1] - prevSnap.headQuat[1]) > 0.0025 ||
        Math.abs(headQuatTuple[2] - prevSnap.headQuat[2]) > 0.0025 ||
        Math.abs(headQuatTuple[3] - prevSnap.headQuat[3]) > 0.0025
      const leftPos = leftTransform?.position ?? null
      const rightPos = rightTransform?.position ?? null
      const leftMoved =
        Boolean(leftPos) !== Boolean(prevSnap.leftPos) ||
        (leftPos !== null &&
          prevSnap.leftPos !== null &&
          (Math.abs(leftPos[0] - prevSnap.leftPos[0]) > 0.002 ||
            Math.abs(leftPos[1] - prevSnap.leftPos[1]) > 0.002 ||
            Math.abs(leftPos[2] - prevSnap.leftPos[2]) > 0.002))
      const rightMoved =
        Boolean(rightPos) !== Boolean(prevSnap.rightPos) ||
        (rightPos !== null &&
          prevSnap.rightPos !== null &&
          (Math.abs(rightPos[0] - prevSnap.rightPos[0]) > 0.002 ||
            Math.abs(rightPos[1] - prevSnap.rightPos[1]) > 0.002 ||
            Math.abs(rightPos[2] - prevSnap.rightPos[2]) > 0.002))
      const metaChanged =
        prevSnap.seatId !== effectiveSeatId ||
        prevSnap.inVR !== inXRSession ||
        prevSnap.isFlying !== effectiveFlying

      if (!headMoved && !headRotated && !leftMoved && !rightMoved && !metaChanged) {
        return
      }
    }

    lastSentPoseSnapshotRef.current = {
      headPos: headPosTuple,
      headQuat: headQuatTuple,
      leftPos: leftTransform?.position ?? null,
      rightPos: rightTransform?.position ?? null,
      seatId: effectiveSeatId,
      inVR: inXRSession,
      isFlying: effectiveFlying,
      sentAtElapsed: nowElapsed,
    }

    broadcastPose({
      userId: localProfile.userId,
      head: {
        position: headPosTuple,
        quaternion: headQuatTuple,
      },
      leftHand: leftTransform,
      rightHand: rightTransform,
      seatIndex: isRoaming ? -1 : seat.index,
      seatId: effectiveSeatId,
      inVR: inXRSession,
      isFlying: effectiveFlying,
      timestamp: Date.now(),
    })
  })

  return (
    <group name="avatar-manager">
      {/* Local VR Spectral Ghost Hand Overlays (translucent cyan when local hero is at 0 HP) */}
      <group ref={localLeftGhostHandRef} visible={false}>
        <AvatarHand3D accentColor="#67E8F9" isSpectralGhost />
      </group>
      <group ref={localRightGhostHandRef} visible={false}>
        <AvatarHand3D accentColor="#67E8F9" isSpectralGhost />
      </group>

      {remoteParticipants.map((remote) => (
        <RemoteAvatar
          key={remote.userId}
          participant={remote}
          computedSeats={computedSeats}
          isPresenter={remote.userId === activePresenterId}
          isSpectralGhost={spectralGhostUserIds.includes(remote.userId)}
          remotePosesRef={remotePosesRef}
          voiceStream={remoteVoiceStreams[remote.userId]}
          listener={audioListener}
          voiceVolume={voiceVolume}
          selectedSpeakerId={selectedSpeakerId}
        />
      ))}
    </group>
  )
}
