import type {
  CommandNewsCategoryId,
  ComputedSeat,
  ExpansionWingSyncedState,
  LoungeWingId,
  OutdoorSkyPresetId,
} from '../types/lounge'

export const HALLWAY_ARCH_HALF_WIDTH = 1.55
export const HALLWAY_ARCH_HEIGHT = 3.6
export const HALLWAY_HALF_WIDTH = 1.65
export const HALLWAY_LENGTH = 20.4
export const HALLWAY_HEIGHT = 3.8

export const DEFAULT_EXPANSION_WING_STATE: ExpansionWingSyncedState = {
  boardroomScreenMode: 'agenda',
  boardroomAgendaIndex: 0,
  libraryFireLit: true,
  outdoorSkyPreset: 'golden-sunset',
  commandScreenMode: 'mirror-lounge',
  commandStreamPresetId: 'ops-orbital',
  commandCustomStreamUrl: '',
  commandCustomStreamTitle: '',
  commandWeatherCityId: 'nyc',
  commandCustomCityQuery: '',
  commandNewsCategory: 'top',
}

export function resolveExpansionWingState(
  raw?: Partial<ExpansionWingSyncedState> | null,
): ExpansionWingSyncedState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_EXPANSION_WING_STATE }
  }
  const boardroomScreenMode =
    raw.boardroomScreenMode === 'mirror-lounge' ? 'mirror-lounge' : 'agenda'
  const boardroomAgendaIndex =
    typeof raw.boardroomAgendaIndex === 'number' &&
    Number.isFinite(raw.boardroomAgendaIndex)
      ? Math.max(0, Math.min(3, Math.floor(raw.boardroomAgendaIndex)))
      : 0
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

  return {
    boardroomScreenMode,
    boardroomAgendaIndex,
    libraryFireLit,
    outdoorSkyPreset,
    commandScreenMode,
    commandStreamPresetId,
    commandCustomStreamUrl,
    commandCustomStreamTitle,
    commandWeatherCityId,
    commandCustomCityQuery,
    commandNewsCategory,
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
  snowCapColor: string
  pineColor: string
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
    domeTopColor: '#1B2848',
    domeMidColor: '#6B3B5B',
    horizonGlowColor: '#F59E56',
    sunMoonColor: '#FDE08D',
    lakeDeepColor: '#0E2439',
    lakeMidColor: '#1B4363',
    lakeShimmerColor: '#FDBA74',
    mountainNearColor: '#222F44',
    mountainFarColor: '#3B4262',
    snowCapColor: '#FFE4D6',
    pineColor: '#142923',
    stringLightGlow: '#FBBF24',
    ambientIntensity: 0.9,
    showStars: false,
    showAurora: false,
  },
  'starlit-aurora': {
    id: 'starlit-aurora',
    label: 'Starlit Aurora Night',
    shortLabel: '🌌 Aurora',
    emoji: '🌌',
    domeTopColor: '#050914',
    domeMidColor: '#0C1A30',
    horizonGlowColor: '#134E4A',
    sunMoonColor: '#E2E8F0',
    lakeDeepColor: '#05111F',
    lakeMidColor: '#0B233B',
    lakeShimmerColor: '#34D399',
    mountainNearColor: '#0F1A2C',
    mountainFarColor: '#182842',
    snowCapColor: '#CBD5E1',
    pineColor: '#091815',
    stringLightGlow: '#FDE68A',
    ambientIntensity: 0.55,
    showStars: true,
    showAurora: true,
  },
  'alpine-morning': {
    id: 'alpine-morning',
    label: 'Crisp Alpine Day',
    shortLabel: '🏔 Alpine Day',
    emoji: '🏔',
    domeTopColor: '#1D4ED8',
    domeMidColor: '#38BDF8',
    horizonGlowColor: '#BAE6FD',
    sunMoonColor: '#FEF9C3',
    lakeDeepColor: '#0C4A6E',
    lakeMidColor: '#0284C7',
    lakeShimmerColor: '#E0F2FE',
    mountainNearColor: '#334155',
    mountainFarColor: '#475569',
    snowCapColor: '#FFFFFF',
    pineColor: '#164E35',
    stringLightGlow: '#FEF3C7',
    ambientIntensity: 1.15,
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
  outdoorDeckCenter: [number, number, number]
  destinations: ExpansionRoomDestination[]
  wingSeats: Array<Omit<ComputedSeat, 'index'>>
}

