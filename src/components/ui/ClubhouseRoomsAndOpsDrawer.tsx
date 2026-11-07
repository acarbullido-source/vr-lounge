import {
  CloudSun,
  Compass,
  ExternalLink,
  Flame,
  Newspaper,
  RefreshCw,
  Satellite,
  Search,
  Sun,
  Tv,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  BOARDROOM_STRATEGY_SLIDES,
  COMMAND_STREAM_PRESETS,
  OUTDOOR_SKY_PRESETS,
  computeExpansionWingLayout,
  detectActiveLoungeWing,
  resolveExpansionWingState,
  type ExpansionRoomDestination,
} from '../../constants/expansionRooms'
import {
  FREE_ROAM_SEAT_ID,
  LIGHTING_PRESETS,
  ROOM_SIZE_SPECS,
} from '../../constants/hangout'
import {
  COMMAND_WEATHER_CITIES,
  fetchCommandNewsFeed,
  fetchCommandWeather,
  type CommandNewsFeedResult,
  type CommandWeatherReport,
} from '../../services/commandFeeds'
import { fireplaceAudio } from '../../services/fireplaceAudio'
import type {
  CommandNewsCategoryId,
  ComputedSeat,
  ExpansionWingSyncedState,
  LightingPresetId,
  OutdoorSkyPresetId,
  ParticipantProfile,
  RoomCustomizationState,
  RoomLightingConfig,
} from '../../types/lounge'

export type ClubhouseDrawerTabId = 'rooms' | 'command-ops'

export interface ClubhouseRoomsAndOpsDrawerProps {
  open: boolean
  activeTab: ClubhouseDrawerTabId
  onChangeTab: (tab: ClubhouseDrawerTabId) => void
  onClose: () => void
  roomCustomization: RoomCustomizationState
  computedSeats: ComputedSeat[]
  participants: ParticipantProfile[]
  localUserId: string
  localRoamPosition: [number, number, number]
  onSelectSeat: (seatId: string) => void
  onJumpToDestination: (dest: ExpansionRoomDestination) => void
  onUpdateWingState: (patch: Partial<ExpansionWingSyncedState>) => void
  onUpdateLighting: (patch: Partial<RoomLightingConfig>) => void
  onApplyLightingPreset: (presetId: LightingPresetId) => void
}

