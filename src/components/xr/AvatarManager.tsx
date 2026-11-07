import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { FREE_ROAM_SEAT_ID } from '../../constants/hangout'
import { readXRSpaceWorldPose } from '../../services/xrTracking'
import type {
  AvatarPose6DoF,
  AvatarStyleId,
  ComputedSeat,
  ParticipantProfile,
  Transform6DoF,
} from '../../types/lounge'

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
  remoteVoiceStreams: Record<string, MediaStream>
  voiceVolume: number
  broadcastPose: (pose: AvatarPose6DoF) => void
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

function VisorHeadGeometry({
  style,
  color,
}: {
  style: AvatarStyleId
  color: string
}) {
  return (
    <group>
      {/* Sculpted head shell */}
      <RoundedBox args={[0.23, 0.21, 0.24]} radius={0.075} smoothness={4}>
        <meshStandardMaterial color="#1C222E" roughness={0.42} metalness={0.35} />
      </RoundedBox>

      {/* Front glossy visor facing -Z (Three.js camera forward direction) */}
      <RoundedBox
        args={style === 'visor-sleek' ? [0.245, 0.085, 0.06] : [0.24, 0.115, 0.07]}
        radius={0.03}
        smoothness={3}
        position={[0, 0.015, -0.105]}
      >
        <meshStandardMaterial color="#07090D" roughness={0.14} metalness={0.85} />
      </RoundedBox>

      {/* Avatar accent trim */}
      <mesh position={[0, style === 'visor-sleek' ? 0.062 : 0.076, -0.125]}>
        <boxGeometry args={[0.19, 0.014, 0.02]} />
        <meshBasicMaterial color={color} />
      </mesh>

      {/* Style-specific silhouette accents */}
      {style === 'visor-halo' && (
        <mesh position={[0, 0.095, 0.01]} rotation={[0.28, 0, 0]}>
          <torusGeometry args={[0.135, 0.014, 10, 28]} />
          <meshBasicMaterial color={color} />
        </mesh>
      )}

      {style === 'visor-studio' && (
        <>
          <mesh position={[-0.128, 0.0, -0.01]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.048, 0.048, 0.032, 16]} />
            <meshStandardMaterial color={color} roughness={0.35} metalness={0.45} />
          </mesh>
          <mesh position={[0.128, 0.0, -0.01]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.048, 0.048, 0.032, 16]} />
            <meshStandardMaterial color={color} roughness={0.35} metalness={0.45} />
          </mesh>
        </>
      )}
    </group>
  )
}

interface RemoteAvatarProps {
  participant: ParticipantProfile
  computedSeats: ComputedSeat[]
  isPresenter: boolean
  remotePosesRef: React.RefObject<Map<string, AvatarPose6DoF>>
  voiceStream: MediaStream | undefined
  listener: THREE.AudioListener
  voiceVolume: number
}

