import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { SUIT_SYMBOLS, TOKEN_PALETTE } from '../../constants/barGames'
import type {
  DieKind,
  RolledDie,
  TableSurfaceStyle,
  TabletopState,
} from '../../types/barGames'
import type { ParticipantProfile } from '../../types/lounge'

export interface InteractiveGameTable3DProps {
  localUserId: string
  localSeatId: string | undefined
  participants: ParticipantProfile[]
  tableOrigin: [number, number, number]
  accentColor: string
  buildMode: boolean
  tabletopState: TabletopState
  onSelectSeat: (seatId: string) => void
  onRollDice: (kinds: DieKind[]) => void
  onRerollSingleDie: (dieId: string) => void
  onSetSurface: (surface: TableSurfaceStyle) => void
  onShuffleDeck: () => void
  onDrawCardToHand: () => void
  onPlayCardFromHand: (cardId: string, faceUp: boolean) => void
  onDealCardToTable: (faceUp: boolean) => void
  onFlipTableCard: (cardId: string) => void
  onResetDeck: () => void
  onSpawnToken: (label: string, color: string) => void
  onMoveToken: (tokenId: string, localX: number, localZ: number) => void
}

const SURFACE_TEX_CACHE = new Map<TableSurfaceStyle, THREE.CanvasTexture>()

