import {
  AlertTriangle,
  BookmarkPlus,
  Check,
  Copy,
  ExternalLink,
  FolderHeart,
  KeyRound,
  LogIn,
  LogOut,
  MonitorUp,
  Play,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  ThumbsUp,
  Tv,
  UserCheck,
  Volume2,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import type { ScreenShareQualityMode } from '../../hooks/useWebRTC'
import {
  extractYouTubePlaylistId,
  fetchYouTubeChannelVideos,
  formatCompactViews,
  formatVideoDurationBadge,
  type YouTubeVideoItem,
} from '../../services/youtube'
import {
  fetchPersonalYouTubeFeed,
  fetchUserPlaylistsList,
  followYouTubeChannel,
  getConfiguredGoogleClientId,
  getGoogleOAuthRedirectUri,
  getYouTubeAccountState,
  isYouTubeVideoLiked,
  openYouTubeWebLoginPopup,
  pinYouTubePlaylist,
  removePinnedLibrarySource,
  setConfiguredGoogleClientId,
  signInWithPipedAccount,
  signInWithYouTubeIdentity,
  signOutYouTubeAccount,
  startGoogleYouTubeSignIn,
  subscribeYouTubeAccount,
  toggleLikeYouTubeVideo,
  type PersonalFeedSection,
  type PinnedLibrarySource,
  type YouTubeAccountState,
  type YouTubeUserPlaylistSummary,
} from '../../services/youtubeAccount'

export interface YouTubeAccountAndTVPanelProps {
  mode: 'account' | 'youtubetv'
  isSharingTab: boolean
  hasScreenAudioTrack: boolean
  screenShareQuality: ScreenShareQualityMode
  onChangeScreenShareQuality: (quality: ScreenShareQualityMode) => void
  onStartTabShare: (
    qualityOverride?: ScreenShareQualityMode,
    customTitle?: string,
  ) => Promise<void>
  onStopTabShare: () => void
  onPlayVideo: (url: string, title: string) => void
}

export function YouTubeAccountAndTVPanel({
  mode,
  isSharingTab,
  hasScreenAudioTrack,
  screenShareQuality,
  onChangeScreenShareQuality,
  onStartTabShare,
  onStopTabShare,
  onPlayVideo,
}: YouTubeAccountAndTVPanelProps) {
  const [accountState, setAccountState] = useState<YouTubeAccountState>(() =>
    getYouTubeAccountState(),
  )

  // Account & Personal Library state
  const [section, setSection] = useState<PersonalFeedSection>('subscriptions')
  const [playlists, setPlaylists] = useState<YouTubeUserPlaylistSummary[]>([])
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string>('')
  const [selectedPinnedChannel, setSelectedPinnedChannel] =
    useState<PinnedLibrarySource | null>(null)
  const [items, setItems] = useState<YouTubeVideoItem[]>([])
  const [providerLabel, setProviderLabel] = useState<string>('')
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [refreshNonce, setRefreshNonce] = useState<number>(0)

  // Direct / OAuth / Piped sign-in UI state
  const [identityDraft, setIdentityDraft] = useState<string>('')
  const [oauthSetupOpen, setOauthSetupOpen] = useState<boolean>(false)
  const [clientIdDraft, setClientIdDraft] = useState<string>(() =>
    getConfiguredGoogleClientId(),
  )
  const [copiedField, setCopiedField] = useState<string | null>(null)
  const [pipedLoginOpen, setPipedLoginOpen] = useState<boolean>(false)
  const [pipedUsername, setPipedUsername] = useState<string>('')
  const [pipedPassword, setPipedPassword] = useState<string>('')
  const [pipedInstance, setPipedInstance] = useState<string>('')
  const [authBusy, setAuthBusy] = useState<boolean>(false)
  const [authError, setAuthError] = useState<string | null>(null)

  // Zero-key Playlist / @Channel pin bar state
  const [pinInput, setPinInput] = useState<string>('')
  const [pinBusy, setPinBusy] = useState<boolean>(false)

  // YouTube TV DRM helper state
  const [drmHelpOpen, setDrmHelpOpen] = useState<boolean>(false)

  useEffect(() => {
    return subscribeYouTubeAccount((next) => {
      setAccountState(next)
      setRefreshNonce((n) => n + 1)
    })
  }, [])

  const copyText = useCallback((value: string, key: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(value)
    }
    setCopiedField(key)
    window.setTimeout(() => {
      setCopiedField((prev) => (prev === key ? null : prev))
    }, 1800)
  }, [])

  // Load user playlists when entering Playlists tab or signing in
  useEffect(() => {
    if (mode !== 'account') return
    let cancelled = false
    const run = async () => {
      try {
        const list = await fetchUserPlaylistsList()
        if (cancelled) return
        setPlaylists(list)
        if (list.length > 0 && !list.some((p) => p.id === selectedPlaylistId)) {
          setSelectedPlaylistId(list[0].id)
        }
      } catch {
        // Ignore non-fatal playlist summary errors
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [accountState.authProvider, accountState.pinnedSources.length, mode, refreshNonce, selectedPlaylistId])

  // Load personal video feed
  useEffect(() => {
    if (mode !== 'account') return
    let cancelled = false
    setLoading(true)
    setNotice(null)

    const load = async () => {
      try {
        if (selectedPinnedChannel) {
          const chRes = await fetchYouTubeChannelVideos(selectedPinnedChannel.ref)
          if (cancelled) return
          setItems(chRes.items)
          setProviderLabel(`${selectedPinnedChannel.title} (${chRes.provider})`)
          setNotice(null)
          return
        }

        const activePlId =
          section === 'playlists' && selectedPlaylistId ? selectedPlaylistId : undefined
        const res = await fetchPersonalYouTubeFeed(section, activePlId)
        if (cancelled) return
        setItems(res.items)
        setProviderLabel(res.provider)
        setNotice(res.notice ?? null)
      } catch (err) {
        if (!cancelled) {
          setNotice(
            err instanceof Error
              ? err.message
              : 'Could not load your personal YouTube feed right now.',
          )
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [
    accountState.authProvider,
    accountState.pinnedSources.length,
    mode,
    refreshNonce,
    section,
    selectedPinnedChannel,
    selectedPlaylistId,
  ])

  const handleDirectSignInSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (authBusy) return
    setAuthError(null)
    setAuthBusy(true)
    try {
      const targetIdentity =
        identityDraft.trim() ||
        (typeof window !== 'undefined'
          ? window.localStorage.getItem('vr-lounge:name')?.trim()
          : '') ||
        '@dingbaum'
      await signInWithYouTubeIdentity(targetIdentity)
      setSelectedPinnedChannel(null)
      setSection('subscriptions')
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'Could not sign into YouTube account.',
      )
    } finally {
      setAuthBusy(false)
    }
  }

  const handleGoogleSignInClick = async () => {
    setAuthError(null)
    const configured = clientIdDraft.trim() || getConfiguredGoogleClientId()
    if (configured) {
      const res = startGoogleYouTubeSignIn({ clientId: configured })
      if (!res.ok && res.error) {
        setAuthError(res.error)
        setOauthSetupOpen(true)
      }
      return
    }
    // Zero-setup Google / YouTube.com Sign-In Popup + Instant Profile Activation
    setAuthBusy(true)
    try {
      await openYouTubeWebLoginPopup(identityDraft.trim() || undefined)
      setSelectedPinnedChannel(null)
      setSection('subscriptions')
    } finally {
      setAuthBusy(false)
    }
  }

  const handlePipedSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setAuthError(null)
    setAuthBusy(true)
    try {
      await signInWithPipedAccount(pipedUsername, pipedPassword, pipedInstance)
      setPipedLoginOpen(false)
      setPipedPassword('')
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : 'Piped login failed.')
    } finally {
      setAuthBusy(false)
    }
  }

  const handlePinSourceSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const raw = pinInput.trim()
    if (!raw || pinBusy) return
    setPinBusy(true)
    setAuthError(null)
    try {
      const playlistId = extractYouTubePlaylistId(raw)
      if (playlistId) {
        const pinned = await pinYouTubePlaylist(raw)
        setPinInput('')
        setSelectedPinnedChannel(null)
        setSection('playlists')
        setSelectedPlaylistId(pinned.ref)
      } else {
        const followed = await followYouTubeChannel(raw)
        setPinInput('')
        setSection('pinned')
        setSelectedPinnedChannel(followed)
      }
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Could not resolve that YouTube playlist or channel.',
      )
    } finally {
      setPinBusy(false)
    }
  }

  if (mode === 'youtubetv') {
    const originIsSports60 = screenShareQuality === 'sports-60'
    return (
      <div id="panel-youtube-tv" className="mt-3.5 space-y-3.5">
        {/* Top YouTube TV Watch-Party Banner */}
        <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#e05a47]/35 bg-gradient-to-r from-[#e05a47]/15 via-[#141922] to-[#e5a93c]/12 p-3.5 sm:flex-row sm:items-center">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-xs font-semibold text-[#f4f1ea]">
              <Tv className="h-4 w-4 text-[#e05a47]" />
              <span>YouTube TV Live Watch-Party Mode (60fps Sports &amp; Multiview)</span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#c7c2b8]">
              Open <code className="text-[#f4f1ea]">tv.youtube.com</code> in a desktop tab, sign in to your YouTube TV subscription, and broadcast the live tab + stereo audio straight onto the 3D Cinema Screen for everyone in VR &amp; Desktop.
            </p>
          </div>
          <button
            id="btn-yttv-drm-help"
            type="button"
            onClick={() => setDrmHelpOpen((v) => !v)}
            className={`shrink-0 inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              drmHelpOpen
                ? 'border-[#e5a93c] bg-[#e5a93c]/20 text-[#e5a93c]'
                : 'border-[#f4f1ea]/15 bg-[#0d1118] text-[#c7c2b8] hover:border-[#e5a93c]/50 hover:text-[#f4f1ea]'
            }`}
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#e5a93c]" />
            <span>Black Screen / DRM Fix</span>
          </button>
        </div>

        {/* Collapsible Widevine DRM Black-Screen Shield Helper */}
        {drmHelpOpen && (
          <div
            id="panel-yttv-drm-guide"
            className="space-y-2 rounded-xl border border-[#e5a93c]/40 bg-[#080a0d]/90 p-3.5 text-xs text-[#c7c2b8]"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#e5a93c]">
                Why Live TV Sometimes Captures as a Black Box (10-Second Presenter Fix)
              </span>
              <button
                type="button"
                onClick={() => setDrmHelpOpen(false)}
                className="text-[#8a867e] hover:text-[#f4f1ea]"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="text-[11px] leading-relaxed">
              Live broadcast networks on YouTube TV use hardware Widevine DRM, which tells GPU drivers to blank out screen-shared video on Chrome/Edge while audio keeps playing. Only the <strong>Presenter PC</strong> needs one of these two fixes (friends on Quest 3 headsets don&apos;t change anything):
            </p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-[#f4f1ea]/10 bg-[#121824] p-2.5">
                <div className="font-semibold text-[#f4f1ea]">
                  Option A — Chrome / Edge / Brave
                </div>
                <p className="mt-1 text-[11px] text-[#9ca3af]">
                  Paste <code className="text-[#e5a93c]">chrome://settings/system</code> in your address bar and toggle OFF <em>&ldquo;Use graphics acceleration when available&rdquo;</em> while hosting.
                </p>
                <button
                  id="btn-yttv-copy-chrome-settings"
                  type="button"
                  onClick={() => copyText('chrome://settings/system', 'chrome-sys')}
                  className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#1d2638] px-2.5 py-1 text-[11px] font-medium text-[#f4f1ea] hover:bg-[#27334b]"
                >
                  {copiedField === 'chrome-sys' ? (
                    <>
                      <Check className="h-3 w-3 text-[#49b384]" /> Copied URL
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" /> Copy chrome://settings/system
                    </>
                  )}
                </button>
              </div>
              <div className="rounded-lg border border-[#f4f1ea]/10 bg-[#121824] p-2.5">
                <div className="font-semibold text-[#f4f1ea]">
                  Option B — Firefox (Zero Settings Change)
                </div>
                <p className="mt-1 text-[11px] text-[#9ca3af]">
                  Open VR Lounge and <code className="text-[#e5a93c]">tv.youtube.com</code> in <strong>Firefox</strong> on your PC/Mac — Firefox&apos;s software compositor shares live TV tabs cleanly out of the box.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Step 1: Launch YouTube TV Destinations */}
        <div>
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#8a867e]">
            Step 1 — Open YouTube TV in Browser Tab
          </span>
          <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <a
              id="btn-yttv-open-live"
              href="https://tv.youtube.com/live"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-xl border border-[#f4f1ea]/12 bg-[#080a0d]/80 px-3.5 py-2.5 transition hover:border-[#e05a47]/60 hover:bg-[#121824]"
            >
              <div>
                <div className="text-xs font-semibold text-[#f4f1ea] group-hover:text-[#e05a47]">
                  📺 Live TV Guide
                </div>
                <div className="text-[11px] text-[#8a867e]">tv.youtube.com/live</div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-[#8a867e] group-hover:text-[#f4f1ea]" />
            </a>

            <a
              id="btn-yttv-open-sports"
              href="https://tv.youtube.com/directory/sports"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-xl border border-[#f4f1ea]/12 bg-[#080a0d]/80 px-3.5 py-2.5 transition hover:border-[#e5a93c]/60 hover:bg-[#121824]"
            >
              <div>
                <div className="text-xs font-semibold text-[#f4f1ea] group-hover:text-[#e5a93c]">
                  🏈 Sports &amp; Multiview
                </div>
                <div className="text-[11px] text-[#8a867e]">4-Game Split &amp; Live Scores</div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-[#8a867e] group-hover:text-[#f4f1ea]" />
            </a>

            <a
              id="btn-yttv-open-dvr"
              href="https://tv.youtube.com/library"
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center justify-between rounded-xl border border-[#f4f1ea]/12 bg-[#080a0d]/80 px-3.5 py-2.5 transition hover:border-[#38bdf8]/60 hover:bg-[#121824]"
            >
              <div>
                <div className="text-xs font-semibold text-[#f4f1ea] group-hover:text-[#38bdf8]">
                  📼 My DVR Library
                </div>
                <div className="text-[11px] text-[#8a867e]">Recorded Games &amp; Shows</div>
              </div>
              <ExternalLink className="h-3.5 w-3.5 text-[#8a867e] group-hover:text-[#f4f1ea]" />
            </a>
          </div>
        </div>

        {/* Step 2: Select Frame Rate & Broadcast Tab to Lounge */}
        <div className="rounded-xl border border-[#f4f1ea]/10 bg-[#080a0d]/75 p-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8a867e]">
              Step 2 — Stream Tab + Stereo Audio to 3D Cinema Screen
            </span>

            <div className="inline-flex rounded-xl border border-[#f4f1ea]/10 bg-[#121824] p-0.5">
              <button
                id="btn-yttv-quality-60fps"
                type="button"
                onClick={() => onChangeScreenShareQuality('sports-60')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  originIsSports60
                    ? 'bg-[#e5a93c] text-[#080a0d]'
                    : 'text-[#c7c2b8] hover:text-[#f4f1ea]'
                }`}
              >
                ⚡ 60fps Sports HD (4.5 Mbps)
              </button>
              <button
                id="btn-yttv-quality-30fps"
                type="button"
                onClick={() => onChangeScreenShareQuality('cinema-30')}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold transition ${
                  !originIsSports60
                    ? 'bg-[#38bdf8] text-[#080a0d]'
                    : 'text-[#c7c2b8] hover:text-[#f4f1ea]'
                }`}
              >
                🎬 30fps Cinema (2.5 Mbps)
              </button>
            </div>
          </div>

          {isSharingTab ? (
            <div id="yttv-live-status-card" className="space-y-2.5">
              {hasScreenAudioTrack ? (
                <div className="flex items-center justify-between rounded-xl border border-[#49b384]/45 bg-[#49b384]/15 px-3.5 py-2.5 text-xs text-[#f4f1ea]">
                  <div className="flex items-center gap-2">
                    <Radio className="h-4 w-4 animate-pulse text-[#49b384]" />
                    <span>
                      <strong>LIVE ON LOUNGE SCREEN</strong> ·{' '}
                      {originIsSports60 ? '1080p 60fps Sports' : '1080p 30fps Cinema'} + Stereo Tab Audio Active
                    </span>
                  </div>
                  <Volume2 className="h-4 w-4 text-[#49b384]" />
                </div>
              ) : (
                <div
                  id="yttv-missing-audio-warning"
                  className="flex flex-col justify-between gap-2 rounded-xl border border-[#e5a93c]/50 bg-[#e5a93c]/15 px-3.5 py-2.5 text-xs text-[#f4f1ea] sm:flex-row sm:items-center"
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#e5a93c]" />
                    <span>
                      <strong>Video is live, but Tab Audio was not shared!</strong> Re-select the YouTube TV tab and check{' '}
                      <em>&ldquo;Also share tab audio&rdquo;</em> so friends in VR hear the game.
                    </span>
                  </div>
                  <button
                    id="btn-yttv-reshare-audio"
                    type="button"
                    onClick={() =>
                      void onStartTabShare(screenShareQuality, 'YouTube TV Live')
                    }
                    className="shrink-0 rounded-lg bg-[#e5a93c] px-3 py-1.5 text-xs font-semibold text-[#080a0d] hover:bg-[#f2be5c]"
                  >
                    Re-select with Audio
                  </button>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  id="btn-yttv-switch-tab"
                  type="button"
                  onClick={() =>
                    void onStartTabShare(screenShareQuality, 'YouTube TV Live')
                  }
                  className="rounded-xl border border-[#f4f1ea]/15 bg-[#141922] px-3.5 py-2 text-xs font-medium text-[#c7c2b8] hover:text-[#f4f1ea]"
                >
                  Switch Shared Tab
                </button>
                <button
                  id="btn-yttv-stop-stream"
                  type="button"
                  onClick={onStopTabShare}
                  className="rounded-xl bg-[#e05a47] px-4 py-2 text-xs font-semibold text-[#f4f1ea] hover:bg-[#ea6b58]"
                >
                  Stop Streaming Tab
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-stretch justify-between gap-2.5 sm:flex-row sm:items-center">
              <p className="text-[11px] text-[#9ca3af]">
                Tip: In the browser picker, choose the <strong>Chrome Tab</strong> tab, click your{' '}
                <strong>YouTube TV</strong> tab, and keep <strong>&ldquo;Also share tab audio&rdquo;</strong> checked.
              </p>
              <button
                id="btn-yttv-start-stream"
                type="button"
                onClick={() =>
                  void onStartTabShare(screenShareQuality, 'YouTube TV Live')
                }
                className="shrink-0 inline-flex items-center justify-center gap-2 rounded-xl bg-[#e05a47] px-4 py-2.5 text-xs font-semibold text-[#f4f1ea] shadow-lg transition hover:bg-[#ea6b58]"
              >
                <MonitorUp className="h-4 w-4" />
                <span>Stream YouTube TV Tab to Lounge</span>
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ============================================================================
  // MODE === 'account' ("My YouTube" Personal Account & Pinning Library)
  // ============================================================================
  const isSignedIn = accountState.authProvider !== 'none'
  const oauthOrigin = typeof window !== 'undefined' ? window.location.origin : ''
  const oauthRedirect = getGoogleOAuthRedirectUri()

  return (
    <div id="panel-youtube-account" className="mt-3.5 space-y-3">
      {/* Row 1: Connected Account Status OR Sign-In Options */}
      {isSignedIn ? (
        <div
          id="yt-account-connected-bar"
          className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#49b384]/35 bg-[#49b384]/10 px-3.5 py-2.5"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {accountState.avatarUrl ? (
              <img
                src={accountState.avatarUrl}
                alt=""
                className="h-8 w-8 rounded-full border border-[#49b384]/50 object-cover"
              />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#49b384]/25 text-[#49b384]">
                <UserCheck className="h-4 w-4" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="truncate text-xs font-semibold text-[#f4f1ea]">
                  {accountState.displayName}
                </span>
                <span className="rounded-md bg-[#49b384]/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#49b384]">
                  {accountState.authProvider === 'google'
                    ? 'Google OAuth'
                    : accountState.authProvider === 'piped'
                      ? 'Piped Sync'
                      : 'YouTube Connected'}
                </span>
              </div>
              {accountState.handle && (
                <div className="truncate text-[11px] text-[#9ca3af]">
                  {accountState.handle}
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              id="btn-yt-open-web-popup"
              type="button"
              onClick={() =>
                void openYouTubeWebLoginPopup(
                  accountState.handle || accountState.displayName,
                  'https://www.youtube.com/feed/subscriptions',
                )
              }
              className="inline-flex items-center gap-1 rounded-lg border border-[#f4f1ea]/12 bg-[#141922] px-2.5 py-1.5 text-xs text-[#c7c2b8] hover:border-[#e5a93c]/50 hover:text-[#f4f1ea]"
            >
              <ExternalLink className="h-3.5 w-3.5 text-[#e5a93c]" />
              <span>Open YouTube.com</span>
            </button>
            <button
              id="btn-yt-stream-signedin-tab"
              type="button"
              onClick={() => {
                if (isSharingTab) {
                  onStopTabShare()
                } else {
                  void onStartTabShare(screenShareQuality, 'YouTube Account Stream')
                }
              }}
              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${
                isSharingTab
                  ? 'border-[#e05a47] bg-[#e05a47]/20 text-[#f4f1ea]'
                  : 'border-[#38bdf8]/40 bg-[#38bdf8]/15 text-[#7dd3fc] hover:bg-[#38bdf8]/25'
              }`}
            >
              <MonitorUp className="h-3.5 w-3.5" />
              <span>{isSharingTab ? 'Stop Tab Stream' : 'Stream Signed-In Tab'}</span>
            </button>
            <button
              id="btn-yt-account-refresh"
              type="button"
              onClick={() => setRefreshNonce((n) => n + 1)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#f4f1ea]/12 bg-[#141922] px-2.5 py-1.5 text-xs text-[#c7c2b8] hover:text-[#f4f1ea]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span>Refresh</span>
            </button>
            <button
              id="btn-yt-signout"
              type="button"
              onClick={() => {
                signOutYouTubeAccount()
                setSelectedPinnedChannel(null)
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-[#e05a47]/35 bg-[#e05a47]/15 px-2.5 py-1.5 text-xs font-medium text-[#e05a47] hover:bg-[#e05a47]/25"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      ) : (
        <div
          id="yt-account-login-card"
          className="rounded-xl border border-[#e5a93c]/30 bg-gradient-to-br from-[#141a26] via-[#0d121c] to-[#171219] p-3.5 space-y-3"
        >
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-[#f4f1ea]">
                <LogIn className="h-4 w-4 text-[#e05a47]" />
                <span>Sign In to Your YouTube Account</span>
              </div>
              <div className="text-[11px] text-[#c7c2b8]">
                Enter your YouTube <code className="text-[#e5a93c]">@handle</code>, channel name, or Google email for instant library sync — or sign in directly on <code className="text-[#f4f1ea]">youtube.com</code> in a popup window.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                id="btn-yt-google-signin"
                type="button"
                disabled={authBusy}
                onClick={() => void handleGoogleSignInClick()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[#f4f1ea]/20 bg-[#1b2333] px-3 py-1.5 text-xs font-semibold text-[#f4f1ea] transition hover:border-[#e5a93c]/60 hover:bg-[#232d42]"
              >
                <ExternalLink className="h-3.5 w-3.5 text-[#e5a93c]" />
                <span>Sign In on YouTube.com (Popup)</span>
              </button>

              <button
                id="btn-yt-oauth-setup-toggle"
                type="button"
                onClick={() => {
                  setOauthSetupOpen((v) => !v)
                  setPipedLoginOpen(false)
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-[#f4f1ea]/12 bg-[#141922] px-2.5 py-1.5 text-xs text-[#c7c2b8] hover:text-[#f4f1ea]"
              >
                <KeyRound className="h-3.5 w-3.5 text-[#e5a93c]" />
                <span>OAuth Key</span>
              </button>

              <button
                id="btn-yt-piped-toggle"
                type="button"
                onClick={() => {
                  setPipedLoginOpen((v) => !v)
                  setOauthSetupOpen(false)
                }}
                className="inline-flex items-center gap-1 rounded-xl border border-[#f4f1ea]/12 bg-[#141922] px-2.5 py-1.5 text-xs text-[#c7c2b8] hover:text-[#f4f1ea]"
              >
                <Sparkles className="h-3.5 w-3.5 text-[#38bdf8]" />
                <span>Piped Login</span>
              </button>
            </div>
          </div>

          {/* Primary Instant Sign-In Form */}
          <form
            id="form-yt-direct-login"
            onSubmit={(e) => void handleDirectSignInSubmit(e)}
            className="flex flex-col gap-2 sm:flex-row"
          >
            <input
              id="input-yt-login-identity"
              type="text"
              value={identityDraft}
              onChange={(e) => setIdentityDraft(e.target.value)}
              placeholder="Your YouTube @handle (e.g. @dingbaum), email, or youtube.com/@channel..."
              className="lounge-input flex-1 rounded-xl px-3.5 py-2 text-xs"
            />
            <button
              id="btn-yt-direct-signin"
              type="submit"
              disabled={authBusy}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[#e05a47] px-4 py-2 text-xs font-semibold text-[#f4f1ea] shadow-md transition hover:bg-[#ea6b58] disabled:opacity-50"
            >
              <LogIn className="h-3.5 w-3.5" />
              <span>{authBusy ? 'Signing In…' : 'Sign In to YouTube'}</span>
            </button>
          </form>

          {oauthSetupOpen && (
            <div
              id="panel-yt-oauth-setup"
              className="space-y-2 rounded-xl border border-[#e5a93c]/35 bg-[#111622] p-3 text-xs"
            >
              <div className="font-semibold text-[#e5a93c]">
                Optional Google Cloud OAuth 2.0 Web Client ID (Read-Only YouTube API)
              </div>
              <p className="text-[11px] text-[#c7c2b8]">
                If you have a <strong>Google Cloud OAuth 2.0 Web Client ID</strong> with the <strong>YouTube Data API v3</strong> enabled, authorize the URL below and paste your Client ID here:
              </p>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => copyText(oauthOrigin, 'origin')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#f4f1ea]/12 bg-[#080a0d] px-2.5 py-1 text-[#c7c2b8] hover:text-[#f4f1ea]"
                >
                  {copiedField === 'origin' ? (
                    <Check className="h-3 w-3 text-[#49b384]" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>Origin: {oauthOrigin}</span>
                </button>
                <button
                  type="button"
                  onClick={() => copyText(oauthRedirect, 'redirect')}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#f4f1ea]/12 bg-[#080a0d] px-2.5 py-1 text-[#c7c2b8] hover:text-[#f4f1ea]"
                >
                  {copiedField === 'redirect' ? (
                    <Check className="h-3 w-3 text-[#49b384]" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                  <span>Redirect URI: {oauthRedirect}</span>
                </button>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="input-yt-google-client-id"
                  type="text"
                  value={clientIdDraft}
                  onChange={(e) => setClientIdDraft(e.target.value)}
                  placeholder="Paste Google OAuth Client ID (e.g. 123456789-abc.apps.googleusercontent.com)"
                  className="lounge-input flex-1 rounded-lg px-3 py-1.5 text-xs"
                />
                <button
                  id="btn-yt-save-google-client-id"
                  type="button"
                  onClick={() => {
                    setConfiguredGoogleClientId(clientIdDraft)
                    if (clientIdDraft.trim()) {
                      const res = startGoogleYouTubeSignIn({ clientId: clientIdDraft })
                      if (!res.ok && res.error) setAuthError(res.error)
                    } else {
                      setOauthSetupOpen(false)
                    }
                  }}
                  className="rounded-lg bg-[#e5a93c] px-3.5 py-1.5 text-xs font-semibold text-[#080a0d] hover:bg-[#f2be5c]"
                >
                  Save &amp; Sign In
                </button>
              </div>
            </div>
          )}

          {pipedLoginOpen && (
            <form
              onSubmit={(e) => void handlePipedSubmit(e)}
              className="grid grid-cols-1 gap-2 rounded-xl border border-[#38bdf8]/35 bg-[#111622] p-3 sm:grid-cols-4"
            >
              <input
                id="input-yt-piped-user"
                type="text"
                value={pipedUsername}
                onChange={(e) => setPipedUsername(e.target.value)}
                placeholder="Piped username"
                className="lounge-input rounded-lg px-2.5 py-1.5 text-xs"
              />
              <input
                id="input-yt-piped-pass"
                type="password"
                value={pipedPassword}
                onChange={(e) => setPipedPassword(e.target.value)}
                placeholder="Piped password"
                className="lounge-input rounded-lg px-2.5 py-1.5 text-xs"
              />
              <input
                type="url"
                value={pipedInstance}
                onChange={(e) => setPipedInstance(e.target.value)}
                placeholder="Optional API URL (auto)"
                className="lounge-input rounded-lg px-2.5 py-1.5 text-xs"
              />
              <button
                id="btn-yt-piped-submit"
                type="submit"
                disabled={authBusy}
                className="rounded-lg bg-[#38bdf8] px-3 py-1.5 text-xs font-semibold text-[#080a0d] disabled:opacity-50"
              >
                {authBusy ? 'Signing in…' : 'Connect Piped'}
              </button>
            </form>
          )}
        </div>
      )}

      {/* Row 2: Instant Zero-Setup Playlist & @Channel Pin Bar */}
      <form onSubmit={(e) => void handlePinSourceSubmit(e)} className="flex gap-2">
        <input
          id="input-yt-pin-source"
          type="text"
          value={pinInput}
          onChange={(e) => setPinInput(e.target.value)}
          placeholder="Instant Pin (no login required): paste unlisted/public YouTube Playlist URL (?list=PL...) or @Channel handle..."
          className="lounge-input flex-1 rounded-xl px-3.5 py-2 text-xs"
        />
        <button
          id="btn-yt-pin-auto"
          type="submit"
          disabled={pinBusy || !pinInput.trim()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#e5a93c] px-3.5 py-2 text-xs font-semibold text-[#080a0d] transition hover:bg-[#f2be5c] disabled:opacity-50"
        >
          <BookmarkPlus className="h-3.5 w-3.5" />
          <span>{pinBusy ? 'Adding…' : 'Pin to Library'}</span>
        </button>
      </form>

      {authError && (
        <p className="rounded-lg bg-[#e05a47]/15 px-3 py-1.5 text-[11px] text-[#e05a47]">
          {authError}
        </p>
      )}

      {/* Row 3: Personal Feed Sub-Tabs & Pinned Source Chips */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          <button
            id="btn-yt-subtab-subscriptions"
            type="button"
            onClick={() => {
              setSelectedPinnedChannel(null)
              setSection('subscriptions')
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              !selectedPinnedChannel && section === 'subscriptions'
                ? 'bg-[#e5a93c] text-[#080a0d]'
                : 'bg-[#141922] text-[#c7c2b8] hover:text-[#f4f1ea]'
            }`}
          >
            <Play className="h-3 w-3" />
            <span>Subscriptions</span>
          </button>

          <button
            id="btn-yt-subtab-playlists"
            type="button"
            onClick={() => {
              setSelectedPinnedChannel(null)
              setSection('playlists')
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              !selectedPinnedChannel && section === 'playlists'
                ? 'bg-[#e5a93c] text-[#080a0d]'
                : 'bg-[#141922] text-[#c7c2b8] hover:text-[#f4f1ea]'
            }`}
          >
            <FolderHeart className="h-3 w-3" />
            <span>My Playlists {playlists.length > 0 ? `(${playlists.length})` : ''}</span>
          </button>

          <button
            id="btn-yt-subtab-liked"
            type="button"
            onClick={() => {
              setSelectedPinnedChannel(null)
              setSection('liked')
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
              !selectedPinnedChannel && section === 'liked'
                ? 'bg-[#e5a93c] text-[#080a0d]'
                : 'bg-[#141922] text-[#c7c2b8] hover:text-[#f4f1ea]'
            }`}
          >
            <ThumbsUp className="h-3 w-3" />
            <span>Liked Videos</span>
          </button>

          {accountState.pinnedSources.length > 0 && (
            <button
              id="btn-yt-subtab-pinned"
              type="button"
              onClick={() => {
                setSelectedPinnedChannel(null)
                setSection('pinned')
              }}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                !selectedPinnedChannel && section === 'pinned'
                  ? 'bg-[#e5a93c] text-[#080a0d]'
                  : 'bg-[#141922] text-[#c7c2b8] hover:text-[#f4f1ea]'
              }`}
            >
              <span>📌 Pinned ({accountState.pinnedSources.length})</span>
            </button>
          )}
        </div>

        {providerLabel && (
          <span className="text-[11px] text-[#8a867e]">Source: {providerLabel}</span>
        )}
      </div>

      {/* Playlist Selector Pills when viewing My Playlists */}
      {!selectedPinnedChannel && section === 'playlists' && playlists.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {playlists.map((pl) => (
            <button
              key={pl.id}
              type="button"
              onClick={() => setSelectedPlaylistId(pl.id)}
              className={`rounded-lg border px-2.5 py-1 text-[11px] font-medium transition ${
                selectedPlaylistId === pl.id
                  ? 'border-[#38bdf8] bg-[#38bdf8]/20 text-[#7dd3fc]'
                  : 'border-[#f4f1ea]/10 bg-[#0d1118] text-[#c7c2b8] hover:text-[#f4f1ea]'
              }`}
            >
              📂 {pl.title}
              {pl.itemCount > 0 ? ` (${pl.itemCount})` : ''}
            </button>
          ))}
        </div>
      )}

      {/* Pinned Playlist / Followed Channel Quick-Filter Chips */}
      {accountState.pinnedSources.length > 0 && (
        <div id="yt-pinned-sources-list" className="flex flex-wrap gap-1.5">
          {accountState.pinnedSources.map((src) => {
            const isSelected =
              (src.kind === 'channel' && selectedPinnedChannel?.id === src.id) ||
              (src.kind === 'playlist' &&
                !selectedPinnedChannel &&
                section === 'playlists' &&
                selectedPlaylistId === src.ref)
            return (
              <div
                key={src.id}
                className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] ${
                  isSelected
                    ? 'border-[#e5a93c]/60 bg-[#e5a93c]/15 text-[#f4f1ea]'
                    : 'border-[#f4f1ea]/10 bg-[#0d1118] text-[#c7c2b8]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (src.kind === 'playlist') {
                      setSelectedPinnedChannel(null)
                      setSection('playlists')
                      setSelectedPlaylistId(src.ref)
                    } else {
                      setSelectedPinnedChannel(src)
                    }
                  }}
                  className="hover:text-[#f4f1ea]"
                >
                  {src.kind === 'playlist' ? '📂' : '📺'} {src.title}
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${src.title}`}
                  onClick={() => {
                    if (selectedPinnedChannel?.id === src.id) {
                      setSelectedPinnedChannel(null)
                    }
                    removePinnedLibrarySource(src.id)
                  }}
                  className="ml-0.5 text-[#8a867e] hover:text-[#e05a47]"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {notice && (
        <p className="rounded-lg bg-[#e5a93c]/10 px-3 py-1.5 text-[11px] text-[#e5a93c]">
          {notice}
        </p>
      )}

      {/* Video Cards Grid */}
      <div className="lounge-scrollbar max-h-64 overflow-y-auto pr-1">
        {loading ? (
          <div className="py-10 text-center text-xs text-[#c7c2b8]">
            Loading your personal YouTube feed…
          </div>
        ) : items.length === 0 ? (
          <div className="py-8 text-center text-xs text-[#8a867e]">
            No videos found yet — sign in above with your YouTube <code className="text-[#e5a93c]">@handle</code> or pin any YouTube playlist / <code className="text-[#e5a93c]">@Channel</code>!
          </div>
        ) : (
          <div id="yt-personal-video-grid" className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {items.slice(0, 16).map((item) => {
              const liked = isYouTubeVideoLiked(item.videoId)
              return (
                <div
                  key={item.id}
                  className="group flex items-center gap-3 rounded-xl border border-[#f4f1ea]/10 bg-[#080a0d]/75 p-2 text-left transition hover:border-[#e5a93c]/60 hover:bg-[#121824]"
                >
                  <button
                    type="button"
                    onClick={() => onPlayVideo(item.playUrl, item.title)}
                    className="flex min-w-0 flex-1 items-center gap-3 text-left"
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
                      {item.durationSec > 0 && (
                        <span className="absolute bottom-1 right-1 rounded bg-[#080a0d]/90 px-1 py-0.5 font-mono text-[10px] text-[#f4f1ea]">
                          {formatVideoDurationBadge(item.durationSec)}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 text-xs font-medium leading-snug text-[#f4f1ea] group-hover:text-[#e5a93c]">
                        {item.title}
                      </div>
                      <div className="mt-1 truncate text-[11px] text-[#8a867e]">
                        {[
                          item.author,
                          item.views > 0 ? formatCompactViews(item.views) : item.uploadedText,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    title={liked ? 'Remove from Liked Videos' : 'Save to Liked Videos'}
                    onClick={() => toggleLikeYouTubeVideo(item)}
                    className={`shrink-0 rounded-lg p-1.5 text-xs transition ${
                      liked
                        ? 'bg-[#e05a47]/20 text-[#e05a47]'
                        : 'text-[#8a867e] hover:bg-[#f4f1ea]/10 hover:text-[#f4f1ea]'
                    }`}
                  >
                    <ThumbsUp className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
