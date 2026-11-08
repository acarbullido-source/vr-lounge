import type {
  CardRank,
  CardSuit,
  ClubhousePersistentState,
  CompletedMatchRecord,
  CornholeState,
  CricketTarget,
  DartHitResult,
  DartPlayerSlot,
  DartsMatchState,
  DieKind,
  HolotableState,
  PlayingCard,
  PredictionProp,
  PuttShotSettlePacket,
  PuttingMatchState,
  PuttingPlayerSlot,
  ShuffleboardState,
  TableSurfaceStyle,
  TabletopState,
  ThrownDartRecord,
} from '../types/barGames'

/**
 * Standard clockwise dartboard sector order starting at 12 o'clock (20):
 * 12 o'clock = 20, 3 o'clock = 6, 6 o'clock = 3, 9 o'clock = 11.
 */
export const DARTBOARD_SECTORS = [
  20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5,
] as const

export const CRICKET_TARGETS: readonly CricketTarget[] = [
  20, 19, 18, 17, 16, 15, 25,
] as const

/**
 * Playable regulation-proportioned dartboard radii (meters, outer scoring radius = 0.225m / 45cm diameter).
 */
export const DARTBOARD_RADII = {
  innerBull: 0.015, // 50 pts (Double Bull)
  outerBull: 0.034, // 25 pts (Single Bull)
  tripleInner: 0.112,
  tripleOuter: 0.132,
  doubleInner: 0.205,
  doubleOuter: 0.225,
  surroundOuter: 0.285,
} as const

export const DIE_MAX_VALUES: Record<DieKind, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
}

export const DIE_COLORS: Record<DieKind, string> = {
  d4: '#F59E0B',
  d6: '#EF4444',
  d8: '#10B981',
  d10: '#06B6D4',
  d12: '#8B5CF6',
  d20: '#EC4899',
}

export const TOKEN_PALETTE = [
  { label: 'Hero', color: '#E5A93C' },
  { label: 'Rogue', color: '#EF4444' },
  { label: 'Mage', color: '#38BDF8' },
  { label: 'Ranger', color: '#10B981' },
  { label: 'Bard', color: '#A855F7' },
  { label: 'Boss', color: '#F4F1EA' },
] as const

export const QUICK_PROP_TEMPLATES: ReadonlyArray<{
  title: string
  options: string[]
  stakeDollars: number
}> = [
  {
    title: 'Next Darts Match Winner',
    options: ['Player 1', 'Player 2'],
    stakeDollars: 1,
  },
  {
    title: 'Next Mini-Golf Putt Result',
    options: ['Sinks the Putt!', 'Misses / Lip-Out'],
    stakeDollars: 1,
  },
  {
    title: 'Watch-Party Over/Under Score',
    options: ['Over', 'Under'],
    stakeDollars: 1,
  },
  {
    title: 'Next d20 Roll Outcome',
    options: ['11–20 (High Roll)', '1–10 (Low Roll)'],
    stakeDollars: 1,
  },
]

export function normalizePlayerKey(displayName: string): string {
  const cleaned = displayName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
  return cleaned || 'guest'
}

/**
 * Polar coordinate dartboard scorer.
 * `localX` is horizontal offset on the board face (+X = viewer's right / 3 o'clock = 6).
 * `localY` is vertical offset on the board face (+Y = viewer's up / 12 o'clock = 20).
 */
export function scoreDartPolar(localX: number, localY: number): DartHitResult {
  const r = Math.hypot(localX, localY)

  if (r <= DARTBOARD_RADII.innerBull) {
    return {
      points: 50,
      sector: 25,
      multiplier: 2,
      ring: 'inner-bull',
      label: 'DBULL (50)',
      localX,
      localY,
    }
  }

  if (r <= DARTBOARD_RADII.outerBull) {
    return {
      points: 25,
      sector: 25,
      multiplier: 1,
      ring: 'outer-bull',
      label: 'BULL (25)',
      localX,
      localY,
    }
  }

  if (r > DARTBOARD_RADII.doubleOuter) {
    return {
      points: 0,
      sector: 0,
      multiplier: 0,
      ring: 'miss',
      label: 'MISS',
      localX,
      localY,
    }
  }

  let clockwiseAngle = Math.atan2(localX, localY)
  if (clockwiseAngle < 0) clockwiseAngle += Math.PI * 2
  const shifted = (clockwiseAngle + Math.PI / 20) % (Math.PI * 2)
  const sectorIdx = Math.floor(shifted / (Math.PI / 10)) % 20
  const sector = DARTBOARD_SECTORS[sectorIdx]

  if (r >= DARTBOARD_RADII.tripleInner && r <= DARTBOARD_RADII.tripleOuter) {
    return {
      points: sector * 3,
      sector,
      multiplier: 3,
      ring: 'triple',
      label: `T${sector}`,
      localX,
      localY,
    }
  }

  if (r >= DARTBOARD_RADII.doubleInner && r <= DARTBOARD_RADII.doubleOuter) {
    return {
      points: sector * 2,
      sector,
      multiplier: 2,
      ring: 'double',
      label: `D${sector}`,
      localX,
      localY,
    }
  }

  return {
    points: sector,
    sector,
    multiplier: 1,
    ring: 'single',
    label: `${sector}`,
    localX,
    localY,
  }
}

