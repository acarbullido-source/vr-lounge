import {
  Check,
  Club,
  Dices,
  Flag,
  Lock,
  RefreshCw,
  Shuffle,
  Sparkles,
  Target,
  Trophy,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import {
  CRICKET_TARGETS,
  QUICK_PROP_TEMPLATES,
  SUIT_SYMBOLS,
  TOKEN_PALETTE,
  formatCricketMarkSymbol,
  normalizePlayerKey,
  scoreDartPolar,
} from '../../constants/barGames'
import { computeBarGamesLayout } from '../../constants/hangout'
import { computeBallisticDartVelocity } from '../../services/barGamesPhysics'
import type {
  ClubhousePersistentState,
  DartGameMode,
  DartsMatchState,
  DieKind,
  PuttingGameMode,
  PuttingMatchState,
  TableSurfaceStyle,
  TabletopState,
} from '../../types/barGames'
import type { RoomCustomizationState } from '../../types/lounge'

export type BarGamesTabId = 'play' | 'scoreboard' | 'tabletop' | 'props'

export interface BarGamesDrawerProps {
  open: boolean
  activeTab: BarGamesTabId
  onChangeTab: (tab: BarGamesTabId) => void
  onClose: () => void
  localUserId: string
  localDisplayName: string
  localSeatId: string | undefined
  roomCustomization: RoomCustomizationState
  dartsState: DartsMatchState
  puttingState: PuttingMatchState
  tabletopState: TabletopState
  clubhouseState: ClubhousePersistentState
  hasActiveDartShot: boolean
  hasActivePuttShot: boolean
  onSelectSeat: (seatId: string) => void
  // Darts
  onLaunchDartShot: (
    origin: [number, number, number],
    velocity: [number, number, number],
    boardCenter: [number, number, number],
  ) => void
  onJoinDarts: () => void
  onConfigureDarts: (patch: { mode?: DartGameMode; doubleOut?: boolean }) => void
  onResetDarts: () => void
  // Putting
  onLaunchPuttShot: (
    localOrigin: [number, number],
    localVelocity: [number, number],
  ) => void
  onJoinPutting: () => void
  onConfigurePutting: (patch: { mode?: PuttingGameMode; rampEnabled?: boolean }) => void
  onResetBallToTee: () => void
  onResetPutting: () => void
  // Tabletop
  onRollDice: (kinds: DieKind[]) => void
  onSetSurface: (surface: TableSurfaceStyle) => void
  onShuffleDeck: () => void
  onDrawCardToHand: () => void
  onPlayCardFromHand: (cardId: string, faceUp: boolean) => void
  onDealCardToTable: (faceUp: boolean) => void
  onFlipTableCard: (cardId: string) => void
  onResetDeck: () => void
  onSpawnToken: (label: string, color: string) => void
  onMoveToken: (tokenId: string, localX: number, localZ: number) => void
  onClearTokens: () => void
  // Chalkboard Props & Ledger
  onCreateProp: (title: string, options: string[], stakeDollars?: number) => void
  onPickPropOption: (propId: string, optionIndex: number) => void
  onLockProp: (propId: string) => void
  onResolveProp: (propId: string, winningOptionIndex: number) => void
  onDeleteProp: (propId: string) => void
}

const DART_QUICK_TARGETS: ReadonlyArray<{
  id: string
  label: string
  localX: number
  localY: number
}> = [
  { id: 'dbull', label: '🎯 Bullseye (50)', localX: 0, localY: 0 },
  { id: 'bull', label: '🟢 Outer Bull (25)', localX: 0.024, localY: 0 },
  { id: 't20', label: '🔥 Triple 20 (60)', localX: 0, localY: 0.122 },
  { id: 't19', label: '⚡ Triple 19 (57)', localX: -0.038, localY: -0.116 },
  { id: 'd20', label: '👑 Double 20 (40)', localX: 0, localY: 0.215 },
  { id: 'd16', label: '✨ Double 16 (32)', localX: -0.174, localY: -0.126 },
]

export function BarGamesDrawer({
  open,
  activeTab,
  onChangeTab,
  onClose,
  localUserId,
  localDisplayName,
  localSeatId,
  roomCustomization,
  dartsState,
  puttingState,
  tabletopState,
  clubhouseState,
  hasActiveDartShot,
  hasActivePuttShot,
  onSelectSeat,
  onLaunchDartShot,
  onJoinDarts,
  onConfigureDarts,
  onResetDarts,
  onLaunchPuttShot,
  onJoinPutting,
  onConfigurePutting,
  onResetBallToTee,
  onResetPutting,
  onRollDice,
  onSetSurface,
  onShuffleDeck,
  onDrawCardToHand,
  onPlayCardFromHand,
  onDealCardToTable,
  onFlipTableCard,
  onResetDeck,
  onSpawnToken,
  onMoveToken,
  onClearTokens,
  onCreateProp,
  onPickPropOption,
  onLockProp,
  onResolveProp,
  onDeleteProp,
}: BarGamesDrawerProps) {
  const [aimLocalX, setAimLocalX] = useState(0)
  const [aimLocalY, setAimLocalY] = useState(0.122) // Default aimed at T20
  const [dartPrecision, setDartPrecision] = useState(1.0) // 1.0 = laser steady

  const [puttAngleDeg, setPuttAngleDeg] = useState(0)
  const [puttPowerPct, setPuttPowerPct] = useState(56)

  const [diceTrayPool, setDiceTrayPool] = useState<DieKind[]>(['d20', 'd6'])

  const [propTitle, setPropTitle] = useState('')
  const [propOptA, setPropOptA] = useState('')
  const [propOptB, setPropOptB] = useState('')
  const [propStake, setPropStake] = useState(1)

  const barLayout = useMemo(
    () => computeBarGamesLayout(roomCustomization),
    [roomCustomization],
  )

  const previewDartHit = useMemo(
    () => scoreDartPolar(aimLocalX, aimLocalY),
    [aimLocalX, aimLocalY],
  )

  const myPrivateCards = tabletopState.hands[localUserId]?.cards ?? []
  const otherHands = useMemo(
    () =>
      Object.values(tabletopState.hands).filter(
        (h) => h.userId !== localUserId && h.cards.length > 0,
      ),
    [localUserId, tabletopState.hands],
  )

  const sortedClubhouseStats = useMemo(() => {
    return Object.values(clubhouseState.playerStats).sort(
      (a, b) =>
        b.dartWins + b.puttingWins - (a.dartWins + a.puttingWins) ||
        b.highestCheckout - a.highestCheckout ||
        b.longestPuttingStreak - a.longestPuttingStreak,
    )
  }, [clubhouseState.playerStats])

  const sortedLedger = useMemo(() => {
    return Object.values(clubhouseState.ledger).sort(
      (a, b) => b.netDollars - a.netDollars || b.propsWon - a.propsWon,
    )
  }, [clubhouseState.ledger])

  if (!open) return null

  const myUserKey = normalizePlayerKey(localDisplayName)

  const handleFireDesktopDart = (overrideLocal?: [number, number]) => {
    if (hasActiveDartShot) return
    const lx = overrideLocal ? overrideLocal[0] : aimLocalX
    const ly = overrideLocal ? overrideLocal[1] : aimLocalY
    const spread = (1 - dartPrecision) * 0.025
    const jitterX = (Math.random() - 0.5) * spread
    const jitterY = (Math.random() - 0.5) * spread

    const origin: [number, number, number] = [
      barLayout.ocheFloorPos[0],
      barLayout.ocheFloorPos[1] + 1.5,
      barLayout.ocheFloorPos[2],
    ]
    const targetWorld: [number, number, number] = [
      barLayout.dartboardCenter[0] - (lx + jitterX),
      barLayout.dartboardCenter[1] + (ly + jitterY),
      barLayout.dartboardCenter[2] - 0.028,
    ]
    const vel = computeBallisticDartVelocity(origin, targetWorld, 1.06)
    onLaunchDartShot(origin, vel, barLayout.dartboardCenter)
  }

  const handleFireDesktopPutt = () => {
    if (hasActivePuttShot) return
    const ballXZ: [number, number] = [
      puttingState.ballRestLocal[0],
      puttingState.ballRestLocal[2],
    ]
    // Calibrated speed range: 1.4 m/s (20%) to 3.4 m/s (100%); ~56% = ~2.28 m/s (ideal center cup speed!)
    const speed = 1.15 + (puttPowerPct / 100) * 2.25
    const rad = (puttAngleDeg * Math.PI) / 180
    const vx = Number((Math.sin(rad) * speed).toFixed(3))
    const vz = Number((-Math.cos(rad) * speed).toFixed(3))
    onLaunchPuttShot(ballXZ, [vx, vz])
  }

  const handleSubmitCustomProp = (e: React.FormEvent) => {
    e.preventDefault()
    if (!propTitle.trim() || !propOptA.trim() || !propOptB.trim()) return
    onCreateProp(propTitle.trim(), [propOptA.trim(), propOptB.trim()], propStake)
    setPropTitle('')
    setPropOptA('')
    setPropOptB('')
  }

  return (
    <div
      id="bar-games-drawer"
      className="pointer-events-auto fixed top-16 right-4 bottom-28 z-40 flex w-[410px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#0b0f17]/95 text-[#f4f1ea] shadow-2xl backdrop-blur-xl"
    >
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#e5a93c]/20 text-[#e5a93c]">
            <Dices className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-wide text-[#f4f1ea]">
              Bar Games &amp; Clubhouse Corner
            </h2>
            <p className="text-[11px] text-slate-400">
              Authoritative 3D Darts · Putting · Polyhedral Table · $1 Props
            </p>
          </div>
        </div>
        <button
          id="btn-close-bar-games"
          type="button"
          onClick={onClose}
          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
          title="Close Bar Games Drawer"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* 4-Pillar Navigation Tabs */}
      <div className="grid grid-cols-4 gap-1 border-b border-white/10 bg-[#080b11] p-1.5 text-[11px] font-semibold">
        {(
          [
            { id: 'play', label: '🎯 Play' },
            { id: 'scoreboard', label: '🏆 Scores' },
            { id: 'tabletop', label: '🎲 Table' },
            { id: 'props', label: '📋 $1 Props' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            id={`tab-bargames-${tab.id}`}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={`rounded-lg px-2 py-1.5 transition ${
              activeTab === tab.id
                ? 'bg-[#e5a93c] text-[#090c12] shadow'
                : 'text-slate-300 hover:bg-white/8'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable Body */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4 text-xs">
        {/* =============================================================== */}
        {/* TAB 1: DARTS & MINI-GOLF PUTTING CONTROLS                       */}
        {/* =============================================================== */}
        {activeTab === 'play' && (
          <>
            {/* Quick Station Teleport Bar */}
            <div className="grid grid-cols-4 gap-1.5">
              <button
                id="btn-goto-free-roam"
                type="button"
                onClick={() => onSelectSeat('roam:free')}
                className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                  localSeatId === 'roam:free'
                    ? 'border-sky-400 bg-sky-500/20 text-sky-200'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                🚶 Walk Free
              </button>
              <button
                id="btn-goto-oche"
                type="button"
                onClick={() => onSelectSeat('station:darts-oche')}
                className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                  localSeatId === 'station:darts-oche'
                    ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                🎯 Oche
              </button>
              <button
                id="btn-goto-putting"
                type="button"
                onClick={() => onSelectSeat('station:putting-tee')}
                className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                  localSeatId === 'station:putting-tee'
                    ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                ⛳ Putting
              </button>
              <button
                id="btn-goto-gametable"
                type="button"
                onClick={() => onSelectSeat('game-table:seat-0')}
                className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                  localSeatId?.startsWith('game-table:')
                    ? 'border-amber-400 bg-amber-500/20 text-amber-200'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                🎲 Table
              </button>
              <button
                id="btn-goto-shuffleboard"
                type="button"
                onClick={() => onSelectSeat('station:shuffleboard')}
                className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                  localSeatId === 'station:shuffleboard'
                    ? 'border-orange-400 bg-orange-500/20 text-orange-200'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                🥌 Shuffleboard
              </button>
              <button
                id="btn-goto-cornhole"
                type="button"
                onClick={() => onSelectSeat('wing:deck-cornhole')}
                className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                  localSeatId === 'wing:deck-cornhole'
                    ? 'border-lime-400 bg-lime-500/20 text-lime-200'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                🌽 Cornhole
              </button>
              <button
                id="btn-goto-holotable"
                type="button"
                onClick={() => onSelectSeat('wing:gameroom-holo-1')}
                className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                  localSeatId?.startsWith('wing:gameroom-holo-')
                    ? 'border-purple-400 bg-purple-500/20 text-purple-200'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                🗺 Holotable
              </button>
              <button
                id="btn-goto-arcade"
                type="button"
                onClick={() => onSelectSeat('wing:gameroom-arcade-1')}
                className={`rounded-xl border px-2 py-2 text-[11px] font-semibold transition ${
                  localSeatId === 'wing:gameroom-arcade-1'
                    ? 'border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200'
                    : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                }`}
              >
                🕹 Arcade
              </button>
            </div>

            {/* 3D DARTS SECTION */}
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4 text-[#e5a93c]" />
                  <span className="font-bold text-[#f4f1ea]">
                    3D Back-Wall Dartboard ({dartsState.mode.toUpperCase()})
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    id="btn-darts-mode-501"
                    type="button"
                    onClick={() => onConfigureDarts({ mode: '501' })}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      dartsState.mode === '501'
                        ? 'bg-[#e5a93c] text-[#090c12]'
                        : 'bg-white/8 text-slate-300'
                    }`}
                  >
                    501
                  </button>
                  <button
                    id="btn-darts-mode-cricket"
                    type="button"
                    onClick={() => onConfigureDarts({ mode: 'cricket' })}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      dartsState.mode === 'cricket'
                        ? 'bg-[#e5a93c] text-[#090c12]'
                        : 'bg-white/8 text-slate-300'
                    }`}
                  >
                    Cricket
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {dartsState.mode === '501' && (
                  <button
                    id="btn-darts-double-out"
                    type="button"
                    onClick={() =>
                      onConfigureDarts({ doubleOut: !dartsState.doubleOut })
                    }
                    className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                      dartsState.doubleOut
                        ? 'border-cyan-400/50 bg-cyan-500/20 text-cyan-200'
                        : 'border-white/10 bg-white/5 text-slate-300'
                    }`}
                  >
                    {dartsState.doubleOut ? '✓ Double-Out ON' : 'Double-Out OFF'}
                  </button>
                )}
                <button
                  id="btn-darts-join"
                  type="button"
                  onClick={onJoinDarts}
                  className="rounded-lg border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium hover:bg-white/15"
                >
                  + Join Match
                </button>
                <button
                  id="btn-darts-reset"
                  type="button"
                  onClick={onResetDarts}
                  className="rounded-lg border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] font-medium hover:bg-white/15"
                >
                  Reset Leg
                </button>
              </div>

              {/* Quick Polar Target Presets */}
              <div>
                <div className="mb-1.5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Aim Target: <strong className="text-cyan-300">{previewDartHit.label}</strong> ({previewDartHit.points} pts)</span>
                  <span>Steady: {Math.round(dartPrecision * 100)}%</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {DART_QUICK_TARGETS.map((tgt) => (
                    <button
                      key={tgt.id}
                      id={`btn-aim-${tgt.id}`}
                      type="button"
                      onClick={() => {
                        setAimLocalX(tgt.localX)
                        setAimLocalY(tgt.localY)
                      }}
                      className={`rounded-lg border px-2 py-1.5 text-left text-[11px] transition ${
                        Math.hypot(aimLocalX - tgt.localX, aimLocalY - tgt.localY) < 0.008
                          ? 'border-[#e5a93c] bg-[#e5a93c]/20 text-[#fde68a]'
                          : 'border-white/10 bg-black/30 text-slate-300 hover:bg-white/8'
                      }`}
                    >
                      {tgt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] text-slate-400">Horizontal Aim (X)</span>
                  <input
                    type="range"
                    min={-0.23}
                    max={0.23}
                    step={0.005}
                    value={aimLocalX}
                    onChange={(e) => setAimLocalX(Number(e.target.value))}
                    className="w-full accent-[#e5a93c]"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-slate-400">Vertical Aim (Y)</span>
                  <input
                    type="range"
                    min={-0.23}
                    max={0.23}
                    step={0.005}
                    value={aimLocalY}
                    onChange={(e) => setAimLocalY(Number(e.target.value))}
                    className="w-full accent-[#e5a93c]"
                  />
                </label>
              </div>

              <div className="flex items-center gap-2">
                <label className="flex-1">
                  <span className="text-[10px] text-slate-400">Release Steadiness</span>
                  <input
                    type="range"
                    min={0.5}
                    max={1.0}
                    step={0.05}
                    value={dartPrecision}
                    onChange={(e) => setDartPrecision(Number(e.target.value))}
                    className="w-full accent-cyan-400"
                  />
                </label>
                <button
                  id="btn-throw-dart"
                  type="button"
                  disabled={hasActiveDartShot}
                  onClick={() => handleFireDesktopDart()}
                  className="rounded-xl bg-[#e5a93c] px-4 py-2.5 text-xs font-bold text-[#090c12] shadow transition hover:bg-[#f2be5c] disabled:opacity-40"
                >
                  🎯 Throw Dart
                </button>
              </div>

              <p className="rounded-lg bg-black/30 px-2.5 py-1.5 text-[11px] text-slate-300">
                {dartsState.lastTurnSummary}
              </p>
            </div>

            {/* MINI-GOLF PUTTING GREEN SECTION */}
            <div className="space-y-3 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flag className="h-4 w-4 text-emerald-400" />
                  <span className="font-bold text-[#f4f1ea]">
                    Mini-Golf Putting Strip
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    id="btn-putting-mode-streak"
                    type="button"
                    onClick={() => onConfigurePutting({ mode: 'streak' })}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      puttingState.mode === 'streak'
                        ? 'bg-emerald-400 text-[#051810]'
                        : 'bg-white/8 text-slate-300'
                    }`}
                  >
                    Streak
                  </button>
                  <button
                    id="btn-putting-mode-puttoff"
                    type="button"
                    onClick={() => onConfigurePutting({ mode: 'puttoff' })}
                    className={`rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                      puttingState.mode === 'puttoff'
                        ? 'bg-emerald-400 text-[#051810]'
                        : 'bg-white/8 text-slate-300'
                    }`}
                  >
                    Putt-Off
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                <button
                  id="btn-toggle-ramp"
                  type="button"
                  onClick={() =>
                    onConfigurePutting({ rampEnabled: !puttingState.rampEnabled })
                  }
                  className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium ${
                    puttingState.rampEnabled
                      ? 'border-amber-400/60 bg-amber-500/20 text-amber-200'
                      : 'border-white/10 bg-white/5 text-slate-300'
                  }`}
                >
                  {puttingState.rampEnabled ? '🌉 Obstacle Ramp: ON' : 'Obstacle Ramp: OFF'}
                </button>
                <button
                  id="btn-putting-retee"
                  type="button"
                  onClick={onResetBallToTee}
                  className="rounded-lg border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] hover:bg-white/15"
                >
                  Re-Tee Ball
                </button>
                <button
                  id="btn-putting-join"
                  type="button"
                  onClick={onJoinPutting}
                  className="rounded-lg border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] hover:bg-white/15"
                >
                  + Join
                </button>
                <button
                  id="btn-putting-reset"
                  type="button"
                  onClick={onResetPutting}
                  className="rounded-lg border border-white/10 bg-white/8 px-2.5 py-1 text-[11px] hover:bg-white/15"
                >
                  Reset
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[10px] text-slate-400">
                    Aim Line ({puttAngleDeg > 0 ? `+${puttAngleDeg}° R` : `${puttAngleDeg}°`})
                  </span>
                  <input
                    id="input-putt-angle"
                    type="range"
                    min={-18}
                    max={18}
                    step={0.5}
                    value={puttAngleDeg}
                    onChange={(e) => setPuttAngleDeg(Number(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </label>
                <label className="block">
                  <span className="text-[10px] text-slate-400">
                    Putt Power ({puttPowerPct}%)
                  </span>
                  <input
                    id="input-putt-power"
                    type="range"
                    min={20}
                    max={100}
                    step={1}
                    value={puttPowerPct}
                    onChange={(e) => setPuttPowerPct(Number(e.target.value))}
                    className="w-full accent-emerald-400"
                  />
                </label>
              </div>

              <button
                id="btn-strike-putt"
                type="button"
                disabled={hasActivePuttShot}
                onClick={handleFireDesktopPutt}
                className="w-full rounded-xl bg-emerald-500 py-2 text-xs font-bold text-[#04130c] shadow transition hover:bg-emerald-400 disabled:opacity-40"
              >
                ⛳ Strike Golf Ball
              </button>

              <p className="rounded-lg bg-black/30 px-2.5 py-1.5 text-[11px] text-slate-300">
                {puttingState.lastOutcomeText}
              </p>
            </div>
          </>
        )}

        {/* =============================================================== */}
        {/* TAB 2: LIVE DIGITAL SCOREBOARD & CLUBHOUSE LEADERBOARD          */}
        {/* =============================================================== */}
        {activeTab === 'scoreboard' && (
          <>
            {/* Live Darts Match Card */}
            <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#e5a93c]">
                  🎯 Live Darts · {dartsState.mode.toUpperCase()}
                </span>
                <span className="text-[11px] text-slate-400">
                  {dartsState.mode === '501'
                    ? dartsState.doubleOut
                      ? 'Double-Out'
                      : 'Straight-Out'
                    : 'Marks & Points'}
                </span>
              </div>

              {dartsState.players.length === 0 ? (
                <p className="text-slate-400">No active throwers yet — throw a dart to start!</p>
              ) : dartsState.mode === '501' ? (
                <div className="grid grid-cols-2 gap-2">
                  {dartsState.players.map((p, idx) => {
                    const active = idx === dartsState.activePlayerIndex && !dartsState.winnerId
                    return (
                      <div
                        key={p.userId}
                        className={`rounded-xl border p-2.5 ${
                          active
                            ? 'border-cyan-400/60 bg-cyan-950/30'
                            : 'border-white/10 bg-black/30'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-white">{p.displayName}</span>
                          {active && <span className="text-cyan-300">Throwing</span>}
                        </div>
                        <div className="mt-1 text-2xl font-black text-[#e5a93c]">
                          {p.score501}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-center text-[11px]">
                    <thead>
                      <tr className="border-b border-white/10 text-slate-400">
                        <th className="py-1 text-left">Target</th>
                        {dartsState.players.map((p) => (
                          <th key={p.userId} className="py-1">
                            {p.displayName} ({p.cricketPoints})
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {CRICKET_TARGETS.map((t) => (
                        <tr key={t} className="border-b border-white/5">
                          <td className="py-1 text-left font-bold text-[#e5a93c]">
                            {t === 25 ? 'BULL' : t}
                          </td>
                          {dartsState.players.map((p) => (
                            <td key={p.userId} className="py-1 font-mono text-sm">
                              {formatCricketMarkSymbol(p.cricketMarks[t] ?? 0)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Live Putting Scorecard */}
            <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-emerald-400">
                  ⛳ Putting Green ({puttingState.mode === 'puttoff' ? `Putt-Off Rd ${puttingState.round}/${puttingState.maxRounds}` : 'Streak Mode'})
                </span>
              </div>
              {puttingState.players.length === 0 ? (
                <p className="text-slate-400">Sink a putt to post a live streak!</p>
              ) : (
                <div className="space-y-1.5">
                  {puttingState.players.map((p) => (
                    <div
                      key={p.userId}
                      className="flex items-center justify-between rounded-lg bg-black/30 px-2.5 py-1.5"
                    >
                      <span className="font-semibold">{p.displayName}</span>
                      <span className="text-emerald-300">
                        🔥 Streak {p.currentStreak} (Best {p.bestSessionStreak}) · Pts {p.puttOffScore}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Persistent All-Time Clubhouse Leaderboard */}
            <div className="space-y-2.5 rounded-xl border border-[#e5a93c]/30 bg-[#e5a93c]/5 p-3.5">
              <div className="flex items-center gap-2">
                <Trophy className="h-4 w-4 text-[#e5a93c]" />
                <span className="font-bold text-[#fde68a]">
                  All-Time Clubhouse Leaderboard
                </span>
              </div>

              {sortedClubhouseStats.length === 0 ? (
                <p className="text-slate-400">
                  Completed matches, bullseyes, high checkouts, and longest putting streaks persist here across sessions!
                </p>
              ) : (
                <div className="space-y-1.5">
                  {sortedClubhouseStats.map((st, idx) => (
                    <div
                      key={st.key}
                      className="rounded-lg border border-white/10 bg-black/40 px-3 py-2"
                    >
                      <div className="flex items-center justify-between font-semibold text-white">
                        <span>
                          #{idx + 1} {st.displayName}
                        </span>
                        <span className="text-[#e5a93c]">
                          Darts {st.dartWins}W-{st.dartLosses}L · Putt {st.puttingWins}W-{st.puttingLosses}L
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap gap-3 text-[11px] text-slate-400">
                        <span>High Checkout: <strong className="text-slate-200">{st.highestCheckout || '—'}</strong></span>
                        <span>Best Streak: <strong className="text-emerald-300">{st.longestPuttingStreak}</strong></span>
                        <span>Bullseyes: <strong className="text-amber-300">{st.bullseyes}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {clubhouseState.recentMatches.length > 0 && (
                <div className="pt-2">
                  <div className="mb-1 text-[11px] font-semibold text-slate-400">
                    Recent Completed Matches
                  </div>
                  <div className="space-y-1">
                    {clubhouseState.recentMatches.slice(0, 5).map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded bg-black/30 px-2 py-1 text-[11px]"
                      >
                        <span className="text-slate-200">
                          🏆 <strong>{m.winnerName}</strong> won {m.game}
                        </span>
                        <span className="text-slate-400">{m.highlight ?? ''}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {/* =============================================================== */}
        {/* TAB 3: INTERACTIVE POLYHEDRAL DICE, 52-CARD DECK & GRID TABLE   */}
        {/* =============================================================== */}
        {activeTab === 'tabletop' && (
          <>
            {/* Snap-to-Seat Perimeter Buttons */}
            <div className="grid grid-cols-4 gap-1.5">
              {(['South', 'West', 'North', 'East'] as const).map((dir, idx) => {
                const sid = `game-table:seat-${idx}`
                return (
                  <button
                    key={sid}
                    id={`btn-table-seat-${idx}`}
                    type="button"
                    onClick={() => onSelectSeat(sid)}
                    className={`rounded-lg border py-1.5 text-[11px] font-semibold ${
                      localSeatId === sid
                        ? 'border-cyan-400 bg-cyan-500/20 text-cyan-200'
                        : 'border-white/10 bg-white/5 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    Sit {dir}
                  </button>
                )
              })}
            </div>

            {/* Polyhedral Dice Roller */}
            <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#f4f1ea]">
                  🎲 Synchronized 3D Polyhedral Dice
                </span>
                <span className="rounded-full bg-[#e5a93c]/20 px-2.5 py-0.5 font-bold text-[#fde68a]">
                  Sum: {tabletopState.lastRollTotal}
                </span>
              </div>

              <div className="grid grid-cols-6 gap-1.5">
                {(['d4', 'd6', 'd8', 'd10', 'd12', 'd20'] as const).map((dk) => (
                  <button
                    key={dk}
                    id={`btn-roll-${dk}`}
                    type="button"
                    onClick={() => onRollDice([dk])}
                    className="rounded-lg border border-indigo-400/30 bg-indigo-500/20 py-1.5 font-bold text-indigo-200 transition hover:bg-indigo-500/35"
                  >
                    {dk}
                  </button>
                ))}
              </div>

              {/* Multi-Die Tray Pool */}
              <div className="flex items-center justify-between gap-2 rounded-lg bg-black/30 p-2">
                <div className="flex flex-wrap items-center gap-1">
                  {diceTrayPool.map((dk, idx) => (
                    <span
                      key={`${dk}-${idx}`}
                      className="rounded bg-white/10 px-1.5 py-0.5 text-[11px]"
                    >
                      {dk}
                    </span>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setDiceTrayPool((p) =>
                        p.length < 6 ? [...p, 'd6'] : ['d20'],
                      )
                    }
                    className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white"
                  >
                    +d6
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setDiceTrayPool((p) =>
                        p.length < 6 ? [...p, 'd20'] : ['d20'],
                      )
                    }
                    className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-slate-400 hover:text-white"
                  >
                    +d20
                  </button>
                </div>
                <button
                  id="btn-roll-pool"
                  type="button"
                  onClick={() => onRollDice(diceTrayPool)}
                  className="rounded-lg bg-[#e5a93c] px-3 py-1.5 font-bold text-[#090c12] hover:bg-[#f2be5c]"
                >
                  Roll Tray
                </button>
              </div>

              <p id="dice-roll-summary" className="text-[11px] text-slate-300">
                {tabletopState.lastRollSummary}
              </p>
            </div>

            {/* Shared 52-Card Deck */}
            <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-[#f4f1ea]">
                  <Club className="h-4 w-4 text-rose-400" />
                  Shared 52-Card Deck
                </span>
                <span id="deck-remaining-count" className="text-[11px] text-slate-400">
                  {tabletopState.deck.length} in shoe
                </span>
              </div>

              <div className="grid grid-cols-2 gap-1.5">
                <button
                  id="btn-deck-draw"
                  type="button"
                  onClick={onDrawCardToHand}
                  disabled={tabletopState.deck.length === 0}
                  className="rounded-lg bg-blue-600 py-1.5 font-semibold text-white hover:bg-blue-500 disabled:opacity-40"
                >
                  🂠 Draw to My Hand
                </button>
                <button
                  id="btn-deck-deal-up"
                  type="button"
                  onClick={() => onDealCardToTable(true)}
                  disabled={tabletopState.deck.length === 0}
                  className="rounded-lg bg-emerald-600 py-1.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                >
                  🃏 Deal Face-Up
                </button>
                <button
                  id="btn-deck-deal-down"
                  type="button"
                  onClick={() => onDealCardToTable(false)}
                  disabled={tabletopState.deck.length === 0}
                  className="rounded-lg border border-white/10 bg-white/8 py-1.5 hover:bg-white/15 disabled:opacity-40"
                >
                  Deal Face-Down
                </button>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    id="btn-deck-shuffle"
                    type="button"
                    onClick={onShuffleDeck}
                    className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/8 py-1.5 hover:bg-white/15"
                  >
                    <Shuffle className="h-3 w-3" /> Shuffle
                  </button>
                  <button
                    id="btn-deck-reset"
                    type="button"
                    onClick={onResetDeck}
                    className="flex items-center justify-center gap-1 rounded-lg border border-white/10 bg-white/8 py-1.5 hover:bg-white/15"
                  >
                    <RefreshCw className="h-3 w-3" /> Reset
                  </button>
                </div>
              </div>

              {/* Local Player's Private Hand */}
              <div
                id="private-hand-panel"
                className="rounded-lg border border-blue-400/25 bg-blue-950/20 p-2.5"
              >
                <div className="mb-1.5 flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-blue-200">
                    🔒 Your Private Hand ({myPrivateCards.length})
                  </span>
                  <span className="text-[10px] text-slate-400">Hidden until played</span>
                </div>
                {myPrivateCards.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    Draw a card — only you can see it until you play it to the table!
                  </p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {myPrivateCards.map((c) => {
                      const sm = SUIT_SYMBOLS[c.suit]
                      return (
                        <div
                          key={c.id}
                          className="flex items-center gap-1 rounded-lg bg-white px-2 py-1 text-xs font-bold shadow"
                          style={{ color: sm.color }}
                        >
                          <span>
                            {c.rank}
                            {sm.glyph}
                          </span>
                          <button
                            type="button"
                            onClick={() => onPlayCardFromHand(c.id, true)}
                            className="ml-1 rounded bg-slate-900 px-1.5 py-0.5 text-[10px] text-white hover:bg-slate-700"
                            title="Play Face-Up to Table"
                          >
                            Play
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Other Players' Private Card Counts (Zero Leakage of Rank/Suit) */}
              {otherHands.length > 0 && (
                <div id="other-hands-summary" className="flex flex-wrap gap-2 text-[11px] text-amber-200">
                  {otherHands.map((h) => (
                    <span key={h.userId} className="rounded bg-white/8 px-2 py-0.5">
                      🂠 {h.displayName}: {h.cards.length} private card{h.cards.length === 1 ? '' : 's'}
                    </span>
                  ))}
                </div>
              )}

              {/* Dealer / House Cards on Table (Blackjack & Hold'em) */}
              {tabletopState.dealerCards && tabletopState.dealerCards.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] text-amber-300">
                    Dealer Cards:
                  </div>
                  <div id="dealer-cards-list" className="flex flex-wrap gap-1.5">
                    {tabletopState.dealerCards.map((dc, idx) => {
                      const showFace =
                        idx === 0 || Boolean(tabletopState.dealerHoleRevealed)
                      const sm = SUIT_SYMBOLS[dc.suit]
                      return (
                        <span
                          key={`dealer-${dc.id}-${idx}`}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold shadow ${
                            showFace
                              ? 'border-white bg-white'
                              : 'border-rose-400/40 bg-rose-950 text-amber-200'
                          }`}
                          style={showFace ? { color: sm.color } : undefined}
                        >
                          {showFace ? `${dc.rank}${sm.glyph}` : '🂠 Hidden'}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Shared Cards on Table */}
              {tabletopState.tableCards.length > 0 && (
                <div>
                  <div className="mb-1 text-[11px] text-slate-400">
                    Table Cards (click to Flip):
                  </div>
                  <div id="table-cards-list" className="flex flex-wrap gap-1.5">
                    {tabletopState.tableCards.map((tc, idx) => {
                      const sm = SUIT_SYMBOLS[tc.card.suit]
                      return (
                        <button
                          key={`${tc.card.id}-${idx}`}
                          type="button"
                          onClick={() => onFlipTableCard(tc.card.id)}
                          className={`rounded-lg border px-2.5 py-1 text-xs font-bold shadow transition ${
                            tc.faceUp
                              ? 'border-white bg-white'
                              : 'border-rose-400/40 bg-rose-950 text-amber-200'
                          }`}
                          style={tc.faceUp ? { color: sm.color } : undefined}
                        >
                          {tc.faceUp ? `${tc.card.rank}${sm.glyph}` : '🂠 Hidden'}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Toggleable Tabletop Surface & Tactical Grid Tokens */}
            <div className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3.5">
              <span className="font-bold text-[#f4f1ea]">
                🗺 Tabletop Surface &amp; Tactical Grid
              </span>
              <div className="grid grid-cols-4 gap-1.5">
                {(
                  [
                    { id: 'felt', label: 'Felt' },
                    { id: 'wood', label: 'Wood' },
                    { id: 'square-grid', label: 'Sq Grid' },
                    { id: 'hex-grid', label: 'Hex Grid' },
                  ] as const
                ).map((s) => (
                  <button
                    key={s.id}
                    id={`btn-surface-${s.id}`}
                    type="button"
                    onClick={() => onSetSurface(s.id)}
                    className={`rounded-lg border py-1.5 text-[11px] font-semibold ${
                      tabletopState.surface === s.id
                        ? 'border-[#e5a93c] bg-[#e5a93c] text-[#090c12]'
                        : 'border-white/10 bg-white/5 text-slate-300'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {TOKEN_PALETTE.map((tk) => (
                  <button
                    key={tk.label}
                    type="button"
                    onClick={() => onSpawnToken(tk.label, tk.color)}
                    className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[11px] hover:bg-white/10"
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: tk.color }}
                    />
                    +{tk.label}
                  </button>
                ))}
                {tabletopState.tokens.length > 0 && (
                  <button
                    type="button"
                    onClick={onClearTokens}
                    className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-2 py-1 text-[11px] text-rose-300"
                  >
                    Clear ({tabletopState.tokens.length})
                  </button>
                )}
              </div>

              {tabletopState.tokens.length > 0 && (
                <div className="space-y-1 pt-1">
                  {tabletopState.tokens.slice(0, 4).map((tok) => (
                    <div
                      key={tok.id}
                      className="flex items-center justify-between rounded bg-black/30 px-2 py-1 text-[11px]"
                    >
                      <span className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ backgroundColor: tok.color }}
                        />
                        {tok.label} ({tok.localPos[0].toFixed(2)}, {tok.localPos[1].toFixed(2)})
                      </span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() =>
                            onMoveToken(tok.id, tok.localPos[0] - 0.11, tok.localPos[1])
                          }
                          className="rounded bg-white/10 px-1.5"
                        >
                          ◀
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onMoveToken(tok.id, tok.localPos[0] + 0.11, tok.localPos[1])
                          }
                          className="rounded bg-white/10 px-1.5"
                        >
                          ▶
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onMoveToken(tok.id, tok.localPos[0], tok.localPos[1] - 0.11)
                          }
                          className="rounded bg-white/10 px-1.5"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onMoveToken(tok.id, tok.localPos[0], tok.localPos[1] + 0.11)
                          }
                          className="rounded bg-white/10 px-1.5"
                        >
                          ▼
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* =============================================================== */}
        {/* TAB 4: LIVE PREDICTION & $1 WAGER CHALKBOARD + LEDGER           */}
        {/* =============================================================== */}
        {activeTab === 'props' && (
          <>
            <button
              id="btn-goto-chalkboard"
              type="button"
              onClick={() => onSelectSeat('station:chalkboard')}
              className={`w-full rounded-xl border px-3 py-2 text-[11px] font-semibold transition ${
                localSeatId === 'station:chalkboard'
                  ? 'border-emerald-400 bg-emerald-500/20 text-emerald-200'
                  : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
              }`}
            >
              📋 Stand at 3D Back-Wall Chalkboard
            </button>

            {/* Post New Prop Form */}
            <form
              onSubmit={handleSubmitCustomProp}
              className="space-y-2.5 rounded-xl border border-white/10 bg-white/[0.03] p-3.5"
            >
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 font-bold text-[#fde68a]">
                  <Sparkles className="h-4 w-4 text-[#e5a93c]" />
                  Post Watch-Party / Bar Prop
                </span>
                <select
                  value={propStake}
                  onChange={(e) => setPropStake(Number(e.target.value))}
                  className="rounded-lg border border-white/15 bg-black/50 px-2 py-1 text-[11px]"
                >
                  <option value={1}>$1 Friendly</option>
                  <option value={2}>$2 Friendly</option>
                  <option value={5}>$5 High Roller</option>
                </select>
              </div>

              {/* One-tap templates */}
              <div className="flex flex-wrap gap-1">
                {QUICK_PROP_TEMPLATES.map((tpl) => (
                  <button
                    key={tpl.title}
                    type="button"
                    onClick={() =>
                      onCreateProp(tpl.title, [...tpl.options], tpl.stakeDollars)
                    }
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[10px] text-slate-300 hover:bg-white/12"
                  >
                    + {tpl.title}
                  </button>
                ))}
              </div>

              <input
                id="input-prop-title"
                type="text"
                value={propTitle}
                onChange={(e) => setPropTitle(e.target.value)}
                placeholder="Prop question (e.g. Next putt made?)"
                className="w-full rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <input
                  id="input-prop-opt-a"
                  type="text"
                  value={propOptA}
                  onChange={(e) => setPropOptA(e.target.value)}
                  placeholder="Option A (e.g. Yes / Over)"
                  className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                />
                <input
                  id="input-prop-opt-b"
                  type="text"
                  value={propOptB}
                  onChange={(e) => setPropOptB(e.target.value)}
                  placeholder="Option B (e.g. No / Under)"
                  className="rounded-lg border border-white/15 bg-black/40 px-2.5 py-1.5 text-xs text-white placeholder-slate-500"
                />
              </div>
              <button
                id="btn-post-prop"
                type="submit"
                className="w-full rounded-xl bg-[#e5a93c] py-2 font-bold text-[#090c12] transition hover:bg-[#f2be5c]"
              >
                📋 Post ${propStake} Prop to Chalkboard
              </button>
            </form>

            {/* Active & Recent Props List */}
            <div className="space-y-2.5">
              {clubhouseState.props.map((prop) => (
                <div
                  key={prop.id}
                  data-prop-id={prop.id}
                  className="space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="mr-1.5 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                        ${prop.stakeDollars}
                      </span>
                      <span className="font-bold text-white">{prop.title}</span>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        prop.status === 'open'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : prop.status === 'locked'
                            ? 'bg-amber-500/20 text-amber-300'
                            : 'bg-sky-500/20 text-sky-300'
                      }`}
                    >
                      {prop.status.toUpperCase()}
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    {prop.options.map((opt, idx) => {
                      const picks = prop.picks.filter((pk) => pk.optionIndex === idx)
                      const mine = picks.some((pk) => pk.userKey === myUserKey)
                      const won =
                        prop.status === 'resolved' && prop.winningOptionIndex === idx

                      return (
                        <div key={`${prop.id}-${idx}`} className="flex items-center gap-1.5">
                          <button
                            type="button"
                            disabled={prop.status !== 'open'}
                            onClick={() => onPickPropOption(prop.id, idx)}
                            className={`prop-pick-btn flex flex-1 items-center justify-between rounded-lg border px-2.5 py-1.5 text-left transition ${
                              won
                                ? 'border-emerald-400 bg-emerald-500/25 text-emerald-100'
                                : mine
                                  ? 'border-blue-400 bg-blue-500/25 text-blue-100'
                                  : 'border-white/10 bg-black/35 text-slate-200 hover:bg-white/10 disabled:opacity-75'
                            }`}
                          >
                            <span className="font-medium">
                              {won ? '🏆 ' : mine ? '✓ ' : ''}
                              {opt}
                            </span>
                            <span className="text-[10px] text-slate-300">
                              {picks.length > 0
                                ? picks.map((p) => p.displayName).join(', ')
                                : '0 picks'}
                            </span>
                          </button>

                          {prop.status !== 'resolved' && (
                            <button
                              type="button"
                              onClick={() => onResolveProp(prop.id, idx)}
                              className="prop-resolve-btn shrink-0 rounded-lg border border-amber-400/40 bg-amber-500/15 px-2 py-1.5 text-[10px] font-bold text-amber-200 hover:bg-amber-500/30"
                              title="Mark as Winning Outcome & Settle Ledger"
                            >
                              <Check className="inline h-3 w-3" /> Won
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    {prop.status === 'open' ? (
                      <button
                        type="button"
                        onClick={() => onLockProp(prop.id)}
                        className="prop-lock-btn flex items-center gap-1 rounded-lg border border-amber-400/30 bg-amber-500/10 px-2.5 py-1 text-[11px] text-amber-200 hover:bg-amber-500/20"
                      >
                        <Lock className="h-3 w-3" /> Lock Picks
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-500">
                        By {prop.createdBy}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteProp(prop.id)}
                      className="text-[10px] text-slate-500 hover:text-rose-400"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Persistent All-Time Clubhouse Ledger */}
            <div
              id="clubhouse-ledger-card"
              className="space-y-2 rounded-xl border border-emerald-400/30 bg-emerald-950/20 p-3.5"
            >
              <div className="font-bold text-emerald-300">
                💰 All-Time Clubhouse Ledger
              </div>
              {sortedLedger.length === 0 ? (
                <p className="text-slate-400">
                  No settled props yet — lock in picks above and mark a winner!
                </p>
              ) : (
                <div className="space-y-1.5">
                  {sortedLedger.map((entry) => {
                    const total = entry.propsWon + entry.propsLost
                    const winRate =
                      total > 0 ? Math.round((entry.propsWon / total) * 100) : 0
                    const formattedNet =
                      entry.netDollars >= 0
                        ? `+$${entry.netDollars}`
                        : `-$${Math.abs(entry.netDollars)}`
                    return (
                      <div
                        key={entry.key}
                        className="flex items-center justify-between rounded-lg bg-black/40 px-3 py-1.5"
                      >
                        <span className="font-semibold text-white">
                          {entry.displayName}
                        </span>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-slate-400">
                            {winRate}% ({entry.propsWon}W-{entry.propsLost}L)
                          </span>
                          <span
                            className={`font-mono font-bold ${
                              entry.netDollars >= 0
                                ? 'text-emerald-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {formattedNet}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
