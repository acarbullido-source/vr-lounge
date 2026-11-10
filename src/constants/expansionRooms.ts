import type {
  BoardroomWhiteboardStroke,
  CommandNewsCategoryId,
  ComputedSeat,
  ExpansionWingSyncedState,
  LoungeWingId,
  OutdoorSkyPresetId,
  SportsLeagueId,
} from '../types/lounge'

export const HALLWAY_ARCH_HALF_WIDTH = 1.55
export const HALLWAY_ARCH_HEIGHT = 3.6
export const HALLWAY_HALF_WIDTH = 1.65
export const HALLWAY_LENGTH = 20.4
export const HALLWAY_HEIGHT = 3.8

export const BOARDROOM_WHITEBOARD_STORAGE_KEY =
  'vr-lounge:boardroom-whiteboard:v1'

export const MAX_WHITEBOARD_TOTAL_COORDS = 12_000

function getBoardroomWhiteboardStorageKey(roomCode?: string): string {
  const normalized = roomCode?.trim().toUpperCase()
  return normalized
    ? `${BOARDROOM_WHITEBOARD_STORAGE_KEY}:${normalized}`
    : BOARDROOM_WHITEBOARD_STORAGE_KEY
}

export interface PersistedBoardroomWhiteboardSnapshot {
  strokes: BoardroomWhiteboardStroke[]
  grid: boolean
  clearedAt: number
  updatedAt: number
}

function decimateStrokeUvCoords(coords: number[]): number[] {
  if (coords.length <= 6) return coords
  const out: number[] = [coords[0], coords[1]]
  for (let i = 2; i + 3 < coords.length; i += 2) {
    const ax = out[out.length - 2]
    const ay = out[out.length - 1]
    const bx = coords[i]
    const by = coords[i + 1]
    const cx = coords[i + 2]
    const cy = coords[i + 3]
    const dx1 = bx - ax
    const dy1 = by - ay
    if (dx1 * dx1 + dy1 * dy1 < 0.0000015) {
      continue
    }
    const dx2 = cx - ax
    const dy2 = cy - ay
    const segLen = Math.hypot(dx2, dy2)
    if (segLen > 0.0001) {
      const perpDist = Math.abs(dx1 * dy2 - dy1 * dx2) / segLen
      if (perpDist < 0.00025 && dx1 * dx2 + dy1 * dy2 >= 0) {
        continue
      }
    }
    out.push(bx, by)
  }
  out.push(coords[coords.length - 2], coords[coords.length - 1])
  return out
}

export function sanitizeBoardroomWhiteboardStrokes(
  raw: unknown,
): BoardroomWhiteboardStroke[] {
  if (!Array.isArray(raw)) return []
  const sanitized: BoardroomWhiteboardStroke[] = []
  for (const item of raw.slice(-320)) {
    if (!item || typeof item !== 'object') continue
    const candidate = item as Partial<BoardroomWhiteboardStroke>
    if (!Array.isArray(candidate.points) || candidate.points.length < 2) continue
    const rawCoords: number[] = []
    const maxCoords = Math.min(candidate.points.length, 480)
    for (let i = 0; i + 1 < maxCoords; i += 2) {
      const u = Number(candidate.points[i])
      const v = Number(candidate.points[i + 1])
      if (!Number.isFinite(u) || !Number.isFinite(v)) continue
      rawCoords.push(
        Number(Math.max(0, Math.min(1, u)).toFixed(3)),
        Number(Math.max(0, Math.min(1, v)).toFixed(3)),
      )
    }
    const cleanPoints = decimateStrokeUvCoords(rawCoords)
    if (cleanPoints.length < 2) continue
    const tool = candidate.tool === 'eraser' ? 'eraser' : 'pen'
    const size: 1 | 2 | 3 =
      candidate.size === 1 || candidate.size === 3 ? candidate.size : 2
    const color =
      typeof candidate.color === 'string' &&
      /^#[0-9a-fA-F]{3,8}$/.test(candidate.color.trim())
        ? candidate.color.trim()
        : '#0F172A'
    sanitized.push({
      id:
        typeof candidate.id === 'string' && candidate.id.trim()
          ? candidate.id.trim().slice(0, 64)
          : `wb-${Date.now()}-${sanitized.length}`,
      tool,
      color,
      size,
      points: cleanPoints,
      author:
        typeof candidate.author === 'string'
          ? candidate.author.trim().slice(0, 28)
          : undefined,
      createdAt:
        typeof candidate.createdAt === 'number' &&
        Number.isFinite(candidate.createdAt)
          ? candidate.createdAt
          : Date.now(),
    })
  }

  // Enforce a hard total coordinate budget so Realtime WebSocket broadcasts never drop oversized packets
  let totalCoords = 0
  const budgetedReversed: BoardroomWhiteboardStroke[] = []
  for (let idx = sanitized.length - 1; idx >= 0; idx--) {
    const stroke = sanitized[idx]
    if (
      budgetedReversed.length > 0 &&
      totalCoords + stroke.points.length > MAX_WHITEBOARD_TOTAL_COORDS
    ) {
      break
    }
    totalCoords += stroke.points.length
    budgetedReversed.push(stroke)
  }
  budgetedReversed.reverse()
  return budgetedReversed
}

export function loadPersistedBoardroomWhiteboard(
  roomCode?: string,
): PersistedBoardroomWhiteboardSnapshot | null {
  if (typeof window === 'undefined' || !window.localStorage) return null
  try {
    const storageKey = getBoardroomWhiteboardStorageKey(roomCode)
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PersistedBoardroomWhiteboardSnapshot>
    if (!parsed || typeof parsed !== 'object') return null
    return {
      strokes: sanitizeBoardroomWhiteboardStrokes(parsed.strokes),
      grid: typeof parsed.grid === 'boolean' ? parsed.grid : true,
      clearedAt:
        typeof parsed.clearedAt === 'number' && Number.isFinite(parsed.clearedAt)
          ? parsed.clearedAt
          : 0,
      updatedAt:
        typeof parsed.updatedAt === 'number' && Number.isFinite(parsed.updatedAt)
          ? parsed.updatedAt
          : 0,
    }
  } catch {
    return null
  }
}