export function createEmptyCricketMarks(): Record<CricketTarget, number> {
  return {
    20: 0,
    19: 0,
    18: 0,
    17: 0,
    16: 0,
    15: 0,
    25: 0,
  }
}

export function formatCricketMarkSymbol(marks: number): string {
  if (marks <= 0) return '·'
  if (marks === 1) return '/'
  if (marks === 2) return 'X'
  return '⊗'
}

export function createDartPlayerSlot(
  userId: string,
  displayName: string,
  color: string,
): DartPlayerSlot {
  return {
    userId,
    displayName,
    color,
    score501: 501,
    cricketPoints: 0,
    cricketMarks: createEmptyCricketMarks(),
  }
}

export function createInitialDartsMatchState(): DartsMatchState {
  return {
    mode: '501',
    doubleOut: false,
    players: [],
    activePlayerIndex: 0,
    dartsThrownInTurn: 0,
    turnStartScore501: 501,
    lastTurnSummary: 'Step up to the Oche or click Join Darts to start 501 or Cricket!',
    winnerId: null,
    winnerName: null,
    stuckDarts: [],
    revision: 0,
    updatedAt: 0,
  }
}

export interface AppliedDartTurnResult {
  nextMatch: DartsMatchState
  completedRecord: CompletedMatchRecord | null
  checkoutAchieved: number
  hitBullseye: boolean
}

/**
 * Pure deterministic reducer applying a settled dart hit to the current 501 or Cricket match.
 * Automatically auto-enrolls the thrower if the match roster has <2 players or doesn't include them yet.
 */
