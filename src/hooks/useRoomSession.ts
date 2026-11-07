import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AVATAR_COLORS,
  AVATAR_STYLES,
  LOUNGE_SEATS,
  createInitialPresenterState,
} from '../constants/cinema'
import { RoomRealtimeService, hasSupabaseCredentials } from '../services/realtime'
import type {
  AvatarPose6DoF,
  AvatarStyleId,
  ChatMessage,
  FloatingReaction,
  ParticipantProfile,
  PresenterState,
  ScreenMode,
  TransportMode,
  WebRTCSignalMessage,
} from '../types/lounge'

function createSessionUserId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `user-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`
}

export interface JoinRoomOptions {
  roomCode: string
  displayName: string
  avatarColor: string
  avatarStyle: AvatarStyleId
  inVR: boolean
  isMuted: boolean
}

export function useRoomSession(
  onWebRTCSignalRef: React.RefObject<((signal: WebRTCSignalMessage) => void) | null>,
) {
  const [localUserId] = useState<string>(() => createSessionUserId())
  const [joined, setJoined] = useState(false)
  const [connected, setConnected] = useState(false)
  const [roomCode, setRoomCode] = useState('')
  const [transportMode, setTransportMode] = useState<TransportMode>(() =>
    hasSupabaseCredentials() ? 'supabase' : 'cloud-relay',
  )

  const [localProfile, setLocalProfile] = useState<ParticipantProfile>(() => ({
    userId: localUserId,
    displayName: 'Guest',
    avatarColor: AVATAR_COLORS[0].hex,
    avatarStyle: AVATAR_STYLES[0].id,
    seatIndex: 0,
    isHost: true,
    isMuted: false,
    inVR: false,
    joinedAt: Date.now(),
  }))

  const [participants, setParticipants] = useState<ParticipantProfile[]>([])
  const [presenterState, setPresenterState] = useState<PresenterState>(() =>
    createInitialPresenterState(),
  )
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [reactions, setReactions] = useState<FloatingReaction[]>([])

  // High-frequency 6DoF remote pose buffer (read inside R3F useFrame without triggering React re-renders)
  const remotePosesRef = useRef<Map<string, AvatarPose6DoF>>(new Map())
  const serviceRef = useRef<RoomRealtimeService | null>(null)
  const presenterStateRef = useRef<PresenterState>(presenterState)
  const localProfileRef = useRef<ParticipantProfile>(localProfile)

  useEffect(() => {
    presenterStateRef.current = presenterState
  }, [presenterState])

  useEffect(() => {
    localProfileRef.current = localProfile
  }, [localProfile])

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

  const joinRoom = useCallback(
    async (opts: JoinRoomOptions) => {
      if (serviceRef.current) {
        await serviceRef.current.disconnect()
        serviceRef.current = null
      }
      remotePosesRef.current.clear()

      const normalizedCode = opts.roomCode.toUpperCase().trim() || 'LOUNGE-1'
      const initialProfile: ParticipantProfile = {
        userId: localUserId,
        displayName: opts.displayName.trim() || 'Cinema Guest',
        avatarColor: opts.avatarColor,
        avatarStyle: opts.avatarStyle,
        seatIndex: 0,
        isHost: false,
        isMuted: opts.isMuted,
        inVR: opts.inVR,
        joinedAt: Date.now(),
      }

      setRoomCode(normalizedCode)
      setLocalProfile(initialProfile)
      setParticipants([initialProfile])
      setPresenterState(createInitialPresenterState())
      setMessages([])

      let seatSettled = false

      const service = new RoomRealtimeService(normalizedCode, initialProfile, {
        onConnectionStatus: (isOnline) => {
          setConnected(isOnline)
        },
        onParticipantsChange: (roster) => {
          // Oldest participant in the room acts as deterministic host
          const sorted = [...roster].sort((a, b) =>
            a.joinedAt !== b.joinedAt
              ? a.joinedAt - b.joinedAt
              : a.userId.localeCompare(b.userId),
          )
          const hostId = sorted[0]?.userId ?? localUserId
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
          const me = hydrated.find((p) => p.userId === localUserId)
          if (me) {
            const occupiedByEarlierPeer = hydrated.some(
              (other) =>
                other.userId !== localUserId &&
                other.seatIndex === me.seatIndex &&
                (other.joinedAt < me.joinedAt ||
                  (other.joinedAt === me.joinedAt && other.userId < me.userId)),
            )

            if (!seatSettled || occupiedByEarlierPeer) {
              seatSettled = true
              if (occupiedByEarlierPeer) {
                const taken = new Set(
                  hydrated
                    .filter((other) => other.userId !== localUserId)
                    .map((other) => other.seatIndex),
                )
                const freeSeat =
                  LOUNGE_SEATS.find((s) => !taken.has(s.index))?.index ??
                  hydrated.length % LOUNGE_SEATS.length
                setLocalProfile((prev) => ({
                  ...prev,
                  seatIndex: freeSeat,
                  isHost: hostId === localUserId,
                }))
                void service.updatePresence({
                  seatIndex: freeSeat,
                  isHost: hostId === localUserId,
                })
                return
              }
            }

            setLocalProfile((prev) =>
              prev.isHost === (hostId === localUserId)
                ? prev
                : { ...prev, isHost: hostId === localUserId },
            )
          }

          // If the active presenter disconnected, release presenter slot cleanly
          const currentPresenter = presenterStateRef.current.activePresenterId
          if (currentPresenter && !activeIds.has(currentPresenter)) {
            setPresenterState((prev) => ({
              ...prev,
              activePresenterId: null,
              presenterName: null,
              screenMode: prev.screenMode === 'tab-stream' ? 'idle' : prev.screenMode,
              isPlaying: prev.screenMode === 'tab-stream' ? false : prev.isPlaying,
              updatedAt: Date.now(),
              revision: prev.revision + 1,
            }))
          }
        },
        onPoseUpdate: (pose) => {
          if (pose.userId !== localUserId) {
            remotePosesRef.current.set(pose.userId, pose)
          }
        },
        onPresenterState: (incoming) => {
          setPresenterState((prev) => {
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
        onRoomStateRequest: () => {
          const current = presenterStateRef.current
          const me = localProfileRef.current
          if (
            current.revision > 0 &&
            (current.activePresenterId === localUserId || me.isHost)
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
      setTransportMode(service.mode)
      setJoined(true)
      await service.connect()

      appendSystemMessage(
        `Joined room ${normalizedCode} (${
          service.mode === 'supabase' ? 'Supabase Live' : 'Global Cloud Relay'
        }).`,
      )
    },
    [appendSystemMessage, localUserId, onWebRTCSignalRef],
  )

  const leaveRoom = useCallback(async () => {
    if (serviceRef.current) {
      await serviceRef.current.disconnect()
      serviceRef.current = null
    }
    remotePosesRef.current.clear()
    setJoined(false)
    setConnected(false)
    setParticipants([])
    setPresenterState(createInitialPresenterState())
  }, [])

  useEffect(() => {
    return () => {
      void serviceRef.current?.disconnect()
    }
  }, [])

  const updateLocalProfile = useCallback((patch: Partial<ParticipantProfile>) => {
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
  }, [localUserId])

  const selectSeat = useCallback(
    (seatIndex: number) => {
      if (seatIndex < 0 || seatIndex >= LOUNGE_SEATS.length) return
      const occupied = participants.some(
        (p) => p.userId !== localUserId && p.seatIndex === seatIndex,
      )
      if (occupied) return
      updateLocalProfile({ seatIndex })
    },
    [localUserId, participants, updateLocalProfile],
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
      }
      setMessages((prev) => [...prev.slice(-79), msg])
      serviceRef.current?.broadcastChatMessage(msg)
    },
    [localUserId],
  )

  const sendReaction = useCallback(
    (emoji: string, originOverride?: [number, number, number]) => {
      const me = localProfileRef.current
      const seat = LOUNGE_SEATS[me.seatIndex] ?? LOUNGE_SEATS[0]
      const origin: [number, number, number] = originOverride ?? [
        seat.position[0] + (Math.random() - 0.5) * 0.35,
        seat.position[1] + 1.35,
        seat.position[2] - 0.25,
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

  const broadcastPose = useCallback((pose: AvatarPose6DoF) => {
    serviceRef.current?.broadcastPose(pose)
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
    isLocalPresenter,
    canTakeControl,
    messages,
    reactions,
    remotePosesRef,
    joinRoom,
    leaveRoom,
    updateLocalProfile,
    selectSeat,
    takeControl,
    releaseControl,
    toggleHostLock,
    updatePresenterMedia,
    sendChatMessage,
    sendReaction,
    broadcastPose,
    sendWebRTCSignal,
    appendSystemMessage,
  }
}
