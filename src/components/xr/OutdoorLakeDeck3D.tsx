import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  OUTDOOR_SKY_PRESETS,
  type ExpansionWingLayout,
} from '../../constants/expansionRooms'
import type { CornholeBagRecord, CornholeState } from '../../types/barGames'
import type {
  ComputedSeat,
  ExpansionWingSyncedState,
  OutdoorSkyPresetId,
  ParticipantProfile,
  RoomLightingConfig,
} from '../../types/lounge'
import { DeckCornhole3D } from './DeckCornhole3D'

const noopRaycast = () => null

interface DeckChairProps {
  seat: ComputedSeat
  isLocalSeat: boolean
  occupant?: ParticipantProfile
  brightnessScale: number
  onSelectSeat: (seatId: string) => void
}

function CedarAdirondackChair({
  seat,
  isLocalSeat,
  occupant,
  brightnessScale,
  onSelectSeat,
}: DeckChairProps) {
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
        if (!takenByOther) {
          onSelectSeat(seat.id)
        }
      }}
    >
      {/* Honey-Cedar Timber Frame + Plush Weatherproof Cream Cushion */}
      <RoundedBox args={[0.68, 0.1, 0.64]} position={[0, 0.36, 0]} radius={0.025} smoothness={2}>
        <meshStandardMaterial
          color={hovered && !takenByOther ? '#B8663A' : '#9B532B'}
          roughness={0.62}
          emissive="#4A2511"
          emissiveIntensity={0.24 * brightnessScale}
        />
      </RoundedBox>
      <RoundedBox args={[0.58, 0.09, 0.54]} position={[0, 0.43, -0.02]} radius={0.03} smoothness={2}>
        <meshStandardMaterial
          color="#F8F5EE"
          roughness={0.75}
          emissive="#D6CFC2"
          emissiveIntensity={0.18 * brightnessScale}
        />
      </RoundedBox>
      {/* Slanted Adirondack Backrest + Golden Accent Lumbar Pillow */}
      <RoundedBox
        args={[0.62, 0.74, 0.08]}
        position={[0, 0.75, 0.27]}
        rotation={[0.24, 0, 0]}
        radius={0.025}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#9B532B"
          roughness={0.62}
          emissive="#4A2511"
          emissiveIntensity={0.24 * brightnessScale}
        />
      </RoundedBox>
      <RoundedBox
        args={[0.44, 0.22, 0.07]}
        position={[0, 0.58, 0.19]}
        rotation={[0.24, 0, 0]}
        radius={0.025}
        smoothness={2}
      >
        <meshStandardMaterial
          color={isLocalSeat ? '#E5A93C' : '#D97706'}
          roughness={0.68}
          emissive="#78350F"
          emissiveIntensity={0.22 * brightnessScale}
        />
      </RoundedBox>
      {/* Wide Cedar Armrests & Legs */}
      {[-0.34, 0.34].map((lx) => (
        <group key={lx}>
          <RoundedBox args={[0.11, 0.04, 0.66]} position={[lx, 0.56, 0.02]} radius={0.015}>
            <meshStandardMaterial
              color="#AD5D32"
              roughness={0.58}
              emissive="#4A2511"
              emissiveIntensity={0.22 * brightnessScale}
            />
          </RoundedBox>
          <mesh position={[lx, 0.26, -0.22]}>
            <boxGeometry args={[0.07, 0.52, 0.08]} />
            <meshStandardMaterial color="#7C3F21" roughness={0.75} />
          </mesh>
          <mesh position={[lx, 0.2, 0.24]}>
            <boxGeometry args={[0.07, 0.4, 0.08]} />
            <meshStandardMaterial color="#7C3F21" roughness={0.75} />
          </mesh>
        </group>
      ))}

      {(hovered || isLocalSeat) && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.49, 24]} />
          <meshBasicMaterial
            color={isLocalSeat ? '#E5A93C' : takenByOther ? '#EF4444' : '#34D399'}
          />
        </mesh>
      )}
    </group>
  )
}

function BrassScenicTelescope({
  position,
  rotationY = 0,
}: {
  position: [number, number, number]
  rotationY?: number
}) {
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      {/* Heavy Cast-Bronze Pedestal Base & Tripod Column */}
      <mesh position={[0, 0.04, 0]} raycast={noopRaycast}>
        <cylinderGeometry args={[0.2, 0.26, 0.08, 12]} />
        <meshStandardMaterial color="#1E293B" metalness={0.75} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.62, 0]} raycast={noopRaycast}>
        <cylinderGeometry args={[0.045, 0.065, 1.12, 10]} />
        <meshStandardMaterial color="#D97706" metalness={0.82} roughness={0.22} />
      </mesh>
      {/* Brass Azimuth Yoke */}
      <mesh position={[0, 1.2, 0]} raycast={noopRaycast}>
        <sphereGeometry args={[0.075, 10, 8]} />
        <meshStandardMaterial color="#F59E0B" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Polished Brass Optical Tube Pointed Toward the Mountains & Waterfall */}
      <group position={[0, 1.25, 0]} rotation={[-0.12, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]} raycast={noopRaycast}>
          <cylinderGeometry args={[0.055, 0.038, 0.72, 12]} />
          <meshStandardMaterial
            color="#FBBF24"
            metalness={0.88}
            roughness={0.18}
            emissive="#78350F"
            emissiveIntensity={0.25}
          />
        </mesh>
        {/* Objective Lens Hood & Glowing Glass Element */}
        <mesh position={[0, 0, 0.38]} rotation={[Math.PI / 2, 0, 0]} raycast={noopRaycast}>
          <cylinderGeometry args={[0.064, 0.056, 0.12, 12]} />
          <meshStandardMaterial color="#D97706" metalness={0.85} roughness={0.22} />
        </mesh>
        <mesh position={[0, 0, 0.442]} raycast={noopRaycast}>
          <circleGeometry args={[0.056, 12]} />
          <meshBasicMaterial color="#38BDF8" fog={false} />
        </mesh>
        {/* Eyepiece */}
        <mesh position={[0, 0, -0.39]} rotation={[Math.PI / 2, 0, 0]} raycast={noopRaycast}>
          <cylinderGeometry args={[0.024, 0.032, 0.1, 10]} />
          <meshStandardMaterial color="#0F172A" metalness={0.6} roughness={0.35} />
        </mesh>
      </group>
    </group>
  )
}