export function savePersistedBoardroomWhiteboard(
  snapshot: PersistedBoardroomWhiteboardSnapshot,
  roomCode?: string,
): void {
  if (typeof window === 'undefined' || !window.localStorage) return
  try {
    const storageKey = getBoardroomWhiteboardStorageKey(roomCode)
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        strokes: sanitizeBoardroomWhiteboardStrokes(snapshot.strokes),
        grid: snapshot.grid,
        clearedAt: snapshot.clearedAt,
        updatedAt: snapshot.updatedAt,
      }),
    )
  } catch {
    // Ignore storage quota errors
  }
}

export const DEFAULT_EXPANSION_WING_STATE: ExpansionWingSyncedState = {
  boardroomScreenMode: 'agenda',
  boardroomAgendaIndex: 0,
  boardroomWhiteboardStrokes: [],
  boardroomWhiteboardGrid: true,
  boardroomWhiteboardClearedAt: 0,
  libraryFireLit: true,
  outdoorSkyPreset: 'golden-sunset',
  commandScreenMode: 'mirror-lounge',
  commandStreamPresetId: 'ops-orbital',
  commandCustomStreamUrl: '',
  commandCustomStreamTitle: '',
  commandWeatherCityId: 'nyc',
  commandCustomCityQuery: '',
  commandNewsCategory: 'top',
  commandSportsLeague: 'nfl',
}

export function resolveExpansionWingState(
  raw?: Partial<ExpansionWingSyncedState> | null,
  roomCode?: string,
): ExpansionWingSyncedState {
  const localWb = loadPersistedBoardroomWhiteboard(roomCode)
  if (!raw || typeof raw !== 'object') {
    return {
      ...DEFAULT_EXPANSION_WING_STATE,
      boardroomWhiteboardStrokes: localWb?.strokes ?? [],
      boardroomWhiteboardGrid: localWb?.grid ?? true,
      boardroomWhiteboardClearedAt: localWb?.clearedAt ?? 0,
    }
  }
  const boardroomScreenMode =
    raw.boardroomScreenMode === 'mirror-lounge'
      ? 'mirror-lounge'
      : raw.boardroomScreenMode === 'whiteboard'
        ? 'whiteboard'
        : 'agenda'
  const boardroomAgendaIndex =
    typeof raw.boardroomAgendaIndex === 'number' &&
    Number.isFinite(raw.boardroomAgendaIndex)
      ? Math.max(0, Math.min(3, Math.floor(raw.boardroomAgendaIndex)))
      : 0

  const hasExplicitStrokesArray = Array.isArray(raw.boardroomWhiteboardStrokes)
  const rawStrokes = hasExplicitStrokesArray
    ? sanitizeBoardroomWhiteboardStrokes(raw.boardroomWhiteboardStrokes)
    : []
  const rawClearedAt =
    typeof raw.boardroomWhiteboardClearedAt === 'number' &&
    Number.isFinite(raw.boardroomWhiteboardClearedAt)
      ? raw.boardroomWhiteboardClearedAt
      : 0
  const rawGrid =
    typeof raw.boardroomWhiteboardGrid === 'boolean'
      ? raw.boardroomWhiteboardGrid
      : (localWb?.grid ?? true)

  // Preserve drawn strokes across reloads and non-whiteboard room updates unless explicitly cleared
  let boardroomWhiteboardStrokes = rawStrokes
  let boardroomWhiteboardClearedAt = rawClearedAt
  if (
    rawStrokes.length === 0 &&
    localWb &&
    localWb.strokes.length > 0 &&
    rawClearedAt <= localWb.clearedAt &&
    rawClearedAt < localWb.updatedAt
  ) {
    boardroomWhiteboardStrokes = localWb.strokes
    boardroomWhiteboardClearedAt = localWb.clearedAt
  } else if (hasExplicitStrokesArray && (rawStrokes.length > 0 || rawClearedAt > 0)) {
    const latestStrokeTime = rawStrokes.reduce(
      (max, s) => Math.max(max, s.createdAt),
      0,
    )
    savePersistedBoardroomWhiteboard(
      {
        strokes: rawStrokes,
        grid: rawGrid,
        clearedAt: rawClearedAt,
        updatedAt: Math.max(Date.now(), latestStrokeTime, rawClearedAt),
      },
      roomCode,
    )
  }

  const libraryFireLit =
    typeof raw.libraryFireLit === 'boolean' ? raw.libraryFireLit : true
  const outdoorSkyPreset: OutdoorSkyPresetId =
    raw.outdoorSkyPreset === 'starlit-aurora' ||
    raw.outdoorSkyPreset === 'alpine-morning' ||
    raw.outdoorSkyPreset === 'golden-sunset'
      ? raw.outdoorSkyPreset
      : 'golden-sunset'
  const commandScreenMode =
    raw.commandScreenMode === 'ops-stream' ? 'ops-stream' : 'mirror-lounge'
  const commandStreamPresetId =
    typeof raw.commandStreamPresetId === 'string' && raw.commandStreamPresetId.trim()
      ? raw.commandStreamPresetId.trim()
      : 'ops-orbital'
  const commandCustomStreamUrl =
    typeof raw.commandCustomStreamUrl === 'string'
      ? raw.commandCustomStreamUrl.trim().slice(0, 600)
      : ''
  const commandCustomStreamTitle =
    typeof raw.commandCustomStreamTitle === 'string'
      ? raw.commandCustomStreamTitle.trim().slice(0, 80)
      : ''
  const commandWeatherCityId =
    typeof raw.commandWeatherCityId === 'string' && raw.commandWeatherCityId.trim()
      ? raw.commandWeatherCityId.trim()
      : 'nyc'
  const commandCustomCityQuery =
    typeof raw.commandCustomCityQuery === 'string'
      ? raw.commandCustomCityQuery.trim().slice(0, 64)
      : ''
  const commandNewsCategory: CommandNewsCategoryId =
    raw.commandNewsCategory === 'tech' ||
    raw.commandNewsCategory === 'space' ||
    raw.commandNewsCategory === 'markets' ||
    raw.commandNewsCategory === 'top'
      ? raw.commandNewsCategory
      : 'top'
  const commandSportsLeague: SportsLeagueId =
    raw.commandSportsLeague === 'nba' ||
    raw.commandSportsLeague === 'mlb' ||
    raw.commandSportsLeague === 'nhl' ||
    raw.commandSportsLeague === 'mls' ||
    raw.commandSportsLeague === 'ncaaf' ||
    raw.commandSportsLeague === 'nfl'
      ? raw.commandSportsLeague
      : 'nfl'

  return {
    boardroomScreenMode,
    boardroomAgendaIndex,
    boardroomWhiteboardStrokes,
    boardroomWhiteboardGrid: rawGrid,
    boardroomWhiteboardClearedAt,
    libraryFireLit,
    outdoorSkyPreset,
    commandScreenMode,
    commandStreamPresetId,
    commandCustomStreamUrl,
    commandCustomStreamTitle,
    commandWeatherCityId,
    commandCustomCityQuery,
    commandNewsCategory,
    commandSportsLeague,
  }
}

