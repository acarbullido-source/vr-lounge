import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useXR, useXRInputSourceState, type XRControllerState } from '@react-three/xr'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import type { ExpansionWingLayout } from '../../constants/expansionRooms'
import {
  shootingRangeAudio,
  type RangeWeaponId,
} from '../../services/shootingRangeAudio'
import { playSpatialUiFeedback } from '../../services/soundboardAudio'
import {
  isControllerButtonPressed,
  isSpatialUiHovered,
  readXRSpaceWorldPose,
  setSpatialUiHovered,
  triggerXRHapticPulse,
} from '../../services/xrTracking'
import type {
  ComputedSeat,
  ParticipantProfile,
  RoomLightingConfig,
} from '../../types/lounge'

const noopRaycast = () => null
const TRACER_UP_AXIS = new THREE.Vector3(0, 1, 0)

function TracerBeam3D({
  from,
  to,
  color,
}: {
  from: [number, number, number]
  to: [number, number, number]
  color: string
}) {
  const { mid, len, quat } = useMemo(() => {
    const a = new THREE.Vector3(from[0], from[1], from[2])
    const b = new THREE.Vector3(to[0], to[1], to[2])
    const diff = new THREE.Vector3().subVectors(b, a)
    const length = Math.max(0.05, diff.length())
    const center = new THREE.Vector3().addVectors(a, b).multiplyScalar(0.5)
    const q = new THREE.Quaternion().setFromUnitVectors(
      TRACER_UP_AXIS,
      diff.normalize(),
    )
    return {
      mid: [center.x, center.y, center.z] as [number, number, number],
      len: length,
      quat: q,
    }
  }, [from, to])

  return (
    <mesh position={mid} quaternion={quat} raycast={noopRaycast}>
      <cylinderGeometry args={[0.008, 0.008, len, 6]} />
      <meshBasicMaterial color={color} transparent opacity={0.86} />
    </mesh>
  )
}

export type RangeGameModeId =
  | 'precision'
  | 'steel-challenge'
  | 'tactical-qual'
  | 'skeet-drones'

export type WeaponGripMode = 'one-hand' | 'two-hand'

export interface RangeWeaponSpec {
  id: RangeWeaponId
  name: string
  shortName: string
  categoryLabel: string
  gripMode: WeaponGripMode
  caliber: string
  magCapacity: number
  fireRateRpm: number
  automatic: boolean
  burstCount: number
  pellets: number
  baseSpreadRad: number
  recoilKick: number
  armorDamage: number
  reloadSeconds: number
  accentColor: string
  bodyColor: string
  barrelLength: number
  hasScope: boolean
}

export const RANGE_WEAPONS: readonly RangeWeaponSpec[] = [
  // =========================================================================
  // 1-CONTROLLER CONFIGURATION: PISTOLS & HANDGUNS (gripMode: 'one-hand')
  // =========================================================================
  {
    id: 'pistol-9mm',
    name: 'M9 Tactical 9mm Service Pistol',
    shortName: '9mm Pistol',
    categoryLabel: '1-CONTROLLER HANDGUN',
    gripMode: 'one-hand',
    caliber: '9×19mm Parabellum',
    magCapacity: 15,
    fireRateRpm: 420,
    automatic: false,
    burstCount: 1,
    pellets: 1,
    baseSpreadRad: 0.004,
    recoilKick: 0.035,
    armorDamage: 1,
    reloadSeconds: 1.15,
    accentColor: '#38BDF8',
    bodyColor: '#1E293B',
    barrelLength: 0.22,
    hasScope: false,
  },
  {
    id: 'revolver-44',
    name: '.44 Magnum Heavy Bull-Barrel Revolver',
    shortName: '.44 Magnum',
    categoryLabel: '1-CONTROLLER REVOLVER',
    gripMode: 'one-hand',
    caliber: '.44 Rem Magnum',
    magCapacity: 6,
    fireRateRpm: 190,
    automatic: false,
    burstCount: 1,
    pellets: 1,
    baseSpreadRad: 0.003,
    recoilKick: 0.085,
    armorDamage: 2,
    reloadSeconds: 1.55,
    accentColor: '#F59E0B',
    bodyColor: '#334155',
    barrelLength: 0.28,
    hasScope: false,
  },
  {
    id: 'pistol-burst',
    name: 'VX-9 Compensated 3-Round Burst Pistol',
    shortName: 'VX-9 Burst',
    categoryLabel: '1-CONTROLLER MACHINE PISTOL',
    gripMode: 'one-hand',
    caliber: '9×19mm +P',
    magCapacity: 24,
    fireRateRpm: 900,
    automatic: false,
    burstCount: 3,
    pellets: 1,
    baseSpreadRad: 0.009,
    recoilKick: 0.028,
    armorDamage: 1,
    reloadSeconds: 1.25,
    accentColor: '#A855F7',
    bodyColor: '#1E1B4B',
    barrelLength: 0.25,
    hasScope: false,
  },

  // =========================================================================
  // 2-CONTROLLER CONFIGURATION: RIFLES & LONG GUNS (gripMode: 'two-hand')
  // =========================================================================
  {
    id: 'rifle-carbine',
    name: 'M4A1 Tactical Assault Carbine',
    shortName: 'M4 Carbine',
    categoryLabel: '2-CONTROLLER CARBINE RIFLE',
    gripMode: 'two-hand',
    caliber: '5.56×45mm NATO',
    magCapacity: 30,
    fireRateRpm: 680,
    automatic: true,
    burstCount: 1,
    pellets: 1,
    baseSpreadRad: 0.0035,
    recoilKick: 0.032,
    armorDamage: 1,
    reloadSeconds: 1.4,
    accentColor: '#22C55E',
    bodyColor: '#1E293B',
    barrelLength: 0.56,
    hasScope: false,
  },
  {
    id: 'shotgun-12g',
    name: 'M870 Tactical 12-Gauge Pump Shotgun',
    shortName: '12G Shotgun',
    categoryLabel: '2-CONTROLLER PUMP LONG GUN',
    gripMode: 'two-hand',
    caliber: '12-Gauge 00 Buck (8 Pellets)',
    magCapacity: 8,
    fireRateRpm: 115,
    automatic: false,
    burstCount: 1,
    pellets: 8,
    baseSpreadRad: 0.034,
    recoilKick: 0.095,
    armorDamage: 2,
    reloadSeconds: 1.65,
    accentColor: '#EF4444',
    bodyColor: '#27272A',
    barrelLength: 0.62,
    hasScope: false,
  },
  {
    id: 'sniper-bolt',
    name: 'SR-25 Long-Range Precision Marksman Rifle',
    shortName: 'SR-25 Sniper',
    categoryLabel: '2-CONTROLLER MARKSMAN RIFLE',
    gripMode: 'two-hand',
    caliber: '7.62×51mm NATO Match',
    magCapacity: 8,
    fireRateRpm: 150,
    automatic: false,
    burstCount: 1,
    pellets: 1,
    baseSpreadRad: 0.0008,
    recoilKick: 0.068,
    armorDamage: 3,
    reloadSeconds: 1.5,
    accentColor: '#F43F5E',
    bodyColor: '#0F172A',
    barrelLength: 0.72,
    hasScope: true,
  },
]

interface BulletHoleDecal {
  id: string
  laneIndex: number
  localZ: number
  localY: number
  color: string
  points: number
}

interface SteelTargetPlate {
  id: string
  kind: 'knockdown' | 'dueling-paddle'
  xDist: number // meters downrange from firing line (x = -6.4 - xDist)
  zOffset: number // offset from rangeZ
  baseY: number
  radius: number
  down: boolean
  paddleSide: 'left' | 'right'
  lastHitAt: number
}

interface TacticalSilhouetteTarget {
  id: string
  kind: 'threat' | 'armored' | 'no-shoot'
  xDist: number
  baseZOffset: number
  moveAmpZ: number
  moveSpeed: number
  phase: number
  hp: number
  maxHp: number
  active: boolean
  respawnAt: number
}

interface AerialTarget {
  id: string
  kind: 'clay' | 'drone'
  pos: [number, number, number]
  vel: [number, number, number]
  radius: number
  active: boolean
}

interface BallisticTracer {
  id: string
  from: [number, number, number]
  to: [number, number, number]
  color: string
  createdAt: number
}

interface ImpactPopup {
  id: string
  pos: [number, number, number]
  text: string
  color: string
  createdAt: number
}

function createInitialSteelTargets(): SteelTargetPlate[] {
  return [
    // Front Row (12m downrange): 5 Knockdown AR500 Steel Plates
    { id: 'steel-1', kind: 'knockdown', xDist: 12, zOffset: -2.8, baseY: 1.28, radius: 0.21, down: false, paddleSide: 'left', lastHitAt: 0 },
    { id: 'steel-2', kind: 'knockdown', xDist: 12, zOffset: -1.6, baseY: 1.28, radius: 0.21, down: false, paddleSide: 'left', lastHitAt: 0 },
    { id: 'steel-3', kind: 'knockdown', xDist: 12, zOffset: -0.4, baseY: 1.28, radius: 0.21, down: false, paddleSide: 'left', lastHitAt: 0 },
    { id: 'steel-4', kind: 'knockdown', xDist: 12, zOffset: 1.6, baseY: 1.28, radius: 0.21, down: false, paddleSide: 'left', lastHitAt: 0 },
    { id: 'steel-5', kind: 'knockdown', xDist: 12, zOffset: 2.8, baseY: 1.28, radius: 0.21, down: false, paddleSide: 'left', lastHitAt: 0 },

    // Center Dueling Tree at 16m (zOffset = +0.6): 6 Flip Paddles
    { id: 'duel-1', kind: 'dueling-paddle', xDist: 16, zOffset: 0.6, baseY: 1.05, radius: 0.16, down: false, paddleSide: 'left', lastHitAt: 0 },
    { id: 'duel-2', kind: 'dueling-paddle', xDist: 16, zOffset: 0.6, baseY: 1.32, radius: 0.16, down: false, paddleSide: 'right', lastHitAt: 0 },
    { id: 'duel-3', kind: 'dueling-paddle', xDist: 16, zOffset: 0.6, baseY: 1.59, radius: 0.16, down: false, paddleSide: 'left', lastHitAt: 0 },
    { id: 'duel-4', kind: 'dueling-paddle', xDist: 16, zOffset: 0.6, baseY: 1.86, radius: 0.16, down: false, paddleSide: 'right', lastHitAt: 0 },
    { id: 'duel-5', kind: 'dueling-paddle', xDist: 16, zOffset: 0.6, baseY: 2.13, radius: 0.16, down: false, paddleSide: 'left', lastHitAt: 0 },

    // Long-Range Row (24m downrange): 4 Heavy Gong Plates
    { id: 'gong-1', kind: 'knockdown', xDist: 24, zOffset: -2.4, baseY: 1.55, radius: 0.25, down: false, paddleSide: 'left', lastHitAt: 0 },
    { id: 'gong-2', kind: 'knockdown', xDist: 24, zOffset: -0.8, baseY: 1.55, radius: 0.25, down: false, paddleSide: 'left', lastHitAt: 0 },
    { id: 'gong-3', kind: 'knockdown', xDist: 24, zOffset: 1.2, baseY: 1.55, radius: 0.25, down: false, paddleSide: 'left', lastHitAt: 0 },
    { id: 'gong-4', kind: 'knockdown', xDist: 24, zOffset: 2.6, baseY: 1.55, radius: 0.25, down: false, paddleSide: 'left', lastHitAt: 0 },
  ]
}

function createInitialTacticalTargets(): TacticalSilhouetteTarget[] {
  return [
    { id: 'tac-1', kind: 'threat', xDist: 10, baseZOffset: -2.6, moveAmpZ: 0.55, moveSpeed: 1.2, phase: 0.2, hp: 1, maxHp: 1, active: true, respawnAt: 0 },
    { id: 'tac-2', kind: 'threat', xDist: 13, baseZOffset: 0.4, moveAmpZ: 0.75, moveSpeed: 1.45, phase: 1.4, hp: 1, maxHp: 1, active: true, respawnAt: 0 },
    { id: 'tac-3', kind: 'no-shoot', xDist: 15, baseZOffset: -0.9, moveAmpZ: 0.45, moveSpeed: 1.1, phase: 2.5, hp: 1, maxHp: 1, active: true, respawnAt: 0 },
    { id: 'tac-4', kind: 'armored', xDist: 19, baseZOffset: 2.1, moveAmpZ: 0.65, moveSpeed: 0.95, phase: 0.8, hp: 2, maxHp: 2, active: true, respawnAt: 0 },
    { id: 'tac-5', kind: 'threat', xDist: 24, baseZOffset: -1.8, moveAmpZ: 0.85, moveSpeed: 1.3, phase: 3.1, hp: 1, maxHp: 1, active: true, respawnAt: 0 },
    { id: 'tac-6', kind: 'armored', xDist: 30, baseZOffset: 1.1, moveAmpZ: 0.6, moveSpeed: 0.85, phase: 4.2, hp: 2, maxHp: 2, active: true, respawnAt: 0 },
  ]
}

const AERIAL_TARGET_SPECS: ReadonlyArray<{
  id: string
  kind: 'clay' | 'drone'
  initialPosOffset: [number, number, number]
  initialVel: [number, number, number]
  radius: number
}> = [
  {
    id: 'clay-1',
    kind: 'clay',
    initialPosOffset: [-11.65, 2.2, -2.2],
    initialVel: [-3.2, 1.4, 2.4],
    radius: 0.34,
  },
  {
    id: 'drone-1',
    kind: 'drone',
    initialPosOffset: [-17.65, 2.5, 1.8],
    initialVel: [2.4, 0.6, -2.8],
    radius: 0.38,
  },
  {
    id: 'clay-2',
    kind: 'clay',
    initialPosOffset: [-8.65, 1.9, 0.5],
    initialVel: [-4.0, 1.8, -2.1],
    radius: 0.34,
  },
]

