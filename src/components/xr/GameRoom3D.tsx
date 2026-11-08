import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ExpansionWingLayout } from '../../constants/expansionRooms'
import type {
  HolotableMiniKind,
  HolotableMiniature,
  HolotableState,
  HolotableTerrainPresetId,
} from '../../types/barGames'
import type {
  ComputedSeat,
  ParticipantProfile,
  PresenterState,
  RoomLightingConfig,
} from '../../types/lounge'

interface HoloButton3DProps {
  name?: string
  label: string
  position: [number, number, number]
  width?: number
  height?: number
  active?: boolean
  accent?: string
  fontSize?: number
  onClick: () => void
}

function HoloButton3D({
  name,
  label,
  position,
  width = 0.34,
  height = 0.08,
  active = false,
  accent = '#A855F7',
  fontSize = 0.026,
  onClick,
}: HoloButton3DProps) {
  const [hovered, setHovered] = useState(false)
  const bg = active ? accent : hovered ? '#2E1065' : '#0F172A'
  const fg = active ? '#040810' : '#F8FAFC'

  return (
    <group
      name={name}
      position={position}
      pointerEventsType={{ deny: 'grab' }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <RoundedBox args={[width, height, 0.014]} radius={0.012} smoothness={2}>
        <meshBasicMaterial color={bg} />
      </RoundedBox>
      <Text
        position={[0, 0, 0.01]}
        fontSize={fontSize}
        color={fg}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  )
}

function SanctumChair3D({
  seat,
  isLocalSeat,
  occupant,
  onSelectSeat,
}: {
  seat: ComputedSeat
  isLocalSeat: boolean
  occupant?: ParticipantProfile
  onSelectSeat: (seatId: string) => void
}) {
  const [hovered, setHovered] = useState(false)
  const takenByOther = Boolean(occupant && !isLocalSeat)

  return (
    <group
      position={seat.position}
      rotation={[0, seat.rotationY, 0]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        if (!takenByOther) onSelectSeat(seat.id)
      }}
    >
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.26, 0.3, 0.05, 12]} />
        <meshStandardMaterial color="#1E1B4B" metalness={0.65} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.34, 10]} />
        <meshStandardMaterial color="#4C1D95" metalness={0.7} roughness={0.28} />
      </mesh>
      <RoundedBox args={[0.52, 0.09, 0.5]} position={[0, 0.41, 0]} radius={0.03}>
        <meshStandardMaterial
          color={hovered && !takenByOther ? '#5B21B6' : '#2E1065'}
          roughness={0.5}
          metalness={0.2}
          emissive="#1E1B4B"
          emissiveIntensity={0.3}
        />
      </RoundedBox>
      <RoundedBox
        args={[0.48, 0.68, 0.08]}
        position={[0, 0.78, 0.22]}
        rotation={[0.08, 0, 0]}
        radius={0.03}
      >
        <meshStandardMaterial
          color="#1E1B4B"
          roughness={0.5}
          metalness={0.25}
          emissive="#0F172A"
          emissiveIntensity={0.25}
        />
      </RoundedBox>
      <mesh position={[0, 1.08, 0.21]}>
        <boxGeometry args={[0.32, 0.025, 0.09]} />
        <meshBasicMaterial color={isLocalSeat ? '#F59E0B' : '#A855F7'} />
      </mesh>
      {(hovered || isLocalSeat) && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.34, 0.4, 24]} />
          <meshBasicMaterial
            color={isLocalSeat ? '#F59E0B' : takenByOther ? '#EF4444' : '#A855F7'}
          />
        </mesh>
      )}
    </group>
  )
}