export interface BoardroomStrategySlide {
  id: string
  tag: string
  title: string
  headlineMetric: string
  bullets: readonly string[]
  accent: string
}

export const BOARDROOM_STRATEGY_SLIDES: readonly BoardroomStrategySlide[] = [
  {
    id: 'executive-agenda',
    tag: 'EXECUTIVE BRIEFING · SLIDE 01',
    title: 'Clubhouse Executive Summit & Watch-Party Ops',
    headlineMetric: '6 CONNECTED ZONES · SPATIAL 60FPS READY',
    bullets: [
      '1. Main Cinema Lounge: Synchronized YouTube, 60fps YouTube TV, & Bar Games',
      '2. West Wing Front: Executive Boardroom with 9-Seat Strategy Table & Live Mirror',
      '3. East Wing Front: Cozy Hearth Library with Crackling Fireplace & Study Seating',
      '4. West Wing Rear & South Vista: Command & Control Center + Alpine Lake Deck',
    ],
    accent: '#E5A93C',
  },
  {
    id: 'venture-kpis',
    tag: 'GLOBAL TELEMETRY · SLIDE 02',
    title: 'Q4 Strategic Initiatives & Milestones',
    headlineMetric: '99.94% UPTIME · ZERO-LATENCY VOICE MESH',
    bullets: [
      '• Cross-platform Quest 3 WebXR + Desktop Companion parity verified',
      '• Real-time room customization & persistent clubhouse props ledger active',
      '• Multi-source Command Center monitoring live weather, news, & markets',
      '• Open floor discussion — grab any seat around the marble table to speak',
    ],
    accent: '#38BDF8',
  },
  {
    id: 'game-night-slate',
    tag: 'EVENT SCHEDULE · SLIDE 03',
    title: 'Weekend Watch-Party & Tournament Slate',
    headlineMetric: 'LIVE SPORTS · DARTS 501 · TABLETOP NIGHT',
    bullets: [
      '• Kickoff Pre-Show: Post friendly prop picks on the Main Lounge Chalkboard',
      '• Halftime Break: Head-to-head 501 Darts & Mini-Golf Putting Streak',
      '• Post-Game Fireside: Unwind in the Cozy Library or out on the Lake Deck',
      '• Simultaneous Second-Screen Tracking available in Command & Control',
    ],
    accent: '#49B384',
  },
  {
    id: 'brainstorm-canvas',
    tag: 'OPEN WHITEBOARD · SLIDE 04',
    title: 'Ideas, Trip Planning & Group Decisions',
    headlineMetric: 'SWITCH TO MAIN SCREEN MIRROR ANYTIME BELOW',
    bullets: [
      '• Destination shortlist: Lake Tahoe · Banff Alpine Lodge · Amalfi Coast',
      '• Next Movie Marathon Picks: Sci-Fi Classics · IMAX Documentaries · Concert Live',
      '• Tip: Click "Mirror Lounge Screen" below to pipe the main cinema video here!',
      '• Tip: Use Spatial Voice or Lounge Chat to drop links for the whole table',
    ],
    accent: '#C084FC',
  },
] as const

export interface OutdoorSkyMoodSpec {
  id: OutdoorSkyPresetId
  label: string
  shortLabel: string
  emoji: string
  domeTopColor: string
  domeMidColor: string
  horizonGlowColor: string
  sunMoonColor: string
  lakeDeepColor: string
  lakeMidColor: string
  lakeShimmerColor: string
  mountainNearColor: string
  mountainFarColor: string
  mountainSunlitColor: string
  snowCapColor: string
  pineColor: string
  cloudColor: string
  stringLightGlow: string
  ambientIntensity: number
  showStars: boolean
  showAurora: boolean
}

