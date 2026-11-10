import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AVATAR_COLORS,
  AVATAR_STYLES,
  DEFAULT_AVATAR_CUSTOMIZATION,
  loadSavedAvatarPreferences,
  resolveAvatarCustomization,
  saveAvatarPreferences,
} from '../constants/avatars'
import {
  CANONICAL_ROOM_CODE,
  createInitialPresenterState,
} from '../constants/cinema'
import {
  FREE_ROAM_SEAT_ID,
  computeRoomSeats,
  createDefaultRoomCustomization,
} from '../constants/hangout'
import {
  ensureMemberIdentity,
  getInitialMemberUserId,
} from '../services/identityAuth'
import {
  NES_LIBRARY_CARTRIDGES,
  getNesEmulator,
  isNesMediaUrl,
  parseNesCartridgeIdFromUrl,
} from '../services/nesEmulator'
import {
  buildRetainedNesVaultPayload,
  buildRetainedProfilesVaultPayload,
  initializePersistentVault,
  mergeIncomingNesVaultPayload,
  mergeIncomingProfilesVaultPayload,
  recordMemberProfileToVault,
  storeNesSaveSlot,
} from '../services/persistentVault'
import { RoomRealtimeService, hasSupabaseCredentials } from '../services/realtime'
import {
  clearLocalRoomCustomization,
  fetchCloudRoomCustomization,
  loadLocalRoomCustomization,
  sanitizeRoomCustomization,
  saveLocalRoomCustomization,
  scheduleCloudRoomSave,
} from '../services/roomStorage'
import type { BarGamesWireEvent } from '../types/barGames'
import type {
  AvatarCustomization,
  AvatarPose6DoF,
  AvatarStyleId,
  ChatMessage,
  ComputedSeat,
  FloatingReaction,
  NesMultiplayerState,
  NesSaveSlotMeta,
  NesWireEvent,
  ParticipantProfile,
  PresenterState,
  RoomCustomizationState,
  ScreenMode,
  TransportMode,
  WebRTCSignalMessage,
} from '../types/lounge'

export interface JoinRoomOptions {
  roomCode?: string
  displayName: string
  avatarColor: string
  avatarStyle: AvatarStyleId
  avatarCustomization?: AvatarCustomization
  inVR: boolean
  isMuted: boolean
}

export interface BarGamesTransportBridge {
  onRoomJoined: (roomCode: string, sendEvent: (event: BarGamesWireEvent) => void) => void
  onRoomConnected: (sendEvent: (event: BarGamesWireEvent) => void) => void
  onEvent: (event: BarGamesWireEvent) => void
  onStateRequest: (
    requesterId: string,
    isHost: boolean,
    sendEvent: (event: BarGamesWireEvent) => void,
  ) => void
  onRoomLeft: () => void
}

function isNewerCustomization(
  incoming: RoomCustomizationState,
  current: RoomCustomizationState,
): boolean {
  if (incoming.revision <= 0 && incoming.updatedAt <= 0) return false
  if (current.revision <= 0 && current.updatedAt <= 0) return true
  if (incoming.updatedAt !== current.updatedAt) {
    return incoming.updatedAt > current.updatedAt
  }
  return incoming.revision > current.revision
}

