import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import type {
  CornholeBagRecord,
  CornholeState,
  CornholeTeam,
} from '../../types/barGames'

export interface DeckCornhole3DProps {
  hallStartZ: number
  state: CornholeState
  localDisplayName: string
  onRecordThrow: (bag: CornholeBagRecord) => void
  onReset: () => void
  onSnapToStation?: () => void
}

interface FlyingBag {
  id: string
  team: CornholeTeam
  startPos: [number, number, number]
  targetPos: [number, number, number]
  localX: number
  localZ: number
  inHole: boolean
  points: 0 | 1 | 3
  elapsed: number
  duration: number
}

export function DeckCornhole3D({
  hallStartZ,
  state,
  localDisplayName,
  onRecordThrow,
  onReset,
  onSnapToStation,
}: DeckCornhole3DProps) {
  const z0 = hallStartZ
  const pitchX = 6.55
  const southBoardZ = z0 + 22.9
  const northBoardZ = z0 + 27.4

  const [aimOffset, setAimOffset] = useState(0)
  const flyingBagRef = useRef<FlyingBag | null>(null)
  const flyingMeshRef = useRef<THREE.Mesh>(null)
  const [isFlying, setIsFlying] = useState(false)

  const launchBag = (mode: 'hole-3pt' | 'board-1pt' | 'skill', clickLocalX?: number, clickLocalZ?: number) => {
    if (flyingBagRef.current) return
    const team: CornholeTeam = state.activeTeam

    let lx = clickLocalX ?? aimOffset
    let lz = clickLocalZ ?? 0.08
    if (mode === 'hole-3pt') {
      lx = Number(((Math.random() - 0.5) * 0.04).toFixed(3))
      lz = -0.26
    } else if (mode === 'board-1pt') {
      lx = Number((aimOffset + (Math.random() - 0.5) * 0.14).toFixed(3))
      lz = Number((0.12 + (Math.random() - 0.5) * 0.22).toFixed(3))
    }

    const distToHole = Math.hypot(lx, lz - -0.26)
    const inHole = distToHole <= 0.115
    const onBoard = !inHole && Math.abs(lx) <= 0.29 && Math.abs(lz) <= 0.56
    const points: 0 | 1 | 3 = inHole ? 3 : onBoard ? 1 : 0

    const startPos: [number, number, number] = [pitchX, 0.92, southBoardZ + 0.35]
    const targetPos: [number, number, number] = [
      pitchX + lx,
      inHole ? 0.08 : 0.22 - lz * 0.16,
      northBoardZ + lz,
    ]

    flyingBagRef.current = {
      id: `bag-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
      team,
      startPos,
      targetPos,
      localX: Number(lx.toFixed(3)),
      localZ: Number(lz.toFixed(3)),
      inHole,
      points,
      elapsed: 0,
      duration: 0.52,
    }
    setIsFlying(true)
  }

  useFrame((_, delta) => {
    const fb = flyingBagRef.current
    if (!fb) return
    fb.elapsed += Math.min(delta, 0.05)
    const t = Math.min(1, fb.elapsed / fb.duration)
    const x = THREE.MathUtils.lerp(fb.startPos[0], fb.targetPos[0], t)
    const z = THREE.MathUtils.lerp(fb.startPos[2], fb.targetPos[2], t)
    const arcY =
      THREE.MathUtils.lerp(fb.startPos[1], fb.targetPos[1], t) +
      Math.sin(t * Math.PI) * 1.15

    if (flyingMeshRef.current) {
      flyingMeshRef.current.position.set(x, arcY, z)
      flyingMeshRef.current.rotation.x += delta * 6.5
      flyingMeshRef.current.rotation.z += delta * 4.2
    }

    if (t >= 1) {
      const settled: CornholeBagRecord = {
        id: fb.id,
        team: fb.team,
        boardIndex: 1,
        localX: fb.localX,
        localZ: fb.localZ,
        inHole: fb.inHole,
        points: fb.points,
        thrownBy: localDisplayName,
      }
      flyingBagRef.current = null
      setIsFlying(false)
      onRecordThrow(settled)
    }
  })

  return (
    <group name="deck-cornhole-pitch">
      {/* Pitching Lane Side Striping on Outdoor Deck */}
      {[-0.48, 0.48].map((dx) => (
        <mesh
          key={dx}
          position={[pitchX + dx, 0.014, (southBoardZ + northBoardZ) / 2]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[0.025, 5.4]} />
          <meshBasicMaterial color="#F59E0B" transparent opacity={0.55} />
        </mesh>
      ))}

      {/* SOUTH CORNHOLE BOARD (Shooter End Board, angled facing +Z) */}
      <group position={[pitchX, 0, southBoardZ]} rotation={[0, Math.PI, 0]}>
        <group position={[0, 0.19, 0]} rotation={[0.175, 0, 0]}>
          <RoundedBox args={[0.62, 0.045, 1.18]} radius={0.015} smoothness={2}>
            <meshStandardMaterial color="#D6A86E" roughness={0.42} metalness={0.08} />
          </RoundedBox>
          {/* Decorative Alpine Chevron Stripe */}
          <mesh position={[0, 0.024, 0.16]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.18, 0.24, 4]} />
            <meshBasicMaterial color="#0EA5E9" />
          </mesh>
          {/* 6-inch Cornhole Target Hole */}
          <mesh position={[0, 0.025, -0.26]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.105, 24]} />
            <meshBasicMaterial color="#050811" />
          </mesh>
          <mesh position={[0, 0.026, -0.26]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.105, 0.125, 24]} />
            <meshBasicMaterial color="#F59E0B" />
          </mesh>
        </group>
      </group>

      {/* NORTH / LAKE-VISTA TARGET CORNHOLE BOARD (Click board or hole to toss!) */}
      <group
        name="deck-cornhole-target-board"
        position={[pitchX, 0, northBoardZ]}
      >
        <group
          position={[0, 0.19, 0]}
          rotation={[0.175, 0, 0]}
          onClick={(e) => {
            e.stopPropagation()
            const lx = Math.max(-0.28, Math.min(0.28, e.point.x - pitchX))
            const lz = Math.max(-0.54, Math.min(0.54, e.point.z - northBoardZ))
            launchBag('skill', lx, lz)
          }}
        >
          <RoundedBox args={[0.62, 0.045, 1.18]} radius={0.015} smoothness={2}>
            <meshStandardMaterial color="#D6A86E" roughness={0.42} metalness={0.08} />
          </RoundedBox>
          {/* Decorative Gold & Cyan Border */}
          <mesh position={[0, 0.024, 0.16]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <ringGeometry args={[0.18, 0.24, 4]} />
            <meshBasicMaterial color="#F59E0B" />
          </mesh>
          {/* Target Hole (3 PTS) */}
          <mesh
            name="deck-cornhole-target-hole"
            position={[0, 0.025, -0.26]}
            rotation={[-Math.PI / 2, 0, 0]}
            onClick={(e) => {
              e.stopPropagation()
              launchBag('hole-3pt')
            }}
          >
            <circleGeometry args={[0.108, 24]} />
            <meshBasicMaterial color="#050811" />
          </mesh>
          <mesh
            position={[0, 0.026, -0.26]}
            rotation={[-Math.PI / 2, 0, 0]}
            raycast={() => null}
          >
            <ringGeometry args={[0.108, 0.132, 24]} />
            <meshBasicMaterial color="#34D399" />
          </mesh>

          {/* Synced Beanbags Landed on the Target Board */}
          {state.bags
            .filter((b) => !b.inHole && b.points > 0)
            .map((bag) => (
              <RoundedBox
                key={bag.id}
                args={[0.11, 0.028, 0.11]}
                position={[bag.localX, 0.036, bag.localZ]}
                rotation={[0, 0.35, 0]}
                radius={0.008}
              >
                <meshStandardMaterial
                  color={bag.team === 'gold' ? '#F59E0B' : '#06B6D4'}
                  roughness={0.75}
                />
              </RoundedBox>
            ))}
        </group>
      </group>

      {/* Live Beanbag in Flight */}
      <mesh
        ref={flyingMeshRef}
        visible={isFlying}
        position={[pitchX, 0.9, southBoardZ]}
      >
        <boxGeometry args={[0.11, 0.03, 0.11]} />
        <meshStandardMaterial
          color={state.activeTeam === 'gold' ? '#F59E0B' : '#06B6D4'}
          roughness={0.7}
        />
      </mesh>

      {/* 3D Synced Cornhole Scoreboard Post & Interactive Toss Controls */}
      <group
        name="deck-cornhole-scoreboard"
        position={[pitchX + 0.92, 0, z0 + 23.45]}
        rotation={[0, -Math.PI * 0.72, 0]}
      >
        {/* Timber Post */}
        <mesh position={[0, 0.62, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 1.24, 12]} />
          <meshStandardMaterial color="#3A2418" roughness={0.7} />
        </mesh>

        {/* Scoreboard Tablet */}
        <group position={[0, 1.22, 0.04]}>
          <RoundedBox args={[0.98, 0.68, 0.035]} radius={0.025} smoothness={2}>
            <meshBasicMaterial color="#09111E" />
          </RoundedBox>
          <mesh position={[0, 0.31, 0.02]}>
            <planeGeometry args={[0.92, 0.02]} />
            <meshBasicMaterial color="#F59E0B" />
          </mesh>

          <Text
            position={[0, 0.24, 0.022]}
            fontSize={0.044}
            color="#FDE68A"
            anchorX="center"
            anchorY="middle"
          >
            🌽 LAKE DECK CORNHOLE · 3 PT HOLE / 1 PT BOARD
          </Text>

          <Text
            position={[-0.24, 0.12, 0.022]}
            fontSize={0.068}
            color="#F59E0B"
            anchorX="center"
            anchorY="middle"
          >
            {`GOLD ${state.goldScore}`}
          </Text>
          <Text
            position={[0.24, 0.12, 0.022]}
            fontSize={0.068}
            color="#38BDF8"
            anchorX="center"
            anchorY="middle"
          >
            {`CYAN ${state.cyanScore}`}
          </Text>

          <Text
            position={[0, 0.01, 0.022]}
            fontSize={0.028}
            color="#CBD5E1"
            maxWidth={0.88}
            textAlign="center"
            anchorX="center"
            anchorY="middle"
          >
            {state.lastSummary}
          </Text>

          {/* Interactive Toss Action Buttons */}
          <group
            name="btn-cornhole-toss-hole"
            position={[-0.24, -0.13, 0.022]}
            onClick={(e) => {
              e.stopPropagation()
              launchBag('hole-3pt')
            }}
          >
            <RoundedBox args={[0.42, 0.09, 0.012]} radius={0.012}>
              <meshBasicMaterial color="#10B981" />
            </RoundedBox>
            <Text position={[0, 0, 0.009]} fontSize={0.03} color="#040810" anchorX="center" anchorY="middle">
              🎯 Toss Cornhole (+3)
            </Text>
          </group>

          <group
            name="btn-cornhole-toss-board"
            position={[0.24, -0.13, 0.022]}
            onClick={(e) => {
              e.stopPropagation()
              launchBag('board-1pt')
            }}
          >
            <RoundedBox args={[0.42, 0.09, 0.012]} radius={0.012}>
              <meshBasicMaterial color="#F59E0B" />
            </RoundedBox>
            <Text position={[0, 0, 0.009]} fontSize={0.03} color="#040810" anchorX="center" anchorY="middle">
              🪵 Toss on Board (+1)
            </Text>
          </group>

          {/* Aim Adjust & Reset Row */}
          <group
            position={[-0.31, -0.25, 0.022]}
            onClick={(e) => {
              e.stopPropagation()
              setAimOffset((x) => Number(Math.max(-0.22, x - 0.06).toFixed(2)))
            }}
          >
            <RoundedBox args={[0.24, 0.07, 0.01]} radius={0.01}>
              <meshBasicMaterial color="#1E293B" />
            </RoundedBox>
            <Text position={[0, 0, 0.008]} fontSize={0.024} color="#F8FAFC" anchorX="center" anchorY="middle">
              ◀ Aim L
            </Text>
          </group>

          <group
            position={[-0.04, -0.25, 0.022]}
            onClick={(e) => {
              e.stopPropagation()
              setAimOffset((x) => Number(Math.min(0.22, x + 0.06).toFixed(2)))
            }}
          >
            <RoundedBox args={[0.24, 0.07, 0.01]} radius={0.01}>
              <meshBasicMaterial color="#1E293B" />
            </RoundedBox>
            <Text position={[0, 0, 0.008]} fontSize={0.024} color="#F8FAFC" anchorX="center" anchorY="middle">
              Aim R ▶
            </Text>
          </group>

          <group
            name="btn-cornhole-reset"
            position={[0.22, -0.25, 0.022]}
            onClick={(e) => {
              e.stopPropagation()
              onReset()
            }}
          >
            <RoundedBox args={[0.22, 0.07, 0.01]} radius={0.01}>
              <meshBasicMaterial color="#334155" />
            </RoundedBox>
            <Text position={[0, 0, 0.008]} fontSize={0.024} color="#F8FAFC" anchorX="center" anchorY="middle">
              ↻ Reset
            </Text>
          </group>

          {onSnapToStation && (
            <group
              position={[0.4, -0.25, 0.022]}
              onClick={(e) => {
                e.stopPropagation()
                onSnapToStation()
              }}
            >
              <RoundedBox args={[0.11, 0.07, 0.01]} radius={0.01}>
                <meshBasicMaterial color="#38BDF8" />
              </RoundedBox>
              <Text position={[0, 0, 0.008]} fontSize={0.022} color="#040810" anchorX="center" anchorY="middle">
                Pitch
              </Text>
            </group>
          )}
        </group>
      </group>
    </group>
  )
}