export const OUTDOOR_SKY_PRESETS: Record<OutdoorSkyPresetId, OutdoorSkyMoodSpec> = {
  'golden-sunset': {
    id: 'golden-sunset',
    label: 'Golden Alpine Sunset',
    shortLabel: '🌅 Sunset',
    emoji: '🌅',
    domeTopColor: '#1E2C52',
    domeMidColor: '#7B3E63',
    horizonGlowColor: '#F99B4E',
    sunMoonColor: '#FDE68A',
    lakeDeepColor: '#102B46',
    lakeMidColor: '#1F5178',
    lakeShimmerColor: '#FDBA74',
    mountainNearColor: '#293852',
    mountainFarColor: '#434B6E',
    mountainSunlitColor: '#A85D5C',
    snowCapColor: '#FFE8D9',
    pineColor: '#1A362E',
    cloudColor: '#F6B28B',
    stringLightGlow: '#FBBF24',
    ambientIntensity: 18.0,
    showStars: false,
    showAurora: false,
  },
  'starlit-aurora': {
    id: 'starlit-aurora',
    label: 'Starlit Aurora Night',
    shortLabel: '🌌 Aurora',
    emoji: '🌌',
    domeTopColor: '#060B18',
    domeMidColor: '#0E203B',
    horizonGlowColor: '#155E59',
    sunMoonColor: '#F1F5F9',
    lakeDeepColor: '#07172B',
    lakeMidColor: '#0E2F4F',
    lakeShimmerColor: '#34D399',
    mountainNearColor: '#16243D',
    mountainFarColor: '#213556',
    mountainSunlitColor: '#2A4E6E',
    snowCapColor: '#E2E8F0',
    pineColor: '#0F2621',
    cloudColor: '#33596E',
    stringLightGlow: '#FDE68A',
    ambientIntensity: 13.5,
    showStars: true,
    showAurora: true,
  },
  'alpine-morning': {
    id: 'alpine-morning',
    label: 'Crisp Alpine Day',
    shortLabel: '🏔 Alpine Day',
    emoji: '🏔',
    domeTopColor: '#1E4FDB',
    domeMidColor: '#38BDF8',
    horizonGlowColor: '#BAE6FD',
    sunMoonColor: '#FEF9C3',
    lakeDeepColor: '#0D527A',
    lakeMidColor: '#0284C7',
    lakeShimmerColor: '#E0F2FE',
    mountainNearColor: '#384860',
    mountainFarColor: '#4F607A',
    mountainSunlitColor: '#697F9E',
    snowCapColor: '#FFFFFF',
    pineColor: '#1B5E3F',
    cloudColor: '#F8FAFC',
    stringLightGlow: '#FEF3C7',
    ambientIntensity: 22.0,
    showStars: false,
    showAurora: false,
  },
}

export interface CommandStreamPreset {
  id: string
  label: string
  shortLabel: string
  subtitle: string
  url: string
}

export const COMMAND_STREAM_PRESETS: readonly CommandStreamPreset[] = [
  {
    id: 'ops-orbital',
    label: 'Sci-Fi Orbital Ops Feed (Tears of Steel)',
    shortLabel: '🛰 Sci-Fi Ops',
    subtitle: 'Adaptive HLS · 1080p Tactical Feed',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
  },
  {
    id: 'ops-expedition',
    label: 'Global Reconnaissance Reel (For Bigger Blazes)',
    shortLabel: '🌍 Recon Feed',
    subtitle: 'Direct MP4 · Fast Start HD',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
  },
  {
    id: 'ops-mountain-air',
    label: 'Alpine Aerial Telemetry (For Bigger Escapes)',
    shortLabel: '🏔 Aerial Cam',
    subtitle: 'Direct MP4 · Scenic Recon',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
  },
  {
    id: 'ops-sintel',
    label: 'Cinema Auxiliary Channel (Sintel HD)',
    shortLabel: '🎬 Aux Cinema',
    subtitle: 'Direct MP4 · 720p Stereo',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
  },
] as const

export interface ExpansionRoomDestination {
  id: LoungeWingId
  emoji: string
  shortLabel: string
  title: string
  subtitle: string
  accentColor: string
  spawnPosition: [number, number, number]
  spawnYaw: number
  defaultSeatId: string
}

export interface ExpansionWingLayout {
  hallStartZ: number
  hallEndZ: number
  archHalfWidth: number
  hallHalfWidth: number
  boardroomCenter: [number, number, number]
  libraryCenter: [number, number, number]
  commandCenter: [number, number, number]
  gameRoomCenter: [number, number, number]
  shootingRangeCenter: [number, number, number]
  outdoorDeckCenter: [number, number, number]
  destinations: ExpansionRoomDestination[]
  wingSeats: Array<Omit<ComputedSeat, 'index'>>
}