export function applyDartHitToMatch(
  prev: DartsMatchState,
  dart: ThrownDartRecord,
): AppliedDartTurnResult {
  let players = prev.players.map((p) => ({
    ...p,
    cricketMarks: { ...p.cricketMarks },
  }))

  let playerIdx = players.findIndex((p) => p.userId === dart.shooterId)
  if (playerIdx === -1) {
    if (players.length < 4 && !prev.winnerId) {
      players.push(createDartPlayerSlot(dart.shooterId, dart.shooterName, dart.color))
      playerIdx = players.length - 1
    } else {
      playerIdx = Math.min(prev.activePlayerIndex, Math.max(0, players.length - 1))
    }
  }

  // If previous match already had a winner, auto-reset leg for a fresh game on next throw
  let baseTurnDarts = prev.dartsThrownInTurn
  let turnStart501 = prev.turnStartScore501
  let stuckDarts = prev.stuckDarts

  if (prev.winnerId) {
    players = players.map((p) => ({
      ...p,
      score501: 501,
      cricketPoints: 0,
      cricketMarks: createEmptyCricketMarks(),
    }))
    baseTurnDarts = 0
    turnStart501 = 501
    stuckDarts = []
  } else if (playerIdx !== prev.activePlayerIndex) {
    // Allow casual free-throw switching if another enrolled player steps up at start of visit
    baseTurnDarts = 0
    turnStart501 = players[playerIdx].score501
  } else if (baseTurnDarts === 0) {
    turnStart501 = players[playerIdx].score501
    stuckDarts = []
  }

  const shooter = players[playerIdx]
  const { hit } = dart
  const hitBullseye = hit.ring === 'inner-bull' || hit.ring === 'outer-bull'
  const nextStuck = [...stuckDarts.slice(-5), dart]

  let summary = `${shooter.displayName} hit ${hit.label}`
  let winnerId: string | null = null
  let winnerName: string | null = null
  let checkoutAchieved = 0
  let completedRecord: CompletedMatchRecord | null = null

  let nextActiveIdx = playerIdx
  let nextDartsInTurn = baseTurnDarts + 1
  let nextTurnStart501 = turnStart501

  if (prev.mode === '501') {
    const candidate = shooter.score501 - hit.points
    const isValidDoubleFinish =
      !prev.doubleOut || hit.ring === 'double' || hit.ring === 'inner-bull'
    const busted =
      candidate < 0 ||
      (prev.doubleOut && candidate === 1) ||
      (candidate === 0 && !isValidDoubleFinish)

    if (busted) {
      shooter.score501 = turnStart501
      summary = `${shooter.displayName} BUSTED on ${hit.label}! Back to ${turnStart501}.`
      nextActiveIdx = (playerIdx + 1) % players.length
      nextDartsInTurn = 0
      nextTurnStart501 = players[nextActiveIdx].score501
    } else if (candidate === 0) {
      shooter.score501 = 0
      winnerId = shooter.userId
      winnerName = shooter.displayName
      checkoutAchieved = turnStart501
      summary = `🎯 ${shooter.displayName} checked out ${turnStart501} with ${hit.label} to WIN 501!`
      nextDartsInTurn = 0
      completedRecord = {
        id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        game: 'darts-501',
        winnerId: shooter.userId,
        winnerName: shooter.displayName,
        participants: players.map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          finalScore: p.score501,
        })),
        highlight: `${turnStart501} checkout (${hit.label})`,
        completedAt: Date.now(),
      }
    } else {
      shooter.score501 = candidate
      summary = `${shooter.displayName}: ${hit.label} (-${hit.points}) → ${candidate} left`
      if (nextDartsInTurn >= 3) {
        nextActiveIdx = (playerIdx + 1) % players.length
        nextDartsInTurn = 0
        nextTurnStart501 = players[nextActiveIdx].score501
      }
    }
  } else {
    // CRICKET MODE (20, 19, 18, 17, 16, 15, Bull=25)
    const target = hit.sector as CricketTarget
    if (CRICKET_TARGETS.includes(target) && hit.multiplier > 0) {
      const prevMarks = shooter.cricketMarks[target] ?? 0
      const totalMarks = prevMarks + hit.multiplier
      const clampedMarks = Math.min(3, totalMarks)
      const overflowMarks = Math.max(0, totalMarks - 3)
      shooter.cricketMarks[target] = clampedMarks

      const opponents = players.filter((_, idx) => idx !== playerIdx)
      const anyOpponentOpen =
        opponents.length === 0 ||
        opponents.some((opp) => (opp.cricketMarks[target] ?? 0) < 3)

      let scoredPts = 0
      if (overflowMarks > 0 && anyOpponentOpen) {
        const unitValue = target === 25 ? 25 : target
        scoredPts = overflowMarks * unitValue
        shooter.cricketPoints += scoredPts
      }

      const targetName = target === 25 ? 'Bull' : String(target)
      summary =
        scoredPts > 0
          ? `${shooter.displayName}: ${hit.label} (+${scoredPts} Cricket pts · ${formatCricketMarkSymbol(clampedMarks)} on ${targetName})`
          : `${shooter.displayName}: ${hit.label} (${formatCricketMarkSymbol(clampedMarks)} on ${targetName})`
    } else {
      summary = `${shooter.displayName}: ${hit.label} (no Cricket mark)`
    }

    // Check Cricket win: all 7 targets closed (=== 3) AND highest/tied-top points
    const closedAll = CRICKET_TARGETS.every((t) => shooter.cricketMarks[t] >= 3)
    const maxOtherPoints = players
      .filter((_, idx) => idx !== playerIdx)
      .reduce((m, p) => Math.max(m, p.cricketPoints), 0)

    if (closedAll && shooter.cricketPoints >= maxOtherPoints) {
      winnerId = shooter.userId
      winnerName = shooter.displayName
      summary = `🏆 ${shooter.displayName} closed the board (${shooter.cricketPoints} pts) to WIN Cricket!`
      nextDartsInTurn = 0
      completedRecord = {
        id: `match-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        game: 'darts-cricket',
        winnerId: shooter.userId,
        winnerName: shooter.displayName,
        participants: players.map((p) => ({
          userId: p.userId,
          displayName: p.displayName,
          finalScore: p.cricketPoints,
        })),
        highlight: `${shooter.cricketPoints} Cricket pts`,
        completedAt: Date.now(),
      }
    } else if (nextDartsInTurn >= 3) {
      nextActiveIdx = (playerIdx + 1) % players.length
      nextDartsInTurn = 0
    }
  }

  return {
    nextMatch: {
      ...prev,
      players,
      activePlayerIndex: nextActiveIdx,
      dartsThrownInTurn: nextDartsInTurn,
      turnStartScore501: nextTurnStart501,
      lastTurnSummary: summary,
      winnerId,
      winnerName,
      stuckDarts: nextStuck,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
    },
    completedRecord,
    checkoutAchieved,
    hitBullseye,
  }
}

// ============================================================================
// Mini-Golf Putting Strip Constants & Match Reducer
// ============================================================================

export const PUTTING_STRIP_SPECS = {
  length: 3.8,
  width: 0.92,
  teeLocalZ: 1.55,
  cupLocalZ: -1.48,
  cupRadius: 0.055,
  ballRadius: 0.022,
  rampCenterZ: 0.08,
  rampHalfLength: 0.42,
  rampPeakHeight: 0.075,
} as const

export function createPuttingPlayerSlot(
  userId: string,
  displayName: string,
  color: string,
): PuttingPlayerSlot {
  return {
    userId,
    displayName,
    color,
    currentStreak: 0,
    bestSessionStreak: 0,
    puttOffScore: 0,
    puttsTaken: 0,
  }
}

export function createInitialPuttingMatchState(): PuttingMatchState {
  return {
    mode: 'streak',
    rampEnabled: false,
    players: [],
    activePlayerIndex: 0,
    round: 1,
    maxRounds: 5,
    ballRestLocal: [0, PUTTING_STRIP_SPECS.ballRadius, PUTTING_STRIP_SPECS.teeLocalZ],
    lastOutcomeText: 'Grab the VR Putter or drag on the ball to putt for a streak!',
    winnerId: null,
    winnerName: null,
    revision: 0,
    updatedAt: 0,
  }
}

export interface AppliedPuttResult {
  nextMatch: PuttingMatchState
  completedRecord: CompletedMatchRecord | null
  newStreakRecord: number
}

export function applyPuttSettleToMatch(
  prev: PuttingMatchState,
  settle: PuttShotSettlePacket,
  shooterColor: string,
): AppliedPuttResult {
  let players = prev.players.map((p) => ({ ...p }))
  let pIdx = players.findIndex((p) => p.userId === settle.shooterId)
  if (pIdx === -1) {
    players.push(createPuttingPlayerSlot(settle.shooterId, settle.shooterName, shooterColor))
    pIdx = players.length - 1
  }

  let round = prev.round
  if (prev.winnerId) {
    players = players.map((p) => ({
      ...p,
      puttOffScore: 0,
      puttsTaken: 0,
    }))
    round = 1
  }

  const player = players[pIdx]
  player.puttsTaken += 1

  let outcomeText: string
  let newStreakRecord = 0

  if (settle.holed) {
    player.currentStreak += 1
    player.bestSessionStreak = Math.max(player.bestSessionStreak, player.currentStreak)
    newStreakRecord = player.currentStreak
    const pts = settle.rampEnabled ? 2 : 1
    player.puttOffScore += pts
    outcomeText = `⛳ ${player.displayName} DRAINED IT (${settle.distanceMeters.toFixed(1)}m)${
      settle.rampEnabled ? ' over the Ramp (+2)' : ''
    }! Streak: ${player.currentStreak} 🔥`
  } else if (settle.lipOut) {
    player.currentStreak = 0
    outcomeText = `😮 ${player.displayName} lipped out at the cup! Streak reset.`
  } else {
    player.currentStreak = 0
    outcomeText = `${player.displayName} missed cup — stopped at (${settle.restLocalPos[0].toFixed(2)}m, ${settle.restLocalPos[2].toFixed(2)}m).`
  }

  let nextActiveIdx = (pIdx + 1) % players.length
  let winnerId: string | null = null
  let winnerName: string | null = null
  let completedRecord: CompletedMatchRecord | null = null

  if (prev.mode === 'puttoff' && players.length >= 1) {
    const allFinishedCurrentRound = players.every((p) => p.puttsTaken >= round)
    if (allFinishedCurrentRound) {
      if (round >= prev.maxRounds) {
        const sorted = [...players].sort((a, b) => b.puttOffScore - a.puttOffScore)
        const top = sorted[0]
        const tied = sorted.length > 1 && sorted[0].puttOffScore === sorted[1].puttOffScore
        if (!tied && top) {
          winnerId = top.userId
          winnerName = top.displayName
          outcomeText = `🏆 ${top.displayName} wins the ${prev.maxRounds}-Round Putt-Off (${top.puttOffScore} pts)!`
          completedRecord = {
            id: `putt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            game: 'putting-puttoff',
            winnerId: top.userId,
            winnerName: top.displayName,
            participants: players.map((p) => ({
              userId: p.userId,
              displayName: p.displayName,
              finalScore: p.puttOffScore,
            })),
            highlight: `${top.puttOffScore} pts in ${prev.maxRounds} rounds`,
            completedAt: Date.now(),
          }
        } else {
          // Sudden death extra round!
          round += 1
          outcomeText += ` · Tied at ${top.puttOffScore} — Sudden Death Round ${round}!`
        }
      } else {
        round += 1
      }
    }
  } else {
    nextActiveIdx = pIdx
  }

  return {
    nextMatch: {
      ...prev,
      players,
      activePlayerIndex: nextActiveIdx,
      round,
      ballRestLocal: settle.holed
        ? [0, PUTTING_STRIP_SPECS.ballRadius, PUTTING_STRIP_SPECS.teeLocalZ]
        : settle.restLocalPos,
      lastOutcomeText: outcomeText,
      winnerId,
      winnerName,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
    },
    completedRecord,
    newStreakRecord,
  }
}

