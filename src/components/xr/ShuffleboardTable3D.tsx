import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import type {
  ShuffleboardPuck,
  ShuffleboardState,
  ShuffleboardTeam,
} from '../../types/barGames'

export interface ShuffleboardTable3DProps {
  origin: [number, number, number]
  state: ShuffleboardState
  localDisplayName: string
  onRecordShot: (puck: ShuffleboardPuck, updatedPucks?: ShuffleboardPuck[]) => void
  onReset: () => void
  onSnapToStation?: () => void
}

interface LiveSlidingPuck {
  id: string
  team: ShuffleboardTeam
  x: number
  z: number
  vx: number
  vz: number
}

function scoreShuffleboardLocalZ(localX: number, localZ: number): number {
  if (Math.abs(localX) > 0.205 || localZ < -1.24 || localZ > -0.32) {
    return 0
  }
  if (localZ <= -1.06) return 4
  if (localZ <= -0.82) return 3
  if (localZ <= -0.58) return 2
  return 1
}

export function ShuffleboardTable3D({
  origin,
  state,
  localDisplayName,
  onRecordShot,
  onReset,
  onSnapToStation,
}: ShuffleboardTable3DProps) {
  const [aimX, setAimX] = useState(0)
  const [powerPreset, setPowerPreset] = useState<1 | 2 | 3 | 4>(3)
  const livePuckRef = useRef<LiveSlidingPuck | null>(null)
  const liveMeshRef = useRef<THREE.Group>(null)
  const [isSliding, setIsSliding] = useState(false)

  const launchPuck = (targetX: number, targetZone: 1 | 2 | 3 | 4) => {
    if (livePuckRef.current) return
    const team: ShuffleboardTeam = state.activeTeam
    const zoneTargetZ =
      targetZone === 4
        ? -1.14
        : targetZone === 3
          ? -0.94
          : targetZone === 2
            ? -0.7
            : -0.46
    const startZ = 1.08
    const dist = Math.abs(zoneTargetZ - startZ)
    // Initial velocity tuned for linear damping k = 2.15: v0 = dist * 2.15
    const jitterZ = (Math.random() - 0.5) * 0.08
    const vz = -(dist + jitterZ) * 2.15
    const vx = (targetX + (Math.random() - 0.5) * 0.025) * 2.15

    livePuckRef.current = {
      id: `puck-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      team,
      x: Number((targetX * 0.25).toFixed(3)),
      z: startZ,
      vx,
      vz,
    }
    setIsSliding(true)
  }

  useFrame((_, delta) => {
    const lp = livePuckRef.current
    if (!lp) return
    const dt = Math.min(delta, 0.05)
    lp.x += lp.vx * dt
    lp.z += lp.vz * dt
    const damp = Math.exp(-2.15 * dt)
    lp.vx *= damp
    lp.vz *= damp

    if (liveMeshRef.current) {
      liveMeshRef.current.position.set(lp.x, 0.835, lp.z)
    }

    const speed = Math.hypot(lp.vx, lp.vz)
    if (speed < 0.045 || lp.z < -1.26 || Math.abs(lp.x) > 0.22) {
      const finalX = Number(Math.max(-0.22, Math.min(0.22, lp.x)).toFixed(3))
      const finalZ = Number(Math.max(-1.25, Math.min(1.1, lp.z)).toFixed(3))
      const pts = scoreShuffleboardLocalZ(finalX, finalZ)
      const settled: ShuffleboardPuck = {
        id: lp.id,
        team: lp.team,
        localX: finalX,
        localZ: finalZ,
        points: pts,
        shotBy: localDisplayName,
      }
      livePuckRef.current = null
      setIsSliding(false)
      onRecordShot(settled)
    }
  })

  return (
    <group name="main-room-shuffleboard-table" position={origin}>
      {/* Mahogany Outer Cradle & Legs */}
      <RoundedBox
        args={[0.64, 0.16, 2.74]}
        position={[0, 0.74, 0]}
        radius={0.025}
        smoothness={2}
      >
        <meshStandardMaterial color="#2C1610" roughness={0.35} metalness={0.1} />
      </RoundedBox>
      {[-1.08, 0, 1.08].map((lz) => (
        <group key={lz} position={[0, 0.34, lz]}>
          <mesh position={[-0.22, 0, 0]}>
            <boxGeometry args={[0.08, 0.68, 0.12]} />
            <meshStandardMaterial color="#1E1410" roughness={0.35} metalness={0.1} />
          </mesh>
          <mesh position={[0.22, 0, 0]}>
            <boxGeometry args={[0.08, 0.68, 0.12]} />
            <meshStandardMaterial color="#1E1410" roughness={0.35} metalness={0.1} />
          </mesh>
          <mesh position={[0, -0.14, 0]}>
            <boxGeometry args={[0.48, 0.05, 0.06]} />
            <meshStandardMaterial color="#E5A93C" metalness={0.75} roughness={0.25} />
          </mesh>
        </group>
      ))}

      {/* Dark Gutter Alley Trough */}
      <mesh position={[0, 0.805, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.54, 2.6]} />
        <meshStandardMaterial color="#0F172A" roughness={0.85} />
      </mesh>

      {/* Warm Satin Butcher-Block Maple Playfield (Click anywhere on board to slide puck!) */}
      <mesh
        name="shuffleboard-playfield"
        position={[0, 0.816, 0]}
        onClick={(e) => {
          e.stopPropagation()
          const localPt = e.point.clone()
          const relX = Math.max(-0.16, Math.min(0.16, localPt.x - origin[0]))
          const relZ = localPt.z - origin[2]
          const zone: 1 | 2 | 3 | 4 =
            relZ <= -1.04 ? 4 : relZ <= -0.8 ? 3 : relZ <= -0.56 ? 2 : 1
          launchPuck(relX, zone)
        }}
      >
        <boxGeometry args={[0.41, 0.022, 2.48]} />
        <meshStandardMaterial color="#DFB178" roughness={0.35} metalness={0.1} />
      </mesh>

      {/* Scoring Zone Lines & 1-2-3-4 Numbers at North End (localZ < -0.35) */}
      {[
        { z: -0.35, label: '1', zoneZ: -0.46, color: '#1E293B' },
        { z: -0.58, label: '2', zoneZ: -0.7, color: '#1E293B' },
        { z: -0.82, label: '3', zoneZ: -0.94, color: '#B91C1C' },
        { z: -1.06, label: '4 · HANGER', zoneZ: -1.15, color: '#D97706' },
      ].map((zn) => (
        <group key={zn.label}>
          <mesh
            position={[0, 0.828, zn.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <planeGeometry args={[0.39, 0.008]} />
            <meshBasicMaterial color="#1E293B" />
          </mesh>
          <Text
            position={[0, 0.829, zn.zoneZ]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={zn.label.length > 2 ? 0.036 : 0.068}
            color={zn.color}
            anchorX="center"
            anchorY="middle"
          >
            {zn.label}
          </Text>
        </group>
      ))}

      {/* Foul Line near South Shooter End */}
      <mesh
        position={[0, 0.828, 0.55]}
        rotation={[-Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <planeGeometry args={[0.39, 0.008]} />
        <meshBasicMaterial color="#DC2626" />
      </mesh>

      {/* Synced Settled Pucks on the Board */}
      {state.pucks.map((p) => (
        <group key={p.id} position={[p.localX, 0.836, p.localZ]}>
          <mesh>
            <cylinderGeometry args={[0.032, 0.034, 0.018, 18]} />
            <meshStandardMaterial color="#CBD5E1" metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.004, 16]} />
            <meshBasicMaterial color={p.team === 'red' ? '#EF4444' : '#38BDF8'} />
          </mesh>
        </group>
      ))}

      {/* Live Sliding Puck in Flight */}
      <group
        ref={liveMeshRef}
        visible={isSliding}
        position={[aimX, 0.836, 1.08]}
      >
        <mesh>
          <cylinderGeometry args={[0.032, 0.034, 0.018, 18]} />
          <meshStandardMaterial color="#F8FAFC" metalness={0.75} roughness={0.25} />
        </mesh>
        <mesh position={[0, 0.01, 0]}>
          <cylinderGeometry args={[0.024, 0.024, 0.004, 16]} />
          <meshBasicMaterial
            color={state.activeTeam === 'red' ? '#EF4444' : '#38BDF8'}
          />
        </mesh>
      </group>

      {/* Ready Puck Preview at Shooter End */}
      {!isSliding && (
        <group position={[aimX, 0.836, 1.08]}>
          <mesh>
            <cylinderGeometry args={[0.032, 0.034, 0.018, 18]} />
            <meshStandardMaterial color="#E2E8F0" metalness={0.75} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.01, 0]}>
            <cylinderGeometry args={[0.024, 0.024, 0.004, 16]} />
            <meshBasicMaterial
              color={state.activeTeam === 'red' ? '#EF4444' : '#38BDF8'}
            />
          </mesh>
        </group>
      )}

      {/* Overhead Illuminated Shuffleboard Scoreboard Arch (at Center Z = -0.15) */}
      <group position={[0, 1.32, -0.15]}>
        {/* Side support stanchions */}
        <mesh position={[-0.3, -0.25, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.52, 10]} />
          <meshStandardMaterial color="#E5A93C" metalness={0.75} roughness={0.25} />
        </mesh>
        <mesh position={[0.3, -0.25, 0]}>
          <cylinderGeometry args={[0.016, 0.016, 0.52, 10]} />
          <meshStandardMaterial color="#E5A93C" metalness={0.75} roughness={0.25} />
        </mesh>

        {/* Scoreboard Display Header (Double-Sided Readability + Brushed Metallic Outer Bezel) */}
        <RoundedBox args={[0.78, 0.34, 0.036]} radius={0.024} smoothness={2} position={[0, 0, -0.004]}>
          <meshStandardMaterial color="#1E293B" metalness={0.75} roughness={0.25} />
        </RoundedBox>
        <RoundedBox args={[0.74, 0.3, 0.04]} radius={0.02} smoothness={2}>
          <meshBasicMaterial color="#090E18" />
        </RoundedBox>
        <Text
          position={[0, 0.095, 0.024]}
          fontSize={0.034}
          color="#E5A93C"
          anchorX="center"
          anchorY="middle"
        >
          🥌 CLUBHOUSE SHUFFLEBOARD · FIRST TO 15
        </Text>
        <Text
          position={[-0.19, -0.005, 0.024]}
          fontSize={0.056}
          color="#EF4444"
          anchorX="center"
          anchorY="middle"
        >
          {`RED ${state.redScore}`}
        </Text>
        <Text
          position={[0.19, -0.005, 0.024]}
          fontSize={0.056}
          color="#38BDF8"
          anchorX="center"
          anchorY="middle"
        >
          {`BLUE ${state.blueScore}`}
        </Text>
        <Text
          position={[0, -0.095, 0.024]}
          fontSize={0.024}
          color="#CBD5E1"
          maxWidth={0.68}
          textAlign="center"
          anchorX="center"
          anchorY="middle"
        >
          {state.lastSummary}
        </Text>
      </group>

      {/* Interactive South Shooter Control Rail (localZ = +1.34) */}
      <group position={[0, 0.92, 1.34]} rotation={[-0.45, 0, 0]}>
        <RoundedBox args={[0.64, 0.24, 0.02]} radius={0.015}>
          <meshBasicMaterial color="#0B1220" />
        </RoundedBox>

        {/* Aim Left / Right & Zone Power Buttons */}
        <group
          position={[-0.22, 0.06, 0.014]}
          onClick={(e) => {
            e.stopPropagation()
            setAimX((x) => Number(Math.max(-0.14, x - 0.045).toFixed(3)))
          }}
        >
          <RoundedBox args={[0.14, 0.055, 0.01]} radius={0.008}>
            <meshBasicMaterial color="#1E293B" />
          </RoundedBox>
          <Text position={[0, 0, 0.008]} fontSize={0.022} color="#F8FAFC" anchorX="center" anchorY="middle">
            ◀ Aim L
          </Text>
        </group>

        <group
          position={[-0.06, 0.06, 0.014]}
          onClick={(e) => {
            e.stopPropagation()
            setAimX((x) => Number(Math.min(0.14, x + 0.045).toFixed(3)))
          }}
        >
          <RoundedBox args={[0.14, 0.055, 0.01]} radius={0.008}>
            <meshBasicMaterial color="#1E293B" />
          </RoundedBox>
          <Text position={[0, 0, 0.008]} fontSize={0.022} color="#F8FAFC" anchorX="center" anchorY="middle">
            Aim R ▶
          </Text>
        </group>

        {([1, 2, 3, 4] as const).map((z, idx) => (
          <group
            key={z}
            position={[0.07 + idx * 0.068, 0.06, 0.014]}
            onClick={(e) => {
              e.stopPropagation()
              setPowerPreset(z)
            }}
          >
            <RoundedBox args={[0.058, 0.055, 0.01]} radius={0.008}>
              <meshBasicMaterial color={powerPreset === z ? '#E5A93C' : '#1E293B'} />
            </RoundedBox>
            <Text
              position={[0, 0, 0.008]}
              fontSize={0.022}
              color={powerPreset === z ? '#080A0F' : '#F8FAFC'}
              anchorX="center"
              anchorY="middle"
            >
              {`${z}P`}
            </Text>
          </group>
        ))}

        {/* Slide Puck Button */}
        <group
          name="btn-shuffleboard-slide"
          position={[-0.12, -0.045, 0.014]}
          onClick={(e) => {
            e.stopPropagation()
            launchPuck(aimX, powerPreset)
          }}
        >
          <RoundedBox args={[0.32, 0.07, 0.012]} radius={0.01}>
            <meshBasicMaterial
              color={state.activeTeam === 'red' ? '#EF4444' : '#38BDF8'}
            />
          </RoundedBox>
          <Text
            position={[0, 0, 0.009]}
            fontSize={0.026}
            color="#040810"
            anchorX="center"
            anchorY="middle"
          >
            {`🥌 SLIDE ${state.activeTeam.toUpperCase()} PUCK`}
          </Text>
        </group>

        {/* Reset & Step Up Buttons */}
        <group
          name="btn-shuffleboard-reset"
          position={[0.14, -0.045, 0.014]}
          onClick={(e) => {
            e.stopPropagation()
            onReset()
          }}
        >
          <RoundedBox args={[0.13, 0.065, 0.01]} radius={0.008}>
            <meshBasicMaterial color="#334155" />
          </RoundedBox>
          <Text position={[0, 0, 0.008]} fontSize={0.021} color="#F8FAFC" anchorX="center" anchorY="middle">
            ↻ Reset
          </Text>
        </group>

        {onSnapToStation && (
          <group
            position={[0.26, -0.045, 0.014]}
            onClick={(e) => {
              e.stopPropagation()
              onSnapToStation()
            }}
          >
            <RoundedBox args={[0.09, 0.065, 0.01]} radius={0.008}>
              <meshBasicMaterial color="#0EA5E9" />
            </RoundedBox>
            <Text position={[0, 0, 0.008]} fontSize={0.02} color="#040810" anchorX="center" anchorY="middle">
              Stand
            </Text>
          </group>
        )}
      </group>
    </group>
  )
}