function MiniatureMesh3D({
  mini,
  isSelected,
  onSelect,
}: {
  mini: HolotableMiniature
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <group
      name={`holo-mini-${mini.id}`}
      position={[mini.localPos[0], 0.87, mini.localPos[1]]}
      rotation={[0, mini.rotationY, 0]}
      scale={mini.scale}
      onClick={(e) => {
        e.stopPropagation()
        onSelect()
      }}
    >
      {/* Pedestal Token Base */}
      <mesh position={[0, 0.012, 0]}>
        <cylinderGeometry args={[0.068, 0.076, 0.024, 18]} />
        <meshStandardMaterial color="#0F172A" metalness={0.75} roughness={0.25} />
      </mesh>
      {isSelected && (
        <mesh position={[0, 0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.082, 0.102, 24]} />
          <meshBasicMaterial color="#38BDF8" side={THREE.DoubleSide} />
        </mesh>
      )}

      {/* Distinct 3D Sculpt per Miniature Kind */}
      {mini.kind === 'monster-dragon' ? (
        <group position={[0, 0.08, 0]}>
          <mesh position={[0, 0.04, 0]}>
            <coneGeometry args={[0.065, 0.16, 7]} />
            <meshStandardMaterial color={mini.color} roughness={0.35} metalness={0.25} />
          </mesh>
          {/* Dragon Wings */}
          <mesh position={[-0.065, 0.06, -0.01]} rotation={[0, 0, 0.55]}>
            <boxGeometry args={[0.09, 0.012, 0.06]} />
            <meshStandardMaterial color={mini.color} />
          </mesh>
          <mesh position={[0.065, 0.06, -0.01]} rotation={[0, 0, -0.55]}>
            <boxGeometry args={[0.09, 0.012, 0.06]} />
            <meshStandardMaterial color={mini.color} />
          </mesh>
          <mesh position={[0, 0.13, 0.03]}>
            <sphereGeometry args={[0.034, 10, 10]} />
            <meshStandardMaterial color={mini.color} />
          </mesh>
        </group>
      ) : mini.kind === 'monster-golem' ? (
        <group position={[0, 0.08, 0]}>
          <RoundedBox args={[0.095, 0.14, 0.075]} position={[0, 0.02, 0]} radius={0.015}>
            <meshStandardMaterial color={mini.color} roughness={0.6} metalness={0.35} />
          </RoundedBox>
          <mesh position={[0, 0.11, 0]}>
            <dodecahedronGeometry args={[0.038, 0]} />
            <meshStandardMaterial color={mini.color} />
          </mesh>
        </group>
      ) : mini.kind === 'prop-chest' ? (
        <group position={[0, 0.045, 0]}>
          <RoundedBox args={[0.09, 0.065, 0.065]} radius={0.01}>
            <meshStandardMaterial color={mini.color} metalness={0.55} roughness={0.3} />
          </RoundedBox>
        </group>
      ) : mini.kind === 'prop-portal' ? (
        <group position={[0, 0.09, 0]}>
          <mesh>
            <torusGeometry args={[0.065, 0.012, 10, 24]} />
            <meshBasicMaterial color={mini.color} />
          </mesh>
          <mesh>
            <circleGeometry args={[0.055, 20]} />
            <meshBasicMaterial
              color="#38BDF8"
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      ) : (
        /* Hero Figurine (Paladin / Mage / Rogue) */
        <group position={[0, 0.07, 0]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.028, 0.042, 0.11, 12]} />
            <meshStandardMaterial color={mini.color} roughness={0.35} metalness={0.3} />
          </mesh>
          <mesh position={[0, 0.078, 0]}>
            <sphereGeometry args={[0.028, 12, 10]} />
            <meshStandardMaterial color="#FDE68A" roughness={0.4} />
          </mesh>
          {mini.kind === 'hero-mage' && (
            <mesh position={[0.038, 0.03, 0.01]}>
              <cylinderGeometry args={[0.005, 0.005, 0.15, 6]} />
              <meshBasicMaterial color="#38BDF8" />
            </mesh>
          )}
        </group>
      )}

      {/* Floating Miniature Nameplate */}
      <Text
        position={[0, 0.25, 0]}
        fontSize={0.028}
        color={isSelected ? '#38BDF8' : '#F8FAFC'}
        anchorX="center"
        anchorY="middle"
      >
        {mini.label}
      </Text>
    </group>
  )
}

export interface GameRoom3DProps {
  wingLayout: ExpansionWingLayout
  lighting: RoomLightingConfig
  presenterState: PresenterState
  mainVideoTexture: THREE.VideoTexture
  hasMainVideoFrames: boolean
  loungeMirrorTexture: THREE.Texture
  gameRoomStreamMuted: boolean
  onToggleGameRoomStreamMute: () => void
  holotableState: HolotableState
  computedSeats: ComputedSeat[]
  localSeatId?: string
  participants: ParticipantProfile[]
  onSelectSeat: (seatId: string) => void
  onTeleportToFloor?: (point: [number, number, number]) => void
  // Holotable Callbacks
  onSetHolotableTerrain: (terrain: HolotableTerrainPresetId) => void
  onSelectHolotableMini: (miniId: string | null) => void
  onSpawnHolotableMini: (kind: HolotableMiniKind, label: string, color: string) => void
  onUpdateHolotableMini: (
    miniId: string,
    patch: Partial<
      Pick<HolotableMiniature, 'localPos' | 'rotationY' | 'scale' | 'color' | 'label'>
    >,
  ) => void
  onDeleteHolotableMini: (miniId: string) => void
  onResetHolotableMinis: () => void
  onToggleHolotableFog: (enabled?: boolean) => void
  onToggleHolotableFogCell: (cellKey: string) => void
  onRevealAllHolotableFog: () => void
  onShroudAllHolotableFog: () => void
  onRecordArcadeScore: (
    game: 'arcade-hoops' | 'arcade-skeeball' | 'arcade-retro',
    score: number,
    highlight: string,
  ) => void
}

const TERRAIN_SPECS: ReadonlyArray<{
  id: HolotableTerrainPresetId
  shortLabel: string
  title: string
  baseColor: string
  gridColor: string
  accentColor: string
}> = [
  {
    id: 'dungeon-keep',
    shortLabel: '🏰 Dungeon',
    title: 'Obsidian Dungeon Keep',
    baseColor: '#1E293B',
    gridColor: '#F59E0B',
    accentColor: '#EA580C',
  },
  {
    id: 'forest-clearing',
    shortLabel: '🌲 Forest',
    title: 'Whispering Forest Glade',
    baseColor: '#14532D',
    gridColor: '#34D399',
    accentColor: '#10B981',
  },
  {
    id: 'scifi-starship',
    shortLabel: '🚀 Starship',
    title: 'Orbital Starship Bridge',
    baseColor: '#0F172A',
    gridColor: '#38BDF8',
    accentColor: '#06B6D4',
  },
  {
    id: 'mountain-pass',
    shortLabel: '🏔 Pass',
    title: 'Glacial Mountain Pass',
    baseColor: '#334155',
    gridColor: '#BAE6FD',
    accentColor: '#38BDF8',
  },
  {
    id: 'tactical-grid',
    shortLabel: '📐 Grid',
    title: 'Blank Tactical Holomap',
    baseColor: '#090D16',
    gridColor: '#A855F7',
    accentColor: '#C084FC',
  },
]