// ============================================================================
// Pillar 3: 52-Card Standard Deck & Tabletop State Helpers
// ============================================================================

const SUITS: readonly CardSuit[] = ['spades', 'hearts', 'diamonds', 'clubs']
const RANKS: readonly CardRank[] = [
  'A',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  '10',
  'J',
  'Q',
  'K',
]

export const SUIT_SYMBOLS: Record<CardSuit, { glyph: string; color: string }> = {
  spades: { glyph: '♠', color: '#0F172A' },
  clubs: { glyph: '♣', color: '#0F172A' },
  hearts: { glyph: '♥', color: '#DC2626' },
  diamonds: { glyph: '♦', color: '#DC2626' },
}

export function createOrderedDeck52(): PlayingCard[] {
  const cards: PlayingCard[] = []
  for (const suit of SUITS) {
    for (const rank of RANKS) {
      cards.push({
        id: `${rank}-${suit}`,
        rank,
        suit,
      })
    }
  }
  return cards
}

export function shuffleCards(cards: PlayingCard[]): PlayingCard[] {
  const copy = [...cards]
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = copy[i]
    copy[i] = copy[j]
    copy[j] = tmp
  }
  return copy
}

export function snapTabletopCoords(
  x: number,
  z: number,
  surface: TableSurfaceStyle,
): [number, number] {
  const clampedX = Math.max(-0.56, Math.min(0.56, x))
  const clampedZ = Math.max(-0.56, Math.min(0.56, z))

  if (surface === 'square-grid') {
    const cell = 0.11
    return [
      Number((Math.round(clampedX / cell) * cell).toFixed(3)),
      Number((Math.round(clampedZ / cell) * cell).toFixed(3)),
    ]
  }

  if (surface === 'hex-grid') {
    const rowH = 0.095
    const colW = 0.11
    const row = Math.round(clampedZ / rowH)
    const offset = Math.abs(row) % 2 === 1 ? colW / 2 : 0
    const col = Math.round((clampedX - offset) / colW)
    return [
      Number(Math.max(-0.55, Math.min(0.55, col * colW + offset)).toFixed(3)),
      Number(Math.max(-0.55, Math.min(0.55, row * rowH)).toFixed(3)),
    ]
  }

  return [Number(clampedX.toFixed(3)), Number(clampedZ.toFixed(3))]
}