export function useRoomSession(
  onWebRTCSignalRef: React.RefObject<((signal: WebRTCSignalMessage) => void) | null>,
) {
  const barGamesBridgeRef = useRef<BarGamesTransportBridge | null>(null)
  const [localUserId, setLocalUserId] = useState<string>(() =>
    getInitialMemberUserId(),
  )
  const [joined, setJoined] = useState(false)
  const [connected, setConnected] = useState(false)
  const [roomCode, setRoomCode] = useState(CANONICAL_ROOM_CODE)
  const [transportMode, setTransportMode] = useState<TransportMode>(() =>
    hasSupabaseCredentials() ? 'supabase' : 'cloud-relay',
  )

  const [roomCustomization, setRoomCustomization] = useState<RoomCustomizationState>(
    () =>
      loadLocalRoomCustomization(CANONICAL_ROOM_CODE) ??
      createDefaultRoomCustomization(),
  )

  const computedSeats = useMemo<ComputedSeat[]>(
    () => computeRoomSeats(roomCustomization),
    [roomCustomization],
  )

  const [localProfile, setLocalProfile] = useState<ParticipantProfile>(() => {
    const saved = loadSavedAvatarPreferences()
    const firstSeatId = computedSeats[0]?.id ?? 'furn-sofa-front:0'
    return {
      userId: localUserId,
      displayName: saved?.displayName || 'Guest',
      avatarColor: saved?.avatarColor ?? AVATAR_COLORS[0].hex,
      avatarStyle: saved?.avatarStyle ?? AVATAR_STYLES[0].id,
      avatarCustomization:
        saved?.avatarCustomization ?? { ...DEFAULT_AVATAR_CUSTOMIZATION },
      seatIndex: 0,
      seatId: firstSeatId,
      isHost: true,
      isMuted: false,
      inVR: false,
      joinedAt: Date.now(),
      verifiedKeyTag: localUserId.startsWith('u_')
        ? localUserId.slice(2, 6).toUpperCase()
        : undefined,
    }
  })

  useEffect(() => {
    let cancelled = false
    void initializePersistentVault().then(() => {
      if (cancelled) return
      const hydratedLayout = loadLocalRoomCustomization(CANONICAL_ROOM_CODE)
      if (hydratedLayout) {
        setRoomCustomization((prev) =>
          isNewerCustomization(hydratedLayout, prev) ? hydratedLayout : prev,
        )
      }
      const savedPrefs = loadSavedAvatarPreferences()
      if (savedPrefs?.displayName) {
        const safeName = savedPrefs.displayName
        setLocalProfile((prev) => ({
          ...prev,
          displayName: safeName,
          avatarColor: savedPrefs.avatarColor ?? prev.avatarColor,
          avatarStyle: savedPrefs.avatarStyle ?? prev.avatarStyle,
          avatarCustomization:
            savedPrefs.avatarCustomization ?? prev.avatarCustomization,
        }))
      }
    })
    void ensureMemberIdentity().then((identity) => {
      if (cancelled) return
      setLocalUserId((prev) => (prev === identity.userId ? prev : identity.userId))
      setLocalProfile((prev) =>
        prev.userId === identity.userId && prev.verifiedKeyTag === identity.keyTag
          ? prev
          : {
              ...prev,
              userId: identity.userId,
              verifiedKeyTag: identity.keyTag,
            },
      )
    })
    return () => {
      cancelled = true
    }
  }, [])

  const [participants, setParticipants] = useState<ParticipantProfile[]>([])
  const [presenterState, setPresenterState] = useState<PresenterState>(() =>
    createInitialPresenterState(),
  )
  const [nesMultiplayerState, setNesMultiplayerState] = useState<NesMultiplayerState>(
    () => ({
      cartridgeId: NES_LIBRARY_CARTRIDGES[0].id,
      cartridgeTitle: NES_LIBRARY_CARTRIDGES[0].title,
      player1Id: null,
      player1Name: null,
      player2Id: null,
      player2Name: null,
      revision: 0,
      updatedAt: 0,
    }),
  )
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<FloatingReaction[]>([])

  // High-frequency 6DoF remote pose buffer (read inside R3F useFrame without triggering React re-renders)
  const remotePosesRef = useRef<Map<string, AvatarPose6DoF>>(new Map())
  const serviceRef = useRef<RoomRealtimeService | null>(null)
  const presenterStateRef = useRef<PresenterState>(presenterState)
  const nesMultiplayerStateRef = useRef<NesMultiplayerState>(nesMultiplayerState)
  const roomCustomizationRef = useRef<RoomCustomizationState>(roomCustomization)
  const computedSeatsRef = useRef<ComputedSeat[]>(computedSeats)
  const localProfileRef = useRef<ParticipantProfile>(localProfile)
  const participantsRef = useRef<ParticipantProfile[]>(participants)
  const roomCodeRef = useRef<string>(roomCode)
  const joinedAtRef = useRef<number>(0)
  const lastImportedCheckpointTsRef = useRef<number>(0)
  const prevDriverMaskRef = useRef<number>(0)

  useEffect(() => {
    presenterStateRef.current = presenterState
  }, [presenterState])

  useEffect(() => {
    nesMultiplayerStateRef.current = nesMultiplayerState
  }, [nesMultiplayerState])

  useEffect(() => {
    roomCustomizationRef.current = roomCustomization
  }, [roomCustomization])

  useEffect(() => {
    computedSeatsRef.current = computedSeats
  }, [computedSeats])

  useEffect(() => {
    localProfileRef.current = localProfile
  }, [localProfile])

  useEffect(() => {
    participantsRef.current = participants
  }, [participants])

  useEffect(() => {
    roomCodeRef.current = roomCode
  }, [roomCode])

  const resolveAuthoritativeNesDriverId = useCallback((): string | null => {
    const activeIds = new Set(participantsRef.current.map((p) => p.userId))
    activeIds.add(localUserId)
    const mp = nesMultiplayerStateRef.current
    if (mp.player1Id && activeIds.has(mp.player1Id)) {
      return mp.player1Id
    }
    const pres = presenterStateRef.current
    if (pres.activePresenterId && activeIds.has(pres.activePresenterId)) {
      return pres.activePresenterId
    }
    if (mp.player2Id && activeIds.has(mp.player2Id)) {
      return mp.player2Id
    }
    const host = participantsRef.current.find((p) => p.isHost)
    return host?.userId ?? (localProfileRef.current.isHost ? localUserId : null)
  }, [localUserId])

  const broadcastLiveNesCheckpoint = useCallback(async (): Promise<boolean> => {
    const svc = serviceRef.current
    if (!svc) return false
    const emu = getNesEmulator()
    if (!emu.isRomLoaded()) return false
    const compressed = await emu.exportCompressedState()
    if (!compressed) return false
    svc.broadcastNesEvent({
      kind: 'nes-state-checkpoint',
      cartridgeId: emu.getActiveCartridge().id,
      senderId: localUserId,
      compressedState: compressed,
      timestamp: Date.now(),
    })
    return true
  }, [localUserId])

  // Stream local NES controller inputs to peers and auto-claim Player 1 if unclaimed when playing on screen
  useEffect(() => {
    const emu = getNesEmulator()
    const unsubscribeInput = emu.onLocalInputMaskChange((player, buttonsMask, seq) => {
      const svc = serviceRef.current
      if (!svc) return
      const mp = nesMultiplayerStateRef.current
      const pres = presenterStateRef.current
      const isNesOnScreen =
        pres.screenMode === 'url-sync' && isNesMediaUrl(pres.mediaUrl)

      if (
        isNesOnScreen &&
        player === 1 &&
        buttonsMask !== 0 &&
        !mp.player1Id &&
        mp.player2Id !== localUserId
      ) {
        const me = localProfileRef.current
        const activeCart = emu.getActiveCartridge()
        const autoMp: NesMultiplayerState = {
          cartridgeId: activeCart.id,
          cartridgeTitle: activeCart.title,
          player1Id: localUserId,
          player1Name: me.displayName,
          player2Id: mp.player2Id,
          player2Name: mp.player2Name,
          revision: mp.revision + 1,
          updatedAt: Date.now(),
        }
        nesMultiplayerStateRef.current = autoMp
        setNesMultiplayerState(autoMp)
        svc.broadcastNesEvent({
          kind: 'nes-multiplayer-state',
          state: autoMp,
        })
      }

      const curMp = nesMultiplayerStateRef.current
      const isParticipant =
        curMp.player1Id === localUserId || curMp.player2Id === localUserId
      const isSlotOpen =
        player === 1
          ? !curMp.player1Id || curMp.player1Id === localUserId
          : !curMp.player2Id || curMp.player2Id === localUserId
      const canBroadcastInput =
        isParticipant ||
        emu.getEngagedPlayerSlot() !== null ||
        (isNesOnScreen && isSlotOpen) ||
        pres.activePresenterId === localUserId

      if (!canBroadcastInput) return

      svc.broadcastNesEvent({
        kind: 'nes-input',
        player,
        senderId: localUserId,
        cartridgeId: emu.getActiveCartridge().id,
        buttonsMask,
        seq,
        timestamp: Date.now(),
      })

      // When the authoritative driver presses/releases START (bit 3) or SELECT (bit 2),
      // broadcast a state checkpoint 180ms later so title-screen/mode/pause transitions lock in across all peers.
      if (
        player === 1 &&
        isNesOnScreen &&
        resolveAuthoritativeNesDriverId() === localUserId
      ) {
        const changedBits = buttonsMask ^ prevDriverMaskRef.current
        prevDriverMaskRef.current = buttonsMask
        if ((changedBits & 0b00001100) !== 0) {
          window.setTimeout(() => {
            if (resolveAuthoritativeNesDriverId() === localUserId) {
              void broadcastLiveNesCheckpoint()
            }
          }, 180)
        }
      }
    })
    const unsubscribeSaves = emu.onSaveSlotsChanged(() => {
      const svc = serviceRef.current
      if (!svc) return
      svc.publishRetainedNesVault(buildRetainedNesVaultPayload())
    })
    return () => {
      unsubscribeInput()
      unsubscribeSaves()
    }
  }, [broadcastLiveNesCheckpoint, localUserId, resolveAuthoritativeNesDriverId])

  // Periodic authoritative NES hardware state synchronization so peers never drift or freeze out of sync
  useEffect(() => {
    const isNesOnScreen =
      joined &&
      presenterState.screenMode === 'url-sync' &&
      isNesMediaUrl(presenterState.mediaUrl)
    if (!isNesOnScreen || participants.length <= 1) return

    const initialTimer = window.setTimeout(() => {
      if (resolveAuthoritativeNesDriverId() === localUserId) {
        void broadcastLiveNesCheckpoint()
      }
    }, 650)

    const intervalId = window.setInterval(() => {
      if (resolveAuthoritativeNesDriverId() === localUserId) {
        void broadcastLiveNesCheckpoint()
      }
    }, 2500)

    return () => {
      window.clearTimeout(initialTimer)
      window.clearInterval(intervalId)
    }
  }, [
    broadcastLiveNesCheckpoint,
    joined,
    localUserId,
    participants.length,
    presenterState.mediaUrl,
    presenterState.screenMode,
    resolveAuthoritativeNesDriverId,
  ])

  // Hydrate from cloud storage on initial mount and guarantee flush on pagehide/beforeunload
  useEffect(() => {
    void fetchCloudRoomCustomization(CANONICAL_ROOM_CODE).then((cloudState) => {
      if (!cloudState) return
      setRoomCustomization((prev) => {
        if (!isNewerCustomization(cloudState, prev)) return prev
        roomCustomizationRef.current = cloudState
        saveLocalRoomCustomization(CANONICAL_ROOM_CODE, cloudState)
        return cloudState
      })
    })

    const flushLayoutToStorage = () => {
      const current = roomCustomizationRef.current
      if (current.revision > 0 || current.updatedAt > 0) {
        saveLocalRoomCustomization(CANONICAL_ROOM_CODE, current)
      }
      getNesEmulator().persistBatterySram()
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        flushLayoutToStorage()
      } else if (document.visibilityState === 'visible') {
        if (serviceRef.current) {
          void serviceRef.current.updatePresence(localProfileRef.current)
          serviceRef.current.requestRoomState()
        }
      }
    }

    window.addEventListener('beforeunload', flushLayoutToStorage)
    window.addEventListener('pagehide', flushLayoutToStorage)
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.removeEventListener('beforeunload', flushLayoutToStorage)
      window.removeEventListener('pagehide', flushLayoutToStorage)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [])

  // Periodically prune stale remote 6DoF poses for departed peers
  useEffect(() => {
    if (!joined) return
    const timer = window.setInterval(() => {
      const now = Date.now()
      const activeIds = new Set(participants.map((p) => p.userId))
      for (const [uid, pose] of remotePosesRef.current.entries()) {
        if (!activeIds.has(uid) && now - (pose.timestamp || 0) > 15_000) {
          remotePosesRef.current.delete(uid)
        }
      }
    }, 15_000)
    return () => window.clearInterval(timer)
  }, [joined, participants])

  // Prune expired floating 3D emoji reactions every 500ms
  useEffect(() => {
    if (reactions.length === 0) return
    const timer = window.setInterval(() => {
      const cutoff = Date.now() - 3800
      setReactions((prev) => {
        const filtered = prev.filter((r) => r.createdAt > cutoff)
        return filtered.length === prev.length ? prev : filtered
      })
    }, 500)
    return () => window.clearInterval(timer)
  }, [reactions.length])

  const appendSystemMessage = useCallback((text: string) => {
    setMessages((prev) => [
      ...prev.slice(-79),
      {
        id: `sys-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: 'system',
        displayName: 'Lounge',
        avatarColor: '#E5A93C',
        text,
        createdAt: Date.now(),
        isSystem: true,
      },
    ])
  }, [])

  const updateLocalProfile = useCallback(
    (patch: Partial<ParticipantProfile>) => {
      setLocalProfile((prev) => {
        const changed = (Object.keys(patch) as Array<keyof ParticipantProfile>).some(
          (key) => patch[key] !== undefined && prev[key] !== patch[key],
        )
        if (!changed) return prev
        const next = { ...prev, ...patch }
        void serviceRef.current?.updatePresence(next)
        return next
      })
      setParticipants((prev) => {
        const me = prev.find((p) => p.userId === localUserId)
        if (!me) return prev
        const changed = (Object.keys(patch) as Array<keyof ParticipantProfile>).some(
          (key) => patch[key] !== undefined && me[key] !== patch[key],
        )
        if (!changed) return prev
        return prev.map((p) => (p.userId === localUserId ? { ...p, ...patch } : p))
      })
    },
    [localUserId],
  )

  // Keep localProfile.seatId & seatIndex valid if furniture was deleted or reordered
  useEffect(() => {
    if (!joined || computedSeats.length === 0) return
    if (localProfile.seatId === FREE_ROAM_SEAT_ID) return
    const matchedById = localProfile.seatId
      ? computedSeats.find((s) => s.id === localProfile.seatId)
      : undefined

    if (matchedById) {
      if (matchedById.index !== localProfile.seatIndex) {
        updateLocalProfile({ seatIndex: matchedById.index })
      }
      return
    }

    // Current seat furniture was removed -> pick first unoccupied seat
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
    const fallbackSeat =
      computedSeats.find(
        (s) => !takenIds.has(s.id) && (!s.stationKind || s.stationKind === 'seat'),
      ) ??
      computedSeats.find((s) => !takenIds.has(s.id)) ??
      computedSeats[localProfile.seatIndex % computedSeats.length] ??
      computedSeats[0]

    if (fallbackSeat) {
      updateLocalProfile({
        seatId: fallbackSeat.id,
        seatIndex: fallbackSeat.index,
      })
    }
  }, [
    computedSeats,
    joined,
    localProfile.seatId,
    localProfile.seatIndex,
    localUserId,
    participants,
    updateLocalProfile,
  ])

  const joinRoom = useCallback(
    async (opts: JoinRoomOptions) => {
      if (serviceRef.current) {
        await serviceRef.current.disconnect()
        serviceRef.current = null
      }
      remotePosesRef.current.clear()

      const identity = await ensureMemberIdentity()
      const activeLocalId = identity.userId
      setLocalUserId(activeLocalId)

      const normalizedCode = CANONICAL_ROOM_CODE
      const diskLayout = loadLocalRoomCustomization(normalizedCode)
      const currentMemLayout = roomCustomizationRef.current
      const savedLocalLayout =
        diskLayout && isNewerCustomization(diskLayout, currentMemLayout)
          ? diskLayout
          : currentMemLayout.revision > 0 || currentMemLayout.updatedAt > 0
            ? currentMemLayout
            : (diskLayout ?? createDefaultRoomCustomization())
      const initialSeats = computeRoomSeats(savedLocalLayout)
      const firstSeat = initialSeats[0]

      const resolvedCustomization = resolveAvatarCustomization(
        opts.avatarCustomization ?? localProfileRef.current.avatarCustomization,
      )
      const cleanName = opts.displayName.trim() || 'Cinema Guest'
      saveAvatarPreferences({
        displayName: cleanName,
        avatarColor: opts.avatarColor,
        avatarStyle: opts.avatarStyle,
        avatarCustomization: resolvedCustomization,
      })

      const initialProfile: ParticipantProfile = {
        userId: activeLocalId,
        displayName: cleanName,
        avatarColor: opts.avatarColor,
        avatarStyle: opts.avatarStyle,
        avatarCustomization: resolvedCustomization,
        seatIndex: 0,
        seatId: firstSeat?.id ?? 'furn-sofa-front:0',
        isHost: false,
        isMuted: opts.isMuted,
        inVR: opts.inVR,
        joinedAt: Date.now(),
        verifiedKeyTag: identity.keyTag,
      }

      setRoomCode(normalizedCode)
      roomCodeRef.current = normalizedCode
      setRoomCustomization(savedLocalLayout)
      roomCustomizationRef.current = savedLocalLayout
      setLocalProfile(initialProfile)
      setParticipants([initialProfile])
      setPresenterState(createInitialPresenterState())
      setMessages([])

      let seatSettled = false
      let announcedSavedLayout = false

      const service = new RoomRealtimeService(normalizedCode, initialProfile, {
        onConnectionStatus: (isOnline) => {
          setConnected(isOnline)
          if (isOnline) {
            if (!announcedSavedLayout && roomCustomizationRef.current.revision > 0) {
              announcedSavedLayout = true
              service.broadcastRoomCustomization(roomCustomizationRef.current)
            }
            barGamesBridgeRef.current?.onRoomConnected((ev) =>
              service.broadcastBarGamesEvent(ev),
            )
          }
        },
        onParticipantsChange: (roster) => {
          // Oldest participant in the room acts as deterministic host
          const sorted = [...roster].sort((a, b) =>
            a.joinedAt !== b.joinedAt
              ? a.joinedAt - b.joinedAt
              : a.userId.localeCompare(b.userId),
          )
          const hostId = sorted[0]?.userId ?? activeLocalId
          const hydrated = sorted.map((p) => ({
            ...p,
            isHost: p.userId === hostId,
          }))

          setParticipants(hydrated)

          // Remove stale poses for departed users
          const activeIds = new Set(hydrated.map((p) => p.userId))
          for (const key of remotePosesRef.current.keys()) {
            if (!activeIds.has(key)) {
              remotePosesRef.current.delete(key)
            }
          }

          // Auto-resolve seat collisions on initial join
          const me = hydrated.find((p) => p.userId === activeLocalId)
          if (me) {
            const seatsNow = computedSeatsRef.current
            const isSharedOrRoam =
              me.seatId === FREE_ROAM_SEAT_ID || me.seatId?.startsWith('station:')
            const occupiedByEarlierPeer =
              !isSharedOrRoam &&
              hydrated.some((other) => {
                if (other.userId === activeLocalId) return false
                if (other.seatId === FREE_ROAM_SEAT_ID) return false
                const sameSeat =
                  me.seatId && other.seatId
                    ? other.seatId === me.seatId
                    : other.seatIndex >= 0 && other.seatIndex === me.seatIndex
                if (!sameSeat) return false
                return (
                  other.joinedAt < me.joinedAt ||
                  (other.joinedAt === me.joinedAt && other.userId < me.userId)
                )
              })

            if (!seatSettled || occupiedByEarlierPeer) {
              seatSettled = true
              if (occupiedByEarlierPeer && seatsNow.length > 0) {
                const takenIds = new Set(
                  hydrated
                    .filter(
                      (other) =>
                        other.userId !== activeLocalId &&
                        other.seatId !== FREE_ROAM_SEAT_ID,
                    )
                    .map(
                      (other) =>
                        other.seatId ??
                        (other.seatIndex >= 0 ? seatsNow[other.seatIndex]?.id : undefined),
                    )
                    .filter(Boolean) as string[],
                )
                const freeSeat =
                  seatsNow.find(
                    (s) =>
                      !takenIds.has(s.id) &&
                      (!s.stationKind || s.stationKind === 'seat'),
                  ) ??
                  seatsNow.find((s) => !takenIds.has(s.id)) ??
                  seatsNow[hydrated.length % seatsNow.length] ??
                  seatsNow[0]
                setLocalProfile((prev) => ({
                  ...prev,
                  displayName: me.displayName,
                  verifiedKeyTag: me.verifiedKeyTag ?? prev.verifiedKeyTag,
                  seatIndex: freeSeat.index,
                  seatId: freeSeat.id,
                  isHost: hostId === activeLocalId,
                }))
                void service.updatePresence({
                  displayName: me.displayName,
                  verifiedKeyTag: me.verifiedKeyTag,
                  seatIndex: freeSeat.index,
                  seatId: freeSeat.id,
                  isHost: hostId === activeLocalId,
                })
                return
              }
            }

            setLocalProfile((prev) =>
              prev.isHost === (hostId === activeLocalId) &&
              prev.displayName === me.displayName
                ? prev
                : {
                    ...prev,
                    displayName: me.displayName,
                    verifiedKeyTag: me.verifiedKeyTag ?? prev.verifiedKeyTag,
                    isHost: hostId === activeLocalId,
                  },
            )
          }

          const pastJoinGrace = Date.now() - joinedAtRef.current > 8000

          // If the active presenter disconnected after the join grace period, hand off or release cleanly
          const currentPresenter = presenterStateRef.current.activePresenterId
          if (pastJoinGrace && currentPresenter && !activeIds.has(currentPresenter)) {
            setPresenterState((prev) => {
              const isNesUrl =
                prev.screenMode === 'url-sync' && isNesMediaUrl(prev.mediaUrl)
              if (isNesUrl) {
                const curMp = nesMultiplayerStateRef.current
                const fallbackId =
                  (curMp.player1Id && activeIds.has(curMp.player1Id)
                    ? curMp.player1Id
                    : null) ??
                  (curMp.player2Id && activeIds.has(curMp.player2Id)
                    ? curMp.player2Id
                    : null) ??
                  (hostId && activeIds.has(hostId) ? hostId : null)
                const fallbackPeer = fallbackId
                  ? hydrated.find((p) => p.userId === fallbackId)
                  : undefined
                return {
                  ...prev,
                  activePresenterId: fallbackId,
                  presenterName: fallbackPeer?.displayName ?? null,
                  updatedAt: Date.now(),
                }
              }
              return {
                ...prev,
                activePresenterId: null,
                presenterName: null,
                screenMode: prev.screenMode === 'tab-stream' ? 'idle' : prev.screenMode,
                isPlaying: prev.screenMode === 'tab-stream' ? false : prev.isPlaying,
                updatedAt: Date.now(),
              }
            })
          }

          // If an NES Player 1 or Player 2 controller holder disconnected, release their lock
          const curNes = nesMultiplayerStateRef.current
          const p1Gone =
            pastJoinGrace &&
            Boolean(curNes.player1Id && !activeIds.has(curNes.player1Id))
          const p2Gone =
            pastJoinGrace &&
            Boolean(curNes.player2Id && !activeIds.has(curNes.player2Id))
          if (p1Gone || p2Gone) {
            if (p1Gone) getNesEmulator().setRemotePlayerMask(1, 0)
            if (p2Gone) getNesEmulator().setRemotePlayerMask(2, 0)
            setNesMultiplayerState((prev) => {
              const next: NesMultiplayerState = {
                ...prev,
                player1Id: p1Gone ? null : prev.player1Id,
                player1Name: p1Gone ? null : prev.player1Name,
                player2Id: p2Gone ? null : prev.player2Id,
                player2Name: p2Gone ? null : prev.player2Name,
                revision: prev.revision + 1,
                updatedAt: Date.now(),
              }
              nesMultiplayerStateRef.current = next
              return next
            })
          }
        },
        onPoseUpdate: (pose) => {
          if (pose.userId !== activeLocalId) {
            remotePosesRef.current.set(pose.userId, pose)
          }
        },
        onPresenterState: (incoming) => {
          setPresenterState((prev) => {
            if (!prev.activePresenterId && incoming.activePresenterId) {
              return incoming
            }
            if (incoming.revision < prev.revision) return prev
            if (
              incoming.revision === prev.revision &&
              incoming.updatedAt < prev.updatedAt
            ) {
              return prev
            }
            return incoming
          })
        },
        onRoomCustomization: (incomingRaw) => {
          const incoming = sanitizeRoomCustomization(incomingRaw)
          if (!incoming) return
          setRoomCustomization((prev) => {
            if (!isNewerCustomization(incoming, prev)) return prev
            roomCustomizationRef.current = incoming
            saveLocalRoomCustomization(normalizedCode, incoming)
            return incoming
          })
        },
        onBarGamesEvent: (event) => {
          barGamesBridgeRef.current?.onEvent(event)
        },
        onNesEvent: (event: NesWireEvent) => {
          const emu = getNesEmulator()
          if (event.kind === 'nes-multiplayer-state') {
            setNesMultiplayerState((prev) => {
              if (event.state.revision < prev.revision) return prev
              const next = event.state
              nesMultiplayerStateRef.current = next
              if (
                next.cartridgeId &&
                next.cartridgeId !== 'custom-rom' &&
                emu.getActiveCartridge().id !== next.cartridgeId
              ) {
                emu.loadLibraryCartridge(next.cartridgeId)
              }
              if (next.player2Id === activeLocalId) {
                emu.setEngagedPlayerSlot(2)
              } else if (next.player1Id === activeLocalId) {
                emu.setEngagedPlayerSlot(1)
              } else if (emu.getEngagedPlayerSlot() !== null) {
                emu.setEngagedPlayerSlot(null)
              }
              if (resolveAuthoritativeNesDriverId() === activeLocalId) {
                window.setTimeout(() => {
                  if (resolveAuthoritativeNesDriverId() === activeLocalId) {
                    void broadcastLiveNesCheckpoint()
                  }
                }, 180)
              }
              return next
            })
          } else if (event.kind === 'nes-input') {
            if (event.senderId !== activeLocalId) {
              if (
                event.cartridgeId &&
                event.cartridgeId !== 'custom-rom' &&
                emu.getActiveCartridge().id !== event.cartridgeId
              ) {
                emu.loadLibraryCartridge(event.cartridgeId)
              }
              emu.setRemotePlayerMask(event.player, event.buttonsMask)
            }
          } else if (event.kind === 'nes-state-checkpoint') {
            if (event.senderId !== activeLocalId && event.compressedState) {
              if (
                event.timestamp &&
                event.timestamp < lastImportedCheckpointTsRef.current
              ) {
                return
              }
              lastImportedCheckpointTsRef.current = event.timestamp || Date.now()
              void emu.importCompressedState(
                event.compressedState,
                event.cartridgeId,
              )
            }
          } else if (event.kind === 'nes-save-slot-shared') {
            if (event.slot?.cartridgeId && event.slot?.slotId) {
              void storeNesSaveSlot(event.slot).then(() => {
                emu.notifySaveStateListeners(event.slot.cartridgeId)
              })
            }
          }
        },
        onRetainedNesVault: (payload) => {
          void mergeIncomingNesVaultPayload(payload).then((imported) => {
            if (imported > 0) {
              getNesEmulator().notifySaveStateListeners()
            }
          })
        },
        onRetainedProfilesVault: (payload) => {
          mergeIncomingProfilesVaultPayload(payload)
        },
        onRoomStateRequest: (requesterId) => {
          const current = presenterStateRef.current
          const me = localProfileRef.current
          if (
            current.revision > 0 &&
            (current.activePresenterId === activeLocalId || me.isHost)
          ) {
            // Include live playback progress when answering a late joiner
            const elapsed =
              current.isPlaying && current.screenMode === 'url-sync'
                ? (Date.now() - current.updatedAt) / 1000
                : 0
            service.broadcastPresenterState({
              ...current,
              currentTime: current.currentTime + elapsed,
              updatedAt: Date.now(),
            })
          }

          const currentCustom = roomCustomizationRef.current
          if (currentCustom.revision > 0 && me.isHost) {
            service.broadcastRoomCustomization(currentCustom)
          }

          const currentNesMp = nesMultiplayerStateRef.current
          if (
            currentNesMp.revision > 0 &&
            (me.isHost ||
              currentNesMp.player1Id === activeLocalId ||
              currentNesMp.player2Id === activeLocalId)
          ) {
            service.broadcastNesEvent({
              kind: 'nes-multiplayer-state',
              state: currentNesMp,
            })
          }

          if (
            current.screenMode === 'url-sync' &&
            isNesMediaUrl(current.mediaUrl) &&
            resolveAuthoritativeNesDriverId() === activeLocalId
          ) {
            void broadcastLiveNesCheckpoint()
          }

          barGamesBridgeRef.current?.onStateRequest(requesterId, me.isHost, (ev) =>
            service.broadcastBarGamesEvent(ev),
          )
        },
        onChatMessage: (msg) => {
          setMessages((prev) =>
            prev.some((existing) => existing.id === msg.id)
              ? prev
              : [...prev.slice(-79), msg],
          )
        },
        onReaction: (reaction) => {
          setReactions((prev) =>
            prev.some((r) => r.id === reaction.id) ? prev : [...prev.slice(-24), reaction],
          )
        },
        onWebRTCSignal: (signal) => {
          onWebRTCSignalRef.current?.(signal)
        },
      })

      serviceRef.current = service
      joinedAtRef.current = Date.now()
      recordMemberProfileToVault({
        displayName: cleanName,
        avatarColor: opts.avatarColor,
        avatarStyle: opts.avatarStyle,
        avatarCustomization: resolvedCustomization,
      })
      service.publishRetainedProfilesVault(buildRetainedProfilesVaultPayload())
      service.publishRetainedNesVault(buildRetainedNesVaultPayload())

      barGamesBridgeRef.current?.onRoomJoined(normalizedCode, (ev) =>
        service.broadcastBarGamesEvent(ev),
      )
      setTransportMode(service.mode)
      setJoined(true)
      await service.connect()

      // Optional cloud room_layouts table check in background
      void fetchCloudRoomCustomization(normalizedCode).then((cloudState) => {
        if (!cloudState || serviceRef.current !== service) return
        setRoomCustomization((prev) => {
          if (!isNewerCustomization(cloudState, prev)) return prev
          roomCustomizationRef.current = cloudState
          saveLocalRoomCustomization(normalizedCode, cloudState)
          service.broadcastRoomCustomization(cloudState)
          return cloudState
        })
      })

      appendSystemMessage(
        `Joined room ${normalizedCode} (${
          service.mode === 'supabase' ? 'Supabase Live' : 'Global Cloud Relay'
        }).`,
      )
    },
    [
      appendSystemMessage,
      broadcastLiveNesCheckpoint,
      localUserId,
      onWebRTCSignalRef,
      resolveAuthoritativeNesDriverId,
    ],
  )

  const leaveRoom = useCallback(async () => {
    const curNes = nesMultiplayerStateRef.current
    if (curNes.player1Id === localUserId || curNes.player2Id === localUserId) {
      const nextState: NesMultiplayerState = {
        ...curNes,
        player1Id: curNes.player1Id === localUserId ? null : curNes.player1Id,
        player1Name: curNes.player1Id === localUserId ? null : curNes.player1Name,
        player2Id: curNes.player2Id === localUserId ? null : curNes.player2Id,
        player2Name: curNes.player2Id === localUserId ? null : curNes.player2Name,
        revision: curNes.revision + 1,
        updatedAt: Date.now(),
      }
      nesMultiplayerStateRef.current = nextState
      setNesMultiplayerState(nextState)
      serviceRef.current?.broadcastNesEvent({
        kind: 'nes-multiplayer-state',
        state: nextState,
      })
    }
    getNesEmulator().setEngagedPlayerSlot(null)
    if (serviceRef.current) {
      await serviceRef.current.disconnect()
      serviceRef.current = null
    }
    remotePosesRef.current.clear()
    barGamesBridgeRef.current?.onRoomLeft()
    setJoined(false)
    setConnected(false)
    setParticipants([])
    setPresenterState(createInitialPresenterState())
  }, [localUserId])

  useEffect(() => {
    return () => {
      void serviceRef.current?.disconnect()
    }
  }, [])

  const selectSeat = useCallback(
    (seatIdOrIndex: string | number) => {
      if (seatIdOrIndex === FREE_ROAM_SEAT_ID) {
        updateLocalProfile({
          seatIndex: -1,
          seatId: FREE_ROAM_SEAT_ID,
        })
        return
      }

      const seatsNow = computedSeatsRef.current
      if (seatsNow.length === 0) return

      const targetSeat =
        typeof seatIdOrIndex === 'string'
          ? seatsNow.find((s) => s.id === seatIdOrIndex)
          : seatsNow[seatIdOrIndex]

      if (!targetSeat) return

      const isExclusiveChair =
        !targetSeat.stationKind ||
        targetSeat.stationKind === 'seat' ||
        targetSeat.stationKind === 'game-table'

      if (isExclusiveChair) {
        const occupied = participants.some((p) => {
          if (p.userId === localUserId) return false
          if (p.seatId === FREE_ROAM_SEAT_ID) return false
          if (p.seatId) return p.seatId === targetSeat.id
          return p.seatIndex >= 0 && p.seatIndex === targetSeat.index
        })
        if (occupied) return
      }

      updateLocalProfile({
        seatIndex: targetSeat.index,
        seatId: targetSeat.id,
      })
    },
    [localUserId, participants, updateLocalProfile],
  )

  const updateRoomCustomization = useCallback(
    (
      updater: (
        prev: RoomCustomizationState,
      ) => Omit<RoomCustomizationState, 'revision' | 'updatedAt' | 'updatedBy'>,
    ) => {
      const current = roomCustomizationRef.current
      const draft = updater(current)
      const nextUpdatedAt = Math.max(Date.now(), current.updatedAt + 1)
      const nextRevision = Math.max(current.revision + 1, nextUpdatedAt)
      const next: RoomCustomizationState = {
        ...draft,
        furniture: (draft.furniture ?? []).slice(-48),
        revision: nextRevision,
        updatedAt: nextUpdatedAt,
        updatedBy: localProfileRef.current.displayName,
      }
      roomCustomizationRef.current = next
      setRoomCustomization(next)

      const activeRoom = roomCodeRef.current || CANONICAL_ROOM_CODE
      saveLocalRoomCustomization(activeRoom, next)
      scheduleCloudRoomSave(activeRoom, next)
      serviceRef.current?.broadcastRoomCustomization(next)
    },
    [],
  )

  const resetRoomCustomization = useCallback(() => {
    const defaults = createDefaultRoomCustomization()
    const current = roomCustomizationRef.current
    const nextUpdatedAt = Math.max(Date.now(), current.updatedAt + 1)
    const nextRevision = Math.max(current.revision + 1, nextUpdatedAt)
    const next: RoomCustomizationState = {
      ...defaults,
      expansionWing: defaults.expansionWing
        ? {
            ...defaults.expansionWing,
            boardroomWhiteboardStrokes:
              current.expansionWing?.boardroomWhiteboardStrokes ?? [],
            boardroomWhiteboardGrid:
              current.expansionWing?.boardroomWhiteboardGrid ?? true,
            boardroomWhiteboardClearedAt:
              current.expansionWing?.boardroomWhiteboardClearedAt ?? 0,
          }
        : current.expansionWing,
      revision: nextRevision,
      updatedAt: nextUpdatedAt,
      updatedBy: localProfileRef.current.displayName,
    }
    roomCustomizationRef.current = next
    setRoomCustomization(next)

    const activeRoom = roomCodeRef.current || CANONICAL_ROOM_CODE
    clearLocalRoomCustomization(activeRoom)
    saveLocalRoomCustomization(activeRoom, next)
    scheduleCloudRoomSave(activeRoom, next)
    serviceRef.current?.broadcastRoomCustomization(next)
    appendSystemMessage(`${localProfileRef.current.displayName} reset the room layout to default.`)
  }, [appendSystemMessage])

  const importRoomCustomizationJson = useCallback(
    (rawJson: string): boolean => {
      try {
        const parsed = sanitizeRoomCustomization(JSON.parse(rawJson))
        if (!parsed) return false
        const current = roomCustomizationRef.current
        const nextUpdatedAt = Math.max(Date.now(), current.updatedAt + 1)
        const nextRevision = Math.max(current.revision + 1, nextUpdatedAt)
        const next: RoomCustomizationState = {
          ...parsed,
          revision: nextRevision,
          updatedAt: nextUpdatedAt,
          updatedBy: localProfileRef.current.displayName,
        }
        roomCustomizationRef.current = next
        setRoomCustomization(next)
        const activeRoom = roomCodeRef.current || CANONICAL_ROOM_CODE
        saveLocalRoomCustomization(activeRoom, next)
        scheduleCloudRoomSave(activeRoom, next)
        serviceRef.current?.broadcastRoomCustomization(next)
        appendSystemMessage(`${localProfileRef.current.displayName} loaded a custom room blueprint.`)
        return true
      } catch {
        return false
      }
    },
    [appendSystemMessage],
  )

  const publishPresenterState = useCallback((next: PresenterState) => {
    presenterStateRef.current = next
    setPresenterState(next)
    serviceRef.current?.broadcastPresenterState(next)
  }, [])

  const canTakeControl = useMemo(() => {
    if (!presenterState.lockedByHostId) return true
    return localProfile.isHost || presenterState.lockedByHostId === localUserId
  }, [localProfile.isHost, localUserId, presenterState.lockedByHostId])

  const isLocalPresenter = presenterState.activePresenterId === localUserId

  const takeControl = useCallback(
    (preferredMode?: ScreenMode): boolean => {
      const current = presenterStateRef.current
      const me = localProfileRef.current
      if (
        current.lockedByHostId &&
        current.lockedByHostId !== localUserId &&
        !me.isHost
      ) {
        appendSystemMessage('Presenter control is currently locked by the room host.')
        return false
      }

      const nextMode: ScreenMode =
        preferredMode ?? (current.screenMode === 'idle' ? 'url-sync' : current.screenMode)

      const nextState: PresenterState = {
        ...current,
        activePresenterId: localUserId,
        presenterName: me.displayName,
        screenMode: nextMode,
        isPlaying: nextMode === 'url-sync' ? current.isPlaying : false,
        updatedAt: Date.now(),
        revision: current.revision + 1,
      }

      publishPresenterState(nextState)
      appendSystemMessage(`${me.displayName} took control of the cinema screen.`)
      return true
    },
    [appendSystemMessage, localUserId, publishPresenterState],
  )

  const releaseControl = useCallback(() => {
    const current = presenterStateRef.current
    if (current.activePresenterId !== localUserId && !localProfileRef.current.isHost) {
      return
    }
    const nextState: PresenterState = {
      ...current,
      activePresenterId: null,
      presenterName: null,
      screenMode: 'idle',
      isPlaying: false,
      updatedAt: Date.now(),
      revision: current.revision + 1,
    }
    publishPresenterState(nextState)
  }, [localUserId, publishPresenterState])

  const toggleHostLock = useCallback(() => {
    const me = localProfileRef.current
    if (!me.isHost) return
    const current = presenterStateRef.current
    const locking = !current.lockedByHostId
    const nextState: PresenterState = {
      ...current,
      lockedByHostId: locking ? localUserId : null,
      activePresenterId: locking ? localUserId : current.activePresenterId,
      presenterName: locking ? me.displayName : current.presenterName,
      updatedAt: Date.now(),
      revision: current.revision + 1,
    }
    publishPresenterState(nextState)
    appendSystemMessage(
      locking
        ? `${me.displayName} locked presenter handoff.`
        : `${me.displayName} unlocked presenter handoff — anyone can Take Control.`,
    )
  }, [appendSystemMessage, localUserId, publishPresenterState])

  const updatePresenterMedia = useCallback(
    (patch: Partial<Omit<PresenterState, 'revision' | 'updatedAt'>>, bumpRevision = true) => {
      const current = presenterStateRef.current
      if (current.activePresenterId !== localUserId) return
      const nextState: PresenterState = {
        ...current,
        ...patch,
        updatedAt: Date.now(),
        revision: bumpRevision ? current.revision + 1 : current.revision,
      }
      publishPresenterState(nextState)

      if (patch.mediaUrl && isNesMediaUrl(patch.mediaUrl)) {
        const cartId = parseNesCartridgeIdFromUrl(patch.mediaUrl)
        const cartMeta =
          NES_LIBRARY_CARTRIDGES.find((c) => c.id === cartId) ??
          getNesEmulator().getActiveCartridge()
        const curMp = nesMultiplayerStateRef.current
        const me = localProfileRef.current
        const otherActiveP1 =
          curMp.player1Id &&
          curMp.player1Id !== localUserId &&
          participantsRef.current.some((p) => p.userId === curMp.player1Id)
        const nextMp: NesMultiplayerState = {
          cartridgeId: cartMeta.id,
          cartridgeTitle: cartMeta.title,
          player1Id: otherActiveP1 ? curMp.player1Id : localUserId,
          player1Name: otherActiveP1 ? curMp.player1Name : me.displayName,
          player2Id:
            curMp.player2Id === localUserId && !otherActiveP1
              ? null
              : curMp.player2Id,
          player2Name:
            curMp.player2Id === localUserId && !otherActiveP1
              ? null
              : curMp.player2Name,
          revision: curMp.revision + 1,
          updatedAt: Date.now(),
        }
        nesMultiplayerStateRef.current = nextMp
        setNesMultiplayerState(nextMp)
        serviceRef.current?.broadcastNesEvent({
          kind: 'nes-multiplayer-state',
          state: nextMp,
        })
      }
    },
    [localUserId, publishPresenterState],
  )

  const sendChatMessage = useCallback(
    (rawText: string) => {
      const text = rawText.trim()
      if (!text) return
      const me = localProfileRef.current
      const msg: ChatMessage = {
        id: `${localUserId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: localUserId,
        displayName: me.displayName,
        avatarColor: me.avatarColor,
        text,
        createdAt: Date.now(),
        verifiedKeyTag: me.verifiedKeyTag,
      }
      setMessages((prev) => [...prev.slice(-79), msg])
      serviceRef.current?.broadcastChatMessage(msg)
    },
    [localUserId],
  )

  const sendReaction = useCallback(
    (emoji: string, originOverride?: [number, number, number]) => {
      const me = localProfileRef.current
      const seatsNow = computedSeatsRef.current
      const seat =
        (me.seatId ? seatsNow.find((s) => s.id === me.seatId) : undefined) ??
        seatsNow[me.seatIndex] ??
        seatsNow[0]
      const basePos: [number, number, number] = seat
        ? [seat.position[0], seat.position[1] + seat.seatHeightOffset, seat.position[2]]
        : [0, 0, 0.5]

      const origin: [number, number, number] = originOverride ?? [
        basePos[0] + (Math.random() - 0.5) * 0.35,
        basePos[1] + 1.35,
        basePos[2] - 0.25,
      ]
      const reaction: FloatingReaction = {
        id: `rx-${localUserId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId: localUserId,
        displayName: me.displayName,
        emoji,
        origin,
        createdAt: Date.now(),
      }
      setReactions((prev) => [...prev.slice(-24), reaction])
      serviceRef.current?.broadcastReaction(reaction)
    },
    [localUserId],
  )

  const updateAvatarAppearance = useCallback(
    (patch: {
      displayName?: string
      avatarColor?: string
      avatarStyle?: AvatarStyleId
      avatarCustomization?: Partial<AvatarCustomization>
    }) => {
      const cur = localProfileRef.current
      const nextName =
        patch.displayName !== undefined
          ? patch.displayName.trim().slice(0, 24) || cur.displayName
          : cur.displayName
      const nextColor = patch.avatarColor ?? cur.avatarColor
      const nextStyle = patch.avatarStyle ?? cur.avatarStyle
      const nextCustomization = resolveAvatarCustomization({
        ...resolveAvatarCustomization(cur.avatarCustomization),
        ...(patch.avatarCustomization ?? {}),
      })

      const nextPrefs = {
        displayName: nextName,
        avatarColor: nextColor,
        avatarStyle: nextStyle,
        avatarCustomization: nextCustomization,
      }
      saveAvatarPreferences(nextPrefs)
      recordMemberProfileToVault(nextPrefs)
      serviceRef.current?.publishRetainedProfilesVault(
        buildRetainedProfilesVaultPayload(),
      )

      updateLocalProfile({
        displayName: nextName,
        avatarColor: nextColor,
        avatarStyle: nextStyle,
        avatarCustomization: nextCustomization,
      })
    },
    [updateLocalProfile],
  )

  const claimNesPlayerSlot = useCallback(
    (slot: 1 | 2 | null): boolean => {
      const emu = getNesEmulator()
      const me = localProfileRef.current
      const cur = nesMultiplayerStateRef.current
      const activeCart = emu.getActiveCartridge()

      // Exclusive lock check: while another active player in the room is controlling Player 1 or Player 2,
      // prevent stealing their controller until they disengage (or leave the room).
      if (
        slot === 1 &&
        cur.player1Id &&
        cur.player1Id !== localUserId &&
        participantsRef.current.some((p) => p.userId === cur.player1Id)
      ) {
        appendSystemMessage(
          `🔒 NES Player 1 controllers are currently engaged by ${cur.player1Name || 'another player'}.`,
        )
        return false
      }
      if (
        slot === 2 &&
        cur.player2Id &&
        cur.player2Id !== localUserId &&
        participantsRef.current.some((p) => p.userId === cur.player2Id)
      ) {
        appendSystemMessage(
          `🔒 NES Player 2 controllers are currently engaged by ${cur.player2Name || 'another player'}.`,
        )
        return false
      }

      let nextP1Id = cur.player1Id
      let nextP1Name = cur.player1Name
      let nextP2Id = cur.player2Id
      let nextP2Name = cur.player2Name

      if (nextP1Id === localUserId) {
        nextP1Id = null
        nextP1Name = null
      }
      if (nextP2Id === localUserId) {
        nextP2Id = null
        nextP2Name = null
      }

      if (slot === 1) {
        nextP1Id = localUserId
        nextP1Name = me.displayName
        emu.setEngagedPlayerSlot(1)
        appendSystemMessage(
          '🎮 Engaged NES Player 1 Controllers! (In VR, hold Right Grip for 1s to disengage)',
        )
      } else if (slot === 2) {
        nextP2Id = localUserId
        nextP2Name = me.displayName
        emu.setEngagedPlayerSlot(2)
        appendSystemMessage(
          '🎮 Engaged NES Player 2 Controllers! (In VR, hold Right Grip for 1s to disengage)',
        )
      } else {
        const prevSlot = emu.getEngagedPlayerSlot()
        emu.setEngagedPlayerSlot(null)
        if (prevSlot !== null) {
          appendSystemMessage(
            `🔓 Disengaged NES Player ${prevSlot} Controllers — normal VR locomotion restored.`,
          )
        }
      }

      const nextState: NesMultiplayerState = {
        cartridgeId: activeCart.id,
        cartridgeTitle: activeCart.title,
        player1Id: nextP1Id,
        player1Name: nextP1Name,
        player2Id: nextP2Id,
        player2Name: nextP2Name,
        revision: cur.revision + 1,
        updatedAt: Date.now(),
      }
      nesMultiplayerStateRef.current = nextState
      setNesMultiplayerState(nextState)
      serviceRef.current?.broadcastNesEvent({
        kind: 'nes-multiplayer-state',
        state: nextState,
      })
      if (slot === 1) {
        window.setTimeout(() => {
          if (resolveAuthoritativeNesDriverId() === localUserId) {
            void broadcastLiveNesCheckpoint()
          }
        }, 180)
      }
      return true
    },
    [
      appendSystemMessage,
      broadcastLiveNesCheckpoint,
      localUserId,
      resolveAuthoritativeNesDriverId,
    ],
  )

  const shareNesCheckpointWithRoom = useCallback(async () => {
    return broadcastLiveNesCheckpoint()
  }, [broadcastLiveNesCheckpoint])

  const shareNesSaveSlotWithRoom = useCallback((slot: NesSaveSlotMeta) => {
    serviceRef.current?.broadcastNesEvent({
      kind: 'nes-save-slot-shared',
      slot,
    })
    serviceRef.current?.publishRetainedNesVault(buildRetainedNesVaultPayload())
  }, [])

  const broadcastPose = useCallback((pose: AvatarPose6DoF) => {
    serviceRef.current?.broadcastPose(pose)
  }, [])

  const broadcastBarGamesEvent = useCallback((event: BarGamesWireEvent) => {
    serviceRef.current?.broadcastBarGamesEvent(event)
  }, [])

  const sendWebRTCSignal = useCallback((signal: WebRTCSignalMessage) => {
    serviceRef.current?.sendWebRTCSignal(signal)
  }, [])

  return {
    localUserId,
    joined,
    connected,
    roomCode,
    transportMode,
    localProfile,
    participants,
    presenterState,
    nesMultiplayerState,
    roomCustomization,
    computedSeats,
    isLocalPresenter,
    canTakeControl,
    messages,
    reactions,
    remotePosesRef,
    barGamesBridgeRef,
    joinRoom,
    leaveRoom,
    updateLocalProfile,
    updateAvatarAppearance,
    selectSeat,
    updateRoomCustomization,
    resetRoomCustomization,
    importRoomCustomizationJson,
    takeControl,
    releaseControl,
    toggleHostLock,
    updatePresenterMedia,
    claimNesPlayerSlot,
    shareNesCheckpointWithRoom,
    shareNesSaveSlotWithRoom,
    sendChatMessage,
    sendReaction,
    broadcastPose,
    broadcastBarGamesEvent,
    sendWebRTCSignal,
    appendSystemMessage,
  }
}
