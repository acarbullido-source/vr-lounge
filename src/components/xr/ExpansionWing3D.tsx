import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  BOARDROOM_STRATEGY_SLIDES,
  HALLWAY_HALF_WIDTH,
  HALLWAY_HEIGHT,
  HALLWAY_LENGTH,
  computeExpansionWingLayout,
  resolveExpansionWingState,
  type ExpansionRoomDestination,
} from '../../constants/expansionRooms'
import { ROOM_SIZE_SPECS } from '../../constants/hangout'
import { fireplaceAudio } from '../../services/fireplaceAudio'
import type {
  ComputedSeat,
  ExpansionWingSyncedState,
  ParticipantProfile,
  PresenterState,
  RoomCustomizationState,
} from '../../types/lounge'
import { CommandCenterRoom3D } from './CommandCenterRoom3D'
import { OutdoorLakeDeck3D } from './OutdoorLakeDeck3D'

interface ExecutiveLeatherChairProps {
  seat: ComputedSeat
  isLocalSeat: boolean
  occupant?: ParticipantProfile
  onSelectSeat: (seatId: string) => void
}

function ExecutiveLeatherChair({
  seat,
  isLocalSeat,
  occupant,
  onSelectSeat,
}: ExecutiveLeatherChairProps) {
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
      {/* Brushed Brass 5-Star Base */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.27, 0.31, 0.05, 12]} />
        <meshStandardMaterial color="#B8893A" metalness={0.75} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.045, 0.055, 0.34, 10]} />
        <meshStandardMaterial color="#8A6426" metalness={0.75} roughness={0.3} />
      </mesh>
      {/* Tufted Cognac/Espresso Executive Cushion */}
      <RoundedBox args={[0.56, 0.1, 0.54]} position={[0, 0.42, 0]} radius={0.035} smoothness={2}>
        <meshStandardMaterial
          color={hovered && !takenByOther ? '#6B3D24' : '#4E2B19'}
          emissive="#3A1E0F"
          emissiveIntensity={0.42}
          roughness={0.52}
          metalness={0.1}
        />
      </RoundedBox>
      {/* Tall Executive Backrest */}
      <RoundedBox
        args={[0.54, 0.78, 0.09]}
        position={[0, 0.83, 0.23]}
        rotation={[0.08, 0, 0]}
        radius={0.035}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#462515"
          emissive="#351B0E"
          emissiveIntensity={0.4}
          roughness={0.5}
          metalness={0.12}
        />
      </RoundedBox>
      {/* Brass Armrests */}
      {[-0.29, 0.29].map((ax) => (
        <mesh key={ax} position={[ax, 0.59, 0.02]}>
          <boxGeometry args={[0.05, 0.04, 0.38]} />
          <meshStandardMaterial
            color="#D4A54E"
            emissive="#8A6421"
            emissiveIntensity={0.35}
            metalness={0.7}
            roughness={0.28}
          />
        </mesh>
      ))}
      {(hovered || isLocalSeat) && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.42, 24]} />
          <meshBasicMaterial
            color={isLocalSeat ? '#E5A93C' : takenByOther ? '#EF4444' : '#FBBF24'}
          />
        </mesh>
      )}
    </group>
  )
}

function ChesterfieldArmchair({
  seat,
  isLocalSeat,
  occupant,
  onSelectSeat,
}: ExecutiveLeatherChairProps) {
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
      {/* Plush Oxblood Leather Seat Base */}
      <RoundedBox args={[0.84, 0.34, 0.78]} position={[0, 0.22, 0]} radius={0.06} smoothness={2}>
        <meshStandardMaterial
          color={hovered && !takenByOther ? '#8B2E2E' : '#6E2222'}
          emissive="#4A1515"
          emissiveIntensity={0.45}
          roughness={0.62}
        />
      </RoundedBox>
      {/* Rolled Wingback Backrest */}
      <RoundedBox
        args={[0.84, 0.72, 0.18]}
        position={[0, 0.68, 0.31]}
        rotation={[0.09, 0, 0]}
        radius={0.07}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#641E1E"
          emissive="#421212"
          emissiveIntensity={0.42}
          roughness={0.6}
        />
      </RoundedBox>
      {/* Rolled Leather Arms */}
      {[-0.38, 0.38].map((ax) => (
        <RoundedBox
          key={ax}
          args={[0.16, 0.34, 0.76]}
          position={[ax, 0.48, 0.01]}
          radius={0.06}
          smoothness={2}
        >
          <meshStandardMaterial
            color="#6A2020"
            emissive="#451414"
            emissiveIntensity={0.42}
            roughness={0.6}
          />
        </RoundedBox>
      ))}
      {(hovered || isLocalSeat) && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.48, 0.55, 24]} />
          <meshBasicMaterial
            color={isLocalSeat ? '#E5A93C' : takenByOther ? '#EF4444' : '#FB923C'}
          />
        </mesh>
      )}
    </group>
  )
}

const BOOK_PALETTE = [
  '#991B1B',
  '#1D4ED8',
  '#15803D',
  '#B45309',
  '#6D28D9',
  '#C2410C',
  '#0F766E',
  '#D97706',
]