export function computeExpansionWingLayout(backZ: number): ExpansionWingLayout {
  const z0 = Number(backZ.toFixed(2))
  const hallEndZ = Number((z0 + HALLWAY_LENGTH).toFixed(2))
  const deckZ0 = z0

  const boardZ = Number((z0 + 4.65).toFixed(2))
  const libZ = Number((z0 + 5.4).toFixed(2))
  const cmdZ = Number((z0 + 15.1).toFixed(2))
  const gameRoomZ = Number((z0 + 15.1).toFixed(2))
  const rangeZ = Number((z0 + 9.38).toFixed(2))
  const deckZ = Number((deckZ0 + 25.0).toFixed(2))

  const destinations: ExpansionRoomDestination[] = [
    {
      id: 'main-lounge',
      emoji: '🎬',
      shortLabel: 'Main Theater',
      title: 'Main Theater',
      subtitle: 'Giant Screen · Back-Wall Mirrors · Shuffleboard, Darts & Putting',
      accentColor: '#E5A93C',
      spawnPosition: [0, 0, 0.85],
      spawnYaw: 0,
      defaultSeatId: 'furn-sofa-front:0',
    },
    {
      id: 'hallway',
      emoji: '🏛',
      shortLabel: 'Grand Hallway',
      title: 'Grand Hallway',
      subtitle: 'Central corridor connecting all private rooms, Range Corridor, Game Room & deck',
      accentColor: '#94A3B8',
      spawnPosition: [0, 0, Number((z0 + 2.4).toFixed(2))],
      spawnYaw: Math.PI,
      defaultSeatId: 'wing:boardroom-head',
    },
    {
      id: 'boardroom',
      emoji: '💼',
      shortLabel: 'Boardroom',
      title: 'Executive Boardroom',
      subtitle:
        '9-Seat Marble Table · Interactive Wall Whiteboard · Presentation & Mirror Screen',
      accentColor: '#F59E0B',
      spawnPosition: [-3.0, 0, boardZ],
      spawnYaw: Math.PI / 2,
      defaultSeatId: 'wing:boardroom-head',
    },
    {
      id: 'library',
      emoji: '🔥',
      shortLabel: 'Quiet Library',
      title: 'Quiet Library',
      subtitle: 'Quiet Audio Isolation Zone · Stone Hearth & Reading Chairs',
      accentColor: '#EA580C',
      spawnPosition: [3.2, 0, libZ],
      spawnYaw: -Math.PI / 2,
      defaultSeatId: 'wing:library-chair-1',
    },
    {
      id: 'command-center',
      emoji: '🛰',
      shortLabel: 'Control Room',
      title: 'Control Room',
      subtitle: 'Aux Screen · Live US Sports Scoreboard · Weather & Breaking News',
      accentColor: '#38BDF8',
      spawnPosition: [-7.35, 0, cmdZ],
      spawnYaw: Math.PI / 2,
      defaultSeatId: 'wing:command-seat-1',
    },
    {
      id: 'game-room',
      emoji: '🕹',
      shortLabel: 'Game Room',
      title: 'Game Room',
      subtitle: 'Wall Stream Mirror · Neon Arcade Perimeter · 3D Tactical Holotable',
      accentColor: '#A855F7',
      spawnPosition: [3.25, 0, gameRoomZ],
      spawnYaw: -Math.PI / 2,
      defaultSeatId: 'wing:gameroom-holo-1',
    },
    {
      id: 'shooting-range',
      emoji: '🎯',
      shortLabel: 'Shooting Range',
      title: 'Shooting Range',
      subtitle: 'West Annex Corridor · 1-Hand Pistols · 2-Hand Rifles · 35m Target Lanes',
      accentColor: '#EF4444',
      spawnPosition: [-15.85, 0, rangeZ],
      spawnYaw: Math.PI / 2,
      defaultSeatId: 'wing:shooting-booth-2',
    },
    {
      id: 'outdoor-deck',
      emoji: '🏔',
      shortLabel: 'Lake Deck',
      title: 'Outdoor Lake Deck',
      subtitle: 'Panoramic Alpine Lake · Deck Cornhole · Firepit & Aurora Sky',
      accentColor: '#34D399',
      spawnPosition: [0, 0, Number((deckZ0 + 22.4).toFixed(2))],
      spawnYaw: Math.PI,
      defaultSeatId: 'wing:deck-chair-1',
    },
  ]

  const wingSeats: Array<Omit<ComputedSeat, 'index'>> = []

  // -------------------------------------------------------------------------
  // 1. EXECUTIVE BOARD ROOM SEATS (9 leather executive chairs around [-6.4, boardZ]
  //    + 1 Interactive Whiteboard Standing Station facing the South Wall Whiteboard)
  //    Screen is on West wall (-11.08, 2.05, boardZ).
  //    Whiteboard is on South wall (-6.4, 2.18, z0 + 8.03).
  //    In SeatRig, rotationY = 0 faces -Z, rotationY = +PI/2 faces -X (West!),
  //    rotationY = -PI/2 faces +X (East), rotationY = PI faces +Z (South).
  // -------------------------------------------------------------------------
  const boardScreenLook: [number, number, number] = [-11.0, 1.95, boardZ]
  wingSeats.push({
    id: 'wing:boardroom-head',
    furnitureId: 'wing-boardroom-table',
    furnitureType: 'wing-seat',
    label: '💼 Boardroom · Head Chair',
    position: [-3.35, 0, boardZ],
    localCushionOffset: [0, 0, 0],
    seatHeightOffset: 0.44,
    rotationY: Number((Math.PI / 2).toFixed(4)),
    lookAtTarget: boardScreenLook,
    stationKind: 'seat',
    roomWing: 'boardroom',
  })

  const boardChairXs = [-4.65, -5.82, -6.98, -8.15]
  boardChairXs.forEach((cx, idx) => {
    // North side chairs (at boardZ - 1.24, facing South-West toward table & West screen)
    wingSeats.push({
      id: `wing:boardroom-n-${idx + 1}`,
      furnitureId: 'wing-boardroom-table',
      furnitureType: 'wing-seat',
      label: `💼 Boardroom · North ${idx + 1}`,
      position: [cx, 0, Number((boardZ - 1.25).toFixed(2))],
      localCushionOffset: [0, 0, 0],
      seatHeightOffset: 0.44,
      rotationY: Number((Math.PI * 0.72).toFixed(4)),
      lookAtTarget: [-9.6, 1.55, Number((boardZ + 0.15).toFixed(2))],
      stationKind: 'seat',
      roomWing: 'boardroom',
    })
    // South side chairs (at boardZ + 1.25, facing North-West toward table & West screen)
    wingSeats.push({
      id: `wing:boardroom-s-${idx + 1}`,
      furnitureId: 'wing-boardroom-table',
      furnitureType: 'wing-seat',
      label: `💼 Boardroom · South ${idx + 1}`,
      position: [cx, 0, Number((boardZ + 1.25).toFixed(2))],
      localCushionOffset: [0, 0, 0],
      seatHeightOffset: 0.44,
      rotationY: Number((Math.PI * 0.28).toFixed(4)),
      lookAtTarget: [-9.6, 1.55, Number((boardZ - 0.15).toFixed(2))],
      stationKind: 'seat',
      roomWing: 'boardroom',
    })
  })

  wingSeats.push({
    id: 'wing:boardroom-whiteboard',
    furnitureId: 'wing-boardroom-whiteboard',
    furnitureType: 'wing-seat',
    label: '📝 Boardroom · Whiteboard Wall',
    position: [-6.4, 0, Number((boardZ + 1.48).toFixed(2))],
    localCushionOffset: [0, 0, 0],
    seatHeightOffset: 0.52,
    rotationY: Number(Math.PI.toFixed(4)),
    lookAtTarget: [-6.4, 2.18, Number((z0 + 8.03).toFixed(2))],
    stationKind: 'chalkboard',
    roomWing: 'boardroom',
  })

  // -------------------------------------------------------------------------
  // 2. COZY LIBRARY & FIREPLACE STUDY SEATS (4 plush armchairs facing East Hearth [+10.7, libZ])
  //    Facing +X corresponds to rotationY = -PI/2 (-Math.sin(-PI/2) = +1).
  // -------------------------------------------------------------------------
  const hearthLook: [number, number, number] = [10.6, 1.15, libZ]
  const libraryChairSpecs: Array<{
    id: string
    label: string
    pos: [number, number, number]
    rotY: number
  }> = [
    {
      id: 'wing:library-chair-1',
      label: '🔥 Library · Fireside Left',
      pos: [7.65, 0, Number((libZ - 1.35).toFixed(2))],
      rotY: -Math.PI * 0.62,
    },
    {
      id: 'wing:library-chair-2',
      label: '🔥 Library · Fireside Right',
      pos: [7.65, 0, Number((libZ + 1.35).toFixed(2))],
      rotY: -Math.PI * 0.38,
    },
    {
      id: 'wing:library-chair-3',
      label: '🔥 Library · Reading Nook N',
      pos: [5.55, 0, Number((libZ - 1.85).toFixed(2))],
      rotY: -Math.PI * 0.68,
    },
    {
      id: 'wing:library-chair-4',
      label: '🔥 Library · Reading Nook S',
      pos: [5.55, 0, Number((libZ + 1.85).toFixed(2))],
      rotY: -Math.PI * 0.32,
    },
  ]
  for (const spec of libraryChairSpecs) {
    wingSeats.push({
      id: spec.id,
      furnitureId: 'wing-library-hearth',
      furnitureType: 'wing-seat',
      label: spec.label,
      position: spec.pos,
      localCushionOffset: [0, 0, 0],
      seatHeightOffset: 0.42,
      rotationY: Number(spec.rotY.toFixed(4)),
      lookAtTarget: hearthLook,
      stationKind: 'seat',
      roomWing: 'library',
    })
  }

  // -------------------------------------------------------------------------
  // 3. COMMAND & CONTROL CENTER OPERATOR SEATS (4 tactical chairs facing West Media Wall [-12.0, cmdZ])
  //    Facing -X corresponds to rotationY = +PI/2.
  // -------------------------------------------------------------------------
  const cmdWallLook: [number, number, number] = [-11.9, 2.05, cmdZ]
  const cmdSeatOffsets = [-1.95, -0.68, 0.68, 1.95]
  cmdSeatOffsets.forEach((dzOff, idx) => {
    wingSeats.push({
      id: `wing:command-seat-${idx + 1}`,
      furnitureId: 'wing-command-console',
      furnitureType: 'wing-seat',
      label: `🛰 Command · Ops Station ${idx + 1}`,
      position: [-8.15, 0, Number((cmdZ + dzOff).toFixed(2))],
      localCushionOffset: [0, 0, 0],
      seatHeightOffset: 0.44,
      rotationY: Number((Math.PI / 2 + dzOff * 0.06).toFixed(4)),
      lookAtTarget: cmdWallLook,
      stationKind: 'seat',
      roomWing: 'command-center',
    })
  })

  // -------------------------------------------------------------------------
  // 4. THE GAME ROOM: TACTICAL HOLOTABLE SANCTUM SEATS (6 seats around [+9.25, gameRoomZ])
  //    + Arcade Perimeter Station (Enlarged 15.2m x 11.2m Arena)
  // -------------------------------------------------------------------------
  const holoCenter: [number, number, number] = [9.25, 0.88, gameRoomZ]
  const holoAngles = [
    { suffix: 'DM West', angle: Math.PI, rotY: -Math.PI / 2 },
    { suffix: 'North-West', angle: -Math.PI * 0.68, rotY: -Math.PI * 0.82 },
    { suffix: 'North-East', angle: -Math.PI * 0.32, rotY: Math.PI * 0.82 },
    { suffix: 'Commander East', angle: 0, rotY: Math.PI / 2 },
    { suffix: 'South-East', angle: Math.PI * 0.32, rotY: Math.PI * 0.18 },
    { suffix: 'South-West', angle: Math.PI * 0.68, rotY: -Math.PI * 0.18 },
  ]
  holoAngles.forEach((spot, idx) => {
    const r = 2.08
    const sx = Number((9.25 + Math.cos(spot.angle) * r).toFixed(2))
    const sz = Number((gameRoomZ + Math.sin(spot.angle) * r).toFixed(2))
    wingSeats.push({
      id: `wing:gameroom-holo-${idx + 1}`,
      furnitureId: 'wing-gameroom-holotable',
      furnitureType: 'wing-seat',
      label: `🕹 Game Room · Holotable ${spot.suffix}`,
      position: [sx, 0, sz],
      localCushionOffset: [0, 0, 0],
      seatHeightOffset: 0.44,
      rotationY: Number(spot.rotY.toFixed(4)),
      lookAtTarget: holoCenter,
      stationKind: 'seat',
      roomWing: 'game-room',
    })
  })

  wingSeats.push({
    id: 'wing:gameroom-arcade-1',
    furnitureId: 'wing-gameroom-arcade',
    furnitureType: 'game-station',
    label: '🕹 Game Room · Neon Arcade Row',
    position: [13.8, 0, gameRoomZ],
    localCushionOffset: [0, 0, 0],
    seatHeightOffset: 0.48,
    rotationY: -Math.PI / 2,
    lookAtTarget: [16.2, 1.55, gameRoomZ],
    stationKind: 'arcade',
    roomWing: 'game-room',
  })

  // -------------------------------------------------------------------------
  // 5. THE SHOOTING RANGE: 4 TACTICAL FIRING LINE BOOTHS (Facing West -X downrange)
  //    Reached via the West Tactical Annex Hallway (x in [-13.6, -1.65], dz = 9.38)
  // -------------------------------------------------------------------------
  const boothOffsets = [-2.7, -0.9, 0.9, 2.7]
  boothOffsets.forEach((dzOff, idx) => {
    const bz = Number((rangeZ + dzOff).toFixed(2))
    wingSeats.push({
      id: `wing:shooting-booth-${idx + 1}`,
      furnitureId: 'wing-shooting-range',
      furnitureType: 'wing-seat',
      label: `🎯 Shooting Range · Lane ${idx + 1}`,
      position: [-17.65, 0, bz],
      localCushionOffset: [0, 0, 0],
      seatHeightOffset: 0.48,
      rotationY: Number((Math.PI / 2).toFixed(4)),
      lookAtTarget: [-32.0, 1.48, bz],
      stationKind: 'seat',
      roomWing: 'shooting-range',
    })
  })

  // -------------------------------------------------------------------------
  // 6. OUTDOOR LAKE & MOUNTAIN DECK SEATS (6 Adirondack & Firepit Lounge Chairs + Deck Cornhole)
  //    Lake & Mountains lie in +Z (dz > 29.8). Facing +Z corresponds to rotationY = PI.
  // -------------------------------------------------------------------------
  const lakeVistaLook: [number, number, number] = [0, 2.6, Number((deckZ0 + 58).toFixed(2))]
  const deckChairSpecs: Array<{
    id: string
    label: string
    pos: [number, number, number]
    rotY: number
    look: [number, number, number]
  }> = [
    {
      id: 'wing:deck-chair-1',
      label: '🏔 Lake Deck · Vista Left',
      pos: [2.45, 0, Number((deckZ0 + 26.8).toFixed(2))],
      rotY: Math.PI * 0.94,
      look: lakeVistaLook,
    },
    {
      id: 'wing:deck-chair-2',
      label: '🏔 Lake Deck · Vista Center',
      pos: [4.15, 0, Number((deckZ0 + 26.9).toFixed(2))],
      rotY: Math.PI,
      look: lakeVistaLook,
    },
    {
      id: 'wing:deck-chair-3',
      label: '🏔 Lake Deck · Vista Right',
      pos: [5.85, 0, Number((deckZ0 + 26.6).toFixed(2))],
      rotY: -Math.PI * 0.92,
      look: lakeVistaLook,
    },
    {
      id: 'wing:deck-firepit-1',
      label: '🏔 Lake Deck · Firepit North',
      pos: [-3.8, 0, Number((deckZ0 + 23.1).toFixed(2))],
      rotY: Math.PI,
      look: [-3.2, 1.4, Number((deckZ0 + 48).toFixed(2))],
    },
    {
      id: 'wing:deck-firepit-2',
      label: '🏔 Lake Deck · Firepit West',
      pos: [-5.65, 0, Number((deckZ0 + 24.9).toFixed(2))],
      rotY: -Math.PI * 0.72,
      look: [-2.0, 1.4, Number((deckZ0 + 48).toFixed(2))],
    },
    {
      id: 'wing:deck-firepit-3',
      label: '🏔 Lake Deck · Firepit East',
      pos: [-1.95, 0, Number((deckZ0 + 24.9).toFixed(2))],
      rotY: Math.PI * 0.76,
      look: [-4.5, 1.4, Number((deckZ0 + 48).toFixed(2))],
    },
  ]

  for (const spec of deckChairSpecs) {
    wingSeats.push({
      id: spec.id,
      furnitureId: 'wing-outdoor-deck',
      furnitureType: 'wing-seat',
      label: spec.label,
      position: spec.pos,
      localCushionOffset: [0, 0, 0],
      seatHeightOffset: 0.4,
      rotationY: Number(spec.rotY.toFixed(4)),
      lookAtTarget: spec.look,
      stationKind: 'seat',
      roomWing: 'outdoor-deck',
    })
  }

  // Deck Cornhole Throw Station (East Side of Outdoor Deck)
  wingSeats.push({
    id: 'wing:deck-cornhole',
    furnitureId: 'wing-deck-cornhole',
    furnitureType: 'game-station',
    label: '🌽 Lake Deck · Cornhole Pitch',
    position: [6.55, 0, Number((deckZ0 + 22.15).toFixed(2))],
    localCushionOffset: [0, 0, 0],
    seatHeightOffset: 0.48,
    rotationY: Math.PI,
    lookAtTarget: [6.55, 0.35, Number((deckZ0 + 27.6).toFixed(2))],
    stationKind: 'cornhole',
    roomWing: 'outdoor-deck',
  })

  return {
    hallStartZ: z0,
    hallEndZ,
    archHalfWidth: HALLWAY_ARCH_HALF_WIDTH,
    hallHalfWidth: HALLWAY_HALF_WIDTH,
    boardroomCenter: [-6.42, 0, boardZ],
    libraryCenter: [6.42, 0, libZ],
    commandCenter: [-6.92, 0, cmdZ],
    gameRoomCenter: [9.25, 0, gameRoomZ],
    shootingRangeCenter: [-16.65, 0, rangeZ],
    outdoorDeckCenter: [0, 0, deckZ],
    destinations,
    wingSeats,
  }
}