export function scoreBlackjackHand(cards: PlayingCard[]): { total: number; soft: boolean; blackjack: boolean } {
  let total = 0
  let aces = 0
  for (const c of cards) {
    if (c.rank === 'A') {
      aces += 1
      total += 11
    } else if (c.rank === 'K' || c.rank === 'Q' || c.rank === 'J' || c.rank === '10') {
      total += 10
    } else {
      total += Number(c.rank) || 0
    }
  }
  while (total > 21 && aces > 0) {
    total -= 10
    aces -= 1
  }
  const blackjack = cards.length === 2 && total === 21
  return { total, soft: aces > 0, blackjack }
}

const RANK_NUM: Record<CardRank, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  J: 11,
  Q: 12,
  K: 13,
  A: 14,
}

export function evaluateHoldemHand(cards: PlayingCard[]): { score: number; label: string } {
  if (cards.length === 0) return { score: 0, label: 'No Cards' }
  const counts: Record<number, number> = {}
  const suitCounts: Record<CardSuit, number[]> = {
    spades: [],
    hearts: [],
    diamonds: [],
    clubs: [],
  }
  for (const c of cards) {
    const v = RANK_NUM[c.rank]
    counts[v] = (counts[v] || 0) + 1
    suitCounts[c.suit].push(v)
  }
  const uniqueVals = Object.keys(counts)
    .map(Number)
    .sort((a, b) => b - a)

  // Check flush
  let flushSuit: CardSuit | null = null
  for (const s of SUITS) {
    if (suitCounts[s].length >= 5) {
      flushSuit = s
      break
    }
  }

  // Check straight
  const checkStraightHigh = (vals: number[]): number => {
    const set = new Set(vals)
    if (set.has(14)) set.add(1)
    for (let high = 14; high >= 5; high--) {
      if (
        set.has(high) &&
        set.has(high - 1) &&
        set.has(high - 2) &&
        set.has(high - 3) &&
        set.has(high - 4)
      ) {
        return high
      }
    }
    return 0
  }

  if (flushSuit) {
    const sfHigh = checkStraightHigh(suitCounts[flushSuit])
    if (sfHigh > 0) {
      return {
        score: 8000 + sfHigh,
        label: sfHigh === 14 ? 'Royal Flush!' : 'Straight Flush',
      }
    }
  }

  const groups = Object.entries(counts)
    .map(([v, cnt]) => ({ val: Number(v), count: cnt }))
    .sort((a, b) => b.count - a.count || b.val - a.val)

  if (groups[0]?.count === 4) {
    return { score: 7000 + groups[0].val, label: 'Four of a Kind' }
  }
  if (groups[0]?.count === 3 && (groups[1]?.count ?? 0) >= 2) {
    return { score: 6000 + groups[0].val * 15 + groups[1].val, label: 'Full House' }
  }
  if (flushSuit) {
    const topFlush = [...suitCounts[flushSuit]].sort((a, b) => b - a)[0] ?? 0
    return { score: 5000 + topFlush, label: 'Flush' }
  }
  const straightHigh = checkStraightHigh(uniqueVals)
  if (straightHigh > 0) {
    return { score: 4000 + straightHigh, label: 'Straight' }
  }
  if (groups[0]?.count === 3) {
    return { score: 3000 + groups[0].val, label: 'Three of a Kind' }
  }
  if (groups[0]?.count === 2 && groups[1]?.count === 2) {
    return {
      score: 2000 + groups[0].val * 15 + groups[1].val,
      label: 'Two Pair',
    }
  }
  if (groups[0]?.count === 2) {
    return { score: 1000 + groups[0].val, label: 'One Pair' }
  }
  return {
    score: uniqueVals[0] ?? 0,
    label: `High Card`,
  }
}