function getTableSurfaceTexture(style: TableSurfaceStyle): THREE.CanvasTexture {
  const cached = SURFACE_TEX_CACHE.get(style)
  if (cached) return cached

  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  if (style === 'felt') {
    const grad = ctx.createRadialGradient(256, 256, 30, 256, 256, 260)
    grad.addColorStop(0, '#136F47')
    grad.addColorStop(1, '#0A482E')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(229, 169, 60, 0.42)'
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.arc(256, 256, 218, 0, Math.PI * 2)
    ctx.stroke()
  } else if (style === 'wood') {
    ctx.fillStyle = '#3B2416'
    ctx.fillRect(0, 0, size, size)
    for (let i = 0; i < 16; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.08)'
      ctx.fillRect(0, i * 32, size, 30)
    }
  } else if (style === 'square-grid') {
    ctx.fillStyle = '#121926'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.34)'
    ctx.lineWidth = 2
    const step = size / 12
    for (let i = 0; i <= 12; i++) {
      const p = i * step
      ctx.beginPath()
      ctx.moveTo(p, 0)
      ctx.lineTo(p, size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, p)
      ctx.lineTo(size, p)
      ctx.stroke()
    }
  } else {
    // hex-grid
    ctx.fillStyle = '#141524'
    ctx.fillRect(0, 0, size, size)
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.42)'
    ctx.lineWidth = 2
    const r = 24
    const dx = r * Math.sqrt(3)
    const dy = r * 1.5
    for (let row = -1; row < size / dy + 2; row++) {
      for (let col = -1; col < size / dx + 2; col++) {
        const cx = col * dx + (Math.abs(row) % 2 === 1 ? dx / 2 : 0)
        const cy = row * dy
        ctx.beginPath()
        for (let k = 0; k < 6; k++) {
          const ang = (Math.PI / 3) * k - Math.PI / 6
          const vx = cx + r * Math.cos(ang)
          const vy = cy + r * Math.sin(ang)
          if (k === 0) ctx.moveTo(vx, vy)
          else ctx.lineTo(vx, vy)
        }
        ctx.closePath()
        ctx.stroke()
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  SURFACE_TEX_CACHE.set(style, tex)
  return tex
}

function PolyhedralDie3D({
  die,
  onReroll,
}: {
  die: RolledDie
  onReroll: (id: string) => void
}) {
  const meshGroupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState(false)

  useFrame(() => {
    if (!meshGroupRef.current) return
    const elapsed = (Date.now() - die.rolledAt) / 1000
    if (die.rolledAt > 0 && elapsed >= 0 && elapsed < 0.6) {
      const t = 1 - elapsed / 0.6
      const bounceY = Math.abs(Math.sin(elapsed * 14)) * 0.11 * t
      meshGroupRef.current.position.y = 0.032 + bounceY
      meshGroupRef.current.rotation.set(
        die.rotation[0] + t * 8,
        die.rotation[1] + t * 10,
        die.rotation[2] + t * 6,
      )
    } else {
      meshGroupRef.current.position.y = 0.032
      meshGroupRef.current.rotation.set(
        die.rotation[0],
        die.rotation[1],
        die.rotation[2],
      )
    }
  })

  return (
    <group
      position={[die.localPos[0], 0, die.localPos[1]]}
      pointerEventsType={{ deny: 'grab' }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        onReroll(die.id)
      }}
    >
      <group ref={meshGroupRef} position={[0, 0.032, 0]}>
        {die.kind === 'd4' && (
          <mesh>
            <tetrahedronGeometry args={[0.036, 0]} />
            <meshStandardMaterial
              color={hovered ? '#FBBF24' : die.color}
              roughness={0.32}
              metalness={0.18}
            />
          </mesh>
        )}
        {die.kind === 'd6' && (
          <RoundedBox args={[0.044, 0.044, 0.044]} radius={0.006} smoothness={2}>
            <meshStandardMaterial
              color={hovered ? '#F87171' : die.color}
              roughness={0.32}
              metalness={0.18}
            />
          </RoundedBox>
        )}
        {die.kind === 'd8' && (
          <mesh>
            <octahedronGeometry args={[0.036, 0]} />
            <meshStandardMaterial
              color={hovered ? '#34D399' : die.color}
              roughness={0.3}
              metalness={0.2}
            />
          </mesh>
        )}
        {die.kind === 'd10' && (
          <group>
            <mesh position={[0, 0.014, 0]}>
              <coneGeometry args={[0.032, 0.028, 5]} />
              <meshStandardMaterial
                color={hovered ? '#22D3EE' : die.color}
                roughness={0.3}
                metalness={0.2}
              />
            </mesh>
            <mesh position={[0, -0.014, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.032, 0.028, 5]} />
              <meshStandardMaterial
                color={hovered ? '#22D3EE' : die.color}
                roughness={0.3}
                metalness={0.2}
              />
            </mesh>
          </group>
        )}
        {die.kind === 'd12' && (
          <mesh>
            <dodecahedronGeometry args={[0.036, 0]} />
            <meshStandardMaterial
              color={hovered ? '#A78BFA' : die.color}
              roughness={0.3}
              metalness={0.22}
            />
          </mesh>
        )}
        {die.kind === 'd20' && (
          <mesh>
            <icosahedronGeometry args={[0.038, 0]} />
            <meshStandardMaterial
              color={hovered ? '#F472B6' : die.color}
              roughness={0.26}
              metalness={0.25}
            />
          </mesh>
        )}
      </group>

      {/* Crisp Floating Die Face Result Pill */}
      <Suspense fallback={null}>
        <Text
          position={[0, 0.086, 0]}
          fontSize={0.026}
          color="#F8FAFC"
          anchorX="center"
          anchorY="middle"
        >
          {`${die.kind}:${die.value}`}
        </Text>
      </Suspense>
    </group>
  )
}

interface RimChipProps {
  label: string
  position: [number, number, number]
  width?: number
  active?: boolean
  color?: string
  onClick: () => void
}

function RimChip({
  label,
  position,
  width = 0.095,
  active = false,
  color = '#1E293B',
  onClick,
}: RimChipProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <group
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
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
      <RoundedBox args={[width, 0.048, 0.012]} radius={0.01} smoothness={2}>
        <meshBasicMaterial
          color={active ? '#E5A93C' : hovered ? '#334155' : color}
        />
      </RoundedBox>
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.008]}
          fontSize={0.019}
          color={active ? '#0B0D10' : '#F8FAFC'}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Suspense>
    </group>
  )
}

