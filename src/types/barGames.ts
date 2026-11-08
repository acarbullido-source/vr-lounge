export type DartGameMode = '501' | 'cricket'

export type PuttingGameMode = 'streak' | 'puttoff'

export type DartRingKind = 'miss' | 'single' | 'double' | 'triple' | 'outer-bull' | 'inner-bull'

export interface DartHitResult {
  points: number
  sector: number // 1..20, 25 for bull, 0 for miss
  multiplier: 0 | 1 | 2 | 3
  ring: DartRingKind
  label: string // e.g. "T20", "D16", "DBULL", "BULL", "19", "MISS"
  localX: number
  localY: number
}

export interface ThrownDartRecord {
  id: string
  shooterId: string
  shooterName: string
  color: string
  boardLocalPos: [number, number, number] // relative to dartboard center
  hit: DartHitResult
  createdAt: number
}

export interface LiveDartShotPacket {
  shotId: string
  shooterId: string
  shooterName: string
  color: string
  origin: [number, number, number]
  velocity: [number, number, number]
  boardCenter: [number, number, number]
  timestamp: number
}

export interface DartShotSettlePacket {
  shotId: string
  shooterId: string
  shooterName: string
  color: string
  boardLocalPos: [number, number, number]
  hit: DartHitResult
  timestamp: number
}

export type CricketTarget = 20 | 19 | 18 | 17 | 16 | 15 | 25

export interface DartPlayerSlot {
  userId: string
  displayName: string
  color: string
  score501: number
  cricketPoints: number
  cricketMarks: Record<CricketTarget, number> // 0..3
}

export interface DartsMatchState {
  mode: DartGameMode
  doubleOut: boolean
  players: DartPlayerSlot[]
  activePlayerIndex: number
  dartsThrownInTurn: number // 0..3
  turnStartScore501: number
  lastTurnSummary: string
  winnerId: string | null
  winnerName: string | null
  stuckDarts: ThrownDartRecord[]
  revision: number
  updatedAt: number
}

export interface LivePuttShotPacket {
  shotId: string
  shooterId: string
  shooterName: string
  color: string
  localOrigin: [number, number] // [x, z] in putting strip local space
  localVelocity: [number, number] // [vx, vz] in putting strip local space
  rampEnabled: boolean
  timestamp: number
}

export interface PuttShotSettlePacket {
  shotId: string
  shooterId: string
  shooterName: string
  holed: boolean
  lipOut: boolean
  restLocalPos: [number, number, number]
  distanceMeters: number
  rampEnabled: boolean
  timestamp: number
}

export interface PuttingPlayerSlot {
  userId: string
  displayName: string
  color: string
  currentStreak: number
  bestSessionStreak: number
  puttOffScore: number
  puttsTaken: number
}

export interface PuttingMatchState {
  mode: PuttingGameMode
  rampEnabled: boolean
  players: PuttingPlayerSlot[]
  activePlayerIndex: number
  round: number
  maxRounds: number
  ballRestLocal: [number, number, number]
  lastOutcomeText: string
  winnerId: string | null
  winnerName: string | null
  revision: number
  updatedAt: number
}

// ============================================================================
// Pillar 2 & 4: Persistent Clubhouse Leaderboard, Match History & Wager Ledger
// ============================================================================

export interface CompletedMatchRecord {
  id: string
  game:
    | 'darts-501'
    | 'darts-cricket'
    | 'putting-puttoff'
    | 'putting-streak'
    | 'shuffleboard'
    | 'cornhole'
    | 'arcade-hoops'
    | 'arcade-skeeball'
    | 'arcade-retro'
  winnerId: string
  winnerName: string
  participants: Array<{ userId: string; displayName: string; finalScore: number }>
  highlight?: string
  completedAt: number
}

export interface PlayerClubhouseStats {
  key: string // normalized display name key so friends keep stats across browser sessions!
  displayName: string
  dartWins: number
  dartLosses: number
  puttingWins: number
  puttingLosses: number
  highestCheckout: number
  longestPuttingStreak: number
  bullseyes: number
  shuffleboardWins?: number
  cornholeWins?: number
  arcadeHighScore?: number
  updatedAt: number
}

export type PropWagerStatus = 'open' | 'locked' | 'resolved'

export interface PropPick {
  userKey: string
  userId: string
  displayName: string
  optionIndex: number
  pickedAt: number
}

export interface PredictionProp {
  id: string
  title: string
  options: string[]
  stakeDollars: number // Friendly $1 default
  status: PropWagerStatus
  winningOptionIndex: number | null
  createdBy: string
  createdAt: number
  picks: PropPick[]
}

export interface LedgerEntry {
  key: string // normalized display name key
  displayName: string
  netDollars: number
  propsWon: number
  propsLost: number
  updatedAt: number
}

export interface ClubhousePersistentState {
  revision: number
  updatedAt: number
  playerStats: Record<string, PlayerClubhouseStats>
  ledger: Record<string, LedgerEntry>
  recentMatches: CompletedMatchRecord[]
  props: PredictionProp[]
}

// ============================================================================
// Pillar 3: Interactive Game & Dice Table (Polyhedral Dice, 52-Card Deck, Grid)
// ============================================================================

export type DieKind = 'd4' | 'd6' | 'd8' | 'd10' | 'd12' | 'd20'