function createInitialAerialTargets(
  firingLineX: number,
  rangeZ: number,
): AerialTarget[] {
  return AERIAL_TARGET_SPECS.map((spec) => ({
    id: spec.id,
    kind: spec.kind,
    pos: [
      firingLineX + spec.initialPosOffset[0],
      spec.initialPosOffset[1],
      rangeZ + spec.initialPosOffset[2],
    ],
    vel: [...spec.initialVel] as [number, number, number],
    radius: spec.radius,
    active: true,
  }))
}

function pulseControllerHaptics(
  controller: XRControllerState | undefined,
  intensity: number,
  durationMs: number,
): void {
  triggerXRHapticPulse(controller, intensity, durationMs)
}

interface RangeButton3DProps {
  label: string
  sublabel?: string
  position: [number, number, number]
  width?: number
  height?: number
  active?: boolean
  accent?: string
  fontSize?: number
  onClick: () => void
}

function RangeButton3D({
  label,
  sublabel,
  position,
  width = 0.34,
  height = 0.085,
  active = false,
  accent = '#EF4444',
  fontSize = 0.025,
  onClick,
}: RangeButton3DProps) {
  const [hovered, setHovered] = useState(false)
  const bg = active ? accent : hovered ? '#334155' : '#0F172A'
  const fg = active ? '#040810' : '#F8FAFC'
  const hoverId = `range-btn-${label}`

  useEffect(() => {
    return () => setSpatialUiHovered(false, hoverId)
  }, [hoverId])

  return (
    <group
      position={position}
      pointerEventsType={{ deny: 'grab' }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        setSpatialUiHovered(true, hoverId)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        setSpatialUiHovered(false, hoverId)
      }}
      onClick={(e) => {
        e.stopPropagation()
        playSpatialUiFeedback('ui-click')
        onClick()
      }}
    >
      <RoundedBox args={[width, height, 0.015]} radius={0.012} smoothness={2}>
        <meshBasicMaterial color={bg} />
      </RoundedBox>
      <Text
        position={[0, sublabel ? 0.012 : 0, 0.01]}
        fontSize={fontSize}
        color={fg}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      {sublabel && (
        <Text
          position={[0, -0.018, 0.01]}
          fontSize={fontSize * 0.76}
          color={active ? '#0F172A' : '#94A3B8'}
          anchorX="center"
          anchorY="middle"
        >
          {sublabel}
        </Text>
      )}
    </group>
  )
}

/**
 * 3D Procedural Gun Mesh for both the Armory Rack and Active Handheld / Viewmodel Rendering.
 * Clearly distinguishes 1-Controller Pistols/Revolvers from 2-Controller Rifles/Shotguns/Snipers,
 * including holographic sights, foregrips, magazines, cylinders, and muzzle flash!
 */
function WeaponModel3D({
  spec,
  scale = 1,
  showMuzzleFlash = false,
  twoHandLocked = false,
  isReloading = false,
  laserEnabled = true,
  laserLength = 0,
}: {
  spec: RangeWeaponSpec
  scale?: number
  showMuzzleFlash?: boolean
  twoHandLocked?: boolean
  isReloading?: boolean
  laserEnabled?: boolean
  laserLength?: number
}) {
  const isTwoHand = spec.gripMode === 'two-hand'
  const barrelZ = -spec.barrelLength

  return (
    <group scale={scale} rotation={[isReloading ? -0.42 : 0, 0, isReloading ? 0.35 : 0]}>
      {/* Rear Pistol Grip (Primary Controller Anchor at [0, -0.05, 0.02]) */}
      <mesh position={[0, -0.055, 0.025]} rotation={[0.26, 0, 0]} raycast={noopRaycast}>
        <boxGeometry args={[0.036, 0.11, 0.048]} />
        <meshStandardMaterial color="#0F172A" roughness={0.65} metalness={0.25} />
      </mesh>

      {/* Main Receiver / Slide */}
      <RoundedBox
        args={[0.044, 0.052, isTwoHand ? 0.36 : 0.21]}
        position={[0, 0.012, isTwoHand ? -0.08 : -0.05]}
        radius={0.008}
        raycast={noopRaycast}
      >
        <meshStandardMaterial
          color={spec.bodyColor}
          metalness={0.72}
          roughness={0.28}
        />
      </RoundedBox>

      {/* Caliber / Accent Stripe along Receiver */}
      <mesh position={[0, 0.039, isTwoHand ? -0.08 : -0.05]} raycast={noopRaycast}>
        <boxGeometry args={[0.046, 0.006, isTwoHand ? 0.32 : 0.18]} />
        <meshBasicMaterial color={spec.accentColor} />
      </mesh>

      {/* Revolver 6-Shot Fluted Cylinder */}
      {spec.id === 'revolver-44' && (
        <mesh
          position={[0, 0.008, -0.035]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <cylinderGeometry args={[0.028, 0.028, 0.052, 12]} />
          <meshStandardMaterial color="#94A3B8" metalness={0.88} roughness={0.18} />
        </mesh>
      )}

      {/* Extended Magazine (for Carbine, Sniper, Machine Pistol) */}
      {(spec.id === 'rifle-carbine' ||
        spec.id === 'sniper-bolt' ||
        spec.id === 'pistol-burst') && (
        <mesh
          position={[
            0,
            -0.065,
            spec.id === 'pistol-burst' ? -0.055 : -0.12,
          ]}
          rotation={[-0.14, 0, 0]}
          raycast={noopRaycast}
        >
          <boxGeometry
            args={[
              0.028,
              spec.id === 'sniper-bolt' ? 0.095 : 0.135,
              0.048,
            ]}
          />
          <meshStandardMaterial color="#1E293B" metalness={0.6} roughness={0.4} />
        </mesh>
      )}

      {/* Long-Gun Buttstock + Forend Barrel Handguard + 2-Controller Front Grip */}
      {isTwoHand && (
        <>
          {/* Tactical Shoulder Stock */}
          <RoundedBox
            args={[0.04, 0.085, 0.22]}
            position={[0, -0.008, 0.18]}
            radius={0.008}
            raycast={noopRaycast}
          >
            <meshStandardMaterial color="#0F172A" roughness={0.6} metalness={0.3} />
          </RoundedBox>

          {/* Front Handguard / Rail Shroud */}
          <RoundedBox
            args={[0.046, 0.048, spec.barrelLength * 0.62]}
            position={[0, 0.008, -0.26 - spec.barrelLength * 0.22]}
            radius={0.008}
            raycast={noopRaycast}
          >
            <meshStandardMaterial color="#334155" metalness={0.68} roughness={0.32} />
          </RoundedBox>

          {/* Secondary Controller Foregrip / Pump Handle (2-Hand Anchor Zone!) */}
          <mesh
            position={[0, -0.042, -0.34]}
            rotation={[spec.id === 'shotgun-12g' ? Math.PI / 2 : 0.12, 0, 0]}
            raycast={noopRaycast}
          >
            <cylinderGeometry
              args={
                spec.id === 'shotgun-12g'
                  ? [0.028, 0.028, 0.18, 12]
                  : [0.016, 0.018, 0.09, 10]
              }
            />
            <meshBasicMaterial
              color={twoHandLocked ? '#22C55E' : spec.accentColor}
            />
          </mesh>
        </>
      )}

      {/* Precision Steel Barrel */}
      <mesh
        position={[0, 0.016, barrelZ / 2 - 0.04]}
        rotation={[Math.PI / 2, 0, 0]}
        raycast={noopRaycast}
      >
        <cylinderGeometry
          args={[
            spec.id === 'shotgun-12g' ? 0.016 : 0.011,
            spec.id === 'shotgun-12g' ? 0.016 : 0.012,
            spec.barrelLength,
            12,
          ]}
        />
        <meshStandardMaterial color="#64748B" metalness={0.85} roughness={0.2} />
      </mesh>

      {/* Holographic Reflex Sight or Sniper Magnified Scope */}
      {spec.hasScope ? (
        <group position={[0, 0.058, -0.1]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} raycast={noopRaycast}>
            <cylinderGeometry args={[0.022, 0.02, 0.26, 12]} />
            <meshStandardMaterial color="#0F172A" metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0, 0.131]} raycast={noopRaycast}>
            <ringGeometry args={[0.006, 0.018, 16]} />
            <meshBasicMaterial color={twoHandLocked ? '#22C55E' : '#F43F5E'} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0.132]} raycast={noopRaycast}>
            <circleGeometry args={[0.0025, 10]} />
            <meshBasicMaterial color="#FDE047" side={THREE.DoubleSide} />
          </mesh>
        </group>
      ) : (
        <group position={[0, 0.048, isTwoHand ? -0.09 : -0.04]}>
          <mesh raycast={noopRaycast}>
            <boxGeometry args={[0.032, 0.028, 0.042]} />
            <meshStandardMaterial color="#0F172A" metalness={0.7} roughness={0.3} />
          </mesh>
          {/* Glowing Reflex Reticle Dot */}
          <mesh position={[0, 0.004, 0.022]} raycast={noopRaycast}>
            <ringGeometry args={[0.005, 0.009, 12]} />
            <meshBasicMaterial
              color={isTwoHand && twoHandLocked ? '#22C55E' : spec.accentColor}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {/* Tactical Under-Barrel Laser Sight Beam */}
      {laserEnabled && laserLength > 0.5 && (
        <mesh
          position={[0, -0.004, barrelZ - laserLength / 2]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <cylinderGeometry args={[0.0018, 0.0018, laserLength, 6]} />
          <meshBasicMaterial
            color={isTwoHand && twoHandLocked ? '#22C55E' : spec.accentColor}
            transparent
            opacity={0.55}
          />
        </mesh>
      )}

      {/* Muzzle Flash Starburst */}
      {showMuzzleFlash && (
        <group position={[0, 0.016, barrelZ - 0.06]}>
          <mesh rotation={[Math.PI / 2, 0, 0]} raycast={noopRaycast}>
            <coneGeometry args={[0.055, 0.18, 7]} />
            <meshBasicMaterial color="#FEF08A" />
          </mesh>
          <mesh raycast={noopRaycast}>
            <sphereGeometry args={[0.042, 8, 8]} />
            <meshBasicMaterial color="#F97316" />
          </mesh>
        </group>
      )}
    </group>
  )
}

export interface ShootingRangeRoom3DProps {
  wingLayout: ExpansionWingLayout
  lighting: RoomLightingConfig
  computedSeats: ComputedSeat[]
  localSeatId?: string
  localDisplayName: string
  participants: ParticipantProfile[]
  visible?: boolean
  isActiveRoom?: boolean
  onSelectSeat: (seatId: string) => void
  onTeleportToFloor?: (point: [number, number, number]) => void
  onRecordArcadeScore?: (
    game: 'arcade-hoops' | 'arcade-skeeball' | 'arcade-retro',
    score: number,
    highlight: string,
  ) => void
}