function ProceduralBookcaseUnit({
  position,
  rotationY = 0,
  width = 2.4,
}: {
  position: [number, number, number]
  rotationY?: number
  width?: number
}) {
  const shelfYs = [0.45, 1.05, 1.65, 2.25, 2.85]
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Walnut Cabinet Backing & Frame */}
      <mesh position={[0, 1.75, 0]}>
        <boxGeometry args={[width, 3.5, 0.36]} />
        <meshStandardMaterial
          color="#3B2116"
          emissive="#26140C"
          emissiveIntensity={0.45}
          roughness={0.72}
        />
      </mesh>
      {/* Shelves + Clustered Book Spines */}
      {shelfYs.map((sy, sIdx) => (
        <group key={sy}>
          <mesh position={[0, sy, 0.03]}>
            <boxGeometry args={[width - 0.08, 0.04, 0.34]} />
            <meshStandardMaterial
              color="#522D1D"
              emissive="#361C11"
              emissiveIntensity={0.48}
              roughness={0.65}
            />
          </mesh>
          {[-0.34, -0.17, 0, 0.17, 0.34].map((frac, bIdx) => {
            const color = BOOK_PALETTE[(sIdx * 5 + bIdx) % BOOK_PALETTE.length]
            const bookH = 0.34 + ((sIdx + bIdx) % 3) * 0.05
            return (
              <mesh
                key={bIdx}
                position={[frac * width, sy + 0.02 + bookH / 2, 0.06]}
                raycast={() => null}
              >
                <boxGeometry args={[width * 0.13, bookH, 0.22]} />
                <meshStandardMaterial
                  color={color}
                  emissive={color}
                  emissiveIntensity={0.38}
                  roughness={0.7}
                />
              </mesh>
            )
          })}
        </group>
      ))}
    </group>
  )
}

