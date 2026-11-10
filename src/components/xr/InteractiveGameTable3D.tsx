import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { SUIT_SYMBOLS, TOKEN_PALETTE, scoreBlackjackHand } from '../../constants/barGames'
import { playSpatialUiFeedback } from '../../services/soundboardAudio'
import { setSpatialUiHovered } from '../../services/xrTracking'
import type {
  CardRank,
  CardSuit,
  DieKind,
  RolledDie,
  TableGameMode,
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
  onSetGameMode?: (mode: TableGameMode) => void
  onBetChips?: (amount: number) => void
  onDealBlackjack?: () => void
  onHitBlackjack?: () => void
  onStandBlackjack?: () => void
  onDealHoldem?: () => void
  onAdvanceHoldemStreet?: () => void
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
const CARD_TEX_CACHE = new Map<string, THREE.CanvasTexture>()

function drawCardSuitVector(
  ctx: CanvasRenderingContext2D,
  suit: CardSuit,
  cx: number,
  cy: number,
  size: number,
  color: string,
) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.fillStyle = color
  ctx.strokeStyle = color

  if (suit === 'diamonds') {
    ctx.beginPath()
    ctx.moveTo(0, -size)
    ctx.lineTo(size * 0.78, 0)
    ctx.lineTo(0, size)
    ctx.lineTo(-size * 0.78, 0)
    ctx.closePath()
    ctx.fill()
  } else if (suit === 'hearts') {
    const topY = -size * 0.32
    ctx.beginPath()
    ctx.moveTo(0, size * 0.95)
    ctx.bezierCurveTo(-size * 1.05, size * 0.2, -size * 0.98, -size * 0.9, -size * 0.46, -size * 0.9)
    ctx.bezierCurveTo(-size * 0.14, -size * 0.9, 0, -size * 0.58, 0, topY)
    ctx.bezierCurveTo(0, -size * 0.58, size * 0.14, -size * 0.9, size * 0.46, -size * 0.9)
    ctx.bezierCurveTo(size * 0.98, -size * 0.9, size * 1.05, size * 0.2, 0, size * 0.95)
    ctx.closePath()
    ctx.fill()
  } else if (suit === 'spades') {
    ctx.beginPath()
    ctx.moveTo(0, -size * 0.98)
    ctx.bezierCurveTo(size * 0.98, -size * 0.15, size * 0.98, size * 0.65, size * 0.42, size * 0.65)
    ctx.bezierCurveTo(size * 0.18, size * 0.65, size * 0.06, size * 0.46, 0, size * 0.28)
    ctx.bezierCurveTo(-size * 0.06, size * 0.46, -size * 0.18, size * 0.65, -size * 0.42, size * 0.65)
    ctx.bezierCurveTo(-size * 0.98, size * 0.65, -size * 0.98, -size * 0.15, 0, -size * 0.98)
    ctx.closePath()
    ctx.fill()

    // Spade stem
    ctx.beginPath()
    ctx.moveTo(0, size * 0.22)
    ctx.lineTo(size * 0.28, size * 0.95)
    ctx.lineTo(-size * 0.28, size * 0.95)
    ctx.closePath()
    ctx.fill()
  } else {
    // clubs
    const r = size * 0.42
    ctx.beginPath()
    ctx.arc(0, -size * 0.42, r, 0, Math.PI * 2)
    ctx.arc(-size * 0.44, size * 0.12, r, 0, Math.PI * 2)
    ctx.arc(size * 0.44, size * 0.12, r, 0, Math.PI * 2)
    ctx.fill()

    // Club center & stem
    ctx.beginPath()
    ctx.arc(0, -size * 0.02, r * 0.65, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(0, size * 0.1)
    ctx.lineTo(size * 0.28, size * 0.95)
    ctx.lineTo(-size * 0.28, size * 0.95)
    ctx.closePath()
    ctx.fill()
  }

  ctx.restore()
}

function getPlayingCardTexture(
  rank: CardRank,
  suit: CardSuit,
  faceUp: boolean,
  footerLabel?: string,
): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const cacheKey = faceUp
    ? `up:${rank}:${suit}:${footerLabel ?? ''}`
    : 'back:royal-casino'
  const cached = CARD_TEX_CACHE.get(cacheKey)
  if (cached) return cached

  const w = 256
  const h = 356
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!

  if (!faceUp) {
    // Ornate Royal Crimson & Gold Casino Card Back
    ctx.fillStyle = '#F8FAFC'
    ctx.fillRect(0, 0, w, h)

    ctx.fillStyle = '#7F1D1D'
    ctx.fillRect(10, 10, w - 20, h - 20)

    ctx.strokeStyle = '#F59E0B'
    ctx.lineWidth = 5
    ctx.strokeRect(16, 16, w - 32, h - 32)

    ctx.strokeStyle = 'rgba(253, 230, 138, 0.35)'
    ctx.lineWidth = 2
    const step = 24
    for (let x = 22; x < w - 22; x += step) {
      for (let y = 22; y < h - 22; y += step) {
        ctx.beginPath()
        ctx.moveTo(x + step / 2, y)
        ctx.lineTo(x + step, y + step / 2)
        ctx.lineTo(x + step / 2, y + step)
        ctx.lineTo(x, y + step / 2)
        ctx.closePath()
        ctx.stroke()
      }
    }

    // Center gold medallion
    ctx.fillStyle = '#450A0A'
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 44, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#FDE68A'
    ctx.lineWidth = 4
    ctx.stroke()
    drawCardSuitVector(ctx, 'diamonds', w / 2, h / 2, 24, '#FDE68A')
  } else {
    const isRed = suit === 'hearts' || suit === 'diamonds'
    const fg = isRed ? '#DC2626' : '#0F172A'
    const accentTrim = isRed ? 'rgba(220, 38, 38, 0.28)' : 'rgba(15, 23, 42, 0.22)'

    // Crisp White Card Stock + High-Contrast Outer & Inner Borders
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)

    ctx.strokeStyle = '#0F172A'
    ctx.lineWidth = 8
    ctx.strokeRect(4, 4, w - 8, h - 8)

    ctx.strokeStyle = accentTrim
    ctx.lineWidth = 3
    ctx.strokeRect(16, 16, w - 32, h - 32)

    // Top-Left Corner Index (Rank + Vector Suit)
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = '900 54px system-ui, -apple-system, sans-serif'
    ctx.fillText(rank, 50, 22)
    drawCardSuitVector(ctx, suit, 50, 96, 20, fg)

    // Bottom-Right Inverted Corner Index
    ctx.save()
    ctx.translate(w, h)
    ctx.rotate(Math.PI)
    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    ctx.font = '900 54px system-ui, -apple-system, sans-serif'
    ctx.fillText(rank, 50, 22)
    drawCardSuitVector(ctx, suit, 50, 96, 20, fg)
    ctx.restore()

    // Large Central Suit & Rank Emblem for Instant Readability in VR & Desktop
    const isCourtOrAce = rank === 'A' || rank === 'K' || rank === 'Q' || rank === 'J'
    if (isCourtOrAce) {
      ctx.strokeStyle = '#D97706'
      ctx.lineWidth = 4
      ctx.strokeRect(58, 86, w - 116, h - 172)
    }

    drawCardSuitVector(ctx, suit, w / 2, h / 2 - 14, 52, fg)

    ctx.fillStyle = fg
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font = '900 52px system-ui, -apple-system, sans-serif'
    ctx.fillText(rank, w / 2, h / 2 + 64)

    if (footerLabel) {
      ctx.fillStyle = '#0F172A'
      ctx.fillRect(36, h - 46, w - 72, 30)
      ctx.fillStyle = '#FDE68A'
      ctx.font = '800 20px system-ui, -apple-system, sans-serif'
      ctx.fillText(footerLabel, w / 2, h - 31)
    }
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  tex.needsUpdate = true
  CARD_TEX_CACHE.set(cacheKey, tex)
  return tex
}

