import {
  Check,
  Copy,
  Crown,
  Dices,
  Footprints,
  Glasses,
  Globe,
  Hammer,
  Headphones,
  Link2,
  Lock,
  LogOut,
  MessageSquare,
  Mic,
  MicOff,
  MonitorUp,
  Pause,
  Play,
  Radio,
  RotateCcw,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  Sparkles,
  Tv,
  Unlock,
  User,
  Users,
  Volume2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  DEFAULT_AVATAR_CUSTOMIZATION,
  loadSavedAvatarPreferences,
  resolveAvatarCustomization,
} from '../../constants/avatars'
import {
  AVATAR_COLORS,
  AVATAR_STYLES,
  QUICK_REACTIONS,
  SAMPLE_MEDIA_PRESETS,
  generateRoomCode,
} from '../../constants/cinema'
import { FREE_ROAM_SEAT_ID } from '../../constants/hangout'
import type { JoinRoomOptions } from '../../hooks/useRoomSession'
import {
  fetchYouTubeCategory,
  formatCompactViews,
  formatVideoDurationBadge,
  getCustomYouTubeInstance,
  resetInstanceCooldowns,
  searchYouTubeVideos,
  setCustomYouTubeInstance,
  type YouTubeCategory,
  type YouTubeVideoItem,
} from '../../services/youtube'
import {
  getVRSupportKind,
  subscribeVRSupport,
  triggerEnterVRFromGesture,
  type VRSupportKind,
} from '../../store/xrStore'
import type {
  AvatarCustomization,
  AvatarStyleId,
  ChatMessage,
  ComputedSeat,
  FurnitureCatalogId,
  LightingPresetId,
  ParticipantProfile,
  PlacedFurnitureItem,
  PresenterState,
  RoomArchitectureConfig,
  RoomCustomizationState,
  RoomLightingConfig,
  RoomScreenTransform,
  TransportMode,
} from '../../types/lounge'
import { AvatarCustomizerControls } from './AvatarCustomizerControls'
import { BuildCatalogDrawer } from './BuildCatalogDrawer'

function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0:00'
  const s = Math.floor(sec)
  const mins = Math.floor(s / 60)
  const rem = s % 60
  return `${mins}:${rem.toString().padStart(2, '0')}`
}

export interface CompanionOverlayProps {
  joined: boolean
  connected: boolean
  inVRSession: boolean
  roomCode: string
  transportMode: TransportMode
  localProfile: ParticipantProfile
  participants: ParticipantProfile[]
  computedSeats: ComputedSeat[]
  roomCustomization: RoomCustomizationState
  buildMode: boolean
  selectedFurnitureId: string | null
  passcodeEnabled: boolean
  presenterState: PresenterState
  isLocalPresenter: boolean
  canTakeControl: boolean
  messages: ChatMessage[]
  audioInputs: MediaDeviceInfo[]
  audioOutputs: MediaDeviceInfo[]
  selectedMicId: string
  selectedSpeakerId: string
  micPermissionError: string | null
  localMicLevel: number
  isSharingTab: boolean
  cinemaVolume: number
  voiceVolume: number
  localCurrentTime: number
  localDuration: number
  mediaError: string | null
  needsAudioUnlock: boolean
  statusBanner: string | null
  onDismissBanner: () => void
  onLockPasscode: () => void
  onSelectMic: (id: string) => void
  onSelectSpeaker: (id: string) => void
  onJoinRoom: (
    opts: JoinRoomOptions,
    vrAttemptPromise: Promise<{ ok: boolean; usedEmulator: boolean; error?: string }> | null,
  ) => Promise<void>
  onEnterVR: (
    vrAttemptPromise: Promise<{ ok: boolean; usedEmulator: boolean; error?: string }>,
  ) => Promise<void>
  onLeaveRoom: () => Promise<void>
  onToggleMute: () => void
  onSelectSeat: (seatIdOrIndex: string | number) => void
  onRecenterSeat: () => void
  onToggleBuildMode: (enabled: boolean) => void
  onSelectFurniture: (id: string | null) => void
  onSpawnFurniture: (type: FurnitureCatalogId) => void
  onUpdateFurnitureItem: (id: string, patch: Partial<PlacedFurnitureItem>) => void
  onDuplicateFurnitureItem: (id: string) => void
  onDeleteFurnitureItem: (id: string) => void
  onUpdateArchitecture: (patch: Partial<RoomArchitectureConfig>) => void
  onUpdateLighting: (patch: Partial<RoomLightingConfig>) => void
  onApplyLightingPreset: (preset: LightingPresetId) => void
  onUpdateScreen: (patch: Partial<RoomScreenTransform>) => void
  onResetRoom: () => void
  onImportBlueprintJson: (jsonText: string) => boolean
  onTakeControl: () => void
  onReleaseControl: () => void
  onToggleHostLock: () => void
  onStartTabShare: () => Promise<void>
  onStopTabShare: () => void
  onLoadStreamUrl: (url: string, title: string, useCorsProxy: boolean) => void
  onTogglePlayPause: () => void
  onSeekTo: (timeSeconds: number) => void
  onChangeCinemaVolume: (vol: number) => void
  onChangeVoiceVolume: (vol: number) => void
  onUnlockAudio: () => void
  onSendChat: (text: string) => void
  onSendReaction: (emoji: string) => void
  barGamesOpen?: boolean
  onToggleBarGames?: () => void
  wardrobeOpen?: boolean
  onToggleWardrobe?: (open?: boolean) => void
}