export function detectActiveLoungeWing(
  x: number,
  z: number,
  backZ: number,
): LoungeWingId {
  const dz = z - backZ
  if (dz < -0.15) return 'main-lounge'
  if (dz >= 20.55) return 'outdoor-deck'
  // Second Hallway (West Tactical Annex Corridor at dz in [8.15, 10.6]) & Shooting Range (x < -12.6)
  if (x < -12.6 || (x < -1.75 && dz >= 8.15 && dz <= 10.6)) {
    return 'shooting-range'
  }
  if (x < -1.75) {
    return dz < 9.38 ? 'boardroom' : 'command-center'
  }
  if (x > 1.75) {
    return dz < 9.5 ? 'library' : 'game-room'
  }
  return 'hallway'
}

interface WalkRect {
  minX: number
  maxX: number
  minDz: number
  maxDz: number
  floorY: number
}

const EXPANSION_WALK_RECTS: readonly WalkRect[] = [
  // 1. Grand Hallway Corridor (bridges cleanly from Main Lounge through backZ archway to Outdoor Deck at dz = 20.4)
  { minX: -1.2, maxX: 1.2, minDz: -0.65, maxDz: 21.1, floorY: 0 },
  // 2. Executive Board Room Doorway + Interior (West Front, dz 0.8..8.12)
  { minX: -2.35, maxX: -0.95, minDz: 3.85, maxDz: 5.45, floorY: 0 },
  { minX: -10.5, maxX: -2.15, minDz: 1.15, maxDz: 7.75, floorY: 0 },
  // 3. Cozy Library Doorway + Interior (East Front)
  { minX: 0.95, maxX: 2.35, minDz: 4.55, maxDz: 6.25, floorY: 0 },
  { minX: 2.15, maxX: 10.15, minDz: 1.75, maxDz: 9.05, floorY: 0 },
  // 4. Command & Control Center Doorway + Interior (West Rear)
  { minX: -2.35, maxX: -0.95, minDz: 14.25, maxDz: 15.95, floorY: 0 },
  { minX: -11.25, maxX: -2.15, minDz: 11.2, maxDz: 19.0, floorY: 0 },
  // 5. The Game Room Doorway + Enlarged Interior (East Rear: 15.2m W x 11.2m D)
  { minX: 0.95, maxX: 2.35, minDz: 14.25, maxDz: 15.95, floorY: 0 },
  { minX: 2.15, maxX: 16.35, minDz: 9.85, maxDz: 20.35, floorY: 0 },
  // 6. Second Hallway (West Tactical Annex Corridor at dz = 9.38) + Shooting Range Ready Room & Booths
  { minX: -14.2, maxX: -0.95, minDz: 8.52, maxDz: 10.24, floorY: 0 },
  { minX: -18.15, maxX: -13.6, minDz: 5.38, maxDz: 13.38, floorY: 0 },
  // 7. Outdoor Lake & Mountain Observation Deck + Central Lakeshore Pier (at dz = 20.4..33.15)
  { minX: -8.05, maxX: 8.05, minDz: 20.85, maxDz: 29.15, floorY: 0 },
  { minX: -1.15, maxX: 1.15, minDz: 28.9, maxDz: 33.15, floorY: 0.02 },
]