function DoorwaySign3D({
  position,
  rotationY,
  label,
  sublabel,
  accent,
}: {
  position: [number, number, number]
  rotationY: number
  label: string
  sublabel: string
  accent: string
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <RoundedBox args={[1.68, 0.28, 0.03]} radius={0.02} smoothness={2}>
        <meshBasicMaterial color="#0A0F18" />
      </RoundedBox>
      <mesh position={[0, 0.125, 0.018]}>
        <planeGeometry args={[1.56, 0.014]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <Text
        position={[0, 0.035, 0.02]}
        fontSize={0.072}
        color="#F8FAFC"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      <Text
        position={[0, -0.065, 0.02]}
        fontSize={0.042}
        color="#94A3B8"
        anchorX="center"
        anchorY="middle"
      >
        {sublabel}
      </Text>
    </group>
  )
}

export interface ExpansionWing3DProps {
  roomCustomization: RoomCustomizationState
  presenterState: PresenterState
  mainVideoTexture: THREE.VideoTexture
  hasMainVideoFrames: boolean
  computedSeats: ComputedSeat[]
  localSeatId?: string
  participants: ParticipantProfile[]
  cinemaVolume: number
  onSelectSeat: (seatId: string) => void
  onTeleportToFloor?: (point: [number, number, number]) => void
  onJumpToDestination?: (dest: ExpansionRoomDestination) => void
  onUpdateWingState: (patch: Partial<ExpansionWingSyncedState>) => void
  onOpenCommandOpsDrawer?: () => void
}

export function ExpansionWing3D({
  roomCustomization,
  presenterState,
  mainVideoTexture,
  hasMainVideoFrames,
  computedSeats,
  localSeatId,
  participants,
  cinemaVolume,
  onSelectSeat,
  onTeleportToFloor,
  onJumpToDestination,
  onUpdateWingState,
  onOpenCommandOpsDrawer,
}: ExpansionWing3DProps) {
  const sizeSpec =
    ROOM_SIZE_SPECS[roomCustomization.architecture.sizePreset] ??
    ROOM_SIZE_SPECS.classic
  const wingLayout = useMemo(
    () => computeExpansionWingLayout(sizeSpec.backZ),
    [sizeSpec.backZ],
  )
  const wingState = useMemo(
    () => resolveExpansionWingState(roomCustomization.expansionWing),
    [roomCustomization.expansionWing],
  )

  const [crackleAudioOn, setCrackleAudioOn] = useState(() => fireplaceAudio.isPlaying())

  useEffect(() => {
    return () => {
      fireplaceAudio.stop()
    }
  }, [])

  const hearthFlameRef = useRef<THREE.Group>(null)
  const hearthLightRef = useRef<THREE.PointLight>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (hearthFlameRef.current && wingState.libraryFireLit) {
      hearthFlameRef.current.scale.y =
        0.92 + Math.sin(t * 10.5) * 0.14 + Math.cos(t * 16.0) * 0.06
      hearthFlameRef.current.scale.x = 0.96 + Math.sin(t * 7.2) * 0.06
    }
    if (hearthLightRef.current) {
      hearthLightRef.current.intensity = wingState.libraryFireLit
        ? 1.15 + Math.sin(t * 11.0) * 0.16
        : 0.08
    }
  })

  const seatOccupants = useMemo(() => {
    const map = new Map<string, ParticipantProfile>()
    for (const p of participants) {
      if (p.seatId) map.set(p.seatId, p)
    }
    return map
  }, [participants])

  const boardroomSeats = useMemo(
    () => computedSeats.filter((s) => s.roomWing === 'boardroom'),
    [computedSeats],
  )
  const librarySeats = useMemo(
    () => computedSeats.filter((s) => s.roomWing === 'library'),
    [computedSeats],
  )

  const z0 = wingLayout.hallStartZ
  const boardZ = wingLayout.boardroomCenter[2] // z0 + 5.4
  const libZ = wingLayout.libraryCenter[2] // z0 + 5.4
  const activeSlide =
    BOARDROOM_STRATEGY_SLIDES[wingState.boardroomAgendaIndex] ??
    BOARDROOM_STRATEGY_SLIDES[0]
  const boardroomShowingMirror =
    wingState.boardroomScreenMode === 'mirror-lounge' && hasMainVideoFrames

  return (
    <group name="clubhouse-expansion-wing">
      {/* =================================================================== */}
      {/* 1. GRAND CLUBHOUSE GALLERY HALLWAY (x in [-1.65, +1.65], dz 0..20.4) */}
      {/* =================================================================== */}
      <group name="wing-grand-hallway">
        {/* Hallway Floor + Warm Velvet/Gold Center Carpet Runner */}
        <mesh
          position={[0, 0.004, z0 + HALLWAY_LENGTH / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          onDoubleClick={(e) => {
            if (!onTeleportToFloor) return
            e.stopPropagation()
            onTeleportToFloor([e.point.x, 0, e.point.z])
          }}
        >
          <planeGeometry args={[HALLWAY_HALF_WIDTH * 2, HALLWAY_LENGTH + 0.3]} />
          <meshStandardMaterial color="#151922" roughness={0.72} metalness={0.18} />
        </mesh>
        <mesh
          position={[0, 0.009, z0 + HALLWAY_LENGTH / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[1.55, HALLWAY_LENGTH - 0.4]} />
          <meshStandardMaterial color="#3A231B" roughness={0.88} />
        </mesh>

        {/* Hallway Ceiling + Warm Cove Lighting */}
        <mesh
          position={[0, HALLWAY_HEIGHT, z0 + HALLWAY_LENGTH / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[HALLWAY_HALF_WIDTH * 2, HALLWAY_LENGTH + 0.2]} />
          <meshStandardMaterial color="#0D1017" roughness={0.9} />
        </mesh>
        {[3.2, 10.2, 17.2].map((dzLight) => (
          <group key={dzLight} position={[0, HALLWAY_HEIGHT - 0.05, z0 + dzLight]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
              <planeGeometry args={[1.2, 0.35]} />
              <meshBasicMaterial color="#FDE68A" />
            </mesh>
          </group>
        ))}
        <pointLight
          position={[0, 3.4, z0 + 5.4]}
          color="#FDE68A"
          intensity={0.85}
          distance={14}
          decay={1.7}
        />
        <pointLight
          position={[0, 3.4, z0 + 15.2]}
          color="#BAE6FD"
          intensity={0.85}
          distance={14}
          decay={1.7}
        />

        {/* WEST HALLWAY PARTITION WALL (x = -1.65) with Doorways at dz [4.25, 6.55] & [13.85, 16.15] */}
        <mesh position={[-HALLWAY_HALF_WIDTH, HALLWAY_HEIGHT / 2, z0 + 2.125]}>
          <boxGeometry args={[0.14, HALLWAY_HEIGHT, 4.25]} />
          <meshStandardMaterial color="#1C2230" roughness={0.78} />
        </mesh>
        <mesh position={[-HALLWAY_HALF_WIDTH, HALLWAY_HEIGHT / 2, z0 + 10.2]}>
          <boxGeometry args={[0.14, HALLWAY_HEIGHT, 7.3]} />
          <meshStandardMaterial color="#1C2230" roughness={0.78} />
        </mesh>
        <mesh position={[-HALLWAY_HALF_WIDTH, HALLWAY_HEIGHT / 2, z0 + 18.275]}>
          <boxGeometry args={[0.14, HALLWAY_HEIGHT, 4.25]} />
          <meshStandardMaterial color="#1C2230" roughness={0.78} />
        </mesh>
        {/* West Doorway Lintels (y = 3.45, height 0.7) */}
        <mesh position={[-HALLWAY_HALF_WIDTH, 3.45, z0 + 5.4]}>
          <boxGeometry args={[0.14, 0.7, 2.3]} />
          <meshStandardMaterial color="#1C2230" roughness={0.78} />
        </mesh>
        <mesh position={[-HALLWAY_HALF_WIDTH, 3.45, z0 + 15.0]}>
          <boxGeometry args={[0.14, 0.7, 2.3]} />
          <meshStandardMaterial color="#1C2230" roughness={0.78} />
        </mesh>

        {/* EAST HALLWAY PARTITION WALL (x = +1.65) with Doorway at dz [4.25, 6.55] */}
        <mesh position={[HALLWAY_HALF_WIDTH, HALLWAY_HEIGHT / 2, z0 + 2.125]}>
          <boxGeometry args={[0.14, HALLWAY_HEIGHT, 4.25]} />
          <meshStandardMaterial color="#1C2230" roughness={0.78} />
        </mesh>
        <mesh position={[HALLWAY_HALF_WIDTH, HALLWAY_HEIGHT / 2, z0 + 13.475]}>
          <boxGeometry args={[0.14, HALLWAY_HEIGHT, 13.85]} />
          <meshStandardMaterial color="#1C2230" roughness={0.78} />
        </mesh>
        <mesh position={[HALLWAY_HALF_WIDTH, 3.45, z0 + 5.4]}>
          <boxGeometry args={[0.14, 0.7, 2.3]} />
          <meshStandardMaterial color="#1C2230" roughness={0.78} />
        </mesh>

        {/* South End Hallway Lintel above Outdoor Deck Portal (dz = 20.4) */}
        <mesh position={[0, 3.5, z0 + HALLWAY_LENGTH]}>
          <boxGeometry args={[HALLWAY_HALF_WIDTH * 2, 0.65, 0.16]} />
          <meshStandardMaterial color="#241914" roughness={0.8} />
        </mesh>

        {/* Illuminated Overhead Wayfinding Signs in the Hallway */}
        <DoorwaySign3D
          position={[-1.55, 3.32, z0 + 5.4]}
          rotationY={Math.PI / 2}
          label="💼 EXECUTIVE BOARDROOM"
          sublabel="9-Seat Strategy Table · Presentation Wall"
          accent="#F59E0B"
        />
        <DoorwaySign3D
          position={[1.55, 3.32, z0 + 5.4]}
          rotationY={-Math.PI / 2}
          label="🔥 COZY LIBRARY & HEARTH"
          sublabel="Crackling Fireplace · Study Chairs"
          accent="#EA580C"
        />
        <DoorwaySign3D
          position={[-1.55, 3.32, z0 + 15.0]}
          rotationY={Math.PI / 2}
          label="🛰 COMMAND & CONTROL"
          sublabel="Aux Screen · Live Weather · Breaking News"
          accent="#38BDF8"
        />
        <DoorwaySign3D
          position={[0, 3.42, z0 + HALLWAY_LENGTH - 0.12]}
          rotationY={Math.PI}
          label="🏔 OUTDOOR LAKE & MOUNTAIN DECK"
          sublabel="Step outside to Alpine Vista & Firepit ↑"
          accent="#34D399"
        />

        {/* Interactive 3D Clubhouse Directory Board inside Hallway Entrance ([1.56, 1.62, z0 + 2.2]) */}
        <group position={[1.55, 1.68, z0 + 2.15]} rotation={[0, -Math.PI / 2, 0]}>
          <RoundedBox args={[1.58, 1.24, 0.04]} radius={0.025} smoothness={2}>
            <meshStandardMaterial color="#0B101B" metalness={0.45} roughness={0.4} />
          </RoundedBox>
          <Text
            position={[0, 0.48, 0.026]}
            fontSize={0.068}
            color="#E5A93C"
            anchorX="center"
            anchorY="middle"
          >
            🏛 CLUBHOUSE WING DIRECTORY
          </Text>
          <Text
            position={[0, 0.37, 0.026]}
            fontSize={0.038}
            color="#94A3B8"
            anchorX="center"
            anchorY="middle"
          >
            Walk down the hallway or click any room to fast-travel
          </Text>
          {wingLayout.destinations
            .filter((d) => d.id !== 'hallway')
            .map((dest, idx) => (
              <group
                key={dest.id}
                position={[0, 0.21 - idx * 0.175, 0.026]}
                onClick={(e) => {
                  e.stopPropagation()
                  if (onJumpToDestination) {
                    onJumpToDestination(dest)
                  } else if (onTeleportToFloor) {
                    onTeleportToFloor(dest.spawnPosition)
                  }
                }}
              >
                <RoundedBox args={[1.38, 0.14, 0.015]} radius={0.018} smoothness={2}>
                  <meshBasicMaterial color="#162032" />
                </RoundedBox>
                <Text
                  position={[-0.62, 0, 0.012]}
                  fontSize={0.046}
                  color="#F8FAFC"
                  anchorX="left"
                  anchorY="middle"
                >
                  {`${dest.emoji} ${dest.title}`}
                </Text>
                <Text
                  position={[0.62, 0, 0.012]}
                  fontSize={0.04}
                  color={dest.accentColor}
                  anchorX="right"
                  anchorY="middle"
                >
                  GO →
                </Text>
              </group>
            ))}
        </group>

        {/* Framed Gallery Art Prints along East Rear Hallway Wall */}
        {[11.6, 15.0, 18.2].map((artDz, idx) => (
          <group
            key={artDz}
            position={[1.56, 1.82, z0 + artDz]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            <RoundedBox args={[1.35, 0.92, 0.03]} radius={0.015}>
              <meshStandardMaterial color="#B8893A" metalness={0.65} roughness={0.35} />
            </RoundedBox>
            <mesh position={[0, 0, 0.018]}>
              <planeGeometry args={[1.22, 0.78]} />
              <meshBasicMaterial
                color={idx === 0 ? '#1E3A5F' : idx === 1 ? '#3B234A' : '#143832'}
              />
            </mesh>
          </group>
        ))}
      </group>

      {/* =================================================================== */}
      {/* 2. FANCY EXECUTIVE BOARD ROOM (West Wing Front, x -11.2..-1.65)     */}
      {/* =================================================================== */}
      <group name="wing-executive-boardroom">
        {/* Polished Travertine Floor + Charcoal Wool Executive Rug */}
        <mesh
          position={[-6.425, 0.005, boardZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          onDoubleClick={(e) => {
            if (!onTeleportToFloor) return
            e.stopPropagation()
            onTeleportToFloor([e.point.x, 0, e.point.z])
          }}
        >
          <planeGeometry args={[9.55, 8.8]} />
          <meshStandardMaterial color="#181617" roughness={0.58} metalness={0.22} />
        </mesh>
        <mesh
          position={[-6.4, 0.011, boardZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[6.4, 4.1]} />
          <meshStandardMaterial color="#242936" roughness={0.92} />
        </mesh>

        {/* Coffered Ceiling + Sculptural Linear Brass Chandelier */}
        <mesh position={[-6.425, 3.85, boardZ]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[9.55, 8.8]} />
          <meshStandardMaterial color="#121012" roughness={0.88} />
        </mesh>
        <group position={[-6.4, 3.12, boardZ]}>
          <mesh>
            <boxGeometry args={[3.4, 0.06, 0.24]} />
            <meshStandardMaterial color="#C89B48" metalness={0.8} roughness={0.22} />
          </mesh>
          <mesh position={[0, -0.04, 0]}>
            <boxGeometry args={[3.2, 0.03, 0.16]} />
            <meshBasicMaterial color="#FEF3C7" />
          </mesh>
        </group>
        <pointLight
          position={[-6.4, 2.85, boardZ]}
          color="#FDE68A"
          intensity={1.15}
          distance={12}
          decay={1.7}
        />

        {/* West, North, and South Burl-Walnut Walls */}
        <mesh position={[-11.2, 1.925, boardZ]}>
          <boxGeometry args={[0.14, 3.85, 8.8]} />
          <meshStandardMaterial color="#241610" roughness={0.7} />
        </mesh>
        <mesh position={[-6.425, 1.925, z0 + 1.0]}>
          <boxGeometry args={[9.55, 3.85, 0.14]} />
          <meshStandardMaterial color="#291912" roughness={0.72} />
        </mesh>
        <mesh position={[-6.425, 1.925, z0 + 9.8]}>
          <boxGeometry args={[9.55, 3.85, 0.14]} />
          <meshStandardMaterial color="#291912" roughness={0.72} />
        </mesh>

        {/* North Wall Backlit Dusk City Skyline Accent Window */}
        <group position={[-6.4, 2.05, z0 + 1.1]}>
          <RoundedBox args={[4.8, 1.75, 0.05]} radius={0.02}>
            <meshStandardMaterial color="#B8893A" metalness={0.7} roughness={0.3} />
          </RoundedBox>
          <mesh position={[0, 0, 0.028]}>
            <planeGeometry args={[4.6, 1.56]} />
            <meshBasicMaterial color="#172554" />
          </mesh>
          <mesh position={[0, -0.42, 0.03]}>
            <planeGeometry args={[4.6, 0.55]} />
            <meshBasicMaterial color="#F59E0B" transparent opacity={0.32} />
          </mesh>
          {[-1.7, -1.0, -0.35, 0.25, 0.95, 1.65].map((bx, idx) => {
            const bh = 0.55 + ((idx * 3) % 4) * 0.22
            return (
              <mesh key={bx} position={[bx, -0.78 + bh / 2, 0.033]}>
                <planeGeometry args={[0.44, bh]} />
                <meshBasicMaterial color="#090D16" />
              </mesh>
            )
          })}
        </group>

        {/* South Wall Executive Credenza Sideboard */}
        <RoundedBox
          args={[3.6, 0.82, 0.52]}
          position={[-6.4, 0.41, z0 + 9.38]}
          radius={0.03}
        >
          <meshStandardMaterial color="#331D12" roughness={0.55} metalness={0.18} />
        </RoundedBox>

        {/* Grand 4.8m Walnut & Calacatta Marble Conference Table */}
        <group position={[-6.4, 0, boardZ]}>
          {/* Dual Sculpted Brass/Walnut Pedestals */}
          {[-1.45, 1.45].map((px) => (
            <mesh key={px} position={[px, 0.36, 0]}>
              <cylinderGeometry args={[0.32, 0.4, 0.72, 16]} />
              <meshStandardMaterial color="#2A170E" roughness={0.55} metalness={0.3} />
            </mesh>
          ))}
          {/* Outer Burl Walnut Tabletop */}
          <RoundedBox args={[4.8, 0.08, 1.65]} position={[0, 0.74, 0]} radius={0.035} smoothness={2}>
            <meshStandardMaterial
              color="#4E2B19"
              emissive="#3A1E0F"
              emissiveIntensity={0.42}
              roughness={0.36}
              metalness={0.2}
            />
          </RoundedBox>
          {/* Center Calacatta Marble Inlay + Brass Conference Pods */}
          <mesh position={[0, 0.783, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.6, 0.62]} />
            <meshStandardMaterial
              color="#F4F1EA"
              emissive="#D6D1C7"
              emissiveIntensity={0.25}
              roughness={0.28}
              metalness={0.12}
            />
          </mesh>
          {[-1.1, 0, 1.1].map((mx) => (
            <mesh key={mx} position={[mx, 0.795, 0]}>
              <boxGeometry args={[0.22, 0.02, 0.14]} />
              <meshStandardMaterial
                color="#D4A54E"
                emissive="#8A6421"
                emissiveIntensity={0.38}
                metalness={0.8}
                roughness={0.25}
              />
            </mesh>
          ))}
        </group>

        {/* West Wall Interactive Executive Presentation / Lounge-Mirror Screen */}
        <group position={[-11.05, 2.02, boardZ]} rotation={[0, Math.PI / 2, 0]}>
          <RoundedBox args={[3.86, 2.26, 0.05]} radius={0.03} smoothness={2}>
            <meshStandardMaterial color="#181310" metalness={0.55} roughness={0.35} />
          </RoundedBox>

          {boardroomShowingMirror ? (
            <mesh position={[0, 0.06, 0.029]}>
              <planeGeometry args={[3.66, 1.94]} />
              <meshBasicMaterial map={mainVideoTexture} toneMapped={false} />
            </mesh>
          ) : (
            <group position={[0, 0.06, 0.029]}>
              <mesh>
                <planeGeometry args={[3.66, 1.94]} />
                <meshBasicMaterial color="#0C1322" />
              </mesh>
              <Text
                position={[-1.65, 0.76, 0.008]}
                fontSize={0.062}
                color={activeSlide.accent}
                anchorX="left"
                anchorY="middle"
              >
                {activeSlide.tag}
              </Text>
              <Text
                position={[-1.65, 0.54, 0.008]}
                fontSize={0.115}
                color="#F8FAFC"
                maxWidth={3.3}
                anchorX="left"
                anchorY="middle"
              >
                {activeSlide.title}
              </Text>
              <Text
                position={[-1.65, 0.31, 0.008]}
                fontSize={0.065}
                color="#E5A93C"
                anchorX="left"
                anchorY="middle"
              >
                {activeSlide.headlineMetric}
              </Text>
              {activeSlide.bullets.map((line, bIdx) => (
                <Text
                  key={bIdx}
                  position={[-1.65, 0.06 - bIdx * 0.21, 0.008]}
                  fontSize={0.06}
                  color="#CBD5E1"
                  maxWidth={3.32}
                  anchorX="left"
                  anchorY="middle"
                >
                  {line}
                </Text>
              ))}
            </group>
          )}

          {/* Bottom Bezel Controls: Strategy Slides vs Live Lounge Mirror */}
          <group position={[0, -0.99, 0.032]}>
            <group
              position={[-1.12, 0, 0]}
              onClick={(e) => {
                e.stopPropagation()
                onUpdateWingState({ boardroomScreenMode: 'agenda' })
              }}
            >
              <RoundedBox args={[1.05, 0.13, 0.015]} radius={0.018}>
                <meshBasicMaterial
                  color={wingState.boardroomScreenMode === 'agenda' ? '#E5A93C' : '#1E293B'}
                />
              </RoundedBox>
              <Text
                position={[0, 0, 0.012]}
                fontSize={0.05}
                color={wingState.boardroomScreenMode === 'agenda' ? '#080A0D' : '#F8FAFC'}
                anchorX="center"
                anchorY="middle"
              >
                📊 Strategy Deck
              </Text>
            </group>

            <group
              position={[0.02, 0, 0]}
              onClick={(e) => {
                e.stopPropagation()
                onUpdateWingState({
                  boardroomScreenMode: 'agenda',
                  boardroomAgendaIndex:
                    (wingState.boardroomAgendaIndex + 1) %
                    BOARDROOM_STRATEGY_SLIDES.length,
                })
              }}
            >
              <RoundedBox args={[0.98, 0.13, 0.015]} radius={0.018}>
                <meshBasicMaterial color="#1E293B" />
              </RoundedBox>
              <Text
                position={[0, 0, 0.012]}
                fontSize={0.05}
                color="#F8FAFC"
                anchorX="center"
                anchorY="middle"
              >
                {`⏭ Slide ${wingState.boardroomAgendaIndex + 1}/${BOARDROOM_STRATEGY_SLIDES.length}`}
              </Text>
            </group>

            <group
              position={[1.18, 0, 0]}
              onClick={(e) => {
                e.stopPropagation()
                onUpdateWingState({ boardroomScreenMode: 'mirror-lounge' })
              }}
            >
              <RoundedBox args={[1.12, 0.13, 0.015]} radius={0.018}>
                <meshBasicMaterial
                  color={
                    wingState.boardroomScreenMode === 'mirror-lounge'
                      ? '#38BDF8'
                      : '#1E293B'
                  }
                />
              </RoundedBox>
              <Text
                position={[0, 0, 0.012]}
                fontSize={0.05}
                color={
                  wingState.boardroomScreenMode === 'mirror-lounge'
                    ? '#080A0D'
                    : '#F8FAFC'
                }
                anchorX="center"
                anchorY="middle"
              >
                📺 Mirror Lounge
              </Text>
            </group>
          </group>
        </group>

        {/* 9 Click-to-Sit Leather Executive Chairs */}
        {boardroomSeats.map((seat) => (
          <ExecutiveLeatherChair
            key={seat.id}
            seat={seat}
            isLocalSeat={localSeatId === seat.id}
            occupant={seatOccupants.get(seat.id)}
            onSelectSeat={onSelectSeat}
          />
        ))}
      </group>

      {/* =================================================================== */}
      {/* 3. COZY LIBRARY & CRACKLING FIREPLACE (East Wing Front, x 1.65..11.2) */}
      {/* =================================================================== */}
      <group name="wing-cozy-library">
        {/* Warm Oak Floor + Ornate Crimson & Gold Persian Rug */}
        <mesh
          position={[6.425, 0.005, libZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          onDoubleClick={(e) => {
            if (!onTeleportToFloor) return
            e.stopPropagation()
            onTeleportToFloor([e.point.x, 0, e.point.z])
          }}
        >
          <planeGeometry args={[9.55, 8.8]} />
          <meshStandardMaterial
            color="#3B2216"
            emissive="#24130B"
            emissiveIntensity={0.35}
            roughness={0.68}
          />
        </mesh>
        <mesh
          position={[6.8, 0.012, libZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[5.4, 4.6]} />
          <meshStandardMaterial
            color="#7A222A"
            emissive="#4A1217"
            emissiveIntensity={0.38}
            roughness={0.92}
          />
        </mesh>
        <mesh
          position={[6.8, 0.015, libZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[4.6, 3.8]} />
          <meshStandardMaterial
            color="#962E35"
            emissive="#5E1A1E"
            emissiveIntensity={0.38}
            roughness={0.92}
          />
        </mesh>

        {/* Timber Ceiling + Warm Study Chandelier Glow */}
        <mesh position={[6.425, 3.85, libZ]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[9.55, 8.8]} />
          <meshStandardMaterial color="#1D120C" roughness={0.9} />
        </mesh>
        <pointLight
          position={[6.2, 3.1, libZ]}
          color="#FDBA74"
          intensity={0.75}
          distance={11}
          decay={1.8}
        />

        {/* East, North, and South Heritage Forest-Green & Mahogany Study Walls */}
        <mesh position={[11.2, 1.925, libZ]}>
          <boxGeometry args={[0.14, 3.85, 8.8]} />
          <meshStandardMaterial
            color="#1E352D"
            emissive="#0F1F1A"
            emissiveIntensity={0.35}
            roughness={0.82}
          />
        </mesh>
        <mesh position={[6.425, 1.925, z0 + 1.0]}>
          <boxGeometry args={[9.55, 3.85, 0.14]} />
          <meshStandardMaterial
            color="#1E352D"
            emissive="#0F1F1A"
            emissiveIntensity={0.35}
            roughness={0.82}
          />
        </mesh>
        <mesh position={[6.425, 1.925, z0 + 9.8]}>
          <boxGeometry args={[9.55, 3.85, 0.14]} />
          <meshStandardMaterial
            color="#1E352D"
            emissive="#0F1F1A"
            emissiveIntensity={0.35}
            roughness={0.82}
          />
        </mesh>

        {/* Wraparound Floor-to-Ceiling Mahogany Bookcases */}
        <ProceduralBookcaseUnit position={[4.2, 0, z0 + 1.28]} rotationY={0} width={2.5} />
        <ProceduralBookcaseUnit position={[7.0, 0, z0 + 1.28]} rotationY={0} width={2.5} />
        <ProceduralBookcaseUnit position={[4.2, 0, z0 + 9.52]} rotationY={Math.PI} width={2.5} />
        <ProceduralBookcaseUnit position={[7.0, 0, z0 + 9.52]} rotationY={Math.PI} width={2.5} />
        {/* Bookcases flanking the Stone Fireplace on the East Wall */}
        <ProceduralBookcaseUnit
          position={[10.92, 0, libZ - 2.65]}
          rotationY={-Math.PI / 2}
          width={2.2}
        />
        <ProceduralBookcaseUnit
          position={[10.92, 0, libZ + 2.65]}
          rotationY={-Math.PI / 2}
          width={2.2}
        />

        {/* Leaning Brass Library Ladder */}
        <group position={[5.45, 1.65, z0 + 1.62]} rotation={[0.18, 0, 0]}>
          {[-0.22, 0.22].map((lx) => (
            <mesh key={lx} position={[lx, 0, 0]}>
              <cylinderGeometry args={[0.018, 0.018, 3.3, 8]} />
              <meshStandardMaterial color="#C89B48" metalness={0.75} roughness={0.28} />
            </mesh>
          ))}
        </group>

        {/* =============================================================== */}
        {/* CRACKLING STONE HEARTH FIREPLACE (East Wall [10.65, 0, libZ])   */}
        {/* =============================================================== */}
        <group position={[10.62, 0, libZ]} rotation={[0, -Math.PI / 2, 0]}>
          {/* Stacked Slate Stone Chimney Breast */}
          <mesh position={[0, 1.925, -0.1]}>
            <boxGeometry args={[2.55, 3.85, 0.72]} />
            <meshStandardMaterial
              color="#47505E"
              emissive="#252A34"
              emissiveIntensity={0.35}
              roughness={0.92}
            />
          </mesh>
          {/* Hearth Floor Apron */}
          <mesh position={[0, 0.06, 0.42]}>
            <boxGeometry args={[2.75, 0.12, 0.88]} />
            <meshStandardMaterial
              color="#333A46"
              emissive="#1C2028"
              emissiveIntensity={0.3}
              roughness={0.85}
            />
          </mesh>
          {/* Carved Walnut Mantelpiece */}
          <RoundedBox args={[2.78, 0.16, 0.92]} position={[0, 1.48, 0.12]} radius={0.025}>
            <meshStandardMaterial
              color="#4E2816"
              emissive="#361B0E"
              emissiveIntensity={0.42}
              roughness={0.55}
            />
          </RoundedBox>
          {/* Dark Recessed Firebox */}
          <mesh position={[0, 0.68, 0.16]}>
            <boxGeometry args={[1.48, 1.12, 0.36]} />
            <meshBasicMaterial color="#0D0908" />
          </mesh>
          {/* Glowing Charred Oak Logs */}
          <mesh position={[0, 0.24, 0.24]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.09, 0.1, 0.96, 8]} />
            <meshStandardMaterial
              color="#2A160E"
              emissive={wingState.libraryFireLit ? '#EA580C' : '#000000'}
              emissiveIntensity={wingState.libraryFireLit ? 0.55 : 0}
            />
          </mesh>
          <mesh position={[0.08, 0.31, 0.28]} rotation={[0.2, 0.35, Math.PI / 2]}>
            <cylinderGeometry args={[0.075, 0.085, 0.82, 8]} />
            <meshStandardMaterial
              color="#2A160E"
              emissive={wingState.libraryFireLit ? '#F97316' : '#000000'}
              emissiveIntensity={wingState.libraryFireLit ? 0.65 : 0}
            />
          </mesh>

          {/* Animated Flickering 3D Hearth Flames */}
          {wingState.libraryFireLit && (
            <group position={[0, 0.34, 0.26]} ref={hearthFlameRef}>
              <mesh position={[0, 0.28, 0]} raycast={() => null}>
                <coneGeometry args={[0.32, 0.62, 7]} />
                <meshBasicMaterial color="#F97316" />
              </mesh>
              <mesh position={[-0.22, 0.2, 0.03]} raycast={() => null}>
                <coneGeometry args={[0.2, 0.44, 6]} />
                <meshBasicMaterial color="#FB923C" />
              </mesh>
              <mesh position={[0.22, 0.22, 0.02]} raycast={() => null}>
                <coneGeometry args={[0.21, 0.46, 6]} />
                <meshBasicMaterial color="#FACC15" />
              </mesh>
            </group>
          )}

          <pointLight
            ref={hearthLightRef}
            position={[0, 0.72, 0.78]}
            color="#FB923C"
            intensity={1.15}
            distance={10}
            decay={1.7}
          />

          {/* Interactive Mantel Controls Plaque (Flame & Crackling Audio) */}
          <group position={[0, 1.88, 0.28]}>
            <RoundedBox args={[1.64, 0.38, 0.03]} radius={0.02}>
              <meshBasicMaterial color="#16110E" />
            </RoundedBox>
            <Text
              position={[0, 0.1, 0.02]}
              fontSize={0.052}
              color="#FDBA74"
              anchorX="center"
              anchorY="middle"
            >
              🔥 FIRESIDE HEARTH CONTROLS
            </Text>
            <group
              position={[-0.39, -0.055, 0.02]}
              onClick={(e) => {
                e.stopPropagation()
                onUpdateWingState({ libraryFireLit: !wingState.libraryFireLit })
              }}
            >
              <RoundedBox args={[0.7, 0.14, 0.015]} radius={0.016}>
                <meshBasicMaterial
                  color={wingState.libraryFireLit ? '#EA580C' : '#334155'}
                />
              </RoundedBox>
              <Text
                position={[0, 0, 0.012]}
                fontSize={0.044}
                color="#F8FAFC"
                anchorX="center"
                anchorY="middle"
              >
                {wingState.libraryFireLit ? '🔥 Flames: Lit' : '🔥 Light Fire'}
              </Text>
            </group>

            <group
              position={[0.39, -0.055, 0.02]}
              onClick={(e) => {
                e.stopPropagation()
                const playing = fireplaceAudio.toggle()
                setCrackleAudioOn(playing)
              }}
            >
              <RoundedBox args={[0.7, 0.14, 0.015]} radius={0.016}>
                <meshBasicMaterial color={crackleAudioOn ? '#34D399' : '#1E293B'} />
              </RoundedBox>
              <Text
                position={[0, 0, 0.012]}
                fontSize={0.044}
                color={crackleAudioOn ? '#080A0D' : '#F8FAFC'}
                anchorX="center"
                anchorY="middle"
              >
                {crackleAudioOn ? '🔊 Crackle On' : '🔇 Crackle Sound'}
              </Text>
            </group>
          </group>
        </group>

        {/* Central Walnut Reading Table + Warm Banker Lamp */}
        <group position={[6.7, 0, libZ]}>
          <RoundedBox args={[0.92, 0.06, 0.92]} position={[0, 0.54, 0]} radius={0.025}>
            <meshStandardMaterial color="#3C2113" roughness={0.45} />
          </RoundedBox>
          <mesh position={[0, 0.27, 0]}>
            <cylinderGeometry args={[0.12, 0.24, 0.54, 12]} />
            <meshStandardMaterial color="#2C170D" roughness={0.6} />
          </mesh>
          {/* Brass Banker Lamp */}
          <mesh position={[0, 0.68, 0]}>
            <cylinderGeometry args={[0.025, 0.06, 0.24, 8]} />
            <meshStandardMaterial color="#C89B48" metalness={0.8} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.82, 0]}>
            <cylinderGeometry args={[0.12, 0.16, 0.1, 10]} />
            <meshBasicMaterial color="#15803D" />
          </mesh>
        </group>

        {/* 4 Click-to-Sit Chesterfield Wingback Armchairs */}
        {librarySeats.map((seat) => (
          <ChesterfieldArmchair
            key={seat.id}
            seat={seat}
            isLocalSeat={localSeatId === seat.id}
            occupant={seatOccupants.get(seat.id)}
            onSelectSeat={onSelectSeat}
          />
        ))}
      </group>

      {/* =================================================================== */}
      {/* 4. COMMAND & CONTROL CENTER (West Wing Rear)                        */}
      {/* =================================================================== */}
      <CommandCenterRoom3D
        wingLayout={wingLayout}
        wingState={wingState}
        presenterState={presenterState}
        mainVideoTexture={mainVideoTexture}
        hasMainVideoFrames={hasMainVideoFrames}
        computedSeats={computedSeats}
        localSeatId={localSeatId}
        participants={participants}
        cinemaVolume={cinemaVolume}
        onSelectSeat={onSelectSeat}
        onTeleportToFloor={onTeleportToFloor}
        onUpdateWingState={onUpdateWingState}
        onOpenCommandOpsDrawer={onOpenCommandOpsDrawer}
      />

      {/* =================================================================== */}
      {/* 5. OUTDOOR LAKE & MOUNTAIN OBSERVATION DECK (South Vista)           */}
      {/* =================================================================== */}
      <OutdoorLakeDeck3D
        wingLayout={wingLayout}
        wingState={wingState}
        computedSeats={computedSeats}
        localSeatId={localSeatId}
        participants={participants}
        onSelectSeat={onSelectSeat}
        onTeleportToFloor={onTeleportToFloor}
        onUpdateWingState={onUpdateWingState}
      />
    </group>
  )
}