const MINI_COLOR_SWATCHES = [
  '#F59E0B',
  '#38BDF8',
  '#10B981',
  '#EF4444',
  '#A855F7',
  '#F8FAFC',
]

export function GameRoom3D({
  wingLayout,
  lighting,
  presenterState,
  mainVideoTexture,
  hasMainVideoFrames,
  loungeMirrorTexture,
  gameRoomStreamMuted,
  onToggleGameRoomStreamMute,
  holotableState,
  computedSeats,
  localSeatId,
  participants,
  onSelectSeat,
  onTeleportToFloor,
  onSetHolotableTerrain,
  onSelectHolotableMini,
  onSpawnHolotableMini,
  onUpdateHolotableMini,
  onDeleteHolotableMini,
  onResetHolotableMinis,
  onToggleHolotableFog,
  onToggleHolotableFogCell,
  onRevealAllHolotableFog,
  onShroudAllHolotableFog,
  onRecordArcadeScore,
}: GameRoom3DProps) {
  const z0 = wingLayout.hallStartZ
  const gameRoomZ = wingLayout.gameRoomCenter[2] // z0 + 15.1
  const centerX = 6.925
  const roomW = 10.55
  const roomD = 9.0
  const roomH = 3.9
  const brightnessScale = Math.max(0.6, Math.min(1.65, lighting.brightness))

  // Local Interactive Arcade Scores
  const [hoopsScore, setHoopsScore] = useState(36)
  const [hoopsStreak, setHoopsStreak] = useState(3)
  const [skeeScore, setSkeeScore] = useState(250)
  const [retroScores, setRetroScores] = useState<[number, number, number]>([
    14200,
    18950,
    11400,
  ])

  const holoRingRef = useRef<THREE.Mesh>(null)
  useFrame((_, delta) => {
    if (holoRingRef.current) {
      holoRingRef.current.rotation.z += Math.min(delta, 0.1) * 0.28
    }
  })

  const gameRoomSeats = useMemo(
    () =>
      computedSeats.filter(
        (s) => s.roomWing === 'game-room' && s.stationKind === 'seat',
      ),
    [computedSeats],
  )

  const seatOccupants = useMemo(() => {
    const map = new Map<string, ParticipantProfile>()
    for (const p of participants) {
      if (p.seatId) map.set(p.seatId, p)
    }
    return map
  }, [participants])

  const activeTerrainSpec =
    TERRAIN_SPECS.find((t) => t.id === holotableState.terrain) ?? TERRAIN_SPECS[0]
  const selectedMini =
    holotableState.miniatures.find((m) => m.id === holotableState.selectedMiniId) ??
    holotableState.miniatures[0] ??
    null

  return (
    <group name="wing-game-room">
      {/* Neon Synthwave Slate Floor (Double-Click to Walk / Glide) */}
      <mesh
        position={[centerX, 0.005, gameRoomZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        onDoubleClick={(e) => {
          if (!onTeleportToFloor) return
          e.stopPropagation()
          onTeleportToFloor([e.point.x, 0, e.point.z])
        }}
      >
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial
          color="#131129"
          roughness={0.55}
          metalness={0.3}
          emissive="#0C0A1D"
          emissiveIntensity={0.35 * brightnessScale}
        />
      </mesh>

      {/* Luminous Neon Floor Grid Strips */}
      {[3.8, 5.8, 8.0, 10.0].map((gx, i) => (
        <mesh
          key={gx}
          position={[gx, 0.011, gameRoomZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[0.03, roomD - 0.6]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#A855F7' : '#38BDF8'} />
        </mesh>
      ))}
      {[-3.2, 0, 3.2].map((gzOff, i) => (
        <mesh
          key={gzOff}
          position={[centerX, 0.011, gameRoomZ + gzOff]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[roomW - 0.6, 0.03]} />
          <meshBasicMaterial color={i === 1 ? '#EC4899' : '#A855F7'} />
        </mesh>
      ))}

      {/* Ceiling + Dual Neon Violet & Cyan Halo Rings */}
      <mesh position={[centerX, roomH, gameRoomZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial
          color="#110E24"
          roughness={0.8}
          emissive="#090716"
          emissiveIntensity={0.32 * brightnessScale}
        />
      </mesh>
      <mesh
        position={[centerX, roomH - 0.04, gameRoomZ]}
        rotation={[Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[2.3, 2.46, 36]} />
        <meshBasicMaterial color="#A855F7" side={THREE.DoubleSide} />
      </mesh>
      <mesh
        position={[centerX, roomH - 0.045, gameRoomZ]}
        rotation={[Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[1.38, 1.48, 32]} />
        <meshBasicMaterial color="#38BDF8" side={THREE.DoubleSide} />
      </mesh>

      {/* East Perimeter Wall (x = +12.2), North Wall (z0 + 10.6), South Wall (z0 + 19.6) */}
      <mesh position={[12.2, roomH / 2, gameRoomZ]}>
        <boxGeometry args={[0.14, roomH, roomD]} />
        <meshStandardMaterial
          color="#1A1638"
          roughness={0.68}
          metalness={0.25}
          emissive="#100D26"
          emissiveIntensity={0.32 * brightnessScale}
        />
      </mesh>
      <mesh position={[centerX, roomH / 2, z0 + 10.6]}>
        <boxGeometry args={[roomW, roomH, 0.14]} />
        <meshStandardMaterial
          color="#1A1638"
          roughness={0.7}
          metalness={0.22}
          emissive="#100D26"
          emissiveIntensity={0.32 * brightnessScale}
        />
      </mesh>
      <mesh position={[centerX, roomH / 2, z0 + 19.6]}>
        <boxGeometry args={[roomW, roomH, 0.14]} />
        <meshStandardMaterial
          color="#1A1638"
          roughness={0.7}
          metalness={0.22}
          emissive="#100D26"
          emissiveIntensity={0.32 * brightnessScale}
        />
      </mesh>

      {/* Single High-Output Game Room Zone PointLight */}
      <pointLight
        position={[centerX, 3.45, gameRoomZ]}
        color="#E9D5FF"
        intensity={15.5 * brightnessScale}
        distance={16}
        decay={1.25}
        castShadow={false}
      />

      {/* =================================================================== */}
      {/* 1. NORTH WALL: MIRRORED MAIN VIDEO STREAM SCREEN + LOCAL MUTE       */}
      {/*    Reuses the single shared `mainVideoTexture` instance             */}
      {/* =================================================================== */}
      <group
        name="game-room-video-mirror-screen"
        position={[centerX, 2.12, z0 + 10.74]}
        rotation={[0, 0, 0]}
      >
        <RoundedBox args={[4.12, 2.38, 0.05]} radius={0.03} smoothness={2}>
          <meshStandardMaterial color="#090D1A" metalness={0.55} roughness={0.35} />
        </RoundedBox>
        <mesh position={[0, 1.13, 0.028]}>
          <planeGeometry args={[3.94, 0.025]} />
          <meshBasicMaterial color="#A855F7" />
        </mesh>

        {/* Shared VideoTexture Surface (or Live 3D Lounge Mirror Feed when idle) */}
        <mesh position={[0, 0.06, 0.029]}>
          <planeGeometry args={[3.9, 2.02]} />
          {hasMainVideoFrames ? (
            <meshBasicMaterial
              key="gameroom-main-video"
              map={mainVideoTexture}
              color="#ffffff"
              toneMapped={false}
            />
          ) : (
            <meshBasicMaterial
              key="gameroom-lounge-cam"
              map={loungeMirrorTexture}
              color="#ffffff"
              toneMapped={false}
            />
          )}
        </mesh>

        {/* Bottom Bezel Bar with Local Mute / Unmute Toggle */}
        <group position={[0, -1.04, 0.032]}>
          <Text
            position={[-1.9, 0, 0]}
            fontSize={0.048}
            color={gameRoomStreamMuted ? '#F87171' : '#34D399'}
            anchorX="left"
            anchorY="middle"
          >
            {hasMainVideoFrames
              ? `📺 MAIN STREAM MIRROR · ${presenterState.mediaTitle || 'LIVE'}`
              : '📺 MAIN LOUNGE MIRROR FEED (SHARED GPU TEXTURE)'}
          </Text>

          <HoloButton3D
            name="btn-gameroom-stream-mute"
            label={
              gameRoomStreamMuted
                ? '🔇 Stream Muted in Game Room (Click to Unmute)'
                : '🔊 Stream Audio ON (Click to Mute Locally)'
            }
            position={[1.05, 0, 0]}
            width={1.68}
            height={0.13}
            fontSize={0.044}
            active={!gameRoomStreamMuted}
            accent={gameRoomStreamMuted ? '#EF4444' : '#10B981'}
            onClick={onToggleGameRoomStreamMute}
          />
        </group>
      </group>

      {/* =================================================================== */}
      {/* 2. PERIMETER OF CLASSIC NEON ARCADE GAMES (East & South Walls)      */}
      {/* =================================================================== */}

      {/* A) 🏀 NEON POP-A-SHOT ARCADE BASKETBALL (East Wall North, facing -X) */}
      <group
        name="arcade-station-popashot"
        position={[11.45, 0, gameRoomZ - 2.65]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        {/* Cage Base & Ramp */}
        <RoundedBox args={[1.32, 0.85, 1.1]} position={[0, 0.425, 0.15]} radius={0.03}>
          <meshStandardMaterial color="#1E1B4B" roughness={0.5} metalness={0.35} />
        </RoundedBox>
        {/* Backboard Tower */}
        <RoundedBox args={[1.36, 2.55, 0.12]} position={[0, 1.35, -0.36]} radius={0.025}>
          <meshStandardMaterial color="#0F172A" metalness={0.45} roughness={0.4} />
        </RoundedBox>
        {/* Neon LED Backboard Outline & Rim */}
        <mesh position={[0, 1.98, -0.28]}>
          <planeGeometry args={[1.08, 0.68]} />
          <meshBasicMaterial color="#111827" />
        </mesh>
        <mesh position={[0, 1.98, -0.275]}>
          <ringGeometry args={[0.18, 0.21, 4]} />
          <meshBasicMaterial color="#F97316" />
        </mesh>
        <mesh position={[0, 1.78, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.14, 0.014, 10, 24]} />
          <meshBasicMaterial color="#EF4444" />
        </mesh>
        {/* 3 Basketballs in Return Rack */}
        {[-0.28, 0, 0.28].map((bx, i) => (
          <mesh key={i} position={[bx, 0.92, 0.42]}>
            <sphereGeometry args={[0.11, 14, 12]} />
            <meshStandardMaterial color="#EA580C" roughness={0.6} />
          </mesh>
        ))}

        {/* LED Marquee & Interactive Shoot Controls */}
        <Text
          position={[0, 2.46, -0.28]}
          fontSize={0.075}
          color="#F97316"
          anchorX="center"
          anchorY="middle"
        >
          🏀 NEON POP-A-SHOT HOOPS
        </Text>
        <Text
          position={[0, 2.28, -0.28]}
          fontSize={0.062}
          color="#34D399"
          anchorX="center"
          anchorY="middle"
        >
          {`SCORE: ${hoopsScore} PTS  ·  STREAK: ${hoopsStreak}🔥`}
        </Text>

        <HoloButton3D
          name="btn-arcade-hoops-shoot"
          label="🏀 Shoot 3-Pointer (+3)"
          position={[-0.3, 1.02, 0.72]}
          width={0.56}
          height={0.11}
          fontSize={0.036}
          active
          accent="#F97316"
          onClick={() => {
            const nextStreak = hoopsStreak + 1
            const bonus = nextStreak >= 3 ? 6 : 3
            setHoopsStreak(nextStreak)
            setHoopsScore((s) => s + bonus)
          }}
        />
        <HoloButton3D
          name="btn-arcade-hoops-post"
          label="🏆 Post to Leaderboard"
          position={[0.3, 1.02, 0.72]}
          width={0.56}
          height={0.11}
          fontSize={0.036}
          accent="#10B981"
          onClick={() =>
            onRecordArcadeScore('arcade-hoops', hoopsScore, 'Neon Pop-A-Shot Hoops')
          }
        />
      </group>

      {/* B) 🎳 CYBER SKEE-BALL ALLEY (East Wall Center, facing -X) */}
      <group
        name="arcade-station-skeeball"
        position={[11.45, 0, gameRoomZ + 0.05]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <RoundedBox args={[1.18, 0.82, 1.25]} position={[0, 0.41, 0.1]} radius={0.03}>
          <meshStandardMaterial color="#172554" roughness={0.48} metalness={0.35} />
        </RoundedBox>
        <RoundedBox args={[1.22, 2.45, 0.14]} position={[0, 1.3, -0.42]} radius={0.025}>
          <meshStandardMaterial color="#090D1A" metalness={0.45} roughness={0.4} />
        </RoundedBox>
        {/* Concentric Neon Target Rings (10 / 30 / 50 / 100 PTS) */}
        {[
          { r: 0.34, color: '#38BDF8', y: 1.55 },
          { r: 0.22, color: '#A855F7', y: 1.55 },
          { r: 0.11, color: '#F59E0B', y: 1.55 },
          { r: 0.07, color: '#34D399', y: 1.82 },
        ].map((ring, idx) => (
          <mesh key={idx} position={[0, ring.y, -0.33]}>
            <ringGeometry args={[ring.r - 0.02, ring.r, 24]} />
            <meshBasicMaterial color={ring.color} />
          </mesh>
        ))}

        <Text
          position={[0, 2.38, -0.33]}
          fontSize={0.072}
          color="#38BDF8"
          anchorX="center"
          anchorY="middle"
        >
          🎳 CYBER SKEE-BALL 3000
        </Text>
        <Text
          position={[0, 2.18, -0.33]}
          fontSize={0.06}
          color="#FDE68A"
          anchorX="center"
          anchorY="middle"
        >
          {`TICKETS / SCORE: ${skeeScore} PTS`}
        </Text>

        <HoloButton3D
          name="btn-arcade-skeeball-roll"
          label="🎳 Roll 100-PT Pocket!"
          position={[-0.28, 0.96, 0.74]}
          width={0.54}
          height={0.11}
          fontSize={0.035}
          active
          accent="#38BDF8"
          onClick={() => setSkeeScore((s) => s + 100)}
        />
        <HoloButton3D
          name="btn-arcade-skeeball-post"
          label="🏆 Post to Leaderboard"
          position={[0.28, 0.96, 0.74]}
          width={0.54}
          height={0.11}
          fontSize={0.035}
          accent="#10B981"
          onClick={() =>
            onRecordArcadeScore('arcade-skeeball', skeeScore, 'Cyber Skee-Ball Alley')
          }
        />
      </group>

      {/* C) 👾 3 CLASSIC NEON RETRO ARCADE CABINETS ALONG SOUTH WALL */}
      {[
        {
          id: 'galaxy-defender',
          title: '👾 GALAXY DEFENDER 84',
          pos: [9.65, 0, z0 + 18.88] as [number, number, number],
          accent: '#EC4899',
          idx: 0 as const,
        },
        {
          id: 'synthwave-outrun',
          title: '🏎 SYNTHWAVE TURBO',
          pos: [7.65, 0, z0 + 18.88] as [number, number, number],
          accent: '#06B6D4',
          idx: 1 as const,
        },
        {
          id: 'cyber-puck',
          title: '⚡ CYBER KNIGHTS 99',
          pos: [5.65, 0, z0 + 18.88] as [number, number, number],
          accent: '#F59E0B',
          idx: 2 as const,
        },
      ].map((cab) => (
        <group
          key={cab.id}
          name={`arcade-cabinet-${cab.id}`}
          position={cab.pos}
          rotation={[0, Math.PI, 0]}
        >
          {/* Classic Upright Cabinet Body */}
          <RoundedBox args={[0.92, 2.08, 0.72]} position={[0, 1.04, 0]} radius={0.03}>
            <meshStandardMaterial color="#0F172A" roughness={0.45} metalness={0.35} />
          </RoundedBox>
          {/* Side Neon Trim */}
          {[-0.465, 0.465].map((sx) => (
            <mesh key={sx} position={[sx, 1.08, 0.32]}>
              <boxGeometry args={[0.018, 1.95, 0.04]} />
              <meshBasicMaterial color={cab.accent} />
            </mesh>
          ))}
          {/* Top Glowing Marquee */}
          <mesh position={[0, 1.92, 0.365]}>
            <planeGeometry args={[0.84, 0.22]} />
            <meshBasicMaterial color={cab.accent} />
          </mesh>
          <Text
            position={[0, 1.92, 0.372]}
            fontSize={0.052}
            color="#040810"
            anchorX="center"
            anchorY="middle"
          >
            {cab.title}
          </Text>

          {/* CRT Screen */}
          <mesh position={[0, 1.38, 0.365]}>
            <planeGeometry args={[0.76, 0.58]} />
            <meshBasicMaterial color="#050814" />
          </mesh>
          <Text
            position={[0, 1.48, 0.372]}
            fontSize={0.042}
            color={cab.accent}
            anchorX="center"
            anchorY="middle"
          >
            {`HIGH SCORE: ${retroScores[cab.idx].toLocaleString()}`}
          </Text>
          <Text
            position={[0, 1.32, 0.372]}
            fontSize={0.032}
            color="#E2E8F0"
            anchorX="center"
            anchorY="middle"
          >
            INSERT COIN · READY PLAYER 1
          </Text>

          {/* Playable Controls Deck */}
          <HoloButton3D
            name={`btn-arcade-play-${cab.id}`}
            label="🕹 Play (+1,500)"
            position={[-0.2, 0.94, 0.4]}
            width={0.38}
            height={0.09}
            fontSize={0.028}
            active
            accent={cab.accent}
            onClick={() =>
              setRetroScores((prev) => {
                const next: [number, number, number] = [...prev]
                next[cab.idx] += 1500
                return next
              })
            }
          />
          <HoloButton3D
            name={`btn-arcade-save-${cab.id}`}
            label="🏆 Save Score"
            position={[0.21, 0.94, 0.4]}
            width={0.38}
            height={0.09}
            fontSize={0.028}
            accent="#10B981"
            onClick={() =>
              onRecordArcadeScore('arcade-retro', retroScores[cab.idx], cab.title)
            }
          />
        </group>
      ))}

      {/* =================================================================== */}
      {/* 3. CENTERPIECE: TACTICAL HOLOTABLE SANCTUM ([+6.925, 0, gameRoomZ]) */}
      {/*    Terrain Presets · Movable Miniatures · Interactive Fog of War    */}
      {/* =================================================================== */}
      <group name="tactical-holotable-sanctum" position={[centerX, 0, gameRoomZ]}>
        {/* Illuminated Octagonal Sanctum Pedestal & Rim */}
        <mesh position={[0, 0.41, 0]}>
          <cylinderGeometry args={[0.92, 1.08, 0.82, 8]} />
          <meshStandardMaterial
            color="#1E1B4B"
            metalness={0.58}
            roughness={0.3}
            emissive="#110E2E"
            emissiveIntensity={0.35 * brightnessScale}
          />
        </mesh>
        <mesh position={[0, 0.83, 0]}>
          <cylinderGeometry args={[1.22, 1.18, 0.05, 16]} />
          <meshStandardMaterial color="#0F172A" metalness={0.65} roughness={0.28} />
        </mesh>
        {/* Rotating Holographic Outer Rim Halo */}
        <mesh
          ref={holoRingRef}
          position={[0, 0.858, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <ringGeometry args={[1.08, 1.18, 32]} />
          <meshBasicMaterial color={activeTerrainSpec.accentColor} />
        </mesh>

        {/* Interactive 3D Map Surface (Click anywhere on map to move selected miniature!) */}
        <mesh
          name="holotable-map-surface"
          position={[0, 0.86, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onClick={(e) => {
            e.stopPropagation()
            if (!selectedMini) return
            const lx = Number(
              Math.max(-0.76, Math.min(0.76, e.point.x - centerX)).toFixed(3),
            )
            const lz = Number(
              Math.max(-0.76, Math.min(0.76, e.point.z - gameRoomZ)).toFixed(3),
            )
            onUpdateHolotableMini(selectedMini.id, { localPos: [lx, lz] })
          }}
        >
          <planeGeometry args={[1.64, 1.64]} />
          <meshStandardMaterial
            color={activeTerrainSpec.baseColor}
            roughness={0.42}
            metalness={0.2}
          />
        </mesh>

        {/* Illuminated Tactical Grid Lines across the 1.64m × 1.64m Holomap */}
        {[-0.66, -0.44, -0.22, 0, 0.22, 0.44, 0.66].map((g) => (
          <group key={g}>
            <mesh
              position={[g, 0.863, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={() => null}
            >
              <planeGeometry args={[0.008, 1.62]} />
              <meshBasicMaterial
                color={activeTerrainSpec.gridColor}
                transparent
                opacity={0.5}
              />
            </mesh>
            <mesh
              position={[0, 0.863, g]}
              rotation={[-Math.PI / 2, 0, 0]}
              raycast={() => null}
            >
              <planeGeometry args={[1.62, 0.008]} />
              <meshBasicMaterial
                color={activeTerrainSpec.gridColor}
                transparent
                opacity={0.5}
              />
            </mesh>
          </group>
        ))}

        {/* 3D Procedural Terrain Props per Active Terrain Preset */}
        {holotableState.terrain === 'dungeon-keep' && (
          <group position={[0, 0.865, 0]}>
            {[
              [-0.55, -0.55],
              [0.55, -0.55],
              [-0.55, 0.55],
              [0.55, 0.55],
            ].map(([px, pz], idx) => (
              <group key={idx} position={[px, 0.08, pz]}>
                <mesh raycast={() => null}>
                  <boxGeometry args={[0.14, 0.16, 0.14]} />
                  <meshStandardMaterial color="#475569" roughness={0.8} />
                </mesh>
                <mesh position={[0, 0.1, 0]} raycast={() => null}>
                  <sphereGeometry args={[0.035, 8, 8]} />
                  <meshBasicMaterial color="#F97316" />
                </mesh>
              </group>
            ))}
          </group>
        )}

        {holotableState.terrain === 'forest-clearing' && (
          <group position={[0, 0.865, 0]}>
            {[
              [-0.56, -0.48],
              [0.54, -0.5],
              [-0.52, 0.54],
              [0.56, 0.48],
            ].map(([tx, tz], idx) => (
              <group key={idx} position={[tx, 0, tz]}>
                <mesh position={[0, 0.09, 0]} raycast={() => null}>
                  <coneGeometry args={[0.11, 0.22, 7]} />
                  <meshBasicMaterial color="#22C55E" />
                </mesh>
                <mesh position={[0, 0.18, 0]} raycast={() => null}>
                  <coneGeometry args={[0.08, 0.16, 7]} />
                  <meshBasicMaterial color="#4ADE80" />
                </mesh>
              </group>
            ))}
          </group>
        )}

        {holotableState.terrain === 'scifi-starship' && (
          <group position={[0, 0.868, 0]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
              <ringGeometry args={[0.24, 0.32, 24]} />
              <meshBasicMaterial color="#38BDF8" />
            </mesh>
            <mesh position={[0, 0.06, 0]} raycast={() => null}>
              <cylinderGeometry args={[0.08, 0.1, 0.12, 12]} />
              <meshBasicMaterial color="#06B6D4" wireframe />
            </mesh>
          </group>
        )}

        {holotableState.terrain === 'mountain-pass' && (
          <group position={[0, 0.865, 0]}>
            {[
              [-0.52, -0.15, 0.22],
              [0.52, 0.12, 0.25],
            ].map(([mx, mz, mh], idx) => (
              <mesh key={idx} position={[mx, mh / 2, mz]} raycast={() => null}>
                <coneGeometry args={[0.18, mh, 6]} />
                <meshStandardMaterial color="#94A3B8" roughness={0.7} />
              </mesh>
            ))}
          </group>
        )}

        {/* Synced Movable 3D Miniatures & Tokens */}
        {holotableState.miniatures.map((mini) => (
          <MiniatureMesh3D
            key={mini.id}
            mini={mini}
            isSelected={selectedMini?.id === mini.id}
            onSelect={() => onSelectHolotableMini(mini.id)}
          />
        ))}

        {/* Interactive 6×6 Fog-of-War Tile Overlay (Click any tile to reveal/shroud!) */}
        {holotableState.fogEnabled && (
          <group name="holotable-fog-of-war-grid" position={[0, 0.98, 0]}>
            {Array.from({ length: 6 }).map((_, r) =>
              Array.from({ length: 6 }).map((__, c) => {
                const cellKey = `${r},${c}`
                const isRevealed = holotableState.revealedFogCells.includes(cellKey)
                const cx = -0.625 + c * 0.25
                const cz = -0.625 + r * 0.25
                return (
                  <mesh
                    key={cellKey}
                    name={`fog-tile-${r}-${c}`}
                    position={[cx, 0, cz]}
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleHolotableFogCell(cellKey)
                    }}
                  >
                    <boxGeometry args={[0.235, isRevealed ? 0.008 : 0.09, 0.235]} />
                    <meshBasicMaterial
                      color={isRevealed ? '#38BDF8' : '#1E1B4B'}
                      transparent
                      opacity={isRevealed ? 0.14 : 0.88}
                    />
                  </mesh>
                )
              }),
            )}
          </group>
        )}

        {/* ================================================================= */}
        {/* HOLOTABLE SANCTUM COMMAND CONSOLE PANELS (West & South Rims)      */}
        {/* ================================================================= */}
        <group
          name="holotable-control-console"
          position={[-1.18, 0.96, 0]}
          rotation={[0, -Math.PI / 2, -0.42]}
        >
          <RoundedBox args={[1.68, 0.62, 0.025]} radius={0.02}>
            <meshBasicMaterial color="#090D1A" />
          </RoundedBox>
          <Text
            position={[0, 0.25, 0.016]}
            fontSize={0.036}
            color="#C084FC"
            anchorX="center"
            anchorY="middle"
          >
            {`⚔️ HOLOTABLE SANCTUM · ${activeTerrainSpec.title.toUpperCase()}`}
          </Text>

          {/* Row 1: 5 Terrain Presets */}
          {TERRAIN_SPECS.map((t, idx) => (
            <HoloButton3D
              key={t.id}
              name={`btn-holo-terrain-${t.id}`}
              label={t.shortLabel}
              position={[-0.64 + idx * 0.32, 0.14, 0.016]}
              width={0.29}
              height={0.075}
              fontSize={0.024}
              active={holotableState.terrain === t.id}
              accent={t.accentColor}
              onClick={() => onSetHolotableTerrain(t.id)}
            />
          ))}

          {/* Row 2: Spawn Miniatures */}
          {(
            [
              { kind: 'hero-paladin', label: '+Paladin', color: '#F59E0B' },
              { kind: 'hero-mage', label: '+Mage', color: '#38BDF8' },
              { kind: 'hero-rogue', label: '+Rogue', color: '#10B981' },
              { kind: 'monster-dragon', label: '+Dragon', color: '#EF4444' },
              { kind: 'monster-golem', label: '+Golem', color: '#A855F7' },
              { kind: 'prop-chest', label: '+Chest', color: '#EAB308' },
            ] as Array<{ kind: HolotableMiniKind; label: string; color: string }>
          ).map((sp, idx) => (
            <HoloButton3D
              key={sp.kind}
              name={`btn-holo-spawn-${sp.kind}`}
              label={sp.label}
              position={[-0.65 + idx * 0.26, 0.03, 0.016]}
              width={0.24}
              height={0.07}
              fontSize={0.022}
              accent={sp.color}
              onClick={() =>
                onSpawnHolotableMini(sp.kind, sp.label.replace('+', ''), sp.color)
              }
            />
          ))}

          {/* Row 3: Selected Miniature Transform (Move / Rotate / Scale / Recolor / Delete) */}
          {selectedMini && (
            <group position={[0, -0.08, 0.016]}>
              <HoloButton3D
                name="btn-holo-mini-rotate"
                label="↻ Rot 45°"
                position={[-0.64, 0, 0]}
                width={0.25}
                height={0.068}
                fontSize={0.022}
                onClick={() =>
                  onUpdateHolotableMini(selectedMini.id, {
                    rotationY: Number((selectedMini.rotationY + Math.PI / 4).toFixed(3)),
                  })
                }
              />
              <HoloButton3D
                name="btn-holo-mini-scale-up"
                label="+ Scale"
                position={[-0.36, 0, 0]}
                width={0.22}
                height={0.068}
                fontSize={0.022}
                onClick={() =>
                  onUpdateHolotableMini(selectedMini.id, {
                    scale: selectedMini.scale >= 1.5 ? 0.85 : selectedMini.scale + 0.2,
                  })
                }
              />
              <HoloButton3D
                name="btn-holo-mini-color"
                label="🎨 Color"
                position={[-0.1, 0, 0]}
                width={0.24}
                height={0.068}
                fontSize={0.022}
                accent={selectedMini.color}
                active
                onClick={() => {
                  const cIdx = MINI_COLOR_SWATCHES.indexOf(selectedMini.color)
                  const nextColor =
                    MINI_COLOR_SWATCHES[(cIdx + 1) % MINI_COLOR_SWATCHES.length]
                  onUpdateHolotableMini(selectedMini.id, { color: nextColor })
                }}
              />
              <HoloButton3D
                name="btn-holo-mini-step"
                label="▶ Step"
                position={[0.16, 0, 0]}
                width={0.22}
                height={0.068}
                fontSize={0.022}
                onClick={() =>
                  onUpdateHolotableMini(selectedMini.id, {
                    localPos: [
                      selectedMini.localPos[0] > 0.45
                        ? -0.35
                        : Number((selectedMini.localPos[0] + 0.18).toFixed(2)),
                      selectedMini.localPos[1],
                    ],
                  })
                }
              />
              <HoloButton3D
                name="btn-holo-mini-delete"
                label="🗑 Del"
                position={[0.41, 0, 0]}
                width={0.2}
                height={0.068}
                fontSize={0.022}
                accent="#EF4444"
                onClick={() => onDeleteHolotableMini(selectedMini.id)}
              />
              <HoloButton3D
                name="btn-holo-mini-reset"
                label="↺ Reset"
                position={[0.64, 0, 0]}
                width={0.22}
                height={0.068}
                fontSize={0.022}
                onClick={onResetHolotableMinis}
              />
            </group>
          )}

          {/* Row 4: Interactive Fog of War Controls */}
          <group position={[0, -0.2, 0.016]}>
            <HoloButton3D
              name="btn-holo-fog-toggle"
              label={
                holotableState.fogEnabled ? '🌫 Fog of War: ON' : '🌫 Fog of War: OFF'
              }
              position={[-0.46, 0, 0]}
              width={0.56}
              height={0.075}
              fontSize={0.024}
              active={holotableState.fogEnabled}
              accent="#A855F7"
              onClick={() => onToggleHolotableFog()}
            />
            <HoloButton3D
              name="btn-holo-fog-reveal-all"
              label="☀️ Clear All Fog"
              position={[0.12, 0, 0]}
              width={0.48}
              height={0.075}
              fontSize={0.024}
              accent="#38BDF8"
              onClick={onRevealAllHolotableFog}
            />
            <HoloButton3D
              name="btn-holo-fog-shroud-all"
              label="🌑 Shroud All"
              position={[0.58, 0, 0]}
              width={0.38}
              height={0.075}
              fontSize={0.024}
              accent="#6366F1"
              onClick={onShroudAllHolotableFog}
            />
          </group>
        </group>
      </group>

      {/* 6 Click-to-Sit Sanctum Chairs around the Tactical Holotable */}
      {gameRoomSeats.map((seat) => (
        <SanctumChair3D
          key={seat.id}
          seat={seat}
          isLocalSeat={localSeatId === seat.id}
          occupant={seatOccupants.get(seat.id)}
          onSelectSeat={onSelectSeat}
        />
      ))}
    </group>
  )
}
