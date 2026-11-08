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
  CornholeBagRecord,
  CornholeState,
  HolotableMiniKind,
  HolotableMiniature,
  HolotableState,
  HolotableTerrainPresetId,
} from '../../types/barGames'
import type {
  ComputedSeat,
  ExpansionWingSyncedState,
  LightingPresetId,
  ParticipantProfile,
  PresenterState,
  RoomCustomizationState,
  RoomLightingConfig,
} from '../../types/lounge'
import {
  CommandCenterRoom3D,
  type LoungeMirrorCamPreset,
} from './CommandCenterRoom3D'
import { GameRoom3D } from './GameRoom3D'
import { OutdoorLakeDeck3D } from './OutdoorLakeDeck3D'

const noopRaycast = () => null

// Pre-allocated shared geometries & materials for Bookcases (eliminates 150+ per-instance GPU allocations)
const BOOK_PALETTE = [
  '#B91C1C',
  '#2563EB',
  '#15803D',
  '#D97706',
  '#7C3AED',
  '#EA580C',
  '#0D9488',
  '#CA8A04',
] as const

const SHARED_BOOK_MATERIALS = BOOK_PALETTE.map(
  (hex) =>
    new THREE.MeshStandardMaterial({
      color: hex,
      emissive: hex,
      emissiveIntensity: 0.45,
      roughness: 0.55,
      metalness: 0.12,
    }),
)

const SHARED_CABINET_MAT = new THREE.MeshStandardMaterial({
  color: '#522D1D',
  emissive: '#331A0F',
  emissiveIntensity: 0.48,
  roughness: 0.62,
  metalness: 0.12,
})

const SHARED_SHELF_MAT = new THREE.MeshStandardMaterial({
  color: '#6E3D26',
  emissive: '#452415',
  emissiveIntensity: 0.52,
  roughness: 0.52,
  metalness: 0.15,
})

