import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { Suspense, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { LOUNGE_SEATS, SCREEN_CONFIG } from '../../constants/cinema'
import type { ParticipantProfile, PresenterState, SeatDefinition } from '../../types/lounge'

export interface CinemaRoomProps {
  roomCode: string
  presenterState: PresenterState
  videoTexture: THREE.VideoTexture
  hasVideoFrames: boolean
  isResolvingMedia?: boolean
  activeStreamQuality?: string | null
  mediaError: string | null
  needsAudioUnlock: boolean
  localSeatIndex: number
  participants: ParticipantProfile[]
  canTakeControl: boolean
  onTakeControl: () => void
  onOpenYouTubeBrowser?: () => void
  onUnlockAudio: () => void
  onSelectSeat: (seatIndex: number) => void
}

function createCurvedScreenGeometry(
  width: number,
  height: number,
  radius: number,
  segmentsX = 48,
): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, height, segmentsX, 2)
  const pos = geometry.attributes.position

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const theta = x / radius
    const curvedX = radius * Math.sin(theta)
    const curvedZ = radius * (1 - Math.cos(theta))
    pos.setX(i, curvedX)
    pos.setZ(i, curvedZ)
  }

  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

interface LoungeSeatMeshProps {
  seat: SeatDefinition
  isLocalSeat: boolean
  occupant: ParticipantProfile | undefined
  onSelect: (index: number) => void
}

function LoungeSeatMesh({
  seat,
  isLocalSeat,
  occupant,
  onSelect,
}: LoungeSeatMeshProps) {
  const [hovered, setHovered] = useState(false)
  const isOccupiedByOther = Boolean(occupant && !isLocalSeat)
  const InteractiveFlag = !isOccupiedByOther

  const trimColor = isLocalSeat
    ? '#E5A93C'
    : occupant
      ? occupant.avatarColor
      : hovered
        ? '#F2BE5C'
        : '#2C3545'

  return (
    <group
      position={seat.position}
      rotation={[0, seat.rotationY, 0]}
    >
      {/* Subtle floor seat ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.012, 0]}>
        <ringGeometry args={[0.56, 0.63, 32]} />
        <meshBasicMaterial
          color={trimColor}
          transparent
          opacity={isLocalSeat ? 0.72 : hovered ? 0.65 : 0.28}
        />
      </mesh>

      {/* Seat cushion & base — clickable to switch seats */}
      <group
        pointerEventsType={{ deny: 'grab' }}
        onPointerOver={(e) => {
          if (!InteractiveFlag) return
          e.stopPropagation()
          setHovered(true)
        }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          if (!InteractiveFlag) return
          e.stopPropagation()
          onSelect(seat.index)
        }}
      >
        {/* Base pedestal */}
        <RoundedBox args={[0.88, 0.24, 0.82]} radius={0.05} smoothness={3} position={[0, 0.14, 0]}>
          <meshStandardMaterial color="#181F2B" roughness={0.8} metalness={0.15} />
        </RoundedBox>

        {/* Plush seat cushion */}
        <RoundedBox args={[0.84, 0.16, 0.76]} radius={0.06} smoothness={3} position={[0, 0.32, -0.02]}>
          <meshStandardMaterial
            color={hovered && InteractiveFlag ? '#2B3648' : '#212938'}
            roughness={0.72}
            metalness={0.08}
          />
        </RoundedBox>

        {/* Contoured backrest (behind user along +Z since user faces -Z screen) */}
        <RoundedBox
          args={[0.84, 0.72, 0.18]}
          radius={0.07}
          smoothness={3}
          position={[0, 0.66, 0.33]}
          rotation={[0.14, 0, 0]}
        >
          <meshStandardMaterial color="#1E2533" roughness={0.76} metalness={0.08} />
        </RoundedBox>

        {/* Left & Right armrests with warm wood/metal trim */}
        <RoundedBox args={[0.11, 0.34, 0.74]} radius={0.04} smoothness={2} position={[-0.46, 0.42, 0.02]}>
          <meshStandardMaterial color="#1A202C" roughness={0.62} metalness={0.22} />
        </RoundedBox>
        <RoundedBox args={[0.11, 0.34, 0.74]} radius={0.04} smoothness={2} position={[0.46, 0.42, 0.02]}>
          <meshStandardMaterial color="#1A202C" roughness={0.62} metalness={0.22} />
        </RoundedBox>

        {/* Seat number badge on front apron (isolated Suspense so chair mesh renders on frame 0) */}
        <Suspense fallback={null}>
          <Text
            position={[0, 0.16, -0.42]}
            rotation={[0, Math.PI, 0]}
            fontSize={0.075}
            color={isLocalSeat ? '#E5A93C' : '#9CA3AF'}
            anchorX="center"
            anchorY="middle"
          >
            {seat.label.split('·')[0].trim()}
          </Text>
        </Suspense>
      </group>

      {/* Hover prompt to hop seats */}
      {hovered && InteractiveFlag && !isLocalSeat && (
        <group position={[0, 1.18, 0]}>
          <RoundedBox args={[0.72, 0.18, 0.02]} radius={0.04} smoothness={2}>
            <meshBasicMaterial color="#0D1015" transparent opacity={0.9} />
          </RoundedBox>
          <Suspense fallback={null}>
            <Text
              position={[0, 0, 0.015]}
              fontSize={0.068}
              color="#E5A93C"
              anchorX="center"
              anchorY="middle"
            >
              {`Sit Here (${seat.label.split('·')[0].trim()})`}
            </Text>
          </Suspense>
        </group>
      )}
    </group>
  )
}

