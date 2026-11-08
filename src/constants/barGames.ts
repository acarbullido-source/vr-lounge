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

export function createInitialTabletopState(): TabletopState {
  return {
    revision: 0,
    updatedAt: 0,
    surface: 'felt',
    dice: [
      {
        id: 'init-d20',
        kind: 'd20',
        value: 20,
        color: DIE_COLORS.d20,
        localPos: [-0.14, -0.06],
        rotation: [0.3, 0.5, 0.1],
        rolledBy: 'Lounge',
        rolledAt: 0,
      },
      {
        id: 'init-d6',
        kind: 'd6',
        value: 6,
        color: DIE_COLORS.d6,
        localPos: [0.06, -0.08],
        rotation: [0, 0.4, 0],
        rolledBy: 'Lounge',
        rolledAt: 0,
      },
    ],
    lastRollSummary: 'Grab or tap any polyhedral die (d4–d20) to roll for the table!',
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
        localPos: [-0.22, 0.22],
        ownerName: 'Lounge',
      },
      {
        id: 'tok-mage',
        label: 'Mage',
        color: '#38BDF8',
        localPos: [0.22, 0.22],
        ownerName: 'Lounge',
      },
    ],
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
    terrain: 'dungeon-keep',
    fogEnabled: false,
    revealedFogCells: ['2,2', '2,3', '3,2', '3,3'],
    selectedMiniId: 'holo-hero-paladin',
    lastActionSummary: 'Tactical Holotable Sanctum online — select terrain, move miniatures, or toggle Fog of War.',
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
      },
    ],
  }
}