const SHARED_LED_STRIP_MAT = new THREE.MeshBasicMaterial({
  color: '#FEF08A',
})

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
      {/* Brushed Gold 5-Star Base */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.27, 0.31, 0.05, 12]} />
        <meshStandardMaterial
          color="#E5A93C"
          emissive="#785216"
          emissiveIntensity={0.35}
          metalness={0.78}
          roughness={0.24}
        />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.045, 0.055, 0.34, 10]} />
        <meshStandardMaterial
          color="#C8922E"
          emissive="#6B4A14"
          emissiveIntensity={0.35}
          metalness={0.75}
          roughness={0.28}
        />
      </mesh>
      {/* Tufted Cognac Saddle-Leather Executive Cushion */}
      <RoundedBox args={[0.58, 0.11, 0.56]} position={[0, 0.43, 0]} radius={0.035} smoothness={2}>
        <meshStandardMaterial
          color={hovered && !takenByOther ? '#A85B31' : '#854522'}
          emissive="#542912"
          emissiveIntensity={0.5}
          roughness={0.44}
          metalness={0.14}
        />
      </RoundedBox>
      {/* Tall Executive Backrest with Brass Headrest Trim */}
      <RoundedBox
        args={[0.56, 0.8, 0.095]}
        position={[0, 0.84, 0.23]}
        rotation={[0.08, 0, 0]}
        radius={0.035}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#7A3E1D"
          emissive="#4D2510"
          emissiveIntensity={0.48}
          roughness={0.44}
          metalness={0.15}
        />
      </RoundedBox>
      <mesh position={[0, 1.22, 0.26]} rotation={[0.08, 0, 0]} raycast={noopRaycast}>
        <boxGeometry args={[0.42, 0.028, 0.1]} />
        <meshBasicMaterial color="#FBBF24" />
      </mesh>
      {/* Brushed Brass Armrests */}
      {[-0.3, 0.3].map((ax) => (
        <mesh key={ax} position={[ax, 0.6, 0.02]}>
          <boxGeometry args={[0.055, 0.042, 0.4]} />
          <meshStandardMaterial
            color="#EAB308"
            emissive="#855D14"
            emissiveIntensity={0.42}
            metalness={0.75}
            roughness={0.24}
          />
        </mesh>
      ))}
      {(hovered || isLocalSeat) && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.36, 0.44, 24]} />
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
      <RoundedBox args={[0.86, 0.35, 0.8]} position={[0, 0.22, 0]} radius={0.06} smoothness={2}>
        <meshStandardMaterial
          color={hovered && !takenByOther ? '#B93838' : '#962929'}
          emissive="#5E1616"
          emissiveIntensity={0.52}
          roughness={0.5}
          metalness={0.12}
        />
      </RoundedBox>
      {/* Warm Tartan / Gold Accent Throw Cushion */}
      <RoundedBox args={[0.44, 0.12, 0.36]} position={[0, 0.43, 0.1]} radius={0.04} smoothness={2}>
        <meshStandardMaterial
          color="#D97706"
          emissive="#78350F"
          emissiveIntensity={0.42}
          roughness={0.65}
        />
      </RoundedBox>
      {/* Rolled Wingback Backrest */}
      <RoundedBox
        args={[0.86, 0.74, 0.18]}
        position={[0, 0.69, 0.31]}
        rotation={[0.09, 0, 0]}
        radius={0.07}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#8A2424"
          emissive="#541313"
          emissiveIntensity={0.5}
          roughness={0.52}
        />
      </RoundedBox>
      {/* Rolled Leather Arms + Brass Nailhead Trim */}
      {[-0.39, 0.39].map((ax) => (
        <group key={ax}>
          <RoundedBox
            args={[0.17, 0.35, 0.78]}
            position={[ax, 0.48, 0.01]}
            radius={0.06}
            smoothness={2}
          >
            <meshStandardMaterial
              color="#912626"
              emissive="#591515"
              emissiveIntensity={0.5}
              roughness={0.52}
            />
          </RoundedBox>
          <mesh position={[ax, 0.48, -0.385]} raycast={noopRaycast}>
            <circleGeometry args={[0.045, 10]} />
            <meshBasicMaterial color="#FBBF24" />
          </mesh>
        </group>
      ))}
      {(hovered || isLocalSeat) && (
        <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.48, 0.56, 24]} />
          <meshBasicMaterial
            color={isLocalSeat ? '#E5A93C' : takenByOther ? '#EF4444' : '#FB923C'}
          />
        </mesh>
      )}
    </group>
  )
}

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
      {/* Warm Cherry-Mahogany Cabinet Backing Panel (set cleanly behind the shelves & books) */}
      <mesh position={[0, 1.75, -0.12]} material={SHARED_CABINET_MAT} raycast={noopRaycast}>
        <boxGeometry args={[width, 3.5, 0.1]} />
      </mesh>
      {/* Left & Right Vertical Cabinet Side Pillars */}
      {[-width / 2 + 0.04, width / 2 - 0.04].map((sx) => (
        <mesh key={sx} position={[sx, 1.75, 0.02]} material={SHARED_CABINET_MAT} raycast={noopRaycast}>
          <boxGeometry args={[0.08, 3.5, 0.34]} />
        </mesh>
      ))}
      {/* Top Crown Molding + Integrated Warm Gallery Strip */}
      <mesh position={[0, 3.52, 0.05]} material={SHARED_SHELF_MAT} raycast={noopRaycast}>
        <boxGeometry args={[width + 0.08, 0.08, 0.42]} />
      </mesh>
      {/* Shelves + Under-Shelf Warm LED Strips + Clustered Hardcover Spines */}
      {shelfYs.map((sy, sIdx) => (
        <group key={sy}>
          <mesh position={[0, sy, 0.03]} material={SHARED_SHELF_MAT} raycast={noopRaycast}>
            <boxGeometry args={[width - 0.06, 0.045, 0.32]} />
          </mesh>
          {/* Warm Under-Shelf LED Accent Strip */}
          <mesh position={[0, sy + 0.54, 0.16]} material={SHARED_LED_STRIP_MAT} raycast={noopRaycast}>
            <boxGeometry args={[width - 0.18, 0.012, 0.018]} />
          </mesh>
          {[-0.34, -0.17, 0, 0.17, 0.34].map((frac, bIdx) => {
            const mat = SHARED_BOOK_MATERIALS[(sIdx * 5 + bIdx) % SHARED_BOOK_MATERIALS.length]
            const bookH = 0.34 + ((sIdx + bIdx) % 3) * 0.05
            return (
              <mesh
                key={bIdx}
                position={[frac * width, sy + 0.024 + bookH / 2, 0.05]}
                material={mat}
                raycast={noopRaycast}
              >
                <boxGeometry args={[width * 0.13, bookH, 0.22]} />
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
      <RoundedBox args={[1.72, 0.3, 0.03]} radius={0.02} smoothness={2}>
        <meshBasicMaterial color="#0F172A" />
      </RoundedBox>
      <mesh position={[0, 0.13, 0.018]}>
        <planeGeometry args={[1.6, 0.018]} />
        <meshBasicMaterial color={accent} />
      </mesh>
      <Text
        position={[0, 0.035, 0.02]}
        fontSize={0.074}
        color="#F8FAFC"
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      <Text
        position={[0, -0.065, 0.02]}
        fontSize={0.044}
        color="#CBD5E1"
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
  localDisplayName: string
  participants: ParticipantProfile[]
  cinemaVolume: number
  cornholeState: CornholeState
  holotableState: HolotableState
  gameRoomStreamMuted: boolean
  onToggleGameRoomStreamMute: () => void
  onRecordCornholeThrow: (bag: CornholeBagRecord) => void
  onResetCornhole: () => void
  onSetHolotableTerrain: (preset: HolotableTerrainPresetId) => void
  onSelectHolotableMini: (id: string | null) => void
  onSpawnHolotableMini: (
    kind: HolotableMiniKind,
    label: string,
    color: string,
  ) => void
  onUpdateHolotableMini: (
    id: string,
    patch: Partial<HolotableMiniature>,
  ) => void
  onDeleteHolotableMini: (id: string) => void
  onResetHolotableMinis: () => void
  onToggleHolotableFog: () => void
  onToggleHolotableFogCell: (cellKey: string) => void
  onRevealAllHolotableFog: () => void
  onShroudAllHolotableFog: () => void
  onRecordArcadeScore: (
    game: 'arcade-hoops' | 'arcade-skeeball' | 'arcade-retro',
    score: number,
    highlight: string,
  ) => void
  onSelectSeat: (seatId: string) => void
  onTeleportToFloor?: (point: [number, number, number]) => void
  onJumpToDestination?: (dest: ExpansionRoomDestination) => void
  onUpdateWingState: (patch: Partial<ExpansionWingSyncedState>) => void
  onUpdateLighting?: (patch: Partial<RoomLightingConfig>) => void
  onApplyLightingPreset?: (presetId: LightingPresetId) => void
  onOpenCommandOpsDrawer?: () => void
}

export function ExpansionWing3D({
  roomCustomization,
  presenterState,
  mainVideoTexture,
  hasMainVideoFrames,
  computedSeats,
  localSeatId,
  localDisplayName,
  participants,
  cinemaVolume,
  cornholeState,
  holotableState,
  gameRoomStreamMuted,
  onToggleGameRoomStreamMute,
  onRecordCornholeThrow,
  onResetCornhole,
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
  onSelectSeat,
  onTeleportToFloor,
  onJumpToDestination,
  onUpdateWingState,
  onUpdateLighting,
  onApplyLightingPreset,
  onOpenCommandOpsDrawer,
}: ExpansionWing3DProps) {
  const { architecture, lighting } = roomCustomization
  const sizeSpec = ROOM_SIZE_SPECS[architecture.sizePreset] ?? ROOM_SIZE_SPECS.classic
  const wingLayout = useMemo(
    () => computeExpansionWingLayout(sizeSpec.backZ),
    [sizeSpec.backZ],
  )
  const wingState = useMemo(
    () => resolveExpansionWingState(roomCustomization.expansionWing),
    [roomCustomization.expansionWing],
  )

  const [crackleAudioOn, setCrackleAudioOn] = useState(() => fireplaceAudio.isPlaying())
  const [loungeCamPreset, setLoungeCamPreset] =
    useState<LoungeMirrorCamPreset>('wide')

  const handleCycleLoungeCamPreset = () => {
    setLoungeCamPreset((prev) =>
      prev === 'wide' ? 'screen' : prev === 'screen' ? 'games' : 'wide',
    )
  }

  // Real-time 3D Main Lounge mirror camera & offscreen render target (640x360, Quest 3 safe)
  const wingGroupRef = useRef<THREE.Group>(null)
  const lastMirrorRenderRef = useRef(-10)
  const loungeMirrorTarget = useMemo(() => {
    const rt = new THREE.WebGLRenderTarget(640, 360, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      depthBuffer: true,
      stencilBuffer: false,
    })
    rt.texture.colorSpace = THREE.SRGBColorSpace
    return rt
  }, [])
  const loungeCamera = useMemo(
    () => new THREE.PerspectiveCamera(58, 16 / 9, 0.2, 65),
    [],
  )

  useEffect(() => {
    return () => {
      fireplaceAudio.stop()
      loungeMirrorTarget.dispose()
    }
  }, [loungeMirrorTarget])

  const wingFrontLightRef = useRef<THREE.PointLight>(null)
  const wingRearLightRef = useRef<THREE.PointLight>(null)
  const hearthFlameRef = useRef<THREE.Group>(null)
  const hearthLightRef = useRef<THREE.PointLight>(null)

  const targetAmbientColor = useMemo(
    () => new THREE.Color(lighting.ambientTint || '#DCE4F5'),
    [lighting.ambientTint],
  )

  // Consolidated single useFrame for Wing lighting, hearth animation, & Main Lounge mirror camera (72Hz/90Hz Quest 3 safe)
  useFrame(({ clock, gl, scene }, delta) => {
    const t = clock.getElapsedTime()
    const lerpAlpha = 1 - Math.exp(-5.0 * Math.min(delta, 0.1))
    const masterGain = Math.max(0.25, lighting.brightness || 1.0)

    if (wingFrontLightRef.current) {
      wingFrontLightRef.current.intensity = THREE.MathUtils.lerp(
        wingFrontLightRef.current.intensity,
        22.0 * masterGain,
        lerpAlpha,
      )
      wingFrontLightRef.current.color.lerp(targetAmbientColor, lerpAlpha)
    }

    if (wingRearLightRef.current) {
      wingRearLightRef.current.intensity = THREE.MathUtils.lerp(
        wingRearLightRef.current.intensity,
        19.5 * masterGain,
        lerpAlpha,
      )
      wingRearLightRef.current.color.lerp(targetAmbientColor, lerpAlpha)
    }

    if (hearthFlameRef.current && wingState.libraryFireLit) {
      hearthFlameRef.current.scale.y =
        0.95 + Math.sin(t * 10.5) * 0.14 + Math.cos(t * 16.0) * 0.06
      hearthFlameRef.current.scale.x = 0.96 + Math.sin(t * 7.2) * 0.06
    }

    if (hearthLightRef.current) {
      hearthLightRef.current.intensity = wingState.libraryFireLit
        ? (16.5 + Math.sin(t * 11.0) * 2.5) * Math.max(0.55, masterGain)
        : 0
    }

    // Render live 3D Main Lounge feed at ~20 FPS whenever Command Center or Boardroom is mirroring
    const needsMirrorCam =
      wingState.commandScreenMode === 'mirror-lounge' ||
      wingState.boardroomScreenMode === 'mirror-lounge'

    if (needsMirrorCam && t - lastMirrorRenderRef.current >= 0.048) {
      lastMirrorRenderRef.current = t

      const scrPos = roomCustomization.screen.position
      if (loungeCamPreset === 'screen') {
        loungeCamera.fov = 46
        loungeCamera.position.set(0, 2.32, 0.45)
        loungeCamera.lookAt(scrPos[0], scrPos[1], scrPos[2])
      } else if (loungeCamPreset === 'games') {
        loungeCamera.fov = 56
        loungeCamera.position.set(-1.35, 2.35, 1.1)
        loungeCamera.lookAt(2.35, 1.25, sizeSpec.backZ - 1.35)
      } else {
        loungeCamera.fov = 58
        loungeCamera.position.set(0, 2.55, Math.min(sizeSpec.backZ - 0.65, 5.15))
        loungeCamera.lookAt(0, 1.75, -4.2)
      }
      loungeCamera.updateProjectionMatrix()
      loungeCamera.updateMatrixWorld()

      const wingGroup = wingGroupRef.current
      const prevWingVisible = wingGroup ? wingGroup.visible : true
      const prevTarget = gl.getRenderTarget()
      const prevXrEnabled = gl.xr.enabled
      const prevAutoClear = gl.autoClear

      try {
        if (wingGroup) wingGroup.visible = false
        gl.xr.enabled = false
        gl.autoClear = true
        gl.setRenderTarget(loungeMirrorTarget)
        gl.clear()
        gl.render(scene, loungeCamera)
      } finally {
        gl.setRenderTarget(prevTarget)
        gl.xr.enabled = prevXrEnabled
        gl.autoClear = prevAutoClear
        if (wingGroup) wingGroup.visible = prevWingVisible
      }
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
    wingState.boardroomScreenMode === 'mirror-lounge'

  // Scale architectural self-illumination smoothly with the user's lighting brightness slider
  const emissiveBoost = Math.max(0.28, Math.min(1.5, lighting.brightness || 1.0))
  const accentHex = lighting.accentColor || '#E5A93C'

  return (
    <group ref={wingGroupRef} name="clubhouse-expansion-wing">
      {/* High-Output Zone-Balanced Wing PointLights (replaces 8 tiny lights with 2 wide-throw lights) */}
      <pointLight
        ref={wingFrontLightRef}
        position={[0, 3.6, boardZ]}
        color={lighting.ambientTint || '#FEF3C7'}
        intensity={22.0}
        distance={30}
        decay={1.15}
      />
      <pointLight
        ref={wingRearLightRef}
        position={[-2.2, 3.6, z0 + 18.2]}
        color={lighting.ambientTint || '#E0F2FE'}
        intensity={19.5}
        distance={32}
        decay={1.15}
      />

      {/* =================================================================== */}
      {/* 1. GRAND CLUBHOUSE GALLERY HALLWAY (x in [-1.65, +1.65], dz 0..20.4) */}
      {/* =================================================================== */}
      <group name="wing-grand-hallway">
        {/* Polished Travertine Hallway Floor + Royal Crimson & Gold Runner */}
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
          <meshStandardMaterial
            color="#2B3446"
            emissive="#1B2230"
            emissiveIntensity={0.42 * emissiveBoost}
            roughness={0.55}
            metalness={0.2}
          />
        </mesh>
        {/* Gold Carpet Border */}
        <mesh
          position={[0, 0.008, z0 + HALLWAY_LENGTH / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[1.68, HALLWAY_LENGTH - 0.3]} />
          <meshBasicMaterial color="#D97706" />
        </mesh>
        {/* Crimson Velvet Runner */}
        <mesh
          position={[0, 0.011, z0 + HALLWAY_LENGTH / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[1.52, HALLWAY_LENGTH - 0.4]} />
          <meshStandardMaterial
            color="#7F1D1D"
            emissive="#450A0A"
            emissiveIntensity={0.45 * emissiveBoost}
            roughness={0.85}
          />
        </mesh>

        {/* Hallway Coffered Ceiling + Luminous Skylight Panels */}
        <mesh
          position={[0, HALLWAY_HEIGHT, z0 + HALLWAY_LENGTH / 2]}
          rotation={[Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[HALLWAY_HALF_WIDTH * 2, HALLWAY_LENGTH + 0.2]} />
          <meshStandardMaterial
            color="#1E2534"
            emissive="#111722"
            emissiveIntensity={0.4 * emissiveBoost}
            roughness={0.85}
          />
        </mesh>
        {[2.8, 7.6, 12.4, 17.4].map((dzLight) => (
          <group key={dzLight} position={[0, HALLWAY_HEIGHT - 0.04, z0 + dzLight]}>
            <mesh rotation={[Math.PI / 2, 0, 0]} raycast={noopRaycast}>
              <planeGeometry args={[1.55, 0.72]} />
              <meshBasicMaterial color="#CA8A04" />
            </mesh>
            <mesh position={[0, -0.005, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={noopRaycast}>
              <planeGeometry args={[1.42, 0.58]} />
              <meshBasicMaterial color="#FEF9C3" />
            </mesh>
          </group>
        ))}

        {/* Continuous Warm Brass Ceiling Cove Strips along Both Hallway Walls */}
        {[-HALLWAY_HALF_WIDTH + 0.09, HALLWAY_HALF_WIDTH - 0.09].map((cx) => (
          <mesh
            key={cx}
            position={[cx, HALLWAY_HEIGHT - 0.08, z0 + HALLWAY_LENGTH / 2]}
            raycast={noopRaycast}
          >
            <boxGeometry args={[0.03, 0.03, HALLWAY_LENGTH - 0.4]} />
            <meshBasicMaterial color={accentHex} />
          </mesh>
        ))}

        {/* WEST HALLWAY PARTITION WALL (x = -1.65) with Doorways at dz [4.25, 6.55] & [13.85, 16.15] */}
        {[
          [z0 + 2.125, 4.25],
          [z0 + 10.2, 7.3],
          [z0 + 18.275, 4.25],
        ].map(([wz, wLen], idx) => (
          <group key={idx} position={[-HALLWAY_HALF_WIDTH, 0, wz]}>
            <mesh position={[0, HALLWAY_HEIGHT / 2, 0]}>
              <boxGeometry args={[0.14, HALLWAY_HEIGHT, wLen]} />
              <meshStandardMaterial
                color="#333F54"
                emissive="#1D2533"
                emissiveIntensity={0.44 * emissiveBoost}
                roughness={0.7}
              />
            </mesh>
            {/* Lower Walnut Wainscot + Brass Chair Rail */}
            <mesh position={[0.015, 0.55, 0]} raycast={noopRaycast}>
              <boxGeometry args={[0.13, 1.1, wLen - 0.04]} />
              <meshStandardMaterial
                color="#5C341E"
                emissive="#381E10"
                emissiveIntensity={0.45 * emissiveBoost}
                roughness={0.62}
              />
            </mesh>
            <mesh position={[0.082, 1.12, 0]} raycast={noopRaycast}>
              <boxGeometry args={[0.015, 0.035, wLen - 0.04]} />
              <meshBasicMaterial color={accentHex} />
            </mesh>
          </group>
        ))}
        {/* West Doorway Lintels (y = 3.45, height 0.7) */}
        {[z0 + 5.4, z0 + 15.0].map((lz) => (
          <mesh key={lz} position={[-HALLWAY_HALF_WIDTH, 3.45, lz]}>
            <boxGeometry args={[0.14, 0.7, 2.3]} />
            <meshStandardMaterial
              color="#333F54"
              emissive="#1D2533"
              emissiveIntensity={0.44 * emissiveBoost}
              roughness={0.7}
            />
          </mesh>
        ))}

        {/* EAST HALLWAY PARTITION WALL (x = +1.65) with Doorways at dz [4.25, 6.55] and [13.85, 16.15] */}
        {[
          [z0 + 2.125, 4.25],
          [z0 + 10.2, 7.3],
          [z0 + 18.275, 4.25],
        ].map(([ez, eLen], idx) => (
          <group key={idx} position={[HALLWAY_HALF_WIDTH, 0, ez]}>
            <mesh position={[0, HALLWAY_HEIGHT / 2, 0]}>
              <boxGeometry args={[0.14, HALLWAY_HEIGHT, eLen]} />
              <meshStandardMaterial
                color="#333F54"
                emissive="#1D2533"
                emissiveIntensity={0.44 * emissiveBoost}
                roughness={0.7}
              />
            </mesh>
            <mesh position={[-0.015, 0.55, 0]} raycast={noopRaycast}>
              <boxGeometry args={[0.13, 1.1, eLen - 0.04]} />
              <meshStandardMaterial
                color="#5C341E"
                emissive="#381E10"
                emissiveIntensity={0.45 * emissiveBoost}
                roughness={0.62}
              />
            </mesh>
            <mesh position={[-0.082, 1.12, 0]} raycast={noopRaycast}>
              <boxGeometry args={[0.015, 0.035, eLen - 0.04]} />
              <meshBasicMaterial color={accentHex} />
            </mesh>
          </group>
        ))}
        {[z0 + 5.4, z0 + 15.0].map((doorZ) => (
          <mesh key={doorZ} position={[HALLWAY_HALF_WIDTH, 3.45, doorZ]}>
            <boxGeometry args={[0.14, 0.7, 2.3]} />
            <meshStandardMaterial
              color="#333F54"
              emissive="#1D2533"
              emissiveIntensity={0.44 * emissiveBoost}
              roughness={0.7}
            />
          </mesh>
        ))}

        {/* South End Hallway Lintel above Outdoor Deck Portal (dz = 20.4) */}
        <mesh position={[0, 3.5, z0 + HALLWAY_LENGTH]}>
          <boxGeometry args={[HALLWAY_HALF_WIDTH * 2, 0.65, 0.16]} />
          <meshStandardMaterial
            color="#4A2C1B"
            emissive="#2B180E"
            emissiveIntensity={0.45 * emissiveBoost}
            roughness={0.75}
          />
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
          sublabel="Quiet Zone (Stream Auto-Mutes) · Study"
          accent="#EA580C"
        />
        <DoorwaySign3D
          position={[-1.55, 3.32, z0 + 15.0]}
          rotationY={Math.PI / 2}
          label="🛰 COMMAND & CONTROL"
          sublabel="Aux Screen · ESPN Sports · Weather & News"
          accent="#38BDF8"
        />
        <DoorwaySign3D
          position={[1.55, 3.32, z0 + 15.0]}
          rotationY={-Math.PI / 2}
          label="🕹 THE GAME ROOM"
          sublabel="Holotable Sanctum · Neon Arcade · Stream Mirror"
          accent="#A855F7"
        />
        <DoorwaySign3D
          position={[0, 3.42, z0 + HALLWAY_LENGTH - 0.12]}
          rotationY={Math.PI}
          label="🏔 OUTDOOR LAKE & MOUNTAIN DECK"
          sublabel="Step outside to Alpine Vista, Firepit & Cornhole ↑"
          accent="#34D399"
        />

        {/* Interactive 3D Clubhouse Directory & Lighting Control Board ([1.55, 1.72, z0 + 2.15]) */}
        <group position={[1.55, 1.72, z0 + 2.15]} rotation={[0, -Math.PI / 2, 0]}>
          <RoundedBox args={[1.64, 1.56, 0.04]} radius={0.025} smoothness={2}>
            <meshStandardMaterial color="#0F172A" metalness={0.45} roughness={0.4} />
          </RoundedBox>
          <Text
            position={[0, 0.63, 0.026]}
            fontSize={0.068}
            color="#E5A93C"
            anchorX="center"
            anchorY="middle"
          >
            🏛 CLUBHOUSE WING DIRECTORY
          </Text>
          <Text
            position={[0, 0.52, 0.026]}
            fontSize={0.038}
            color="#CBD5E1"
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
                position={[0, 0.36 - idx * 0.145, 0.026]}
                onClick={(e) => {
                  e.stopPropagation()
                  if (onJumpToDestination) {
                    onJumpToDestination(dest)
                  } else if (onTeleportToFloor) {
                    onTeleportToFloor(dest.spawnPosition)
                  }
                }}
              >
                <RoundedBox args={[1.44, 0.12, 0.015]} radius={0.018} smoothness={2}>
                  <meshBasicMaterial color="#1E293B" />
                </RoundedBox>
                <Text
                  position={[-0.65, 0, 0.012]}
                  fontSize={0.044}
                  color="#F8FAFC"
                  anchorX="left"
                  anchorY="middle"
                >
                  {`${dest.emoji} ${dest.title}`}
                </Text>
                <Text
                  position={[0.65, 0, 0.012]}
                  fontSize={0.04}
                  color={dest.accentColor}
                  anchorX="right"
                  anchorY="middle"
                >
                  GO →
                </Text>
              </group>
            ))}

          {/* 3D Quick Lighting Controls on Hallway Directory Board */}
          <group position={[0, -0.57, 0.026]}>
            {[
              { id: 'daylight' as LightingPresetId, label: '☀️ Bright', b: 1.45 },
              { id: 'cozy' as LightingPresetId, label: '🕯 Warm', b: 1.05 },
              { id: 'neon-pub' as LightingPresetId, label: '⚡ Neon', b: 0.92 },
              { id: 'movie' as LightingPresetId, label: '🎬 Dim', b: 0.48 },
            ].map((lt, idx) => {
              const active = lighting.preset === lt.id
              return (
                <group
                  key={lt.id}
                  position={[-0.54 + idx * 0.36, 0, 0]}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (onApplyLightingPreset) {
                      onApplyLightingPreset(lt.id)
                    } else if (onUpdateLighting) {
                      onUpdateLighting({ preset: lt.id, brightness: lt.b })
                    }
                  }}
                >
                  <RoundedBox args={[0.33, 0.125, 0.015]} radius={0.016}>
                    <meshBasicMaterial color={active ? '#E5A93C' : '#1E293B'} />
                  </RoundedBox>
                  <Text
                    position={[0, 0, 0.012]}
                    fontSize={0.036}
                    color={active ? '#080A0D' : '#F8FAFC'}
                    anchorX="center"
                    anchorY="middle"
                  >
                    {lt.label}
                  </Text>
                </group>
              )
            })}
          </group>
        </group>

        {/* Illuminated Gallery Art Prints along East Rear Hallway Wall (flanking Game Room doorway) */}
        {[10.2, 18.2].map((artDz, idx) => (
          <group
            key={artDz}
            position={[1.56, 1.88, z0 + artDz]}
            rotation={[0, -Math.PI / 2, 0]}
          >
            {/* Brass Picture Light Bar */}
            <mesh position={[0, 0.56, 0.06]} raycast={noopRaycast}>
              <boxGeometry args={[0.62, 0.025, 0.08]} />
              <meshBasicMaterial color="#FDE047" />
            </mesh>
            <RoundedBox args={[1.38, 0.96, 0.03]} radius={0.015}>
              <meshStandardMaterial
                color="#D4A54E"
                emissive="#785418"
                emissiveIntensity={0.4}
                metalness={0.65}
                roughness={0.32}
              />
            </RoundedBox>
            <mesh position={[0, 0, 0.018]} raycast={noopRaycast}>
              <planeGeometry args={[1.24, 0.82]} />
              <meshBasicMaterial
                color={idx === 0 ? '#1D4ED8' : idx === 1 ? '#7E22CE' : '#0F766E'}
              />
            </mesh>
            {/* Geometric Modern Art Motif */}
            <mesh position={[-0.22, 0.06, 0.022]} raycast={noopRaycast}>
              <circleGeometry args={[0.22, 20]} />
              <meshBasicMaterial
                color={idx === 0 ? '#FBBF24' : idx === 1 ? '#F472B6' : '#34D399'}
              />
            </mesh>
            <mesh position={[0.24, -0.1, 0.024]} raycast={noopRaycast}>
              <planeGeometry args={[0.42, 0.34]} />
              <meshBasicMaterial color="#F8FAFC" transparent opacity={0.85} />
            </mesh>
          </group>
        ))}
      </group>

      {/* =================================================================== */}
      {/* 2. FANCY EXECUTIVE BOARD ROOM (West Wing Front, x -11.2..-1.65)     */}
      {/* =================================================================== */}
      <group name="wing-executive-boardroom">
        {/* Warm Travertine Floor + Navy/Gold Wool Executive Carpet */}
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
          <meshStandardMaterial
            color="#3B271C"
            emissive="#24160E"
            emissiveIntensity={0.45 * emissiveBoost}
            roughness={0.48}
            metalness={0.18}
          />
        </mesh>
        <mesh
          position={[-6.4, 0.011, boardZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[6.6, 4.3]} />
          <meshBasicMaterial color="#D97706" />
        </mesh>
        <mesh
          position={[-6.4, 0.014, boardZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[6.4, 4.1]} />
          <meshStandardMaterial
            color="#1E293B"
            emissive="#111827"
            emissiveIntensity={0.45 * emissiveBoost}
            roughness={0.88}
          />
        </mesh>

        {/* Illuminated Coffered Ceiling + Sculptural Double-Tier Brass Chandelier */}
        <mesh position={[-6.425, 3.85, boardZ]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[9.55, 8.8]} />
          <meshStandardMaterial
            color="#261B15"
            emissive="#17100C"
            emissiveIntensity={0.42 * emissiveBoost}
            roughness={0.85}
          />
        </mesh>
        {/* Warm Perimeter Ceiling Cove Glow */}
        <mesh
          position={[-6.4, 3.81, boardZ]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <ringGeometry args={[3.4, 3.65, 4]} />
          <meshBasicMaterial color="#FDE68A" side={THREE.DoubleSide} />
        </mesh>
        <group position={[-6.4, 3.12, boardZ]}>
          <mesh>
            <boxGeometry args={[3.6, 0.07, 0.28]} />
            <meshStandardMaterial
              color="#E5A93C"
              emissive="#8A5E18"
              emissiveIntensity={0.45}
              metalness={0.82}
              roughness={0.2}
            />
          </mesh>
          <mesh position={[0, -0.045, 0]}>
            <boxGeometry args={[3.4, 0.035, 0.18]} />
            <meshBasicMaterial color="#FEF9C3" />
          </mesh>
        </group>

        {/* West, North, and South Honey Burl-Walnut & Venetian Plaster Walls */}
        <mesh position={[-11.2, 1.925, boardZ]}>
          <boxGeometry args={[0.14, 3.85, 8.8]} />
          <meshStandardMaterial
            color="#4A2C1B"
            emissive="#2E1A0F"
            emissiveIntensity={0.46 * emissiveBoost}
            roughness={0.62}
          />
        </mesh>
        <mesh position={[-6.425, 1.925, z0 + 1.0]}>
          <boxGeometry args={[9.55, 3.85, 0.14]} />
          <meshStandardMaterial
            color="#52301E"
            emissive="#331D11"
            emissiveIntensity={0.46 * emissiveBoost}
            roughness={0.64}
          />
        </mesh>
        <mesh position={[-6.425, 1.925, z0 + 9.8]}>
          <boxGeometry args={[9.55, 3.85, 0.14]} />
          <meshStandardMaterial
            color="#52301E"
            emissive="#331D11"
            emissiveIntensity={0.46 * emissiveBoost}
            roughness={0.64}
          />
        </mesh>
        {/* Warm Brass Architectural Reveal Strips on Boardroom Walls */}
        {[z0 + 1.09, z0 + 9.71].map((rz) => (
          <mesh key={rz} position={[-6.425, 3.68, rz]} raycast={noopRaycast}>
            <boxGeometry args={[9.2, 0.03, 0.02]} />
            <meshBasicMaterial color={accentHex} />
          </mesh>
        ))}

        {/* North Wall Backlit Panoramic Dusk City Skyline Window */}
        <group position={[-6.4, 2.08, z0 + 1.1]}>
          <RoundedBox args={[5.4, 1.95, 0.05]} radius={0.02}>
            <meshStandardMaterial
              color="#D4A54E"
              emissive="#785418"
              emissiveIntensity={0.4}
              metalness={0.75}
              roughness={0.26}
            />
          </RoundedBox>
          <mesh position={[0, 0, 0.028]}>
            <planeGeometry args={[5.18, 1.76]} />
            <meshBasicMaterial color="#1E3A8A" />
          </mesh>
          <mesh position={[0, -0.44, 0.03]}>
            <planeGeometry args={[5.18, 0.68]} />
            <meshBasicMaterial color="#F59E0B" transparent opacity={0.48} />
          </mesh>
          {[-2.0, -1.35, -0.7, -0.1, 0.55, 1.25, 1.9].map((bx, idx) => {
            const bh = 0.65 + ((idx * 3) % 4) * 0.24
            return (
              <group key={bx} position={[bx, -0.86 + bh / 2, 0.033]}>
                <mesh raycast={noopRaycast}>
                  <planeGeometry args={[0.48, bh]} />
                  <meshBasicMaterial color="#0F172A" />
                </mesh>
                {/* Lit Skyscraper Windows */}
                <mesh position={[0, 0.08, 0.003]} raycast={noopRaycast}>
                  <planeGeometry args={[0.3, bh * 0.55]} />
                  <meshBasicMaterial color="#FDE68A" transparent opacity={0.55} />
                </mesh>
              </group>
            )
          })}
        </group>

        {/* South Wall Executive Credenza Sideboard + Espresso Decanter Set */}
        <group position={[-6.4, 0, z0 + 9.38]}>
          <RoundedBox args={[3.8, 0.84, 0.54]} position={[0, 0.42, 0]} radius={0.03}>
            <meshStandardMaterial
              color="#5C341E"
              emissive="#3A2011"
              emissiveIntensity={0.48 * emissiveBoost}
              roughness={0.5}
              metalness={0.18}
            />
          </RoundedBox>
          <mesh position={[0, 0.85, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={noopRaycast}>
            <planeGeometry args={[3.68, 0.46]} />
            <meshBasicMaterial color="#F8FAFC" />
          </mesh>
        </group>

        {/* Grand 4.8m Burl Walnut & Calacatta Gold Marble Conference Table */}
        <group position={[-6.4, 0, boardZ]}>
          {/* Dual Sculpted Brass/Walnut Pedestals */}
          {[-1.45, 1.45].map((px) => (
            <mesh key={px} position={[px, 0.36, 0]}>
              <cylinderGeometry args={[0.32, 0.4, 0.72, 16]} />
              <meshStandardMaterial
                color="#4E2B19"
                emissive="#2E180D"
                emissiveIntensity={0.45 * emissiveBoost}
                roughness={0.5}
                metalness={0.3}
              />
            </mesh>
          ))}
          {/* Outer Honey Burl Walnut Tabletop */}
          <RoundedBox args={[4.85, 0.085, 1.7]} position={[0, 0.74, 0]} radius={0.035} smoothness={2}>
            <meshStandardMaterial
              color="#6B3A20"
              emissive="#452412"
              emissiveIntensity={0.5 * emissiveBoost}
              roughness={0.32}
              metalness={0.22}
            />
          </RoundedBox>
          {/* Center Calacatta Gold Marble Inlay + Brass Conference Pods */}
          <mesh position={[0, 0.785, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.7, 0.66]} />
            <meshStandardMaterial
              color="#F8FAFC"
              emissive="#E2E8F0"
              emissiveIntensity={0.38 * emissiveBoost}
              roughness={0.24}
              metalness={0.12}
            />
          </mesh>
          {[-1.15, 0, 1.15].map((mx) => (
            <mesh key={mx} position={[mx, 0.798, 0]}>
              <boxGeometry args={[0.24, 0.022, 0.15]} />
              <meshStandardMaterial
                color="#E5A93C"
                emissive="#8A6421"
                emissiveIntensity={0.45}
                metalness={0.82}
                roughness={0.22}
              />
            </mesh>
          ))}
          {/* Executive Leather Desk Blotters at Each Place Setting */}
          {[-1.65, -0.55, 0.55, 1.65].map((bx) =>
            [-0.58, 0.58].map((bz) => (
              <mesh
                key={`${bx}-${bz}`}
                position={[bx, 0.786, bz]}
                rotation={[-Math.PI / 2, 0, 0]}
                raycast={noopRaycast}
              >
                <planeGeometry args={[0.48, 0.32]} />
                <meshBasicMaterial color="#1E293B" />
              </mesh>
            )),
          )}
        </group>

        {/* West Wall Interactive Executive Presentation / Lounge-Mirror Screen */}
        <group position={[-11.05, 2.02, boardZ]} rotation={[0, Math.PI / 2, 0]}>
          <RoundedBox args={[3.86, 2.26, 0.05]} radius={0.03} smoothness={2}>
            <meshStandardMaterial
              color="#2A1B12"
              emissive="#1A100A"
              emissiveIntensity={0.4}
              metalness={0.55}
              roughness={0.35}
            />
          </RoundedBox>

          {boardroomShowingMirror ? (
            <group position={[0, 0.06, 0.029]}>
              <mesh
                onClick={(e) => {
                  e.stopPropagation()
                  handleCycleLoungeCamPreset()
                }}
              >
                <planeGeometry args={[3.66, 1.94]} />
                {hasMainVideoFrames ? (
                  <meshBasicMaterial
                    key="board-main-video"
                    map={mainVideoTexture}
                    color="#ffffff"
                    toneMapped={false}
                  />
                ) : (
                  <meshBasicMaterial
                    key="board-lounge-cam"
                    map={loungeMirrorTarget.texture}
                    color="#ffffff"
                    toneMapped={false}
                  />
                )}
              </mesh>
              <group position={[-1.08, 0.84, 0.006]}>
                <RoundedBox args={[1.38, 0.12, 0.006]} radius={0.014}>
                  <meshBasicMaterial color="#060D1A" transparent opacity={0.82} />
                </RoundedBox>
                <Text
                  position={[0, 0, 0.005]}
                  fontSize={0.042}
                  color="#34D399"
                  anchorX="center"
                  anchorY="middle"
                >
                  {hasMainVideoFrames
                    ? `🟢 LIVE MAIN LOUNGE STREAM`
                    : `🟢 LIVE MAIN LOUNGE CAM (CLICK TO SWITCH ANGLE)`}
                </Text>
              </group>
            </group>
          ) : (
            <group position={[0, 0.06, 0.029]}>
              <mesh>
                <planeGeometry args={[3.66, 1.94]} />
                <meshBasicMaterial color="#0F172A" />
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
                color="#FBBF24"
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
                  color="#E2E8F0"
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
        {/* Warm Honey-Oak Parquet Floor + Ornate Crimson & Gold Persian Rug */}
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
            color="#5C3824"
            emissive="#382013"
            emissiveIntensity={0.45 * emissiveBoost}
            roughness={0.55}
          />
        </mesh>
        {/* Gold Outer Rug Border */}
        <mesh
          position={[6.8, 0.01, libZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[5.65, 4.85]} />
          <meshBasicMaterial color="#D97706" />
        </mesh>
        <mesh
          position={[6.8, 0.012, libZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[5.4, 4.6]} />
          <meshStandardMaterial
            color="#991B1B"
            emissive="#5E1010"
            emissiveIntensity={0.48 * emissiveBoost}
            roughness={0.88}
          />
        </mesh>
        <mesh
          position={[6.8, 0.015, libZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[4.5, 3.7]} />
          <meshStandardMaterial
            color="#B91C1C"
            emissive="#701313"
            emissiveIntensity={0.48 * emissiveBoost}
            roughness={0.88}
          />
        </mesh>
        {/* Center Persian Medallion */}
        <mesh
          position={[6.8, 0.018, libZ]}
          rotation={[-Math.PI / 2, 0, Math.PI / 4]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[1.65, 1.65]} />
          <meshBasicMaterial color="#1E3A8A" />
        </mesh>

        {/* Warm Coffered Timber Ceiling + Brass Study Chandelier */}
        <mesh position={[6.425, 3.85, libZ]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[9.55, 8.8]} />
          <meshStandardMaterial
            color="#362013"
            emissive="#21130B"
            emissiveIntensity={0.42 * emissiveBoost}
            roughness={0.85}
          />
        </mesh>
        <group position={[6.6, 3.25, libZ]}>
          <mesh raycast={noopRaycast}>
            <cylinderGeometry args={[0.75, 0.85, 0.08, 16]} />
            <meshBasicMaterial color="#F59E0B" />
          </mesh>
          <mesh position={[0, -0.05, 0]} raycast={noopRaycast}>
            <sphereGeometry args={[0.38, 14, 10]} />
            <meshBasicMaterial color="#FEF9C3" />
          </mesh>
        </group>

        {/* East, North, and South British Racing Green & Mahogany Study Walls */}
        <mesh position={[11.2, 1.925, libZ]}>
          <boxGeometry args={[0.14, 3.85, 8.8]} />
          <meshStandardMaterial
            color="#26463B"
            emissive="#162B24"
            emissiveIntensity={0.46 * emissiveBoost}
            roughness={0.75}
          />
        </mesh>
        <mesh position={[6.425, 1.925, z0 + 1.0]}>
          <boxGeometry args={[9.55, 3.85, 0.14]} />
          <meshStandardMaterial
            color="#26463B"
            emissive="#162B24"
            emissiveIntensity={0.46 * emissiveBoost}
            roughness={0.75}
          />
        </mesh>
        <mesh position={[6.425, 1.925, z0 + 9.8]}>
          <boxGeometry args={[9.55, 3.85, 0.14]} />
          <meshStandardMaterial
            color="#26463B"
            emissive="#162B24"
            emissiveIntensity={0.46 * emissiveBoost}
            roughness={0.75}
          />
        </mesh>

        {/* Wraparound Floor-to-Ceiling Illuminated Mahogany Bookcases */}
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
            <mesh key={lx} position={[lx, 0, 0]} raycast={noopRaycast}>
              <cylinderGeometry args={[0.02, 0.02, 3.3, 8]} />
              <meshBasicMaterial color="#FBBF24" />
            </mesh>
          ))}
        </group>

        {/* =============================================================== */}
        {/* CRACKLING STONE HEARTH FIREPLACE (East Wall [10.62, 0, libZ])   */}
        {/* =============================================================== */}
        <group position={[10.62, 0, libZ]} rotation={[0, -Math.PI / 2, 0]}>
          {/* Stacked Limestone Chimney Breast */}
          <mesh position={[0, 1.925, -0.1]}>
            <boxGeometry args={[2.6, 3.85, 0.74]} />
            <meshStandardMaterial
              color="#64748B"
              emissive="#334155"
              emissiveIntensity={0.46 * emissiveBoost}
              roughness={0.85}
            />
          </mesh>
          {/* Hearth Floor Apron */}
          <mesh position={[0, 0.06, 0.42]}>
            <boxGeometry args={[2.8, 0.12, 0.9]} />
            <meshStandardMaterial
              color="#475569"
              emissive="#27313F"
              emissiveIntensity={0.42 * emissiveBoost}
              roughness={0.8}
            />
          </mesh>
          {/* Carved Cherry-Walnut Mantelpiece + Brass Trim */}
          <RoundedBox args={[2.84, 0.17, 0.94]} position={[0, 1.48, 0.12]} radius={0.025}>
            <meshStandardMaterial
              color="#6B371E"
              emissive="#422010"
              emissiveIntensity={0.5 * emissiveBoost}
              roughness={0.48}
            />
          </RoundedBox>
          <mesh position={[0, 1.38, 0.56]} raycast={noopRaycast}>
            <boxGeometry args={[2.76, 0.024, 0.02]} />
            <meshBasicMaterial color="#FBBF24" />
          </mesh>
          {/* Firebox + Glowing Ember Bed */}
          <mesh position={[0, 0.68, 0.16]}>
            <boxGeometry args={[1.52, 1.14, 0.36]} />
            <meshBasicMaterial color="#180D09" />
          </mesh>
          <mesh position={[0, 0.14, 0.25]} rotation={[-Math.PI / 2, 0, 0]} raycast={noopRaycast}>
            <planeGeometry args={[1.32, 0.44]} />
            <meshBasicMaterial color={wingState.libraryFireLit ? '#EA580C' : '#291D18'} />
          </mesh>
          {/* Glowing Charred Oak Logs */}
          <mesh position={[0, 0.24, 0.24]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.095, 0.105, 1.02, 8]} />
            <meshStandardMaterial
              color="#3E1F12"
              emissive={wingState.libraryFireLit ? '#F97316' : '#000000'}
              emissiveIntensity={wingState.libraryFireLit ? 0.85 : 0}
            />
          </mesh>
          <mesh position={[0.08, 0.32, 0.28]} rotation={[0.2, 0.35, Math.PI / 2]}>
            <cylinderGeometry args={[0.08, 0.09, 0.86, 8]} />
            <meshStandardMaterial
              color="#3E1F12"
              emissive={wingState.libraryFireLit ? '#FB923C' : '#000000'}
              emissiveIntensity={wingState.libraryFireLit ? 0.95 : 0}
            />
          </mesh>

          {/* Animated Flickering 3D Hearth Flames */}
          {wingState.libraryFireLit && (
            <group position={[0, 0.34, 0.26]} ref={hearthFlameRef}>
              <mesh position={[0, 0.3, 0]} raycast={noopRaycast}>
                <coneGeometry args={[0.35, 0.68, 7]} />
                <meshBasicMaterial color="#F97316" />
              </mesh>
              <mesh position={[-0.24, 0.22, 0.03]} raycast={noopRaycast}>
                <coneGeometry args={[0.22, 0.48, 6]} />
                <meshBasicMaterial color="#FB923C" />
              </mesh>
              <mesh position={[0.24, 0.24, 0.02]} raycast={noopRaycast}>
                <coneGeometry args={[0.23, 0.5, 6]} />
                <meshBasicMaterial color="#FACC15" />
              </mesh>
              <mesh position={[0, 0.18, 0.07]} raycast={noopRaycast}>
                <coneGeometry args={[0.18, 0.36, 6]} />
                <meshBasicMaterial color="#FEF08A" />
              </mesh>
            </group>
          )}

          <pointLight
            ref={hearthLightRef}
            position={[0, 0.82, 1.1]}
            color="#FB923C"
            intensity={16.5}
            distance={18}
            decay={1.25}
          />

          {/* Interactive Mantel Controls Plaque (Flame & Crackling Audio) */}
          <group position={[0, 1.88, 0.28]}>
            <RoundedBox args={[1.68, 0.4, 0.03]} radius={0.02}>
              <meshBasicMaterial color="#0F172A" />
            </RoundedBox>
            <Text
              position={[0, 0.1, 0.02]}
              fontSize={0.054}
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
              <RoundedBox args={[0.72, 0.145, 0.015]} radius={0.016}>
                <meshBasicMaterial
                  color={wingState.libraryFireLit ? '#EA580C' : '#334155'}
                />
              </RoundedBox>
              <Text
                position={[0, 0, 0.012]}
                fontSize={0.045}
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
              <RoundedBox args={[0.72, 0.145, 0.015]} radius={0.016}>
                <meshBasicMaterial color={crackleAudioOn ? '#34D399' : '#1E293B'} />
              </RoundedBox>
              <Text
                position={[0, 0, 0.012]}
                fontSize={0.045}
                color={crackleAudioOn ? '#080A0D' : '#F8FAFC'}
                anchorX="center"
                anchorY="middle"
              >
                {crackleAudioOn ? '🔊 Crackle On' : '🔇 Crackle Sound'}
              </Text>
            </group>
          </group>
        </group>

        {/* Central Walnut Reading Table + Warm Banker Lamp + Open Hardcover Book */}
        <group position={[6.7, 0, libZ]}>
          <RoundedBox args={[0.96, 0.065, 0.96]} position={[0, 0.54, 0]} radius={0.025}>
            <meshStandardMaterial
              color="#5C341E"
              emissive="#381E10"
              emissiveIntensity={0.48 * emissiveBoost}
              roughness={0.42}
            />
          </RoundedBox>
          <mesh position={[0, 0.27, 0]}>
            <cylinderGeometry args={[0.13, 0.26, 0.54, 12]} />
            <meshStandardMaterial
              color="#4A2816"
              emissive="#2B160B"
              emissiveIntensity={0.45 * emissiveBoost}
              roughness={0.55}
            />
          </mesh>
          {/* Brass Banker Lamp */}
          <mesh position={[-0.12, 0.68, -0.1]}>
            <cylinderGeometry args={[0.028, 0.065, 0.24, 8]} />
            <meshBasicMaterial color="#FBBF24" />
          </mesh>
          <mesh position={[-0.12, 0.82, -0.1]}>
            <cylinderGeometry args={[0.13, 0.17, 0.11, 10]} />
            <meshBasicMaterial color="#22C55E" />
          </mesh>
          {/* Open Hardcover Book on Table */}
          <mesh position={[0.18, 0.585, 0.14]} rotation={[0, 0.4, 0]} raycast={noopRaycast}>
            <boxGeometry args={[0.28, 0.025, 0.2]} />
            <meshBasicMaterial color="#FEF9C3" />
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
        lighting={lighting}
        presenterState={presenterState}
        mainVideoTexture={mainVideoTexture}
        hasMainVideoFrames={hasMainVideoFrames}
        loungeMirrorTexture={loungeMirrorTarget.texture}
        loungeCamPreset={loungeCamPreset}
        onCycleLoungeCamPreset={handleCycleLoungeCamPreset}
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
      {/* 5. THE GAME ROOM (East Wing Rear: Holotable, Arcade & Stream Mirror)*/}
      {/* =================================================================== */}
      <GameRoom3D
        wingLayout={wingLayout}
        lighting={lighting}
        presenterState={presenterState}
        mainVideoTexture={mainVideoTexture}
        hasMainVideoFrames={hasMainVideoFrames}
        loungeMirrorTexture={loungeMirrorTarget.texture}
        computedSeats={computedSeats}
        localSeatId={localSeatId}
        participants={participants}
        holotableState={holotableState}
        gameRoomStreamMuted={gameRoomStreamMuted}
        onToggleGameRoomStreamMute={onToggleGameRoomStreamMute}
        onSelectSeat={onSelectSeat}
        onTeleportToFloor={onTeleportToFloor}
        onSetHolotableTerrain={onSetHolotableTerrain}
        onSelectHolotableMini={onSelectHolotableMini}
        onSpawnHolotableMini={onSpawnHolotableMini}
        onUpdateHolotableMini={onUpdateHolotableMini}
        onDeleteHolotableMini={onDeleteHolotableMini}
        onResetHolotableMinis={onResetHolotableMinis}
        onToggleHolotableFog={onToggleHolotableFog}
        onToggleHolotableFogCell={onToggleHolotableFogCell}
        onRevealAllHolotableFog={onRevealAllHolotableFog}
        onShroudAllHolotableFog={onShroudAllHolotableFog}
        onRecordArcadeScore={onRecordArcadeScore}
      />

      {/* =================================================================== */}
      {/* 6. OUTDOOR LAKE & MOUNTAIN OBSERVATION DECK (South Vista + Cornhole)*/}
      {/* =================================================================== */}
      <OutdoorLakeDeck3D
        wingLayout={wingLayout}
        wingState={wingState}
        lighting={lighting}
        computedSeats={computedSeats}
        localSeatId={localSeatId}
        participants={participants}
        cornholeState={cornholeState}
        localDisplayName={localDisplayName}
        onRecordCornholeThrow={onRecordCornholeThrow}
        onResetCornhole={onResetCornhole}
        onSelectSeat={onSelectSeat}
        onTeleportToFloor={onTeleportToFloor}
        onUpdateWingState={onUpdateWingState}
      />
    </group>
  )
}