const PERIMETER_STOOLS: ReadonlyArray<{
  seatId: string
  label: string
  dx: number
  dz: number
  rotY: number
}> = [
  { seatId: 'game-table:seat-0', label: 'Sit South', dx: 0, dz: 1.06, rotY: 0 },
  { seatId: 'game-table:seat-1', label: 'Sit West', dx: -1.06, dz: 0, rotY: -Math.PI / 2 },
  { seatId: 'game-table:seat-2', label: 'Sit North', dx: 0, dz: -1.06, rotY: Math.PI },
  { seatId: 'game-table:seat-3', label: 'Sit East', dx: 1.06, dz: 0, rotY: Math.PI / 2 },
]

export function InteractiveGameTable3D({
  localUserId,
  localSeatId,
  participants,
  tableOrigin,
  accentColor,
  buildMode,
  tabletopState,
  onSelectSeat,
  onRollDice,
  onRerollSingleDie,
  onSetSurface,
  onShuffleDeck,
  onDrawCardToHand,
  onPlayCardFromHand,
  onDealCardToTable,
  onFlipTableCard,
  onResetDeck,
  onSpawnToken,
  onMoveToken,
}: InteractiveGameTable3DProps) {
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)
  const [hoveredStoolId, setHoveredStoolId] = useState<string | null>(null)
  const surfaceTex = useMemo(
    () =>
      typeof document !== 'undefined'
        ? getTableSurfaceTexture(tabletopState.surface)
        : null,
    [tabletopState.surface],
  )

  const myPrivateCards = tabletopState.hands[localUserId]?.cards ?? []
  const otherHandSummaries = useMemo(
    () =>
      Object.values(tabletopState.hands).filter(
        (h) => h.userId !== localUserId && h.cards.length > 0,
      ),
    [localUserId, tabletopState.hands],
  )

  const tabletopY = 0.76

  return (
    <group name="bar-games-interactive-table" position={tableOrigin}>
      {/* ================================================================= */}
      {/* GAMING TABLE PEDESTAL, APRON & PADDED ARMREST RAIL                */}
      {/* ================================================================= */}
      {/* Heavy Floor Base */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.48, 0.54, 0.06, 24]} />
        <meshStandardMaterial color="#1B130E" roughness={0.6} metalness={0.2} />
      </mesh>
      {/* Turned Central Column */}
      <mesh position={[0, 0.39, 0]}>
        <cylinderGeometry args={[0.14, 0.19, 0.68, 20]} />
        <meshStandardMaterial color="#2C1D13" roughness={0.55} metalness={0.14} />
      </mesh>
      {/* Outer Padded Casino Rail */}
      <mesh position={[0, tabletopY - 0.025, 0]}>
        <cylinderGeometry args={[0.78, 0.76, 0.065, 32]} />
        <meshStandardMaterial color="#241710" roughness={0.52} metalness={0.12} />
      </mesh>
      {/* Brass Rim Accent */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, tabletopY + 0.009, 0]}>
        <ringGeometry args={[0.685, 0.705, 40]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>

      {/* ================================================================= */}
      {/* INTERACTIVE TABLETOP SURFACE (FELT / WOOD / SQUARE / HEX GRID)    */}
      {/* ================================================================= */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, tabletopY + 0.008, 0]}
        pointerEventsType={{ deny: 'grab' }}
        onClick={(e: ThreeEvent<PointerEvent>) => {
          if (buildMode || !selectedTokenId) return
          e.stopPropagation()
          const lx = e.point.x - tableOrigin[0]
          const lz = e.point.z - tableOrigin[2]
          onMoveToken(selectedTokenId, lx, lz)
        }}
      >
        <circleGeometry args={[0.685, 40]} />
        <meshStandardMaterial
          map={surfaceTex ?? undefined}
          color={surfaceTex ? '#FFFFFF' : '#125E3B'}
          roughness={0.82}
          metalness={0.04}
        />
      </mesh>

      {/* Surface & Grid Selector Chips on North-West Rim */}
      <group position={[0, tabletopY + 0.016, 0]}>
        <RimChip
          label="Felt"
          position={[-0.36, 0, -0.54]}
          width={0.088}
          active={tabletopState.surface === 'felt'}
          onClick={() => onSetSurface('felt')}
        />
        <RimChip
          label="Wood"
          position={[-0.26, 0, -0.54]}
          width={0.088}
          active={tabletopState.surface === 'wood'}
          onClick={() => onSetSurface('wood')}
        />
        <RimChip
          label="Sq Grid"
          position={[-0.145, 0, -0.54]}
          width={0.115}
          active={tabletopState.surface === 'square-grid'}
          onClick={() => onSetSurface('square-grid')}
        />
        <RimChip
          label="Hex Grid"
          position={[-0.015, 0, -0.54]}
          width={0.12}
          active={tabletopState.surface === 'hex-grid'}
          onClick={() => onSetSurface('hex-grid')}
        />
        <RimChip
          label="+ Token"
          position={[0.12, 0, -0.54]}
          width={0.11}
          color="#0F766E"
          onClick={() => {
            const pick =
              TOKEN_PALETTE[tabletopState.tokens.length % TOKEN_PALETTE.length]
            onSpawnToken(pick.label, pick.color)
          }}
        />

        {/* Quick Polyhedral Dice Tray along South-West Rim */}
        {(['d4', 'd6', 'd8', 'd10', 'd12', 'd20'] as const).map((dk, idx) => (
          <RimChip
            key={dk}
            label={dk}
            position={[-0.38 + idx * 0.088, 0, 0.52]}
            width={0.078}
            color="#312E81"
            onClick={() => onRollDice([dk])}
          />
        ))}
        <RimChip
          label="🎲 2d6+d20"
          position={[0.21, 0, 0.52]}
          width={0.145}
          color="#7C2D12"
          onClick={() => onRollDice(['d20', 'd6', 'd6'])}
        />

        {/* =============================================================== */}
        {/* 3D POLYHEDRAL DICE & FLOATING RESULT BANNER                     */}
        {/* =============================================================== */}
        {tabletopState.dice.map((die) => (
          <PolyhedralDie3D key={die.id} die={die} onReroll={onRerollSingleDie} />
        ))}

        {/* Floating 3D Roll Sum Banner above Center of Table */}
        <group position={[0, 0.34, 0]}>
          <RoundedBox args={[0.72, 0.11, 0.014]} radius={0.02} smoothness={2}>
            <meshBasicMaterial color="#0D131F" transparent opacity={0.9} />
          </RoundedBox>
          <Suspense fallback={null}>
            <Text
              position={[0, 0.018, 0.01]}
              fontSize={0.03}
              color={accentColor}
              anchorX="center"
              anchorY="middle"
            >
              {`🎲 SUM: ${tabletopState.lastRollTotal} (${tabletopState.lastRollerName})`}
            </Text>
            <Text
              position={[0, -0.022, 0.01]}
              fontSize={0.019}
              color="#CBD5E1"
              maxWidth={0.68}
              anchorX="center"
              anchorY="middle"
            >
              {tabletopState.lastRollSummary}
            </Text>
          </Suspense>
        </group>

        {/* =============================================================== */}
        {/* SHARED 52-CARD DECK SHOE & TABLE CARDS                          */}
        {/* =============================================================== */}
        <group position={[0.38, 0, -0.22]}>
          {/* 3D Card Stack */}
          <RoundedBox
            args={[0.085, Math.max(0.008, tabletopState.deck.length * 0.0007), 0.12]}
            radius={0.004}
            smoothness={2}
            position={[0, 0.018, 0]}
            pointerEventsType={{ deny: 'grab' }}
            onClick={(e) => {
              e.stopPropagation()
              onDrawCardToHand()
            }}
          >
            <meshStandardMaterial color="#991B1B" roughness={0.45} />
          </RoundedBox>
          <Suspense fallback={null}>
            <Text
              position={[0, 0.048, 0]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.02}
              color="#F8FAFC"
              anchorX="center"
              anchorY="middle"
            >
              {`DECK (${tabletopState.deck.length})`}
            </Text>
          </Suspense>

          <RimChip
            label="Draw Hand"
            position={[0, 0.002, 0.11]}
            width={0.13}
            color="#1D4ED8"
            onClick={onDrawCardToHand}
          />
          <RimChip
            label="Deal Up"
            position={[0, 0.002, 0.17]}
            width={0.13}
            onClick={() => onDealCardToTable(true)}
          />
          <RimChip
            label="Shuffle"
            position={[0, 0.002, -0.1]}
            width={0.11}
            onClick={onShuffleDeck}
          />
          <RimChip
            label="Reset 52"
            position={[0, 0.002, -0.16]}
            width={0.11}
            onClick={onResetDeck}
          />
        </group>

        {/* Shared Cards Dealt / Played to Table (Click to Flip!) */}
        {tabletopState.tableCards.map((tc, idx) => {
          const suitMeta = SUIT_SYMBOLS[tc.card.suit]
          return (
            <group
              key={`${tc.card.id}-${idx}`}
              position={[tc.localPos[0], 0.004 + idx * 0.0012, tc.localPos[1]]}
              rotation={[0, tc.rotationY, 0]}
              pointerEventsType={{ deny: 'grab' }}
              onClick={(e) => {
                e.stopPropagation()
                onFlipTableCard(tc.card.id)
              }}
            >
              <RoundedBox args={[0.078, 0.004, 0.112]} radius={0.004} smoothness={1}>
                <meshStandardMaterial
                  color={tc.faceUp ? '#F8FAFC' : '#7F1D1D'}
                  roughness={0.42}
                />
              </RoundedBox>
              <Suspense fallback={null}>
                <Text
                  position={[0, 0.004, 0]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  fontSize={0.026}
                  color={tc.faceUp ? suitMeta.color : '#FDE68A'}
                  anchorX="center"
                  anchorY="middle"
                >
                  {tc.faceUp ? `${tc.card.rank}${suitMeta.glyph}` : '❖'}
                </Text>
              </Suspense>
            </group>
          )
        })}

        {/* Local Player's PRIVATE 3D Hand Fan (Visible ONLY to localUserId!) */}
        {myPrivateCards.length > 0 && (
          <group position={[0, 0.12, 0.62]} rotation={[-0.55, 0, 0]}>
            {myPrivateCards.slice(0, 7).map((card, idx) => {
              const count = Math.min(7, myPrivateCards.length)
              const offset = (idx - (count - 1) / 2) * 0.075
              const suitMeta = SUIT_SYMBOLS[card.suit]
              return (
                <group
                  key={card.id}
                  position={[offset, 0, idx * 0.003]}
                  pointerEventsType={{ deny: 'grab' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPlayCardFromHand(card.id, true)
                  }}
                >
                  <RoundedBox args={[0.072, 0.105, 0.004]} radius={0.005} smoothness={2}>
                    <meshBasicMaterial color="#FFFFFF" />
                  </RoundedBox>
                  <Suspense fallback={null}>
                    <Text
                      position={[0, 0.008, 0.004]}
                      fontSize={0.026}
                      color={suitMeta.color}
                      anchorX="center"
                      anchorY="middle"
                    >
                      {`${card.rank}${suitMeta.glyph}`}
                    </Text>
                    <Text
                      position={[0, -0.034, 0.004]}
                      fontSize={0.014}
                      color="#334155"
                      anchorX="center"
                      anchorY="middle"
                    >
                      PLAY
                    </Text>
                  </Suspense>
                </group>
              )
            })}
          </group>
        )}

        {/* Opponent Hidden Hand Count Badges (Card Backs Only — Zero Peek!) */}
        {otherHandSummaries.map((h, idx) => (
          <Suspense key={h.userId} fallback={null}>
            <Text
              position={[-0.45, 0.02, -0.32 + idx * 0.06]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.021}
              color="#FDE68A"
              anchorX="left"
              anchorY="middle"
            >
              {`🂠 ${h.displayName.slice(0, 9)}: ${h.cards.length} hidden`}
            </Text>
          </Suspense>
        ))}

        {/* =============================================================== */}
        {/* COLORED TACTICAL TOKENS / MINIATURES ON GRID                    */}
        {/* =============================================================== */}
        {tabletopState.tokens.map((tok) => {
          const isSel = selectedTokenId === tok.id
          return (
            <group
              key={tok.id}
              position={[tok.localPos[0], 0.018, tok.localPos[1]]}
              pointerEventsType={{ deny: 'grab' }}
              onClick={(e) => {
                e.stopPropagation()
                setSelectedTokenId((curr) => (curr === tok.id ? null : tok.id))
              }}
            >
              <mesh>
                <cylinderGeometry args={[0.028, 0.034, 0.024, 16]} />
                <meshStandardMaterial
                  color={tok.color}
                  emissive={isSel ? '#22D3EE' : '#000000'}
                  emissiveIntensity={isSel ? 0.55 : 0}
                  roughness={0.35}
                  metalness={0.25}
                />
              </mesh>
              <mesh position={[0, 0.026, 0]}>
                <sphereGeometry args={[0.016, 12, 12]} />
                <meshStandardMaterial color={tok.color} roughness={0.3} />
              </mesh>
              <Suspense fallback={null}>
                <Text
                  position={[0, 0.058, 0]}
                  fontSize={0.018}
                  color={isSel ? '#22D3EE' : '#F8FAFC'}
                  anchorX="center"
                  anchorY="middle"
                >
                  {tok.label}
                </Text>
              </Suspense>
            </group>
          )
        })}
      </group>

      {/* ================================================================= */}
      {/* 4 PERIMETER SNAP-TO-SEAT BARSTOOLS                                */}
      {/* ================================================================= */}
      {PERIMETER_STOOLS.map((st) => {
        const isMine = localSeatId === st.seatId
        const occupant = participants.find(
          (p) => p.userId !== localUserId && p.seatId === st.seatId,
        )
        const isHov = hoveredStoolId === st.seatId

        return (
          <group
            key={st.seatId}
            position={[st.dx, 0, st.dz]}
            rotation={[0, st.rotY, 0]}
            pointerEventsType={{ deny: 'grab' }}
            onPointerOver={(e) => {
              e.stopPropagation()
              setHoveredStoolId(st.seatId)
            }}
            onPointerOut={() => setHoveredStoolId(null)}
            onClick={(e) => {
              if (buildMode || occupant) return
              e.stopPropagation()
              onSelectSeat(st.seatId)
            }}
          >
            {/* Stool Chrome Footring & Pedestal */}
            <mesh position={[0, 0.02, 0]}>
              <cylinderGeometry args={[0.2, 0.22, 0.035, 16]} />
              <meshStandardMaterial color="#334155" metalness={0.65} roughness={0.3} />
            </mesh>
            <mesh position={[0, 0.24, 0]}>
              <cylinderGeometry args={[0.04, 0.05, 0.44, 12]} />
              <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.28} />
            </mesh>
            {/* Padded Leather Cushion */}
            <mesh position={[0, 0.47, 0]}>
              <cylinderGeometry args={[0.21, 0.19, 0.075, 20]} />
              <meshStandardMaterial
                color={
                  isMine
                    ? '#0E7490'
                    : occupant
                      ? '#334155'
                      : isHov
                        ? '#B45309'
                        : '#3B2316'
                }
                roughness={0.55}
              />
            </mesh>
            {(isHov || isMine) && (
              <Suspense fallback={null}>
                <Text
                  position={[0, 0.62, 0]}
                  fontSize={0.034}
                  color={isMine ? '#22D3EE' : '#FDE68A'}
                  anchorX="center"
                  anchorY="middle"
                >
                  {isMine ? '● SEATED' : `🎲 ${st.label}`}
                </Text>
              </Suspense>
            )}
          </group>
        )
      })}
    </group>
  )
}
