import { useEffect, useRef, useState } from 'react'
import { QUICK_REACTIONS } from '../../constants/cinema'
import { normalizePlayerKey } from '../../constants/barGames'
import {
  compressImageFileToDataUrl,
  getShareableMobileUrl,
} from '../../services/mobileMode'
import { SOUNDBOARD_EFFECTS } from '../../services/soundboardAudio'
import {
  SPORTS_LEAGUE_SPECS,
  fetchSportsScoreboard,
  type SportsScoreboardSnapshot,
} from '../../services/sportsScoreboard'
import type {
  ClubhousePersistentState,
  SoundboardEffectId,
} from '../../types/barGames'
import type {
  ChatMessage,
  FurnitureCatalogId,
  LoungeWingId,
  ParticipantProfile,
  PlacedFurnitureItem,
  PresenterState,
  RoomCustomizationState,
  SportsLeagueId,
} from '../../types/lounge'

export type MobilePocketTabId =
  | 'chat'
  | 'sports'
  | 'watchlist'
  | 'soundboard'
  | 'photos'

export interface MobileCompanionDashboardProps {
  roomCode: string
  connected: boolean
  localProfile: ParticipantProfile
  participants: ParticipantProfile[]
  presenterState: PresenterState
  messages: ChatMessage[]
  clubhouseState: ClubhousePersistentState
  roomCustomization: RoomCustomizationState
  activeLoungeWing: LoungeWingId
  isMuted: boolean
  cinemaVolume: number
  effectiveCinemaVolume: number
  onSwitchTo3DTouch: () => void
  onExitMobileMode: () => void
  onToggleMute: () => void
  onChangeCinemaVolume: (vol: number) => void
  onSendChat: (text: string) => void
  onSendReaction: (emoji: string) => void
  onJumpToWing: (wing: LoungeWingId) => void
  onCreateProp: (title: string, options: string[], stakeDollars?: number) => void
  onPickPropOption: (propId: string, optionIndex: number) => void
  onLockProp: (propId: string) => void
  onResolveProp: (propId: string, winningOptionIndex: number) => void
  onAddWatchlistItem: (title: string, url: string) => void
  onToggleWatchlistVote: (itemId: string) => void
  onRemoveWatchlistItem: (itemId: string) => void
  onLoadStreamUrl: (url: string, title?: string) => void
  onTriggerSoundboard: (effectId: SoundboardEffectId) => void
  onSpawnFurniture: (type: FurnitureCatalogId) => void
  onUpdateFurnitureItem: (id: string, patch: Partial<PlacedFurnitureItem>) => void
}