function pushOutOfBox(
  x: number,
  dz: number,
  minX: number,
  maxX: number,
  minDz: number,
  maxDz: number,
): [number, number] {
  if (x <= minX || x >= maxX || dz <= minDz || dz >= maxDz) {
    return [x, dz]
  }
  const dLeft = x - minX
  const dRight = maxX - x
  const dFront = dz - minDz
  const dBack = maxDz - dz
  const m = Math.min(dLeft, dRight, dFront, dBack)
  if (m === dLeft) return [minX, dz]
  if (m === dRight) return [maxX, dz]
  if (m === dFront) return [x, minDz]
  return [x, maxDz]
}

function pushOutOfCircle(
  x: number,
  dz: number,
  cx: number,
  cdz: number,
  radius: number,
): [number, number] {
  const dx = x - cx
  const ddz = dz - cdz
  const distSq = dx * dx + ddz * ddz
  if (distSq >= radius * radius) return [x, dz]
  const dist = Math.sqrt(distSq)
  if (dist < 0.0001) return [cx + radius, cdz]
  return [cx + (dx / dist) * radius, cdz + (ddz / dist) * radius]
}

/**
 * Projects any candidate `(rawX, rawZ)` in the Clubhouse Expansion Wing (`z >= backZ - 0.55`)
 * onto the union of walkable corridor, doorway, room, deck, and pier zones with smooth
 * obstacle sliding around tables, holo-consoles, and firepits.
 */