export function ShootingRangeRoom3D({
  wingLayout,
  lighting,
  computedSeats,
  localSeatId,
  localDisplayName,
  participants,
  visible = true,
  isActiveRoom = false,
  onSelectSeat,
  onTeleportToFloor,
  onRecordArcadeScore,
}: ShootingRangeRoom3DProps) {
  const { gl, camera } = useThree()
  const xrSession = useXR((s) => s.session)
  const xrOrigin = useXR((s) => s.origin)
  const xrOriginRefSpace = useXR((s) => s.originReferenceSpace)
  const inVR = Boolean(xrSession)

  const rightController = useXRInputSourceState('controller', 'right')
  const leftController = useXRInputSourceState('controller', 'left')

  const rangeZ = wingLayout.shootingRangeCenter[2] // z0 + 9.38 (West end of Second Hallway)
  const firingLineX = -18.35
  const emissiveBoost = Math.max(0.3, Math.min(1.5, lighting.brightness || 1.0))

  // =========================================================================
  // Weapon & Range Mode State
  // =========================================================================
  const [equippedWeaponId, setEquippedWeaponId] =
    useState<RangeWeaponId>('pistol-9mm')
  const equippedWeapon = useMemo(
    () =>
      RANGE_WEAPONS.find((w) => w.id === equippedWeaponId) ?? RANGE_WEAPONS[0],
    [equippedWeaponId],
  )

  const [ammoInMag, setAmmoInMag] = useState<number>(15)
  const [isReloading, setIsReloading] = useState(false)
  const [shotgunNeedsPump, setShotgunNeedsPump] = useState(false)
  const [primaryHand, setPrimaryHand] = useState<'right' | 'left'>('right')
  const [desktopTwoHandBraced, setDesktopTwoHandBraced] = useState(true)
  const [vrTwoHandLocked, setVrTwoHandLocked] = useState(false)
  const [laserEnabled, setLaserEnabled] = useState(true)
  const [audioMuted, setAudioMuted] = useState(() =>
    shootingRangeAudio.isMuted(),
  )

  const [rangeMode, setRangeMode] = useState<RangeGameModeId>('precision')
  const [carrierDistanceM, setCarrierDistanceM] = useState<10 | 20 | 32>(20)

  // Live Telemetry & Scoring State
  const [score, setScore] = useState(0)
  const [highScore, setHighScore] = useState(0)
  const [highScoreHolder, setHighScoreHolder] = useState(localDisplayName || 'Operator')
  const [shotsFired, setShotsFired] = useState(0)
  const [shotsHit, setShotsHit] = useState(0)
  const [streak, setStreak] = useState(0)
  const [bestStreak, setBestStreak] = useState(0)
  const [lastShotBanner, setLastShotBanner] = useState(
    'SELECT A 1-HAND PISTOL OR 2-HAND RIFLE & FIRE DOWNRANGE',
  )
  const [qualTimeRemaining, setQualTimeRemaining] = useState(60)
  const [qualRunning, setQualRunning] = useState(false)

  // Downrange Targets & Visual FX State
  const [bulletHoles, setBulletHoles] = useState<BulletHoleDecal[]>([])
  const [steelTargets, setSteelTargets] = useState<SteelTargetPlate[]>(() =>
    createInitialSteelTargets(),
  )
  const [tacticalTargets, setTacticalTargets] = useState<
    TacticalSilhouetteTarget[]
  >(() => createInitialTacticalTargets())
  const aerialTargetsRef = useRef<AerialTarget[]>(
    createInitialAerialTargets(firingLineX, rangeZ),
  )
  const [hoveredArmoryWeaponId, setHoveredArmoryWeaponId] =
    useState<RangeWeaponId | null>(null)
  const [hoveredBoothSeatId, setHoveredBoothSeatId] = useState<string | null>(
    null,
  )
  const [tracers, setTracers] = useState<BallisticTracer[]>([])
  const [popups, setPopups] = useState<ImpactPopup[]>([])
  const [muzzleFlashOn, setMuzzleFlashOn] = useState(false)

  // Refs for 72Hz/90Hz VR & Ballistic Loop
  const weaponGroupRef = useRef<THREE.Group>(null)
  const carrierGroupRefs = useRef<Array<THREE.Group | null>>([
    null,
    null,
    null,
    null,
  ])
  const tacticalGroupRefs = useRef<Record<string, THREE.Group | null>>({})
  const aerialGroupRefs = useRef<Record<string, THREE.Group | null>>({})

  const ammoRef = useRef(ammoInMag)
  const isReloadingRef = useRef(isReloading)
  const shotgunNeedsPumpRef = useRef(shotgunNeedsPump)
  const equippedWeaponRef = useRef(equippedWeapon)
  const rangeModeRef = useRef(rangeMode)
  const carrierDistanceRef = useRef(carrierDistanceM)
  const scoreRef = useRef(score)
  const highScoreRef = useRef(highScore)
  const streakRef = useRef(streak)
  const bestStreakRef = useRef(bestStreak)
  const steelTargetsRef = useRef(steelTargets)
  const twoHandActiveRef = useRef(true)

  useEffect(() => {
    ammoRef.current = ammoInMag
    isReloadingRef.current = isReloading
    shotgunNeedsPumpRef.current = shotgunNeedsPump
    equippedWeaponRef.current = equippedWeapon
    rangeModeRef.current = rangeMode
    carrierDistanceRef.current = carrierDistanceM
    scoreRef.current = score
    highScoreRef.current = highScore
    streakRef.current = streak
    bestStreakRef.current = bestStreak
    steelTargetsRef.current = steelTargets
  }, [
    ammoInMag,
    bestStreak,
    carrierDistanceM,
    equippedWeapon,
    highScore,
    isReloading,
    rangeMode,
    score,
    shotgunNeedsPump,
    steelTargets,
    streak,
  ])

  const lastFireTimeRef = useRef(0)
  const recoilOffsetRef = useRef(0)
  const recoilPitchRef = useRef(0)
  const reloadTimerRef = useRef<number | null>(null)
  const muzzleTimerRef = useRef<number | null>(null)
  const burstTimersRef = useRef<number[]>([])
  const prevTriggerPressedRef = useRef(false)
  const prevReloadPressedRef = useRef(false)
  const prevSwapPressedRef = useRef(false)
  const prevHandDistRef = useRef<number | null>(null)
  const shotgunPumpArmedRef = useRef(false)

  // Desktop aim point downrange (defaults to Lane 2 bullseye at 20m)
  const desktopAimWorldRef = useRef<THREE.Vector3>(
    new THREE.Vector3(firingLineX - 20, 1.52, rangeZ - 0.9),
  )

  // Pre-allocated scratch math objects (zero GC allocations per frame)
  const scratchPrimaryPos = useMemo(() => new THREE.Vector3(), [])
  const scratchPrimaryQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchSecondaryPos = useMemo(() => new THREE.Vector3(), [])
  const scratchSecondaryQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchBarrelDir = useMemo(() => new THREE.Vector3(), [])
  const scratchNegBarrelDir = useMemo(() => new THREE.Vector3(), [])
  const scratchUpVec = useMemo(() => new THREE.Vector3(), [])
  const scratchRightVec = useMemo(() => new THREE.Vector3(), [])
  const scratchRotMat = useMemo(() => new THREE.Matrix4(), [])
  const scratchRecoilQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchMuzzleWorld = useMemo(() => new THREE.Vector3(), [])
  const scratchPelletDir = useMemo(() => new THREE.Vector3(), [])

  const boothSeats = useMemo(
    () => computedSeats.filter((s) => s.roomWing === 'shooting-range'),
    [computedSeats],
  )
  const seatOccupants = useMemo(() => {
    const map = new Map<string, ParticipantProfile>()
    for (const p of participants) {
      if (p.seatId) map.set(p.seatId, p)
    }
    return map
  }, [participants])

  // Select a weapon and fill magazine
  const handleSelectWeapon = useCallback((weaponId: RangeWeaponId) => {
    if (reloadTimerRef.current) {
      window.clearTimeout(reloadTimerRef.current)
      reloadTimerRef.current = null
    }
    for (const tid of burstTimersRef.current) {
      window.clearTimeout(tid)
    }
    burstTimersRef.current = []
    const spec =
      RANGE_WEAPONS.find((w) => w.id === weaponId) ?? RANGE_WEAPONS[0]
    setEquippedWeaponId(spec.id)
    setAmmoInMag(spec.magCapacity)
    setIsReloading(false)
    setShotgunNeedsPump(false)
    shootingRangeAudio.playReload()
    setLastShotBanner(
      `EQUIPPED ${spec.name.toUpperCase()} (${spec.gripMode === 'two-hand' ? '2-CONTROLLER RIFLE' : '1-CONTROLLER HANDGUN'})`,
    )
  }, [])

  // Trigger tactical reload
  const handleReload = useCallback(() => {
    if (isReloadingRef.current) return
    const spec = equippedWeaponRef.current
    if (ammoRef.current >= spec.magCapacity && !shotgunNeedsPumpRef.current) {
      return
    }
    if (shotgunNeedsPumpRef.current && ammoRef.current > 0) {
      setShotgunNeedsPump(false)
      shootingRangeAudio.playPumpAction()
      setLastShotBanner('12-GAUGE PUMP RACKED · SHELL CHAMBERED')
      return
    }
    setIsReloading(true)
    shootingRangeAudio.playReload()
    setLastShotBanner(`RELOADING ${spec.shortName.toUpperCase()}...`)
    if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current)
    reloadTimerRef.current = window.setTimeout(() => {
      setAmmoInMag(spec.magCapacity)
      setIsReloading(false)
      setShotgunNeedsPump(false)
      setLastShotBanner(`${spec.shortName.toUpperCase()} RELOADED (${spec.magCapacity} RDS)`)
    }, spec.reloadSeconds * 1000)
  }, [])

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) window.clearTimeout(reloadTimerRef.current)
      if (muzzleTimerRef.current) window.clearTimeout(muzzleTimerRef.current)
      for (const tid of burstTimersRef.current) {
        window.clearTimeout(tid)
      }
      burstTimersRef.current = []
    }
  }, [])

  // 60-Second Tactical Qualification Course Countdown Timer
  useEffect(() => {
    if (!qualRunning) return
    const interval = window.setInterval(() => {
      setQualTimeRemaining((prev) => {
        if (prev <= 1) {
          setQualRunning(false)
          shootingRangeAudio.playRangeBuzzer('end')
          const curScore = scoreRef.current
          const rating =
            curScore >= 2500
              ? 'TIER-1 OPERATOR'
              : curScore >= 1600
                ? 'EXPERT MARKSMAN'
                : curScore >= 900
                  ? 'SHARPSHOOTER'
                  : 'QUALIFIED'
          setLastShotBanner(
            `QUALIFICATION COMPLETE! SCORE: ${curScore} · RATING: ${rating}`,
          )
          if (curScore > 0 && onRecordArcadeScore) {
            onRecordArcadeScore(
              'arcade-retro',
              curScore,
              `🎯 Range Qualification (${rating})`,
            )
          }
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => window.clearInterval(interval)
  }, [qualRunning, onRecordArcadeScore])

  // Evaluate a single ballistic ray against the active range targets
  const evaluatePelletRay = useCallback(
    (
      origin: THREE.Vector3,
      dir: THREE.Vector3,
      spec: RangeWeaponSpec,
      nowMs: number,
    ): {
      hit: boolean
      points: number
      banner: string
      endPoint: [number, number, number]
      color: string
    } => {
      const mode = rangeModeRef.current
      const laneOffsets = [-2.7, -0.9, 0.9, 2.7]

      // Ensure ray points downrange (-X)
      if (dir.x >= -0.05) {
        return {
          hit: false,
          points: 0,
          banner: 'SHOT OFF-AXIS',
          endPoint: [
            origin.x + dir.x * 28,
            origin.y + dir.y * 28,
            origin.z + dir.z * 28,
          ],
          color: '#64748B',
        }
      }

      // ---------------------------------------------------------------------
      // MODE 1: MOTORIZED PRECISION BULLSEYE CARRIERS (4 Lanes at carrierDistanceM)
      // ---------------------------------------------------------------------
      if (mode === 'precision') {
        const targetX = firingLineX - carrierDistanceRef.current
        const t = (targetX - origin.x) / dir.x
        if (t > 0.5 && t < 45) {
          const hitY = origin.y + dir.y * t
          const hitZ = origin.z + dir.z * t

          // Find closest lane carrier (width 0.78m, height 1.08m centered at y = 1.56)
          let matchedLane = -1
          let minDz = Infinity
          laneOffsets.forEach((off, idx) => {
            const lz = rangeZ + off
            const dz = Math.abs(hitZ - lz)
            if (dz < minDz) {
              minDz = dz
              matchedLane = idx
            }
          })

          if (
            matchedLane >= 0 &&
            minDz <= 0.38 &&
            hitY >= 1.02 &&
            hitY <= 2.08
          ) {
            const laneCenterZ = rangeZ + laneOffsets[matchedLane]
            const localZ = hitZ - laneCenterZ
            const localY = hitY - 1.56

            // Check Head Bullseye (centered at localY = +0.34, radius 0.10) vs Chest 10-Ring (centered at localY = -0.06, radius 0.30)
            const headDist = Math.hypot(localZ, localY - 0.34)
            const chestDist = Math.hypot(localZ, localY - -0.06)

            let basePts = 40
            let ringLabel = 'SILHOUETTE HIT'
            let decalColor = '#94A3B8'

            if (headDist <= 0.042) {
              basePts = 125
              ringLabel = '💀 HEADSHOT X-RING!'
              decalColor = '#FACC15'
              shootingRangeAudio.playTargetHit('head')
            } else if (headDist <= 0.095) {
              basePts = 100
              ringLabel = '🎯 HEADSHOT 10-RING'
              decalColor = '#F97316'
              shootingRangeAudio.playTargetHit('head')
            } else if (chestDist <= 0.045) {
              basePts = 110
              ringLabel = '🎯 10-X CENTER BULLSEYE!'
              decalColor = '#FACC15'
              shootingRangeAudio.playTargetHit('bullseye')
            } else if (chestDist <= 0.095) {
              basePts = 100
              ringLabel = '🎯 10-RING BULLSEYE'
              decalColor = '#EF4444'
              shootingRangeAudio.playTargetHit('bullseye')
            } else if (chestDist <= 0.155) {
              basePts = 85
              ringLabel = '9-RING HIT'
              decalColor = '#F59E0B'
              shootingRangeAudio.playTargetHit('body')
            } else if (chestDist <= 0.22) {
              basePts = 70
              ringLabel = '8-RING HIT'
              decalColor = '#38BDF8'
              shootingRangeAudio.playTargetHit('body')
            } else if (chestDist <= 0.3) {
              basePts = 55
              ringLabel = '7-RING HIT'
              decalColor = '#A855F7'
              shootingRangeAudio.playTargetHit('body')
            } else {
              shootingRangeAudio.playTargetHit('body')
            }

            const distBonus =
              carrierDistanceRef.current === 32
                ? 1.35
                : carrierDistanceRef.current === 20
                  ? 1.15
                  : 1.0
            const finalPts = Math.round(basePts * distBonus)

            setBulletHoles((prev) => [
              ...prev.slice(-47),
              {
                id: `hole-${nowMs}-${Math.random().toString(36).slice(2, 6)}`,
                laneIndex: matchedLane,
                localZ: Number(localZ.toFixed(3)),
                localY: Number(localY.toFixed(3)),
                color: decalColor,
                points: finalPts,
              },
            ])

            return {
              hit: true,
              points: finalPts,
              banner: `LANE ${matchedLane + 1} (${carrierDistanceRef.current}m) · ${ringLabel} (+${finalPts})`,
              endPoint: [targetX, hitY, hitZ],
              color: decalColor,
            }
          }
        }
      }

      // ---------------------------------------------------------------------
      // MODE 2: REACTIVE AR500 STEEL CHALLENGE & DUELING TREE
      // ---------------------------------------------------------------------
      if (mode === 'steel-challenge') {
        for (const st of steelTargetsRef.current) {
          if (st.kind === 'knockdown' && st.down) continue
          const plateX = firingLineX - st.xDist
          const t = (plateX - origin.x) / dir.x
          if (t <= 0.5 || t > 45) continue

          const hitY = origin.y + dir.y * t
          const hitZ = origin.z + dir.z * t
          const paddleOffsetZ =
            st.kind === 'dueling-paddle'
              ? st.paddleSide === 'left'
                ? -0.22
                : 0.22
              : 0
          const plateZ = rangeZ + st.zOffset + paddleOffsetZ
          const distToCenter = Math.hypot(hitY - st.baseY, hitZ - plateZ)

          if (distToCenter <= st.radius + 0.04) {
            shootingRangeAudio.playSteelPing(st.xDist)
            const pts =
              (st.xDist >= 22 ? 150 : 100) *
              (spec.armorDamage >= 2 ? 1.25 : 1)
            let roundedPts = Math.round(pts)

            const updated = steelTargetsRef.current.map((item) =>
              item.id === st.id
                ? {
                    ...item,
                    down: item.kind === 'knockdown' ? true : false,
                    paddleSide:
                      item.kind === 'dueling-paddle'
                        ? item.paddleSide === 'left'
                          ? ('right' as const)
                          : ('left' as const)
                        : item.paddleSide,
                    lastHitAt: nowMs,
                  }
                : item,
            )
            const allKnockdownsFlat = updated
              .filter((u) => u.kind === 'knockdown')
              .every((u) => u.down)
            const nextSteel = allKnockdownsFlat
              ? updated.map((u) => ({ ...u, down: false }))
              : updated
            steelTargetsRef.current = nextSteel
            setSteelTargets(nextSteel)

            if (allKnockdownsFlat) {
              roundedPts += 250
            }

            return {
              hit: true,
              points: roundedPts,
              banner: allKnockdownsFlat
                ? `🔔 ALL STEEL RACKS CLEARED! (+${roundedPts} PTS WITH BONUS · RACKS RESET)`
                : `🔔 AR500 STEEL PING AT ${st.xDist}m! (+${roundedPts})`,
              endPoint: [plateX, hitY, hitZ],
              color: '#38BDF8',
            }
          }
        }
      }

      // ---------------------------------------------------------------------
      // MODE 3: 60s TACTICAL QUALIFICATION COURSE (Pop-Up & Moving Silhouettes)
      // ---------------------------------------------------------------------
      if (mode === 'tactical-qual') {
        const elapsedSec = performance.now() / 1000
        for (const tac of tacticalTargets) {
          if (!tac.active) continue
          const targetX = firingLineX - tac.xDist
          const t = (targetX - origin.x) / dir.x
          if (t <= 0.5 || t > 45) continue

          const hitY = origin.y + dir.y * t
          const hitZ = origin.z + dir.z * t
          const currentZ =
            rangeZ +
            tac.baseZOffset +
            Math.sin(elapsedSec * tac.moveSpeed + tac.phase) * tac.moveAmpZ

          const localZ = hitZ - currentZ
          const localY = hitY - 1.48

          if (Math.abs(localZ) <= 0.34 && localY >= -0.48 && localY <= 0.52) {
            if (tac.kind === 'no-shoot') {
              shootingRangeAudio.playTargetHit('no-shoot')
              setTacticalTargets((prev) =>
                prev.map((item) =>
                  item.id === tac.id
                    ? { ...item, active: false, respawnAt: nowMs + 2800 }
                    : item,
                ),
              )
              return {
                hit: false,
                points: -150,
                banner: '⚠️ NO-SHOOT CIVILIAN TARGET HIT! (-150 PTS · STREAK RESET)',
                endPoint: [targetX, hitY, hitZ],
                color: '#EF4444',
              }
            }

            const isHead = localY >= 0.24 && Math.abs(localZ) <= 0.16
            const isAZone =
              !isHead && Math.abs(localZ) <= 0.15 && Math.abs(localY) <= 0.18
            const dmg = isHead ? 2 : spec.armorDamage
            const remainingHp = Math.max(0, tac.hp - dmg)

            shootingRangeAudio.playTargetHit(isHead ? 'head' : 'bullseye')

            setTacticalTargets((prev) =>
              prev.map((item) =>
                item.id === tac.id
                  ? remainingHp <= 0
                    ? {
                        ...item,
                        hp: item.maxHp,
                        active: false,
                        respawnAt: nowMs + 1900,
                      }
                    : { ...item, hp: remainingHp }
                  : item,
              ),
            )

            const basePts =
              remainingHp <= 0
                ? isHead
                  ? 200
                  : isAZone
                    ? 150
                    : 100
                : 65
            const label =
              remainingHp <= 0
                ? isHead
                  ? '💀 TACTICAL HEADSHOT DOWN!'
                  : isAZone
                    ? '🎯 A-ZONE CENTER MASS DOWN!'
                    : 'TARGET NEUTRALIZED'
                : '🛡️ ARMOR PLATE CRACKED (HIT AGAIN!)'

            return {
              hit: true,
              points: basePts,
              banner: `${label} (${tac.xDist}m · +${basePts})`,
              endPoint: [targetX, hitY, hitZ],
              color: isHead ? '#FACC15' : '#22C55E',
            }
          }
        }
      }

      // ---------------------------------------------------------------------
      // MODE 4: AERIAL CLAY PIGEONS & TACTICAL DRONE INTERCEPT
      // ---------------------------------------------------------------------
      if (mode === 'skeet-drones') {
        for (const air of aerialTargetsRef.current) {
          if (!air.active) continue
          const toTargetX = air.pos[0] - origin.x
          const toTargetY = air.pos[1] - origin.y
          const toTargetZ = air.pos[2] - origin.z
          const proj =
            toTargetX * dir.x + toTargetY * dir.y + toTargetZ * dir.z
          if (proj <= 0.5 || proj > 45) continue

          const closestX = origin.x + dir.x * proj
          const closestY = origin.y + dir.y * proj
          const closestZ = origin.z + dir.z * proj
          const dist = Math.hypot(
            closestX - air.pos[0],
            closestY - air.pos[1],
            closestZ - air.pos[2],
          )

          if (dist <= air.radius + 0.08) {
            shootingRangeAudio.playTargetHit('shatter')
            const pts = air.kind === 'drone' ? 250 : 175
            air.pos[0] = firingLineX - (12 + Math.random() * 16)
            air.pos[1] = 1.4 + Math.random() * 1.4
            air.pos[2] = rangeZ + (Math.random() - 0.5) * 6.2
            air.vel[0] = (Math.random() - 0.5) * 5.2
            air.vel[1] = 1.2 + Math.random() * 1.2
            air.vel[2] =
              (Math.random() > 0.5 ? 1 : -1) * (2.2 + Math.random() * 1.6)
            return {
              hit: true,
              points: pts,
              banner: `💥 ${air.kind === 'drone' ? 'TACTICAL DRONE' : 'CLAY PIGEON'} SHATTERED MID-AIR! (+${pts})`,
              endPoint: [closestX, closestY, closestZ],
              color: '#F97316',
            }
          }
        }
      }

      // Missed all targets -> impact downrange backstop wall at firingLineX - 34.85
      const backstopX = firingLineX - 34.85
      const backstopT = Math.max(2, (backstopX - origin.x) / dir.x)
      return {
        hit: false,
        points: 0,
        banner: 'DOWNRANGE BACKSTOP IMPACT',
        endPoint: [
          origin.x + dir.x * backstopT,
          Math.max(0.1, Math.min(3.7, origin.y + dir.y * backstopT)),
          Math.max(
            rangeZ - 4.2,
            Math.min(rangeZ + 4.2, origin.z + dir.z * backstopT),
          ),
        ],
        color: '#64748B',
      }
    },
    [firingLineX, rangeZ, tacticalTargets],
  )

  // Execute a single discharge (with single bullet or 8-pellet shotgun spread)
  const executeSingleShot = useCallback(
    (muzzleWorld: THREE.Vector3, barrelDir: THREE.Vector3) => {
      const spec = equippedWeaponRef.current
      if (isReloadingRef.current) return
      if (shotgunNeedsPumpRef.current) {
        shootingRangeAudio.playDryFire()
        setLastShotBanner('PUMP THE 12-GAUGE SHOTGUN FOREGRIP (OR PRESS RELOAD [R / A])!')
        return
      }
      if (ammoRef.current <= 0) {
        shootingRangeAudio.playDryFire()
        handleReload()
        return
      }

      const nowMs = Date.now()
      const nextAmmo = Math.max(0, ammoRef.current - 1)
      ammoRef.current = nextAmmo
      setAmmoInMag(nextAmmo)
      setShotsFired((prev) => prev + 1)

      if (spec.id === 'shotgun-12g') {
        shotgunNeedsPumpRef.current = true
        setShotgunNeedsPump(true)
      }

      // Sound, Muzzle Flash & Recoil
      shootingRangeAudio.playGunshot(spec.id)
      setMuzzleFlashOn(true)
      if (muzzleTimerRef.current) window.clearTimeout(muzzleTimerRef.current)
      muzzleTimerRef.current = window.setTimeout(
        () => setMuzzleFlashOn(false),
        60,
      )

      const stabilized =
        spec.gripMode === 'one-hand' || twoHandActiveRef.current
      const recoilScale = stabilized ? 1.0 : 2.15
      recoilOffsetRef.current = Math.min(
        0.14,
        recoilOffsetRef.current + spec.recoilKick * recoilScale,
      )
      recoilPitchRef.current = Math.min(
        0.28,
        recoilPitchRef.current + spec.recoilKick * 1.45 * recoilScale,
      )

      // Haptic feedback in VR
      if (inVR) {
        const primaryCtrl =
          primaryHand === 'right' ? rightController : leftController
        const secondaryCtrl =
          primaryHand === 'right' ? leftController : rightController
        pulseControllerHaptics(primaryCtrl, Math.min(1, spec.recoilKick * 11), 65)
        if (spec.gripMode === 'two-hand' && twoHandActiveRef.current) {
          pulseControllerHaptics(
            secondaryCtrl,
            Math.min(0.85, spec.recoilKick * 8),
            55,
          )
        }
      }

      // Fire all pellets for this discharge
      const spreadFactor =
        spec.baseSpreadRad * (stabilized ? (spec.gripMode === 'two-hand' ? 0.35 : 0.75) : 2.4)
      let anyHit = false
      let totalShotPoints = 0
      let bestBanner = ''
      let bestColor = spec.accentColor
      let bestEndPoint: [number, number, number] = [
        muzzleWorld.x + barrelDir.x * 25,
        muzzleWorld.y + barrelDir.y * 25,
        muzzleWorld.z + barrelDir.z * 25,
      ]
      const newTracers: BallisticTracer[] = []

      for (let p = 0; p < spec.pellets; p++) {
        scratchPelletDir
          .copy(barrelDir)
          .addScaledVector(
            scratchUpVec.set(0, 1, 0),
            (Math.random() - 0.5) * spreadFactor * 2,
          )
          .addScaledVector(
            scratchRightVec.set(0, 0, 1),
            (Math.random() - 0.5) * spreadFactor * 2,
          )
          .normalize()

        const outcome = evaluatePelletRay(
          muzzleWorld,
          scratchPelletDir,
          spec,
          nowMs + p,
        )
        newTracers.push({
          id: `tr-${nowMs}-${p}-${Math.random().toString(36).slice(2, 5)}`,
          from: [muzzleWorld.x, muzzleWorld.y, muzzleWorld.z],
          to: outcome.endPoint,
          color: outcome.hit ? outcome.color : spec.accentColor,
          createdAt: nowMs,
        })

        if (outcome.hit || outcome.points < 0) {
          if (outcome.hit) anyHit = true
          totalShotPoints += outcome.points
          bestBanner = outcome.banner
          bestColor = outcome.color
          bestEndPoint = outcome.endPoint
        }
      }

      setTracers((prev) => [...prev.slice(-14), ...newTracers])

      if (anyHit) {
        setShotsHit((prev) => prev + 1)
        const nextStreak = streakRef.current + 1
        streakRef.current = nextStreak
        setStreak(nextStreak)

        if (nextStreak > bestStreakRef.current) {
          bestStreakRef.current = nextStreak
          setBestStreak(nextStreak)
        }

        const mult = Math.min(4, 1 + Math.floor(nextStreak / 4))
        const awarded = Math.max(0, Math.round(totalShotPoints * mult))
        const nextScore = Math.max(0, scoreRef.current + awarded)
        scoreRef.current = nextScore
        setScore(nextScore)

        if (nextScore > highScoreRef.current) {
          highScoreRef.current = nextScore
          setHighScore(nextScore)
          setHighScoreHolder(localDisplayName || 'Operator')
        }

        setLastShotBanner(
          mult > 1
            ? `${bestBanner} · 🔥 ${nextStreak} STREAK (${mult}x = +${awarded})`
            : bestBanner,
        )
        setPopups((prev) => [
          ...prev.slice(-8),
          {
            id: `pop-${nowMs}-${Math.random().toString(36).slice(2, 5)}`,
            pos: bestEndPoint,
            text: `+${awarded}`,
            color: bestColor,
            createdAt: nowMs,
          },
        ])
      } else {
        streakRef.current = 0
        setStreak(0)
        if (totalShotPoints < 0) {
          const nextScore = Math.max(0, scoreRef.current + totalShotPoints)
          scoreRef.current = nextScore
          setScore(nextScore)
          setLastShotBanner(bestBanner)
        } else {
          setLastShotBanner('SHOT MISSED · STREAK RESET')
        }
      }
    },
    [
      evaluatePelletRay,
      handleReload,
      inVR,
      leftController,
      localDisplayName,
      primaryHand,
      rightController,
      scratchPelletDir,
      scratchRightVec,
      scratchUpVec,
    ],
  )

  // Trigger pull handler (respects weapon fire-rate RPM and 3-round burst)
  const handlePullTrigger = useCallback(
    (customAimTarget?: THREE.Vector3) => {
      const spec = equippedWeaponRef.current
      const nowSec = performance.now() / 1000
      const minIntervalSec = 60 / spec.fireRateRpm
      if (nowSec - lastFireTimeRef.current < minIntervalSec * 0.85) return
      lastFireTimeRef.current = nowSec

      if (customAimTarget) {
        desktopAimWorldRef.current.copy(customAimTarget)
      }

      const fireOnceNow = () => {
        if (weaponGroupRef.current) {
          weaponGroupRef.current.updateWorldMatrix(true, false)
          scratchMuzzleWorld.set(0, 0.016, -spec.barrelLength - 0.04)
          weaponGroupRef.current.localToWorld(scratchMuzzleWorld)
          scratchBarrelDir
            .set(0, 0, -1)
            .applyQuaternion(weaponGroupRef.current.quaternion)
            .normalize()
        } else {
          scratchMuzzleWorld.set(firingLineX + 0.15, 1.38, rangeZ)
          scratchBarrelDir
            .subVectors(desktopAimWorldRef.current, scratchMuzzleWorld)
            .normalize()
        }
        executeSingleShot(scratchMuzzleWorld, scratchBarrelDir)
      }

      fireOnceNow()
      if (spec.burstCount > 1) {
        for (let b = 1; b < spec.burstCount; b++) {
          const tid = window.setTimeout(() => {
            burstTimersRef.current = burstTimersRef.current.filter((id) => id !== tid)
            fireOnceNow()
          }, b * 68)
          burstTimersRef.current.push(tid)
        }
      }
    },
    [executeSingleShot, firingLineX, rangeZ, scratchBarrelDir, scratchMuzzleWorld],
  )

  // Desktop keyboard shortcuts when inside the Shooting Range
  useEffect(() => {
    if (!isActiveRoom) return
    const onKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement
      if (
        activeEl &&
        (activeEl.tagName === 'INPUT' ||
          activeEl.tagName === 'TEXTAREA' ||
          activeEl.tagName === 'SELECT')
      ) {
        return
      }
      if (e.code === 'KeyR') {
        e.preventDefault()
        handleReload()
      } else if (e.code === 'KeyV') {
        e.preventDefault()
        setDesktopTwoHandBraced((prev) => !prev)
      } else if (e.code === 'Digit1') {
        handleSelectWeapon('pistol-9mm')
      } else if (e.code === 'Digit2') {
        handleSelectWeapon('revolver-44')
      } else if (e.code === 'Digit3') {
        handleSelectWeapon('pistol-burst')
      } else if (e.code === 'Digit4') {
        handleSelectWeapon('rifle-carbine')
      } else if (e.code === 'Digit5') {
        handleSelectWeapon('shotgun-12g')
      } else if (e.code === 'Digit6') {
        handleSelectWeapon('sniper-bolt')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleReload, handleSelectWeapon, isActiveRoom])

  // =========================================================================
  // Master 72Hz/90Hz Frame Loop:
  // 1. 1-Controller (Pistol) vs 2-Controller (Rifle) VR Pose & Barrel Alignment
  // 2. Desktop Viewmodel Tracking
  // 3. Motorized Target Carriers, Moving Silhouettes & Aerial Clay/Drone Flight
  // =========================================================================
  useFrame((_, delta) => {
    if (!visible || !isActiveRoom) return
    const dt = Math.min(delta, 0.1)
    const nowMs = Date.now()
    const elapsedSec = performance.now() / 1000

    // Smoothly decay weapon recoil
    recoilOffsetRef.current = THREE.MathUtils.lerp(
      recoilOffsetRef.current,
      0,
      1 - Math.exp(-16 * dt),
    )
    recoilPitchRef.current = THREE.MathUtils.lerp(
      recoilPitchRef.current,
      0,
      1 - Math.exp(-14 * dt),
    )

    // 1. Animate 4 Motorized Target Carriers along overhead rails to carrierDistanceM
    const targetCarrierX = firingLineX - carrierDistanceRef.current
    for (let i = 0; i < 4; i++) {
      const grp = carrierGroupRefs.current[i]
      if (grp) {
        grp.position.x = THREE.MathUtils.lerp(
          grp.position.x,
          targetCarrierX,
          1 - Math.exp(-6 * dt),
        )
      }
    }

    // 2. Step Tactical Qualification Moving Silhouettes & Auto-Respawn
    if (rangeModeRef.current === 'tactical-qual') {
      for (const tac of tacticalTargets) {
        if (!tac.active && tac.respawnAt > 0 && nowMs >= tac.respawnAt) {
          setTacticalTargets((prev) =>
            prev.map((item) =>
              item.id === tac.id
                ? { ...item, active: true, hp: item.maxHp, respawnAt: 0 }
                : item,
            ),
          )
        }
        const grp = tacticalGroupRefs.current[tac.id]
        if (grp) {
          const zDynamic =
            rangeZ +
            tac.baseZOffset +
            Math.sin(elapsedSec * tac.moveSpeed + tac.phase) * tac.moveAmpZ
          grp.position.z = zDynamic
        }
      }
    }

    // 3. Step Aerial Clay Pigeons & Drones
    if (rangeModeRef.current === 'skeet-drones' && isActiveRoom) {
      for (const air of aerialTargetsRef.current) {
        air.pos[0] += air.vel[0] * dt
        air.pos[1] += air.vel[1] * dt
        air.pos[2] += air.vel[2] * dt
        if (air.kind === 'clay') {
          air.vel[1] -= 1.85 * dt // gentle parabolic gravity on clay pigeons
        } else {
          air.vel[1] = Math.sin(elapsedSec * 2.8) * 1.1 // weaving drone altitude
        }

        // Bounce or relaunch at range boundaries
        if (
          air.pos[0] < firingLineX - 33.15 ||
          air.pos[0] > firingLineX - 6.5 ||
          air.pos[1] < 0.65 ||
          air.pos[1] > 3.45 ||
          Math.abs(air.pos[2] - rangeZ) > 3.95
        ) {
          air.pos[0] = firingLineX - (11 + Math.random() * 18)
          air.pos[1] = 1.25 + Math.random() * 1.5
          air.pos[2] = rangeZ + (Math.random() - 0.5) * 6.4
          air.vel[0] = (Math.random() - 0.5) * 5.0
          air.vel[1] = 1.35 + Math.random() * 1.1
          air.vel[2] =
            (air.pos[2] > rangeZ ? -1 : 1) * (2.2 + Math.random() * 1.6)
        }

        const grp = aerialGroupRefs.current[air.id]
        if (grp) {
          grp.position.set(air.pos[0], air.pos[1], air.pos[2])
          grp.rotation.y += dt * 3.2
        }
      }
    }

    // Clean up expired tracers & popups
    if (tracers.length > 0 && nowMs - tracers[0].createdAt > 160) {
      setTracers((prev) => prev.filter((tr) => nowMs - tr.createdAt <= 160))
    }
    if (popups.length > 0 && nowMs - popups[0].createdAt > 900) {
      setPopups((prev) => prev.filter((p) => nowMs - p.createdAt <= 900))
    }

    // 4. Weapon Handling: VR 1-Controller vs 2-Controller Pose OR Desktop Viewmodel
    const weaponGrp = weaponGroupRef.current
    if (!weaponGrp || !isActiveRoom) return

    const spec = equippedWeaponRef.current

    if (inVR && xrSession) {
      const xrFrame = gl.xr.getFrame?.()
      const refSpace = xrOriginRefSpace ?? gl.xr.getReferenceSpace?.()
      const primaryCtrl =
        primaryHand === 'right' ? rightController : leftController
      const secondaryCtrl =
        primaryHand === 'right' ? leftController : rightController

      const primarySpace =
        primaryCtrl?.inputSource?.gripSpace ??
        primaryCtrl?.inputSource?.targetRaySpace
      const secondarySpace =
        secondaryCtrl?.inputSource?.gripSpace ??
        secondaryCtrl?.inputSource?.targetRaySpace

      const hasPrimary = readXRSpaceWorldPose(
        xrFrame,
        primarySpace,
        refSpace,
        xrOrigin,
        scratchPrimaryPos,
        scratchPrimaryQuat,
      )
      const hasSecondary = readXRSpaceWorldPose(
        xrFrame,
        secondarySpace,
        refSpace,
        xrOrigin,
        scratchSecondaryPos,
        scratchSecondaryQuat,
      )

      if (hasPrimary) {
        if (spec.gripMode === 'one-hand') {
          // =================================================================
          // 1-CONTROLLER CONFIGURATION (Pistols, Revolvers, Machine Pistols)
          // =================================================================
          twoHandActiveRef.current = true
          if (vrTwoHandLocked) setVrTwoHandLocked(false)

          weaponGrp.position.copy(scratchPrimaryPos)
          weaponGrp.quaternion.copy(scratchPrimaryQuat)
        } else {
          // =================================================================
          // 2-CONTROLLER CONFIGURATION (Rifles, Shotguns, Sniper Long Guns)
          // Rear Controller = Pistol Grip & Trigger
          // Front Controller = Foregrip / Barrel Vector Stabilization (Squeeze/Grip)
          // =================================================================
          const distHands = hasSecondary
            ? scratchPrimaryPos.distanceTo(scratchSecondaryPos)
            : 0
          const offhandSqueeze = isControllerButtonPressed(
            secondaryCtrl,
            ['xr-standard-squeeze'],
            1,
          )
          const naturalTwoHandReach =
            hasSecondary && distHands >= 0.14 && distHands <= 0.92

          if (hasSecondary && (offhandSqueeze || naturalTwoHandReach)) {
            twoHandActiveRef.current = true
            if (!vrTwoHandLocked) setVrTwoHandLocked(true)

            // Compute barrel forward direction directly from Rear Hand -> Front Hand!
            scratchBarrelDir
              .subVectors(scratchSecondaryPos, scratchPrimaryPos)
              .normalize()
            scratchUpVec
              .set(0, 1, 0)
              .applyQuaternion(scratchPrimaryQuat)
              .normalize()

            // Construct orthonormal basis where -Z is scratchBarrelDir
            scratchRightVec
              .crossVectors(scratchBarrelDir, scratchUpVec)
              .normalize()
            if (scratchRightVec.lengthSq() < 0.001) {
              scratchRightVec.set(0, 0, 1)
            }
            scratchUpVec
              .crossVectors(scratchRightVec, scratchBarrelDir)
              .normalize()

            scratchNegBarrelDir.copy(scratchBarrelDir).negate()
            scratchRotMat.makeBasis(
              scratchRightVec,
              scratchUpVec,
              scratchNegBarrelDir,
            )
            weaponGrp.position.copy(scratchPrimaryPos)
            weaponGrp.quaternion.setFromRotationMatrix(scratchRotMat)

            // 12-Gauge Shotgun Front-Controller Pump Gesture Detection!
            if (spec.id === 'shotgun-12g' && shotgunNeedsPumpRef.current) {
              if (prevHandDistRef.current !== null) {
                if (distHands < 0.34) {
                  shotgunPumpArmedRef.current = true
                } else if (shotgunPumpArmedRef.current && distHands > 0.41) {
                  shotgunPumpArmedRef.current = false
                  shotgunNeedsPumpRef.current = false
                  setShotgunNeedsPump(false)
                  shootingRangeAudio.playPumpAction()
                  pulseControllerHaptics(secondaryCtrl, 0.75, 50)
                  setLastShotBanner('12G SHOTGUN PUMPED WITH FRONT CONTROLLER!')
                }
              }
              prevHandDistRef.current = distHands
            }
          } else {
            // Only 1 hand on a 2-hand rifle (or only 1 controller connected)
            twoHandActiveRef.current = !hasSecondary
            if (vrTwoHandLocked) setVrTwoHandLocked(false)
            weaponGrp.position.copy(scratchPrimaryPos)
            weaponGrp.quaternion.copy(scratchPrimaryQuat)
          }
        }

        // Apply physical recoil kickback along the weapon's local axes
        scratchRecoilQuat.setFromAxisAngle(
          scratchRightVec.set(1, 0, 0),
          recoilPitchRef.current,
        )
        weaponGrp.quaternion.multiply(scratchRecoilQuat)
        weaponGrp.translateZ(recoilOffsetRef.current)

        // Check whether the barrel is aimed downrange (-X) and not hovering over any 3D UI
        const barrelDirX = scratchBarrelDir
          .set(0, 0, -1)
          .applyQuaternion(weaponGrp.quaternion).x
        const aimingDownrange = barrelDirX < -0.25 && !isSpatialUiHovered()

        // Poll Primary VR Trigger (`xr-standard-trigger`, button 0) to Fire
        const triggerPressed = isControllerButtonPressed(
          primaryCtrl,
          ['xr-standard-trigger'],
          0,
        )
        if (triggerPressed && aimingDownrange) {
          if (!prevTriggerPressedRef.current || spec.automatic) {
            handlePullTrigger()
          }
        }
        prevTriggerPressedRef.current = triggerPressed

        // Poll Right A Button (`a-button`, button 4 on right controller) for Reload
        // (Left X is reserved globally for VR Floor Teleport)
        const reloadPressed = isControllerButtonPressed(
          rightController ?? primaryCtrl,
          ['a-button'],
          4,
        )
        if (reloadPressed && !prevReloadPressedRef.current) {
          handleReload()
        }
        prevReloadPressedRef.current = reloadPressed

        // Poll Right B Button (`b-button`, button 5 on right controller) for Quick-Swap Weapon
        // (Left Y is reserved globally for Toggle Control Dock)
        const swapPressed = isControllerButtonPressed(
          rightController ?? primaryCtrl,
          ['b-button'],
          5,
        )
        if (swapPressed && !prevSwapPressedRef.current) {
          const curIdx = RANGE_WEAPONS.findIndex((w) => w.id === spec.id)
          const nextSpec = RANGE_WEAPONS[(curIdx + 1) % RANGE_WEAPONS.length]
          handleSelectWeapon(nextSpec.id)
        }
        prevSwapPressedRef.current = swapPressed
      }
    } else {
      // =====================================================================
      // Desktop / Mobile 3D Viewmodel Positioning at the Active Firing Booth
      // =====================================================================
      twoHandActiveRef.current =
        spec.gripMode === 'one-hand' || desktopTwoHandBraced

      // Anchor weapon at the firing line in front of the player's camera
      const camX = THREE.MathUtils.clamp(
        camera.position.x,
        firingLineX,
        firingLineX + 3.15,
      )
      const camZ = THREE.MathUtils.clamp(
        camera.position.z,
        rangeZ - 3.6,
        rangeZ + 3.6,
      )
      weaponGrp.position.set(
        Math.min(firingLineX + 0.12, camX - 0.42),
        1.28,
        camZ + 0.16,
      )

      scratchBarrelDir
        .subVectors(desktopAimWorldRef.current, weaponGrp.position)
        .normalize()
      scratchUpVec.set(0, 1, 0)
      scratchRightVec
        .crossVectors(scratchBarrelDir, scratchUpVec)
        .normalize()
      scratchUpVec
        .crossVectors(scratchRightVec, scratchBarrelDir)
        .normalize()
      scratchNegBarrelDir.copy(scratchBarrelDir).negate()
      scratchRotMat.makeBasis(
        scratchRightVec,
        scratchUpVec,
        scratchNegBarrelDir,
      )
      weaponGrp.quaternion.setFromRotationMatrix(scratchRotMat)

      scratchRecoilQuat.setFromAxisAngle(
        scratchRightVec.set(1, 0, 0),
        recoilPitchRef.current,
      )
      weaponGrp.quaternion.multiply(scratchRecoilQuat)
      weaponGrp.translateZ(recoilOffsetRef.current)
    }
  })

  // Pointer move & click on the downrange target bay for seamless Desktop/Mobile & VR Hand-Tracking shooting
  const handleRangePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    desktopAimWorldRef.current.copy(e.point)
  }, [])

  const handleRangePointerDown = useCallback(
    (e: ThreeEvent<PointerEvent>) => {
      // When VR controllers are active, physical trigger in useFrame handles firing;
      // when using WebXR Hand Tracking (no controller gamepads), allow pinch-to-fire via pointer down!
      if (inVR && (rightController || leftController)) return
      e.stopPropagation()
      handlePullTrigger(e.point)
    },
    [handlePullTrigger, inVR, leftController, rightController],
  )

  const accuracyPct =
    shotsFired > 0 ? Math.min(100, Math.round((shotsHit / shotsFired) * 100)) : 100

  return (
    <group name="wing-shooting-range" visible={visible}>
      {/* =================================================================== */}
      {/* 1. READY ROOM, TACTICAL ARMORY & 4 FIRING BOOTHS (x -18.4..-13.6)   */}
      {/* =================================================================== */}
      <group name="shooting-range-ready-room">
        {/* Ready Room Heavy Rubberized Tactical Floor */}
        <mesh
          position={[-16.0, 0.005, rangeZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          onDoubleClick={(e) => {
            if (!onTeleportToFloor) return
            e.stopPropagation()
            onTeleportToFloor([e.point.x, 0, e.point.z])
          }}
        >
          <planeGeometry args={[4.8, 8.8]} />
          <meshStandardMaterial
            color="#1E293B"
            emissive="#0F172A"
            emissiveIntensity={0.42 * emissiveBoost}
            roughness={0.75}
            metalness={0.18}
          />
        </mesh>

        {/* Yellow & Black High-Visibility Firing Line Safety Stripe at x = -18.12 */}
        <mesh
          position={[firingLineX + 0.23, 0.009, rangeZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[0.18, 8.4]} />
          <meshBasicMaterial color="#EAB308" />
        </mesh>

        {/* Ready Room Coffered Acoustic Ceiling */}
        <mesh
          position={[-16.0, 3.84, rangeZ]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[4.8, 8.8]} />
          <meshStandardMaterial
            color="#0F172A"
            emissive="#090D16"
            emissiveIntensity={0.4 * emissiveBoost}
            roughness={0.85}
          />
        </mesh>

        {/* North & South Ready Room Partition Walls */}
        {[rangeZ - 4.4, rangeZ + 4.4].map((wz, idx) => (
          <mesh
            key={idx}
            position={[-16.0, 1.92, wz]}
            raycast={noopRaycast}
          >
            <boxGeometry args={[4.8, 3.84, 0.14]} />
            <meshStandardMaterial
              color="#1E293B"
              emissive="#111827"
              emissiveIntensity={0.42 * emissiveBoost}
              roughness={0.7}
            />
          </mesh>
        ))}

        {/* East Ready Room Entrance Wall (x = -13.6) with 2.36m Archway into the Second Hallway */}
        {[rangeZ - 2.79, rangeZ + 2.79].map((ez, idx) => (
          <mesh
            key={idx}
            position={[-13.6, 1.92, ez]}
            raycast={noopRaycast}
          >
            <boxGeometry args={[0.14, 3.84, 3.22]} />
            <meshStandardMaterial
              color="#1E293B"
              emissive="#111827"
              emissiveIntensity={0.42 * emissiveBoost}
              roughness={0.7}
            />
          </mesh>
        ))}
        <mesh
          position={[-13.6, 3.48, rangeZ]}
          raycast={noopRaycast}
        >
          <boxGeometry args={[0.14, 0.72, 2.36]} />
          <meshStandardMaterial
            color="#1E293B"
            emissive="#111827"
            emissiveIntensity={0.42 * emissiveBoost}
            roughness={0.7}
          />
        </mesh>

        {/* ================================================================= */}
        {/* NORTH WALL ILLUMINATED TACTICAL ARMORY RACK (1-Hand vs 2-Hand)    */}
        {/* ================================================================= */}
        <group position={[-15.95, 1.85, rangeZ - 4.28]}>
          <RoundedBox
            args={[4.1, 2.35, 0.06]}
            radius={0.03}
            smoothness={2}
            raycast={noopRaycast}
          >
            <meshStandardMaterial
              color="#090D16"
              metalness={0.55}
              roughness={0.38}
            />
          </RoundedBox>
          <Text
            position={[0, 0.98, 0.04]}
            fontSize={0.095}
            color="#F8FAFC"
            anchorX="center"
            anchorY="middle"
          >
            🎯 TACTICAL BALLISTICS ARMORY — CLICK ANY WEAPON TO EQUIP
          </Text>
          <Text
            position={[-1.0, 0.78, 0.04]}
            fontSize={0.058}
            color="#38BDF8"
            anchorX="center"
            anchorY="middle"
          >
            🔫 1-CONTROLLER HANDGUNS & PISTOLS
          </Text>
          <Text
            position={[1.0, 0.78, 0.04]}
            fontSize={0.058}
            color="#22C55E"
            anchorX="center"
            anchorY="middle"
          >
            🪖 2-CONTROLLER RIFLES & LONG GUNS
          </Text>

          {RANGE_WEAPONS.map((w, idx) => {
            const isTwoHand = w.gripMode === 'two-hand'
            const colX = isTwoHand ? 1.0 : -1.0
            const rowIdx = idx % 3
            const rowY = 0.36 - rowIdx * 0.56
            const selected = equippedWeaponId === w.id
            const isHovered = hoveredArmoryWeaponId === w.id

            return (
              <group
                key={w.id}
                position={[colX, rowY, 0.04]}
                scale={isHovered ? 1.03 : 1}
                onPointerOver={(e) => {
                  e.stopPropagation()
                  setHoveredArmoryWeaponId(w.id)
                  setSpatialUiHovered(true, `armory-card-${w.id}`)
                }}
                onPointerOut={(e) => {
                  e.stopPropagation()
                  setHoveredArmoryWeaponId((prev) =>
                    prev === w.id ? null : prev,
                  )
                  setSpatialUiHovered(false, `armory-card-${w.id}`)
                }}
                onClick={(e) => {
                  e.stopPropagation()
                  playSpatialUiFeedback('ui-click')
                  handleSelectWeapon(w.id)
                }}
              >
                <RoundedBox
                  args={[1.82, 0.48, 0.02]}
                  radius={0.02}
                  smoothness={2}
                >
                  <meshBasicMaterial
                    color={
                      selected ? '#1E293B' : isHovered ? '#17253B' : '#0F172A'
                    }
                  />
                </RoundedBox>
                {/* Selection Border Stripe */}
                <mesh position={[-0.87, 0, 0.015]} raycast={noopRaycast}>
                  <boxGeometry args={[0.03, 0.42, 0.01]} />
                  <meshBasicMaterial
                    color={selected || isHovered ? '#FACC15' : w.accentColor}
                  />
                </mesh>

                {/* 3D Gun Display Model on Pegboard */}
                <group
                  position={[-0.38, -0.02, 0.07]}
                  rotation={[0, Math.PI / 2, 0]}
                >
                  <WeaponModel3D
                    spec={w}
                    scale={isTwoHand ? 0.82 : 1.05}
                    laserEnabled={false}
                  />
                </group>

                <Text
                  position={[-0.02, 0.11, 0.02]}
                  fontSize={0.052}
                  color={selected || isHovered ? '#FACC15' : '#F8FAFC'}
                  anchorX="left"
                  anchorY="middle"
                >
                  {`[${idx + 1}] ${w.shortName}`}
                </Text>
                <Text
                  position={[-0.02, -0.01, 0.02]}
                  fontSize={0.036}
                  color={w.accentColor}
                  anchorX="left"
                  anchorY="middle"
                >
                  {w.categoryLabel}
                </Text>
                <Text
                  position={[-0.02, -0.12, 0.02]}
                  fontSize={0.033}
                  color="#94A3B8"
                  anchorX="left"
                  anchorY="middle"
                >
                  {`${w.caliber} · ${w.magCapacity} Rds`}
                </Text>
              </group>
            )
          })}
        </group>

        {/* ================================================================= */}
        {/* SOUTH WALL RANGE COMMAND & TARGET CONTROL CONSOLE                 */}
        {/* Mounted on the South Ready Room Wall ([-15.95, 1.82, rangeZ+4.28])*/}
        {/* so it NEVER blocks the downrange targets or firing line sight!    */}
        {/* ================================================================= */}
        <group
          position={[-15.95, 1.82, rangeZ + 4.28]}
          rotation={[0, Math.PI, 0]}
        >
          <RoundedBox
            args={[4.1, 2.15, 0.06]}
            radius={0.03}
            smoothness={2}
            raycast={noopRaycast}
          >
            <meshStandardMaterial
              color="#090D16"
              metalness={0.55}
              roughness={0.35}
            />
          </RoundedBox>

          <Text
            position={[0, 0.88, 0.04]}
            fontSize={0.088}
            color="#FACC15"
            anchorX="center"
            anchorY="middle"
          >
            🎛️ RANGE OPERATIONS & TARGET CONTROL CONSOLE
          </Text>
          <Text
            position={[0, 0.71, 0.04]}
            fontSize={0.05}
            color="#94A3B8"
            anchorX="center"
            anchorY="middle"
          >
            {`EQUIPPED: ${equippedWeapon.name.toUpperCase()} (${equippedWeapon.gripMode === 'two-hand' ? '2-CONTROLLER RIFLE' : '1-CONTROLLER PISTOL'}) · AMMO: ${ammoInMag}/${equippedWeapon.magCapacity}`}
          </Text>

          {/* Row 1: All 6 Weapons (3 One-Hand Pistols + 3 Two-Hand Rifles) */}
          {RANGE_WEAPONS.map((w, idx) => (
            <RangeButton3D
              key={w.id}
              label={w.shortName}
              sublabel={w.gripMode === 'two-hand' ? '2-CTRL RIFLE' : '1-CTRL PISTOL'}
              position={[-1.55 + idx * 0.62, 0.38, 0.04]}
              width={0.58}
              height={0.28}
              active={equippedWeaponId === w.id}
              accent={w.accentColor}
              fontSize={0.042}
              onClick={() => handleSelectWeapon(w.id)}
            />
          ))}

          {/* Row 2: 4 Range Game Modes */}
          {(
            [
              { id: 'precision', label: '🏅 Precision Lanes', sub: `${carrierDistanceM}m Bullseye` },
              { id: 'steel-challenge', label: '🔔 Steel & Duel Tree', sub: 'AR500 Plates' },
              { id: 'tactical-qual', label: '🚨 60s Qualification', sub: qualRunning ? `${qualTimeRemaining}s Left` : 'Start Drill' },
              { id: 'skeet-drones', label: '🛸 Clay & Drones', sub: 'Aerial Intercept' },
            ] as const
          ).map((m, idx) => (
            <RangeButton3D
              key={m.id}
              label={m.label}
              sublabel={m.sub}
              position={[-1.41 + idx * 0.94, -0.06, 0.04]}
              width={0.88}
              height={0.32}
              active={rangeMode === m.id}
              accent="#EF4444"
              fontSize={0.044}
              onClick={() => {
                setRangeMode(m.id)
                if (m.id === 'tactical-qual') {
                  scoreRef.current = 0
                  streakRef.current = 0
                  setScore(0)
                  setStreak(0)
                  setQualTimeRemaining(60)
                  setQualRunning(true)
                  setTacticalTargets(createInitialTacticalTargets())
                  shootingRangeAudio.playRangeBuzzer('start')
                  setLastShotBanner(
                    '🚨 60-SECOND QUALIFICATION STARTED! SHOOT RED/CYAN THREATS, AVOID GREEN CIVILIANS!',
                  )
                } else {
                  setQualRunning(false)
                  shootingRangeAudio.playRangeBuzzer('wave')
                  setLastShotBanner(`RANGE MODE: ${m.label.toUpperCase()}`)
                }
              }}
            />
          ))}

          {/* Row 3: Carrier Distance (10m/20m/32m), Clear Decals, Reload, 2-Hand Toggle, Laser, Audio */}
          <RangeButton3D
            label={`📏 Dist: ${carrierDistanceM}m`}
            position={[-1.55, -0.52, 0.04]}
            width={0.58}
            height={0.26}
            accent="#38BDF8"
            fontSize={0.04}
            onClick={() =>
              setCarrierDistanceM((prev) =>
                prev === 10 ? 20 : prev === 20 ? 32 : 10,
              )
            }
          />
          <RangeButton3D
            label="🧹 Clear Targets"
            position={[-0.93, -0.52, 0.04]}
            width={0.58}
            height={0.26}
            accent="#64748B"
            fontSize={0.04}
            onClick={() => {
              setBulletHoles([])
              const freshSteel = createInitialSteelTargets()
              steelTargetsRef.current = freshSteel
              setSteelTargets(freshSteel)
              setTacticalTargets(createInitialTacticalTargets())
              setLastShotBanner('TARGETS RESET & BULLET HOLES PATCHED')
            }}
          />
          <RangeButton3D
            label={
              shotgunNeedsPump
                ? '🔄 Pump 12G!'
                : `🔄 Reload (${ammoInMag}/${equippedWeapon.magCapacity})`
            }
            position={[-0.31, -0.52, 0.04]}
            width={0.58}
            height={0.26}
            active={ammoInMag === 0 || shotgunNeedsPump}
            accent="#F59E0B"
            fontSize={0.038}
            onClick={handleReload}
          />
          <RangeButton3D
            label={
              inVR
                ? `🖐 Hand: ${primaryHand.toUpperCase()}`
                : `🪖 2H Brace: ${desktopTwoHandBraced ? 'ON' : 'OFF'}`
            }
            position={[0.31, -0.52, 0.04]}
            width={0.58}
            height={0.26}
            active={inVR ? vrTwoHandLocked : desktopTwoHandBraced}
            accent="#22C55E"
            fontSize={0.038}
            onClick={() => {
              if (inVR) {
                setPrimaryHand((prev) => (prev === 'right' ? 'left' : 'right'))
              } else {
                setDesktopTwoHandBraced((prev) => !prev)
              }
            }}
          />
          <RangeButton3D
            label={laserEnabled ? '🟢 Laser: ON' : '⚪ Laser: OFF'}
            position={[0.93, -0.52, 0.04]}
            width={0.58}
            height={0.26}
            active={laserEnabled}
            accent="#10B981"
            fontSize={0.04}
            onClick={() => setLaserEnabled((prev) => !prev)}
          />
          <RangeButton3D
            label={audioMuted ? '🔇 Muted' : '🔊 SFX On'}
            position={[1.55, -0.52, 0.04]}
            width={0.58}
            height={0.26}
            active={!audioMuted}
            accent="#38BDF8"
            fontSize={0.04}
            onClick={() => {
              const next = !audioMuted
              setAudioMuted(next)
              shootingRangeAudio.setMuted(next)
            }}
          />
        </group>

        {/* ================================================================= */}
        {/* 4 TACTICAL FIRING LINE BOOTHS & BENCH COUNTERS (x = -18.28)       */}
        {/* ================================================================= */}
        {[-3.6, -1.8, 0, 1.8, 3.6].map((divOff, idx) => (
          <group key={idx} position={[firingLineX + 0.3, 1.35, rangeZ + divOff]}>
            {/* Steel Partition Post */}
            <mesh position={[-0.28, 0, 0]} raycast={noopRaycast}>
              <boxGeometry args={[0.12, 2.7, 0.08]} />
              <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.3} />
            </mesh>
            {/* Ballistic Glass Booth Divider */}
            <mesh position={[0.12, 0.15, 0]} raycast={noopRaycast}>
              <boxGeometry args={[0.72, 1.65, 0.03]} />
              <meshBasicMaterial color="#38BDF8" transparent opacity={0.18} />
            </mesh>
          </group>
        ))}

        {/* Continuous Padded Ballistic Shooting Counter across the 4 Lanes */}
        <RoundedBox
          args={[0.58, 0.08, 7.6]}
          position={[firingLineX + 0.07, 0.94, rangeZ]}
          radius={0.02}
          raycast={noopRaycast}
        >
          <meshStandardMaterial
            color="#1E293B"
            metalness={0.45}
            roughness={0.42}
          />
        </RoundedBox>
        {/* Lower Knee Wall Barrier Preventing Walking Downrange */}
        <mesh position={[firingLineX - 0.07, 0.46, rangeZ]} raycast={noopRaycast}>
          <boxGeometry args={[0.18, 0.92, 8.6]} />
          <meshStandardMaterial color="#0F172A" roughness={0.75} />
        </mesh>

        {/* Low-Profile Flat Benchtop Quick-Control Strip (y = 0.99m, flat on counter — NEVER blocks downrange sightline!) */}
        <group
          position={[firingLineX + 0.16, 0.99, rangeZ]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <group rotation={[-1.25, 0, 0]}>
            <RoundedBox
              args={[1.56, 0.16, 0.015]}
              radius={0.01}
              raycast={noopRaycast}
            >
              <meshStandardMaterial color="#090D16" metalness={0.5} roughness={0.35} />
            </RoundedBox>
            <RangeButton3D
              label={`📏 ${carrierDistanceM}m`}
              position={[-0.58, 0, 0.012]}
              width={0.34}
              height={0.11}
              accent="#38BDF8"
              fontSize={0.025}
              onClick={() =>
                setCarrierDistanceM((prev) =>
                  prev === 10 ? 20 : prev === 20 ? 32 : 10,
                )
              }
            />
            <RangeButton3D
              label={`🎯 Mode: ${rangeMode === 'precision' ? 'Bullseye' : rangeMode === 'steel-challenge' ? 'Steel' : rangeMode === 'tactical-qual' ? '60s Qual' : 'Clay/Drone'}`}
              position={[-0.12, 0, 0.012]}
              width={0.5}
              height={0.11}
              accent="#EF4444"
              fontSize={0.024}
              onClick={() => {
                const modes: RangeGameModeId[] = [
                  'precision',
                  'steel-challenge',
                  'tactical-qual',
                  'skeet-drones',
                ]
                const next = modes[(modes.indexOf(rangeMode) + 1) % modes.length]
                setRangeMode(next)
                if (next === 'tactical-qual') {
                  scoreRef.current = 0
                  streakRef.current = 0
                  setScore(0)
                  setStreak(0)
                  setQualTimeRemaining(60)
                  setQualRunning(true)
                  setTacticalTargets(createInitialTacticalTargets())
                  shootingRangeAudio.playRangeBuzzer('start')
                  setLastShotBanner(
                    '🚨 60-SECOND QUALIFICATION STARTED! SHOOT RED/CYAN THREATS, AVOID GREEN CIVILIANS!',
                  )
                } else {
                  setQualRunning(false)
                  shootingRangeAudio.playRangeBuzzer('wave')
                  setLastShotBanner(`RANGE MODE: ${next.toUpperCase()}`)
                }
              }}
            />
            <RangeButton3D
              label={shotgunNeedsPump ? '🔄 Pump!' : `🔄 Reload (${ammoInMag})`}
              position={[0.35, 0, 0.012]}
              width={0.36}
              height={0.11}
              active={ammoInMag === 0 || shotgunNeedsPump}
              accent="#F59E0B"
              fontSize={0.024}
              onClick={handleReload}
            />
            <RangeButton3D
              label="🧹 Reset"
              position={[0.66, 0, 0.012]}
              width={0.22}
              height={0.11}
              accent="#64748B"
              fontSize={0.024}
              onClick={() => {
                setBulletHoles([])
                const freshSteel = createInitialSteelTargets()
                steelTargetsRef.current = freshSteel
                setSteelTargets(freshSteel)
                setTacticalTargets(createInitialTacticalTargets())
              }}
            />
          </group>
        </group>

        {/* 4 Click-to-Stand Booth Floor Mats */}
        {boothSeats.map((seat, idx) => {
          const isLocal = localSeatId === seat.id
          const occupant = seatOccupants.get(seat.id)
          const isHovered = hoveredBoothSeatId === seat.id
          return (
            <group
              key={seat.id}
              position={seat.position}
              onPointerOver={(e) => {
                e.stopPropagation()
                setHoveredBoothSeatId(seat.id)
                setSpatialUiHovered(true, `booth-seat-${seat.id}`)
              }}
              onPointerOut={(e) => {
                e.stopPropagation()
                setHoveredBoothSeatId((prev) =>
                  prev === seat.id ? null : prev,
                )
                setSpatialUiHovered(false, `booth-seat-${seat.id}`)
              }}
              onClick={(e) => {
                e.stopPropagation()
                playSpatialUiFeedback('ui-click')
                onSelectSeat(seat.id)
              }}
            >
              <RoundedBox
                args={[0.82, 0.025, 1.25]}
                position={[0, 0.014, 0]}
                radius={0.01}
              >
                <meshBasicMaterial
                  color={
                    isLocal
                      ? '#EF4444'
                      : occupant
                        ? '#F59E0B'
                        : isHovered
                          ? '#334155'
                          : '#1E293B'
                  }
                />
              </RoundedBox>
              <Text
                position={[0.22, 0.03, 0]}
                rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                fontSize={0.075}
                color={isHovered ? '#FDE68A' : '#F8FAFC'}
                anchorX="center"
                anchorY="middle"
              >
                {`LANE ${idx + 1} · ${isLocal ? 'ACTIVE BOOTH' : 'CLICK TO STEP UP'}`}
              </Text>
            </group>
          )
        })}

        {/* ================================================================= */}
        {/* HIGH-MOUNTED OVERHEAD DIGITAL TELEMETRY & SCOREBOARD GANTRY       */}
        {/* Mounted high at y = 3.42m above the firing line opening so the    */}
        {/* entire vertical window (y = 0.98m..3.10m) is 100% unobstructed!   */}
        {/* ================================================================= */}
        <group
          position={[firingLineX + 0.03, 3.42, rangeZ]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <RoundedBox
            args={[5.8, 0.64, 0.08]}
            radius={0.03}
            smoothness={2}
            raycast={noopRaycast}
          >
            <meshStandardMaterial
              color="#090D16"
              metalness={0.6}
              roughness={0.32}
            />
          </RoundedBox>
          <Text
            position={[0, 0.21, 0.05]}
            fontSize={0.078}
            color="#EF4444"
            anchorX="center"
            anchorY="middle"
          >
            🎯 VR LOUNGE BALLISTICS RANGE · LIVE TELEMETRY
          </Text>
          <Text
            position={[-2.65, 0.04, 0.05]}
            fontSize={0.062}
            color="#F8FAFC"
            anchorX="left"
            anchorY="middle"
          >
            {`SCORE: ${score}   |   BEST: ${highScore} (${highScoreHolder})`}
          </Text>
          <Text
            position={[0.35, 0.04, 0.05]}
            fontSize={0.062}
            color="#38BDF8"
            anchorX="left"
            anchorY="middle"
          >
            {`ACCURACY: ${accuracyPct}% (${shotsHit}/${shotsFired})   |   STREAK: ${streak}x (MAX ${bestStreak}x)`}
          </Text>
          <Text
            position={[0, -0.11, 0.05]}
            fontSize={0.052}
            color={
              equippedWeapon.gripMode === 'two-hand' ? '#22C55E' : '#FACC15'
            }
            anchorX="center"
            anchorY="middle"
          >
            {`WEAPON: ${equippedWeapon.name.toUpperCase()} · AMMO: ${ammoInMag}/${equippedWeapon.magCapacity} · ${
              equippedWeapon.gripMode === 'two-hand'
                ? inVR
                  ? vrTwoHandLocked
                    ? '2-CONTROLLER RIFLE (FOREGRIP LOCKED)'
                    : '2-CONTROLLER RIFLE (BRING LEFT HAND TO FOREGRIP)'
                  : desktopTwoHandBraced
                    ? '2-HAND RIFLE (STABILIZED)'
                    : '2-HAND RIFLE (UNBRACED)'
                : '1-CONTROLLER HANDGUN'
            }`}
          </Text>
          <Text
            position={[0, -0.24, 0.05]}
            fontSize={0.05}
            color="#FDE047"
            anchorX="center"
            anchorY="middle"
          >
            {lastShotBanner}
          </Text>
        </group>
      </group>

      {/* =================================================================== */}
      {/* 2. 35-METER BALLISTIC DOWNRANGE BAY (x in [-53.55, -18.35])         */}
      {/* Dedicated aim plane captures desktop clicks without raycasting      */}
      {/* against dynamic target sub-meshes or tracers!                       */}
      {/* =================================================================== */}
      <group name="shooting-range-downrange-bay">
        {/* Single Lightweight Downrange Aim & Click Plane for Desktop/Pointer Shooting */}
        <mesh
          position={[firingLineX - 18.0, 1.85, rangeZ]}
          rotation={[0, Math.PI / 2, 0]}
          onPointerMove={handleRangePointerMove}
          onPointerDown={handleRangePointerDown}
        >
          <planeGeometry args={[8.8, 3.8]} />
          <meshBasicMaterial
            color="#000000"
            transparent
            opacity={0}
            depthWrite={false}
          />
        </mesh>

        {/* Downrange Concrete Ballistic Floor */}
        <mesh
          position={[firingLineX - 17.55, 0.004, rangeZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[35.2, 8.8]} />
          <meshStandardMaterial
            color="#111827"
            emissive="#090D16"
            emissiveIntensity={0.36 * emissiveBoost}
            roughness={0.85}
          />
        </mesh>

        {/* Downrange Ceiling & Acoustic Baffles */}
        <mesh
          position={[firingLineX - 17.55, 3.84, rangeZ]}
          rotation={[Math.PI / 2, 0, 0]}
          raycast={noopRaycast}
        >
          <planeGeometry args={[35.2, 8.8]} />
          <meshStandardMaterial color="#090D16" roughness={0.9} />
        </mesh>

        {/* North & South Downrange Concrete Side Walls */}
        {[rangeZ - 4.4, rangeZ + 4.4].map((wz, idx) => (
          <mesh
            key={idx}
            position={[firingLineX - 17.55, 1.92, wz]}
            raycast={noopRaycast}
          >
            <boxGeometry args={[35.2, 3.84, 0.16]} />
            <meshStandardMaterial
              color="#1E293B"
              emissive="#0F172A"
              emissiveIntensity={0.35 * emissiveBoost}
              roughness={0.8}
            />
          </mesh>
        ))}

        {/* Angled Steel & Kevlar Bullet-Trap Backstop Wall at firingLineX - 34.85 */}
        <mesh
          position={[firingLineX - 34.85, 1.92, rangeZ]}
          rotation={[0, 0, -0.18]}
          raycast={noopRaycast}
        >
          <boxGeometry args={[0.45, 4.1, 8.8]} />
          <meshStandardMaterial
            color="#0F172A"
            metalness={0.75}
            roughness={0.45}
          />
        </mesh>

        {/* Downrange Zone Lighting & Distance Marker Stripes (10m, 15m, 20m, 25m, 32m) */}
        <pointLight
          position={[firingLineX - 10.05, 3.45, rangeZ]}
          color="#E2E8F0"
          intensity={22 * emissiveBoost}
          distance={26}
          decay={1.2}
        />
        <pointLight
          position={[firingLineX - 25.05, 3.45, rangeZ]}
          color="#BAE6FD"
          intensity={20 * emissiveBoost}
          distance={26}
          decay={1.2}
        />

        {[10, 15, 20, 25, 32].map((distM) => {
          const mx = firingLineX - distM
          return (
            <group key={distM} position={[mx, 0.01, rangeZ]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={noopRaycast}>
                <planeGeometry args={[0.06, 8.4]} />
                <meshBasicMaterial color="#334155" />
              </mesh>
              <Text
                position={[0.18, 0.02, -3.7]}
                rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                fontSize={0.22}
                color="#64748B"
                anchorX="center"
                anchorY="middle"
              >
                {`${distM}m`}
              </Text>
              <Text
                position={[0.18, 0.02, 3.7]}
                rotation={[-Math.PI / 2, 0, Math.PI / 2]}
                fontSize={0.22}
                color="#64748B"
                anchorX="center"
                anchorY="middle"
              >
                {`${distM}m`}
              </Text>
              {/* Overhead Acoustic Baffle Rib */}
              <mesh position={[0, 3.55, 0]} raycast={noopRaycast}>
                <boxGeometry args={[0.12, 0.48, 8.6]} />
                <meshStandardMaterial color="#1E293B" roughness={0.75} />
              </mesh>
            </group>
          )
        })}

        {/* 4 Overhead Motorized Carrier Rails */}
        {[-2.7, -0.9, 0.9, 2.7].map((off, idx) => (
          <mesh
            key={idx}
            position={[firingLineX - 17.15, 3.25, rangeZ + off]}
            raycast={noopRaycast}
          >
            <boxGeometry args={[33.5, 0.045, 0.05]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.25} />
          </mesh>
        ))}

        {/* ================================================================= */}
        {/* MODE 1 TARGETS: 4 MOTORIZED PAPER BULLSEYE CARRIERS               */}
        {/* ================================================================= */}
        <group visible={rangeMode === 'precision'}>
          {[-2.7, -0.9, 0.9, 2.7].map((laneOff, laneIdx) => (
            <group
              key={laneIdx}
              ref={(el) => {
                carrierGroupRefs.current[laneIdx] = el
              }}
              position={[firingLineX - carrierDistanceM, 0, rangeZ + laneOff]}
            >
              {/* Overhead Carrier Trolley Clamps */}
              <mesh position={[0, 2.68, 0]} raycast={noopRaycast}>
                <boxGeometry args={[0.16, 1.12, 0.08]} />
                <meshStandardMaterial color="#334155" metalness={0.7} />
              </mesh>

              {/* Paper Target Backing Board (Faces +X toward firing line) */}
              <group position={[0, 1.56, 0]} rotation={[0, Math.PI / 2, 0]}>
                <mesh raycast={noopRaycast}>
                  <boxGeometry args={[0.78, 1.08, 0.025]} />
                  <meshStandardMaterial color="#F8FAFC" roughness={0.85} />
                </mesh>

                {/* Dark Silhouette Torso & Head */}
                <mesh position={[0, -0.06, 0.015]} raycast={noopRaycast}>
                  <circleGeometry args={[0.3, 28]} />
                  <meshBasicMaterial color="#0F172A" />
                </mesh>
                <mesh position={[0, 0.34, 0.015]} raycast={noopRaycast}>
                  <circleGeometry args={[0.1, 20]} />
                  <meshBasicMaterial color="#0F172A" />
                </mesh>

                {/* 10-Ring Concentric Bullseye Rings */}
                {[
                  { r: 0.22, color: '#38BDF8' },
                  { r: 0.155, color: '#F59E0B' },
                  { r: 0.095, color: '#EF4444' },
                  { r: 0.045, color: '#FACC15' },
                ].map((ring, rIdx) => (
                  <mesh
                    key={rIdx}
                    position={[0, -0.06, 0.016 + rIdx * 0.001]}
                    raycast={noopRaycast}
                  >
                    <ringGeometry args={[ring.r - 0.006, ring.r, 24]} />
                    <meshBasicMaterial color={ring.color} />
                  </mesh>
                ))}
                {/* Center 10-X Bullseye Dot */}
                <mesh position={[0, -0.06, 0.021]} raycast={noopRaycast}>
                  <circleGeometry args={[0.022, 16]} />
                  <meshBasicMaterial color="#EF4444" />
                </mesh>
                {/* Headshot X-Ring */}
                <mesh position={[0, 0.34, 0.018]} raycast={noopRaycast}>
                  <ringGeometry args={[0.036, 0.044, 16]} />
                  <meshBasicMaterial color="#FACC15" />
                </mesh>

                {/* Real-Time Bullet Hole Decals on This Lane's Target */}
                {bulletHoles
                  .filter((h) => h.laneIndex === laneIdx)
                  .map((hole) => (
                    <group
                      key={hole.id}
                      position={[-hole.localZ, hole.localY, 0.023]}
                    >
                      <mesh raycast={noopRaycast}>
                        <circleGeometry args={[0.011, 10]} />
                        <meshBasicMaterial color="#020617" />
                      </mesh>
                      <mesh position={[0, 0, -0.0005]} raycast={noopRaycast}>
                        <ringGeometry args={[0.011, 0.018, 10]} />
                        <meshBasicMaterial color={hole.color} />
                      </mesh>
                    </group>
                  ))}
              </group>
            </group>
          ))}
        </group>

        {/* ================================================================= */}
        {/* MODE 2 TARGETS: REACTIVE AR500 STEEL CHALLENGE & DUELING TREE     */}
        {/* ================================================================= */}
        <group visible={rangeMode === 'steel-challenge'}>
          {/* Central Dueling Tree Vertical Steel Post at 16m */}
          <mesh
            position={[firingLineX - 16, 1.25, rangeZ + 0.6]}
            raycast={noopRaycast}
          >
            <boxGeometry args={[0.09, 2.5, 0.09]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.3} />
          </mesh>

          {steelTargets.map((st) => {
            const worldX = firingLineX - st.xDist
            const paddleShiftZ =
              st.kind === 'dueling-paddle'
                ? st.paddleSide === 'left'
                  ? -0.22
                  : 0.22
                : 0
            const worldZ = rangeZ + st.zOffset + paddleShiftZ

            return (
              <group key={st.id} position={[worldX, 0, worldZ]}>
                {/* Steel Stand Post for Knockdown Plates */}
                {st.kind === 'knockdown' && (
                  <mesh position={[0, st.baseY / 2, 0]} raycast={noopRaycast}>
                    <cylinderGeometry args={[0.03, 0.04, st.baseY, 8]} />
                    <meshStandardMaterial color="#334155" metalness={0.7} />
                  </mesh>
                )}

                {/* Reactive AR500 Steel Plate Disk */}
                <mesh
                  position={[0, st.down ? st.baseY - 0.14 : st.baseY, 0]}
                  rotation={[
                    0,
                    0,
                    st.down ? -Math.PI / 2.1 : Math.PI / 2,
                  ]}
                  raycast={noopRaycast}
                >
                  <cylinderGeometry args={[st.radius, st.radius, 0.025, 20]} />
                  <meshStandardMaterial
                    color={
                      st.kind === 'dueling-paddle'
                        ? st.paddleSide === 'left'
                          ? '#F59E0B'
                          : '#38BDF8'
                        : '#E2E8F0'
                    }
                    metalness={0.78}
                    roughness={0.25}
                  />
                </mesh>
                {/* Bullseye Paint Spot on Steel Plate */}
                {!st.down && (
                  <mesh
                    position={[0.015, st.baseY, 0]}
                    rotation={[0, Math.PI / 2, 0]}
                    raycast={noopRaycast}
                  >
                    <circleGeometry args={[st.radius * 0.42, 16]} />
                    <meshBasicMaterial color="#EF4444" />
                  </mesh>
                )}
              </group>
            )
          })}
        </group>

        {/* ================================================================= */}
        {/* MODE 3 TARGETS: 60s TACTICAL QUALIFICATION SILHOUETTES            */}
        {/* ================================================================= */}
        <group visible={rangeMode === 'tactical-qual'}>
          {tacticalTargets.map((tac) => {
            const worldX = firingLineX - tac.xDist
            const bodyColor =
              tac.kind === 'no-shoot'
                ? '#10B981'
                : tac.kind === 'armored'
                  ? '#0284C7'
                  : '#DC2626'

            return (
              <group
                key={tac.id}
                ref={(el) => {
                  tacticalGroupRefs.current[tac.id] = el
                }}
                position={[worldX, 0, rangeZ + tac.baseZOffset]}
              >
                {/* Motorized Floor Track & Cover Barricade */}
                <mesh position={[0.18, 0.45, 0]} raycast={noopRaycast}>
                  <boxGeometry args={[0.08, 0.9, 0.85]} />
                  <meshStandardMaterial color="#1E293B" roughness={0.8} />
                </mesh>

                {/* Pop-Up Tactical Silhouette (Folds flat when neutralized) */}
                <group
                  position={[0, 0.95, 0]}
                  rotation={[0, 0, tac.active ? 0 : -Math.PI / 2.05]}
                >
                  {/* Torso Plate */}
                  <RoundedBox
                    args={[0.03, 0.68, 0.52]}
                    position={[0, 0.38, 0]}
                    radius={0.01}
                    raycast={noopRaycast}
                  >
                    <meshStandardMaterial color={bodyColor} roughness={0.5} />
                  </RoundedBox>
                  {/* Head Plate */}
                  <RoundedBox
                    args={[0.03, 0.24, 0.24]}
                    position={[0, 0.86, 0]}
                    radius={0.01}
                    raycast={noopRaycast}
                  >
                    <meshStandardMaterial color={bodyColor} roughness={0.5} />
                  </RoundedBox>
                  {/* A-Zone Scoring Box Overlay */}
                  <mesh
                    position={[0.018, 0.42, 0]}
                    rotation={[0, Math.PI / 2, 0]}
                    raycast={noopRaycast}
                  >
                    <planeGeometry args={[0.24, 0.32]} />
                    <meshBasicMaterial
                      color={tac.kind === 'no-shoot' ? '#F8FAFC' : '#FACC15'}
                    />
                  </mesh>
                  <Text
                    position={[0.022, 0.42, 0]}
                    rotation={[0, Math.PI / 2, 0]}
                    fontSize={0.065}
                    color="#090D16"
                    anchorX="center"
                    anchorY="middle"
                  >
                    {tac.kind === 'no-shoot'
                      ? 'NO SHOOT'
                      : tac.kind === 'armored'
                        ? `ARMOR (${tac.hp})`
                        : 'THREAT'}
                  </Text>
                </group>
              </group>
            )
          })}
        </group>

        {/* ================================================================= */}
        {/* MODE 4 TARGETS: AERIAL CLAY PIGEONS & TACTICAL DRONES             */}
        {/* ================================================================= */}
        <group visible={rangeMode === 'skeet-drones'}>
          {AERIAL_TARGET_SPECS.map((air) => (
            <group
              key={air.id}
              ref={(el) => {
                aerialGroupRefs.current[air.id] = el
              }}
              position={[
                firingLineX + air.initialPosOffset[0],
                air.initialPosOffset[1],
                rangeZ + air.initialPosOffset[2],
              ]}
            >
              {air.kind === 'clay' ? (
                <mesh raycast={noopRaycast}>
                  <cylinderGeometry args={[0.28, 0.32, 0.08, 16]} />
                  <meshBasicMaterial color="#F97316" />
                </mesh>
              ) : (
                <group>
                  <mesh raycast={noopRaycast}>
                    <sphereGeometry args={[0.22, 12, 12]} />
                    <meshStandardMaterial
                      color="#0F172A"
                      emissive="#38BDF8"
                      emissiveIntensity={0.6}
                    />
                  </mesh>
                  <mesh rotation={[Math.PI / 2, 0, 0]} raycast={noopRaycast}>
                    <torusGeometry args={[0.32, 0.025, 8, 20]} />
                    <meshBasicMaterial color="#38BDF8" />
                  </mesh>
                </group>
              )}
            </group>
          ))}
        </group>

        {/* ================================================================= */}
        {/* LIVE BALLISTIC TRACER STREAKS & FLOATING SCORE POPUPS             */}
        {/* ================================================================= */}
        {tracers.map((tr) => (
          <TracerBeam3D
            key={tr.id}
            from={tr.from}
            to={tr.to}
            color={tr.color}
          />
        ))}

        {popups.map((pop) => (
          <group
            key={pop.id}
            position={[pop.pos[0] + 0.25, pop.pos[1] + 0.22, pop.pos[2]]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <Text
              fontSize={0.18}
              color={pop.color}
              anchorX="center"
              anchorY="middle"
            >
              {pop.text}
            </Text>
          </group>
        ))}
      </group>

      {/* =================================================================== */}
      {/* 3. ACTIVE 3D HANDHELD / VIEWMODEL WEAPON                            */}
      {/* Follows 1-Controller (Pistol) or 2-Controller (Rifle) Pose in VR,   */}
      {/* or aims smoothly toward cursor target on Desktop/Mobile!            */}
      {/* =================================================================== */}
      <group ref={weaponGroupRef} visible={isActiveRoom}>
        <WeaponModel3D
          spec={equippedWeapon}
          scale={1}
          showMuzzleFlash={muzzleFlashOn}
          twoHandLocked={
            equippedWeapon.gripMode === 'two-hand' &&
            (inVR ? vrTwoHandLocked : desktopTwoHandBraced)
          }
          isReloading={isReloading}
          laserEnabled={laserEnabled}
          laserLength={22}
        />

        {/* Compact Wrist/Rear-Receiver Status Readout (positioned below top sight rail so iron sights/scopes are 100% clear) */}
        <group position={[0, -0.022, 0.095]}>
          <RoundedBox
            args={[0.18, 0.036, 0.004]}
            radius={0.005}
            raycast={noopRaycast}
          >
            <meshBasicMaterial color="#090D16" transparent opacity={0.82} />
          </RoundedBox>
          <Text
            position={[0, 0.006, 0.004]}
            fontSize={0.011}
            color={ammoInMag === 0 ? '#EF4444' : equippedWeapon.accentColor}
            anchorX="center"
            anchorY="middle"
          >
            {isReloading
              ? 'RELOADING...'
              : shotgunNeedsPump
                ? 'PUMP FOREGRIP!'
                : `${equippedWeapon.shortName} · ${ammoInMag}/${equippedWeapon.magCapacity}`}
          </Text>
          <Text
            position={[0, -0.008, 0.004]}
            fontSize={0.008}
            color={
              equippedWeapon.gripMode === 'two-hand'
                ? inVR
                  ? vrTwoHandLocked
                    ? '#22C55E'
                    : '#F59E0B'
                  : '#22C55E'
                : '#38BDF8'
            }
            anchorX="center"
            anchorY="middle"
          >
            {equippedWeapon.gripMode === 'two-hand'
              ? inVR
                ? vrTwoHandLocked
                  ? '2-CTRL LOCKED'
                  : 'GRIP W/ 2ND CTRL'
                : desktopTwoHandBraced
                  ? '2H BRACED [V]'
                  : 'UNBRACED [V]'
              : '1-CTRL HANDGUN'}
          </Text>
        </group>
      </group>
    </group>
  )
}