export interface RolledDie {
  id: string
  kind: DieKind
  value: number
  color: string
  localPos: [number, number] // [x, z] on tabletop (-0.55..0.55)
  rotation: [number, number, number]
  rolledBy: string
  rolledAt: number
}

export type CardSuit = 'spades' | 'hearts' | 'diamonds' | 'clubs'

export type CardRank =
  | 'A'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | 'J'
  | 'Q'
  | 'K'

export interface PlayingCard {
  id: string // e.g. "A-spades"
  rank: CardRank
  suit: CardSuit
}

export interface TableCardInstance {
  card: PlayingCard
  faceUp: boolean
  localPos: [number, number] // [x, z] on tabletop
  rotationY: number
  playedBy?: string
}

export type TableSurfaceStyle = 'felt' | 'wood' | 'square-grid' | 'hex-grid'

export interface TabletopToken {
  id: string
  label: string
  color: string
  localPos: [number, number] // [x, z] on tabletop
  ownerName: string
}

export interface TabletopState {
  revision: number
  updatedAt: number
  surface: TableSurfaceStyle
  dice: RolledDie[]
  lastRollSummary: string
  lastRollerName: string
  lastRollTotal: number
  lastRollTimestamp: number
  deck: PlayingCard[]
  tableCards: TableCardInstance[]
  hands: Record<
    string,
    {
      userId: string
      displayName: string
      cards: PlayingCard[]
    }
  >
  tokens: TabletopToken[]
}

// ============================================================================
// Pillar 5: Main Theater Room Table Shuffleboard (1-2-3-4 Scoring Zones)
// ============================================================================

export type ShuffleboardTeam = 'red' | 'blue'

export interface ShuffleboardPuck {
  id: string
  team: ShuffleboardTeam
  localX: number // across board width (-0.22 to +0.22)
  localZ: number // along board length (+1.05 launch end to -1.25 far scoring end)
  points: number
  shotBy: string
}

export interface ShuffleboardState {
  revision: number
  updatedAt: number
  pucks: ShuffleboardPuck[]
  redScore: number
  blueScore: number
  activeTeam: ShuffleboardTeam
  lastSummary: string
  winnerTeam: ShuffleboardTeam | null
}

// ============================================================================
// Pillar 6: Outdoor Deck Cornhole (3 Pts In-Hole, 1 Pt On-Board)
// ============================================================================

export type CornholeTeam = 'gold' | 'cyan'

export interface CornholeBagRecord {
  id: string
  team: CornholeTeam
  boardIndex: 0 | 1
  localX: number // lateral offset on target board (-0.30..+0.30)
  localZ: number // longitudinal offset on target board (-0.55..+0.55)
  inHole: boolean
  points: number
  thrownBy: string
}

export interface CornholeState {
  revision: number
  updatedAt: number
  bags: CornholeBagRecord[]
  goldScore: number
  cyanScore: number
  activeTeam: CornholeTeam
  lastSummary: string
  winnerTeam: CornholeTeam | null
}

// ============================================================================
// Pillar 7: The Game Room — Tactical Holotable Sanctum (Terrain, Minis, Fog)
// ============================================================================

export type HolotableTerrainPresetId =
  | 'dungeon-keep'
  | 'forest-clearing'
  | 'scifi-starship'
  | 'mountain-pass'
  | 'tactical-grid'

export type HolotableMiniKind =
  | 'hero-paladin'
  | 'hero-mage'
  | 'hero-rogue'
  | 'monster-dragon'
  | 'monster-golem'
  | 'prop-chest'
  | 'prop-portal'

export interface HolotableMiniature {
  id: string
  kind: HolotableMiniKind
  label: string
  color: string
  localPos: [number, number] // [x, z] on holotable surface
  rotationY: number
  scale: number // 0.65..1.85
  ownerName: string
}

export interface HolotableState {
  revision: number
  updatedAt: number
  terrain: HolotableTerrainPresetId
  miniatures: HolotableMiniature[]
  selectedMiniId: string | null
  fogEnabled: boolean
  revealedFogCells: string[] // "row,col" for row, col in 0..5
  lastActionSummary: string
}

// ============================================================================
// Unified Realtime Wire Envelope for Bar Games, Deck & Game Room
// ============================================================================

export type BarGamesWireEvent =
  | { kind: 'dart-launch'; payload: LiveDartShotPacket }
  | { kind: 'dart-settle'; payload: DartShotSettlePacket; matchState: DartsMatchState }
  | { kind: 'darts-state'; payload: DartsMatchState }
  | { kind: 'putt-launch'; payload: LivePuttShotPacket }
  | { kind: 'putt-settle'; payload: PuttShotSettlePacket; matchState: PuttingMatchState }
  | { kind: 'putting-state'; payload: PuttingMatchState }
  | { kind: 'tabletop-state'; payload: TabletopState }
  | { kind: 'shuffleboard-state'; payload: ShuffleboardState }
  | { kind: 'cornhole-state'; payload: CornholeState }
  | { kind: 'holotable-state'; payload: HolotableState }
  | { kind: 'clubhouse-state'; payload: ClubhousePersistentState }
  | {
      kind: 'bar-games-full-sync'
      darts: DartsMatchState
      putting: PuttingMatchState
      tabletop: TabletopState
      shuffleboard?: ShuffleboardState
      cornhole?: CornholeState
      holotable?: HolotableState
      clubhouse: ClubhousePersistentState
    }