export function resolveExpansionWingWalkablePosition(
  rawX: number,
  rawZ: number,
  backZ: number,
): [number, number, number] {
  const dz = rawZ - backZ
  const effectiveX =
    dz >= 4.5 && dz <= 14.2 && rawX < -18.15 ? -18.15 : rawX
  let bestX = 0
  let bestDz = 0
  let bestFloorY = 0
  let bestDistSq = Infinity

  for (let i = 0; i < EXPANSION_WALK_RECTS.length; i++) {
    const r = EXPANSION_WALK_RECTS[i]
    const cx = Math.max(r.minX, Math.min(r.maxX, effectiveX))
    const cdz = Math.max(r.minDz, Math.min(r.maxDz, dz))
    const dx = effectiveX - cx
    const ddz = dz - cdz
    const dSq = dx * dx + ddz * ddz
    if (dSq < bestDistSq) {
      bestDistSq = dSq
      bestX = cx
      bestDz = cdz
      bestFloorY = r.floorY
      if (dSq === 0) break
    }
  }

  // Smooth furniture obstacle avoidance inside each room
  // 1) Executive Boardroom central marble/mahogany conference table (centered at dz = 4.65)
  ;[bestX, bestDz] = pushOutOfBox(bestX, bestDz, -8.9, -3.9, 3.73, 5.57)
  // 2) Cozy Library central reading table & stone hearth apron
  ;[bestX, bestDz] = pushOutOfBox(bestX, bestDz, 6.15, 7.25, 4.85, 5.95)
  ;[bestX, bestDz] = pushOutOfBox(bestX, bestDz, 9.75, 11.2, 4.05, 6.75)
  // 3) Command & Control Center octagonal hologram globe table
  ;[bestX, bestDz] = pushOutOfCircle(bestX, bestDz, -5.85, 15.1, 1.08)
  // 4) The Game Room central Tactical Holotable Sanctum (Enlarged at x = 9.25)
  ;[bestX, bestDz] = pushOutOfCircle(bestX, bestDz, 9.25, 15.1, 1.48)
  // 5) Outdoor Lake Deck circular stone firepit (at dz = 25.0)
  ;[bestX, bestDz] = pushOutOfCircle(bestX, bestDz, -3.8, 25.0, 1.05)

  return [
    Number(bestX.toFixed(3)),
    bestFloorY,
    Number((backZ + bestDz).toFixed(3)),
  ]
}
