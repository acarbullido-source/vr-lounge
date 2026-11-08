import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  checkConnect4Winner,
  createInitialCheckersBoard,
  createInitialChessBoard,
  createInitialConnect4Grid,
  getCheckersLegalMoves,
  getChessLegalMoves,
} from '../../constants/barGames'
import type { ExpansionWingLayout } from '../../constants/expansionRooms'
import {
  createArcadeCabinetEngine,
  type ArcadeCabinetEngine,
  type ClassicArcadeGameId,
} from '../../services/arcadeMachines'
import type {
  HolotableGameMode,
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
  hpOverride,
  isSelected,
  onSelect,
}: {
  mini: HolotableMiniature
  hpOverride?: number
  isSelected: boolean
  onSelect: () => void
}) {
  const maxHp = mini.maxHp ?? (mini.kind.startsWith('monster-') ? 120 : 40)
  const curHp = hpOverride !== undefined ? hpOverride : (mini.hp ?? maxHp)

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

      {/* Floating Miniature Nameplate + Live HP Badge */}
      <Text
        position={[0, 0.26, 0]}
        fontSize={0.026}
        color={isSelected ? '#38BDF8' : '#F8FAFC'}
        anchorX="center"
        anchorY="middle"
      >
        {`${mini.label} (${curHp}/${maxHp} HP)`}
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

const CHESS_GLYPHS: Record<string, string> = {
  wK: '♔',
  wQ: '♕',
  wR: '♖',
  wB: '♗',
  wN: '♘',
  wP: '♙',
  bK: '♚',
  bQ: '♛',
  bR: '♜',
  bB: '♝',
  bN: '♞',
  bP: '♟',
}

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
  // Expanded Grand Game Room dimensions: 15.2m wide x 11.2m deep (x in [1.65..16.85], z in [z0+9.5..z0+20.7])
  const centerX = 9.25
  const roomW = 15.2
  const roomD = 11.2
  const roomH = 4.05
  const brightnessScale = Math.max(0.6, Math.min(1.65, lighting.brightness))

  // =========================================================================
  // CENTERPIECE TABLE: 4 PLAYABLE MODES (RPG / CHECKERS / CHESS / CONNECT-4)
  // =========================================================================
  const [tableMode, setTableMode] = useState<HolotableGameMode>(
    holotableState.gameMode ?? 'adventure-rpg',
  )
  const [rpgRound, setRpgRound] = useState(1)
  const [rpgCombatLog, setRpgCombatLog] = useState<string[]>([
    '⚔️ Round 1: Party enters the Elder Dragon Sanctum!',
    '🛡️ Select any Hero and click Melee Attack, Cast Spell, or Heal!',
  ])
  const [miniHpMap, setMiniHpMap] = useState<Record<string, number>>({})

  // Checkers 8x8 State
  const [checkersBoard, setCheckersBoard] = useState<number[]>(() =>
    createInitialCheckersBoard(),
  )
  const [checkersTurn, setCheckersTurn] = useState<'red' | 'black'>('red')
  const [checkersSelected, setCheckersSelected] = useState<number | null>(null)
  const [checkersWinner, setCheckersWinner] = useState<'red' | 'black' | null>(null)
  const [checkersBanner, setCheckersBanner] = useState(
    '🔴 RED moves first — click a Red checker, then click a highlighted diagonal square!',
  )

  // Chess 8x8 State
  const [chessBoard, setChessBoard] = useState<string[]>(() => createInitialChessBoard())
  const [chessTurn, setChessTurn] = useState<'w' | 'b'>('w')
  const [chessSelected, setChessSelected] = useState<number | null>(null)
  const [chessWinner, setChessWinner] = useState<'w' | 'b' | null>(null)
  const [chessBanner, setChessBanner] = useState(
    '♟️ GOLD (White) moves first — click any Gold piece to highlight legal squares!',
  )

  // Connect-4 6x7 State
  const [connect4Grid, setConnect4Grid] = useState<number[]>(() =>
    createInitialConnect4Grid(),
  )
  const [connect4Turn, setConnect4Turn] = useState<1 | 2>(1)
  const [connect4Winner, setConnect4Winner] = useState<1 | 2 | null>(null)
  const [connect4Banner, setConnect4Banner] = useState(
    '🟡 GOLD drops first — click any Column 1–7 to drop a disc!',
  )

  // =========================================================================
  // PERIMETER ARCADE: 4 LIVE 60FPS CLASSIC CRT ENGINES + 3D HOOPS & SKEE-BALL
  // =========================================================================
  const [activeCabinetId, setActiveCabinetId] =
    useState<ClassicArcadeGameId>('pac-maze')
  const [cabinetScores, setCabinetScores] = useState<Record<ClassicArcadeGameId, number>>({
    'pac-maze': 0,
    galaxia: 0,
    frogger: 0,
    arkanoid: 0,
  })

  const arcadeEngines = useMemo<Record<ClassicArcadeGameId, ArcadeCabinetEngine>>(() => {
    const ids: ClassicArcadeGameId[] = ['pac-maze', 'galaxia', 'frogger', 'arkanoid']
    const map = {} as Record<ClassicArcadeGameId, ArcadeCabinetEngine>
    for (const id of ids) {
      map[id] = createArcadeCabinetEngine(id, (finalScore, title) => {
        onRecordArcadeScore('arcade-retro', finalScore, title)
      })
    }
    return map
  }, [onRecordArcadeScore])

  // Keyboard listener for active arcade cabinet when player is in Game Room
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA')
      ) {
        return
      }
      const eng = arcadeEngines[activeCabinetId]
      if (!eng) return
      if (e.code === 'ArrowUp' || e.code === 'KeyI') eng.sendInput('up')
      else if (e.code === 'ArrowDown' || e.code === 'KeyK') eng.sendInput('down')
      else if (e.code === 'ArrowLeft' || e.code === 'KeyJ') eng.sendInput('left')
      else if (e.code === 'ArrowRight' || e.code === 'KeyL') eng.sendInput('right')
      else if (e.code === 'Space') eng.sendInput('action')
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [activeCabinetId, arcadeEngines])

  // Pop-A-Shot 3D Flying Basketball & Skee-Ball 3D Rolling Ball Physics State
  const [hoopsScore, setHoopsScore] = useState(36)
  const [hoopsStreak, setHoopsStreak] = useState(3)
  const [hoopsAimX, setHoopsAimX] = useState(0) // -0.25..+0.25
  const hoopsBallFlightRef = useRef<{
    active: boolean
    t: number
    startX: number
    targetX: number
    swish: boolean
  }>({ active: false, t: 0, startX: 0, targetX: 0, swish: true })
  const hoopsFlyingMeshRef = useRef<THREE.Mesh>(null)

  const [skeeScore, setSkeeScore] = useState(250)
  const [skeePower, setSkeePower] = useState<'50' | '100'>('100')
  const skeeBallRollRef = useRef<{
    active: boolean
    t: number
    pts: number
  }>({ active: false, t: 0, pts: 100 })
  const skeeFlyingMeshRef = useRef<THREE.Mesh>(null)

  const holoRingRef = useRef<THREE.Mesh>(null)
  const scoreSyncTickRef = useRef(0)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05)
    if (holoRingRef.current) {
      holoRingRef.current.rotation.z += dt * 0.28
    }

    // Step all 4 classic arcade CRT engines
    arcadeEngines['pac-maze'].step(dt)
    arcadeEngines.galaxia.step(dt)
    arcadeEngines.frogger.step(dt)
    arcadeEngines.arkanoid.step(dt)

    scoreSyncTickRef.current += dt
    if (scoreSyncTickRef.current >= 0.4) {
      scoreSyncTickRef.current = 0
      setCabinetScores((prev) => {
        const pScore = arcadeEngines['pac-maze'].getScore()
        const gScore = arcadeEngines.galaxia.getScore()
        const fScore = arcadeEngines.frogger.getScore()
        const aScore = arcadeEngines.arkanoid.getScore()
        if (
          prev['pac-maze'] === pScore &&
          prev.galaxia === gScore &&
          prev.frogger === fScore &&
          prev.arkanoid === aScore
        ) {
          return prev
        }
        return {
          'pac-maze': pScore,
          galaxia: gScore,
          frogger: fScore,
          arkanoid: aScore,
        }
      })
    }

    // Animate 3D Pop-A-Shot flying basketball arc
    if (hoopsBallFlightRef.current.active && hoopsFlyingMeshRef.current) {
      hoopsBallFlightRef.current.t += dt * 1.85
      const u = Math.min(1, hoopsBallFlightRef.current.t)
      const bx = THREE.MathUtils.lerp(
        hoopsBallFlightRef.current.startX,
        hoopsBallFlightRef.current.targetX,
        u,
      )
      const bz = THREE.MathUtils.lerp(0.58, -0.12, u)
      const by = 0.95 + (1.82 - 0.95) * u + Math.sin(u * Math.PI) * 0.56
      hoopsFlyingMeshRef.current.visible = true
      hoopsFlyingMeshRef.current.position.set(bx, by, bz)
      hoopsFlyingMeshRef.current.rotation.x -= dt * 12
      if (u >= 1) {
        hoopsBallFlightRef.current.active = false
        hoopsFlyingMeshRef.current.visible = false
      }
    }

    // Animate 3D Skee-Ball ramp roll & launch into target rings
    if (skeeBallRollRef.current.active && skeeFlyingMeshRef.current) {
      skeeBallRollRef.current.t += dt * 1.9
      const u = Math.min(1, skeeBallRollRef.current.t)
      const bz = THREE.MathUtils.lerp(0.68, -0.32, u)
      const by =
        u < 0.55
          ? THREE.MathUtils.lerp(0.84, 1.15, u / 0.55)
          : THREE.MathUtils.lerp(1.15, 1.68, (u - 0.55) / 0.45) +
            Math.sin(((u - 0.55) / 0.45) * Math.PI) * 0.25
      skeeFlyingMeshRef.current.visible = true
      skeeFlyingMeshRef.current.position.set(0, by, bz)
      skeeFlyingMeshRef.current.rotation.x -= dt * 16
      if (u >= 1) {
        skeeBallRollRef.current.active = false
        skeeFlyingMeshRef.current.visible = false
      }
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

  // Legal moves for selected Checkers / Chess square
  const checkersLegalTargets = useMemo(() => {
    if (checkersSelected === null) return new Map<number, number | null>()
    const moves = getCheckersLegalMoves(checkersBoard, checkersSelected, checkersTurn)
    const map = new Map<number, number | null>()
    for (const m of moves) map.set(m.toIdx, m.jumpedIdx)
    return map
  }, [checkersBoard, checkersSelected, checkersTurn])

  const chessLegalTargets = useMemo(() => {
    if (chessSelected === null) return new Set<number>()
    return new Set(getChessLegalMoves(chessBoard, chessSelected, chessTurn))
  }, [chessBoard, chessSelected, chessTurn])

  const handleCheckersSquareClick = (idx: number) => {
    if (checkersWinner) return
    const piece = checkersBoard[idx] ?? 0
    const isOwn =
      (checkersTurn === 'red' && (piece === 1 || piece === 3)) ||
      (checkersTurn === 'black' && (piece === 2 || piece === 4))

    if (isOwn) {
      setCheckersSelected(idx)
      setCheckersBanner(
        `Selected ${checkersTurn.toUpperCase()} checker — click a glowing green target square!`,
      )
      return
    }

    if (checkersSelected !== null && checkersLegalTargets.has(idx)) {
      const jumpedIdx = checkersLegalTargets.get(idx) ?? null
      const next = [...checkersBoard]
      let moving = next[checkersSelected]
      next[checkersSelected] = 0
      if (jumpedIdx !== null) next[jumpedIdx] = 0
      const destRow = Math.floor(idx / 8)
      if (moving === 1 && destRow === 0) moving = 3
      if (moving === 2 && destRow === 7) moving = 4
      next[idx] = moving

      const redRemaining = next.some((p) => p === 1 || p === 3)
      const blackRemaining = next.some((p) => p === 2 || p === 4)
      const win: 'red' | 'black' | null = !blackRemaining
        ? 'red'
        : !redRemaining
          ? 'black'
          : null
      const nextTurn = checkersTurn === 'red' ? 'black' : 'red'

      setCheckersBoard(next)
      setCheckersSelected(null)
      setCheckersTurn(nextTurn)
      setCheckersWinner(win)
      setCheckersBanner(
        win
          ? `🏆 ${win.toUpperCase()} WINS CHECKERS! Click Reset Board for a rematch!`
          : `${checkersTurn.toUpperCase()} moved${jumpedIdx !== null ? ' (JUMP CAPTURE!)' : ''} · ${nextTurn.toUpperCase()}'s turn!`,
      )
    }
  }

  const handleChessSquareClick = (idx: number) => {
    if (chessWinner) return
    const piece = chessBoard[idx] || ''
    if (piece && piece[0] === chessTurn) {
      setChessSelected(idx)
      setChessBanner(
        `Selected ${chessTurn === 'w' ? 'Gold' : 'Obsidian'} ${piece[1]} — click a highlighted square to move!`,
      )
      return
    }

    if (chessSelected !== null && chessLegalTargets.has(idx)) {
      const next = [...chessBoard]
      let moving = next[chessSelected]
      const captured = next[idx]
      next[chessSelected] = ''
      const destRow = Math.floor(idx / 8)
      if (moving === 'wP' && destRow === 0) moving = 'wQ'
      if (moving === 'bP' && destRow === 7) moving = 'bQ'
      next[idx] = moving

      const win: 'w' | 'b' | null =
        captured === 'bK' ? 'w' : captured === 'wK' ? 'b' : null
      const nextTurn = chessTurn === 'w' ? 'b' : 'w'

      setChessBoard(next)
      setChessSelected(null)
      setChessTurn(nextTurn)
      setChessWinner(win)
      setChessBanner(
        win
          ? `🏆 CHECKMATE! ${win === 'w' ? 'GOLD' : 'OBSIDIAN'} WINS CHESS!`
          : `♟️ Moved ${moving}${captured ? ` (captured ${captured})` : ''} · ${nextTurn === 'w' ? 'GOLD' : 'OBSIDIAN'}'s turn!`,
      )
    }
  }

  const handleConnect4Drop = (col: number) => {
    if (connect4Winner || col < 0 || col >= 7) return
    const next = [...connect4Grid]
    let placedRow = -1
    for (let r = 5; r >= 0; r--) {
      if (next[r * 7 + col] === 0) {
        next[r * 7 + col] = connect4Turn
        placedRow = r
        break
      }
    }
    if (placedRow === -1) return
    const win = checkConnect4Winner(next)
    const nextTurn: 1 | 2 = connect4Turn === 1 ? 2 : 1
    setConnect4Grid(next)
    setConnect4Turn(nextTurn)
    setConnect4Winner(win)
    setConnect4Banner(
      win
        ? `🏆 ${win === 1 ? 'GOLD' : 'CYAN'} CONNECTS 4 IN A ROW & WINS!`
        : `Dropped ${connect4Turn === 1 ? 'GOLD' : 'CYAN'} disc in Col ${col + 1} · ${nextTurn === 1 ? 'GOLD' : 'CYAN'}'s turn!`,
    )
  }

  const handleRpgAction = (kind: 'melee' | 'spell' | 'heal') => {
    const d20 = Math.floor(Math.random() * 20) + 1
    const dmg =
      kind === 'melee'
        ? Math.floor(Math.random() * 10) + 7 + (d20 === 20 ? 12 : 0)
        : kind === 'spell'
          ? Math.floor(Math.random() * 14) + 9 + (d20 === 20 ? 15 : 0)
          : Math.floor(Math.random() * 10) + 10

    const actor = selectedMini?.label ?? 'Hero'
    const boss =
      holotableState.miniatures.find((m) => m.kind.startsWith('monster-')) ??
      holotableState.miniatures[holotableState.miniatures.length - 1]

    if (kind === 'heal' && selectedMini) {
      setMiniHpMap((prev) => {
        const max = selectedMini.maxHp ?? 45
        const cur = prev[selectedMini.id] ?? selectedMini.hp ?? max
        return { ...prev, [selectedMini.id]: Math.min(max, cur + dmg) }
      })
      setRpgCombatLog((prev) => [
        `✨ ${actor} cast Divine Heal (+${dmg} HP)!`,
        ...prev.slice(0, 4),
      ])
    } else if (boss) {
      const hit = d20 >= 7
      if (hit) {
        setMiniHpMap((prev) => {
          const max = boss.maxHp ?? 120
          const cur = prev[boss.id] ?? boss.hp ?? max
          return { ...prev, [boss.id]: Math.max(0, cur - dmg) }
        })
      }
      const line =
        d20 === 20
          ? `🔥 NAT 20 CRIT! ${actor} dealt ${dmg} DMG to ${boss.label}!`
          : hit
            ? `⚔️ ${actor} rolled D20(${d20}) HIT ${boss.label} for ${dmg} DMG!`
            : `🛡️ ${actor} rolled D20(${d20}) — ${boss.label} parried!`
      setRpgCombatLog((prev) => [line, ...prev.slice(0, 4)])
      setRpgRound((r) => r + 1)
    }
  }

  return (
    <group name="wing-game-room">
      {/* Expanded Neon Synthwave Slate Floor (15.2m x 11.2m — Double-Click to Walk / Glide) */}
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

      {/* Luminous Neon Floor Grid Strips across Expanded 15.2m x 11.2m Arena */}
      {[3.5, 6.4, 9.25, 12.1, 15.0].map((gx, i) => (
        <mesh
          key={gx}
          position={[gx, 0.011, gameRoomZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[0.035, roomD - 0.6]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#A855F7' : '#38BDF8'} />
        </mesh>
      ))}
      {[-4.2, -2.1, 0, 2.1, 4.2].map((gzOff, i) => (
        <mesh
          key={gzOff}
          position={[centerX, 0.011, gameRoomZ + gzOff]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[roomW - 0.6, 0.035]} />
          <meshBasicMaterial color={i === 2 ? '#EC4899' : '#A855F7'} />
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
        <ringGeometry args={[2.8, 3.0, 40]} />
        <meshBasicMaterial color="#A855F7" side={THREE.DoubleSide} />
      </mesh>
      <mesh
        position={[centerX, roomH - 0.045, gameRoomZ]}
        rotation={[Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <ringGeometry args={[1.65, 1.78, 32]} />
        <meshBasicMaterial color="#38BDF8" side={THREE.DoubleSide} />
      </mesh>

      {/* East Perimeter Wall (x = +16.85), North Wall (z0 + 9.5), South Wall (z0 + 20.7) */}
      <mesh position={[16.85, roomH / 2, gameRoomZ]}>
        <boxGeometry args={[0.14, roomH, roomD]} />
        <meshStandardMaterial
          color="#1A1638"
          roughness={0.68}
          metalness={0.25}
          emissive="#100D26"
          emissiveIntensity={0.32 * brightnessScale}
        />
      </mesh>
      <mesh position={[centerX, roomH / 2, z0 + 9.5]}>
        <boxGeometry args={[roomW, roomH, 0.14]} />
        <meshStandardMaterial
          color="#1A1638"
          roughness={0.7}
          metalness={0.22}
          emissive="#100D26"
          emissiveIntensity={0.32 * brightnessScale}
        />
      </mesh>
      <mesh position={[centerX, roomH / 2, z0 + 20.7]}>
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
        position={[centerX, 3.65, gameRoomZ]}
        color="#E9D5FF"
        intensity={18.5 * brightnessScale}
        distance={22}
        decay={1.2}
        castShadow={false}
      />

      {/* =================================================================== */}
      {/* 1. NORTH WALL: MIRRORED MAIN VIDEO STREAM SCREEN + LOCAL MUTE       */}
      {/*    Reuses the single shared `mainVideoTexture` instance             */}
      {/* =================================================================== */}
      <group
        name="game-room-video-mirror-screen"
        position={[centerX, 2.22, z0 + 9.64]}
        rotation={[0, 0, 0]}
      >
        <RoundedBox args={[4.45, 2.52, 0.05]} radius={0.03} smoothness={2}>
          <meshStandardMaterial color="#090D1A" metalness={0.55} roughness={0.35} />
        </RoundedBox>
        <mesh position={[0, 1.19, 0.028]}>
          <planeGeometry args={[4.25, 0.025]} />
          <meshBasicMaterial color="#A855F7" />
        </mesh>

        {/* Shared VideoTexture Surface (or Live 3D Lounge Mirror Feed when idle) */}
        <mesh position={[0, 0.06, 0.029]}>
          <planeGeometry args={[4.2, 2.15]} />
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
        <group position={[0, -1.1, 0.032]}>
          <Text
            position={[-2.02, 0, 0]}
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
            position={[1.15, 0, 0]}
            width={1.74}
            height={0.13}
            fontSize={0.044}
            active={!gameRoomStreamMuted}
            accent={gameRoomStreamMuted ? '#EF4444' : '#10B981'}
            onClick={onToggleGameRoomStreamMute}
          />
        </group>
      </group>

      {/* =================================================================== */}
      {/* 2. PERIMETER OF 6 FULLY PLAYABLE CLASSIC ARCADE MACHINES            */}
      {/*    4 Live 60fps Classic CRT Cabinets + 3D Physics Hoops & Skee-Ball */}
      {/* =================================================================== */}

      {/* A) 4 PLAYABLE CLASSIC CRT ARCADE CABINETS ALONG SOUTH WALL */}
      {(
        [
          {
            id: 'pac-maze' as ClassicArcadeGameId,
            pos: [4.6, 0, z0 + 19.92] as [number, number, number],
          },
          {
            id: 'galaxia' as ClassicArcadeGameId,
            pos: [7.6, 0, z0 + 19.92] as [number, number, number],
          },
          {
            id: 'frogger' as ClassicArcadeGameId,
            pos: [10.6, 0, z0 + 19.92] as [number, number, number],
          },
          {
            id: 'arkanoid' as ClassicArcadeGameId,
            pos: [13.6, 0, z0 + 19.92] as [number, number, number],
          },
        ] as const
      ).map((slot) => {
        const eng = arcadeEngines[slot.id]
        const isFocused = activeCabinetId === slot.id
        const curScore = cabinetScores[slot.id] ?? 0
        return (
          <group
            key={slot.id}
            name={`arcade-cabinet-${slot.id}`}
            position={slot.pos}
            rotation={[0, Math.PI, 0]}
            onClick={(e) => {
              e.stopPropagation()
              setActiveCabinetId(slot.id)
            }}
          >
            {/* Classic Upright Arcade Cabinet Body */}
            <RoundedBox args={[1.18, 2.22, 0.78]} position={[0, 1.11, 0]} radius={0.035}>
              <meshStandardMaterial
                color={isFocused ? '#1E1B4B' : '#0F172A'}
                roughness={0.42}
                metalness={0.38}
              />
            </RoundedBox>
            {/* Side Neon Trim */}
            {[-0.595, 0.595].map((sx) => (
              <mesh key={sx} position={[sx, 1.12, 0.35]}>
                <boxGeometry args={[0.022, 2.08, 0.045]} />
                <meshBasicMaterial color={eng.accentColor} />
              </mesh>
            ))}
            {/* Glowing Top Marquee */}
            <mesh position={[0, 2.04, 0.395]}>
              <planeGeometry args={[1.08, 0.24]} />
              <meshBasicMaterial color={eng.accentColor} />
            </mesh>
            <Text
              position={[0, 2.06, 0.402]}
              fontSize={0.062}
              color="#040810"
              anchorX="center"
              anchorY="middle"
            >
              {eng.title}
            </Text>
            <Text
              position={[0, 1.96, 0.402]}
              fontSize={0.028}
              color="#0F172A"
              anchorX="center"
              anchorY="middle"
            >
              {eng.subtitle}
            </Text>

            {/* LIVE 60FPS HTML5 CANVAS CRT SCREEN */}
            <mesh
              name={`arcade-screen-${slot.id}`}
              position={[0, 1.46, 0.396]}
              onClick={(e) => {
                e.stopPropagation()
                setActiveCabinetId(slot.id)
                eng.sendInput('action')
              }}
            >
              <planeGeometry args={[0.98, 0.74]} />
              <meshBasicMaterial
                map={eng.texture}
                color="#ffffff"
                toneMapped={false}
              />
            </mesh>

            {/* Interactive 3D Joystick & Arcade Buttons Deck */}
            <group position={[0, 0.96, 0.43]}>
              <HoloButton3D
                name={`btn-arcade-${slot.id}-left`}
                label="◀"
                position={[-0.38, 0.04, 0]}
                width={0.18}
                height={0.08}
                fontSize={0.034}
                accent={eng.accentColor}
                onClick={() => {
                  setActiveCabinetId(slot.id)
                  eng.sendInput('left')
                }}
              />
              <HoloButton3D
                name={`btn-arcade-${slot.id}-up`}
                label="▲"
                position={[-0.18, 0.08, 0]}
                width={0.18}
                height={0.072}
                fontSize={0.03}
                accent={eng.accentColor}
                onClick={() => {
                  setActiveCabinetId(slot.id)
                  eng.sendInput('up')
                }}
              />
              <HoloButton3D
                name={`btn-arcade-${slot.id}-down`}
                label="▼"
                position={[-0.18, 0.0, 0]}
                width={0.18}
                height={0.072}
                fontSize={0.03}
                accent={eng.accentColor}
                onClick={() => {
                  setActiveCabinetId(slot.id)
                  eng.sendInput('down')
                }}
              />
              <HoloButton3D
                name={`btn-arcade-${slot.id}-right`}
                label="▶"
                position={[0.02, 0.04, 0]}
                width={0.18}
                height={0.08}
                fontSize={0.034}
                accent={eng.accentColor}
                onClick={() => {
                  setActiveCabinetId(slot.id)
                  eng.sendInput('right')
                }}
              />
              <HoloButton3D
                name={`btn-arcade-${slot.id}-action`}
                label="⚡ FIRE/ACT"
                position={[0.31, 0.04, 0]}
                width={0.34}
                height={0.085}
                fontSize={0.028}
                active
                accent={eng.accentColor}
                onClick={() => {
                  setActiveCabinetId(slot.id)
                  eng.sendInput('action')
                }}
              />

              {/* Bottom Row: New Game & Post High Score */}
              <HoloButton3D
                name={`btn-arcade-play-${slot.id}`}
                label="🔄 New Game"
                position={[-0.24, -0.075, 0]}
                width={0.44}
                height={0.072}
                fontSize={0.025}
                onClick={() => {
                  setActiveCabinetId(slot.id)
                  eng.sendInput('start')
                }}
              />
              <HoloButton3D
                name={`btn-arcade-save-${slot.id}`}
                label={`🏆 Save (${curScore})`}
                position={[0.24, -0.075, 0]}
                width={0.46}
                height={0.072}
                fontSize={0.025}
                accent="#10B981"
                onClick={() =>
                  onRecordArcadeScore(
                    'arcade-retro',
                    Math.max(100, curScore),
                    eng.title,
                  )
                }
              />
            </group>
          </group>
        )
      })}

      {/* B) 🏀 NEON POP-A-SHOT ARCADE BASKETBALL (East Wall North, facing -X) */}
      <group
        name="arcade-station-popashot"
        position={[15.95, 0, gameRoomZ - 2.65]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <RoundedBox args={[1.45, 0.85, 1.18]} position={[0, 0.425, 0.15]} radius={0.03}>
          <meshStandardMaterial color="#1E1B4B" roughness={0.5} metalness={0.35} />
        </RoundedBox>
        <RoundedBox args={[1.5, 2.62, 0.12]} position={[0, 1.38, -0.36]} radius={0.025}>
          <meshStandardMaterial color="#0F172A" metalness={0.45} roughness={0.4} />
        </RoundedBox>
        {/* Neon Backboard & Hoop Rim */}
        <mesh position={[0, 1.98, -0.28]}>
          <planeGeometry args={[1.14, 0.72]} />
          <meshBasicMaterial color="#111827" />
        </mesh>
        <mesh position={[0, 1.98, -0.275]}>
          <ringGeometry args={[0.18, 0.21, 4]} />
          <meshBasicMaterial color="#F97316" />
        </mesh>
        <mesh position={[0, 1.78, -0.12]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.15, 0.015, 10, 24]} />
          <meshBasicMaterial color="#EF4444" />
        </mesh>
        {/* 3 Basketballs in Return Rack */}
        {[-0.3, 0, 0.3].map((bx, i) => (
          <mesh key={i} position={[bx, 0.92, 0.44]}>
            <sphereGeometry args={[0.11, 14, 12]} />
            <meshStandardMaterial color="#EA580C" roughness={0.55} />
          </mesh>
        ))}
        {/* Live 3D Flying Basketball Projectile */}
        <mesh ref={hoopsFlyingMeshRef} visible={false} position={[0, 1.2, 0.4]}>
          <sphereGeometry args={[0.115, 16, 14]} />
          <meshStandardMaterial
            color="#FB923C"
            emissive="#EA580C"
            emissiveIntensity={0.45}
            roughness={0.4}
          />
        </mesh>

        <Text
          position={[0, 2.48, -0.28]}
          fontSize={0.076}
          color="#F97316"
          anchorX="center"
          anchorY="middle"
        >
          🏀 NEON POP-A-SHOT HOOPS
        </Text>
        <Text
          position={[0, 2.3, -0.28]}
          fontSize={0.062}
          color="#34D399"
          anchorX="center"
          anchorY="middle"
        >
          {`SCORE: ${hoopsScore} PTS  ·  STREAK: ${hoopsStreak}🔥`}
        </Text>

        <HoloButton3D
          name="btn-arcade-hoops-aim-left"
          label="◀ Aim L"
          position={[-0.48, 1.02, 0.74]}
          width={0.3}
          height={0.1}
          fontSize={0.03}
          onClick={() => setHoopsAimX((x) => Math.max(-0.24, x - 0.08))}
        />
        <HoloButton3D
          name="btn-arcade-hoops-shoot"
          label="🏀 Shoot Arc (+3)"
          position={[0, 1.02, 0.74]}
          width={0.56}
          height={0.11}
          fontSize={0.036}
          active
          accent="#F97316"
          onClick={() => {
            hoopsBallFlightRef.current = {
              active: true,
              t: 0,
              startX: hoopsAimX,
              targetX: hoopsAimX * 0.25,
              swish: true,
            }
            const nextStreak = hoopsStreak + 1
            const bonus = nextStreak >= 3 ? 6 : 3
            setHoopsStreak(nextStreak)
            setHoopsScore((s) => s + bonus)
          }}
        />
        <HoloButton3D
          name="btn-arcade-hoops-post"
          label="🏆 Post Score"
          position={[0.48, 1.02, 0.74]}
          width={0.34}
          height={0.1}
          fontSize={0.03}
          accent="#10B981"
          onClick={() =>
            onRecordArcadeScore('arcade-hoops', hoopsScore, 'Neon Pop-A-Shot Hoops')
          }
        />
      </group>

      {/* C) 🎳 CYBER SKEE-BALL ALLEY (East Wall South, facing -X) */}
      <group
        name="arcade-station-skeeball"
        position={[15.95, 0, gameRoomZ + 1.65]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <RoundedBox args={[1.32, 0.82, 1.32]} position={[0, 0.41, 0.1]} radius={0.03}>
          <meshStandardMaterial color="#172554" roughness={0.48} metalness={0.35} />
        </RoundedBox>
        <RoundedBox args={[1.36, 2.48, 0.14]} position={[0, 1.3, -0.42]} radius={0.025}>
          <meshStandardMaterial color="#090D1A" metalness={0.45} roughness={0.4} />
        </RoundedBox>
        {/* Concentric Neon Target Rings (10 / 30 / 50 / 100 PTS) */}
        {[
          { r: 0.34, color: '#38BDF8', y: 1.55 },
          { r: 0.22, color: '#A855F7', y: 1.55 },
          { r: 0.11, color: '#F59E0B', y: 1.55 },
          { r: 0.075, color: '#34D399', y: 1.84 },
        ].map((ring, idx) => (
          <mesh key={idx} position={[0, ring.y, -0.33]}>
            <ringGeometry args={[ring.r - 0.02, ring.r, 24]} />
            <meshBasicMaterial color={ring.color} />
          </mesh>
        ))}

        {/* Live 3D Rolling Skee-Ball Projectile */}
        <mesh ref={skeeFlyingMeshRef} visible={false} position={[0, 0.9, 0.55]}>
          <sphereGeometry args={[0.075, 14, 12]} />
          <meshStandardMaterial
            color="#38BDF8"
            emissive="#0284C7"
            emissiveIntensity={0.6}
            metalness={0.5}
            roughness={0.2}
          />
        </mesh>

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
          name="btn-arcade-skeeball-power"
          label={`⚡ Aim: ${skeePower} PT Ring`}
          position={[-0.42, 0.96, 0.76]}
          width={0.38}
          height={0.1}
          fontSize={0.028}
          onClick={() => setSkeePower((p) => (p === '100' ? '50' : '100'))}
        />
        <HoloButton3D
          name="btn-arcade-skeeball-roll"
          label={`🎳 Roll Skee-Ball (+${skeePower})`}
          position={[0.02, 0.96, 0.76]}
          width={0.46}
          height={0.11}
          fontSize={0.032}
          active
          accent="#38BDF8"
          onClick={() => {
            const pts = skeePower === '100' ? 100 : 50
            skeeBallRollRef.current = { active: true, t: 0, pts }
            setSkeeScore((s) => s + pts)
          }}
        />
        <HoloButton3D
          name="btn-arcade-skeeball-post"
          label="🏆 Post Score"
          position={[0.46, 0.96, 0.76]}
          width={0.34}
          height={0.1}
          fontSize={0.028}
          accent="#10B981"
          onClick={() =>
            onRecordArcadeScore('arcade-skeeball', skeeScore, 'Cyber Skee-Ball Alley')
          }
        />
      </group>

      {/* =================================================================== */}
      {/* 3. CENTERPIECE: TACTICAL HOLOTABLE & CLASSIC BOARD GAMES SANCTUM    */}
      {/*    Modes: ⚔️ Adventure RPG · 🔴 Checkers · ♟️ Chess · 🟡 Connect-4   */}
      {/* =================================================================== */}
      <group name="tactical-holotable-sanctum" position={[centerX, 0, gameRoomZ]}>
        {/* Illuminated Octagonal Sanctum Pedestal & Rim */}
        <mesh position={[0, 0.41, 0]}>
          <cylinderGeometry args={[1.05, 1.22, 0.82, 8]} />
          <meshStandardMaterial
            color="#1E1B4B"
            metalness={0.58}
            roughness={0.3}
            emissive="#110E2E"
            emissiveIntensity={0.35 * brightnessScale}
          />
        </mesh>
        <mesh position={[0, 0.83, 0]}>
          <cylinderGeometry args={[1.38, 1.32, 0.05, 16]} />
          <meshStandardMaterial color="#0F172A" metalness={0.65} roughness={0.28} />
        </mesh>
        {/* Rotating Holographic Outer Rim Halo */}
        <mesh
          ref={holoRingRef}
          position={[0, 0.858, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <ringGeometry args={[1.22, 1.33, 36]} />
          <meshBasicMaterial color={activeTerrainSpec.accentColor} />
        </mesh>

        {/* ================================================================= */}
        {/* FLOATING NORTH RIM GAME MODE SWITCHER BAR                         */}
        {/* ================================================================= */}
        <group
          name="holotable-mode-switcher"
          position={[0, 1.24, -1.16]}
          rotation={[0.25, 0, 0]}
        >
          <RoundedBox args={[1.92, 0.24, 0.02]} radius={0.02}>
            <meshBasicMaterial color="#090D1A" />
          </RoundedBox>
          <Text
            position={[0, 0.068, 0.014]}
            fontSize={0.03}
            color="#FDE68A"
            anchorX="center"
            anchorY="middle"
          >
            {tableMode === 'adventure-rpg'
              ? `⚔️ ADVENTURE QUEST RPG · ROUND ${rpgRound} · ${rpgCombatLog[0] ?? ''}`
              : tableMode === 'checkers'
                ? checkersBanner
                : tableMode === 'chess'
                  ? chessBanner
                  : connect4Banner}
          </Text>
          <HoloButton3D
            name="btn-holo-mode-adventure-rpg"
            label="⚔️ Adventure RPG"
            position={[-0.68, -0.04, 0.014]}
            width={0.42}
            height={0.08}
            fontSize={0.025}
            active={tableMode === 'adventure-rpg'}
            accent="#F59E0B"
            onClick={() => setTableMode('adventure-rpg')}
          />
          <HoloButton3D
            name="btn-holo-mode-checkers"
            label="🔴 Checkers 8×8"
            position={[-0.22, -0.04, 0.014]}
            width={0.42}
            height={0.08}
            fontSize={0.025}
            active={tableMode === 'checkers'}
            accent="#EF4444"
            onClick={() => setTableMode('checkers')}
          />
          <HoloButton3D
            name="btn-holo-mode-chess"
            label="♟️ Chess 8×8"
            position={[0.24, -0.04, 0.014]}
            width={0.42}
            height={0.08}
            fontSize={0.025}
            active={tableMode === 'chess'}
            accent="#38BDF8"
            onClick={() => setTableMode('chess')}
          />
          <HoloButton3D
            name="btn-holo-mode-connect4"
            label="🟡 Connect-4"
            position={[0.7, -0.04, 0.014]}
            width={0.42}
            height={0.08}
            fontSize={0.025}
            active={tableMode === 'connect4'}
            accent="#EAB308"
            onClick={() => setTableMode('connect4')}
          />
        </group>

        {/* ================================================================= */}
        {/* MODE 1: ADVENTURE QUEST RPG CAMPAIGN (TERRAIN, MINIS, COMBAT, FOG)*/}
        {/* ================================================================= */}
        {tableMode === 'adventure-rpg' && (
          <group name="holotable-rpg-mode-group">
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
              <planeGeometry args={[1.76, 1.76]} />
              <meshStandardMaterial
                color={activeTerrainSpec.baseColor}
                roughness={0.42}
                metalness={0.2}
              />
            </mesh>

            {/* Tactical Grid Lines */}
            {[-0.66, -0.44, -0.22, 0, 0.22, 0.44, 0.66].map((g) => (
              <group key={g}>
                <mesh
                  position={[g, 0.863, 0]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  raycast={() => null}
                >
                  <planeGeometry args={[0.008, 1.72]} />
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
                  <planeGeometry args={[1.72, 0.008]} />
                  <meshBasicMaterial
                    color={activeTerrainSpec.gridColor}
                    transparent
                    opacity={0.5}
                  />
                </mesh>
              </group>
            ))}

            {/* 3D Procedural Terrain Props */}
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

            {/* Synced Movable 3D Miniatures */}
            {holotableState.miniatures.map((mini) => (
              <MiniatureMesh3D
                key={mini.id}
                mini={mini}
                hpOverride={miniHpMap[mini.id]}
                isSelected={selectedMini?.id === mini.id}
                onSelect={() => onSelectHolotableMini(mini.id)}
              />
            ))}

            {/* Interactive 6×6 Fog-of-War Tile Overlay */}
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
          </group>
        )}

        {/* ================================================================= */}
        {/* MODE 2: CLASSIC CHECKERS (8x8 INTERACTIVE 3D BOARD & KING PIECES) */}
        {/* ================================================================= */}
        {tableMode === 'checkers' && (
          <group name="holotable-checkers-board" position={[0, 0.865, 0]}>
            {checkersBoard.map((piece, idx) => {
              const r = Math.floor(idx / 8)
              const c = idx % 8
              const x = -0.63 + c * 0.18
              const z = -0.63 + r * 0.18
              const isDark = (r + c) % 2 === 1
              const isSel = checkersSelected === idx
              const isLegalTarget = checkersLegalTargets.has(idx)
              const isRed = piece === 1 || piece === 3
              const isKing = piece === 3 || piece === 4

              return (
                <group
                  key={idx}
                  name={`checkers-square-${idx}`}
                  position={[x, 0, z]}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleCheckersSquareClick(idx)
                  }}
                >
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[0.174, 0.174]} />
                    <meshStandardMaterial
                      color={
                        isSel
                          ? '#38BDF8'
                          : isLegalTarget
                            ? '#22C55E'
                            : isDark
                              ? '#1E293B'
                              : '#E2E8F0'
                      }
                      roughness={0.5}
                    />
                  </mesh>

                  {piece !== 0 && (
                    <group position={[0, 0.02, 0]}>
                      <mesh>
                        <cylinderGeometry args={[0.064, 0.068, 0.028, 20]} />
                        <meshStandardMaterial
                          color={isRed ? '#EF4444' : '#0F172A'}
                          roughness={0.32}
                          metalness={0.25}
                        />
                      </mesh>
                      {isKing && (
                        <mesh position={[0, 0.022, 0]}>
                          <cylinderGeometry args={[0.042, 0.048, 0.02, 16]} />
                          <meshStandardMaterial
                            color="#FACC15"
                            metalness={0.65}
                            roughness={0.2}
                          />
                        </mesh>
                      )}
                    </group>
                  )}
                </group>
              )
            })}
            <HoloButton3D
              name="btn-checkers-reset"
              label="↺ Reset Checkers"
              position={[0, 0.04, 0.88]}
              width={0.44}
              height={0.075}
              fontSize={0.026}
              accent="#EF4444"
              onClick={() => {
                setCheckersBoard(createInitialCheckersBoard())
                setCheckersTurn('red')
                setCheckersSelected(null)
                setCheckersWinner(null)
                setCheckersBanner('Fresh Checkers match — RED moves first!')
              }}
            />
          </group>
        )}

        {/* ================================================================= */}
        {/* MODE 3: GRANDMASTER CHESS (8x8 INTERACTIVE 3D CHESS PIECES)       */}
        {/* ================================================================= */}
        {tableMode === 'chess' && (
          <group name="holotable-chess-board" position={[0, 0.865, 0]}>
            {chessBoard.map((piece, idx) => {
              const r = Math.floor(idx / 8)
              const c = idx % 8
              const x = -0.63 + c * 0.18
              const z = -0.63 + r * 0.18
              const isDark = (r + c) % 2 === 1
              const isSel = chessSelected === idx
              const isLegal = chessLegalTargets.has(idx)
              const isWhite = piece.startsWith('w')
              const role = piece[1] || ''
              const pieceH =
                role === 'K'
                  ? 0.14
                  : role === 'Q'
                    ? 0.125
                    : role === 'R' || role === 'B' || role === 'N'
                      ? 0.1
                      : 0.078

              return (
                <group
                  key={idx}
                  name={`chess-square-${idx}`}
                  position={[x, 0, z]}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleChessSquareClick(idx)
                  }}
                >
                  <mesh rotation={[-Math.PI / 2, 0, 0]}>
                    <planeGeometry args={[0.174, 0.174]} />
                    <meshStandardMaterial
                      color={
                        isSel
                          ? '#38BDF8'
                          : isLegal
                            ? '#22C55E'
                            : isDark
                              ? '#334155'
                              : '#F1F5F9'
                      }
                      roughness={0.45}
                    />
                  </mesh>

                  {piece && (
                    <group position={[0, pieceH / 2 + 0.005, 0]}>
                      <mesh>
                        <cylinderGeometry args={[0.036, 0.056, pieceH, 16]} />
                        <meshStandardMaterial
                          color={isWhite ? '#F59E0B' : '#1E1B4B'}
                          metalness={0.55}
                          roughness={0.28}
                        />
                      </mesh>
                      <Text
                        position={[0, pieceH / 2 + 0.025, 0]}
                        fontSize={0.044}
                        color={isWhite ? '#FEF08A' : '#38BDF8'}
                        anchorX="center"
                        anchorY="middle"
                      >
                        {CHESS_GLYPHS[piece] || piece}
                      </Text>
                    </group>
                  )}
                </group>
              )
            })}
            <HoloButton3D
              name="btn-chess-reset"
              label="↺ Reset Chess Board"
              position={[0, 0.04, 0.88]}
              width={0.46}
              height={0.075}
              fontSize={0.026}
              accent="#38BDF8"
              onClick={() => {
                setChessBoard(createInitialChessBoard())
                setChessTurn('w')
                setChessSelected(null)
                setChessWinner(null)
                setChessBanner('Fresh Chess match — GOLD (White) moves first!')
              }}
            />
          </group>
        )}

        {/* ================================================================= */}
        {/* MODE 4: CONNECT-4 STRATEGY GRID (6x7 3D VERTICAL FRAME & DISCS)   */}
        {/* ================================================================= */}
        {tableMode === 'connect4' && (
          <group name="holotable-connect4-board" position={[0, 0.87, 0]}>
            {/* 7 Clickable Column Drop Buttons along the Top */}
            {Array.from({ length: 7 }).map((_, col) => {
              const cx = -0.54 + col * 0.18
              return (
                <HoloButton3D
                  key={`c4-drop-${col}`}
                  name={`btn-connect4-col-${col}`}
                  label={`▼ C${col + 1}`}
                  position={[cx, 0.94, 0]}
                  width={0.16}
                  height={0.075}
                  fontSize={0.026}
                  active
                  accent={connect4Turn === 1 ? '#FACC15' : '#22D3EE'}
                  onClick={() => handleConnect4Drop(col)}
                />
              )
            })}

            {/* 6x7 Vertical Grid Slots & Placed 3D Discs */}
            {connect4Grid.map((cell, idx) => {
              const r = Math.floor(idx / 7)
              const c = idx % 7
              const cx = -0.54 + c * 0.18
              const cy = 0.78 - r * 0.135
              return (
                <group
                  key={idx}
                  position={[cx, cy, 0]}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleConnect4Drop(c)
                  }}
                >
                  <mesh>
                    <ringGeometry args={[0.052, 0.068, 20]} />
                    <meshBasicMaterial color="#1D4ED8" side={THREE.DoubleSide} />
                  </mesh>
                  {cell !== 0 && (
                    <mesh rotation={[Math.PI / 2, 0, 0]}>
                      <cylinderGeometry args={[0.052, 0.052, 0.025, 20]} />
                      <meshStandardMaterial
                        color={cell === 1 ? '#FACC15' : '#22D3EE'}
                        emissive={cell === 1 ? '#CA8A04' : '#0891B2'}
                        emissiveIntensity={0.35}
                        roughness={0.28}
                        metalness={0.3}
                      />
                    </mesh>
                  )}
                </group>
              )
            })}

            <HoloButton3D
              name="btn-connect4-reset"
              label="↺ Reset Connect-4"
              position={[0, 0.04, 0.55]}
              width={0.44}
              height={0.075}
              fontSize={0.026}
              accent="#FACC15"
              onClick={() => {
                setConnect4Grid(createInitialConnect4Grid())
                setConnect4Turn(1)
                setConnect4Winner(null)
                setConnect4Banner('Fresh Connect-4 match — GOLD drops first!')
              }}
            />
          </group>
        )}

        {/* ================================================================= */}
        {/* HOLOTABLE SANCTUM COMMAND CONSOLE PANEL (West Rim)                */}
        {/* ================================================================= */}
        <group
          name="holotable-control-console"
          position={[-1.28, 0.98, 0]}
          rotation={[0, -Math.PI / 2, -0.42]}
        >
          <RoundedBox args={[1.76, 0.74, 0.025]} radius={0.02}>
            <meshBasicMaterial color="#090D1A" />
          </RoundedBox>
          <Text
            position={[0, 0.31, 0.016]}
            fontSize={0.034}
            color="#C084FC"
            anchorX="center"
            anchorY="middle"
          >
            {`⚔️ SANCTUM COMMAND · ${activeTerrainSpec.title.toUpperCase()}`}
          </Text>

          {/* Row 1: 5 Terrain Presets */}
          {TERRAIN_SPECS.map((t, idx) => (
            <HoloButton3D
              key={t.id}
              name={`btn-holo-terrain-${t.id}`}
              label={t.shortLabel}
              position={[-0.64 + idx * 0.32, 0.2, 0.016]}
              width={0.29}
              height={0.072}
              fontSize={0.023}
              active={holotableState.terrain === t.id}
              accent={t.accentColor}
              onClick={() => {
                setTableMode('adventure-rpg')
                onSetHolotableTerrain(t.id)
              }}
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
              position={[-0.65 + idx * 0.26, 0.09, 0.016]}
              width={0.24}
              height={0.068}
              fontSize={0.022}
              accent={sp.color}
              onClick={() => {
                setTableMode('adventure-rpg')
                onSpawnHolotableMini(sp.kind, sp.label.replace('+', ''), sp.color)
              }}
            />
          ))}

          {/* Row 3: D20 RPG Combat Actions (Melee, Spell, Heal) */}
          <group position={[0, -0.01, 0.016]}>
            <HoloButton3D
              name="btn-holo-rpg-melee"
              label="⚔️ Roll Melee (D20)"
              position={[-0.54, 0, 0]}
              width={0.5}
              height={0.072}
              fontSize={0.023}
              active
              accent="#EF4444"
              onClick={() => handleRpgAction('melee')}
            />
            <HoloButton3D
              name="btn-holo-rpg-spell"
              label="🔥 Cast Spell (D20)"
              position={[0.0, 0, 0]}
              width={0.5}
              height={0.072}
              fontSize={0.023}
              active
              accent="#38BDF8"
              onClick={() => handleRpgAction('spell')}
            />
            <HoloButton3D
              name="btn-holo-rpg-heal"
              label="✨ Divine Heal"
              position={[0.54, 0, 0]}
              width={0.48}
              height={0.072}
              fontSize={0.023}
              active
              accent="#10B981"
              onClick={() => handleRpgAction('heal')}
            />
          </group>

          {/* Row 4: Selected Miniature Transform */}
          {selectedMini && (
            <group position={[0, -0.12, 0.016]}>
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

          {/* Row 5: Interactive Fog of War Controls */}
          <group position={[0, -0.24, 0.016]}>
            <HoloButton3D
              name="btn-holo-fog-toggle"
              label={
                holotableState.fogEnabled ? '🌫 Fog of War: ON' : '🌫 Fog of War: OFF'
              }
              position={[-0.46, 0, 0]}
              width={0.56}
              height={0.072}
              fontSize={0.023}
              active={holotableState.fogEnabled}
              accent="#A855F7"
              onClick={() => onToggleHolotableFog()}
            />
            <HoloButton3D
              name="btn-holo-fog-reveal-all"
              label="☀️ Clear All Fog"
              position={[0.12, 0, 0]}
              width={0.48}
              height={0.072}
              fontSize={0.023}
              accent="#38BDF8"
              onClick={onRevealAllHolotableFog}
            />
            <HoloButton3D
              name="btn-holo-fog-shroud-all"
              label="🌑 Shroud All"
              position={[0.58, 0, 0]}
              width={0.38}
              height={0.072}
              fontSize={0.023}
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