function PlayingCard3D({
  rank,
  suit,
  faceUp,
  orientation = 'flat',
  width = 0.082,
  height = 0.116,
  thickness = 0.003,
  footerLabel,
}: {
  rank: CardRank
  suit: CardSuit
  faceUp: boolean
  orientation?: 'flat' | 'upright'
  width?: number
  height?: number
  thickness?: number
  footerLabel?: string
}) {
  const cardTex = useMemo(
    () => getPlayingCardTexture(rank, suit, faceUp, footerLabel),
    [faceUp, footerLabel, rank, suit],
  )
  const suitMeta = SUIT_SYMBOLS[suit]

  if (orientation === 'upright') {
    return (
      <group>
        {/* Solid Card Core */}
        <mesh>
          <boxGeometry args={[width, height, thickness]} />
          <meshBasicMaterial color={faceUp ? '#F8FAFC' : '#7F1D1D'} />
        </mesh>
        {/* Front Face Plane cleanly in front of card core */}
        <mesh position={[0, 0, thickness / 2 + 0.0008]}>
          <planeGeometry args={[width * 0.98, height * 0.98]} />
          <meshBasicMaterial
            map={cardTex ?? undefined}
            color="#FFFFFF"
            toneMapped={false}
          />
        </mesh>
        {!cardTex && (
          <Suspense fallback={null}>
            <Text
              position={[0, 0, thickness / 2 + 0.002]}
              fontSize={0.025}
              color={faceUp ? suitMeta.color : '#FDE68A'}
              anchorX="center"
              anchorY="middle"
            >
              {faceUp ? `${rank}${suitMeta.glyph}` : 'CARD'}
            </Text>
          </Suspense>
        )}
      </group>
    )
  }

  return (
    <group>
      {/* Solid Card Core Lying Flat on Tabletop */}
      <mesh>
        <boxGeometry args={[width, thickness, height]} />
        <meshBasicMaterial color={faceUp ? '#E2E8F0' : '#7F1D1D'} />
      </mesh>
      {/* Top Face Plane cleanly above card core so it NEVER z-fights or gets swallowed */}
      <mesh
        position={[0, thickness / 2 + 0.0008, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[width * 0.98, height * 0.98]} />
        <meshBasicMaterial
          map={cardTex ?? undefined}
          color="#FFFFFF"
          toneMapped={false}
        />
      </mesh>
      {!cardTex && (
        <Suspense fallback={null}>
          <Text
            position={[0, thickness / 2 + 0.002, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.025}
            color={faceUp ? suitMeta.color : '#FDE68A'}
            anchorX="center"
            anchorY="middle"
          >
            {faceUp ? `${rank}${suitMeta.glyph}` : 'CARD'}
          </Text>
        </Suspense>
      )}
    </group>
  )
}

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
  const settledRollRef = useRef<number | null>(null)
  const [hovered, setHovered] = useState(false)

  useFrame(() => {
    if (!meshGroupRef.current) return
    if (settledRollRef.current === die.rolledAt) return

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
      settledRollRef.current = die.rolledAt
    }
  })

  useEffect(() => {
    return () => {
      setSpatialUiHovered(false, `table-die-${die.id}`)
    }
  }, [die.id])

  return (
    <group
      position={[die.localPos[0], 0, die.localPos[1]]}
      pointerEventsType={{ deny: 'grab' }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        setSpatialUiHovered(true, `table-die-${die.id}`)
      }}
      onPointerOut={() => {
        setHovered(false)
        setSpatialUiHovered(false, `table-die-${die.id}`)
      }}
      onClick={(e) => {
        e.stopPropagation()
        playSpatialUiFeedback('dice-roll')
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
  const sourceId = `rim-chip-${label}`

  useEffect(() => {
    return () => {
      setSpatialUiHovered(false, sourceId)
    }
  }, [sourceId])

  return (
    <group
      position={position}
      rotation={[-Math.PI / 2, 0, 0]}
      scale={hovered ? 1.04 : 1}
      pointerEventsType={{ deny: 'grab' }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        setSpatialUiHovered(true, sourceId)
      }}
      onPointerOut={() => {
        setHovered(false)
        setSpatialUiHovered(false, sourceId)
      }}
      onClick={(e) => {
        e.stopPropagation()
        playSpatialUiFeedback('ui-click')
        onClick()
      }}
    >
      {(hovered || active) && (
        <RoundedBox
          args={[width + 0.008, 0.056, 0.009]}
          radius={0.012}
          smoothness={2}
          position={[0, 0, -0.002]}
          raycast={() => null}
        >
          <meshBasicMaterial
            color={active ? '#E5A93C' : '#38BDF8'}
            transparent
            opacity={active ? 0.5 : 0.4}
          />
        </RoundedBox>
      )}
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
  onSetGameMode,
  onBetChips,
  onDealBlackjack,
  onHitBlackjack,
  onStandBlackjack,
  onDealHoldem,
  onAdvanceHoldemStreet,
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

  const gameMode: TableGameMode = tabletopState.gameMode ?? 'blackjack'
  const myPrivateCards = tabletopState.hands[localUserId]?.cards ?? []
  const myBlackjackScore = useMemo(
    () => (myPrivateCards.length > 0 ? scoreBlackjackHand(myPrivateCards) : null),
    [myPrivateCards],
  )
  const dealerCards = tabletopState.dealerCards ?? []
  const dealerRevealed = tabletopState.dealerHoleRevealed ?? false
  const dealerBlackjackScore = useMemo(
    () =>
      dealerCards.length > 0
        ? scoreBlackjackHand(dealerRevealed ? dealerCards : [dealerCards[0]])
        : null,
    [dealerCards, dealerRevealed],
  )

  const otherHandSummaries = useMemo(
    () =>
      Object.values(tabletopState.hands).filter(
        (h) => h.userId !== localUserId && h.cards.length > 0,
      ),
    [localUserId, tabletopState.hands],
  )

  const potChips = tabletopState.potChips ?? 50
  const localParticipantName =
    participants.find((p) => p.userId === localUserId)?.displayName ?? 'Lounge'
  const myStack =
    tabletopState.playerChips?.[localParticipantName] ??
    tabletopState.playerChips?.Lounge ??
    500

  const tabletopY = 0.76

  return (
    <group name="bar-games-interactive-table" position={tableOrigin}>
      {/* ================================================================= */}
      {/* GAMING TABLE PEDESTAL, APRON & PADDED ARMREST RAIL                */}
      {/* ================================================================= */}
      {/* Heavy Floor Base */}
      <mesh position={[0, 0.03, 0]}>
        <cylinderGeometry args={[0.48, 0.54, 0.06, 24]} />
        <meshStandardMaterial color="#1B130E" roughness={0.35} metalness={0.1} />
      </mesh>
      {/* Turned Central Column */}
      <mesh position={[0, 0.39, 0]}>
        <cylinderGeometry args={[0.14, 0.19, 0.68, 20]} />
        <meshStandardMaterial color="#2C1D13" roughness={0.35} metalness={0.1} />
      </mesh>
      {/* Outer Casino Rail */}
      <mesh position={[0, tabletopY - 0.025, 0]}>
        <cylinderGeometry args={[0.78, 0.76, 0.065, 32]} />
        <meshStandardMaterial color="#241710" roughness={0.35} metalness={0.1} />
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
          roughness={0.85}
          metalness={0.04}
        />
      </mesh>

      {/* Surface & Game Mode Rim Controls */}
      <group name="game-table-dealer-console" position={[0, tabletopY + 0.016, 0]}>
        {/* Game Mode Tabs along North Rim */}
        <RimChip
          label="🃏 Blackjack 21"
          position={[-0.27, 0, -0.61]}
          width={0.165}
          active={gameMode === 'blackjack'}
          color="#065F46"
          onClick={() => onSetGameMode?.('blackjack')}
        />
        <RimChip
          label="♠️ Hold'em Poker"
          position={[-0.08, 0, -0.61]}
          width={0.175}
          active={gameMode === 'holdem'}
          color="#1E3A8A"
          onClick={() => onSetGameMode?.('holdem')}
        />
        <RimChip
          label="🎲 RPG & Dice"
          position={[0.11, 0, -0.61]}
          width={0.155}
          active={gameMode === 'freeform'}
          color="#4C1D95"
          onClick={() => onSetGameMode?.('freeform')}
        />

        {/* Surface & Grid Selector Chips on North-West Rim */}
        <RimChip
          label="Felt"
          position={[-0.36, 0, -0.52]}
          width={0.085}
          active={tabletopState.surface === 'felt'}
          onClick={() => onSetSurface('felt')}
        />
        <RimChip
          label="Wood"
          position={[-0.26, 0, -0.52]}
          width={0.085}
          active={tabletopState.surface === 'wood'}
          onClick={() => onSetSurface('wood')}
        />
        {gameMode === 'freeform' && (
          <>
            <RimChip
              label="Sq Grid"
              position={[-0.145, 0, -0.52]}
              width={0.11}
              active={tabletopState.surface === 'square-grid'}
              onClick={() => onSetSurface('square-grid')}
            />
            <RimChip
              label="Hex Grid"
              position={[-0.015, 0, -0.52]}
              width={0.115}
              active={tabletopState.surface === 'hex-grid'}
              onClick={() => onSetSurface('hex-grid')}
            />
            <RimChip
              label="+ Token"
              position={[0.115, 0, -0.52]}
              width={0.105}
              color="#0F766E"
              onClick={() => {
                const pick =
                  TOKEN_PALETTE[tabletopState.tokens.length % TOKEN_PALETTE.length]
                onSpawnToken(pick.label, pick.color)
              }}
            />
          </>
        )}

        {/* =============================================================== */}
        {/* MODE-SPECIFIC INTERACTIVE DEALER & BETTING CONTROLS             */}
        {/* =============================================================== */}
        {gameMode === 'blackjack' && (
          <group position={[0, 0.002, 0.42]}>
            <RimChip
              label="🃏 DEAL 21"
              position={[-0.27, 0, 0]}
              width={0.145}
              color="#15803D"
              onClick={() => (onDealBlackjack ? onDealBlackjack() : onDealCardToTable(true))}
            />
            <RimChip
              label="👆 HIT"
              position={[-0.11, 0, 0]}
              width={0.115}
              color="#B45309"
              onClick={() => (onHitBlackjack ? onHitBlackjack() : onDrawCardToHand())}
            />
            <RimChip
              label="✋ STAND"
              position={[0.03, 0, 0]}
              width={0.125}
              color="#991B1B"
              onClick={() => (onStandBlackjack ? onStandBlackjack() : onDealCardToTable(true))}
            />
            <RimChip
              label="🪙 BET +$25"
              position={[0.19, 0, 0]}
              width={0.145}
              color="#0369A1"
              onClick={() => onBetChips?.(25)}
            />
          </group>
        )}

        {gameMode === 'holdem' && (
          <group position={[0, 0.002, 0.42]}>
            <RimChip
              label="♠️ DEAL HAND"
              position={[-0.28, 0, 0]}
              width={0.155}
              color="#1D4ED8"
              onClick={() => (onDealHoldem ? onDealHoldem() : onDrawCardToHand())}
            />
            <RimChip
              label={
                tabletopState.holdemStreet === 'preflop'
                  ? '🔥 DEAL FLOP'
                  : tabletopState.holdemStreet === 'flop'
                    ? '🔥 DEAL TURN'
                    : tabletopState.holdemStreet === 'turn'
                      ? '🔥 DEAL RIVER'
                      : tabletopState.holdemStreet === 'river'
                        ? '🏆 SHOWDOWN'
                        : '🔥 NEXT STREET'
              }
              position={[-0.08, 0, 0]}
              width={0.18}
              color="#B45309"
              onClick={() =>
                onAdvanceHoldemStreet ? onAdvanceHoldemStreet() : onDealCardToTable(true)
              }
            />
            <RimChip
              label="🪙 BET +$25"
              position={[0.12, 0, 0]}
              width={0.135}
              color="#15803D"
              onClick={() => onBetChips?.(25)}
            />
            <RimChip
              label="💰 +$100"
              position={[0.26, 0, 0]}
              width={0.11}
              color="#7C2D12"
              onClick={() => onBetChips?.(100)}
            />
          </group>
        )}

        {/* Quick Polyhedral Dice Tray along South Rim (shown only in RPG & Dice mode) */}
        {gameMode === 'freeform' && (
          <>
            {(['d4', 'd6', 'd8', 'd10', 'd12', 'd20'] as const).map((dk, idx) => (
              <RimChip
                key={dk}
                label={dk}
                position={[-0.38 + idx * 0.088, 0, 0.54]}
                width={0.078}
                color="#312E81"
                onClick={() => {
                  playSpatialUiFeedback('dice-roll')
                  onRollDice([dk])
                }}
              />
            ))}
            <RimChip
              label="🎲 2d6+d20"
              position={[0.21, 0, 0.54]}
              width={0.145}
              color="#7C2D12"
              onClick={() => {
                playSpatialUiFeedback('dice-roll')
                onRollDice(['d20', 'd6', 'd6'])
              }}
            />
          </>
        )}

        {/* =============================================================== */}
        {/* 3D DEALER CARDS ZONE & POKER CHIP STACKS                        */}
        {/* =============================================================== */}
        {dealerCards.length > 0 && (
          <group name="table-dealer-cards" position={[-0.12, 0.005, -0.28]}>
            <Suspense fallback={null}>
              <Text
                position={[0.06, 0.008, -0.085]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.019}
                color="#FDE68A"
                anchorX="center"
                anchorY="middle"
              >
                {gameMode === 'blackjack' && dealerBlackjackScore
                  ? `DEALER (${dealerRevealed ? dealerBlackjackScore.total : `${dealerBlackjackScore.total}+?`})`
                  : `HOUSE HOLE CARDS`}
              </Text>
            </Suspense>
            {dealerCards.map((dc, idx) => {
              const showFace = idx === 0 || dealerRevealed
              return (
                <group
                  key={`dealer-${dc.id}-${idx}`}
                  position={[idx * 0.095, idx * 0.0012, 0]}
                >
                  <PlayingCard3D
                    rank={dc.rank}
                    suit={dc.suit}
                    faceUp={showFace}
                    orientation="flat"
                    width={0.08}
                    height={0.114}
                  />
                </group>
              )
            })}
          </group>
        )}

        {/* 3D Casino Chip Stacks & Central Pot Readout */}
        <group name="table-chip-pot" position={[-0.36, 0.004, 0.02]}>
          {[0, 1, 2, 3].map((stackIdx) => (
            <mesh
              key={`chip-red-${stackIdx}`}
              position={[0, 0.006 + stackIdx * 0.007, 0]}
            >
              <cylinderGeometry args={[0.024, 0.024, 0.006, 16]} />
              <meshStandardMaterial color="#EF4444" roughness={0.35} metalness={0.2} />
            </mesh>
          ))}
          {[0, 1, 2].map((stackIdx) => (
            <mesh
              key={`chip-green-${stackIdx}`}
              position={[0.056, 0.006 + stackIdx * 0.007, 0.015]}
            >
              <cylinderGeometry args={[0.024, 0.024, 0.006, 16]} />
              <meshStandardMaterial color="#10B981" roughness={0.35} metalness={0.2} />
            </mesh>
          ))}
          {[0, 1].map((stackIdx) => (
            <mesh
              key={`chip-gold-${stackIdx}`}
              position={[0.028, 0.006 + stackIdx * 0.007, -0.042]}
            >
              <cylinderGeometry args={[0.024, 0.024, 0.006, 16]} />
              <meshStandardMaterial color="#F59E0B" roughness={0.3} metalness={0.35} />
            </mesh>
          ))}
          <Suspense fallback={null}>
            <Text
              position={[0.025, 0.046, 0.055]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.02}
              color="#FDE68A"
              anchorX="center"
              anchorY="middle"
            >
              {`POT $${potChips} · STACK $${myStack}`}
            </Text>
          </Suspense>
        </group>

        {/* =============================================================== */}
        {/* 3D POLYHEDRAL DICE & FLOATING RESULT BANNER                     */}
        {/* =============================================================== */}
        {tabletopState.dice.map((die) => (
          <PolyhedralDie3D key={die.id} die={die} onReroll={onRerollSingleDie} />
        ))}

        {/* Floating 3D Table Status & Roll Sum Banner above Center of Table */}
        <group position={[0, 0.34, 0]}>
          <RoundedBox args={[0.84, 0.135, 0.014]} radius={0.02} smoothness={2}>
            <meshBasicMaterial color="#0D131F" transparent opacity={0.92} />
          </RoundedBox>
          <Suspense fallback={null}>
            <Text
              position={[0, 0.032, 0.01]}
              fontSize={0.025}
              color={accentColor}
              anchorX="center"
              anchorY="middle"
            >
              {gameMode === 'blackjack'
                ? `🃏 BLACKJACK 21 · POT $${potChips}${myBlackjackScore ? ` · YOUR HAND: ${myBlackjackScore.total}` : ''}`
                : gameMode === 'holdem'
                  ? `♠️ TEXAS HOLD'EM (${(tabletopState.holdemStreet ?? 'idle').toUpperCase()}) · POT $${potChips}`
                  : `🎲 DICE SUM: ${tabletopState.lastRollTotal} (${tabletopState.lastRollerName})`}
            </Text>
            <Text
              position={[0, -0.016, 0.01]}
              fontSize={0.018}
              color="#E2E8F0"
              maxWidth={0.78}
              anchorX="center"
              anchorY="middle"
            >
              {tabletopState.tableBanner || tabletopState.lastRollSummary}
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

        {/* Player Felt Zone Label when cards are dealt on the table */}
        {tabletopState.tableCards.length > 0 && (
          <Suspense fallback={null}>
            <Text
              position={[-0.02, 0.008, 0.15]}
              rotation={[-Math.PI / 2, 0, 0]}
              fontSize={0.018}
              color="#38BDF8"
              anchorX="center"
              anchorY="middle"
            >
              {gameMode === 'blackjack' && myBlackjackScore
                ? `PLAYER CARDS (${myBlackjackScore.total}${myBlackjackScore.soft ? ' SOFT' : ''})`
                : gameMode === 'holdem'
                  ? 'COMMUNITY BOARD'
                  : 'TABLE CARDS (TAP TO FLIP)'}
            </Text>
          </Suspense>
        )}

        {/* Shared Cards Dealt / Played to Table (Click to Flip!) */}
        {tabletopState.tableCards.map((tc, idx) => (
          <group
            key={`${tc.card.id}-${idx}`}
            position={[tc.localPos[0], 0.004 + idx * 0.0014, tc.localPos[1]]}
            rotation={[0, tc.rotationY, 0]}
            pointerEventsType={{ deny: 'grab' }}
            onClick={(e) => {
              e.stopPropagation()
              onFlipTableCard(tc.card.id)
            }}
          >
            <PlayingCard3D
              rank={tc.card.rank}
              suit={tc.card.suit}
              faceUp={tc.faceUp}
              orientation="flat"
              width={0.082}
              height={0.116}
            />
          </group>
        ))}

        {/* Local Player's PRIVATE 3D Hand Fan (Visible ONLY to localUserId!) */}
        {myPrivateCards.length > 0 && (
          <group position={[0, 0.12, 0.62]} rotation={[-0.55, 0, 0]}>
            {myPrivateCards.slice(0, 7).map((card, idx) => {
              const count = Math.min(7, myPrivateCards.length)
              const offset = (idx - (count - 1) / 2) * 0.078
              return (
                <group
                  key={card.id}
                  position={[offset, 0, idx * 0.0035]}
                  pointerEventsType={{ deny: 'grab' }}
                  onClick={(e) => {
                    e.stopPropagation()
                    onPlayCardFromHand(card.id, true)
                  }}
                >
                  <PlayingCard3D
                    rank={card.rank}
                    suit={card.suit}
                    faceUp={true}
                    orientation="upright"
                    width={0.074}
                    height={0.106}
                    footerLabel="PLAY"
                  />
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
              <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.25} />
            </mesh>
            <mesh position={[0, 0.24, 0]}>
              <cylinderGeometry args={[0.04, 0.05, 0.44, 12]} />
              <meshStandardMaterial color="#475569" metalness={0.75} roughness={0.25} />
            </mesh>
            {/* Padded Matte Cushion */}
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
                roughness={0.85}
                metalness={0.04}
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