function RemoteAvatar({
  participant,
  computedSeats,
  isPresenter,
  remotePosesRef,
  voiceStream,
  listener,
  voiceVolume,
}: RemoteAvatarProps) {
  const headGroupRef = useRef<THREE.Group>(null)
  const torsoGroupRef = useRef<THREE.Group>(null)
  const leftHandRef = useRef<THREE.Group>(null)
  const rightHandRef = useRef<THREE.Group>(null)
  const nameplateRef = useRef<THREE.Group>(null)
  const speakRingRef = useRef<THREE.Mesh>(null)
  const positionalAudioRef = useRef<THREE.PositionalAudio | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const freqBinsRef = useRef<Uint8Array<ArrayBuffer> | null>(null)

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

  // Attach WebRTC voice MediaStream to THREE.PositionalAudio + Web Audio AnalyserNode
  useEffect(() => {
    const headObj = headGroupRef.current
    if (!headObj || !voiceStream) {
      analyserRef.current = null
      freqBinsRef.current = null
      return
    }

    // Hidden muted DOM <audio> keeps Chromium/Quest WebRTC jitter buffer active
    const keepAliveAudio = document.createElement('audio')
    keepAliveAudio.srcObject = voiceStream
    keepAliveAudio.muted = true
    keepAliveAudio.setAttribute('playsinline', 'true')
    void keepAliveAudio.play().catch(() => undefined)

    let posAudio: THREE.PositionalAudio | null = null
    let analyser: AnalyserNode | null = null

    try {
      const ctx = listener.context
      if (ctx.state === 'suspended') {
        void ctx.resume().catch(() => undefined)
      }

      posAudio = new THREE.PositionalAudio(listener)
      posAudio.setRefDistance(2.2)
      posAudio.setRolloffFactor(1.15)
      posAudio.setDistanceModel('inverse')
      posAudio.setMediaStreamSource(voiceStream)
      posAudio.setVolume(participant.isMuted ? 0 : voiceVolume)
      headObj.add(posAudio)
      positionalAudioRef.current = posAudio

      analyser = ctx.createAnalyser()
      analyser.fftSize = 64
      analyser.smoothingTimeConstant = 0.6
      if (posAudio.source) {
        posAudio.source.connect(analyser)
      }
      analyserRef.current = analyser
      freqBinsRef.current = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount))
    } catch (err) {
      console.warn('PositionalAudio attach warning:', err)
    }

    return () => {
      keepAliveAudio.pause()
      keepAliveAudio.srcObject = null
      analyserRef.current = null
      freqBinsRef.current = null
      if (posAudio) {
        try {
          posAudio.disconnect()
        } catch {
          // Ignore already disconnected
        }
        headObj.remove(posAudio)
      }
      positionalAudioRef.current = null
    }
  }, [listener, participant.isMuted, participant.userId, voiceStream, voiceVolume])

  // Dynamically update PositionalAudio gain when volume slider or mute state changes
  useEffect(() => {
    if (positionalAudioRef.current) {
      positionalAudioRef.current.setVolume(participant.isMuted ? 0 : voiceVolume)
    }
  }, [participant.isMuted, voiceVolume])

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

    // Left & Right tracked VR controllers / hands (or relaxed seated rest pose)
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

    // Billboard nameplate toward local viewer's camera
    if (nameplateRef.current && headGroupRef.current) {
      nameplateRef.current.position.set(
        headGroupRef.current.position.x,
        headGroupRef.current.position.y + 0.28,
        headGroupRef.current.position.z,
      )
      nameplateRef.current.lookAt(camera.position)
    }

    // Speaking indicator ring driven by Web Audio API AnalyserNode
    if (speakRingRef.current && headGroupRef.current) {
      speakRingRef.current.position.set(
        headGroupRef.current.position.x,
        headGroupRef.current.position.y - 0.14,
        headGroupRef.current.position.z,
      )

      let level = 0
      if (!participant.isMuted && analyserRef.current && freqBinsRef.current) {
        analyserRef.current.getByteFrequencyData(freqBinsRef.current)
        let sum = 0
        for (let i = 0; i < freqBinsRef.current.length; i++) {
          sum += freqBinsRef.current[i]
        }
        level = Math.min(1, sum / (freqBinsRef.current.length * 80))
      }

      const speaking = level > 0.06
      const scale = speaking ? 1 + level * 0.42 : 0.88
      speakRingRef.current.scale.setScalar(scale)
      const mat = speakRingRef.current.material as THREE.MeshBasicMaterial
      mat.opacity = speaking ? Math.min(0.95, 0.38 + level * 0.75) : 0.12
      mat.color.set(speaking ? '#52B788' : participant.avatarColor)
    }
  })

  const statusTag = [
    participant.inVR ? 'VR' : 'DESKTOP',
    participant.seatId === FREE_ROAM_SEAT_ID ? 'WALKING' : null,
    isPresenter ? 'PRESENTING' : null,
    participant.isMuted ? 'MUTED' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return (
    <group name={`remote-avatar-${participant.userId}`}>
      {/* Head + Visor + Spatial Audio mount */}
      <group
        ref={headGroupRef}
        position={[seat.position[0], seat.position[1] + 1.16, seat.position[2]]}
      >
        <VisorHeadGeometry
          style={participant.avatarStyle}
          color={participant.avatarColor}
        />
      </group>

      {/* Stylized floating lounge torso */}
      <group
        ref={torsoGroupRef}
        position={[seat.position[0], seat.position[1] + 0.82, seat.position[2]]}
      >
        <RoundedBox args={[0.34, 0.36, 0.18]} radius={0.08} smoothness={3}>
          <meshStandardMaterial color="#181F2B" roughness={0.68} metalness={0.18} />
        </RoundedBox>
        <mesh position={[0, 0.09, -0.092]}>
          <boxGeometry args={[0.22, 0.025, 0.01]} />
          <meshBasicMaterial color={participant.avatarColor} />
        </mesh>
      </group>

      {/* Speaking volume indicator ring */}
      <mesh ref={speakRingRef} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.16, 0.205, 28]} />
        <meshBasicMaterial color={participant.avatarColor} transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      {/* Tracked Left Hand / Controller */}
      <group ref={leftHandRef} visible={false}>
        <RoundedBox args={[0.075, 0.065, 0.14]} radius={0.028} smoothness={3}>
          <meshStandardMaterial color="#1D2432" roughness={0.45} metalness={0.35} />
        </RoundedBox>
        <mesh position={[0, 0.02, -0.04]}>
          <boxGeometry args={[0.045, 0.012, 0.05]} />
          <meshBasicMaterial color={participant.avatarColor} />
        </mesh>
      </group>

      {/* Tracked Right Hand / Controller */}
      <group ref={rightHandRef} visible={false}>
        <RoundedBox args={[0.075, 0.065, 0.14]} radius={0.028} smoothness={3}>
          <meshStandardMaterial color="#1D2432" roughness={0.45} metalness={0.35} />
        </RoundedBox>
        <mesh position={[0, 0.02, -0.04]}>
          <boxGeometry args={[0.045, 0.012, 0.05]} />
          <meshBasicMaterial color={participant.avatarColor} />
        </mesh>
      </group>

      {/* Billboarded Floating Nameplate */}
      <group ref={nameplateRef}>
        <RoundedBox args={[0.74, 0.19, 0.015]} radius={0.045} smoothness={2}>
          <meshBasicMaterial color="#0B0E13" transparent opacity={0.86} />
        </RoundedBox>
        <Text
          position={[0, 0.032, 0.012]}
          fontSize={0.066}
          color="#F4F1EA"
          maxWidth={0.68}
          anchorX="center"
          anchorY="middle"
        >
          {participant.displayName}
        </Text>
        <Text
          position={[0, -0.042, 0.012]}
          fontSize={0.042}
          color={isPresenter ? '#E5A93C' : participant.avatarColor}
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
  remoteVoiceStreams,
  voiceVolume,
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
  const scratchHeadPos = useMemo(() => new THREE.Vector3(), [])
  const scratchHeadQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchLeftPos = useMemo(() => new THREE.Vector3(), [])
  const scratchLeftQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchRightPos = useMemo(() => new THREE.Vector3(), [])
  const scratchRightQuat = useMemo(() => new THREE.Quaternion(), [])

  // Throttled ~20Hz (50ms) local 6DoF capture & broadcast
  useFrame(({ clock }) => {
    if (!joined) return
    const nowElapsed = clock.elapsedTime
    if (nowElapsed - lastBroadcastTimeRef.current < 0.05) return
    lastBroadcastTimeRef.current = nowElapsed

    const isRoaming = localProfile.seatId === FREE_ROAM_SEAT_ID
    const seat = resolveParticipantSeat(localProfile, computedSeats)

    if (inXRSession) {
      camera.getWorldPosition(scratchHeadPos)
      camera.getWorldQuaternion(scratchHeadQuat)
    } else if (isRoaming && localRoamPoseRef?.current) {
      // Desktop Free-Roam: broadcast live standing world coordinates across the lounge
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

    broadcastPose({
      userId: localProfile.userId,
      head: {
        position: [
          Number(scratchHeadPos.x.toFixed(4)),
          Number(scratchHeadPos.y.toFixed(4)),
          Number(scratchHeadPos.z.toFixed(4)),
        ],
        quaternion: [
          Number(scratchHeadQuat.x.toFixed(4)),
          Number(scratchHeadQuat.y.toFixed(4)),
          Number(scratchHeadQuat.z.toFixed(4)),
          Number(scratchHeadQuat.w.toFixed(4)),
        ],
      },
      leftHand: leftTransform,
      rightHand: rightTransform,
      seatIndex: isRoaming ? -1 : seat.index,
      seatId: isRoaming ? FREE_ROAM_SEAT_ID : seat.id,
      inVR: inXRSession,
      timestamp: Date.now(),
    })
  })

  const remoteParticipants = useMemo(
    () => participants.filter((p) => p.userId !== localProfile.userId),
    [localProfile.userId, participants],
  )

  return (
    <group name="avatar-manager">
      {remoteParticipants.map((remote) => (
        <RemoteAvatar
          key={remote.userId}
          participant={remote}
          computedSeats={computedSeats}
          isPresenter={remote.userId === activePresenterId}
          remotePosesRef={remotePosesRef}
          voiceStream={remoteVoiceStreams[remote.userId]}
          listener={audioListener}
          voiceVolume={voiceVolume}
        />
      ))}
    </group>
  )
}