export function ClubhouseRoomsAndOpsDrawer({
  open,
  activeTab,
  onChangeTab,
  onClose,
  roomCustomization,
  computedSeats,
  participants,
  localUserId,
  localRoamPosition,
  onSelectSeat,
  onJumpToDestination,
  onUpdateWingState,
  onUpdateLighting,
  onApplyLightingPreset,
}: ClubhouseRoomsAndOpsDrawerProps) {
  const sizeSpec =
    ROOM_SIZE_SPECS[roomCustomization.architecture.sizePreset] ??
    ROOM_SIZE_SPECS.classic
  const wingLayout = useMemo(
    () => computeExpansionWingLayout(sizeSpec.backZ),
    [sizeSpec.backZ],
  )
  const wingState = useMemo(
    () => resolveExpansionWingState(roomCustomization.expansionWing),
    [roomCustomization.expansionWing],
  )

  const [customCityDraft, setCustomCityDraft] = useState(
    wingState.commandCustomCityQuery,
  )
  const [customStreamUrlDraft, setCustomStreamUrlDraft] = useState(
    wingState.commandCustomStreamUrl,
  )
  const [customStreamTitleDraft, setCustomStreamTitleDraft] = useState(
    wingState.commandCustomStreamTitle,
  )
  const [weather, setWeather] = useState<CommandWeatherReport | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [news, setNews] = useState<CommandNewsFeedResult | null>(null)
  const [newsLoading, setNewsLoading] = useState(false)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [crackleOn, setCrackleOn] = useState(() => fireplaceAudio.isPlaying())

  useEffect(() => {
    setCustomCityDraft(wingState.commandCustomCityQuery)
  }, [wingState.commandCustomCityQuery])

  useEffect(() => {
    setCustomStreamUrlDraft(wingState.commandCustomStreamUrl)
    setCustomStreamTitleDraft(wingState.commandCustomStreamTitle)
  }, [wingState.commandCustomStreamTitle, wingState.commandCustomStreamUrl])

  useEffect(() => {
    if (!open || activeTab !== 'command-ops') return
    let cancelled = false
    setWeatherLoading(true)
    void fetchCommandWeather(
      wingState.commandWeatherCityId,
      wingState.commandCustomCityQuery,
      refreshNonce > 0,
    ).then((res) => {
      if (!cancelled) {
        setWeather(res)
        setWeatherLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [
    activeTab,
    open,
    refreshNonce,
    wingState.commandCustomCityQuery,
    wingState.commandWeatherCityId,
  ])

  useEffect(() => {
    if (!open || activeTab !== 'command-ops') return
    let cancelled = false
    setNewsLoading(true)
    void fetchCommandNewsFeed(
      wingState.commandNewsCategory,
      refreshNonce > 0,
    ).then((res) => {
      if (!cancelled) {
        setNews(res)
        setNewsLoading(false)
      }
    })
    return () => {
      cancelled = true
    }
  }, [activeTab, open, refreshNonce, wingState.commandNewsCategory])

  const seatById = useMemo(() => {
    const m = new Map<string, ComputedSeat>()
    for (const s of computedSeats) m.set(s.id, s)
    return m
  }, [computedSeats])

  const occupancyByWing = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of participants) {
      let wing = 'main-lounge'
      if (p.seatId && p.seatId !== FREE_ROAM_SEAT_ID) {
        wing = seatById.get(p.seatId)?.roomWing ?? 'main-lounge'
      } else if (p.userId === localUserId) {
        wing = detectActiveLoungeWing(
          localRoamPosition[0],
          localRoamPosition[2],
          sizeSpec.backZ,
        )
      }
      counts.set(wing, (counts.get(wing) ?? 0) + 1)
    }
    return counts
  }, [localRoamPosition, localUserId, participants, seatById, sizeSpec.backZ])

  if (!open) return null

  const findOpenSeatInWing = (wingId: string, fallbackSeatId: string): string => {
    const takenIds = new Set(
      participants
        .filter(
          (p) =>
            p.userId !== localUserId &&
            p.seatId &&
            p.seatId !== FREE_ROAM_SEAT_ID,
        )
        .map((p) => p.seatId as string),
    )
    const openSeat = computedSeats.find(
      (s) => s.roomWing === wingId && !takenIds.has(s.id),
    )
    return openSeat?.id ?? fallbackSeatId
  }

  return (
    <div
      id="clubhouse-rooms-ops-drawer"
      style={{ zIndex: 45 }}
      className="pointer-events-auto fixed inset-x-0 bottom-20 mx-auto w-[95vw] max-w-4xl rounded-2xl border border-[#f4f1ea]/14 bg-[#0b0f17]/95 p-4 text-[#f4f1ea] shadow-2xl backdrop-blur-xl sm:p-5"
    >
      {/* Header & Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f4f1ea]/10 pb-3">
        <div className="flex items-center gap-2">
          <button
            id="btn-clubhouse-tab-rooms"
            type="button"
            onClick={() => onChangeTab('rooms')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'rooms'
                ? 'bg-[#e5a93c] text-[#080a0d]'
                : 'bg-[#141b27] text-[#c7c2b8] hover:text-[#f4f1ea]'
            }`}
          >
            <Compass className="h-3.5 w-3.5" />
            <span>Clubhouse Rooms &amp; Deck</span>
          </button>

          <button
            id="btn-clubhouse-tab-ops"
            type="button"
            onClick={() => onChangeTab('command-ops')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-semibold transition ${
              activeTab === 'command-ops'
                ? 'bg-[#38bdf8] text-[#080a0d]'
                : 'bg-[#141b27] text-[#c7c2b8] hover:text-[#f4f1ea]'
            }`}
          >
            <Satellite className="h-3.5 w-3.5" />
            <span>Command &amp; Control Feeds</span>
          </button>
        </div>

        <button
          id="btn-close-clubhouse-drawer"
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-[#8a867e] transition hover:bg-[#f4f1ea]/10 hover:text-[#f4f1ea]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Clubhouse-Wide Lighting & Brightness Bar (Active Across All Rooms & Wing) */}
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5a93c]/25 bg-[#121926] px-3.5 py-2.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[#e5a93c]">
            <Sun className="h-3.5 w-3.5" />
            Lighting Mood
          </span>
          {(
            [
              { id: 'daylight', label: '☀️ Studio Bright' },
              { id: 'cozy', label: '🕯 Cozy Hangout' },
              { id: 'neon-pub', label: '⚡ Neon Pub' },
              { id: 'movie', label: '🎬 Movie Dim' },
            ] as Array<{ id: LightingPresetId; label: string }>
          ).map((p) => {
            const active = roomCustomization.lighting.preset === p.id
            return (
              <button
                key={p.id}
                id={`btn-wing-light-${p.id}`}
                type="button"
                onClick={() => onApplyLightingPreset(p.id)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  active
                    ? 'bg-[#e5a93c] text-[#080a0d]'
                    : 'bg-[#090f19] text-[#cbd5e1] hover:bg-[#1a2436] hover:text-[#f4f1ea]'
                }`}
              >
                {p.label}
              </button>
            )
          })}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-[11px] text-[#94a3b8]">Brightness</span>
          <input
            id="slider-wing-brightness"
            type="range"
            min={0.25}
            max={2.0}
            step={0.05}
            value={roomCustomization.lighting.brightness}
            onChange={(e) =>
              onUpdateLighting({
                brightness: Number(e.target.value),
              })
            }
            className="h-1.5 w-24 cursor-pointer accent-[#e5a93c] sm:w-28"
          />
          <span
            id="text-wing-brightness-pct"
            className="w-10 text-right font-mono text-[11px] font-semibold text-[#f8fafc]"
          >
            {Math.round(roomCustomization.lighting.brightness * 100)}%
          </span>
          <span className="hidden text-[10px] text-[#64748b] md:inline">
            ({LIGHTING_PRESETS[roomCustomization.lighting.preset]?.label ?? 'Custom'})
          </span>
        </div>
      </div>

      {activeTab === 'rooms' ? (
        <div className="mt-3 space-y-3 max-h-[56vh] overflow-y-auto pr-1">
          <p className="text-xs text-[#94a3b8]">
            Walk physically through the rear <strong className="text-[#f4f1ea]">Grand Clubhouse Hallway</strong> using{' '}
            <kbd className="rounded bg-[#1e293b] px-1.5 py-0.5 font-mono text-[10px] text-[#f4f1ea]">WASD</kbd> / VR thumbstick, or jump straight into any room or seat below:
          </p>

          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            {wingLayout.destinations.map((dest) => {
              const count = occupancyByWing.get(dest.id) ?? 0
              return (
                <div
                  key={dest.id}
                  data-wing-card={dest.id}
                  className="flex flex-col justify-between rounded-xl border border-[#f4f1ea]/10 bg-[#111723] p-3.5 transition hover:border-[#f4f1ea]/25"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-[#f4f1ea]">
                        {dest.emoji} {dest.shortLabel}
                      </span>
                      {count > 0 && (
                        <span className="rounded-full bg-[#34d399]/15 px-2 py-0.5 font-mono text-[10px] font-semibold text-[#34d399]">
                          {count} here
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] leading-relaxed text-[#94a3b8]">
                      {dest.subtitle}
                    </p>
                  </div>

                  {/* Room-Specific Quick Vibe Controls */}
                  {dest.id === 'boardroom' && (
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <button
                        id="btn-boardroom-toggle-mode"
                        type="button"
                        onClick={() =>
                          onUpdateWingState({
                            boardroomScreenMode:
                              wingState.boardroomScreenMode === 'agenda'
                                ? 'mirror-lounge'
                                : 'agenda',
                          })
                        }
                        className="rounded-lg border border-[#f4f1ea]/12 bg-[#0b1019] px-2 py-1 text-[10px] text-[#cbd5e1] hover:border-[#e5a93c]/50"
                      >
                        {wingState.boardroomScreenMode === 'mirror-lounge'
                          ? '📺 Mirroring Lounge'
                          : `📊 Slide ${wingState.boardroomAgendaIndex + 1}/${BOARDROOM_STRATEGY_SLIDES.length}`}
                      </button>
                      <button
                        id="btn-boardroom-next-slide"
                        type="button"
                        onClick={() =>
                          onUpdateWingState({
                            boardroomScreenMode: 'agenda',
                            boardroomAgendaIndex:
                              (wingState.boardroomAgendaIndex + 1) %
                              BOARDROOM_STRATEGY_SLIDES.length,
                          })
                        }
                        className="rounded-lg border border-[#f4f1ea]/12 bg-[#0b1019] px-2 py-1 text-[10px] text-[#cbd5e1] hover:border-[#e5a93c]/50"
                      >
                        ⏭ Next Slide
                      </button>
                    </div>
                  )}

                  {dest.id === 'library' && (
                    <div className="mt-2.5 flex items-center gap-1.5">
                      <button
                        id="btn-library-toggle-fire"
                        type="button"
                        onClick={() =>
                          onUpdateWingState({
                            libraryFireLit: !wingState.libraryFireLit,
                          })
                        }
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] ${
                          wingState.libraryFireLit
                            ? 'border-[#fb923c]/50 bg-[#fb923c]/15 text-[#fed7aa]'
                            : 'border-[#f4f1ea]/12 bg-[#0b1019] text-[#94a3b8]'
                        }`}
                      >
                        <Flame className="h-3 w-3" />
                        <span>{wingState.libraryFireLit ? 'Fire Lit' : 'Fire Off'}</span>
                      </button>
                      <button
                        id="btn-library-toggle-crackle"
                        type="button"
                        onClick={() => setCrackleOn(fireplaceAudio.toggle())}
                        className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] ${
                          crackleOn
                            ? 'border-[#34d399]/50 bg-[#34d399]/15 text-[#a7f3d0]'
                            : 'border-[#f4f1ea]/12 bg-[#0b1019] text-[#94a3b8]'
                        }`}
                      >
                        {crackleOn ? (
                          <Volume2 className="h-3 w-3" />
                        ) : (
                          <VolumeX className="h-3 w-3" />
                        )}
                        <span>{crackleOn ? 'Crackle On' : 'Crackle Audio'}</span>
                      </button>
                    </div>
                  )}

                  {dest.id === 'outdoor-deck' && (
                    <div className="mt-2.5 flex flex-wrap gap-1">
                      {(
                        [
                          'golden-sunset',
                          'starlit-aurora',
                          'alpine-morning',
                        ] as OutdoorSkyPresetId[]
                      ).map((skyId) => {
                        const spec = OUTDOOR_SKY_PRESETS[skyId]
                        return (
                          <button
                            key={skyId}
                            id={`btn-deck-sky-${skyId}`}
                            type="button"
                            onClick={() =>
                              onUpdateWingState({ outdoorSkyPreset: skyId })
                            }
                            className={`rounded-lg px-2 py-0.5 text-[10px] font-medium ${
                              wingState.outdoorSkyPreset === skyId
                                ? 'bg-[#34d399] text-[#080a0d]'
                                : 'bg-[#0b1019] text-[#94a3b8] hover:text-[#f4f1ea]'
                            }`}
                          >
                            {spec.shortLabel}
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <div className="mt-3 flex items-center gap-1.5">
                    <button
                      id={`btn-walk-to-${dest.id}`}
                      type="button"
                      onClick={() => {
                        onJumpToDestination(dest)
                        onClose()
                      }}
                      className="flex-1 rounded-lg bg-[#1d283a] px-2.5 py-1.5 text-xs font-medium text-[#f4f1ea] transition hover:bg-[#283750]"
                    >
                      🚶 Walk In
                    </button>
                    {dest.id !== 'hallway' && (
                      <button
                        id={`btn-sit-in-${dest.id}`}
                        type="button"
                        onClick={() => {
                          const targetSeat = findOpenSeatInWing(
                            dest.id,
                            dest.defaultSeatId,
                          )
                          onSelectSeat(targetSeat)
                          onClose()
                        }}
                        className="flex-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#080a0d] transition hover:brightness-110"
                        style={{ backgroundColor: dest.accentColor }}
                      >
                        💺 Sit Here
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* COMMAND & CONTROL TELEMETRY + AUXILIARY SCREEN TAB */
        <div className="mt-3.5 grid gap-4 max-h-[64vh] overflow-y-auto pr-1 lg:grid-cols-12">
          {/* Left Column: Secondary Viewing Screen + Live Weather Radar */}
          <div className="space-y-3.5 lg:col-span-5">
            {/* Auxiliary Viewing Screen Controls */}
            <div className="rounded-xl border border-[#38bdf8]/25 bg-[#0e1625] p-3.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#38bdf8]">
                  <Tv className="h-3.5 w-3.5" />
                  Command Viewing Screen
                </span>
                <span className="font-mono text-[10px] text-[#94a3b8]">
                  SYNCED ROOM-WIDE
                </span>
              </div>

              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                <button
                  id="btn-cmd-mode-mirror"
                  type="button"
                  onClick={() =>
                    onUpdateWingState({ commandScreenMode: 'mirror-lounge' })
                  }
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    wingState.commandScreenMode === 'mirror-lounge'
                      ? 'bg-[#e5a93c] text-[#080a0d]'
                      : 'bg-[#162133] text-[#cbd5e1] hover:bg-[#1e2d45]'
                  }`}
                >
                  📺 Mirror Main Lounge
                </button>
                <button
                  id="btn-cmd-mode-ops"
                  type="button"
                  onClick={() =>
                    onUpdateWingState({ commandScreenMode: 'ops-stream' })
                  }
                  className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition ${
                    wingState.commandScreenMode === 'ops-stream'
                      ? 'bg-[#38bdf8] text-[#080a0d]'
                      : 'bg-[#162133] text-[#cbd5e1] hover:bg-[#1e2d45]'
                  }`}
                >
                  🛰 Independent Ops Stream
                </button>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5">
                {COMMAND_STREAM_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() =>
                      onUpdateWingState({
                        commandScreenMode: 'ops-stream',
                        commandStreamPresetId: preset.id,
                      })
                    }
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition ${
                      wingState.commandScreenMode === 'ops-stream' &&
                      wingState.commandStreamPresetId === preset.id
                        ? 'border border-[#38bdf8] bg-[#38bdf8]/20 text-[#7dd3fc]'
                        : 'bg-[#090f19] text-[#94a3b8] hover:text-[#f4f1ea]'
                    }`}
                  >
                    {preset.shortLabel}
                  </button>
                ))}
              </div>

              <form
                className="mt-2.5 flex gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!customStreamUrlDraft.trim()) return
                  onUpdateWingState({
                    commandScreenMode: 'ops-stream',
                    commandStreamPresetId: 'custom',
                    commandCustomStreamUrl: customStreamUrlDraft.trim(),
                    commandCustomStreamTitle:
                      customStreamTitleDraft.trim() || 'Custom Ops Feed',
                  })
                }}
              >
                <input
                  type="url"
                  value={customStreamUrlDraft}
                  onChange={(e) => setCustomStreamUrlDraft(e.target.value)}
                  placeholder="Custom .mp4 / .m3u8 stream URL…"
                  className="lounge-input flex-1 rounded-lg px-2.5 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-[#38bdf8] px-3 py-1.5 text-xs font-semibold text-[#080a0d] hover:bg-[#7dd3fc]"
                >
                  Load
                </button>
              </form>
            </div>

            {/* Live Weather Radar Controls */}
            <div className="rounded-xl border border-[#f4f1ea]/10 bg-[#0e1625] p-3.5">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#7dd3fc]">
                  <CloudSun className="h-3.5 w-3.5" />
                  Weather &amp; Forecast Telemetry
                </span>
                <button
                  type="button"
                  onClick={() => setRefreshNonce((n) => n + 1)}
                  className="text-[#94a3b8] hover:text-[#f4f1ea]"
                  title="Refresh weather & news telemetry"
                >
                  <RefreshCw
                    className={`h-3.5 w-3.5 ${weatherLoading ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-1">
                {COMMAND_WEATHER_CITIES.map((city) => (
                  <button
                    key={city.id}
                    id={`btn-cmd-weather-${city.id}`}
                    type="button"
                    onClick={() =>
                      onUpdateWingState({ commandWeatherCityId: city.id })
                    }
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold transition ${
                      wingState.commandWeatherCityId === city.id
                        ? 'bg-[#38bdf8] text-[#080a0d]'
                        : 'bg-[#090f19] text-[#94a3b8] hover:text-[#f4f1ea]'
                    }`}
                  >
                    {city.shortLabel}
                  </button>
                ))}
              </div>

              <form
                className="mt-2 flex gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (!customCityDraft.trim()) return
                  onUpdateWingState({
                    commandWeatherCityId: 'custom',
                    commandCustomCityQuery: customCityDraft.trim(),
                  })
                }}
              >
                <input
                  id="input-cmd-custom-city"
                  type="text"
                  value={customCityDraft}
                  onChange={(e) => setCustomCityDraft(e.target.value)}
                  placeholder="Search any city (e.g. Denver, Seattle, Paris)…"
                  className="lounge-input flex-1 rounded-lg px-2.5 py-1.5 text-xs"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-1 rounded-lg bg-[#1d2b42] px-2.5 py-1.5 text-xs font-medium text-[#f4f1ea] hover:bg-[#273a59]"
                >
                  <Search className="h-3.5 w-3.5" />
                </button>
              </form>

              {weather && (
                <div
                  id="cmd-weather-summary-card"
                  className="mt-2.5 rounded-lg bg-[#090f19] p-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-[#f8fafc]">
                        {weather.conditionIcon} {weather.cityName}
                      </p>
                      <p className="text-[11px] text-[#94a3b8]">
                        {weather.region} · {weather.conditionLabel}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono text-xl font-bold text-[#38bdf8]">
                        {weather.tempF}°F
                      </p>
                      <p className="text-[10px] text-[#94a3b8]">
                        {weather.tempC}°C · Wind {weather.windMph} mph
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Live News, Tech, Space & Markets Wire */}
          <div className="rounded-xl border border-[#f4f1ea]/10 bg-[#0e1625] p-3.5 lg:col-span-7">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#e5a93c]">
                <Newspaper className="h-3.5 w-3.5" />
                Live News, Space &amp; Markets Wire
              </span>

              <div className="flex items-center gap-1">
                {(
                  [
                    { id: 'top', label: 'World' },
                    { id: 'tech', label: 'Tech' },
                    { id: 'space', label: 'Space' },
                    { id: 'markets', label: 'Markets' },
                  ] as Array<{ id: CommandNewsCategoryId; label: string }>
                ).map((cat) => (
                  <button
                    key={cat.id}
                    id={`btn-cmd-news-${cat.id}`}
                    type="button"
                    onClick={() =>
                      onUpdateWingState({ commandNewsCategory: cat.id })
                    }
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                      wingState.commandNewsCategory === cat.id
                        ? 'bg-[#e5a93c] text-[#080a0d]'
                        : 'bg-[#090f19] text-[#94a3b8] hover:text-[#f4f1ea]'
                    }`}
                  >
                    {cat.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 space-y-2">
              {newsLoading && !news ? (
                <p className="py-6 text-center text-xs text-[#94a3b8]">
                  Fetching live global telemetry…
                </p>
              ) : (
                news?.items.slice(0, 6).map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-start justify-between gap-3 rounded-lg border border-[#f4f1ea]/6 bg-[#090f19] px-3 py-2 text-xs transition hover:border-[#38bdf8]/40 hover:bg-[#0d1626]"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug text-[#f8fafc]">
                        {item.title}
                      </p>
                      <p className="mt-0.5 text-[11px] text-[#94a3b8]">
                        {item.source} · {item.publishedAgo}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      {item.badge && (
                        <span
                          className="rounded px-1.5 py-0.5 font-mono text-[10px] font-semibold"
                          style={{
                            color: item.badgeColor ?? '#38BDF8',
                            backgroundColor: 'rgba(15, 23, 42, 0.9)',
                          }}
                        >
                          {item.badge}
                        </span>
                      )}
                      <ExternalLink className="h-3.5 w-3.5 text-[#64748b]" />
                    </div>
                  </a>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