function PineTreeCluster({
  position,
  scale = 1,
  color,
  snowTint,
}: {
  position: [number, number, number]
  scale?: number
  color: string
  snowTint?: string
}) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.8, 0]} raycast={noopRaycast}>
        <cylinderGeometry args={[0.18, 0.26, 1.6, 6]} />
        <meshBasicMaterial color="#3B2314" fog={false} />
      </mesh>
      <mesh position={[0, 2.4, 0]} raycast={noopRaycast}>
        <coneGeometry args={[1.48, 2.8, 7]} />
        <meshBasicMaterial color={color} fog={false} />
      </mesh>
      <mesh position={[0, 3.85, 0]} raycast={noopRaycast}>
        <coneGeometry args={[1.12, 2.4, 7]} />
        <meshBasicMaterial color={color} fog={false} />
      </mesh>
      <mesh position={[0, 5.05, 0]} raycast={noopRaycast}>
        <coneGeometry args={[0.74, 1.85, 7]} />
        <meshBasicMaterial color={snowTint ?? color} fog={false} />
      </mesh>
    </group>
  )
}

function SnowCappedMountain({
  position,
  radius,
  height,
  rockColor,
  sunlitColor,
  snowColor,
  withShoulder = true,
}: {
  position: [number, number, number]
  radius: number
  height: number
  rockColor: string
  sunlitColor: string
  snowColor: string
  withShoulder?: boolean
}) {
  return (
    <group position={position}>
      {/* Main Shadowed Alpine Peak */}
      <mesh position={[0, height / 2, 0]} raycast={noopRaycast}>
        <coneGeometry args={[radius, height, 7]} />
        <meshBasicMaterial color={rockColor} fog={false} />
      </mesh>
      {/* Sunlit / Alpenglow Ridge Facet (creates dramatic 3D alpine relief) */}
      <mesh
        position={[radius * 0.08, height * 0.49, -radius * 0.06]}
        rotation={[0, 0.45, 0]}
        raycast={noopRaycast}
      >
        <coneGeometry args={[radius * 0.92, height * 0.97, 5]} />
        <meshBasicMaterial color={sunlitColor} fog={false} />
      </mesh>
      {/* Main Glacial Snow Crown */}
      <mesh position={[0, height * 0.8, 0]} rotation={[0, 0.25, 0]} raycast={noopRaycast}>
        <coneGeometry args={[radius * 0.42, height * 0.42, 7]} />
        <meshBasicMaterial color={snowColor} fog={false} />
      </mesh>
      {/* Lower Glacial Snow Saddle */}
      <mesh
        position={[radius * 0.11, height * 0.68, -radius * 0.08]}
        rotation={[0, 0.8, 0]}
        raycast={noopRaycast}
      >
        <coneGeometry args={[radius * 0.34, height * 0.28, 6]} />
        <meshBasicMaterial color={snowColor} fog={false} />
      </mesh>
      {/* Flanking Foothill Shoulder Peak */}
      {withShoulder && (
        <group position={[radius * 0.52, 0, -radius * 0.18]}>
          <mesh position={[0, height * 0.31, 0]} raycast={noopRaycast}>
            <coneGeometry args={[radius * 0.58, height * 0.62, 6]} />
            <meshBasicMaterial color={rockColor} fog={false} />
          </mesh>
          <mesh position={[0, height * 0.51, 0]} raycast={noopRaycast}>
            <coneGeometry args={[radius * 0.22, height * 0.22, 6]} />
            <meshBasicMaterial color={snowColor} fog={false} />
          </mesh>
        </group>
      )}
    </group>
  )
}

function AlpineCloudCluster({
  position,
  scale = 1,
  color,
}: {
  position: [number, number, number]
  scale?: number
  color: string
}) {
  return (
    <group position={position} scale={scale}>
      <mesh raycast={noopRaycast}>
        <boxGeometry args={[7.5, 1.1, 2.2]} />
        <meshBasicMaterial color={color} transparent opacity={0.34} fog={false} />
      </mesh>
      <mesh position={[-1.8, 0.55, -0.2]} raycast={noopRaycast}>
        <boxGeometry args={[4.2, 0.95, 1.8]} />
        <meshBasicMaterial color={color} transparent opacity={0.42} fog={false} />
      </mesh>
      <mesh position={[1.9, 0.45, 0.2]} raycast={noopRaycast}>
        <boxGeometry args={[3.8, 0.85, 1.7]} />
        <meshBasicMaterial color={color} transparent opacity={0.38} fog={false} />
      </mesh>
    </group>
  )
}

export interface OutdoorLakeDeck3DProps {
  wingLayout: ExpansionWingLayout
  wingState: ExpansionWingSyncedState
  lighting: RoomLightingConfig
  computedSeats: ComputedSeat[]
  localSeatId?: string
  participants: ParticipantProfile[]
  cornholeState: CornholeState
  localDisplayName: string
  visible?: boolean
  isActiveRoom?: boolean
  onRecordCornholeThrow: (bag: CornholeBagRecord) => void
  onResetCornhole: () => void
  onSelectSeat: (seatId: string) => void
  onTeleportToFloor?: (point: [number, number, number]) => void
  onUpdateWingState: (patch: Partial<ExpansionWingSyncedState>) => void
}

// Pre-computed 80-star buffer geometry (1 single GPU draw call!)
const STARFIELD_GEOMETRY = (() => {
  const count = 80
  const positions = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    const angle = -Math.PI * 0.48 + (i / (count - 1)) * Math.PI * 0.96
    const radius = 64 + ((i * 17) % 18)
    const x = Math.sin(angle) * radius
    const y = 15 + ((i * 29) % 24)
    const dz = 46 + Math.cos(angle) * 38
    positions[i * 3] = x
    positions[i * 3 + 1] = y
    positions[i * 3 + 2] = dz
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  return geo
})()