export function createInitialCheckersBoard(): number[] {
  // 8x8 board (row 0..7, col 0..7). 0=empty, 1=Red (bottom rows 5..7), 2=Black (top rows 0..2), 3=Red King, 4=Black King
  const board = new Array<number>(64).fill(0)
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) {
        if (r <= 2) board[r * 8 + c] = 2
        else if (r >= 5) board[r * 8 + c] = 1
      }
    }
  }
  return board
}

export function getCheckersLegalMoves(
  board: number[],
  fromIdx: number,
  turn: 'red' | 'black',
): Array<{ toIdx: number; jumpedIdx: number | null }> {
  const piece = board[fromIdx] ?? 0
  if (piece === 0) return []
  const isRed = piece === 1 || piece === 3
  if ((turn === 'red' && !isRed) || (turn === 'black' && isRed)) return []

  const isKing = piece === 3 || piece === 4
  const r = Math.floor(fromIdx / 8)
  const c = fromIdx % 8
  const rowDirs = isKing ? [-1, 1] : isRed ? [-1] : [1]
  const moves: Array<{ toIdx: number; jumpedIdx: number | null }> = []

  for (const dr of rowDirs) {
    for (const dc of [-1, 1]) {
      const nr = r + dr
      const nc = c + dc
      if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) {
        const nIdx = nr * 8 + nc
        if (board[nIdx] === 0) {
          moves.push({ toIdx: nIdx, jumpedIdx: null })
        } else {
          const midPiece = board[nIdx]
          const midIsRed = midPiece === 1 || midPiece === 3
          if (midIsRed !== isRed) {
            const jr = r + dr * 2
            const jc = c + dc * 2
            if (jr >= 0 && jr < 8 && jc >= 0 && jc < 8) {
              const jIdx = jr * 8 + jc
              if (board[jIdx] === 0) {
                moves.push({ toIdx: jIdx, jumpedIdx: nIdx })
              }
            }
          }
        }
      }
    }
  }
  return moves
}

export function createInitialChessBoard(): string[] {
  return [
    'bR', 'bN', 'bB', 'bQ', 'bK', 'bB', 'bN', 'bR',
    'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP', 'bP',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    '', '', '', '', '', '', '', '',
    'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP', 'wP',
    'wR', 'wN', 'wB', 'wQ', 'wK', 'wB', 'wN', 'wR',
  ]
}

