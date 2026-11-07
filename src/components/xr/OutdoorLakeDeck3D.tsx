import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  OUTDOOR_SKY_PRESETS,
  type ExpansionWingLayout,
} from '../../constants/expansionRooms'
import type {
  ComputedSeat,
  ExpansionWingSyncedState,
  OutdoorSkyPresetId,
  ParticipantProfile,
} from '../../types/lounge'

interface DeckChairProps {
  seat: ComputedSeat
  isLocalSeat: boolean
  occupant?: ParticipantProfile
  onSelectSeat: (seatId: string) => void
}

function CedarAdirondackChair({
  seat,
  isLocalSeat,
  occupant,
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
      {/* Cedar Timber Frame + Plush Weatherproof Cushion */}
      <RoundedBox args={[0.68, 0.1, 0.64]} position={[0, 0.36, 0]} radius={0.025} smoothness={2}>
        <meshStandardMaterial
          color={hovered && !takenByOther ? '#9A522B' : '#7C3F21'}
          roughness={0.72}
        />
      </RoundedBox>
      <RoundedBox args={[0.58, 0.08, 0.54]} position={[0, 0.43, -0.02]} radius={0.03} smoothness={2}>
        <meshStandardMaterial color="#E7E0D3" roughness={0.85} />
      </RoundedBox>
      {/* Slanted Adirondack Backrest */}
      <RoundedBox
        args={[0.62, 0.72, 0.08]}
        position={[0, 0.74, 0.27]}
        rotation={[0.24, 0, 0]}
        radius={0.025}
        smoothness={2}
      >
        <meshStandardMaterial color="#7C3F21" roughness={0.72} />
      </RoundedBox>
      {/* Wide Cedar Armrests & Legs */}
      {[-0.34, 0.34].map((lx) => (
        <group key={lx}>
          <RoundedBox args={[0.11, 0.04, 0.66]} position={[lx, 0.56, 0.02]} radius={0.015}>
            <meshStandardMaterial color="#8A4826" roughness={0.68} />
          </RoundedBox>
          <mesh position={[lx, 0.26, -0.22]}>
            <boxGeometry args={[0.07, 0.52, 0.08]} />
            <meshStandardMaterial color="#5C2D16" roughness={0.8} />
          </mesh>
          <mesh position={[lx, 0.2, 0.24]}>
            <boxGeometry args={[0.07, 0.4, 0.08]} />
            <meshStandardMaterial color="#5C2D16" roughness={0.8} />
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

function PineTreeCluster({
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
      <mesh position={[0, 0.8, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.18, 0.26, 1.6, 6]} />
        <meshBasicMaterial color="#2A1B12" fog={false} />
      </mesh>
      <mesh position={[0, 2.4, 0]} raycast={() => null}>
        <coneGeometry args={[1.45, 2.8, 7]} />
        <meshBasicMaterial color={color} fog={false} />
      </mesh>
      <mesh position={[0, 3.8, 0]} raycast={() => null}>
        <coneGeometry args={[1.1, 2.4, 7]} />
        <meshBasicMaterial color={color} fog={false} />
      </mesh>
      <mesh position={[0, 5.0, 0]} raycast={() => null}>
        <coneGeometry args={[0.72, 1.8, 7]} />
        <meshBasicMaterial color={color} fog={false} />
      </mesh>
    </group>
  )
}

function SnowCappedMountain({
  position,
  radius,
  height,
  rockColor,
  snowColor,
}: {
  position: [number, number, number]
  radius: number
  height: number
  rockColor: string
  snowColor: string
}) {
  return (
    <group position={position}>
      {/* Main Faceted Alpine Peak */}
      <mesh position={[0, height / 2, 0]} raycast={() => null}>
        <coneGeometry args={[radius, height, 7]} />
        <meshBasicMaterial color={rockColor} fog={false} />
      </mesh>
      {/* Snow Crown */}
      <mesh position={[0, height * 0.81, 0]} raycast={() => null}>
        <coneGeometry args={[radius * 0.39, height * 0.39, 7]} />
        <meshBasicMaterial color={snowColor} fog={false} />
      </mesh>
    </group>
  )
}

export interface OutdoorLakeDeck3DProps {
  wingLayout: ExpansionWingLayout
  wingState: ExpansionWingSyncedState
  computedSeats: ComputedSeat[]
  localSeatId?: string
  participants: ParticipantProfile[]
  onSelectSeat: (seatId: string) => void
  onTeleportToFloor?: (point: [number, number, number]) => void
  onUpdateWingState: (patch: Partial<ExpansionWingSyncedState>) => void
}

const STAR_COORDS: ReadonlyArray<[number, number, number, number]> = [
  [-36, 26, 74, 0.24],
  [-24, 31, 78, 0.18],
  [-12, 28, 82, 0.26],
  [0, 34, 84, 0.22],
  [14, 29, 80, 0.25],
  [27, 32, 76, 0.2],
  [39, 25, 72, 0.24],
  [-31, 19, 75, 0.18],
  [-18, 22, 81, 0.22],
  [-5, 24, 83, 0.2],
  [9, 21, 82, 0.24],
  [22, 23, 79, 0.19],
  [34, 18, 74, 0.21],
  [-44, 22, 66, 0.2],
  [45, 21, 66, 0.22],
]

export function OutdoorLakeDeck3D({
  wingLayout,
  wingState,
  computedSeats,
  localSeatId,
  participants,
  onSelectSeat,
  onTeleportToFloor,
  onUpdateWingState,
}: OutdoorLakeDeck3DProps) {
  const z0 = wingLayout.hallStartZ
  const sky = OUTDOOR_SKY_PRESETS[wingState.outdoorSkyPreset] ?? OUTDOOR_SKY_PRESETS['golden-sunset']

  const shimmer1Ref = useRef<THREE.Mesh>(null)
  const shimmer2Ref = useRef<THREE.Mesh>(null)
  const shimmer3Ref = useRef<THREE.Mesh>(null)
  const boatRef = useRef<THREE.Group>(null)
  const fireFlameRef = useRef<THREE.Group>(null)
  const auroraRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (shimmer1Ref.current) {
      shimmer1Ref.current.scale.x = 1 + Math.sin(t * 1.4) * 0.12
      shimmer1Ref.current.position.x = Math.sin(t * 0.7) * 0.45
    }
    if (shimmer2Ref.current) {
      shimmer2Ref.current.scale.x = 1 + Math.cos(t * 1.15 + 1.2) * 0.15
      shimmer2Ref.current.position.x = Math.cos(t * 0.55) * 0.65
    }
    if (shimmer3Ref.current) {
      shimmer3Ref.current.scale.x = 1 + Math.sin(t * 0.95 + 2.1) * 0.18
    }
    if (boatRef.current) {
      boatRef.current.position.y = -1.24 + Math.sin(t * 1.3) * 0.045
      boatRef.current.rotation.z = Math.sin(t * 1.1) * 0.035
    }
    if (fireFlameRef.current) {
      fireFlameRef.current.scale.y = 0.92 + Math.sin(t * 9.5) * 0.14 + Math.cos(t * 14.2) * 0.06
      fireFlameRef.current.rotation.y = t * 0.8
    }
    if (auroraRef.current && sky.showAurora) {
      auroraRef.current.position.y = 22.5 + Math.sin(t * 0.55) * 0.8
      auroraRef.current.rotation.z = Math.sin(t * 0.35) * 0.04
    }
  })

  const deckSeats = useMemo(
    () => computedSeats.filter((s) => s.roomWing === 'outdoor-deck'),
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
    <group name="wing-outdoor-lake-deck">
      {/* =================================================================== */}
      {/* REDWOOD OBSERVATION DECK + WALKABLE WOODEN LAKESHORE PIER           */}
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
        <meshStandardMaterial color="#5E341E" roughness={0.78} metalness={0.08} />
      </mesh>

      {/* Deck Plank Grooves */}
      {[-6, -3, 0, 3, 6].map((px) => (
        <mesh
          key={px}
          position={[px, 0.013, deckCenterZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[0.03, deckD - 0.2]} />
          <meshBasicMaterial color="#3B1E10" />
        </mesh>
      ))}

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
        <meshStandardMaterial color="#6B3B22" roughness={0.76} />
      </mesh>
      {/* Pier Timber Pilings into the Lake */}
      {[
        [-1.15, z0 + 31.2],
        [1.15, z0 + 31.2],
        [-1.15, z0 + 33.3],
        [1.15, z0 + 33.3],
      ].map(([px, pz], idx) => (
        <mesh key={idx} position={[px, -0.75, pz]} raycast={() => null}>
          <cylinderGeometry args={[0.11, 0.11, 1.5, 8]} />
          <meshStandardMaterial color="#3A2012" roughness={0.9} />
        </mesh>
      ))}
      {/* Pier Lantern Bollards */}
      {[
        [-1.25, z0 + 33.4],
        [1.25, z0 + 33.4],
      ].map(([bx, bz], idx) => (
        <group key={idx} position={[bx, 0, bz]}>
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.08, 0.09, 0.84, 8]} />
            <meshStandardMaterial color="#271811" roughness={0.7} />
          </mesh>
          <mesh position={[0, 0.88, 0]}>
            <sphereGeometry args={[0.09, 10, 8]} />
            <meshBasicMaterial color="#FDE68A" />
          </mesh>
        </group>
      ))}

      {/* Glass & Cedar Perimeter Railings (South Lakefront split around Pier, plus West & East sides) */}
      {/* South-Left Railing: x in [-8.5, -1.45] */}
      <group position={[-4.975, 0.54, z0 + 29.72]}>
        <mesh position={[0, 0.48, 0]}>
          <boxGeometry args={[7.05, 0.07, 0.1]} />
          <meshStandardMaterial color="#6E3D23" roughness={0.65} />
        </mesh>
        <mesh position={[0, 0, 0]} raycast={() => null}>
          <boxGeometry args={[6.95, 0.86, 0.025]} />
          <meshBasicMaterial color="#BAE6FD" transparent opacity={0.18} />
        </mesh>
      </group>
      {/* South-Right Railing: x in [+1.45, +8.5] */}
      <group position={[4.975, 0.54, z0 + 29.72]}>
        <mesh position={[0, 0.48, 0]}>
          <boxGeometry args={[7.05, 0.07, 0.1]} />
          <meshStandardMaterial color="#6E3D23" roughness={0.65} />
        </mesh>
        <mesh position={[0, 0, 0]} raycast={() => null}>
          <boxGeometry args={[6.95, 0.86, 0.025]} />
          <meshBasicMaterial color="#BAE6FD" transparent opacity={0.18} />
        </mesh>
      </group>
      {/* West & East Side Railings */}
      {[-8.52, 8.52].map((rx) => (
        <group key={rx} position={[rx, 0.54, deckCenterZ]}>
          <mesh position={[0, 0.48, 0]}>
            <boxGeometry args={[0.1, 0.07, deckD]} />
            <meshStandardMaterial color="#6E3D23" roughness={0.65} />
          </mesh>
          <mesh position={[0, 0, 0]} raycast={() => null}>
            <boxGeometry args={[0.025, 0.86, deckD - 0.2]} />
            <meshBasicMaterial color="#BAE6FD" transparent opacity={0.18} />
          </mesh>
        </group>
      ))}

      {/* North Exterior Lodge Facade Flanking the Hallway Double-Doors */}
      {[-5.1, 5.1].map((nx) => (
        <mesh key={nx} position={[nx, 1.9, z0 + 20.4]}>
          <boxGeometry args={[6.9, 3.8, 0.18]} />
          <meshStandardMaterial color="#241914" roughness={0.85} />
        </mesh>
      ))}

      {/* Overhead Cedar Pergola Posts & Warm Bistro String Lights */}
      {[
        [-8.3, z0 + 21.0],
        [8.3, z0 + 21.0],
        [-8.3, z0 + 29.4],
        [8.3, z0 + 29.4],
      ].map(([px, pz], idx) => (
        <mesh key={idx} position={[px, 1.75, pz]}>
          <boxGeometry args={[0.18, 3.5, 0.18]} />
          <meshStandardMaterial color="#4A2716" roughness={0.8} />
        </mesh>
      ))}
      {[-6, -3, 0, 3, 6].map((bx, idx) => (
        <mesh key={idx} position={[bx, 3.35, z0 + 24.8]} raycast={() => null}>
          <sphereGeometry args={[0.065, 8, 8]} />
          <meshBasicMaterial color={sky.stringLightGlow} fog={false} />
        </mesh>
      ))}

      {/* Deck Local Warm Illumination */}
      <pointLight
        position={[0, 3.2, z0 + 24.8]}
        color="#FDE68A"
        intensity={sky.ambientIntensity}
        distance={20}
        decay={1.5}
      />

      {/* =================================================================== */}
      {/* CIRCULAR STONE OUTDOOR FIREPIT ([-3.8, 0, z0 + 25.0])               */}
      {/* =================================================================== */}
      <group position={[-3.8, 0, z0 + 25.0]}>
        <mesh position={[0, 0.24, 0]}>
          <cylinderGeometry args={[0.88, 0.96, 0.48, 16]} />
          <meshStandardMaterial color="#475569" roughness={0.92} />
        </mesh>
        <mesh position={[0, 0.47, 0]}>
          <cylinderGeometry args={[0.68, 0.68, 0.06, 16]} />
          <meshBasicMaterial color="#29150C" />
        </mesh>
        {/* Flickering 3D Outdoor Flames */}
        <group position={[0, 0.52, 0]} ref={fireFlameRef}>
          <mesh position={[0, 0.22, 0]} raycast={() => null}>
            <coneGeometry args={[0.28, 0.52, 7]} />
            <meshBasicMaterial color="#F97316" fog={false} />
          </mesh>
          <mesh position={[0.1, 0.16, 0.08]} raycast={() => null}>
            <coneGeometry args={[0.18, 0.38, 6]} />
            <meshBasicMaterial color="#FACC15" fog={false} />
          </mesh>
          <mesh position={[-0.12, 0.15, -0.06]} raycast={() => null}>
            <coneGeometry args={[0.16, 0.34, 6]} />
            <meshBasicMaterial color="#FB923C" fog={false} />
          </mesh>
        </group>
        <pointLight position={[0, 0.95, 0]} color="#FB923C" intensity={0.95} distance={8} decay={1.8} />
      </group>

      {/* =================================================================== */}
      {/* INTERACTIVE SKY & TIME-OF-DAY VISTA PEDESTAL ([+2.35, 0, z0 + 21.6]) */}
      {/* =================================================================== */}
      <group position={[2.35, 0, z0 + 21.6]} rotation={[0, -0.35, 0]}>
        <mesh position={[0, 0.52, 0]}>
          <cylinderGeometry args={[0.12, 0.18, 1.04, 10]} />
          <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.4} />
        </mesh>
        <group position={[0, 1.12, 0]} rotation={[-0.42, 0, 0]}>
          <RoundedBox args={[0.98, 0.42, 0.03]} radius={0.025} smoothness={2}>
            <meshStandardMaterial color="#0F172A" metalness={0.4} roughness={0.5} />
          </RoundedBox>
          <Text
            position={[0, 0.13, 0.02]}
            fontSize={0.042}
            color="#E2E8F0"
            anchorX="center"
            anchorY="middle"
          >
            ALPINE VISTA SKY MOOD
          </Text>
          {(
            ['golden-sunset', 'starlit-aurora', 'alpine-morning'] as OutdoorSkyPresetId[]
          ).map((presetId, idx) => {
            const spec = OUTDOOR_SKY_PRESETS[presetId]
            const active = wingState.outdoorSkyPreset === presetId
            return (
              <group
                key={presetId}
                position={[-0.31 + idx * 0.31, -0.05, 0.02]}
                onClick={(e) => {
                  e.stopPropagation()
                  onUpdateWingState({ outdoorSkyPreset: presetId })
                }}
              >
                <RoundedBox args={[0.28, 0.16, 0.015]} radius={0.018} smoothness={2}>
                  <meshBasicMaterial color={active ? '#E5A93C' : '#1E293B'} />
                </RoundedBox>
                <Text
                  position={[0, 0, 0.012]}
                  fontSize={0.033}
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
          onSelectSeat={onSelectSeat}
        />
      ))}

      {/* =================================================================== */}
      {/* PANORAMIC ALPINE LAKE, PINE COVES, MOUNTAINS & SKY BACKDROP         */}
      {/* (`fog={false}` keeps distant peaks & sunset vivid in any room mood) */}
      {/* =================================================================== */}

      {/* Curved Scenic Sky Backdrop Shell around the Outdoor Horizon */}
      <mesh
        position={[0, 18, z0 + 54]}
        rotation={[0, Math.PI / 2, 0]}
        raycast={() => null}
      >
        <cylinderGeometry args={[68, 68, 56, 28, 1, true, -Math.PI * 0.62, Math.PI * 1.24]} />
        <meshBasicMaterial color={sky.domeTopColor} side={THREE.BackSide} fog={false} />
      </mesh>
      {/* Mid-Sky & Warm Horizon Atmospheric Bands */}
      <mesh
        position={[0, 9.5, z0 + 54]}
        rotation={[0, Math.PI / 2, 0]}
        raycast={() => null}
      >
        <cylinderGeometry args={[67.4, 67.4, 18, 28, 1, true, -Math.PI * 0.6, Math.PI * 1.2]} />
        <meshBasicMaterial
          color={sky.domeMidColor}
          side={THREE.BackSide}
          transparent
          opacity={0.78}
          fog={false}
        />
      </mesh>
      <mesh
        position={[0, 2.4, z0 + 54]}
        rotation={[0, Math.PI / 2, 0]}
        raycast={() => null}
      >
        <cylinderGeometry args={[66.8, 66.8, 8.5, 28, 1, true, -Math.PI * 0.58, Math.PI * 1.16]} />
        <meshBasicMaterial
          color={sky.horizonGlowColor}
          side={THREE.BackSide}
          transparent
          opacity={0.85}
          fog={false}
        />
      </mesh>

      {/* Glowing Sun / Full Moon Orb above the Mountain Pass */}
      <mesh position={[4.5, 13.5, z0 + 96]} raycast={() => null}>
        <circleGeometry args={[4.4, 28]} />
        <meshBasicMaterial color={sky.sunMoonColor} side={THREE.DoubleSide} fog={false} />
      </mesh>
      <mesh position={[4.5, 13.5, z0 + 95.8]} raycast={() => null}>
        <circleGeometry args={[7.2, 28]} />
        <meshBasicMaterial
          color={sky.horizonGlowColor}
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          fog={false}
        />
      </mesh>

      {/* Starlit Sky + Shimmering Northern Lights Ribbon (Aurora Night Preset) */}
      {sky.showStars &&
        STAR_COORDS.map(([sx, sy, sdz, sr], idx) => (
          <mesh key={idx} position={[sx, sy, z0 + sdz]} raycast={() => null}>
            <circleGeometry args={[sr, 6]} />
            <meshBasicMaterial color="#F8FAFC" side={THREE.DoubleSide} fog={false} />
          </mesh>
        ))}

      {sky.showAurora && (
        <mesh
          ref={auroraRef}
          position={[0, 22.5, z0 + 86]}
          rotation={[0.18, Math.PI, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[64, 6.5]} />
          <meshBasicMaterial
            color="#34D399"
            transparent
            opacity={0.32}
            side={THREE.DoubleSide}
            fog={false}
          />
        </mesh>
      )}

      {/* Expansive Alpine Lake Water Surface */}
      <mesh
        position={[0, -1.35, z0 + 68]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[150, 84]} />
        <meshBasicMaterial color={sky.lakeDeepColor} fog={false} />
      </mesh>
      <mesh
        position={[0, -1.32, z0 + 52]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[110, 44]} />
        <meshBasicMaterial color={sky.lakeMidColor} transparent opacity={0.68} fog={false} />
      </mesh>

      {/* Animated Specular Lake Reflection Shimmer Bands */}
      <mesh
        ref={shimmer1Ref}
        position={[1.5, -1.28, z0 + 42]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[5.8, 6.5]} />
        <meshBasicMaterial color={sky.lakeShimmerColor} transparent opacity={0.32} fog={false} />
      </mesh>
      <mesh
        ref={shimmer2Ref}
        position={[2.6, -1.28, z0 + 56]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[8.5, 11.0]} />
        <meshBasicMaterial color={sky.lakeShimmerColor} transparent opacity={0.26} fog={false} />
      </mesh>
      <mesh
        ref={shimmer3Ref}
        position={[3.6, -1.28, z0 + 72]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[12.5, 14.0]} />
        <meshBasicMaterial color={sky.lakeShimmerColor} transparent opacity={0.22} fog={false} />
      </mesh>

      {/* Gently Bobbing Wooden Sailboat on the Alpine Lake */}
      <group ref={boatRef} position={[-6.8, -1.24, z0 + 44.5]} rotation={[0, 0.42, 0]}>
        <mesh raycast={() => null}>
          <boxGeometry args={[1.1, 0.34, 2.8]} />
          <meshBasicMaterial color="#5C2E18" fog={false} />
        </mesh>
        <mesh position={[0, 1.35, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.04, 0.05, 2.6, 6]} />
          <meshBasicMaterial color="#D6D3D1" fog={false} />
        </mesh>
        <mesh position={[0, 1.45, 0.25]} rotation={[0, Math.PI / 2, 0]} raycast={() => null}>
          <coneGeometry args={[0.85, 2.1, 3]} />
          <meshBasicMaterial color="#F8FAFC" side={THREE.DoubleSide} fog={false} />
        </mesh>
      </group>

      {/* Rocky Mid-Lake Pine Island */}
      <group position={[12.5, -1.35, z0 + 51]}>
        <mesh position={[0, 0.35, 0]} raycast={() => null}>
          <cylinderGeometry args={[3.4, 4.6, 0.85, 8]} />
          <meshBasicMaterial color={sky.mountainNearColor} fog={false} />
        </mesh>
        <PineTreeCluster position={[-1.1, 0.6, -0.4]} scale={0.85} color={sky.pineColor} />
        <PineTreeCluster position={[0.9, 0.6, 0.5]} scale={1.05} color={sky.pineColor} />
      </group>

      {/* West & East Evergreen Shoreline Coves */}
      <PineTreeCluster position={[-14.5, -1.2, z0 + 34]} scale={1.15} color={sky.pineColor} />
      <PineTreeCluster position={[-18.2, -1.2, z0 + 39]} scale={1.35} color={sky.pineColor} />
      <PineTreeCluster position={[-22.0, -1.2, z0 + 46]} scale={1.5} color={sky.pineColor} />
      <PineTreeCluster position={[14.5, -1.2, z0 + 34]} scale={1.15} color={sky.pineColor} />
      <PineTreeCluster position={[18.5, -1.2, z0 + 40]} scale={1.4} color={sky.pineColor} />
      <PineTreeCluster position={[22.8, -1.2, z0 + 47]} scale={1.55} color={sky.pineColor} />

      {/* Layered Snow-Capped 3D Alpine Mountain Range across the Horizon */}
      <SnowCappedMountain
        position={[-38, -1.5, z0 + 78]}
        radius={18}
        height={24}
        rockColor={sky.mountainNearColor}
        snowColor={sky.snowCapColor}
      />
      <SnowCappedMountain
        position={[-19, -1.5, z0 + 86]}
        radius={21}
        height={30}
        rockColor={sky.mountainFarColor}
        snowColor={sky.snowCapColor}
      />
      <SnowCappedMountain
        position={[-2, -1.5, z0 + 92]}
        radius={24}
        height={35}
        rockColor={sky.mountainNearColor}
        snowColor={sky.snowCapColor}
      />
      <SnowCappedMountain
        position={[17, -1.5, z0 + 88]}
        radius={22}
        height={31}
        rockColor={sky.mountainFarColor}
        snowColor={sky.snowCapColor}
      />
      <SnowCappedMountain
        position={[36, -1.5, z0 + 79]}
        radius={19}
        height={25}
        rockColor={sky.mountainNearColor}
        snowColor={sky.snowCapColor}
      />
      {/* Closer Flanking Foothill Ridges */}
      <SnowCappedMountain
        position={[-30, -1.5, z0 + 62]}
        radius={13}
        height={15}
        rockColor={sky.mountainNearColor}
        snowColor={sky.snowCapColor}
      />
      <SnowCappedMountain
        position={[29, -1.5, z0 + 63]}
        radius={14}
        height={16}
        rockColor={sky.mountainNearColor}
        snowColor={sky.snowCapColor}
      />
    </group>
  )
}