export function CompanionOverlay({
  joined,
  connected,
  inVRSession,
  roomCode,
  transportMode,
  localProfile,
  participants,
  computedSeats,
  roomCustomization,
  buildMode,
  selectedFurnitureId,
  passcodeEnabled,
  presenterState,
  isLocalPresenter,
  canTakeControl,
  messages,
  audioInputs,
  audioOutputs,
  selectedMicId,
  selectedSpeakerId,
  micPermissionError,
  localMicLevel,
  isSharingTab,
  cinemaVolume,
  voiceVolume,
  localCurrentTime,
  localDuration,
  mediaError,
  needsAudioUnlock,
  statusBanner,
  onDismissBanner,
  onLockPasscode,
  onSelectMic,
  onSelectSpeaker,
  onJoinRoom,
  onEnterVR,
  onLeaveRoom,
  onToggleMute,
  onSelectSeat,
  onRecenterSeat,
  onToggleBuildMode,
  onSelectFurniture,
  onSpawnFurniture,
  onUpdateFurnitureItem,
  onDuplicateFurnitureItem,
  onDeleteFurnitureItem,
  onUpdateArchitecture,
  onUpdateLighting,
  onApplyLightingPreset,
  onUpdateScreen,
  onResetRoom,
  onImportBlueprintJson,
  onTakeControl,
  onReleaseControl,
  onToggleHostLock,
  onStartTabShare,
  onStopTabShare,
  onLoadStreamUrl,
  onTogglePlayPause,
  onSeekTo,
  onChangeCinemaVolume,
  onChangeVoiceVolume,
  onUnlockAudio,
  onSendChat,
  onSendReaction,
  barGamesOpen = false,
  onToggleBarGames,
  wardrobeOpen = false,
  onToggleWardrobe,
}: CompanionOverlayProps) {
  // Pre-join lobby form state hydrated from saved avatar preferences
  const [savedAvatarPrefs] = useState(() => loadSavedAvatarPreferences())
  const [displayName, setDisplayName] = useState(() => {
    const saved =
      savedAvatarPrefs?.displayName || window.localStorage.getItem('vr-lounge:name')
    return saved || `Viewer ${Math.floor(100 + Math.random() * 899)}`
  })
  const [lobbyRoomCode, setLobbyRoomCode] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    return params.get('room')?.toUpperCase() || 'CINEMA-1'
  })
  const [avatarColor, setAvatarColor] = useState<string>(
    savedAvatarPrefs?.avatarColor ?? AVATAR_COLORS[0].hex,
  )
  const [avatarStyle, setAvatarStyle] = useState<AvatarStyleId>(
    savedAvatarPrefs?.avatarStyle ?? AVATAR_STYLES[0].id,
  )
  const [avatarCustomization, setAvatarCustomization] = useState<AvatarCustomization>(
    () =>
      resolveAvatarCustomization(
        savedAvatarPrefs?.avatarCustomization ?? DEFAULT_AVATAR_CUSTOMIZATION,
      ),
  )
  const [startMuted, setStartMuted] = useState(false)
  const [joining, setJoining] = useState(false)

  // In-room companion drawers
  const [urlDrawerOpen, setUrlDrawerOpen] = useState(false)
  const [buildDrawerOpen, setBuildDrawerOpen] = useState(false)
  const [drawerTab, setDrawerTab] = useState<'youtube' | 'direct'>('youtube')
  const [ytCategory, setYtCategory] = useState<YouTubeCategory>('trending')
  const [ytQuery, setYtQuery] = useState('')
  const [ytSubmittedQuery, setYtSubmittedQuery] = useState('')
  const [ytItems, setYtItems] = useState<YouTubeVideoItem[]>([])
  const [ytProvider, setYtProvider] = useState('')
  const [ytNotice, setYtNotice] = useState<string | null>(null)
  const [ytLoading, setYtLoading] = useState(false)
  const [ytRefreshNonce, setYtRefreshNonce] = useState(0)
  const [customRelayInput, setCustomRelayInput] = useState(() =>
    getCustomYouTubeInstance(),
  )
  const [showRelayInput, setShowRelayInput] = useState(false)
  const [chatDrawerOpen, setChatDrawerOpen] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [audioPopoverOpen, setAudioPopoverOpen] = useState(false)
  const [urlInput, setUrlInput] = useState(presenterState.mediaUrl)
  const [urlTitleInput, setUrlTitleInput] = useState(presenterState.mediaTitle)
  const [useCorsProxy, setUseCorsProxy] = useState(presenterState.useCorsProxy)
  const [chatDraft, setChatDraft] = useState('')
  const [copiedCode, setCopiedCode] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const lastSeenMsgCountRef = useRef(0)
  const chatScrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setUrlInput(presenterState.mediaUrl)
    setUrlTitleInput(presenterState.mediaTitle)
    setUseCorsProxy(presenterState.useCorsProxy)
  }, [presenterState.mediaTitle, presenterState.mediaUrl, presenterState.useCorsProxy])

  useEffect(() => {
    if (!urlDrawerOpen || drawerTab !== 'youtube') return
    let cancelled = false
    setYtLoading(true)
    setYtNotice(null)

    const load = async () => {
      try {
        const res = ytSubmittedQuery.trim()
          ? await searchYouTubeVideos(ytSubmittedQuery.trim())
          : await fetchYouTubeCategory(ytCategory)
        if (cancelled) return
        setYtItems(res.items)
        setYtProvider(res.provider)
        setYtNotice(res.notice ?? null)
      } catch (err) {
        if (!cancelled) {
          setYtNotice(
            err instanceof Error ? err.message : 'Unable to fetch YouTube feed.',
          )
        }
      } finally {
        if (!cancelled) setYtLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [drawerTab, urlDrawerOpen, ytCategory, ytRefreshNonce, ytSubmittedQuery])

  useEffect(() => {
    if (chatDrawerOpen) {
      lastSeenMsgCountRef.current = messages.length
      setUnreadCount(0)
      if (chatScrollRef.current) {
        chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight
      }
    } else if (messages.length > lastSeenMsgCountRef.current) {
      setUnreadCount(messages.length - lastSeenMsgCountRef.current)
    }
  }, [chatDrawerOpen, messages.length])

  const [vrSupportKind, setVrSupportKind] = useState<VRSupportKind>(() =>
    getVRSupportKind(),
  )

  useEffect(() => {
    return subscribeVRSupport(setVrSupportKind)
  }, [])

  // Hide 2D DOM UI while immersed in native headset VR (keep accessible exit hint handled in App)
  if (inVRSession) {
    return null
  }

  const handleLobbySubmit = async (
    enterVRImmediately: boolean,
    prestartedVRPromise: Promise<{
      ok: boolean
      usedEmulator: boolean
      error?: string
    }> | null = null,
  ) => {
    if (joining) return
    setJoining(true)
    try {
      const cleanName = displayName.trim() || 'Cinema Guest'
      window.localStorage.setItem('vr-lounge:name', cleanName)
      const normalizedRoom = lobbyRoomCode.trim().toUpperCase() || 'CINEMA-1'

      // Update shareable URL query parameter without reloading
      const nextUrl = new URL(window.location.href)
      nextUrl.searchParams.set('room', normalizedRoom)
      window.history.replaceState({}, '', nextUrl.toString())

      await onJoinRoom(
        {
          roomCode: normalizedRoom,
          displayName: cleanName,
          avatarColor,
          avatarStyle,
          avatarCustomization,
          inVR: enterVRImmediately,
          isMuted: startMuted,
        },
        prestartedVRPromise,
      )
    } finally {
      setJoining(false)
    }
  }

  const handleCopyInvite = async () => {
    const shareUrl = new URL(window.location.href)
    shareUrl.searchParams.set('room', joined ? roomCode : lobbyRoomCode)
    try {
      await navigator.clipboard.writeText(shareUrl.toString())
      setCopiedCode(true)
      window.setTimeout(() => setCopiedCode(false), 2000)
    } catch {
      // Clipboard fallback ignored
    }
  }

  // =========================================================================
  // STAGE 1: PRE-JOIN 2D LOBBY OVERLAY
  // =========================================================================
  if (!joined) {
    return (
      <main
        id="vr-lounge-lobby"
        className="pointer-events-auto fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-gradient-to-b from-[#080a0d]/80 via-[#080a0d]/68 to-[#080a0d]/88 p-4 sm:p-6"
      >
        <div className="lounge-panel w-full max-w-4xl rounded-2xl p-6 sm:p-8">
          {/* Top Header */}
          <div className="flex flex-col gap-4 border-b border-[#f4f1ea]/10 pb-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <div className="flex items-center gap-2.5">
                <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#e5a93c]">
                  Private WebXR Hangout &amp; Cinema
                </p>
                <span
                  id="vr-lounge-version-badge"
                  className="rounded-md border border-[#e5a93c]/35 bg-[#e5a93c]/12 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#e5a93c]"
                >
                  v2.0
                </span>
              </div>
              <h1
                className="mt-1.5 text-3xl font-semibold tracking-tight text-[#f4f1ea] sm:text-4xl"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                VR Lounge
              </h1>
              <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-[#c7c2b8]">
                Step into your customizable 3D hangout from Meta Quest 3 or desktop. Decorate
                the room together, hop onto any couch or barstool, talk with spatial voice, and
                watch YouTube or live browser tabs.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start">
              <div className="flex items-center gap-2.5 rounded-xl border border-[#f4f1ea]/10 bg-[#080a0d]/70 px-3.5 py-2 text-xs">
                <span
                  className={`h-2 w-2 rounded-full ${
                    transportMode === 'supabase' || transportMode === 'cloud-relay'
                      ? 'bg-[#49b384]'
                      : 'bg-[#e5a93c]'
                  }`}
                />
                <span className="font-medium text-[#f4f1ea]">
                  {transportMode === 'supabase'
                    ? 'Supabase Realtime Ready'
                    : 'Global Cloud Rooms Ready'}
                </span>
              </div>

              {passcodeEnabled && (
                <button
                  id="btn-lock-passcode-device"
                  type="button"
                  onClick={onLockPasscode}
                  title="Lock this device behind the secret passcode again"
                  className="flex items-center gap-1.5 rounded-xl border border-[#f4f1ea]/10 bg-[#080a0d]/70 px-3 py-2 text-xs text-[#c7c2b8] transition hover:border-[#e5a93c]/50 hover:text-[#f4f1ea]"
                >
                  <Lock className="h-3.5 w-3.5 text-[#e5a93c]" />
                  <span>Lock</span>
                </button>
              )}
            </div>
          </div>

          {statusBanner && (
            <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[#e5a93c]/40 bg-[#e5a93c]/10 px-4 py-2.5 text-xs text-[#f4f1ea]">
              <span>{statusBanner}</span>
              <button
                id="btn-dismiss-lobby-banner"
                type="button"
                onClick={onDismissBanner}
                className="text-[#c7c2b8] hover:text-[#f4f1ea]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Two-Column Lobby Configuration */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Left Column: Identity & Avatar Customization */}
            <section className="space-y-5 lg:col-span-7">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="input-display-name"
                    className="block text-xs font-medium uppercase tracking-wider text-[#c7c2b8]"
                  >
                    Display Name
                  </label>
                  <input
                    id="input-display-name"
                    type="text"
                    maxLength={24}
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Your name in 3D"
                    className="lounge-input mt-1.5 w-full rounded-xl px-3.5 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="input-room-code"
                    className="block text-xs font-medium uppercase tracking-wider text-[#c7c2b8]"
                  >
                    Room Code
                  </label>
                  <div className="mt-1.5 flex gap-2">
                    <input
                      id="input-room-code"
                      type="text"
                      maxLength={14}
                      value={lobbyRoomCode}
                      onChange={(e) => setLobbyRoomCode(e.target.value.toUpperCase())}
                      placeholder="CINEMA-1"
                      className="lounge-input w-full rounded-xl px-3.5 py-2.5 font-mono text-sm uppercase tracking-wider"
                    />
                    <button
                      id="btn-generate-room-code"
                      type="button"
                      title="Generate a fresh Room Code"
                      onClick={() => setLobbyRoomCode(generateRoomCode())}
                      className="flex shrink-0 items-center justify-center rounded-xl border border-[#f4f1ea]/12 bg-[#141922] px-3 text-[#c7c2b8] transition hover:border-[#e5a93c]/50 hover:text-[#f4f1ea]"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      id="btn-copy-lobby-invite"
                      type="button"
                      title="Copy invite URL"
                      onClick={() => void handleCopyInvite()}
                      className="flex shrink-0 items-center justify-center rounded-xl border border-[#f4f1ea]/12 bg-[#141922] px-3 text-[#c7c2b8] transition hover:border-[#e5a93c]/50 hover:text-[#f4f1ea]"
                    >
                      {copiedCode ? (
                        <Check className="h-4 w-4 text-[#49b384]" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {/* Modular Avatar Studio (Presets, Head & Face, Hat & Outfit, Colors & Flair) */}
              <AvatarCustomizerControls
                idPrefix="lobby"
                avatarColor={avatarColor}
                avatarStyle={avatarStyle}
                customization={avatarCustomization}
                flairPreviewName={displayName}
                compact
                onChange={(patch) => {
                  if (patch.avatarColor) setAvatarColor(patch.avatarColor)
                  if (patch.avatarStyle) setAvatarStyle(patch.avatarStyle)
                  if (patch.avatarCustomization) {
                    setAvatarCustomization((prev) =>
                      resolveAvatarCustomization({
                        ...prev,
                        ...patch.avatarCustomization,
                      }),
                    )
                  }
                }}
              />
            </section>

            {/* Right Column: Audio Devices & Entry Actions */}
            <section className="flex flex-col justify-between rounded-xl border border-[#f4f1ea]/10 bg-[#080a0d]/65 p-5 lg:col-span-5">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium uppercase tracking-wider text-[#c7c2b8]">
                    Spatial Voice &amp; Audio
                  </span>
                  <button
                    id="btn-lobby-toggle-mute"
                    type="button"
                    onClick={() => setStartMuted((m) => !m)}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                      startMuted
                        ? 'bg-[#e05a47]/20 text-[#e05a47]'
                        : 'bg-[#49b384]/20 text-[#49b384]'
                    }`}
                  >
                    {startMuted ? (
                      <>
                        <MicOff className="h-3.5 w-3.5" /> Join Muted
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5" /> Mic Enabled
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <label
                    htmlFor="select-lobby-mic"
                    className="block text-xs text-[#8a867e]"
                  >
                    Microphone Input
                  </label>
                  <select
                    id="select-lobby-mic"
                    value={selectedMicId}
                    onChange={(e) => onSelectMic(e.target.value)}
                    className="lounge-input mt-1 w-full rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="">System Default Microphone</option>
                    {audioInputs.map((mic, i) => (
                      <option key={mic.deviceId || i} value={mic.deviceId}>
                        {mic.label || `Microphone ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="select-lobby-speaker"
                    className="block text-xs text-[#8a867e]"
                  >
                    Audio Output Device
                  </label>
                  <select
                    id="select-lobby-speaker"
                    value={selectedSpeakerId}
                    onChange={(e) => onSelectSpeaker(e.target.value)}
                    className="lounge-input mt-1 w-full rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="">System Default Speakers / Headset</option>
                    {audioOutputs.map((spk, i) => (
                      <option key={spk.deviceId || i} value={spk.deviceId}>
                        {spk.label || `Speaker ${i + 1}`}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="rounded-lg border border-[#f4f1ea]/8 bg-[#0d1118] p-3 text-xs leading-relaxed text-[#8a867e]">
                  <strong className="font-medium text-[#c7c2b8]">
                    PC-Free YouTube in VR:
                  </strong>{' '}
                  Tap <span className="text-[#f4f1ea]">▶ YouTube</span> right inside your
                  Quest 3 3D dock to search and watch together without a PC — or join in{' '}
                  <span className="text-[#f4f1ea]">Companion Mode</span> to stream Netflix/DRM
                  tabs.
                </div>
              </div>

              {/* Dual Primary Entry Buttons */}
              <div className="mt-6 space-y-2.5">
                <button
                  id="btn-enter-vr"
                  type="button"
                  disabled={joining}
                  onClick={() => {
                    if (joining) return
                    const vrPromise = triggerEnterVRFromGesture()
                    void handleLobbySubmit(true, vrPromise)
                  }}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#e5a93c] px-4 py-3 text-sm font-semibold text-[#080a0d] shadow-lg transition hover:bg-[#f2be5c] active:scale-[0.99] disabled:opacity-60"
                >
                  <Glasses className="h-4 w-4" />
                  <span>
                    {vrSupportKind === 'native'
                      ? 'Enter VR (Quest 3 / WebXR)'
                      : 'Enter VR (Quest 3 / Simulator)'}
                  </span>
                </button>

                <button
                  id="btn-join-desktop"
                  type="button"
                  disabled={joining}
                  onClick={() => void handleLobbySubmit(false)}
                  className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-[#f4f1ea]/16 bg-[#151b26] px-4 py-3 text-sm font-medium text-[#f4f1ea] transition hover:border-[#e5a93c]/50 hover:bg-[#1c2433] active:scale-[0.99] disabled:opacity-60"
                >
                  <MonitorUp className="h-4 w-4 text-[#e5a93c]" />
                  <span>Join in Desktop / Companion Presenter Mode</span>
                </button>
              </div>
            </section>
          </div>
        </div>
      </main>
    )
  }

  // =========================================================================
  // STAGE 2: IN-ROOM 2D COMPANION PRESENTER HUD
  // =========================================================================
  return (
    <div className="pointer-events-none fixed inset-0 z-20 flex flex-col justify-between p-3 sm:p-4">
      {/* Top Status & Room Header */}
      <header className="pointer-events-auto flex flex-wrap items-center justify-between gap-2">
        <div className="lounge-dock-bar flex items-center gap-3 rounded-xl px-3.5 py-2">
          <div className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full ${
                connected ? 'bg-[#49b384]' : 'bg-[#e5a93c]'
              }`}
            />
            <span
              className="text-sm font-semibold tracking-tight text-[#f4f1ea]"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              VR Lounge
            </span>
          </div>

          <div className="h-4 w-px bg-[#f4f1ea]/12" />

          <button
            id="btn-copy-room-code"
            type="button"
            onClick={() => void handleCopyInvite()}
            title="Copy shareable room invite link"
            className="flex items-center gap-1.5 rounded-lg bg-[#080a0d]/70 px-2.5 py-1 font-mono text-xs text-[#e5a93c] transition hover:bg-[#080a0d]"
          >
            <span>{roomCode}</span>
            {copiedCode ? (
              <Check className="h-3.5 w-3.5 text-[#49b384]" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-[#8a867e]" />
            )}
          </button>

          <button
            id="btn-toggle-roster"
            type="button"
            onClick={() => setRosterOpen((v) => !v)}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-[#c7c2b8] transition hover:bg-[#f4f1ea]/8 hover:text-[#f4f1ea]"
          >
            <Users className="h-3.5 w-3.5 text-[#e5a93c]" />
            <span>{participants.length}</span>
          </button>
        </div>

        {/* Center Presenter Status Pill */}
        <div className="lounge-dock-bar hidden items-center gap-2.5 rounded-xl px-3.5 py-2 text-xs md:flex">
          <Radio
            className={`h-3.5 w-3.5 ${
              presenterState.activePresenterId ? 'text-[#e5a93c]' : 'text-[#8a867e]'
            }`}
          />
          <span className="text-[#c7c2b8]">
            {presenterState.activePresenterId ? (
              <>
                Presenter:{' '}
                <strong className="font-semibold text-[#f4f1ea]">
                  {presenterState.presenterName}
                </strong>{' '}
                <span className="text-[#8a867e]">
                  ({presenterState.screenMode === 'tab-stream' ? 'Live Tab' : 'Sync URL'})
                </span>
              </>
            ) : (
              'Screen Idle — Click "Take Control" to present'
            )}
          </span>

          {localProfile.isHost && (
            <button
              id="btn-host-lock-presenter"
              type="button"
              onClick={onToggleHostLock}
              title="Host option: lock or unlock open presenter handoff"
              className={`ml-1 inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-medium transition ${
                presenterState.lockedByHostId
                  ? 'bg-[#e05a47]/20 text-[#e05a47]'
                  : 'bg-[#f4f1ea]/8 text-[#c7c2b8] hover:text-[#f4f1ea]'
              }`}
            >
              {presenterState.lockedByHostId ? (
                <>
                  <Lock className="h-3 w-3" /> Locked
                </>
              ) : (
                <>
                  <Unlock className="h-3 w-3" /> Open Handoff
                </>
              )}
            </button>
          )}
        </div>

        {/* Right Utility Actions: Walk Free Toggle, Seat Selector, Enter VR, Leave */}
        <div className="lounge-dock-bar flex items-center gap-2 rounded-xl px-2.5 py-1.5">
          <button
            id="btn-hud-free-roam"
            type="button"
            onClick={() => {
              if (localProfile.seatId === FREE_ROAM_SEAT_ID) {
                const takenIds = new Set(
                  participants
                    .filter(
                      (p) =>
                        p.userId !== localProfile.userId &&
                        p.seatId &&
                        p.seatId !== FREE_ROAM_SEAT_ID,
                    )
                    .map((p) => p.seatId as string),
                )
                const openSofa =
                  computedSeats.find(
                    (s) =>
                      !takenIds.has(s.id) &&
                      (!s.stationKind || s.stationKind === 'seat'),
                  ) ?? computedSeats[0]
                if (openSofa) {
                  onSelectSeat(openSofa.id)
                }
              } else {
                onSelectSeat(FREE_ROAM_SEAT_ID)
              }
            }}
            title={
              localProfile.seatId === FREE_ROAM_SEAT_ID
                ? 'Walking freely (WASD / Double-click floor) — click to sit on nearest open chair'
                : 'Stand up and walk freely around the lounge (WASD / Arrows / Double-click floor)'
            }
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition ${
              localProfile.seatId === FREE_ROAM_SEAT_ID
                ? 'border-[#38bdf8]/60 bg-[#38bdf8]/18 text-[#7dd3fc]'
                : 'border-[#f4f1ea]/12 bg-[#141922] text-[#c7c2b8] hover:border-[#38bdf8]/45 hover:text-[#f4f1ea]'
            }`}
          >
            <Footprints className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">
              {localProfile.seatId === FREE_ROAM_SEAT_ID ? 'Walking' : 'Walk Free'}
            </span>
          </button>

          <select
            id="select-hud-seat"
            aria-label="Select lounge seat or walk mode"
            value={
              localProfile.seatId === FREE_ROAM_SEAT_ID
                ? FREE_ROAM_SEAT_ID
                : (localProfile.seatId ??
                  (localProfile.seatIndex >= 0
                    ? computedSeats[localProfile.seatIndex]?.id
                    : undefined) ??
                  '')
            }
            onChange={(e) => onSelectSeat(e.target.value)}
            className="lounge-input max-w-[185px] truncate rounded-lg px-2.5 py-1 text-xs"
          >
            <option value={FREE_ROAM_SEAT_ID}>🚶 Free Roam (Walk Around)</option>
            {computedSeats.map((seat) => {
              const isExclusiveChair =
                !seat.stationKind ||
                seat.stationKind === 'seat' ||
                seat.stationKind === 'game-table'
              const takenByOther =
                isExclusiveChair &&
                participants.some((p) => {
                  if (p.userId === localProfile.userId) return false
                  if (p.seatId === FREE_ROAM_SEAT_ID) return false
                  if (p.seatId) return p.seatId === seat.id
                  return p.seatIndex >= 0 && p.seatIndex === seat.index
                })
              return (
                <option key={seat.id} value={seat.id} disabled={takenByOther}>
                  {seat.label} {takenByOther ? '(Taken)' : ''}
                </option>
              )
            })}
          </select>

          <button
            id="btn-hud-recenter"
            type="button"
            onClick={onRecenterSeat}
            title="Recenter camera on your lounge seat"
            className="rounded-lg p-1.5 text-[#c7c2b8] transition hover:bg-[#f4f1ea]/10 hover:text-[#f4f1ea]"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <button
            id="btn-hud-enter-vr"
            type="button"
            onClick={() => {
              const vrPromise = triggerEnterVRFromGesture()
              void onEnterVR(vrPromise)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#e5a93c] px-3 py-1.5 text-xs font-semibold text-[#080a0d] transition hover:bg-[#f2be5c]"
          >
            <Glasses className="h-3.5 w-3.5" />
            <span>{vrSupportKind === 'native' ? 'Enter VR' : 'VR Simulator'}</span>
          </button>

          <button
            id="btn-hud-leave"
            type="button"
            onClick={() => void onLeaveRoom()}
            title="Leave room"
            className="rounded-lg p-1.5 text-[#c7c2b8] transition hover:bg-[#e05a47]/20 hover:text-[#e05a47]"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* Alerts / Autoplay Unlock / Roster Popovers */}
      <div className="pointer-events-none relative my-auto flex flex-col items-center gap-2">
        {(statusBanner || mediaError || micPermissionError) && (
          <div className="pointer-events-auto lounge-panel flex max-w-xl items-center gap-3 rounded-xl px-4 py-2.5 text-xs text-[#f4f1ea]">
            <ShieldAlert className="h-4 w-4 shrink-0 text-[#e5a93c]" />
            <span>{statusBanner || mediaError || micPermissionError}</span>
            {statusBanner && (
              <button
                type="button"
                onClick={onDismissBanner}
                className="ml-auto text-[#8a867e] hover:text-[#f4f1ea]"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        )}

        {needsAudioUnlock && (
          <button
            id="btn-unlock-cinema-audio"
            type="button"
            onClick={onUnlockAudio}
            className="pointer-events-auto flex items-center gap-2 rounded-xl bg-[#e5a93c] px-4 py-2.5 text-xs font-semibold text-[#080a0d] shadow-xl transition hover:bg-[#f2be5c]"
          >
            <Volume2 className="h-4 w-4" />
            <span>Click to Unmute Live Cinema Audio</span>
          </button>
        )}

        {/* Participant Roster Popover */}
        {rosterOpen && (
          <div className="pointer-events-auto lounge-panel absolute left-0 top-2 w-72 rounded-xl p-4">
            <div className="flex items-center justify-between border-b border-[#f4f1ea]/10 pb-2.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-[#e5a93c]">
                In This Lounge ({participants.length})
              </span>
              <button
                type="button"
                onClick={() => setRosterOpen(false)}
                className="text-[#8a867e] hover:text-[#f4f1ea]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="mt-3 space-y-2">
              {participants.map((p) => (
                <li
                  key={p.userId}
                  className="flex items-center justify-between rounded-lg bg-[#080a0d]/60 px-2.5 py-2 text-xs"
                >
                  <div className="flex items-center gap-2 truncate">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: p.avatarColor }}
                    />
                    <span className="truncate font-medium text-[#f4f1ea]">
                      {p.avatarCustomization?.flairEmoji
                        ? `${p.avatarCustomization.flairEmoji} `
                        : ''}
                      {p.displayName}
                      {p.userId === localProfile.userId ? ' (You)' : ''}
                    </span>
                    {p.isHost && <Crown className="h-3 w-3 shrink-0 text-[#e5a93c]" />}
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#8a867e]">
                    <span>{p.inVR ? 'VR' : 'PC'}</span>
                    {p.isMuted ? (
                      <MicOff className="h-3 w-3 text-[#e05a47]" />
                    ) : (
                      <Mic className="h-3 w-3 text-[#49b384]" />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Mode 2 YouTube Browser & Direct Stream Drawer */}
      {urlDrawerOpen && (
        <section className="pointer-events-auto lounge-panel mx-auto mb-3 w-full max-w-3xl rounded-2xl p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f4f1ea]/10 pb-3">
            <div className="flex items-center gap-2">
              <button
                id="btn-drawer-tab-youtube"
                type="button"
                onClick={() => setDrawerTab('youtube')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  drawerTab === 'youtube'
                    ? 'bg-[#e05a47] text-[#f4f1ea]'
                    : 'bg-[#141922] text-[#c7c2b8] hover:text-[#f4f1ea]'
                }`}
              >
                <Play className="h-3.5 w-3.5" />
                <span>YouTube &amp; Open Web</span>
              </button>
              <button
                id="btn-drawer-tab-direct"
                type="button"
                onClick={() => setDrawerTab('direct')}
                className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
                  drawerTab === 'direct'
                    ? 'bg-[#e5a93c] text-[#080a0d]'
                    : 'bg-[#141922] text-[#c7c2b8] hover:text-[#f4f1ea]'
                }`}
              >
                <Globe className="h-3.5 w-3.5" />
                <span>Direct URL / Presets</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {drawerTab === 'youtube' && (
                <button
                  type="button"
                  onClick={() => setShowRelayInput((v) => !v)}
                  className="rounded-lg border border-[#f4f1ea]/12 bg-[#0d1118] px-2.5 py-1 text-[11px] text-[#c7c2b8] hover:border-[#e5a93c]/50 hover:text-[#f4f1ea]"
                >
                  {ytProvider ? `Relay: ${ytProvider}` : 'Relay Settings'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setUrlDrawerOpen(false)}
                className="text-[#8a867e] hover:text-[#f4f1ea]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {drawerTab === 'youtube' ? (
            <div className="mt-3.5 space-y-3">
              {showRelayInput && (
                <div className="flex flex-col gap-2 rounded-xl border border-[#f4f1ea]/10 bg-[#080a0d]/75 p-2.5 sm:flex-row sm:items-center">
                  <input
                    type="url"
                    value={customRelayInput}
                    onChange={(e) => setCustomRelayInput(e.target.value)}
                    placeholder="Optional custom Piped or Invidious API URL (e.g. https://pipedapi.kavin.rocks)"
                    className="lounge-input flex-1 rounded-lg px-3 py-1.5 text-xs"
                  />
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setCustomYouTubeInstance(customRelayInput)
                        setYtRefreshNonce((n) => n + 1)
                        setShowRelayInput(false)
                      }}
                      className="rounded-lg bg-[#e5a93c] px-3 py-1.5 text-xs font-semibold text-[#080a0d]"
                    >
                      Save Relay
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        resetInstanceCooldowns()
                        setYtRefreshNonce((n) => n + 1)
                      }}
                      className="rounded-lg border border-[#f4f1ea]/12 bg-[#141922] px-2.5 py-1.5 text-xs text-[#c7c2b8] hover:text-[#f4f1ea]"
                    >
                      Switch Auto
                    </button>
                  </div>
                </div>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  setYtSubmittedQuery(ytQuery.trim())
                }}
                className="flex gap-2"
              >
                <input
                  id="input-youtube-search"
                  type="text"
                  value={ytQuery}
                  onChange={(e) => setYtQuery(e.target.value)}
                  placeholder="Search YouTube videos, channels, or paste any youtube.com / youtu.be link..."
                  className="lounge-input flex-1 rounded-xl px-3.5 py-2 text-xs"
                />
                {ytSubmittedQuery && (
                  <button
                    type="button"
                    onClick={() => {
                      setYtQuery('')
                      setYtSubmittedQuery('')
                    }}
                    className="rounded-xl border border-[#f4f1ea]/12 bg-[#141922] px-3 py-2 text-xs text-[#c7c2b8] hover:text-[#f4f1ea]"
                  >
                    Clear
                  </button>
                )}
                <button
                  id="btn-submit-youtube-search"
                  type="submit"
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#e5a93c] px-4 py-2 text-xs font-semibold text-[#080a0d] transition hover:bg-[#f2be5c]"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span>Search</span>
                </button>
              </form>

              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ['trending', '🔥 Trending'],
                    ['music', '🎵 Music'],
                    ['gaming', '🎮 Gaming'],
                    ['movies', '🎬 Trailers'],
                    ['lofi', '☕ Lo-Fi'],
                    ['openweb', '🌐 Open Web'],
                    ['cinema', '🎞 Cinema HD'],
                  ] as const
                ).map(([catId, label]) => {
                  const active = !ytSubmittedQuery && ytCategory === catId
                  return (
                    <button
                      key={catId}
                      type="button"
                      onClick={() => {
                        setYtQuery('')
                        setYtSubmittedQuery('')
                        setYtCategory(catId)
                      }}
                      className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                        active
                          ? 'bg-[#e5a93c] text-[#080a0d]'
                          : 'bg-[#141922] text-[#c7c2b8] hover:bg-[#1e2634] hover:text-[#f4f1ea]'
                      }`}
                    >
                      {label}
                    </button>
                  )
                })}
              </div>

              {ytNotice && (
                <p className="rounded-lg bg-[#e5a93c]/10 px-3 py-1.5 text-[11px] text-[#e5a93c]">
                  {ytNotice}
                </p>
              )}

              <div className="lounge-scrollbar max-h-72 overflow-y-auto pr-1">
                {ytLoading ? (
                  <div className="py-12 text-center text-xs text-[#c7c2b8]">
                    Connecting to fastest CORS cinema relay…
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                    {ytItems.slice(0, 12).map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          onLoadStreamUrl(item.playUrl, item.title, false)
                          setUrlDrawerOpen(false)
                        }}
                        className="group flex items-center gap-3 rounded-xl border border-[#f4f1ea]/10 bg-[#080a0d]/75 p-2 text-left transition hover:border-[#e5a93c]/60 hover:bg-[#121824]"
                      >
                        <div className="relative h-16 w-28 shrink-0 overflow-hidden rounded-lg bg-[#161e2e]">
                          {item.thumbnailUrl && (
                            <img
                              src={item.thumbnailUrl}
                              alt=""
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          )}
                          <span className="absolute bottom-1 right-1 rounded bg-[#080a0d]/90 px-1 py-0.5 font-mono text-[10px] text-[#f4f1ea]">
                            {formatVideoDurationBadge(item.durationSec)}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="line-clamp-2 text-xs font-medium leading-snug text-[#f4f1ea] group-hover:text-[#e5a93c]">
                            {item.title}
                          </div>
                          <div className="mt-1 truncate text-[11px] text-[#8a867e]">
                            {[item.author, formatCompactViews(item.views)]
                              .filter(Boolean)
                              .join(' · ')}
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-3.5 space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="input-stream-url"
                  type="url"
                  value={urlInput}
                  onChange={(e) => setUrlInput(e.target.value)}
                  placeholder="Paste YouTube watch URL, direct .mp4, or .m3u8 HLS stream..."
                  className="lounge-input flex-1 rounded-xl px-3.5 py-2 text-xs"
                />
                <button
                  id="btn-load-stream-url"
                  type="button"
                  onClick={() => {
                    if (!urlInput.trim()) return
                    onLoadStreamUrl(
                      urlInput.trim(),
                      urlTitleInput.trim() || 'Shared Cinema Stream',
                      useCorsProxy,
                    )
                    setUrlDrawerOpen(false)
                  }}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#e5a93c] px-4 py-2 text-xs font-semibold text-[#080a0d] transition hover:bg-[#f2be5c]"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span>Play on Screen</span>
                </button>
              </div>

              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-[#c7c2b8]">
                <input
                  type="checkbox"
                  checked={useCorsProxy}
                  onChange={(e) => setUseCorsProxy(e.target.checked)}
                  className="accent-[#e5a93c]"
                />
                <span>
                  Route through local CORS Stream Proxy (<code>/api/stream-proxy</code>) for
                  cross-origin MP4/HLS servers
                </span>
              </label>

              <div>
                <span className="block text-[11px] font-medium uppercase tracking-wider text-[#8a867e]">
                  Instant Cinema Reference Streams
                </span>
                <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {SAMPLE_MEDIA_PRESETS.map((preset) => (
                    <button
                      key={preset.id}
                      id={`btn-preset-${preset.id}`}
                      type="button"
                      onClick={() => {
                        setUrlInput(preset.url)
                        setUrlTitleInput(preset.title)
                        onLoadStreamUrl(preset.url, preset.title, false)
                        setUrlDrawerOpen(false)
                      }}
                      className="flex items-center justify-between rounded-xl border border-[#f4f1ea]/10 bg-[#080a0d]/70 px-3 py-2 text-left transition hover:border-[#e5a93c]/50"
                    >
                      <div className="min-w-0 pr-2">
                        <div className="truncate text-xs font-medium text-[#f4f1ea]">
                          {preset.title}
                        </div>
                        <div className="truncate text-[11px] text-[#8a867e]">
                          {preset.subtitle}
                        </div>
                      </div>
                      <span className="shrink-0 font-mono text-[11px] text-[#e5a93c]">
                        {preset.durationHint}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Slide-Over 2D Text Chat Drawer */}
      {chatDrawerOpen && (
        <aside className="pointer-events-auto lounge-panel fixed bottom-20 right-4 z-30 flex h-96 w-80 flex-col rounded-2xl p-4 sm:w-96">
          <div className="flex items-center justify-between border-b border-[#f4f1ea]/10 pb-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#e5a93c]">
              Room Chat &amp; Reactions
            </span>
            <button
              type="button"
              onClick={() => setChatDrawerOpen(false)}
              className="text-[#8a867e] hover:text-[#f4f1ea]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div
            ref={chatScrollRef}
            className="lounge-scrollbar my-3 flex-1 space-y-2.5 overflow-y-auto pr-1"
          >
            {messages.length === 0 ? (
              <p className="py-10 text-center text-xs text-[#8a867e]">
                Say hello or trigger a floating 3D reaction!
              </p>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl px-3 py-2 text-xs ${
                    m.isSystem ? 'bg-[#e5a93c]/10 text-[#c7c2b8]' : 'bg-[#080a0d]/70'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className="font-semibold"
                      style={{ color: m.isSystem ? '#e5a93c' : m.avatarColor }}
                    >
                      {m.displayName}
                    </span>
                    <span className="font-mono text-[10px] text-[#8a867e]">
                      {new Date(m.createdAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <p className="mt-0.5 break-words text-[#f4f1ea]">{m.text}</p>
                </div>
              ))
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!chatDraft.trim()) return
              onSendChat(chatDraft)
              setChatDraft('')
            }}
            className="flex gap-2"
          >
            <input
              id="input-companion-chat"
              type="text"
              value={chatDraft}
              onChange={(e) => setChatDraft(e.target.value)}
              placeholder="Message the lounge..."
              className="lounge-input flex-1 rounded-xl px-3 py-2 text-xs"
            />
            <button
              id="btn-send-companion-chat"
              type="submit"
              className="flex items-center justify-center rounded-xl bg-[#e5a93c] px-3 text-[#080a0d] transition hover:bg-[#f2be5c]"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </aside>
      )}

      {/* Audio Mixer Popover */}
      {audioPopoverOpen && (
        <div className="pointer-events-auto lounge-panel fixed bottom-20 left-1/2 z-30 w-72 -translate-x-1/2 space-y-3 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#e5a93c]">
              Lounge Audio Mix
            </span>
            <button
              type="button"
              onClick={() => setAudioPopoverOpen(false)}
              className="text-[#8a867e] hover:text-[#f4f1ea]"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div>
            <div className="flex justify-between text-xs text-[#c7c2b8]">
              <span>Cinema Screen</span>
              <span className="font-mono">{Math.round(cinemaVolume * 100)}%</span>
            </div>
            <input
              id="slider-cinema-volume"
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={cinemaVolume}
              onChange={(e) => onChangeCinemaVolume(Number(e.target.value))}
              className="cinema-slider mt-1.5 w-full"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs text-[#c7c2b8]">
              <span>Spatial Voice Chat</span>
              <span className="font-mono">{Math.round(voiceVolume * 100)}%</span>
            </div>
            <input
              id="slider-voice-volume"
              type="range"
              min={0}
              max={1}
              step={0.02}
              value={voiceVolume}
              onChange={(e) => onChangeVoiceVolume(Number(e.target.value))}
              className="cinema-slider mt-1.5 w-full"
            />
          </div>
        </div>
      )}

      {/* Hangout Room Builder, Architecture, Screen & Mood Studio Drawer */}
      <BuildCatalogDrawer
        open={buildDrawerOpen}
        buildMode={buildMode}
        customization={roomCustomization}
        selectedFurnitureId={selectedFurnitureId}
        onToggleBuildMode={onToggleBuildMode}
        onSelectFurniture={onSelectFurniture}
        onSpawnFurniture={onSpawnFurniture}
        onUpdateFurnitureItem={onUpdateFurnitureItem}
        onDuplicateFurnitureItem={onDuplicateFurnitureItem}
        onDeleteFurnitureItem={onDeleteFurnitureItem}
        onUpdateArchitecture={onUpdateArchitecture}
        onUpdateLighting={onUpdateLighting}
        onApplyLightingPreset={onApplyLightingPreset}
        onUpdateScreen={onUpdateScreen}
        onResetRoom={onResetRoom}
        onImportBlueprintJson={onImportBlueprintJson}
        onClose={() => {
          setBuildDrawerOpen(false)
          onToggleBuildMode(false)
        }}
      />

      {/* Subtle Free-Roam Controls Hint Pill (Desktop only, non-blocking) */}
      {localProfile.seatId === FREE_ROAM_SEAT_ID &&
        !inVRSession &&
        !buildDrawerOpen &&
        !urlDrawerOpen &&
        !barGamesOpen &&
        !wardrobeOpen && (
          <div className="pointer-events-none mx-auto mb-2 flex items-center gap-2 rounded-full border border-[#38bdf8]/35 bg-[#080a0d]/85 px-3.5 py-1 text-[11px] text-[#cbd5e1] shadow-lg backdrop-blur-md">
            <Footprints className="h-3.5 w-3.5 text-[#38bdf8]" />
            <span>
              <strong className="font-semibold text-[#7dd3fc]">Free Roam</strong> ·{' '}
              <kbd className="rounded bg-[#1e293b] px-1 py-0.5 font-mono text-[10px] text-[#f4f1ea]">
                WASD
              </kbd>{' '}
              /{' '}
              <kbd className="rounded bg-[#1e293b] px-1 py-0.5 font-mono text-[10px] text-[#f4f1ea]">
                Arrows
              </kbd>{' '}
              to walk ·{' '}
              <kbd className="rounded bg-[#1e293b] px-1 py-0.5 font-mono text-[10px] text-[#f4f1ea]">
                Shift
              </kbd>{' '}
              faster · Double-click floor to glide · Click any chair to sit
            </span>
          </div>
        )}

      {/* Bottom Companion Presenter & Watch-Party Dock */}
      <footer className="pointer-events-auto lounge-dock-bar mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2.5 rounded-2xl px-3.5 py-2.5">
        {/* Left: Presenter Handoff + Tab Share + URL Player + Customize Room + Games + Avatar */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-take-or-release-control"
            type="button"
            disabled={!isLocalPresenter && !canTakeControl}
            onClick={isLocalPresenter ? onReleaseControl : onTakeControl}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-semibold transition ${
              isLocalPresenter
                ? 'border border-[#e5a93c]/60 bg-[#e5a93c]/15 text-[#e5a93c]'
                : 'bg-[#e5a93c] text-[#080a0d] hover:bg-[#f2be5c] disabled:opacity-45'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>{isLocalPresenter ? 'Presenting (Release)' : 'Take Control'}</span>
          </button>

          <button
            id="btn-share-browser-tab"
            type="button"
            disabled={!isLocalPresenter && !canTakeControl}
            onClick={() => {
              if (isSharingTab) {
                onStopTabShare()
              } else {
                void onStartTabShare()
              }
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
              isSharingTab
                ? 'border-[#e05a47] bg-[#e05a47]/20 text-[#f4f1ea]'
                : 'border-[#f4f1ea]/12 bg-[#141922] text-[#f4f1ea] hover:border-[#e5a93c]/50 disabled:opacity-45'
            }`}
          >
            <MonitorUp className="h-3.5 w-3.5 text-[#e5a93c]" />
            <span>{isSharingTab ? 'Stop Tab Stream' : 'Share Browser Tab'}</span>
          </button>

          <button
            id="btn-open-url-player"
            type="button"
            disabled={!isLocalPresenter && !canTakeControl}
            onClick={() => {
              setUrlDrawerOpen((v) => {
                const next = !v
                if (next) {
                  setBuildDrawerOpen(false)
                  onToggleWardrobe?.(false)
                }
                return next
              })
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
              urlDrawerOpen
                ? 'border-[#e5a93c] bg-[#e5a93c]/15 text-[#f4f1ea]'
                : 'border-[#f4f1ea]/12 bg-[#141922] text-[#f4f1ea] hover:border-[#e5a93c]/50 disabled:opacity-45'
            }`}
          >
            <Tv className="h-3.5 w-3.5 text-[#e5a93c]" />
            <span>YouTube &amp; Streams</span>
          </button>

          <button
            id="btn-open-customize-studio"
            type="button"
            onClick={() => {
              setBuildDrawerOpen((v) => {
                const next = !v
                if (next) {
                  setUrlDrawerOpen(false)
                  onToggleWardrobe?.(false)
                  onToggleBuildMode(true)
                } else {
                  onToggleBuildMode(false)
                }
                return next
              })
            }}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
              buildDrawerOpen || buildMode
                ? 'border-[#22d3ee] bg-[#22d3ee]/15 text-[#22d3ee]'
                : 'border-[#f4f1ea]/12 bg-[#141922] text-[#f4f1ea] hover:border-[#22d3ee]/60'
            }`}
          >
            <Hammer className="h-3.5 w-3.5 text-[#22d3ee]" />
            <span>Customize Room</span>
          </button>

          {onToggleBarGames && (
            <button
              id="btn-open-bar-games"
              type="button"
              onClick={() => {
                if (!barGamesOpen) {
                  setBuildDrawerOpen(false)
                  setUrlDrawerOpen(false)
                  onToggleBuildMode(false)
                  onToggleWardrobe?.(false)
                }
                onToggleBarGames()
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                barGamesOpen
                  ? 'border-[#e5a93c] bg-[#e5a93c]/18 text-[#fde68a]'
                  : 'border-[#f4f1ea]/12 bg-[#141922] text-[#f4f1ea] hover:border-[#e5a93c]/60'
              }`}
            >
              <Dices className="h-3.5 w-3.5 text-[#e5a93c]" />
              <span>Games &amp; Props</span>
            </button>
          )}

          {onToggleWardrobe && (
            <button
              id="btn-open-avatar-wardrobe"
              type="button"
              onClick={() => {
                if (!wardrobeOpen) {
                  setBuildDrawerOpen(false)
                  setUrlDrawerOpen(false)
                  setChatDrawerOpen(false)
                  onToggleBuildMode(false)
                }
                onToggleWardrobe()
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                wardrobeOpen
                  ? 'border-[#c084fc] bg-[#c084fc]/18 text-[#e9d5ff]'
                  : 'border-[#f4f1ea]/12 bg-[#141922] text-[#f4f1ea] hover:border-[#c084fc]/60'
              }`}
            >
              <User
                className="h-3.5 w-3.5"
                style={{ color: wardrobeOpen ? '#d8b4fe' : localProfile.avatarColor }}
              />
              <span>Avatar</span>
            </button>
          )}
        </div>

        {/* Center: Mode 2 Synchronized Transport Controls */}
        {presenterState.screenMode === 'url-sync' && presenterState.activePresenterId && (
          <div className="flex flex-1 items-center gap-2.5 px-2 min-w-[200px]">
            <button
              id="btn-companion-play-pause"
              type="button"
              disabled={!isLocalPresenter}
              onClick={onTogglePlayPause}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#f4f1ea]/10 text-[#f4f1ea] transition hover:bg-[#e5a93c] hover:text-[#080a0d] disabled:opacity-40"
            >
              {presenterState.isPlaying ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              id="slider-timeline-scrub"
              type="range"
              min={0}
              max={Math.max(1, localDuration)}
              step={0.5}
              disabled={!isLocalPresenter}
              value={Math.min(localCurrentTime, Math.max(1, localDuration))}
              onChange={(e) => onSeekTo(Number(e.target.value))}
              className="cinema-slider w-full disabled:opacity-50"
            />
            <span className="shrink-0 font-mono text-[11px] text-[#c7c2b8]">
              {formatDuration(localCurrentTime)} / {formatDuration(localDuration)}
            </span>
          </div>
        )}

        {/* Right: Mic + Mixers + Quick Reactions + Chat */}
        <div className="flex items-center gap-1.5">
          <button
            id="btn-companion-mute"
            type="button"
            onClick={onToggleMute}
            className={`relative inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition ${
              localProfile.isMuted
                ? 'bg-[#e05a47]/20 text-[#e05a47]'
                : 'bg-[#141922] text-[#f4f1ea] hover:bg-[#1e2634]'
            }`}
          >
            {localProfile.isMuted ? (
              <MicOff className="h-3.5 w-3.5" />
            ) : (
              <Mic
                className="h-3.5 w-3.5 transition-transform"
                style={{
                  color: localMicLevel > 0.08 ? '#49b384' : '#e5a93c',
                  transform: `scale(${1 + localMicLevel * 0.28})`,
                }}
              />
            )}
            <span className="hidden sm:inline">
              {localProfile.isMuted ? 'Muted' : 'Mic'}
            </span>
          </button>

          <button
            id="btn-open-audio-mixer"
            type="button"
            title="Screen & Spatial Voice Volume Mixer"
            onClick={() => setAudioPopoverOpen((v) => !v)}
            className="rounded-xl bg-[#141922] p-2 text-[#c7c2b8] transition hover:text-[#f4f1ea]"
          >
            <Headphones className="h-4 w-4" />
          </button>

          <div className="hidden items-center gap-1 rounded-xl bg-[#080a0d]/60 px-1.5 py-1 lg:flex">
            {QUICK_REACTIONS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onSendReaction(emoji)}
                className="rounded-lg px-1.5 py-0.5 text-sm transition hover:scale-125 hover:bg-[#f4f1ea]/10"
              >
                {emoji}
              </button>
            ))}
          </div>

          <button
            id="btn-toggle-companion-chat"
            type="button"
            onClick={() => setChatDrawerOpen((v) => !v)}
            className="relative inline-flex items-center gap-1.5 rounded-xl bg-[#141922] px-3 py-2 text-xs font-medium text-[#f4f1ea] transition hover:bg-[#1e2634]"
          >
            <MessageSquare className="h-3.5 w-3.5 text-[#e5a93c]" />
            <span className="hidden sm:inline">Chat</span>
            {unreadCount > 0 && (
              <span className="ml-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#e5a93c] px-1 text-[10px] font-bold text-[#080a0d]">
                {unreadCount}
              </span>
            )}
          </button>
        </div>
      </footer>
    </div>
  )
}