export function getChessLegalMoves(
  board: string[],
  fromIdx: number,
  turn: 'w' | 'b',
): number[] {
  const piece = board[fromIdx] || ''
  if (!piece || piece[0] !== turn) return []
  const role = piece[1]
  const r = Math.floor(fromIdx / 8)
  const c = fromIdx % 8
  const targets: number[] = []

  const addIfValid = (nr: number, nc: number): boolean => {
    if (nr < 0 || nr >= 8 || nc < 0 || nc >= 8) return false
    const dest = board[nr * 8 + nc] || ''
    if (!dest) {
      targets.push(nr * 8 + nc)
      return true
    }
    if (dest[0] !== turn) {
      targets.push(nr * 8 + nc)
    }
    return false
  }

  if (role === 'P') {
    const dir = turn === 'w' ? -1 : 1
    const startRow = turn === 'w' ? 6 : 1
    const f1 = r + dir
    if (f1 >= 0 && f1 < 8 && !board[f1 * 8 + c]) {
      targets.push(f1 * 8 + c)
      const f2 = r + dir * 2
      if (r === startRow && !board[f2 * 8 + c]) {
        targets.push(f2 * 8 + c)
      }
    }
    for (const dc of [-1, 1]) {
      const nc = c + dc
      if (f1 >= 0 && f1 < 8 && nc >= 0 && nc < 8) {
        const diag = board[f1 * 8 + nc] || ''
        if (diag && diag[0] !== turn) {
          targets.push(f1 * 8 + nc)
        }
      }
    }
  } else if (role === 'N') {
    for (const [dr, dc] of [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1],
    ]) {
      addIfValid(r + dr, c + dc)
    }
  } else if (role === 'K') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr !== 0 || dc !== 0) addIfValid(r + dr, c + dc)
      }
    }
  } else {
    const dirs: Array<[number, number]> = []
    if (role === 'R' || role === 'Q') {
      dirs.push([-1, 0], [1, 0], [0, -1], [0, 1])
    }
    if (role === 'B' || role === 'Q') {
      dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1])
    }
    for (const [dr, dc] of dirs) {
      for (let step = 1; step < 8; step++) {
        if (!addIfValid(r + dr * step, c + dc * step)) break
      }
    }
  }

  return targets
}

export function createInitialConnect4Grid(): number[] {
  // 6 rows x 7 cols = 42 cells (row 0 = top, row 5 = bottom)
  return new Array<number>(42).fill(0)
}

export function checkConnect4Winner(grid: number[]): 1 | 2 | null {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ]
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const p = grid[r * 7 + c]
      if (p !== 1 && p !== 2) continue
      for (const [dr, dc] of dirs) {
        let match = true
        for (let k = 1; k < 4; k++) {
          const nr = r + dr * k
          const nc = c + dc * k
          if (nr < 0 || nr >= 6 || nc < 0 || nc >= 7 || grid[nr * 7 + nc] !== p) {
            match = false
            break
          }
        }
        if (match) return p
      }
    }
  }
  return null
}

export function createInitialTabletopState(): TabletopState {
  return {
    revision: 0,
    updatedAt: 0,
    surface: 'felt',
    gameMode: 'blackjack',
    dice: [
      {
        id: 'init-d20',
        kind: 'd20',
        value: 20,
        color: DIE_COLORS.d20,
        localPos: [-0.36, -0.18],
        rotation: [0.3, 0.5, 0.1],
        rolledBy: 'Lounge',
        rolledAt: 0,
      },
      {
        id: 'init-d6',
        kind: 'd6',
        value: 6,
        color: DIE_COLORS.d6,
        localPos: [-0.24, -0.22],
        rotation: [0, 0.4, 0],
        rolledBy: 'Lounge',
        rolledAt: 0,
      },
    ],
    lastRollSummary: 'Switch between Blackjack 21, Texas Hold’em Poker, or Freeform RPG & Dice!',
    lastRollerName: 'Lounge',
    lastRollTotal: 26,
    lastRollTimestamp: 0,
    deck: shuffleCards(createOrderedDeck52()),
    tableCards: [],
    hands: {},
    tokens: [
      {
        id: 'tok-gold',
        label: 'Hero',
        color: '#E5A93C',
        localPos: [-0.32, 0.28],
        ownerName: 'Lounge',
      },
      {
        id: 'tok-mage',
        label: 'Mage',
        color: '#38BDF8',
        localPos: [0.32, 0.28],
        ownerName: 'Lounge',
      },
    ],
    potChips: 50,
    playerChips: { Lounge: 500 },
    dealerCards: [],
    dealerHoleRevealed: false,
    blackjackPhase: 'betting',
    holdemStreet: 'idle',
    tableBanner: '🃏 Blackjack 21 Ready — Click DEAL 21 on the table rim to play!',
  }
}

export function createInitialClubhouseState(): ClubhousePersistentState {
  const defaultProp: PredictionProp = {
    id: 'prop-welcome-1',
    title: 'Next Bar Game Showdown Winner',
    options: ['Challenger 1', 'Challenger 2'],
    stakeDollars: 1,
    status: 'open',
    winningOptionIndex: null,
    createdBy: 'Clubhouse',
    createdAt: Date.now(),
    picks: [],
  }

  return {
    revision: 0,
    updatedAt: 0,
    playerStats: {},
    ledger: {},
    recentMatches: [],
    props: [defaultProp],
  }
}