export function MobileCompanionDashboard({
  roomCode,
  connected,
  localProfile,
  participants,
  presenterState,
  messages,
  clubhouseState,
  roomCustomization,
  activeLoungeWing,
  isMuted,
  cinemaVolume,
  effectiveCinemaVolume,
  onSwitchTo3DTouch,
  onExitMobileMode,
  onToggleMute,
  onChangeCinemaVolume,
  onSendChat,
  onSendReaction,
  onJumpToWing,
  onCreateProp,
  onPickPropOption,
  onLockProp,
  onResolveProp,
  onAddWatchlistItem,
  onToggleWatchlistVote,
  onRemoveWatchlistItem,
  onLoadStreamUrl,
  onTriggerSoundboard,
  onSpawnFurniture,
  onUpdateFurnitureItem,
}: MobileCompanionDashboardProps) {
  const [activeTab, setActiveTab] = useState<MobilePocketTabId>('chat')
  const [chatText, setChatText] = useState('')
  const [copiedLink, setCopiedLink] = useState(false)

  // Sports & Wager state
  const [selectedLeague, setSelectedLeague] = useState<SportsLeagueId>('nfl')
  const [scoreboard, setScoreboard] = useState<SportsScoreboardSnapshot | null>(null)
  const [loadingScores, setLoadingScores] = useState(false)
  const [propTitle, setPropTitle] = useState('')
  const [propOptA, setPropOptA] = useState('')
  const [propOptB, setPropOptB] = useState('')
  const [propStake, setPropStake] = useState(1)

  // Watchlist form state
  const [watchTitle, setWatchTitle] = useState('')
  const [watchUrl, setWatchUrl] = useState('')

  // Photo upload state
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [targetFrameId, setTargetFrameId] = useState<string>('new')
  const [photoLabel, setPhotoLabel] = useState('')
  const [photoUploading, setPhotoUploading] = useState(false)
  const [photoStatus, setPhotoStatus] = useState<string | null>(null)

  const wallFrames = roomCustomization.furniture.filter(
    (item) => item.type === 'wall-poster',
  )

  useEffect(() => {
    if (activeTab !== 'sports') return
    let cancelled = false
    setLoadingScores(true)
    void fetchSportsScoreboard(selectedLeague)
      .then((snap) => {
        if (!cancelled) {
          setScoreboard(snap)
          setLoadingScores(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingScores(false)
      })
    return () => {
      cancelled = true
    }
  }, [activeTab, selectedLeague])

  const handleCopyLink = () => {
    const url = getShareableMobileUrl()
    void navigator.clipboard?.writeText(url).catch(() => undefined)
    setCopiedLink(true)
    window.setTimeout(() => setCopiedLink(false), 2000)
  }

  const handleSendChatSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = chatText.trim()
    if (!trimmed) return
    onSendChat(trimmed)
    setChatText('')
  }

  const handleCreatePropSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!propTitle.trim() || !propOptA.trim() || !propOptB.trim()) return
    onCreateProp(propTitle.trim(), [propOptA.trim(), propOptB.trim()], propStake)
    setPropTitle('')
    setPropOptA('')
    setPropOptB('')
  }

  const handleAddWatchlistSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!watchUrl.trim()) return
    onAddWatchlistItem(watchTitle.trim(), watchUrl.trim())
    setWatchTitle('')
    setWatchUrl('')
  }

  const handlePhotoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoUploading(true)
    setPhotoStatus(null)
    try {
      const dataUrl = await compressImageFileToDataUrl(file, 512, 0.72)
      const label =
        photoLabel.trim().slice(0, 28) ||
        `${localProfile.displayName}'s Photo`

      if (targetFrameId !== 'new' && wallFrames.some((f) => f.id === targetFrameId)) {
        onUpdateFurnitureItem(targetFrameId, {
          imageUrl: dataUrl,
          label,
        })
        setPhotoStatus(`✓ Updated wall frame "${label}" in the 3D Lounge!`)
      } else if (wallFrames.length > 0 && targetFrameId === 'new') {
        // Update the most recent wall frame if one was just spawned, or spawn a new wall-poster and update
        const target = wallFrames[wallFrames.length - 1]
        onUpdateFurnitureItem(target.id, {
          imageUrl: dataUrl,
          label,
        })
        setPhotoStatus(`✓ Mounted "${label}" onto Clubhouse Wall Frame!`)
      } else {
        onSpawnFurniture('wall-poster')
        window.setTimeout(() => {
          const latestFrames = roomCustomization.furniture.filter(
            (f) => f.type === 'wall-poster',
          )
          const newest = latestFrames[latestFrames.length - 1]
          if (newest) {
            onUpdateFurnitureItem(newest.id, {
              imageUrl: dataUrl,
              label,
            })
          }
        }, 120)
        setPhotoStatus(`✓ Spawned new Wall Frame with "${label}"!`)
      }
      onSendChat(`📸 Uploaded a new photo "${label}" to the Clubhouse Wall Frame!`)
    } catch (err) {
      setPhotoStatus(
        err instanceof Error ? err.message : 'Could not process selected photo.',
      )
    } finally {
      setPhotoUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const myUserKey = normalizePlayerKey(localProfile.displayName)
  const watchlist = clubhouseState.watchlist ?? []
  const ledgerEntries = Object.values(clubhouseState.ledger ?? {}).sort(
    (a, b) => b.netDollars - a.netDollars,
  )

  return (
    <div
      id="mobile-pocket-companion"
      className="fixed inset-0 z-50 flex flex-col bg-[#080b11] text-[#f4f1ea]"
    >
      {/* Top Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 bg-[#0d121c] px-3.5 py-2.5">
        <div className="flex items-center gap-2">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]" />
          <div>
            <div className="flex items-center gap-1.5 text-sm font-bold tracking-tight">
              <span>📱 VR Lounge Pocket</span>
              <span className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-[#e5a93c]">
                {roomCode}
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              {participants.length} online · 3D GPU Paused (Battery Saver)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            id="btn-pocket-to-3d-touch"
            type="button"
            onClick={onSwitchTo3DTouch}
            className="rounded-xl bg-[#e5a93c] px-3 py-1.5 text-xs font-bold text-[#090c10] shadow transition active:scale-95"
          >
            🎮 3D Touch View
          </button>
          <button
            id="btn-pocket-copy-link"
            type="button"
            onClick={handleCopyLink}
            className="rounded-xl border border-sky-400/35 bg-sky-500/15 px-2.5 py-1.5 text-xs font-semibold text-sky-200"
          >
            {copiedLink ? '✓ Copied' : '🔗 Share'}
          </button>
          <button
            id="btn-pocket-desktop-view"
            type="button"
            onClick={onExitMobileMode}
            title="Switch to full Desktop 3D UI"
            className="rounded-xl border border-white/15 bg-white/5 px-2 py-1.5 text-xs text-slate-300"
          >
            🖥
          </button>
        </div>
      </header>

      {/* Quick Audio & Active Stream Strip */}
      <div className="flex items-center justify-between gap-2 border-b border-white/10 bg-[#101725] px-3.5 py-2 text-xs">
        <div className="min-w-0 flex-1 truncate">
          <span className="font-semibold text-[#e5a93c]">
            {presenterState.screenMode === 'idle'
              ? '🎬 Big Screen Idle'
              : `📺 ${presenterState.mediaTitle}`}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            id="btn-pocket-mic-toggle"
            type="button"
            onClick={onToggleMute}
            className={`rounded-lg px-2.5 py-1 font-bold transition ${
              isMuted
                ? 'bg-red-500/25 text-red-200 border border-red-400/40'
                : 'bg-emerald-500/25 text-emerald-200 border border-emerald-400/40'
            }`}
          >
            {isMuted ? '🔇 Mic Off' : '🎙 Mic On'}
          </button>
          <button
            id="btn-pocket-stream-mute"
            type="button"
            onClick={() => onChangeCinemaVolume(cinemaVolume > 0 ? 0 : 0.8)}
            className="rounded-lg border border-white/15 bg-white/10 px-2.5 py-1 font-semibold text-slate-200"
          >
            {effectiveCinemaVolume > 0
              ? `🔊 TV ${Math.round(effectiveCinemaVolume * 100)}%`
              : '🔇 TV 0%'}
          </button>
        </div>
      </div>

      {/* Main Scrollable Tab Content */}
      <main className="flex-1 overflow-y-auto p-3.5">
        {/* TAB 1: CHAT, REACTIONS & ROOM ROSTER */}
        {activeTab === 'chat' && (
          <div className="flex h-full flex-col gap-3">
            {/* Room Presence & Quick Room Hop (for Audio Isolation / Quiet Library) */}
            <div className="rounded-2xl border border-white/10 bg-[#111723] p-3">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-slate-300">
                <span>👥 In the Lounge ({participants.length})</span>
                <span className="text-[11px] text-slate-400">
                  {connected ? '🟢 Connected' : '🟡 Syncing'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {participants.map((p) => (
                  <span
                    key={p.userId}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs"
                  >
                    <span
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: p.avatarColor }}
                    />
                    <span className="font-medium">{p.displayName}</span>
                    {p.inVR && (
                      <span className="rounded bg-amber-500/20 px-1 text-[10px] text-amber-300">
                        VR
                      </span>
                    )}
                  </span>
                ))}
              </div>

              {/* Zone Audio Isolation Quick Switch */}
              <div className="mt-2.5 flex items-center gap-1.5 overflow-x-auto pt-1">
                {(
                  [
                    { id: 'main-lounge', label: '🎬 Main Lounge' },
                    { id: 'library', label: '🔥 Quiet Library (Auto-Mute TV)' },
                    { id: 'game-room', label: '🕹 Game Room' },
                    { id: 'outdoor-deck', label: '🏔 Lake Deck' },
                  ] as const
                ).map((z) => (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => onJumpToWing(z.id)}
                    className={`shrink-0 rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                      activeLoungeWing === z.id
                        ? 'bg-[#e5a93c] text-[#090d14]'
                        : 'bg-white/5 text-slate-300'
                    }`}
                  >
                    {z.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Emoji Reaction Bar */}
            <div className="flex items-center justify-between gap-1.5 rounded-2xl border border-white/10 bg-[#111723] px-3 py-2">
              <span className="text-[11px] font-semibold text-slate-400">
                React:
              </span>
              <div className="flex items-center gap-1.5">
                {QUICK_REACTIONS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onSendReaction(emoji)}
                    className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/8 text-lg transition active:scale-90"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>

            {/* Chat Feed */}
            <div className="flex-1 space-y-2 overflow-y-auto rounded-2xl border border-white/10 bg-[#0c1018] p-3">
              {messages.length === 0 ? (
                <p className="py-8 text-center text-xs text-slate-500">
                  No messages yet — say hi or drop a reaction!
                </p>
              ) : (
                messages.slice(-40).map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-xl px-3 py-2 text-xs ${
                      msg.isSystem
                        ? 'border border-amber-400/20 bg-amber-500/10 text-amber-200'
                        : 'bg-white/5 text-slate-100'
                    }`}
                  >
                    {!msg.isSystem && (
                      <span
                        className="mr-1.5 font-bold"
                        style={{ color: msg.avatarColor }}
                      >
                        {msg.displayName}:
                      </span>
                    )}
                    <span>{msg.text}</span>
                  </div>
                ))
              )}
            </div>

            {/* Chat Input */}
            <form onSubmit={handleSendChatSubmit} className="flex gap-2">
              <input
                id="input-pocket-chat"
                type="text"
                value={chatText}
                onChange={(e) => setChatText(e.target.value)}
                placeholder="Message the VR Lounge..."
                className="flex-1 rounded-xl border border-white/15 bg-[#111723] px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:border-[#e5a93c] focus:outline-none"
              />
              <button
                type="submit"
                className="rounded-xl bg-[#e5a93c] px-4 py-2.5 text-sm font-bold text-[#090c10]"
              >
                Send
              </button>
            </form>
          </div>
        )}

        {/* TAB 2: LIVE ESPN SPORTS SCORES & PREDICTION CHALKBOARD WAGERS */}
        {activeTab === 'sports' && (
          <div className="space-y-4">
            {/* ESPN Live Scoreboard Section */}
            <div className="rounded-2xl border border-white/10 bg-[#111723] p-3.5">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="text-sm font-bold text-white">
                  🛰 Control Room Live US Sports
                </h3>
                <span className="text-[11px] text-emerald-400">
                  {loadingScores ? 'Refreshing...' : 'ESPN Live Feed'}
                </span>
              </div>

              <div className="mb-3 flex gap-1.5 overflow-x-auto pb-1">
                {SPORTS_LEAGUE_SPECS.map((lg) => (
                  <button
                    key={lg.id}
                    type="button"
                    onClick={() => setSelectedLeague(lg.id)}
                    className={`shrink-0 rounded-xl px-3 py-1.5 text-xs font-bold transition ${
                      selectedLeague === lg.id
                        ? 'bg-[#e5a93c] text-[#090c10]'
                        : 'bg-white/8 text-slate-300'
                    }`}
                  >
                    {lg.emoji} {lg.shortLabel}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(scoreboard?.games ?? []).slice(0, 6).map((gm) => (
                  <div
                    key={gm.id}
                    className="rounded-xl border border-white/10 bg-[#0b0f17] p-2.5 text-xs"
                  >
                    <div className="mb-1 flex items-center justify-between text-[10px] font-semibold text-amber-300">
                      <span>{gm.statusText}</span>
                      <span>{gm.broadcast}</span>
                    </div>
                    <div className="flex items-center justify-between font-bold">
                      <span>
                        {gm.awayTeam} · {gm.awayName}
                      </span>
                      <span className="text-sm text-white">{gm.awayScore}</span>
                    </div>
                    <div className="mt-0.5 flex items-center justify-between font-bold">
                      <span>
                        {gm.homeTeam} · {gm.homeName}
                      </span>
                      <span className="text-sm text-white">{gm.homeScore}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Prediction Chalkboard Wagers */}
            <div className="rounded-2xl border border-white/10 bg-[#111723] p-3.5">
              <h3 className="mb-2 text-sm font-bold text-white">
                📋 Prediction Chalkboard & Friendly Wagers
              </h3>

              <div className="space-y-2.5">
                {clubhouseState.props.map((prop) => {
                  const myPick = prop.picks.find((p) => p.userKey === myUserKey)
                  return (
                    <div
                      key={prop.id}
                      className="rounded-xl border border-white/10 bg-[#0b0f17] p-3 text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-white">{prop.title}</span>
                        <span className="rounded-md bg-emerald-500/20 px-2 py-0.5 font-mono text-[11px] font-bold text-emerald-300">
                          ${prop.stakeDollars} Stake · {prop.status.toUpperCase()}
                        </span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2">
                        {prop.options.map((opt, idx) => {
                          const picked = myPick?.optionIndex === idx
                          const isWinner =
                            prop.status === 'resolved' &&
                            prop.winningOptionIndex === idx
                          const count = prop.picks.filter(
                            (pk) => pk.optionIndex === idx,
                          ).length
                          return (
                            <button
                              key={opt}
                              type="button"
                              disabled={prop.status !== 'open'}
                              onClick={() => onPickPropOption(prop.id, idx)}
                              className={`rounded-xl border px-2.5 py-2 text-left font-semibold transition ${
                                isWinner
                                  ? 'border-emerald-400 bg-emerald-500/30 text-emerald-100'
                                  : picked
                                    ? 'border-[#e5a93c] bg-[#e5a93c]/25 text-amber-100'
                                    : 'border-white/10 bg-white/5 text-slate-200'
                              }`}
                            >
                              <div className="truncate">{opt}</div>
                              <div className="mt-0.5 text-[10px] text-slate-400">
                                {count} pick{count === 1 ? '' : 's'}
                                {picked ? ' · YOUR PICK' : ''}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                      {prop.status !== 'resolved' && (
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 pt-1 border-t border-white/10">
                          {prop.status === 'open' && (
                            <button
                              type="button"
                              onClick={() => onLockProp(prop.id)}
                              className="rounded-lg bg-amber-500/20 px-2 py-1 text-[10px] font-semibold text-amber-200"
                            >
                              🔒 Lock Picks
                            </button>
                          )}
                          {prop.options.map((opt, idx) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => onResolveProp(prop.id, idx)}
                              className="rounded-lg bg-emerald-500/20 px-2 py-1 text-[10px] font-semibold text-emerald-200"
                            >
                              🏆 Settle: {opt}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Post a New Prop Form */}
              <form
                onSubmit={handleCreatePropSubmit}
                className="mt-3 space-y-2 border-t border-white/10 pt-3"
              >
                <div className="text-xs font-semibold text-slate-300">
                  + Post New Chalkboard Prop
                </div>
                <input
                  type="text"
                  value={propTitle}
                  onChange={(e) => setPropTitle(e.target.value)}
                  placeholder="Prop question (e.g., Next TD Scorer / Darts Winner)"
                  className="w-full rounded-xl border border-white/15 bg-[#0b0f17] px-3 py-2 text-xs text-white"
                />
                <div className="grid grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={propOptA}
                    onChange={(e) => setPropOptA(e.target.value)}
                    placeholder="Option A"
                    className="rounded-xl border border-white/15 bg-[#0b0f17] px-2.5 py-2 text-xs text-white"
                  />
                  <input
                    type="text"
                    value={propOptB}
                    onChange={(e) => setPropOptB(e.target.value)}
                    placeholder="Option B"
                    className="rounded-xl border border-white/15 bg-[#0b0f17] px-2.5 py-2 text-xs text-white"
                  />
                  <select
                    value={propStake}
                    onChange={(e) => setPropStake(Number(e.target.value))}
                    className="rounded-xl border border-white/15 bg-[#0b0f17] px-2.5 py-2 text-xs text-white"
                  >
                    <option value={1}>$1 Stake</option>
                    <option value={5}>$5 Stake</option>
                    <option value={10}>$10 Stake</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#e5a93c] py-2 text-xs font-bold text-[#090c10]"
                >
                  Post Prop to Lounge Chalkboard
                </button>
              </form>

              {/* Clubhouse Ledger Standings */}
              {ledgerEntries.length > 0 && (
                <div className="mt-3 border-t border-white/10 pt-3">
                  <div className="mb-1.5 text-xs font-semibold text-slate-300">
                    💰 Clubhouse Wager Ledger
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {ledgerEntries.map((entry) => (
                      <span
                        key={entry.key}
                        className="rounded-lg border border-white/10 bg-white/5 px-2.5 py-1 text-xs"
                      >
                        <strong className="text-white">{entry.displayName}:</strong>{' '}
                        <span
                          className={
                            entry.netDollars >= 0
                              ? 'text-emerald-400 font-bold'
                              : 'text-red-400 font-bold'
                          }
                        >
                          {entry.netDollars >= 0
                            ? `+$${entry.netDollars}`
                            : `-$${Math.abs(entry.netDollars)}`}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 3: SHARED WATCHLIST & UP-NEXT VOTING */}
        {activeTab === 'watchlist' && (
          <div className="space-y-4">
            <div className="rounded-2xl border border-white/10 bg-[#111723] p-3.5">
              <h3 className="mb-1 text-sm font-bold text-white">
                📺 Shared Lounge Watchlist & Upvote Queue
              </h3>
              <p className="mb-3 text-xs text-slate-400">
                Vote on what plays next or launch any queued stream onto the Main Screen.
              </p>

              <div className="space-y-2">
                {watchlist.map((item) => {
                  const voted = item.votes.includes(myUserKey)
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-xl border border-white/10 bg-[#0b0f17] p-3 text-xs"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-bold text-white">
                          {item.title}
                        </div>
                        <div className="mt-0.5 truncate text-[10px] text-slate-400">
                          Added by {item.addedBy}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => onToggleWatchlistVote(item.id)}
                          className={`rounded-xl border px-2.5 py-1.5 font-bold transition ${
                            voted
                              ? 'border-[#e5a93c] bg-[#e5a93c]/25 text-amber-200'
                              : 'border-white/15 bg-white/5 text-slate-200'
                          }`}
                        >
                          ▲ {item.votes.length}
                        </button>
                        <button
                          type="button"
                          onClick={() => onLoadStreamUrl(item.url, item.title)}
                          className="rounded-xl bg-emerald-500/25 border border-emerald-400/40 px-2.5 py-1.5 font-bold text-emerald-200"
                        >
                          ▶ Play
                        </button>
                        <button
                          type="button"
                          onClick={() => onRemoveWatchlistItem(item.id)}
                          className="rounded-xl bg-white/5 px-2 py-1.5 text-slate-400"
                        >
                          ✕
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <form
                onSubmit={handleAddWatchlistSubmit}
                className="mt-3 space-y-2 border-t border-white/10 pt-3"
              >
                <div className="text-xs font-semibold text-slate-300">
                  + Add Video / Stream URL to Watchlist
                </div>
                <input
                  type="text"
                  value={watchTitle}
                  onChange={(e) => setWatchTitle(e.target.value)}
                  placeholder="Video Title (optional)"
                  className="w-full rounded-xl border border-white/15 bg-[#0b0f17] px-3 py-2 text-xs text-white"
                />
                <input
                  type="url"
                  value={watchUrl}
                  onChange={(e) => setWatchUrl(e.target.value)}
                  placeholder="https://... (YouTube, MP4, or HLS .m3u8)"
                  className="w-full rounded-xl border border-white/15 bg-[#0b0f17] px-3 py-2 text-xs text-white"
                />
                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#e5a93c] py-2 text-xs font-bold text-[#090c10]"
                >
                  Queue on Watchlist
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 4: LIVE CLUBHOUSE SOUNDBOARD FX */}
        {activeTab === 'soundboard' && (
          <div className="rounded-2xl border border-white/10 bg-[#111723] p-3.5">
            <h3 className="mb-1 text-sm font-bold text-white">
              🔊 Live Clubhouse Soundboard FX
            </h3>
            <p className="mb-3 text-xs text-slate-400">
              Tap any pad to trigger synthesized Web Audio stingers & floating reactions across the whole room!
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              {SOUNDBOARD_EFFECTS.map((fx) => (
                <button
                  key={fx.id}
                  id={`btn-soundboard-${fx.id}`}
                  type="button"
                  onClick={() => {
                    onTriggerSoundboard(fx.id)
                    onSendReaction(fx.reactionEmoji)
                  }}
                  className="flex flex-col items-start gap-1 rounded-2xl border border-white/15 bg-[#0b0f17] p-3.5 text-left shadow-lg transition active:scale-95"
                >
                  <span className="text-2xl">{fx.emoji}</span>
                  <span className="text-xs font-bold text-white">{fx.label}</span>
                  <span className="text-[10px] text-slate-400">
                    {fx.description}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* TAB 5: CAMERA ROLL PHOTO -> 3D WALL FRAME UPLOAD */}
        {activeTab === 'photos' && (
          <div className="rounded-2xl border border-white/10 bg-[#111723] p-3.5">
            <h3 className="mb-1 text-sm font-bold text-white">
              📸 Phone Camera Roll → 3D Clubhouse Wall Frames
            </h3>
            <p className="mb-3 text-xs text-slate-400">
              Snap or choose a photo from your phone to hang directly on the 3D VR Lounge walls for everyone to see.
            </p>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Target Wall Frame
                </label>
                <select
                  value={targetFrameId}
                  onChange={(e) => setTargetFrameId(e.target.value)}
                  className="w-full rounded-xl border border-white/15 bg-[#0b0f17] px-3 py-2 text-xs text-white"
                >
                  <option value="new">
                    {wallFrames.length > 0
                      ? '✨ Update Latest Wall Frame / Spawn New'
                      : '✨ Spawn New Framed Wall Poster'}
                  </option>
                  {wallFrames.map((frame, idx) => (
                    <option key={frame.id} value={frame.id}>
                      🖼 Wall Frame #{idx + 1}: {frame.label || 'Poster'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-300">
                  Frame Caption / Title (Optional)
                </label>
                <input
                  type="text"
                  value={photoLabel}
                  onChange={(e) => setPhotoLabel(e.target.value)}
                  placeholder={`${localProfile.displayName}'s Photo`}
                  className="w-full rounded-xl border border-white/15 bg-[#0b0f17] px-3 py-2 text-xs text-white"
                />
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoFileChange}
                className="hidden"
              />

              <button
                id="btn-upload-camera-roll-photo"
                type="button"
                disabled={photoUploading}
                onClick={() => fileInputRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#e5a93c] py-3 text-sm font-bold text-[#090c10] shadow-lg transition active:scale-95 disabled:opacity-50"
              >
                <span>
                  {photoUploading
                    ? '⏳ Compressing & Mounting Photo...'
                    : '📷 Choose Photo / Take Picture'}
                </span>
              </button>

              {photoStatus && (
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/15 px-3 py-2 text-xs text-emerald-200">
                  {photoStatus}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bottom 5-Tab Touch Navigation Bar */}
      <nav className="grid grid-cols-5 border-t border-white/10 bg-[#0d121c] px-1.5 py-1.5">
        {(
          [
            { id: 'chat', icon: '💬', label: 'Chat' },
            { id: 'sports', icon: '🏈', label: 'Scores' },
            { id: 'watchlist', icon: '📺', label: 'Queue' },
            { id: 'soundboard', icon: '🔊', label: 'FX Pad' },
            { id: 'photos', icon: '📸', label: 'Frames' },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              id={`tab-pocket-${tab.id}`}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center justify-center rounded-xl py-1.5 text-[11px] font-semibold transition ${
                active
                  ? 'bg-[#e5a93c]/20 text-[#e5a93c]'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <span className="text-base">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          )
        })}
      </nav>
    </div>
  )
}