export function computeExpansionWingLayout(backZ: number): ExpansionWingLayout {
  const z0 = Number(backZ.toFixed(2))
  const hallEndZ = Number((z0 + HALLWAY_LENGTH).toFixed(2))

  const boardZ = Number((z0 + 5.4).toFixed(2))
  const libZ = Number((z0 + 5.4).toFixed(2))
  const cmdZ = Number((z0 + 15.1).toFixed(2))
  const deckZ = Number((z0 + 25.0).toFixed(2))

  const destinations: ExpansionRoomDestination[] = [
    {
      id: 'main-lounge',
      emoji: '🎬',
      shortLabel: 'Main Lounge',
      title: 'Main Cinema & Hangout Lounge',
      subtitle: 'Giant Screen · YouTube TV · Bar Games & Tabletop',
      accentColor: '#E5A93C',
      spawnPosition: [0, 0, 0.85],
      spawnYaw: 0,
      defaultSeatId: 'furn-sofa-front:0',
    },
    {
      id: 'hallway',
      emoji: '🏛',
      shortLabel: 'Hallway',
      title: 'Grand Clubhouse Gallery Hallway',
      subtitle: 'Central corridor connecting all private rooms & deck',
      accentColor: '#94A3B8',
      spawnPosition: [0, 0, Number((z0 + 2.4).toFixed(2))],
      spawnYaw: Math.PI,
      defaultSeatId: 'wing:boardroom-head',
    },
    {
      id: 'boardroom',
      emoji: '💼',
      shortLabel: 'Boardroom',
      title: 'Executive Board Room',
      subtitle: '9-Seat Marble & Mahogany Table · Strategy & Mirror Wall',
      accentColor: '#F59E0B',
      spawnPosition: [-3.0, 0, boardZ],
      spawnYaw: Math.PI / 2,
      defaultSeatId: 'wing:boardroom-head',
    },
    {
      id: 'library',
      emoji: '🔥',
      shortLabel: 'Library',
      title: 'Cozy Library & Crackling Fireplace',
      subtitle: 'Floor-to-Ceiling Bookshelves · Stone Hearth & Reading Chairs',
      accentColor: '#EA580C',
      spawnPosition: [3.2, 0, libZ],
      spawnYaw: -Math.PI / 2,
      defaultSeatId: 'wing:library-chair-1',
    },
    {
      id: 'command-center',
      emoji: '🛰',
      shortLabel: 'Command Ops',
      title: 'Command & Control Center',
      subtitle: 'Aux Viewing Screen · Live Weather Radar · Breaking News & Markets',
      accentColor: '#38BDF8',
      spawnPosition: [-7.35, 0, cmdZ],
      spawnYaw: Math.PI / 2,
      defaultSeatId: 'wing:command-seat-1',
    },
    {
      id: 'outdoor-deck',
      emoji: '🏔',
      shortLabel: 'Lake Deck',
      title: 'Outdoor Lake & Mountain Observation Deck',
      subtitle: 'Panoramic Alpine Lake · Snow Peaks · Firepit & Sunset/Aurora Sky',
      accentColor: '#34D399',
      spawnPosition: [0, 0, Number((z0 + 22.4).toFixed(2))],
      spawnYaw: Math.PI,
      defaultSeatId: 'wing:deck-chair-1',
    },
  ]

  const wingSeats: Array<Omit<ComputedSeat, 'index'>> = []

  // -------------------------------------------------------------------------
  // 1. EXECUTIVE BOARD ROOM SEATS (9 leather executive chairs around [-6.4, boardZ])
  //    Screen is on West wall (-11.08, 2.05, boardZ).
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
  // 4. OUTDOOR LAKE & MOUNTAIN DECK SEATS (6 Adirondack & Firepit Lounge Chairs)
  //    Lake & Mountains lie in +Z (dz > 29.8). Facing +Z corresponds to rotationY = PI.
  // -------------------------------------------------------------------------
  const lakeVistaLook: [number, number, number] = [0, 2.6, Number((z0 + 58).toFixed(2))]
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
      pos: [2.45, 0, Number((z0 + 26.8).toFixed(2))],
      rotY: Math.PI * 0.94,
      look: lakeVistaLook,
    },
    {
      id: 'wing:deck-chair-2',
      label: '🏔 Lake Deck · Vista Center',
      pos: [4.15, 0, Number((z0 + 26.9).toFixed(2))],
      rotY: Math.PI,
      look: lakeVistaLook,
    },
    {
      id: 'wing:deck-chair-3',
      label: '🏔 Lake Deck · Vista Right',
      pos: [5.85, 0, Number((z0 + 26.6).toFixed(2))],
      rotY: -Math.PI * 0.92,
      look: lakeVistaLook,
    },
    {
      id: 'wing:deck-firepit-1',
      label: '🏔 Lake Deck · Firepit North',
      pos: [-3.8, 0, Number((z0 + 23.1).toFixed(2))],
      rotY: Math.PI,
      look: [-3.2, 1.4, Number((z0 + 48).toFixed(2))],
    },
    {
      id: 'wing:deck-firepit-2',
      label: '🏔 Lake Deck · Firepit West',
      pos: [-5.65, 0, Number((z0 + 24.9).toFixed(2))],
      rotY: -Math.PI * 0.72,
      look: [-2.0, 1.4, Number((z0 + 48).toFixed(2))],
    },
    {
      id: 'wing:deck-firepit-3',
      label: '🏔 Lake Deck · Firepit East',
      pos: [-1.95, 0, Number((z0 + 24.9).toFixed(2))],
      rotY: Math.PI * 0.76,
      look: [-4.5, 1.4, Number((z0 + 48).toFixed(2))],
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

  return {
    hallStartZ: z0,
    hallEndZ,
    archHalfWidth: HALLWAY_ARCH_HALF_WIDTH,
    hallHalfWidth: HALLWAY_HALF_WIDTH,
    boardroomCenter: [-6.42, 0, boardZ],
    libraryCenter: [6.42, 0, libZ],
    commandCenter: [-6.92, 0, cmdZ],
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
  if (dz >= 20.1) return 'outdoor-deck'
  if (x < -1.75) {
    return dz < 10.2 ? 'boardroom' : 'command-center'
  }
  if (x > 1.75) {
    return 'library'
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
  // 1. Grand Hallway Corridor (bridges cleanly from Main Lounge through backZ archway to Outdoor Deck)
  { minX: -1.2, maxX: 1.2, minDz: -0.65, maxDz: 21.1, floorY: 0 },
  // 2. Executive Board Room Doorway + Interior (West Front)
  { minX: -2.35, maxX: -0.95, minDz: 4.55, maxDz: 6.25, floorY: 0 },
  { minX: -10.5, maxX: -2.15, minDz: 1.55, maxDz: 9.25, floorY: 0 },
  // 3. Cozy Library Doorway + Interior (East Front)
  { minX: 0.95, maxX: 2.35, minDz: 4.55, maxDz: 6.25, floorY: 0 },
  { minX: 2.15, maxX: 10.15, minDz: 1.75, maxDz: 9.05, floorY: 0 },
  // 4. Command & Control Center Doorway + Interior (West Rear)
  { minX: -2.35, maxX: -0.95, minDz: 14.25, maxDz: 15.95, floorY: 0 },
  { minX: -11.25, maxX: -2.15, minDz: 11.2, maxDz: 19.0, floorY: 0 },
  // 5. Outdoor Lake & Mountain Observation Deck + Central Lakeshore Pier
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
  let bestX = 0
  let bestDz = 0
  let bestFloorY = 0
  let bestDistSq = Infinity

  for (let i = 0; i < EXPANSION_WALK_RECTS.length; i++) {
    const r = EXPANSION_WALK_RECTS[i]
    const cx = Math.max(r.minX, Math.min(r.maxX, rawX))
    const cdz = Math.max(r.minDz, Math.min(r.maxDz, dz))
    const dx = rawX - cx
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
  // 1) Executive Boardroom central marble/mahogany conference table
  ;[bestX, bestDz] = pushOutOfBox(bestX, bestDz, -8.9, -3.9, 4.48, 6.32)
  // 2) Cozy Library central reading table & stone hearth apron
  ;[bestX, bestDz] = pushOutOfBox(bestX, bestDz, 6.15, 7.25, 4.85, 5.95)
  ;[bestX, bestDz] = pushOutOfBox(bestX, bestDz, 9.75, 11.2, 4.05, 6.75)
  // 3) Command & Control Center octagonal hologram globe table
  ;[bestX, bestDz] = pushOutOfCircle(bestX, bestDz, -5.85, 15.1, 1.08)
  // 4) Outdoor Lake Deck circular stone firepit
  ;[bestX, bestDz] = pushOutOfCircle(bestX, bestDz, -3.8, 25.0, 1.05)

  return [
    Number(bestX.toFixed(3)),
    bestFloorY,
    Number((backZ + bestDz).toFixed(3)),
  ]
}