// ============================================================================
// Pillar 5: Table Shuffleboard, Deck Cornhole & Tactical Holotable Sanctum
// ============================================================================

export function createInitialShuffleboardState(): ShuffleboardState {
  return {
    revision: 0,
    updatedAt: 0,
    redScore: 0,
    blueScore: 0,
    activeTeam: 'red',
    pucks: [
      {
        id: 'puck-init-red-1',
        team: 'red',
        localX: -0.06,
        localZ: -0.92,
        points: 3,
        shotBy: 'Lounge',
      },
      {
        id: 'puck-init-blue-1',
        team: 'blue',
        localX: 0.07,
        localZ: -0.68,
        points: 2,
        shotBy: 'Lounge',
      },
    ],
    lastSummary: 'Slide Red & Blue pucks into the 1-2-3-4 scoring zones! First to 15 pts wins.',
    winnerTeam: null,
  }
}

export function createInitialCornholeState(): CornholeState {
  return {
    revision: 0,
    updatedAt: 0,
    goldScore: 0,
    cyanScore: 0,
    activeTeam: 'gold',
    bags: [
      {
        id: 'bag-init-gold-1',
        team: 'gold',
        boardIndex: 1,
        localX: 0.08,
        localZ: 0.14,
        inHole: false,
        points: 1,
        thrownBy: 'Lounge',
      },
    ],
    lastSummary: 'Toss beanbags onto the Deck boards — 3 PTS in the hole, 1 PT on the board! First to 21 wins.',
    winnerTeam: null,
  }
}

export function createInitialHolotableState(): HolotableState {
  return {
    revision: 0,
    updatedAt: 0,
    gameMode: 'adventure-rpg',
    terrain: 'dungeon-keep',
    fogEnabled: false,
    revealedFogCells: ['2,2', '2,3', '3,2', '3,3'],
    selectedMiniId: 'holo-hero-paladin',
    lastActionSummary: 'Tactical Sanctum ready — play Adventure Quest RPG, Checkers, Chess, or Connect-4!',
    rpgRound: 1,
    rpgActiveTurnIndex: 0,
    rpgCombatLog: [
      '⚔️ Round 1: Party enters the Elder Dragon Sanctum!',
      '🛡️ Select a Hero miniature and click Roll Attack (D20) or Cast Spell!',
    ],
    checkersBoard: createInitialCheckersBoard(),
    checkersTurn: 'red',
    checkersSelectedIdx: null,
    checkersWinner: null,
    chessBoard: createInitialChessBoard(),
    chessTurn: 'w',
    chessSelectedIdx: null,
    chessWinner: null,
    connect4Grid: createInitialConnect4Grid(),
    connect4Turn: 1,
    connect4Winner: null,
    miniatures: [
      {
        id: 'holo-hero-paladin',
        kind: 'hero-paladin',
        label: 'Paladin',
        color: '#F59E0B',
        localPos: [-0.35, 0.35],
        rotationY: 0.4,
        scale: 1,
        ownerName: 'Clubhouse',
        hp: 45,
        maxHp: 45,
      },
      {
        id: 'holo-hero-mage',
        kind: 'hero-mage',
        label: 'Archmage',
        color: '#38BDF8',
        localPos: [-0.12, 0.42],
        rotationY: 0.15,
        scale: 1,
        ownerName: 'Clubhouse',
        hp: 32,
        maxHp: 32,
      },
      {
        id: 'holo-hero-rogue',
        kind: 'hero-rogue',
        label: 'Shadow Rogue',
        color: '#10B981',
        localPos: [0.22, 0.32],
        rotationY: -0.35,
        scale: 1,
        ownerName: 'Clubhouse',
        hp: 36,
        maxHp: 36,
      },
      {
        id: 'holo-monster-dragon',
        kind: 'monster-dragon',
        label: 'Elder Dragon',
        color: '#EF4444',
        localPos: [0.05, -0.28],
        rotationY: Math.PI,
        scale: 1.25,
        ownerName: 'Dungeon Master',
        hp: 120,
        maxHp: 120,
      },
      {
        id: 'holo-prop-chest',
        kind: 'prop-chest',
        label: 'Relic Vault',
        color: '#EAB308',
        localPos: [-0.32, -0.34],
        rotationY: 0.6,
        scale: 1,
        ownerName: 'Dungeon Master',
        hp: 25,
        maxHp: 25,
      },
    ],
  }
}