export function OutdoorLakeDeck3D({
  wingLayout,
  wingState,
  lighting,
  computedSeats,
  localSeatId,
  participants,
  cornholeState,
  localDisplayName,
  visible = true,
  onRecordCornholeThrow,
  onResetCornhole,
  onSelectSeat,
  onTeleportToFloor,
  onUpdateWingState,
}: OutdoorLakeDeck3DProps) {
  const z0 = Number((wingLayout.hallEndZ - 20.4).toFixed(2))
  const sky =
    OUTDOOR_SKY_PRESETS[wingState.outdoorSkyPreset] ??
    OUTDOOR_SKY_PRESETS['golden-sunset']
  const brightnessScale = Math.max(0.6, Math.min(1.65, lighting.brightness))

  const shimmer1Ref = useRef<THREE.Mesh>(null)
  const shimmer2Ref = useRef<THREE.Mesh>(null)
  const shimmer3Ref = useRef<THREE.Mesh>(null)
  const boat1Ref = useRef<THREE.Group>(null)
  const boat2Ref = useRef<THREE.Group>(null)
  const pierBoatRef = useRef<THREE.Group>(null)
  const fireFlameRef = useRef<THREE.Group>(null)
  const aurora1Ref = useRef<THREE.Mesh>(null)
  const aurora2Ref = useRef<THREE.Mesh>(null)
  const waterfallFoamRef = useRef<THREE.Mesh>(null)
  const birdFlockRef = useRef<THREE.Group>(null)
  const cloudGroupRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    if (!visible) return
    const t = clock.getElapsedTime()
    if (shimmer1Ref.current) {
      shimmer1Ref.current.scale.x = 1 + Math.sin(t * 1.4) * 0.14
      shimmer1Ref.current.position.x = 1.5 + Math.sin(t * 0.7) * 0.45
    }
    if (shimmer2Ref.current) {
      shimmer2Ref.current.scale.x = 1 + Math.cos(t * 1.15 + 1.2) * 0.16
      shimmer2Ref.current.position.x = 2.6 + Math.cos(t * 0.55) * 0.65
    }
    if (shimmer3Ref.current) {
      shimmer3Ref.current.scale.x = 1 + Math.sin(t * 0.95 + 2.1) * 0.18
    }
    if (boat1Ref.current) {
      boat1Ref.current.position.y = -1.24 + Math.sin(t * 1.3) * 0.045
      boat1Ref.current.rotation.z = Math.sin(t * 1.1) * 0.035
    }
    if (boat2Ref.current) {
      boat2Ref.current.position.y = -1.24 + Math.cos(t * 1.05 + 1.4) * 0.04
      boat2Ref.current.rotation.z = Math.cos(t * 0.9) * 0.03
    }
    if (pierBoatRef.current) {
      pierBoatRef.current.position.y = -1.18 + Math.sin(t * 1.65 + 0.6) * 0.035
      pierBoatRef.current.rotation.z = Math.sin(t * 1.35) * 0.025
    }
    if (fireFlameRef.current) {
      fireFlameRef.current.scale.y =
        0.92 + Math.sin(t * 9.5) * 0.14 + Math.cos(t * 14.2) * 0.06
      fireFlameRef.current.rotation.y = t * 0.8
    }
    if (waterfallFoamRef.current) {
      const s = 1 + Math.sin(t * 3.8) * 0.12
      waterfallFoamRef.current.scale.set(s, s, 1)
    }
    if (birdFlockRef.current) {
      const angle = t * 0.18
      birdFlockRef.current.position.x = Math.cos(angle) * 14
      birdFlockRef.current.position.z = z0 + 52 + Math.sin(angle) * 8
      birdFlockRef.current.position.y = 11.5 + Math.sin(t * 0.7) * 0.6
      birdFlockRef.current.rotation.y = -angle + Math.PI
    }
    if (cloudGroupRef.current) {
      cloudGroupRef.current.position.x = Math.sin(t * 0.06) * 3.5
    }
    if (sky.showAurora) {
      if (aurora1Ref.current) {
        aurora1Ref.current.position.y = 23.0 + Math.sin(t * 0.55) * 0.85
        aurora1Ref.current.rotation.z = Math.sin(t * 0.35) * 0.045
      }
      if (aurora2Ref.current) {
        aurora2Ref.current.position.y = 25.2 + Math.cos(t * 0.48 + 1.1) * 0.75
        aurora2Ref.current.rotation.z = -Math.sin(t * 0.3 + 0.8) * 0.04
      }
    }
  })

  const deckSeats = useMemo(
    () =>
      computedSeats.filter(
        (s) => s.roomWing === 'outdoor-deck' && s.stationKind === 'seat',
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

  // Deck spans x in [-8.6, +8.6] (width 17.2), z in [z0 + 20.4, z0 + 29.8] (depth 9.4, center z0 + 25.1)
  const deckW = 17.2
  const deckD = 9.4
  const deckCenterZ = z0 + 25.1

  return (
    <group name="wing-outdoor-lake-deck" visible={visible}>
      {/* =================================================================== */}
      {/* REDWOOD & HONEY-CEDAR OBSERVATION DECK + WALKABLE LAKESHORE PIER    */}
      {/* =================================================================== */}
      <mesh
        position={[0, -0.08, deckCenterZ]}
        onDoubleClick={(e) => {
          if (!onTeleportToFloor) return
          e.stopPropagation()
          onTeleportToFloor([e.point.x, 0, e.point.z])
        }}
      >
        <boxGeometry args={[deckW, 0.18, deckD]} />
        <meshStandardMaterial
          color="#8B4A28"
          roughness={0.64}
          metalness={0.08}
          emissive="#4A2411"
          emissiveIntensity={0.28 * brightnessScale}
        />
      </mesh>

      {/* Rich Two-Tone Cedar Deck Plank Grooves & Inlay Border */}
      {[-7.2, -5.4, -3.6, -1.8, 0, 1.8, 3.6, 5.4, 7.2].map((px) => (
        <mesh
          key={px}
          position={[px, 0.013, deckCenterZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[0.035, deckD - 0.2]} />
          <meshBasicMaterial color="#4D2512" />
        </mesh>
      ))}
      {/* Warm Perimeter LED Deck Step-Lighting Strips */}
      <mesh
        position={[-4.95, 0.016, z0 + 29.65]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={noopRaycast}
      >
        <planeGeometry args={[6.9, 0.045]} />
        <meshBasicMaterial color="#FDE68A" />
      </mesh>
      <mesh
        position={[4.95, 0.016, z0 + 29.65]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={noopRaycast}
      >
        <planeGeometry args={[6.9, 0.045]} />
        <meshBasicMaterial color="#FDE68A" />
      </mesh>

      {/* Central Wooden Lakeshore Viewing Pier extending over the water (z0 + 29.8 -> z0 + 33.6) */}
      <mesh
        position={[0, -0.06, z0 + 31.6]}
        onDoubleClick={(e) => {
          if (!onTeleportToFloor) return
          e.stopPropagation()
          onTeleportToFloor([e.point.x, 0.02, e.point.z])
        }}
      >
        <boxGeometry args={[2.8, 0.16, 4.0]} />
        <meshStandardMaterial
          color="#9A532E"
          roughness={0.64}
          emissive="#4A2411"
          emissiveIntensity={0.26 * brightnessScale}
        />
      </mesh>
      {/* Pier Edge LED Guide Strips */}
      {[-1.34, 1.34].map((px) => (
        <mesh
          key={px}
          position={[px, 0.025, z0 + 31.6]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[0.04, 3.8]} />
          <meshBasicMaterial color="#FBBF24" />
        </mesh>
      ))}
      {/* Pier Timber Pilings into the Lake */}
      {[
        [-1.15, z0 + 30.8],
        [1.15, z0 + 30.8],
        [-1.15, z0 + 32.1],
        [1.15, z0 + 32.1],
        [-1.15, z0 + 33.3],
        [1.15, z0 + 33.3],
      ].map(([px, pz], idx) => (
        <mesh key={idx} position={[px, -0.75, pz]} raycast={noopRaycast}>
          <cylinderGeometry args={[0.12, 0.12, 1.55, 8]} />
          <meshStandardMaterial color="#4A2715" roughness={0.85} />
        </mesh>
      ))}
      {/* Pier Lantern Bollards (4 glowing bollards along the pier) */}
      {[
        [-1.25, z0 + 30.4],
        [1.25, z0 + 30.4],
        [-1.25, z0 + 33.4],
        [1.25, z0 + 33.4],
      ].map(([bx, bz], idx) => (
        <group key={idx} position={[bx, 0, bz]}>
          <mesh position={[0, 0.42, 0]} raycast={noopRaycast}>
            <cylinderGeometry args={[0.08, 0.09, 0.84, 8]} />
            <meshStandardMaterial color="#3E2012" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0.88, 0]} raycast={noopRaycast}>
            <sphereGeometry args={[0.1, 10, 8]} />
            <meshBasicMaterial color="#FDE68A" fog={false} />
          </mesh>
        </group>
      ))}

      {/* Classic Mahogany Runabout / Speedboat Moored Beside the Pier */}
      <group
        ref={pierBoatRef}
        position={[2.65, -1.18, z0 + 32.2]}
        rotation={[0, -0.18, 0]}
      >
        {/* Polished Mahogany Hull */}
        <mesh raycast={noopRaycast}>
          <boxGeometry args={[1.35, 0.42, 3.3]} />
          <meshBasicMaterial color="#7C2D12" fog={false} />
        </mesh>
        {/* Cream Leather Cockpit Deck */}
        <mesh position={[0, 0.22, -0.15]} raycast={noopRaycast}>
          <boxGeometry args={[1.08, 0.06, 1.85]} />
          <meshBasicMaterial color="#FDE68A" fog={false} />
        </mesh>
        {/* Raked Glass Windshield */}
        <mesh
          position={[0, 0.36, 0.55]}
          rotation={[-0.45, 0, 0]}
          raycast={noopRaycast}
        >
          <boxGeometry args={[1.06, 0.28, 0.03]} />
          <meshBasicMaterial color="#BAE6FD" transparent opacity={0.65} fog={false} />
        </mesh>
        {/* Warm Stern Anchor Light */}
        <mesh position={[0, 0.48, -1.45]} raycast={noopRaycast}>
          <sphereGeometry args={[0.07, 8, 8]} />
          <meshBasicMaterial color="#FDE047" fog={false} />
        </mesh>
      </group>

      {/* Glass & Cedar Perimeter Railings (South Lakefront split around Pier, plus West & East sides) */}
      {/* South-Left Railing: x in [-8.5, -1.45] */}
      <group position={[-4.975, 0.54, z0 + 29.72]}>
        <mesh position={[0, 0.48, 0]}>
          <boxGeometry args={[7.05, 0.075, 0.11]} />
          <meshStandardMaterial
            color="#9A532E"
            roughness={0.58}
            emissive="#4A2411"
            emissiveIntensity={0.22 * brightnessScale}
          />
        </mesh>
        <mesh position={[0, 0, 0]} raycast={noopRaycast}>
          <boxGeometry args={[6.95, 0.86, 0.025]} />
          <meshBasicMaterial color="#BAE6FD" transparent opacity={0.22} />
        </mesh>
      </group>
      {/* South-Right Railing: x in [+1.45, +8.5] */}
      <group position={[4.975, 0.54, z0 + 29.72]}>
        <mesh position={[0, 0.48, 0]}>
          <boxGeometry args={[7.05, 0.075, 0.11]} />
          <meshStandardMaterial
            color="#9A532E"
            roughness={0.58}
            emissive="#4A2411"
            emissiveIntensity={0.22 * brightnessScale}
          />
        </mesh>
        <mesh position={[0, 0, 0]} raycast={noopRaycast}>
          <boxGeometry args={[6.95, 0.86, 0.025]} />
          <meshBasicMaterial color="#BAE6FD" transparent opacity={0.22} />
        </mesh>
      </group>
      {/* West & East Side Railings */}
      {[-8.52, 8.52].map((rx) => (
        <group key={rx} position={[rx, 0.54, deckCenterZ]}>
          <mesh position={[0, 0.48, 0]}>
            <boxGeometry args={[0.11, 0.075, deckD]} />
            <meshStandardMaterial
              color="#9A532E"
              roughness={0.58}
              emissive="#4A2411"
              emissiveIntensity={0.22 * brightnessScale}
            />
          </mesh>
          <mesh position={[0, 0, 0]} raycast={noopRaycast}>
            <boxGeometry args={[0.025, 0.86, deckD - 0.2]} />
            <meshBasicMaterial color="#BAE6FD" transparent opacity={0.22} />
          </mesh>
        </group>
      ))}

      {/* 2 Brass Scenic Viewing Telescopes along the South Lakefront Railing */}
      <BrassScenicTelescope position={[-2.65, 0, z0 + 29.18]} rotationY={-0.18} />
      <BrassScenicTelescope position={[2.65, 0, z0 + 29.18]} rotationY={0.14} />

      {/* North Exterior Timber & Stone Lodge Facade Flanking the Hallway Double-Doors */}
      {[-5.1, 5.1].map((nx) => (
        <group key={nx} position={[nx, 1.9, z0 + 20.4]}>
          <mesh>
            <boxGeometry args={[6.9, 3.8, 0.18]} />
            <meshStandardMaterial
              color="#4A2C1D"
              roughness={0.78}
              emissive="#29160E"
              emissiveIntensity={0.26 * brightnessScale}
            />
          </mesh>
          {/* Warm Lodge Exterior Wall Lantern Sconces */}
          <mesh position={[nx > 0 ? -2.2 : 2.2, 0.35, 0.14]} raycast={noopRaycast}>
            <boxGeometry args={[0.16, 0.32, 0.1]} />
            <meshBasicMaterial color="#FDE68A" />
          </mesh>
        </group>
      ))}

      {/* Stone Planter Boxes with Mini Alpine Pines Flanking the Deck Entrance */}
      {[-2.4, 2.4].map((px) => (
        <group key={px} position={[px, 0, z0 + 20.95]}>
          <RoundedBox args={[0.92, 0.46, 0.62]} position={[0, 0.23, 0]} radius={0.03}>
            <meshStandardMaterial color="#475569" roughness={0.85} />
          </RoundedBox>
          <mesh position={[0, 0.72, 0]} raycast={noopRaycast}>
            <coneGeometry args={[0.36, 0.78, 7]} />
            <meshBasicMaterial color="#15803D" />
          </mesh>
          <mesh position={[0, 1.12, 0]} raycast={noopRaycast}>
            <coneGeometry args={[0.25, 0.56, 7]} />
            <meshBasicMaterial color="#22C55E" />
          </mesh>
        </group>
      ))}

      {/* =================================================================== */}
      {/* FULL TIMBER PERGOLA OVERHEAD BEAMS + 18 BISTRO STRING LIGHT BULBS   */}
      {/* =================================================================== */}
      {[
        [-8.3, z0 + 21.0],
        [8.3, z0 + 21.0],
        [-8.3, z0 + 25.2],
        [8.3, z0 + 25.2],
        [-8.3, z0 + 29.4],
        [8.3, z0 + 29.4],
      ].map(([px, pz], idx) => (
        <mesh key={idx} position={[px, 1.8, pz]}>
          <boxGeometry args={[0.2, 3.6, 0.2]} />
          <meshStandardMaterial
            color="#6E3B1E"
            roughness={0.72}
            emissive="#381C0C"
            emissiveIntensity={0.24 * brightnessScale}
          />
        </mesh>
      ))}
      {/* Transverse Pergola Timber Cross-Beams */}
      {[z0 + 21.0, z0 + 23.8, z0 + 26.6, z0 + 29.4].map((bz, idx) => (
        <mesh key={idx} position={[0, 3.55, bz]} raycast={noopRaycast}>
          <boxGeometry args={[16.8, 0.14, 0.16]} />
          <meshStandardMaterial
            color="#7C4322"
            roughness={0.7}
            emissive="#3B1D0D"
            emissiveIntensity={0.24 * brightnessScale}
          />
        </mesh>
      ))}
      {/* 18 Warm Glowing Edison String-Light Bulbs Across the Pergola */}
      {[z0 + 22.4, z0 + 25.2, z0 + 28.0].map((rowZ, rIdx) =>
        [-6.5, -3.9, -1.3, 1.3, 3.9, 6.5].map((bx, bIdx) => (
          <mesh
            key={`${rIdx}-${bIdx}`}
            position={[bx, 3.42, rowZ]}
            raycast={noopRaycast}
          >
            <sphereGeometry args={[0.072, 8, 8]} />
            <meshBasicMaterial color={sky.stringLightGlow} fog={false} />
          </mesh>
        )),
      )}

      {/* Single High-Output Physically-Based Deck Zone Light (Zero Shadow Maps) */}
      <pointLight
        position={[0, 3.35, z0 + 25.2]}
        color="#FDE68A"
        intensity={sky.ambientIntensity * brightnessScale}
        distance={30}
        decay={1.15}
        castShadow={false}
      />

      {/* =================================================================== */}
      {/* CIRCULAR STONE OUTDOOR FIREPIT ([-3.8, 0, z0 + 25.0])               */}
      {/* =================================================================== */}
      <group position={[-3.8, 0, z0 + 25.0]}>
        <mesh position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.92, 1.02, 0.48, 16]} />
          <meshStandardMaterial
            color="#64748B"
            roughness={0.85}
            emissive="#334155"
            emissiveIntensity={0.22 * brightnessScale}
          />
        </mesh>
        {/* Glowing Ember Bed */}
        <mesh position={[0, 0.47, 0]}>
          <cylinderGeometry args={[0.72, 0.72, 0.06, 16]} />
          <meshBasicMaterial color="#EA580C" />
        </mesh>
        {/* Warm Floor Glow Ring around the Firepit (Zero extra shader light cost!) */}
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noopRaycast}>
          <ringGeometry args={[0.98, 1.65, 24]} />
          <meshBasicMaterial color="#FB923C" transparent opacity={0.18} />
        </mesh>
        {/* Flickering 3D Outdoor Flames */}
        <group position={[0, 0.52, 0]} ref={fireFlameRef}>
          <mesh position={[0, 0.25, 0]} raycast={noopRaycast}>
            <coneGeometry args={[0.32, 0.58, 7]} />
            <meshBasicMaterial color="#F97316" fog={false} />
          </mesh>
          <mesh position={[0.12, 0.18, 0.08]} raycast={noopRaycast}>
            <coneGeometry args={[0.2, 0.42, 6]} />
            <meshBasicMaterial color="#FACC15" fog={false} />
          </mesh>
          <mesh position={[-0.12, 0.17, -0.06]} raycast={noopRaycast}>
            <coneGeometry args={[0.18, 0.38, 6]} />
            <meshBasicMaterial color="#FDE047" fog={false} />
          </mesh>
        </group>
      </group>

      {/* Cedar Side Table with Glowing Lantern Beside the Vista Lounge Chairs */}
      <group position={[3.3, 0, z0 + 26.85]}>
        <RoundedBox args={[0.46, 0.46, 0.46]} position={[0, 0.23, 0]} radius={0.025}>
          <meshStandardMaterial
            color="#8B4A28"
            roughness={0.65}
            emissive="#4A2411"
            emissiveIntensity={0.22 * brightnessScale}
          />
        </RoundedBox>
        <mesh position={[0, 0.56, 0]} raycast={noopRaycast}>
          <cylinderGeometry args={[0.08, 0.1, 0.2, 8]} />
          <meshBasicMaterial color="#FDE68A" fog={false} />
        </mesh>
      </group>

      {/* =================================================================== */}
      {/* INTERACTIVE SKY & TIME-OF-DAY VISTA PEDESTAL ([+2.35, 0, z0 + 21.6]) */}
      {/* =================================================================== */}
      <group position={[2.35, 0, z0 + 21.6]} rotation={[0, -0.35, 0]}>
        <mesh position={[0, 0.52, 0]}>
          <cylinderGeometry args={[0.12, 0.18, 1.04, 10]} />
          <meshStandardMaterial color="#334155" metalness={0.55} roughness={0.35} />
        </mesh>
        <group position={[0, 1.12, 0]} rotation={[-0.42, 0, 0]}>
          <RoundedBox args={[1.04, 0.46, 0.03]} radius={0.025} smoothness={2}>
            <meshStandardMaterial color="#0F172A" metalness={0.4} roughness={0.5} />
          </RoundedBox>
          <Text
            position={[0, 0.14, 0.02]}
            fontSize={0.044}
            color="#F8FAFC"
            anchorX="center"
            anchorY="middle"
          >
            🏔 ALPINE VISTA SKY MOOD
          </Text>
          {(
            ['golden-sunset', 'starlit-aurora', 'alpine-morning'] as OutdoorSkyPresetId[]
          ).map((presetId, idx) => {
            const spec = OUTDOOR_SKY_PRESETS[presetId]
            const active = wingState.outdoorSkyPreset === presetId
            return (
              <group
                key={presetId}
                position={[-0.32 + idx * 0.32, -0.05, 0.02]}
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdateWingState({ outdoorSkyPreset: presetId })
                }}
              >
                <RoundedBox args={[0.29, 0.17, 0.015]} radius={0.018} smoothness={2}>
                  <meshBasicMaterial color={active ? '#E5A93C' : '#1E293B'} />
                </RoundedBox>
                <Text
                  position={[0, 0, 0.012]}
                  fontSize={0.034}
                  color={active ? '#080A0D' : '#F8FAFC'}
                  anchorX="center"
                  anchorY="middle"
                >
                  {spec.shortLabel}
                </Text>
              </group>
            )
          })}
        </group>
      </group>

      {/* 6 Click-to-Sit Outdoor Adirondack & Firepit Chairs */}
      {deckSeats.map((seat) => (
        <CedarAdirondackChair
          key={seat.id}
          seat={seat}
          isLocalSeat={localSeatId === seat.id}
          occupant={seatOccupants.get(seat.id)}
          brightnessScale={brightnessScale}
          onSelectSeat={onSelectSeat}
        />
      ))}

      {/* Playable Deck Cornhole Pitch (2 Angled Boards + Synced Scoreboard Post) */}
      <DeckCornhole3D
        hallStartZ={z0}
        state={cornholeState}
        localDisplayName={localDisplayName}
        onRecordThrow={onRecordCornholeThrow}
        onReset={onResetCornhole}
        onSnapToStation={() => onSelectSeat('wing:deck-cornhole')}
      />

      {/* =================================================================== */}
      {/* PANORAMIC ALPINE LAKE, WATERFALL, CHALET, MOUNTAINS & SKY BACKDROP  */}
      {/* (`fog={false}` keeps distant peaks & sunset vivid in any room mood) */}
      {/* =================================================================== */}

      {/* Curved Scenic Sky Backdrop Shell around the Outdoor Horizon (centered on +Z) */}
      <mesh
        position={[0, 20, z0 + 52]}
        raycast={noopRaycast}
      >
        <cylinderGeometry args={[76, 76, 64, 32, 1, true, -Math.PI * 0.75, Math.PI * 1.5]} />
        <meshBasicMaterial color={sky.domeTopColor} side={THREE.BackSide} fog={false} />
      </mesh>
      {/* Mid-Sky & Warm Horizon Atmospheric Bands */}
      <mesh
        position={[0, 10.5, z0 + 52]}
        raycast={noopRaycast}
      >
        <cylinderGeometry args={[75.2, 75.2, 21, 32, 1, true, -Math.PI * 0.72, Math.PI * 1.44]} />
        <meshBasicMaterial
          color={sky.domeMidColor}
          side={THREE.BackSide}
          transparent
          opacity={0.84}
          fog={false}
        />
      </mesh>
      <mesh
        position={[0, 3.0, z0 + 52]}
        raycast={noopRaycast}
      >
        <cylinderGeometry args={[74.4, 74.4, 10.5, 32, 1, true, -Math.PI * 0.7, Math.PI * 1.4]} />
        <meshBasicMaterial
          color={sky.horizonGlowColor}
          side={THREE.BackSide}
          transparent
          opacity={0.9}
          fog={false}
        />
      </mesh>

      {/* Glowing Sun / Full Moon Orb + Multi-Ring Corona in the Alpine Pass */}
      <mesh position={[-7.8, 19.2, z0 + 68]} raycast={noopRaycast}>
        <circleGeometry args={[3.4, 28]} />
        <meshBasicMaterial color={sky.sunMoonColor} side={THREE.DoubleSide} fog={false} />
      </mesh>
      <mesh position={[-7.8, 19.2, z0 + 68.2]} raycast={noopRaycast}>
        <circleGeometry args={[5.8, 28]} />
        <meshBasicMaterial
          color={sky.horizonGlowColor}
          transparent
          opacity={0.38}
          side={THREE.DoubleSide}
          fog={false}
        />
      </mesh>
      <mesh position={[-7.8, 19.2, z0 + 68.4]} raycast={noopRaycast}>
        <circleGeometry args={[9.2, 28]} />
        <meshBasicMaterial
          color={sky.horizonGlowColor}
          transparent
          opacity={0.16}
          side={THREE.DoubleSide}
          fog={false}
        />
      </mesh>

      {/* Drifting Volumetric-Style Alpine Clouds across the Mountain Ridges */}
      <group ref={cloudGroupRef}>
        <AlpineCloudCluster position={[-24, 16.5, z0 + 64]} scale={1.1} color={sky.cloudColor} />
        <AlpineCloudCluster position={[2, 18.8, z0 + 66]} scale={1.25} color={sky.cloudColor} />
        <AlpineCloudCluster position={[22, 16.2, z0 + 63]} scale={1.15} color={sky.cloudColor} />
      </group>

      {/* Single-Draw-Call 80-Star Starfield + Dual-Ribbon Aurora Borealis */}
      {sky.showStars && (
        <points
          position={[0, 2, z0 - 14]}
          geometry={STARFIELD_GEOMETRY}
          raycast={noopRaycast}
        >
          <pointsMaterial color="#F8FAFC" size={0.65} sizeAttenuation fog={false} />
        </points>
      )}

      {sky.showAurora && (
        <group>
          <mesh
            ref={aurora1Ref}
            position={[0, 21.5, z0 + 64]}
            rotation={[0.18, Math.PI, 0]}
            raycast={noopRaycast}
          >
            <planeGeometry args={[64, 6.8]} />
            <meshBasicMaterial
              color="#34D399"
              transparent
              opacity={0.42}
              side={THREE.DoubleSide}
              fog={false}
            />
          </mesh>
          <mesh
            ref={aurora2Ref}
            position={[4, 24.0, z0 + 66]}
            rotation={[0.14, Math.PI - 0.08, 0]}
            raycast={noopRaycast}
          >
            <planeGeometry args={[58, 5.4]} />
            <meshBasicMaterial
              color="#A855F7"
              transparent
              opacity={0.32}
              side={THREE.DoubleSide}
              fog={false}
            />
          </mesh>
        </group>
      )}

      {/* =================================================================== */}
      {/* MULTI-LAYERED ALPINE LAKE SURFACE (Deep Sapphire -> Turquoise Cove) */}
      {/* =================================================================== */}
      <mesh
        position={[0, -1.35, z0 + 68]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={noopRaycast}
      >
        <planeGeometry args={[160, 88]} />
        <meshBasicMaterial color={sky.lakeDeepColor} fog={false} />
      </mesh>
      <mesh
        position={[0, -1.32, z0 + 52]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={noopRaycast}
      >
        <planeGeometry args={[118, 46]} />
        <meshBasicMaterial color={sky.lakeMidColor} transparent opacity={0.72} fog={false} />
      </mesh>
      {/* Crystal Turquoise Near-Shore Shallows */}
      <mesh
        position={[0, -1.29, z0 + 35.5]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={noopRaycast}
      >
        <planeGeometry args={[56, 13]} />
        <meshBasicMaterial color="#0EA5E9" transparent opacity={0.28} fog={false} />
      </mesh>

      {/* Animated Specular Lake Reflection Shimmer Bands */}
      <mesh
        ref={shimmer1Ref}
        position={[-2.5, -1.27, z0 + 41]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={noopRaycast}
      >
        <planeGeometry args={[6.4, 7.2]} />
        <meshBasicMaterial color={sky.lakeShimmerColor} transparent opacity={0.36} fog={false} />
      </mesh>
      <mesh
        ref={shimmer2Ref}
        position={[-4.2, -1.27, z0 + 54]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={noopRaycast}
      >
        <planeGeometry args={[9.2, 12.0]} />
        <meshBasicMaterial color={sky.lakeShimmerColor} transparent opacity={0.3} fog={false} />
      </mesh>
      <mesh
        ref={shimmer3Ref}
        position={[-5.8, -1.27, z0 + 68]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={noopRaycast}
      >
        <planeGeometry args={[13.5, 15.0]} />
        <meshBasicMaterial color={sky.lakeShimmerColor} transparent opacity={0.25} fog={false} />
      </mesh>

      {/* =================================================================== */}
      {/* CASCADING ALPINE WATERFALL ON THE WESTERN GRANITE CLIFF             */}
      {/* =================================================================== */}
      <group position={[-11.8, -1.3, z0 + 48]} rotation={[0, -0.28, 0]}>
        {/* Steep Granite Cliff Buttress */}
        <mesh position={[0, 5.8, 0]} raycast={noopRaycast}>
          <coneGeometry args={[6.2, 13.5, 6]} />
          <meshBasicMaterial color={sky.mountainNearColor} fog={false} />
        </mesh>
        {/* Upper Snow Melt Ledge */}
        <mesh position={[0.4, 10.8, -1.6]} raycast={noopRaycast}>
          <boxGeometry args={[3.2, 0.85, 2.0]} />
          <meshBasicMaterial color={sky.snowCapColor} fog={false} />
        </mesh>
        {/* Cascading White-Water & Glacial Cyan Stream Ribbons (facing -Z toward Deck) */}
        <mesh
          position={[0.4, 5.4, -3.1]}
          rotation={[-0.24, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[1.75, 10.6]} />
          <meshBasicMaterial color="#E0F2FE" side={THREE.DoubleSide} fog={false} />
        </mesh>
        <mesh
          position={[0.4, 5.4, -3.15]}
          rotation={[-0.24, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[0.98, 10.4]} />
          <meshBasicMaterial color="#38BDF8" side={THREE.DoubleSide} fog={false} />
        </mesh>
        {/* Animated Plunge-Pool Foam & Mist Ring at Lake Level */}
        <mesh
          ref={waterfallFoamRef}
          position={[0.4, 0.08, -4.5]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <ringGeometry args={[0.7, 2.8, 20]} />
          <meshBasicMaterial color="#F8FAFC" transparent opacity={0.68} fog={false} />
        </mesh>
      </group>

      {/* =================================================================== */}
      {/* DISTANT WARM-LIT ALPINE LAKESIDE CHALET ON EASTERN PENINSULA        */}
      {/* =================================================================== */}
      <group position={[12.8, -1.25, z0 + 46]} rotation={[0, 0.32, 0]}>
        {/* Wooded Peninsula Rock Base */}
        <mesh position={[0, 0.35, 0]} raycast={noopRaycast}>
          <cylinderGeometry args={[4.8, 6.0, 0.9, 8]} />
          <meshBasicMaterial color={sky.mountainNearColor} fog={false} />
        </mesh>
        {/* Timber A-Frame Chalet Cabin */}
        <mesh position={[0, 1.5, 0]} raycast={noopRaycast}>
          <boxGeometry args={[3.4, 1.7, 2.6]} />
          <meshBasicMaterial color="#5C2E16" fog={false} />
        </mesh>
        {/* Steep Alpine Gabled Roof */}
        <mesh position={[0, 2.95, 0]} rotation={[0, Math.PI / 4, 0]} raycast={noopRaycast}>
          <coneGeometry args={[2.8, 1.9, 4]} />
          <meshBasicMaterial color="#1E293B" fog={false} />
        </mesh>
        {/* Warm Glowing Golden Chalet Windows Facing the Observation Deck (-Z) */}
        {[-0.9, 0, 0.9].map((wx, i) => (
          <mesh key={i} position={[wx, 1.55, -1.33]} raycast={noopRaycast}>
            <planeGeometry args={[0.56, 0.68]} />
            <meshBasicMaterial color="#FDE047" side={THREE.DoubleSide} fog={false} />
          </mesh>
        ))}
        {/* Golden Window Reflection on the Water in front of the Chalet */}
        <mesh
          position={[0, 0.03, -4.4]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[2.6, 3.4]} />
          <meshBasicMaterial color="#FBBF24" transparent opacity={0.38} fog={false} />
        </mesh>
        <PineTreeCluster position={[-3.1, 0.5, 0.8]} scale={0.95} color={sky.pineColor} />
        <PineTreeCluster position={[3.0, 0.5, 0.4]} scale={1.1} color={sky.pineColor} />
      </group>

      {/* 2 Gently Bobbing Wooden Sailboats on the Alpine Lake */}
      <group ref={boat1Ref} position={[-6.8, -1.24, z0 + 44.5]} rotation={[0, 0.42, 0]}>
        <mesh raycast={noopRaycast}>
          <boxGeometry args={[1.15, 0.36, 2.9]} />
          <meshBasicMaterial color="#7C2D12" fog={false} />
        </mesh>
        <mesh position={[0, 1.45, 0]} raycast={noopRaycast}>
          <cylinderGeometry args={[0.04, 0.05, 2.8, 6]} />
          <meshBasicMaterial color="#E2E8F0" fog={false} />
        </mesh>
        <mesh position={[0, 1.55, 0.25]} rotation={[0, Math.PI / 2, 0]} raycast={noopRaycast}>
          <coneGeometry args={[0.92, 2.25, 3]} />
          <meshBasicMaterial color="#F8FAFC" side={THREE.DoubleSide} fog={false} />
        </mesh>
      </group>

      <group ref={boat2Ref} position={[8.4, -1.24, z0 + 61.5]} rotation={[0, -0.65, 0]} scale={0.82}>
        <mesh raycast={noopRaycast}>
          <boxGeometry args={[1.15, 0.36, 2.9]} />
          <meshBasicMaterial color="#5C2E18" fog={false} />
        </mesh>
        <mesh position={[0, 1.45, 0]} raycast={noopRaycast}>
          <cylinderGeometry args={[0.04, 0.05, 2.8, 6]} />
          <meshBasicMaterial color="#E2E8F0" fog={false} />
        </mesh>
        <mesh position={[0, 1.55, 0.25]} rotation={[0, Math.PI / 2, 0]} raycast={noopRaycast}>
          <coneGeometry args={[0.92, 2.25, 3]} />
          <meshBasicMaterial color="#FEF3C7" side={THREE.DoubleSide} fog={false} />
        </mesh>
      </group>

      {/* Gliding 3-Bird Alpine Flock Circling High Above the Lake */}
      <group ref={birdFlockRef} position={[0, 11.5, z0 + 52]}>
        {[
          [0, 0, 0],
          [-0.9, 0.15, -0.7],
          [0.9, 0.12, -0.75],
        ].map(([bx, by, bz], idx) => (
          <group key={idx} position={[bx, by, bz]}>
            <mesh position={[-0.22, 0, 0]} rotation={[0, 0, 0.28]} raycast={noopRaycast}>
              <boxGeometry args={[0.46, 0.03, 0.12]} />
              <meshBasicMaterial color="#F8FAFC" fog={false} />
            </mesh>
            <mesh position={[0.22, 0, 0]} rotation={[0, 0, -0.28]} raycast={noopRaycast}>
              <boxGeometry args={[0.46, 0.03, 0.12]} />
              <meshBasicMaterial color="#F8FAFC" fog={false} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Rocky Mid-Lake Pine Island */}
      <group position={[-1.8, -1.35, z0 + 54]}>
        <mesh position={[0, 0.38, 0]} raycast={noopRaycast}>
          <cylinderGeometry args={[3.2, 4.5, 0.9, 8]} />
          <meshBasicMaterial color={sky.mountainNearColor} fog={false} />
        </mesh>
        <PineTreeCluster
          position={[-1.0, 0.65, -0.3]}
          scale={0.85}
          color={sky.pineColor}
          snowTint={sky.snowCapColor}
        />
        <PineTreeCluster
          position={[0.85, 0.65, 0.4]}
          scale={1.05}
          color={sky.pineColor}
        />
      </group>

      {/* Shoreline Granite Boulders & Evergreen Coves Framing the Deck */}
      {[
        [-9.8, -1.1, z0 + 31.2, 1.1],
        [-11.4, -1.0, z0 + 32.5, 1.4],
        [9.8, -1.1, z0 + 31.2, 1.15],
        [11.6, -1.0, z0 + 32.8, 1.35],
      ].map(([rx, ry, rz, rs], idx) => (
        <mesh key={idx} position={[rx, ry, rz]} scale={rs} raycast={noopRaycast}>
          <dodecahedronGeometry args={[0.75, 0]} />
          <meshBasicMaterial color={sky.mountainNearColor} fog={false} />
        </mesh>
      ))}

      <PineTreeCluster position={[-13.5, -1.2, z0 + 33]} scale={1.15} color={sky.pineColor} />
      <PineTreeCluster
        position={[-17.5, -1.2, z0 + 38]}
        scale={1.35}
        color={sky.pineColor}
        snowTint={sky.snowCapColor}
      />
      <PineTreeCluster position={[-21.5, -1.2, z0 + 45]} scale={1.55} color={sky.pineColor} />
      <PineTreeCluster position={[-25.5, -1.2, z0 + 52]} scale={1.65} color={sky.pineColor} />
      <PineTreeCluster position={[13.5, -1.2, z0 + 33]} scale={1.15} color={sky.pineColor} />
      <PineTreeCluster
        position={[17.8, -1.2, z0 + 39]}
        scale={1.4}
        color={sky.pineColor}
        snowTint={sky.snowCapColor}
      />
      <PineTreeCluster position={[22.4, -1.2, z0 + 46]} scale={1.55} color={sky.pineColor} />
      <PineTreeCluster position={[26.5, -1.2, z0 + 53]} scale={1.7} color={sky.pineColor} />

      {/* =================================================================== */}
      {/* 14 MULTI-FACETED SNOW-CAPPED 3D ALPINE PEAKS ACROSS THE HORIZON     */}
      {/* =================================================================== */}
      {/* Distant Towering Glacial Summits */}
      <SnowCappedMountain
        position={[-46, -1.5, z0 + 84]}
        radius={20}
        height={28}
        rockColor={sky.mountainFarColor}
        sunlitColor={sky.mountainSunlitColor}
        snowColor={sky.snowCapColor}
      />
      <SnowCappedMountain
        position={[-24, -1.5, z0 + 90]}
        radius={23}
        height={34}
        rockColor={sky.mountainFarColor}
        sunlitColor={sky.mountainSunlitColor}
        snowColor={sky.snowCapColor}
      />
      <SnowCappedMountain
        position={[-2, -1.5, z0 + 94]}
        radius={26}
        height={39}
        rockColor={sky.mountainNearColor}
        sunlitColor={sky.mountainSunlitColor}
        snowColor={sky.snowCapColor}
      />
      <SnowCappedMountain
        position={[20, -1.5, z0 + 90]}
        radius={24}
        height={35}
        rockColor={sky.mountainFarColor}
        sunlitColor={sky.mountainSunlitColor}
        snowColor={sky.snowCapColor}
      />
      <SnowCappedMountain
        position={[42, -1.5, z0 + 82]}
        radius={21}
        height={29}
        rockColor={sky.mountainNearColor}
        sunlitColor={sky.mountainSunlitColor}
        snowColor={sky.snowCapColor}
      />
      {/* Mid-Range Jagged Alpine Peaks */}
      <SnowCappedMountain
        position={[-34, -1.5, z0 + 72]}
        radius={16}
        height={22}
        rockColor={sky.mountainNearColor}
        sunlitColor={sky.mountainSunlitColor}
        snowColor={sky.snowCapColor}
        withShoulder={false}
      />
      <SnowCappedMountain
        position={[-12, -1.5, z0 + 78]}
        radius={17}
        height={25}
        rockColor={sky.mountainNearColor}
        sunlitColor={sky.mountainSunlitColor}
        snowColor={sky.snowCapColor}
        withShoulder={false}
      />
      <SnowCappedMountain
        position={[10, -1.5, z0 + 79]}
        radius={16}
        height={24}
        rockColor={sky.mountainNearColor}
        sunlitColor={sky.mountainSunlitColor}
        snowColor={sky.snowCapColor}
        withShoulder={false}
      />
      <SnowCappedMountain
        position={[32, -1.5, z0 + 71]}
        radius={16}
        height={21}
        rockColor={sky.mountainNearColor}
        sunlitColor={sky.mountainSunlitColor}
        snowColor={sky.snowCapColor}
        withShoulder={false}
      />
      {/* Closer Flanking Foothill Ridges Framing the Lake */}
      <SnowCappedMountain
        position={[-29, -1.5, z0 + 58]}
        radius={12}
        height={15}
        rockColor={sky.mountainNearColor}
        sunlitColor={sky.mountainSunlitColor}
        snowColor={sky.snowCapColor}
        withShoulder={false}
      />
      <SnowCappedMountain
        position={[29, -1.5, z0 + 59]}
        radius={13}
        height={16}
        rockColor={sky.mountainNearColor}
        sunlitColor={sky.mountainSunlitColor}
        snowColor={sky.snowCapColor}
        withShoulder={false}
      />
    </group>
  )
}