export function CinemaRoom({
  roomCode,
  presenterState,
  videoTexture,
  hasVideoFrames,
  isResolvingMedia = false,
  activeStreamQuality = null,
  mediaError,
  needsAudioUnlock,
  localSeatIndex,
  participants,
  canTakeControl,
  onTakeControl,
  onOpenYouTubeBrowser,
  onUnlockAudio,
  onSelectSeat,
}: CinemaRoomProps) {
  const screenGlowRef = useRef<THREE.PointLight>(null)
  const [screenHovered, setScreenHovered] = useState(false)
  const [ytBtnHovered, setYtBtnHovered] = useState(false)

  const curvedScreenGeo = useMemo(
    () =>
      createCurvedScreenGeometry(
        SCREEN_CONFIG.width,
        SCREEN_CONFIG.height,
        SCREEN_CONFIG.curveRadius,
      ),
    [],
  )

  const curvedFrameGeo = useMemo(
    () =>
      createCurvedScreenGeometry(
        SCREEN_CONFIG.width + 0.34,
        SCREEN_CONFIG.height + 0.34,
        SCREEN_CONFIG.curveRadius + 0.05,
      ),
    [],
  )

  const isShowingVideo =
    presenterState.screenMode !== 'idle' &&
    Boolean(presenterState.activePresenterId) &&
    hasVideoFrames &&
    !mediaError

  // Subtle dynamic cinema bounce light pulse calibrated for Three.js r187 candela units
  useFrame(({ clock }) => {
    if (!screenGlowRef.current) return
    if (isShowingVideo && presenterState.isPlaying) {
      const wave = Math.sin(clock.elapsedTime * 1.9) * 1.4 + Math.cos(clock.elapsedTime * 0.7) * 0.9
      screenGlowRef.current.intensity = 18 + wave
    } else {
      screenGlowRef.current.intensity = 11.5
    }
  })

  const wallSlatOffsets = useMemo(() => [-6.2, -4.6, -3.0, -1.4, 0.2, 1.8, 3.4], [])

  return (
    <group name="vr-lounge-environment">
      {/* Physically calibrated lighting for 72Hz/90Hz Quest 3 VR visibility */}
      <ambientLight color="#DCE4F5" intensity={0.55} />
      <hemisphereLight args={['#3E5278', '#141924', 1.6]} />
      <pointLight
        ref={screenGlowRef}
        position={[0, 3.1, -4.1]}
        color={isShowingVideo ? '#DCE6F7' : '#F2C166'}
        intensity={12}
        distance={22}
        decay={1.35}
      />
      <pointLight
        position={[-4.6, 2.7, 1.0]}
        color="#E5A93C"
        intensity={8.5}
        distance={15}
        decay={1.45}
      />
      <pointLight
        position={[4.6, 2.7, 1.0]}
        color="#E5A93C"
        intensity={8.5}
        distance={15}
        decay={1.45}
      />
      <pointLight
        position={[0, 4.2, 2.2]}
        color="#C9D6EE"
        intensity={6.0}
        distance={16}
        decay={1.5}
      />

      {/* Main Cinema Room Shell */}
      {/* Matte dark acoustic floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, -1.2]}>
        <planeGeometry args={[15, 16]} />
        <meshStandardMaterial color="#10151E" roughness={0.92} metalness={0.05} />
      </mesh>

      {/* Center plush lounge rug */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, 0.6]}>
        <planeGeometry args={[7.8, 3.4]} />
        <meshStandardMaterial color="#18202E" roughness={0.95} metalness={0.02} />
      </mesh>

      {/* Elevated rear balcony riser tier */}
      <RoundedBox args={[9.4, 0.38, 3.2]} radius={0.04} smoothness={2} position={[0, 0.19, 3.1]}>
        <meshStandardMaterial color="#151B26" roughness={0.88} metalness={0.08} />
      </RoundedBox>

      {/* Warm amber step strip along front edge of balcony riser */}
      <mesh position={[0, 0.365, 1.49]}>
        <boxGeometry args={[9.1, 0.022, 0.03]} />
        <meshBasicMaterial color="#E5A93C" />
      </mesh>

      {/* Stage dais beneath the cinema screen */}
      <RoundedBox args={[10.4, 0.28, 1.9]} radius={0.05} smoothness={2} position={[0, 0.14, -6.3]}>
        <meshStandardMaterial color="#141923" roughness={0.8} metalness={0.16} />
      </RoundedBox>
      <mesh position={[0, 0.275, -5.36]}>
        <boxGeometry args={[9.6, 0.022, 0.034]} />
        <meshBasicMaterial color="#E5A93C" />
      </mesh>

      {/* Back & Front dark walls */}
      <mesh position={[0, 3.2, -7.6]}>
        <planeGeometry args={[15, 6.8]} />
        <meshStandardMaterial color="#0D1118" roughness={0.94} />
      </mesh>
      <mesh position={[0, 3.2, 6.2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[15, 6.8]} />
        <meshStandardMaterial color="#10151F" roughness={0.94} />
      </mesh>

      {/* Left & Right acoustic theater walls */}
      <mesh position={[-6.8, 3.2, -0.7]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[14.5, 6.8]} />
        <meshStandardMaterial color="#111722" roughness={0.9} />
      </mesh>
      <mesh position={[6.8, 3.2, -0.7]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[14.5, 6.8]} />
        <meshStandardMaterial color="#111722" roughness={0.9} />
      </mesh>

      {/* Recessed ceiling */}
      <mesh position={[0, 6.3, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[15, 14.5]} />
        <meshStandardMaterial color="#0A0E15" roughness={0.95} />
      </mesh>

      {/* Warm walnut acoustic wall ribs + subtle sconce glow */}
      {wallSlatOffsets.map((zPos) => (
        <group key={zPos}>
          <mesh position={[-6.72, 2.85, zPos]}>
            <boxGeometry args={[0.12, 4.9, 0.36]} />
            <meshStandardMaterial color="#241D17" roughness={0.75} metalness={0.1} />
          </mesh>
          <mesh position={[-6.65, 2.6, zPos]}>
            <boxGeometry args={[0.025, 0.72, 0.045]} />
            <meshBasicMaterial color="#E5A93C" />
          </mesh>

          <mesh position={[6.72, 2.85, zPos]}>
            <boxGeometry args={[0.12, 4.9, 0.36]} />
            <meshStandardMaterial color="#241D17" roughness={0.75} metalness={0.1} />
          </mesh>
          <mesh position={[6.65, 2.6, zPos]}>
            <boxGeometry args={[0.025, 0.72, 0.045]} />
            <meshBasicMaterial color="#E5A93C" />
          </mesh>
        </group>
      ))}

      {/* Low-poly center lounge table between screen and front row */}
      <group position={[0, 0, -1.55]}>
        <RoundedBox args={[2.1, 0.32, 0.78]} radius={0.06} smoothness={3} position={[0, 0.18, 0]}>
          <meshStandardMaterial color="#19202D" roughness={0.52} metalness={0.28} />
        </RoundedBox>
        {/* Warm coaster accents */}
        <mesh position={[-0.55, 0.345, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.09, 20]} />
          <meshBasicMaterial color="#E5A93C" />
        </mesh>
        <mesh position={[0.55, 0.345, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.09, 20]} />
          <meshBasicMaterial color="#E5A93C" />
        </mesh>
      </group>

      {/* ================================================================= */}
      {/* CURVED 16:9 CINEMA SCREEN                                         */}
      {/* ================================================================= */}
      <group position={SCREEN_CONFIG.center}>
        {/* Brushed dark bezel behind curved screen */}
        <mesh geometry={curvedFrameGeo} position={[0, 0, -0.06]}>
          <meshStandardMaterial
            color="#1A212E"
            emissive="#E5A93C"
            emissiveIntensity={isShowingVideo ? 0.04 : 0.14}
            roughness={0.58}
            metalness={0.35}
          />
        </mesh>

        {/* Active Video Texture Surface vs Idle Lounge Standby Canvas */}
        <mesh
          geometry={curvedScreenGeo}
          pointerEventsType={{ deny: 'grab' }}
          onPointerOver={() => setScreenHovered(true)}
          onPointerOut={() => setScreenHovered(false)}
          onClick={(e) => {
            e.stopPropagation()
            if (needsAudioUnlock) {
              onUnlockAudio()
              return
            }
            if (!presenterState.activePresenterId && canTakeControl) {
              if (onOpenYouTubeBrowser) {
                onOpenYouTubeBrowser()
              } else {
                onTakeControl()
              }
            }
          }}
        >
          {isShowingVideo ? (
            <meshBasicMaterial map={videoTexture} toneMapped={false} />
          ) : (
            <meshStandardMaterial
              color={screenHovered && !presenterState.activePresenterId ? '#1C2536' : '#141B28'}
              emissive="#182234"
              emissiveIntensity={0.45}
              roughness={0.8}
              metalness={0.1}
            />
          )}
        </mesh>

        {/* Screen Idle / Waiting / Error 3D Overlay (isolated Suspense so screen never blanks) */}
        {!isShowingVideo && (
          <group position={[0, 0, 0.42]}>
            {canTakeControl && !isResolvingMedia && (
              <group position={[0, -1.08, 0.02]}>
                {onOpenYouTubeBrowser && (
                  <group
                    position={[-1.42, 0, 0]}
                    pointerEventsType={{ deny: 'grab' }}
                    onPointerOver={(e) => {
                      e.stopPropagation()
                      setYtBtnHovered(true)
                    }}
                    onPointerOut={() => setYtBtnHovered(false)}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenYouTubeBrowser()
                    }}
                  >
                    <RoundedBox args={[2.55, 0.48, 0.04]} radius={0.09} smoothness={3}>
                      <meshBasicMaterial color={ytBtnHovered ? '#EA6B58' : '#E05A47'} />
                    </RoundedBox>
                    <Suspense fallback={null}>
                      <Text
                        position={[0, 0, 0.03]}
                        fontSize={0.165}
                        color="#F4F1EA"
                        anchorX="center"
                        anchorY="middle"
                      >
                        ▶ Browse YouTube in VR
                      </Text>
                    </Suspense>
                  </group>
                )}

                {!presenterState.activePresenterId && (
                  <group
                    position={[onOpenYouTubeBrowser ? 1.42 : 0, 0, 0]}
                    pointerEventsType={{ deny: 'grab' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onTakeControl()
                    }}
                  >
                    <RoundedBox args={[2.55, 0.48, 0.04]} radius={0.09} smoothness={3}>
                      <meshBasicMaterial color={screenHovered ? '#F2BE5C' : '#E5A93C'} />
                    </RoundedBox>
                    <Suspense fallback={null}>
                      <Text
                        position={[0, 0, 0.03]}
                        fontSize={0.165}
                        color="#0B0D10"
                        anchorX="center"
                        anchorY="middle"
                      >
                        Take Control of Screen
                      </Text>
                    </Suspense>
                  </group>
                )}
              </group>
            )}

            <Suspense fallback={null}>
              <Text
                position={[0, 0.92, 0]}
                fontSize={0.16}
                letterSpacing={0.16}
                color="#E5A93C"
                anchorX="center"
                anchorY="middle"
              >
                {`VR LOUNGE · ROOM ${roomCode || 'LOBBY'}`}
              </Text>

              <Text
                position={[0, 0.32, 0]}
                fontSize={0.42}
                color="#F4F1EA"
                maxWidth={7.2}
                textAlign="center"
                anchorX="center"
                anchorY="middle"
              >
                {isResolvingMedia
                  ? `Resolving "${presenterState.mediaTitle || 'YouTube Video'}"…`
                  : presenterState.activePresenterId
                    ? presenterState.screenMode === 'tab-stream'
                      ? `${presenterState.presenterName ?? 'Presenter'} is starting browser share...`
                      : `Loading "${presenterState.mediaTitle || 'Cinema Stream'}"...`
                    : 'Cinema Screen Ready'}
              </Text>

              <Text
                position={[0, -0.32, 0]}
                fontSize={0.18}
                color={mediaError ? '#E05A47' : '#C7C2B8'}
                maxWidth={6.8}
                textAlign="center"
                anchorX="center"
                anchorY="middle"
              >
                {mediaError
                  ? mediaError
                  : isResolvingMedia
                    ? 'Connecting to fastest CORS-enabled HD cinema relay for synchronized VR playback…'
                    : presenterState.activePresenterId
                      ? 'Tap "▶ YouTube" on your 3D seat dock to queue another video anytime.'
                      : 'Tap "▶ Browse YouTube in VR" — no PC required — or share a live desktop tab.'}
              </Text>
            </Suspense>
          </group>
        )}

        {/* Audio Autoplay Unlock Prompt inside 3D if browser blocked unmuted playback */}
        {needsAudioUnlock && isShowingVideo && (
          <group
            position={[0, -1.85, 0.2]}
            pointerEventsType={{ deny: 'grab' }}
            onClick={(e) => {
              e.stopPropagation()
              onUnlockAudio()
            }}
          >
            <RoundedBox args={[2.9, 0.42, 0.04]} radius={0.08} smoothness={3}>
              <meshBasicMaterial color="#E5A93C" />
            </RoundedBox>
            <Suspense fallback={null}>
              <Text
                position={[0, 0, 0.03]}
                fontSize={0.15}
                color="#0B0D10"
                anchorX="center"
                anchorY="middle"
              >
                Click Screen to Enable Cinema Audio
              </Text>
            </Suspense>
          </group>
        )}

        {/* Top subtle presenter status strip above bezel */}
        <group position={[0, SCREEN_CONFIG.height / 2 + 0.34, 0.05]}>
          <RoundedBox args={[5.2, 0.32, 0.03]} radius={0.07} smoothness={2}>
            <meshBasicMaterial color="#0D1015" transparent opacity={0.88} />
          </RoundedBox>
          <Suspense fallback={null}>
            <Text
              position={[0, 0, 0.022]}
              fontSize={0.12}
              color={presenterState.activePresenterId ? '#E5A93C' : '#9CA3AF'}
              anchorX="center"
              anchorY="middle"
            >
              {presenterState.activePresenterId
                ? `LIVE PRESENTER: ${(presenterState.presenterName ?? 'Guest').toUpperCase()} · ${
                    presenterState.screenMode === 'tab-stream'
                      ? 'BROWSER TAB'
                      : activeStreamQuality
                        ? activeStreamQuality.toUpperCase()
                        : 'SYNC STREAM'
                  }${presenterState.lockedByHostId ? ' · LOCKED' : ''}`
                : 'OPEN SCREEN · BROWSE YOUTUBE IN VR OR TAKE CONTROL'}
            </Text>
          </Suspense>
        </group>
      </group>

      {/* ================================================================= */}
      {/* 8 DESIGNATED LOUNGE SEATS                                         */}
      {/* ================================================================= */}
      {LOUNGE_SEATS.map((seat) => {
        const occupant = participants.find((p) => p.seatIndex === seat.index)
        return (
          <LoungeSeatMesh
            key={seat.index}
            seat={seat}
            isLocalSeat={seat.index === localSeatIndex}
            occupant={occupant}
            onSelect={onSelectSeat}
          />
        )
      })}
    </group>
  )
}
