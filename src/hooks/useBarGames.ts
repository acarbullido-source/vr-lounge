import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DIE_COLORS,
  DIE_MAX_VALUES,
  PUTTING_STRIP_SPECS,
  applyDartHitToMatch,
  applyPuttSettleToMatch,
  checkConnect4Winner,
  createDartPlayerSlot,
  createEmptyCricketMarks,
  createInitialCheckersBoard,
  createInitialChessBoard,
  createInitialClubhouseState,
  createInitialConnect4Grid,
  createInitialCornholeState,
  createInitialDartsMatchState,
  createInitialHolotableState,
  createInitialPuttingMatchState,
  createInitialShuffleboardState,
  createInitialTabletopState,
  createOrderedDeck52,
  createPuttingPlayerSlot,
  evaluateHoldemHand,
  getCheckersLegalMoves,
  getChessLegalMoves,
  normalizePlayerKey,
  scoreBlackjackHand,
  shuffleCards,
  snapTabletopCoords,
} from '../constants/barGames'
import {
  fetchCloudClubhouseState,
  loadLocalClubhouseState,
  recordClubhouseAchievement,
  sanitizeClubhouseState,
  saveLocalClubhouseState,
  scheduleCloudClubhouseSave,
} from '../services/clubhouseStorage'
import type {
  BarGamesWireEvent,
  ClubhousePersistentState,
  CompletedMatchRecord,
  CornholeBagRecord,
  CornholeState,
  DartGameMode,
  DartShotSettlePacket,
  DartsMatchState,
  DieKind,
  HolotableGameMode,
  HolotableMiniKind,
  HolotableMiniature,
  HolotableState,
  HolotableTerrainPresetId,
  LedgerEntry,
  LiveDartShotPacket,
  LivePuttShotPacket,
  PredictionProp,
  PuttShotSettlePacket,
  PuttingGameMode,
  PuttingMatchState,
  RolledDie,
  ShuffleboardPuck,
  ShuffleboardState,
  TableGameMode,
  TableSurfaceStyle,
  TabletopState,
} from '../types/barGames'
import type { ParticipantProfile } from '../types/lounge'
import type { BarGamesTransportBridge } from './useRoomSession'

function isNewerState<T extends { revision: number; updatedAt: number }>(
  incoming: T,
  current: T,
): boolean {
  if (incoming.revision > current.revision) return true
  if (incoming.revision === current.revision && incoming.updatedAt > current.updatedAt) {
    return true
  }
  return false
}

export interface UseBarGamesOptions {
  roomCode: string
  joined: boolean
  localUserId: string
  localProfile: ParticipantProfile
  barGamesBridgeRef: React.RefObject<BarGamesTransportBridge | null>
  broadcastBarGamesEvent: (event: BarGamesWireEvent) => void
  appendSystemMessage: (text: string) => void
}

export function useBarGames({
  roomCode,
  localUserId,
  localProfile,
  barGamesBridgeRef,
  broadcastBarGamesEvent,
  appendSystemMessage,
}: UseBarGamesOptions) {
  const [dartsState, setDartsState] = useState<DartsMatchState>(() =>
    createInitialDartsMatchState(),
  )
  const [puttingState, setPuttingState] = useState<PuttingMatchState>(() =>
    createInitialPuttingMatchState(),
  )
  const [tabletopState, setTabletopState] = useState<TabletopState>(() =>
    createInitialTabletopState(),
  )
  const [clubhouseState, setClubhouseState] = useState<ClubhousePersistentState>(() =>
    createInitialClubhouseState(),
  )
  const [shuffleboardState, setShuffleboardState] = useState<ShuffleboardState>(() =>
    createInitialShuffleboardState(),
  )
  const [cornholeState, setCornholeState] = useState<CornholeState>(() =>
    createInitialCornholeState(),
  )
  const [holotableState, setHolotableState] = useState<HolotableState>(() =>
    createInitialHolotableState(),
  )

  const [activeDartShot, setActiveDartShot] = useState<LiveDartShotPacket | null>(null)
  const [activePuttShot, setActivePuttShot] = useState<LivePuttShotPacket | null>(null)

  const dartsRef = useRef<DartsMatchState>(dartsState)
  const puttingRef = useRef<PuttingMatchState>(puttingState)
  const tabletopRef = useRef<TabletopState>(tabletopState)
  const clubhouseRef = useRef<ClubhousePersistentState>(clubhouseState)
  const shuffleboardRef = useRef<ShuffleboardState>(shuffleboardState)
  const cornholeRef = useRef<CornholeState>(cornholeState)
  const holotableRef = useRef<HolotableState>(holotableState)
  const localProfileRef = useRef<ParticipantProfile>(localProfile)
  const roomCodeRef = useRef<string>(roomCode)
  const announcedClubhouseRef = useRef<boolean>(false)

  useEffect(() => {
    dartsRef.current = dartsState
  }, [dartsState])

  useEffect(() => {
    puttingRef.current = puttingState
  }, [puttingState])

  useEffect(() => {
    tabletopRef.current = tabletopState
  }, [tabletopState])

  useEffect(() => {
    clubhouseRef.current = clubhouseState
  }, [clubhouseState])

  useEffect(() => {
    shuffleboardRef.current = shuffleboardState
  }, [shuffleboardState])

  useEffect(() => {
    cornholeRef.current = cornholeState
  }, [cornholeState])

  useEffect(() => {
    holotableRef.current = holotableState
  }, [holotableState])

  useEffect(() => {
    localProfileRef.current = localProfile
  }, [localProfile])

  useEffect(() => {
    roomCodeRef.current = roomCode
  }, [roomCode])

  const persistAndBroadcastClubhouse = useCallback(
    (next: ClubhousePersistentState) => {
      clubhouseRef.current = next
      setClubhouseState(next)
      const activeRoom = roomCodeRef.current
      if (activeRoom) {
        saveLocalClubhouseState(activeRoom, next)
        scheduleCloudClubhouseSave(activeRoom, next)
      }
      broadcastBarGamesEvent({ kind: 'clubhouse-state', payload: next })
    },
    [broadcastBarGamesEvent],
  )

  // Safety auto-clear for orphaned live projectiles (if remote thrower disconnects mid-air)
  useEffect(() => {
    if (!activeDartShot) return
    const timer = window.setTimeout(() => {
      setActiveDartShot((curr) => (curr?.shotId === activeDartShot.shotId ? null : curr))
    }, 2800)
    return () => window.clearTimeout(timer)
  }, [activeDartShot])

  useEffect(() => {
    if (!activePuttShot) return
    const timer = window.setTimeout(() => {
      setActivePuttShot((curr) => (curr?.shotId === activePuttShot.shotId ? null : curr))
    }, 6500)
    return () => window.clearTimeout(timer)
  }, [activePuttShot])

  // Synchronously register bridge handlers so joinRoom / onBarGamesEvent never miss a packet
  barGamesBridgeRef.current = {
    onRoomJoined: (normalizedRoomCode, sendEvent) => {
      roomCodeRef.current = normalizedRoomCode
      announcedClubhouseRef.current = false

      const freshDarts = createInitialDartsMatchState()
      const freshPutting = createInitialPuttingMatchState()
      const freshTabletop = createInitialTabletopState()
      const freshShuffleboard = createInitialShuffleboardState()
      const freshCornhole = createInitialCornholeState()
      const freshHolotable = createInitialHolotableState()
      const savedClubhouse =
        loadLocalClubhouseState(normalizedRoomCode) ?? createInitialClubhouseState()

      dartsRef.current = freshDarts
      puttingRef.current = freshPutting
      tabletopRef.current = freshTabletop
      shuffleboardRef.current = freshShuffleboard
      cornholeRef.current = freshCornhole
      holotableRef.current = freshHolotable
      clubhouseRef.current = savedClubhouse

      setDartsState(freshDarts)
      setPuttingState(freshPutting)
      setTabletopState(freshTabletop)
      setShuffleboardState(freshShuffleboard)
      setCornholeState(freshCornhole)
      setHolotableState(freshHolotable)
      setClubhouseState(savedClubhouse)
      setActiveDartShot(null)
      setActivePuttShot(null)

      // Hydrate optional Supabase `public.clubhouse_stats` row in background
      void fetchCloudClubhouseState(normalizedRoomCode).then((cloudClubhouse) => {
        if (!cloudClubhouse || roomCodeRef.current !== normalizedRoomCode) return
        setClubhouseState((prev) => {
          if (!isNewerState(cloudClubhouse, prev)) return prev
          clubhouseRef.current = cloudClubhouse
          saveLocalClubhouseState(normalizedRoomCode, cloudClubhouse)
          sendEvent({ kind: 'clubhouse-state', payload: cloudClubhouse })
          return cloudClubhouse
        })
      })
    },

    onRoomConnected: (sendEvent) => {
      if (!announcedClubhouseRef.current && clubhouseRef.current.revision > 0) {
        announcedClubhouseRef.current = true
        sendEvent({ kind: 'clubhouse-state', payload: clubhouseRef.current })
      }
    },

    onStateRequest: (_requesterId, isHost, sendEvent) => {
      if (!isHost) return
      const hasAnyActivity =
        dartsRef.current.revision > 0 ||
        puttingRef.current.revision > 0 ||
        tabletopRef.current.revision > 0 ||
        shuffleboardRef.current.revision > 0 ||
        cornholeRef.current.revision > 0 ||
        holotableRef.current.revision > 0 ||
        clubhouseRef.current.revision > 0
      if (!hasAnyActivity) return

      sendEvent({
        kind: 'bar-games-full-sync',
        darts: dartsRef.current,
        putting: puttingRef.current,
        tabletop: tabletopRef.current,
        clubhouse: clubhouseRef.current,
        shuffleboard: shuffleboardRef.current,
        cornhole: cornholeRef.current,
        holotable: holotableRef.current,
      })
    },

    onEvent: (event) => {
      switch (event.kind) {
        case 'dart-launch': {
          setActiveDartShot(event.payload)
          break
        }
        case 'dart-settle': {
          setActiveDartShot((curr) =>
            curr?.shotId === event.payload.shotId ? null : curr,
          )
          setDartsState((prev) => {
            if (!isNewerState(event.matchState, prev)) return prev
            dartsRef.current = event.matchState
            return event.matchState
          })
          break
        }
        case 'darts-state': {
          setDartsState((prev) => {
            if (!isNewerState(event.payload, prev)) return prev
            dartsRef.current = event.payload
            return event.payload
          })
          break
        }
        case 'putt-launch': {
          setActivePuttShot(event.payload)
          break
        }
        case 'putt-settle': {
          setActivePuttShot((curr) =>
            curr?.shotId === event.payload.shotId ? null : curr,
          )
          setPuttingState((prev) => {
            if (!isNewerState(event.matchState, prev)) return prev
            puttingRef.current = event.matchState
            return event.matchState
          })
          break
        }
        case 'putting-state': {
          setPuttingState((prev) => {
            if (!isNewerState(event.payload, prev)) return prev
            puttingRef.current = event.payload
            return event.payload
          })
          break
        }
        case 'tabletop-state': {
          setTabletopState((prev) => {
            if (!isNewerState(event.payload, prev)) return prev
            const bounded: TabletopState = {
              ...event.payload,
              dice: (event.payload.dice ?? []).slice(-16),
              tokens: (event.payload.tokens ?? []).slice(-24),
              tableCards: (event.payload.tableCards ?? []).slice(-20),
            }
            tabletopRef.current = bounded
            return bounded
          })
          break
        }
        case 'shuffleboard-state': {
          setShuffleboardState((prev) => {
            if (!isNewerState(event.payload, prev)) return prev
            const bounded: ShuffleboardState = {
              ...event.payload,
              pucks: (event.payload.pucks ?? []).slice(-16),
            }
            shuffleboardRef.current = bounded
            return bounded
          })
          break
        }
        case 'cornhole-state': {
          setCornholeState((prev) => {
            if (!isNewerState(event.payload, prev)) return prev
            const bounded: CornholeState = {
              ...event.payload,
              bags: (event.payload.bags ?? []).slice(-16),
            }
            cornholeRef.current = bounded
            return bounded
          })
          break
        }
        case 'holotable-state': {
          setHolotableState((prev) => {
            if (!isNewerState(event.payload, prev)) return prev
            const bounded: HolotableState = {
              ...event.payload,
              miniatures: (event.payload.miniatures ?? []).slice(-24),
              revealedFogCells: (event.payload.revealedFogCells ?? []).slice(0, 36),
            }
            holotableRef.current = bounded
            return bounded
          })
          break
        }
        case 'clubhouse-state': {
          const clean = sanitizeClubhouseState(event.payload)
          if (!clean) break
          setClubhouseState((prev) => {
            if (!isNewerState(clean, prev)) return prev
            clubhouseRef.current = clean
            if (roomCodeRef.current) {
              saveLocalClubhouseState(roomCodeRef.current, clean)
            }
            return clean
          })
          break
        }
        case 'bar-games-full-sync': {
          setDartsState((prev) => {
            if (!isNewerState(event.darts, prev)) return prev
            dartsRef.current = event.darts
            return event.darts
          })
          setPuttingState((prev) => {
            if (!isNewerState(event.putting, prev)) return prev
            puttingRef.current = event.putting
            return event.putting
          })
          setTabletopState((prev) => {
            if (!isNewerState(event.tabletop, prev)) return prev
            const bounded: TabletopState = {
              ...event.tabletop,
              dice: (event.tabletop.dice ?? []).slice(-16),
              tokens: (event.tabletop.tokens ?? []).slice(-24),
              tableCards: (event.tabletop.tableCards ?? []).slice(-20),
            }
            tabletopRef.current = bounded
            return bounded
          })
          if (event.shuffleboard) {
            const incomingShuffle: ShuffleboardState = {
              ...event.shuffleboard,
              pucks: (event.shuffleboard.pucks ?? []).slice(-16),
            }
            setShuffleboardState((prev) => {
              if (!isNewerState(incomingShuffle, prev)) return prev
              shuffleboardRef.current = incomingShuffle
              return incomingShuffle
            })
          }
          if (event.cornhole) {
            const incomingCornhole: CornholeState = {
              ...event.cornhole,
              bags: (event.cornhole.bags ?? []).slice(-16),
            }
            setCornholeState((prev) => {
              if (!isNewerState(incomingCornhole, prev)) return prev
              cornholeRef.current = incomingCornhole
              return incomingCornhole
            })
          }
          if (event.holotable) {
            const incomingHolo: HolotableState = {
              ...event.holotable,
              miniatures: (event.holotable.miniatures ?? []).slice(-24),
              revealedFogCells: (event.holotable.revealedFogCells ?? []).slice(0, 36),
            }
            setHolotableState((prev) => {
              if (!isNewerState(incomingHolo, prev)) return prev
              holotableRef.current = incomingHolo
              return incomingHolo
            })
          }
          const cleanClub = sanitizeClubhouseState(event.clubhouse)
          if (cleanClub) {
            setClubhouseState((prev) => {
              if (!isNewerState(cleanClub, prev)) return prev
              clubhouseRef.current = cleanClub
              if (roomCodeRef.current) {
                saveLocalClubhouseState(roomCodeRef.current, cleanClub)
              }
              return cleanClub
            })
          }
          break
        }
      }
    },

    onRoomLeft: () => {
      setActiveDartShot(null)
      setActivePuttShot(null)
    },
  }

  // =========================================================================
  // PILLAR 1 & 2A: AUTHORITATIVE 3D DARTS (501 & CRICKET)
  // =========================================================================

  const launchDartShot = useCallback(
    (
      origin: [number, number, number],
      velocity: [number, number, number],
      boardCenter: [number, number, number],
    ): LiveDartShotPacket => {
      const me = localProfileRef.current
      const packet: LiveDartShotPacket = {
        shotId: `dart-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        shooterId: localUserId,
        shooterName: me.displayName,
        color: me.avatarColor,
        origin,
        velocity,
        boardCenter,
        timestamp: Date.now(),
      }
      setActiveDartShot(packet)
      broadcastBarGamesEvent({ kind: 'dart-launch', payload: packet })
      return packet
    },
    [broadcastBarGamesEvent, localUserId],
  )

  const settleDartShot = useCallback(
    (packet: DartShotSettlePacket) => {
      setActiveDartShot((curr) => (curr?.shotId === packet.shotId ? null : curr))

      const { nextMatch, completedRecord, checkoutAchieved, hitBullseye } =
        applyDartHitToMatch(dartsRef.current, {
          id: packet.shotId,
          shooterId: packet.shooterId,
          shooterName: packet.shooterName,
          color: packet.color,
          boardLocalPos: packet.boardLocalPos,
          hit: packet.hit,
          createdAt: packet.timestamp,
        })

      dartsRef.current = nextMatch
      setDartsState(nextMatch)
      broadcastBarGamesEvent({
        kind: 'dart-settle',
        payload: packet,
        matchState: nextMatch,
      })

      if (completedRecord || checkoutAchieved > 0 || hitBullseye) {
        const nextClubhouse = recordClubhouseAchievement(clubhouseRef.current, {
          shooterName: packet.shooterName,
          checkoutScore: checkoutAchieved,
          hitBullseye,
          completedMatch: completedRecord,
        })
        if (nextClubhouse !== clubhouseRef.current) {
          persistAndBroadcastClubhouse(nextClubhouse)
        }
      }

      if (completedRecord) {
        appendSystemMessage(nextMatch.lastTurnSummary)
      }
    },
    [appendSystemMessage, broadcastBarGamesEvent, persistAndBroadcastClubhouse],
  )

  const joinDartsMatch = useCallback(() => {
    const me = localProfileRef.current
    const prev = dartsRef.current
    if (prev.players.some((p) => p.userId === localUserId)) return
    if (prev.players.length >= 4) return

    const nextPlayers = [
      ...prev.players,
      createDartPlayerSlot(localUserId, me.displayName, me.avatarColor),
    ]
    const next: DartsMatchState = {
      ...prev,
      players: nextPlayers,
      lastTurnSummary: `${me.displayName} joined ${prev.mode.toUpperCase()} Darts!`,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
    }
    dartsRef.current = next
    setDartsState(next)
    broadcastBarGamesEvent({ kind: 'darts-state', payload: next })
  }, [broadcastBarGamesEvent, localUserId])

  const configureDartsMatch = useCallback(
    (patch: { mode?: DartGameMode; doubleOut?: boolean }) => {
      const prev = dartsRef.current
      const modeChanged = patch.mode !== undefined && patch.mode !== prev.mode
      const nextMode = patch.mode ?? prev.mode
      const nextDoubleOut = patch.doubleOut ?? prev.doubleOut

      const resetPlayers = modeChanged
        ? prev.players.map((p) => ({
            ...p,
            score501: 501,
            cricketPoints: 0,
            cricketMarks: createEmptyCricketMarks(),
          }))
        : prev.players

      const next: DartsMatchState = {
        ...prev,
        mode: nextMode,
        doubleOut: nextDoubleOut,
        players: resetPlayers,
        activePlayerIndex: modeChanged ? 0 : prev.activePlayerIndex,
        dartsThrownInTurn: modeChanged ? 0 : prev.dartsThrownInTurn,
        turnStartScore501: modeChanged ? 501 : prev.turnStartScore501,
        winnerId: modeChanged ? null : prev.winnerId,
        winnerName: modeChanged ? null : prev.winnerName,
        stuckDarts: modeChanged ? [] : prev.stuckDarts,
        lastTurnSummary: `Switched Darts to ${nextMode.toUpperCase()}${
          nextMode === '501' ? (nextDoubleOut ? ' (Double-Out)' : ' (Straight-Out)') : ''
        }.`,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
      }
      dartsRef.current = next
      setDartsState(next)
      broadcastBarGamesEvent({ kind: 'darts-state', payload: next })
    },
    [broadcastBarGamesEvent],
  )

  const resetDartsMatch = useCallback(() => {
    const me = localProfileRef.current
    const prev = dartsRef.current
    const basePlayers =
      prev.players.length > 0
        ? prev.players.map((p) => ({
            ...p,
            score501: 501,
            cricketPoints: 0,
            cricketMarks: createEmptyCricketMarks(),
          }))
        : [createDartPlayerSlot(localUserId, me.displayName, me.avatarColor)]

    const next: DartsMatchState = {
      ...prev,
      players: basePlayers,
      activePlayerIndex: 0,
      dartsThrownInTurn: 0,
      turnStartScore501: 501,
      winnerId: null,
      winnerName: null,
      stuckDarts: [],
      lastTurnSummary: `New ${prev.mode.toUpperCase()} leg started — ${basePlayers[0]?.displayName ?? me.displayName} to throw!`,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
    }
    dartsRef.current = next
    setDartsState(next)
    broadcastBarGamesEvent({ kind: 'darts-state', payload: next })
  }, [broadcastBarGamesEvent, localUserId])

  // =========================================================================
  // PILLAR 1 & 2B: AUTHORITATIVE MINI-GOLF PUTTING STRIP
  // =========================================================================

  const launchPuttShot = useCallback(
    (
      localOrigin: [number, number],
      localVelocity: [number, number],
    ): LivePuttShotPacket => {
      const me = localProfileRef.current
      const packet: LivePuttShotPacket = {
        shotId: `putt-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        shooterId: localUserId,
        shooterName: me.displayName,
        color: me.avatarColor,
        localOrigin,
        localVelocity,
        rampEnabled: puttingRef.current.rampEnabled,
        timestamp: Date.now(),
      }
      setActivePuttShot(packet)
      broadcastBarGamesEvent({ kind: 'putt-launch', payload: packet })
      return packet
    },
    [broadcastBarGamesEvent, localUserId],
  )

  const settlePuttShot = useCallback(
    (packet: PuttShotSettlePacket) => {
      setActivePuttShot((curr) => (curr?.shotId === packet.shotId ? null : curr))

      const me = localProfileRef.current
      const { nextMatch, completedRecord, newStreakRecord } = applyPuttSettleToMatch(
        puttingRef.current,
        packet,
        me.avatarColor,
      )

      puttingRef.current = nextMatch
      setPuttingState(nextMatch)
      broadcastBarGamesEvent({
        kind: 'putt-settle',
        payload: packet,
        matchState: nextMatch,
      })

      if (completedRecord || newStreakRecord > 0) {
        const nextClubhouse = recordClubhouseAchievement(clubhouseRef.current, {
          shooterName: packet.shooterName,
          puttingStreak: newStreakRecord,
          completedMatch: completedRecord,
        })
        if (nextClubhouse !== clubhouseRef.current) {
          persistAndBroadcastClubhouse(nextClubhouse)
        }
      }

      if (completedRecord) {
        appendSystemMessage(nextMatch.lastOutcomeText)
      }
    },
    [appendSystemMessage, broadcastBarGamesEvent, persistAndBroadcastClubhouse],
  )

  const joinPuttingMatch = useCallback(() => {
    const me = localProfileRef.current
    const prev = puttingRef.current
    if (prev.players.some((p) => p.userId === localUserId)) return
    if (prev.players.length >= 4) return

    const next: PuttingMatchState = {
      ...prev,
      players: [
        ...prev.players,
        createPuttingPlayerSlot(localUserId, me.displayName, me.avatarColor),
      ],
      lastOutcomeText: `${me.displayName} stepped up to the Putting Green!`,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
    }
    puttingRef.current = next
    setPuttingState(next)
    broadcastBarGamesEvent({ kind: 'putting-state', payload: next })
  }, [broadcastBarGamesEvent, localUserId])

  const configurePuttingMatch = useCallback(
    (patch: { mode?: PuttingGameMode; rampEnabled?: boolean }) => {
      const prev = puttingRef.current
      const nextMode = patch.mode ?? prev.mode
      const nextRamp = patch.rampEnabled ?? prev.rampEnabled
      const modeChanged = nextMode !== prev.mode

      const next: PuttingMatchState = {
        ...prev,
        mode: nextMode,
        rampEnabled: nextRamp,
        round: modeChanged ? 1 : prev.round,
        winnerId: modeChanged ? null : prev.winnerId,
        winnerName: modeChanged ? null : prev.winnerName,
        players: modeChanged
          ? prev.players.map((p) => ({ ...p, puttOffScore: 0, puttsTaken: 0 }))
          : prev.players,
        ballRestLocal: [0, PUTTING_STRIP_SPECS.ballRadius, PUTTING_STRIP_SPECS.teeLocalZ],
        lastOutcomeText: `Putting Green: ${
          nextMode === 'puttoff' ? '5-Round Putt-Off' : 'Streak Mode'
        } · ${nextRamp ? 'Obstacle Ramp ON' : 'Flat Turf'}`,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
      }
      puttingRef.current = next
      setPuttingState(next)
      broadcastBarGamesEvent({ kind: 'putting-state', payload: next })
    },
    [broadcastBarGamesEvent],
  )

  const resetPuttingBallToTee = useCallback(() => {
    const prev = puttingRef.current
    const next: PuttingMatchState = {
      ...prev,
      ballRestLocal: [0, PUTTING_STRIP_SPECS.ballRadius, PUTTING_STRIP_SPECS.teeLocalZ],
      revision: prev.revision + 1,
      updatedAt: Date.now(),
    }
    puttingRef.current = next
    setPuttingState(next)
    broadcastBarGamesEvent({ kind: 'putting-state', payload: next })
  }, [broadcastBarGamesEvent])

  const resetPuttingMatch = useCallback(() => {
    const me = localProfileRef.current
    const prev = puttingRef.current
    const basePlayers =
      prev.players.length > 0
        ? prev.players.map((p) => ({
            ...p,
            currentStreak: 0,
            puttOffScore: 0,
            puttsTaken: 0,
          }))
        : [createPuttingPlayerSlot(localUserId, me.displayName, me.avatarColor)]

    const next: PuttingMatchState = {
      ...prev,
      players: basePlayers,
      activePlayerIndex: 0,
      round: 1,
      winnerId: null,
      winnerName: null,
      ballRestLocal: [0, PUTTING_STRIP_SPECS.ballRadius, PUTTING_STRIP_SPECS.teeLocalZ],
      lastOutcomeText: `Fresh ${
        prev.mode === 'puttoff' ? 'Putt-Off' : 'Putting Streak'
      } session ready!`,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
    }
    puttingRef.current = next
    setPuttingState(next)
    broadcastBarGamesEvent({ kind: 'putting-state', payload: next })
  }, [broadcastBarGamesEvent, localUserId])

  // =========================================================================
  // PILLAR 3: INTERACTIVE GAME & DICE TABLE (DICE, 52-CARD DECK, GRID TOKENS)
  // =========================================================================

  const commitTabletop = useCallback(
    (next: TabletopState) => {
      const bounded: TabletopState = {
        ...next,
        dice: (next.dice ?? []).slice(-16),
        tokens: (next.tokens ?? []).slice(-24),
        tableCards: (next.tableCards ?? []).slice(-20),
      }
      tabletopRef.current = bounded
      setTabletopState(bounded)
      broadcastBarGamesEvent({ kind: 'tabletop-state', payload: bounded })
    },
    [broadcastBarGamesEvent],
  )

  const rollPolyhedralDice = useCallback(
    (diceKinds: DieKind[]) => {
      if (diceKinds.length === 0) return
      const me = localProfileRef.current
      const prev = tabletopRef.current
      const now = Date.now()
      const capped = diceKinds.slice(0, 8)

      const rolled: RolledDie[] = capped.map((kind, idx) => {
        const maxVal = DIE_MAX_VALUES[kind]
        const value = Math.floor(Math.random() * maxVal) + 1
        const angle = (idx / Math.max(1, capped.length)) * Math.PI * 2 + Math.random() * 0.45
        const radius = capped.length === 1 ? 0.04 : 0.13 + (idx % 2) * 0.07
        const lx = Number((Math.cos(angle) * radius - 0.04).toFixed(3))
        const lz = Number((Math.sin(angle) * radius - 0.06).toFixed(3))
        return {
          id: `die-${now.toString(36)}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
          kind,
          value,
          color: DIE_COLORS[kind],
          localPos: [lx, lz],
          rotation: [
            Number((Math.random() * Math.PI * 2).toFixed(3)),
            Number((Math.random() * Math.PI * 2).toFixed(3)),
            Number((Math.random() * Math.PI * 2).toFixed(3)),
          ],
          rolledBy: me.displayName,
          rolledAt: now,
        }
      })

      const total = rolled.reduce((sum, d) => sum + d.value, 0)
      const breakdown = rolled.map((d) => `${d.kind}(${d.value})`).join(' + ')
      const summary = `${me.displayName} rolled ${breakdown} = ${total}`

      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: now,
        dice: rolled,
        lastRollSummary: summary,
        lastRollerName: me.displayName,
        lastRollTotal: total,
        lastRollTimestamp: now,
      })
    },
    [commitTabletop],
  )

  const rerollSingleDie = useCallback(
    (dieId: string) => {
      const me = localProfileRef.current
      const prev = tabletopRef.current
      const target = prev.dice.find((d) => d.id === dieId)
      if (!target) return
      const now = Date.now()
      const maxVal = DIE_MAX_VALUES[target.kind]
      const newValue = Math.floor(Math.random() * maxVal) + 1

      const nextDice = prev.dice.map((d) =>
        d.id === dieId
          ? {
              ...d,
              value: newValue,
              rotation: [
                Number((Math.random() * Math.PI * 2).toFixed(3)),
                Number((Math.random() * Math.PI * 2).toFixed(3)),
                Number((Math.random() * Math.PI * 2).toFixed(3)),
              ] as [number, number, number],
              rolledBy: me.displayName,
              rolledAt: now,
            }
          : d,
      )
      const total = nextDice.reduce((sum, d) => sum + d.value, 0)
      const breakdown = nextDice.map((d) => `${d.kind}(${d.value})`).join(' + ')

      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: now,
        dice: nextDice,
        lastRollSummary: `${me.displayName} re-rolled ${target.kind}(${newValue}) · Total: ${total} (${breakdown})`,
        lastRollerName: me.displayName,
        lastRollTotal: total,
        lastRollTimestamp: now,
      })
    },
    [commitTabletop],
  )

  const setTableSurface = useCallback(
    (surface: TableSurfaceStyle) => {
      const prev = tabletopRef.current
      const snappedTokens = prev.tokens.map((tok) => ({
        ...tok,
        localPos: snapTabletopCoords(tok.localPos[0], tok.localPos[1], surface),
      }))
      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        surface,
        tokens: snappedTokens,
      })
    },
    [commitTabletop],
  )

  const shuffleDeck = useCallback(() => {
    const prev = tabletopRef.current
    commitTabletop({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      deck: shuffleCards(prev.deck),
    })
  }, [commitTabletop])

  const drawCardToHand = useCallback(() => {
    const me = localProfileRef.current
    const prev = tabletopRef.current
    if (prev.deck.length === 0) return

    const [topCard, ...restDeck] = prev.deck
    const existingHand = prev.hands[localUserId]?.cards ?? []
    const nextHands = {
      ...prev.hands,
      [localUserId]: {
        userId: localUserId,
        displayName: me.displayName,
        cards: [...existingHand, topCard],
      },
    }

    commitTabletop({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      deck: restDeck,
      hands: nextHands,
    })
  }, [commitTabletop, localUserId])

  const playCardFromHand = useCallback(
    (cardId: string, faceUp = true) => {
      const me = localProfileRef.current
      const prev = tabletopRef.current
      const myHand = prev.hands[localUserId]
      if (!myHand) return
      const card = myHand.cards.find((c) => c.id === cardId)
      if (!card) return

      const remainingCards = myHand.cards.filter((c) => c.id !== cardId)
      const slotIdx = prev.tableCards.length
      const col = slotIdx % 5
      const row = Math.floor(slotIdx / 5) % 3
      const lx = Number((-0.26 + col * 0.13).toFixed(3))
      const lz = Number((0.08 + row * 0.16).toFixed(3))

      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        hands: {
          ...prev.hands,
          [localUserId]: {
            ...myHand,
            displayName: me.displayName,
            cards: remainingCards,
          },
        },
        tableCards: [
          ...prev.tableCards.slice(-14),
          {
            card,
            faceUp,
            localPos: [lx, lz],
            rotationY: Number(((Math.random() - 0.5) * 0.16).toFixed(3)),
            playedBy: me.displayName,
          },
        ],
      })
    },
    [commitTabletop, localUserId],
  )

  const dealCardToTable = useCallback(
    (faceUp = true) => {
      const me = localProfileRef.current
      const prev = tabletopRef.current
      if (prev.deck.length === 0) return
      const [topCard, ...restDeck] = prev.deck
      const slotIdx = prev.tableCards.length
      const col = slotIdx % 5
      const row = Math.floor(slotIdx / 5) % 3
      const lx = Number((-0.26 + col * 0.13).toFixed(3))
      const lz = Number((0.08 + row * 0.16).toFixed(3))

      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        deck: restDeck,
        tableCards: [
          ...prev.tableCards.slice(-14),
          {
            card: topCard,
            faceUp,
            localPos: [lx, lz],
            rotationY: Number(((Math.random() - 0.5) * 0.14).toFixed(3)),
            playedBy: me.displayName,
          },
        ],
      })
    },
    [commitTabletop],
  )

  const flipTableCard = useCallback(
    (cardId: string) => {
      const prev = tabletopRef.current
      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        tableCards: prev.tableCards.map((tc) =>
          tc.card.id === cardId ? { ...tc, faceUp: !tc.faceUp } : tc,
        ),
      })
    },
    [commitTabletop],
  )

  const resetCardDeck = useCallback(() => {
    const prev = tabletopRef.current
    commitTabletop({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      deck: shuffleCards(createOrderedDeck52()),
      tableCards: [],
      hands: {},
    })
  }, [commitTabletop])

  const spawnTableToken = useCallback(
    (label: string, color: string) => {
      const me = localProfileRef.current
      const prev = tabletopRef.current
      const idx = prev.tokens.length
      const rawX = -0.28 + (idx % 5) * 0.14
      const rawZ = -0.26 + Math.floor(idx / 5) * 0.14
      const snapped = snapTabletopCoords(rawX, rawZ, prev.surface)

      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        tokens: [
          ...prev.tokens.slice(-15),
          {
            id: `tok-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
            label: label.trim().slice(0, 12) || 'Token',
            color,
            localPos: snapped,
            ownerName: me.displayName,
          },
        ],
      })
    },
    [commitTabletop],
  )

  const moveTableToken = useCallback(
    (tokenId: string, localX: number, localZ: number) => {
      const prev = tabletopRef.current
      const snapped = snapTabletopCoords(localX, localZ, prev.surface)
      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        tokens: prev.tokens.map((tok) =>
          tok.id === tokenId ? { ...tok, localPos: snapped } : tok,
        ),
      })
    },
    [commitTabletop],
  )

  const clearTableTokens = useCallback(() => {
    const prev = tabletopRef.current
    commitTabletop({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      tokens: [],
    })
  }, [commitTabletop])

  // =========================================================================
  // PILLAR 4: LIVE PREDICTION & WAGER CHALKBOARD + ALL-TIME CLUBHOUSE LEDGER
  // =========================================================================

  const createPredictionProp = useCallback(
    (title: string, options: string[], stakeDollars = 1) => {
      const cleanTitle = title.trim().slice(0, 80)
      const cleanOptions = options
        .map((o) => o.trim().slice(0, 36))
        .filter(Boolean)
        .slice(0, 4)
      if (!cleanTitle || cleanOptions.length < 2) return

      const me = localProfileRef.current
      const prev = clubhouseRef.current
      const stake = Math.max(1, Math.min(20, Math.round(stakeDollars) || 1))

      const newProp: PredictionProp = {
        id: `prop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        title: cleanTitle,
        options: cleanOptions,
        stakeDollars: stake,
        status: 'open',
        winningOptionIndex: null,
        createdBy: me.displayName,
        createdAt: Date.now(),
        picks: [],
      }

      const next: ClubhousePersistentState = {
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        props: [newProp, ...prev.props].slice(0, 20),
      }
      persistAndBroadcastClubhouse(next)
      appendSystemMessage(
        `📋 ${me.displayName} posted a $${stake} prop on the Chalkboard: "${cleanTitle}"`,
      )
    },
    [appendSystemMessage, persistAndBroadcastClubhouse],
  )

  const pickPropOption = useCallback(
    (propId: string, optionIndex: number) => {
      const me = localProfileRef.current
      const prev = clubhouseRef.current
      const prop = prev.props.find((p) => p.id === propId)
      if (!prop || prop.status !== 'open') return
      if (optionIndex < 0 || optionIndex >= prop.options.length) return

      const userKey = normalizePlayerKey(me.displayName)
      const filteredPicks = prop.picks.filter((pk) => pk.userKey !== userKey)
      const nextPicks = [
        ...filteredPicks,
        {
          userKey,
          userId: localUserId,
          displayName: me.displayName,
          optionIndex,
          pickedAt: Date.now(),
        },
      ]

      const next: ClubhousePersistentState = {
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        props: prev.props.map((p) => (p.id === propId ? { ...p, picks: nextPicks } : p)),
      }
      persistAndBroadcastClubhouse(next)
    },
    [localUserId, persistAndBroadcastClubhouse],
  )

  const lockPredictionProp = useCallback(
    (propId: string) => {
      const prev = clubhouseRef.current
      const prop = prev.props.find((p) => p.id === propId)
      if (!prop || prop.status !== 'open') return

      const next: ClubhousePersistentState = {
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        props: prev.props.map((p) =>
          p.id === propId ? { ...p, status: 'locked' } : p,
        ),
      }
      persistAndBroadcastClubhouse(next)
    },
    [persistAndBroadcastClubhouse],
  )

  const resolvePredictionProp = useCallback(
    (propId: string, winningOptionIndex: number) => {
      const prev = clubhouseRef.current
      const prop = prev.props.find((p) => p.id === propId)
      if (!prop || prop.status === 'resolved') return
      if (winningOptionIndex < 0 || winningOptionIndex >= prop.options.length) return

      const nextLedger: Record<string, LedgerEntry> = { ...prev.ledger }
      const stake = prop.stakeDollars || 1
      let winnersCount = 0

      for (const pick of prop.picks) {
        const existing: LedgerEntry = nextLedger[pick.userKey] ?? {
          key: pick.userKey,
          displayName: pick.displayName,
          netDollars: 0,
          propsWon: 0,
          propsLost: 0,
          updatedAt: Date.now(),
        }

        const won = pick.optionIndex === winningOptionIndex
        if (won) winnersCount += 1

        nextLedger[pick.userKey] = {
          ...existing,
          displayName: pick.displayName,
          netDollars: existing.netDollars + (won ? stake : -stake),
          propsWon: existing.propsWon + (won ? 1 : 0),
          propsLost: existing.propsLost + (won ? 0 : 1),
          updatedAt: Date.now(),
        }
      }

      const next: ClubhousePersistentState = {
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        ledger: nextLedger,
        props: prev.props.map((p) =>
          p.id === propId
            ? {
                ...p,
                status: 'resolved',
                winningOptionIndex,
              }
            : p,
        ),
      }

      persistAndBroadcastClubhouse(next)
      appendSystemMessage(
        `💰 Prop Resolved: "${prop.title}" → ${prop.options[winningOptionIndex]}! (${winnersCount}/${prop.picks.length} picks cashed +$${stake})`,
      )
    },
    [appendSystemMessage, persistAndBroadcastClubhouse],
  )

  const deletePredictionProp = useCallback(
    (propId: string) => {
      const prev = clubhouseRef.current
      const next: ClubhousePersistentState = {
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        props: prev.props.filter((p) => p.id !== propId),
      }
      persistAndBroadcastClubhouse(next)
    },
    [persistAndBroadcastClubhouse],
  )

  // =========================================================================
  // PILLAR 5: TABLE SHUFFLEBOARD, DECK CORNHOLE, HOLOTABLE & ARCADE LEADERBOARD
  // =========================================================================

  const recordShuffleboardShot = useCallback(
    (puck: ShuffleboardPuck, updatedPucks?: ShuffleboardPuck[]) => {
      const me = localProfileRef.current
      const prev = shuffleboardRef.current
      const now = Date.now()
      const baseRed = prev.winnerTeam ? 0 : prev.redScore
      const baseBlue = prev.winnerTeam ? 0 : prev.blueScore
      const nextRed = puck.team === 'red' ? baseRed + puck.points : baseRed
      const nextBlue = puck.team === 'blue' ? baseBlue + puck.points : baseBlue
      const nextWinner =
        nextRed >= 15 ? 'red' : nextBlue >= 15 ? 'blue' : null

      const nextPucks = updatedPucks
        ? updatedPucks.slice(-8)
        : [...(prev.winnerTeam ? [] : prev.pucks).slice(-7), puck]

      const zoneDesc =
        puck.points === 4
          ? '🔥 HANGER (4 PTS)!'
          : puck.points > 0
            ? `+${puck.points} PTS in Zone ${puck.points}!`
            : 'slid off the gutter (0 PTS).'

      const summary = nextWinner
        ? `🏆 ${nextWinner.toUpperCase()} TEAM wins Shuffleboard (${nextRed}–${nextBlue}) on ${me.displayName}'s shot!`
        : `🥌 ${me.displayName} (${puck.team.toUpperCase()}) slid ${zoneDesc}`

      const next: ShuffleboardState = {
        revision: prev.revision + 1,
        updatedAt: now,
        redScore: nextRed,
        blueScore: nextBlue,
        activeTeam: puck.team === 'red' ? 'blue' : 'red',
        pucks: nextPucks,
        lastSummary: summary,
        winnerTeam: nextWinner,
      }

      shuffleboardRef.current = next
      setShuffleboardState(next)
      broadcastBarGamesEvent({ kind: 'shuffleboard-state', payload: next })

      if (nextWinner) {
        const completedMatch: CompletedMatchRecord = {
          id: `shuf-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          game: 'shuffleboard',
          winnerId: localUserId,
          winnerName: me.displayName,
          participants: [
            {
              userId: localUserId,
              displayName: me.displayName,
              finalScore: Math.max(nextRed, nextBlue),
            },
          ],
          highlight: `Shuffleboard ${nextWinner.toUpperCase()} Victory (${nextRed}–${nextBlue})`,
          completedAt: now,
        }
        const nextClub = recordClubhouseAchievement(clubhouseRef.current, {
          shooterName: me.displayName,
          shuffleboardWin: true,
          completedMatch,
        })
        if (nextClub !== clubhouseRef.current) {
          persistAndBroadcastClubhouse(nextClub)
        }
        appendSystemMessage(summary)
      }
    },
    [appendSystemMessage, broadcastBarGamesEvent, localUserId, persistAndBroadcastClubhouse],
  )

  const resetShuffleboard = useCallback(() => {
    const prev = shuffleboardRef.current
    const next: ShuffleboardState = {
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      redScore: 0,
      blueScore: 0,
      activeTeam: 'red',
      pucks: [],
      lastSummary: 'Fresh Shuffleboard match — Red Team slides first! First to 15 pts wins.',
      winnerTeam: null,
    }
    shuffleboardRef.current = next
    setShuffleboardState(next)
    broadcastBarGamesEvent({ kind: 'shuffleboard-state', payload: next })
  }, [broadcastBarGamesEvent])

  const recordCornholeThrow = useCallback(
    (bag: CornholeBagRecord) => {
      const me = localProfileRef.current
      const prev = cornholeRef.current
      const now = Date.now()
      const baseGold = prev.winnerTeam ? 0 : prev.goldScore
      const baseCyan = prev.winnerTeam ? 0 : prev.cyanScore
      const nextGold = bag.team === 'gold' ? baseGold + bag.points : baseGold
      const nextCyan = bag.team === 'cyan' ? baseCyan + bag.points : baseCyan
      const nextWinner =
        nextGold >= 21 ? 'gold' : nextCyan >= 21 ? 'cyan' : null

      const nextBags = [...(prev.winnerTeam ? [] : prev.bags).slice(-7), bag]
      const shotLabel = bag.inHole
        ? '🌽 CORNHOLE! (+3 PTS in the hole)'
        : bag.points === 1
          ? '🪵 Woody! (+1 PT on the board)'
          : 'missed the board (0 PTS)'

      const summary = nextWinner
        ? `🏆 ${nextWinner.toUpperCase()} SQUAD wins Deck Cornhole (${nextGold}–${nextCyan}) via ${me.displayName}!`
        : `${me.displayName} (${bag.team.toUpperCase()}) tossed ${shotLabel}`

      const next: CornholeState = {
        revision: prev.revision + 1,
        updatedAt: now,
        goldScore: nextGold,
        cyanScore: nextCyan,
        activeTeam: bag.team === 'gold' ? 'cyan' : 'gold',
        bags: nextBags,
        lastSummary: summary,
        winnerTeam: nextWinner,
      }

      cornholeRef.current = next
      setCornholeState(next)
      broadcastBarGamesEvent({ kind: 'cornhole-state', payload: next })

      if (nextWinner) {
        const completedMatch: CompletedMatchRecord = {
          id: `corn-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
          game: 'cornhole',
          winnerId: localUserId,
          winnerName: me.displayName,
          participants: [
            {
              userId: localUserId,
              displayName: me.displayName,
              finalScore: Math.max(nextGold, nextCyan),
            },
          ],
          highlight: `Deck Cornhole ${nextWinner.toUpperCase()} Win (${nextGold}–${nextCyan})`,
          completedAt: now,
        }
        const nextClub = recordClubhouseAchievement(clubhouseRef.current, {
          shooterName: me.displayName,
          cornholeWin: true,
          completedMatch,
        })
        if (nextClub !== clubhouseRef.current) {
          persistAndBroadcastClubhouse(nextClub)
        }
        appendSystemMessage(summary)
      }
    },
    [appendSystemMessage, broadcastBarGamesEvent, localUserId, persistAndBroadcastClubhouse],
  )

  const resetCornhole = useCallback(() => {
    const prev = cornholeRef.current
    const next: CornholeState = {
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      goldScore: 0,
      cyanScore: 0,
      activeTeam: 'gold',
      bags: [],
      lastSummary: 'Fresh Deck Cornhole match — Gold Squad tosses first! (3 pts in hole, 1 pt on board)',
      winnerTeam: null,
    }
    cornholeRef.current = next
    setCornholeState(next)
    broadcastBarGamesEvent({ kind: 'cornhole-state', payload: next })
  }, [broadcastBarGamesEvent])

  const commitHolotable = useCallback(
    (next: HolotableState) => {
      const bounded: HolotableState = {
        ...next,
        miniatures: (next.miniatures ?? []).slice(-24),
        revealedFogCells: (next.revealedFogCells ?? []).slice(0, 36),
      }
      holotableRef.current = bounded
      setHolotableState(bounded)
      broadcastBarGamesEvent({ kind: 'holotable-state', payload: bounded })
    },
    [broadcastBarGamesEvent],
  )

  const setHolotableTerrain = useCallback(
    (terrain: HolotableTerrainPresetId) => {
      const me = localProfileRef.current
      const prev = holotableRef.current
      commitHolotable({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        terrain,
        lastActionSummary: `${me.displayName} switched Holotable terrain to ${terrain.replace(/-/g, ' ').toUpperCase()}.`,
      })
    },
    [commitHolotable],
  )

  const selectHolotableMini = useCallback(
    (miniId: string | null) => {
      const prev = holotableRef.current
      commitHolotable({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        selectedMiniId: miniId,
      })
    },
    [commitHolotable],
  )

  const spawnHolotableMini = useCallback(
    (kind: HolotableMiniKind, label: string, color: string) => {
      const me = localProfileRef.current
      const prev = holotableRef.current
      const idx = prev.miniatures.length
      const col = idx % 5
      const row = Math.floor(idx / 5) % 4
      const lx = Number((-0.44 + col * 0.22).toFixed(3))
      const lz = Number((-0.33 + row * 0.22).toFixed(3))
      const newMini: HolotableMiniature = {
        id: `holo-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`,
        kind,
        label: label.trim().slice(0, 16) || 'Token',
        color,
        localPos: [lx, lz],
        rotationY: 0,
        scale: 1,
        ownerName: me.displayName,
      }
      commitHolotable({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        selectedMiniId: newMini.id,
        miniatures: [...prev.miniatures.slice(-17), newMini],
        lastActionSummary: `${me.displayName} deployed miniature "${newMini.label}" onto the Holotable.`,
      })
    },
    [commitHolotable],
  )

  const updateHolotableMini = useCallback(
    (
      miniId: string,
      patch: Partial<Pick<HolotableMiniature, 'localPos' | 'rotationY' | 'scale' | 'color' | 'label'>>,
    ) => {
      const me = localProfileRef.current
      const prev = holotableRef.current
      const target = prev.miniatures.find((m) => m.id === miniId)
      if (!target) return

      const clampedPos: [number, number] = patch.localPos
        ? [
            Number(Math.max(-0.78, Math.min(0.78, patch.localPos[0])).toFixed(3)),
            Number(Math.max(-0.78, Math.min(0.78, patch.localPos[1])).toFixed(3)),
          ]
        : target.localPos

      const clampedScale =
        patch.scale !== undefined
          ? Number(Math.max(0.65, Math.min(1.75, patch.scale)).toFixed(2))
          : target.scale

      const nextMinis = prev.miniatures.map((m) =>
        m.id === miniId
          ? {
              ...m,
              ...patch,
              localPos: clampedPos,
              scale: clampedScale,
            }
          : m,
      )

      commitHolotable({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        selectedMiniId: miniId,
        miniatures: nextMinis,
        lastActionSummary: `${me.displayName} updated "${target.label}" at (${clampedPos[0].toFixed(2)}, ${clampedPos[1].toFixed(2)}).`,
      })
    },
    [commitHolotable],
  )

  const deleteHolotableMini = useCallback(
    (miniId: string) => {
      const me = localProfileRef.current
      const prev = holotableRef.current
      const target = prev.miniatures.find((m) => m.id === miniId)
      const remaining = prev.miniatures.filter((m) => m.id !== miniId)
      commitHolotable({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        selectedMiniId: remaining[0]?.id ?? null,
        miniatures: remaining,
        lastActionSummary: `${me.displayName} removed "${target?.label ?? 'miniature'}" from the Holotable.`,
      })
    },
    [commitHolotable],
  )

  const resetHolotableMinis = useCallback(() => {
    const fresh = createInitialHolotableState()
    const prev = holotableRef.current
    commitHolotable({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      miniatures: fresh.miniatures,
      selectedMiniId: fresh.selectedMiniId,
      lastActionSummary: 'Reset Holotable miniatures to campaign starting party.',
    })
  }, [commitHolotable])

  const toggleHolotableFog = useCallback(
    (enabled?: boolean) => {
      const me = localProfileRef.current
      const prev = holotableRef.current
      const nextFog = enabled !== undefined ? enabled : !prev.fogEnabled
      commitHolotable({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        fogEnabled: nextFog,
        lastActionSummary: `${me.displayName} ${nextFog ? 'engaged' : 'disabled'} Tactical Fog of War.`,
      })
    },
    [commitHolotable],
  )

  const toggleHolotableFogCell = useCallback(
    (cellKey: string) => {
      const me = localProfileRef.current
      const prev = holotableRef.current
      const exists = prev.revealedFogCells.includes(cellKey)
      const nextCells = exists
        ? prev.revealedFogCells.filter((k) => k !== cellKey)
        : [...prev.revealedFogCells, cellKey]
      commitHolotable({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        fogEnabled: true,
        revealedFogCells: nextCells,
        lastActionSummary: `${me.displayName} ${exists ? 'shrouded' : 'revealed'} sector [${cellKey}] in Fog of War.`,
      })
    },
    [commitHolotable],
  )

  const revealAllHolotableFog = useCallback(() => {
    const me = localProfileRef.current
    const prev = holotableRef.current
    const allCells: string[] = []
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        allCells.push(`${r},${c}`)
      }
    }
    commitHolotable({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      revealedFogCells: allCells,
      lastActionSummary: `${me.displayName} revealed all Fog of War sectors across the Holotable!`,
    })
  }, [commitHolotable])

  const shroudAllHolotableFog = useCallback(() => {
    const me = localProfileRef.current
    const prev = holotableRef.current
    commitHolotable({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      fogEnabled: true,
      revealedFogCells: [],
      lastActionSummary: `${me.displayName} shrouded the entire Holotable map in Fog of War.`,
    })
  }, [commitHolotable])

  const setTableGameMode = useCallback(
    (gameMode: TableGameMode) => {
      const me = localProfileRef.current
      const prev = tabletopRef.current
      const banner =
        gameMode === 'blackjack'
          ? `🃏 ${me.displayName} switched table to Blackjack 21 — Click DEAL 21!`
          : gameMode === 'holdem'
            ? `♠️ ${me.displayName} switched table to Texas Hold'em Poker — Click DEAL HOLD'EM!`
            : `🎲 ${me.displayName} switched table to Freeform RPG, Cards & Polyhedral Dice!`
      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        gameMode,
        tableBanner: banner,
      })
    },
    [commitTabletop],
  )

  const betTableChips = useCallback(
    (amount: number) => {
      const me = localProfileRef.current
      const prev = tabletopRef.current
      const chipsMap = { ...(prev.playerChips ?? {}) }
      const currentBankroll = chipsMap[me.displayName] ?? 500
      const wager = Math.max(5, Math.min(currentBankroll, amount))
      chipsMap[me.displayName] = Math.max(0, currentBankroll - wager)
      const nextPot = (prev.potChips ?? 0) + wager

      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        potChips: nextPot,
        playerChips: chipsMap,
        tableBanner: `🪙 ${me.displayName} bet +$${wager} into the Pot (Pot: $${nextPot} · Stack: $${chipsMap[me.displayName]})`,
      })
    },
    [commitTabletop],
  )

  const dealBlackjackRound = useCallback(() => {
    const me = localProfileRef.current
    const prev = tabletopRef.current
    const freshDeck =
      prev.deck.length < 15 ? shuffleCards(createOrderedDeck52()) : [...prev.deck]
    const p1 = freshDeck.shift()!
    const d1 = freshDeck.shift()!
    const p2 = freshDeck.shift()!
    const d2 = freshDeck.shift()!

    const playerCards = [p1, p2]
    const dealerCards = [d1, d2]
    const pScore = scoreBlackjackHand(playerCards)
    const dScore = scoreBlackjackHand(dealerCards)

    const chipsMap = { ...(prev.playerChips ?? {}) }
    if (chipsMap[me.displayName] === undefined) chipsMap[me.displayName] = 500
    const ante = Math.min(25, chipsMap[me.displayName] || 25)
    chipsMap[me.displayName] = Math.max(0, (chipsMap[me.displayName] ?? 500) - ante)
    let pot = (prev.potChips ?? 0) + ante * 2

    let phase: 'betting' | 'player-turn' | 'settled' = 'player-turn'
    let holeRevealed = false
    let banner = `🃏 ${me.displayName}: ${pScore.total}${pScore.soft ? ' (soft)' : ''} vs Dealer [${d1.rank}${d1.suit[0].toUpperCase()} + ?] — HIT or STAND!`

    if (pScore.blackjack) {
      phase = 'settled'
      holeRevealed = true
      if (dScore.blackjack) {
        chipsMap[me.displayName] += ante
        pot = 0
        banner = `🤝 Double Blackjack Push (21 vs 21)! Ante returned.`
      } else {
        const win = Math.round(ante * 2.5)
        chipsMap[me.displayName] += win
        pot = 0
        banner = `🔥 BLACKJACK 21! ${me.displayName} wins +$${win}!`
      }
    }

    commitTabletop({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      gameMode: 'blackjack',
      deck: freshDeck,
      dealerCards,
      dealerHoleRevealed: holeRevealed,
      blackjackPhase: phase,
      potChips: pot,
      playerChips: chipsMap,
      hands: {
        ...prev.hands,
        [localUserId]: {
          userId: localUserId,
          displayName: me.displayName,
          cards: playerCards,
        },
      },
      tableCards: [
        {
          card: p1,
          faceUp: true,
          localPos: [-0.09, 0.24],
          rotationY: -0.05,
          playedBy: me.displayName,
        },
        {
          card: p2,
          faceUp: true,
          localPos: [0.05, 0.24],
          rotationY: 0.05,
          playedBy: me.displayName,
        },
      ],
      tableBanner: banner,
    })
  }, [commitTabletop, localUserId])

  const hitBlackjack = useCallback(() => {
    const me = localProfileRef.current
    const prev = tabletopRef.current
    if (prev.blackjackPhase !== 'player-turn') return
    const freshDeck =
      prev.deck.length < 5 ? shuffleCards(createOrderedDeck52()) : [...prev.deck]
    const drawn = freshDeck.shift()!
    const existing = prev.hands[localUserId]?.cards ?? []
    const nextCards = [...existing, drawn]
    const pScore = scoreBlackjackHand(nextCards)

    let phase: 'betting' | 'player-turn' | 'settled' = 'player-turn'
    let holeRevealed = prev.dealerHoleRevealed ?? false
    let pot = prev.potChips ?? 50
    const chipsMap = { ...(prev.playerChips ?? {}) }
    let banner = `🃏 ${me.displayName} drew ${drawn.rank} (${pScore.total}) — HIT or STAND!`

    if (pScore.total > 21) {
      phase = 'settled'
      holeRevealed = true
      pot = 0
      banner = `💥 BUST (${pScore.total})! Dealer wins pot. Click DEAL 21 for next hand!`
    } else if (pScore.total === 21) {
      // Auto-stand at 21
      const dealerCards = [...(prev.dealerCards ?? [])]
      while (scoreBlackjackHand(dealerCards).total < 17 && freshDeck.length > 0) {
        dealerCards.push(freshDeck.shift()!)
      }
      const dScore = scoreBlackjackHand(dealerCards)
      phase = 'settled'
      holeRevealed = true
      if (dScore.total > 21 || pScore.total > dScore.total) {
        chipsMap[me.displayName] = (chipsMap[me.displayName] ?? 500) + pot
        banner = `🏆 21! ${me.displayName} beats Dealer (${dScore.total}) and wins +$${pot}!`
      } else if (pScore.total === dScore.total) {
        chipsMap[me.displayName] = (chipsMap[me.displayName] ?? 500) + Math.floor(pot / 2)
        banner = `🤝 Push at 21 vs Dealer 21!`
      } else {
        banner = `Dealer wins (${dScore.total} vs ${pScore.total}).`
      }
      pot = 0
      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        deck: freshDeck,
        dealerCards,
        dealerHoleRevealed: holeRevealed,
        blackjackPhase: phase,
        potChips: pot,
        playerChips: chipsMap,
        hands: {
          ...prev.hands,
          [localUserId]: { userId: localUserId, displayName: me.displayName, cards: nextCards },
        },
        tableCards: nextCards.map((c, idx) => ({
          card: c,
          faceUp: true,
          localPos: [Number((-0.18 + idx * 0.12).toFixed(3)), 0.24],
          rotationY: 0,
          playedBy: me.displayName,
        })),
        tableBanner: banner,
      })
      return
    }

    commitTabletop({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      deck: freshDeck,
      dealerHoleRevealed: holeRevealed,
      blackjackPhase: phase,
      potChips: pot,
      playerChips: chipsMap,
      hands: {
        ...prev.hands,
        [localUserId]: { userId: localUserId, displayName: me.displayName, cards: nextCards },
      },
      tableCards: nextCards.map((c, idx) => ({
        card: c,
        faceUp: true,
        localPos: [Number((-0.18 + idx * 0.12).toFixed(3)), 0.24],
        rotationY: 0,
        playedBy: me.displayName,
      })),
      tableBanner: banner,
    })
  }, [commitTabletop, localUserId])

  const standBlackjack = useCallback(() => {
    const me = localProfileRef.current
    const prev = tabletopRef.current
    const freshDeck =
      prev.deck.length < 8 ? shuffleCards(createOrderedDeck52()) : [...prev.deck]
    const playerCards = prev.hands[localUserId]?.cards ?? []
    if (playerCards.length === 0) return

    const dealerCards = [...(prev.dealerCards ?? [])]
    while (scoreBlackjackHand(dealerCards).total < 17 && freshDeck.length > 0) {
      dealerCards.push(freshDeck.shift()!)
    }

    const pScore = scoreBlackjackHand(playerCards)
    const dScore = scoreBlackjackHand(dealerCards)
    const chipsMap = { ...(prev.playerChips ?? {}) }
    const pot = prev.potChips ?? 50
    let banner: string

    if (dScore.total > 21) {
      chipsMap[me.displayName] = (chipsMap[me.displayName] ?? 500) + pot
      banner = `🏆 Dealer BUSTS (${dScore.total})! ${me.displayName} (${pScore.total}) wins +$${pot}!`
    } else if (pScore.total > dScore.total) {
      chipsMap[me.displayName] = (chipsMap[me.displayName] ?? 500) + pot
      banner = `🏆 ${me.displayName} (${pScore.total}) beats Dealer (${dScore.total}) for +$${pot}!`
    } else if (pScore.total === dScore.total) {
      chipsMap[me.displayName] = (chipsMap[me.displayName] ?? 500) + Math.floor(pot / 2)
      banner = `🤝 Push at ${pScore.total} vs Dealer ${dScore.total}!`
    } else {
      banner = `Dealer wins (${dScore.total} vs ${pScore.total}). Click DEAL 21 for next hand!`
    }

    commitTabletop({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      deck: freshDeck,
      dealerCards,
      dealerHoleRevealed: true,
      blackjackPhase: 'settled',
      potChips: 0,
      playerChips: chipsMap,
      tableBanner: banner,
    })
  }, [commitTabletop, localUserId])

  const dealHoldemRound = useCallback(() => {
    const me = localProfileRef.current
    const prev = tabletopRef.current
    const freshDeck = shuffleCards(createOrderedDeck52())
    const h1 = freshDeck.shift()!
    const h2 = freshDeck.shift()!
    const d1 = freshDeck.shift()!
    const d2 = freshDeck.shift()!

    const chipsMap = { ...(prev.playerChips ?? {}) }
    if (chipsMap[me.displayName] === undefined) chipsMap[me.displayName] = 500
    const blind = Math.min(20, chipsMap[me.displayName] || 20)
    chipsMap[me.displayName] = Math.max(0, (chipsMap[me.displayName] ?? 500) - blind)
    const pot = (prev.potChips ?? 0) + blind * 2

    commitTabletop({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      gameMode: 'holdem',
      deck: freshDeck,
      dealerCards: [d1, d2],
      dealerHoleRevealed: false,
      holdemStreet: 'preflop',
      potChips: pot,
      playerChips: chipsMap,
      tableCards: [],
      hands: {
        ...prev.hands,
        [localUserId]: {
          userId: localUserId,
          displayName: me.displayName,
          cards: [h1, h2],
        },
      },
      tableBanner: `♠️ Hold'em Pre-Flop dealt! Pot: $${pot} — Click BET +$25 or DEAL FLOP!`,
    })
  }, [commitTabletop, localUserId])

  const advanceHoldemStreet = useCallback(() => {
    const me = localProfileRef.current
    const prev = tabletopRef.current
    const freshDeck =
      prev.deck.length < 8 ? shuffleCards(createOrderedDeck52()) : [...prev.deck]
    const street = prev.holdemStreet ?? 'idle'

    if (street === 'idle' || street === 'showdown') {
      dealHoldemRound()
      return
    }

    if (street === 'preflop') {
      const c1 = freshDeck.shift()!
      const c2 = freshDeck.shift()!
      const c3 = freshDeck.shift()!
      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        deck: freshDeck,
        holdemStreet: 'flop',
        tableCards: [c1, c2, c3].map((card, i) => ({
          card,
          faceUp: true,
          localPos: [Number((-0.24 + i * 0.12).toFixed(3)), 0.0],
          rotationY: 0,
          playedBy: 'Dealer',
        })),
        tableBanner: `♠️ THE FLOP: ${c1.rank}${c1.suit[0].toUpperCase()} ${c2.rank}${c2.suit[0].toUpperCase()} ${c3.rank}${c3.suit[0].toUpperCase()} · Click BET or TURN!`,
      })
      return
    }

    if (street === 'flop') {
      const c4 = freshDeck.shift()!
      const nextComm = [
        ...prev.tableCards,
        {
          card: c4,
          faceUp: true,
          localPos: [0.12, 0.0] as [number, number],
          rotationY: 0,
          playedBy: 'Dealer',
        },
      ]
      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        deck: freshDeck,
        holdemStreet: 'turn',
        tableCards: nextComm,
        tableBanner: `♠️ THE TURN: ${c4.rank}${c4.suit[0].toUpperCase()} · Click BET or RIVER!`,
      })
      return
    }

    if (street === 'turn') {
      const c5 = freshDeck.shift()!
      const nextComm = [
        ...prev.tableCards,
        {
          card: c5,
          faceUp: true,
          localPos: [0.24, 0.0] as [number, number],
          rotationY: 0,
          playedBy: 'Dealer',
        },
      ]
      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        deck: freshDeck,
        holdemStreet: 'river',
        tableCards: nextComm,
        tableBanner: `♠️ THE RIVER: ${c5.rank}${c5.suit[0].toUpperCase()} · Click SHOWDOWN to reveal winner!`,
      })
      return
    }

    if (street === 'river') {
      const comm = prev.tableCards.map((tc) => tc.card)
      const myHole = prev.hands[localUserId]?.cards ?? []
      const houseHole = prev.dealerCards ?? []
      const myEval = evaluateHoldemHand([...myHole, ...comm])
      const houseEval = evaluateHoldemHand([...houseHole, ...comm])
      const pot = prev.potChips ?? 60
      const chipsMap = { ...(prev.playerChips ?? {}) }
      let banner: string
      if (myEval.score >= houseEval.score) {
        chipsMap[me.displayName] = (chipsMap[me.displayName] ?? 500) + pot
        banner = `🏆 SHOWDOWN: ${me.displayName} wins +$${pot} with ${myEval.label} vs House (${houseEval.label})!`
      } else {
        banner = `♠️ SHOWDOWN: House wins with ${houseEval.label} vs ${me.displayName} (${myEval.label}).`
      }
      commitTabletop({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        dealerHoleRevealed: true,
        holdemStreet: 'showdown',
        potChips: 0,
        playerChips: chipsMap,
        tableBanner: banner,
      })
    }
  }, [commitTabletop, dealHoldemRound, localUserId])

  // =========================================================================
  // GAME ROOM CENTERPIECE TABLE: RPG COMBAT, CHECKERS, CHESS & CONNECT-4
  // =========================================================================

  const setHolotableGameMode = useCallback(
    (gameMode: HolotableGameMode) => {
      const me = localProfileRef.current
      const prev = holotableRef.current
      const modeNames: Record<HolotableGameMode, string> = {
        'adventure-rpg': '⚔️ Adventure Quest RPG Campaign',
        checkers: '🔴 Classic Checkers (8×8)',
        chess: '♟️ Grandmaster Chess (8×8)',
        connect4: '🟡 Connect-4 Strategy Grid',
      }
      commitHolotable({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        gameMode,
        lastActionSummary: `${me.displayName} switched Game Room Table to ${modeNames[gameMode]}!`,
      })
    },
    [commitHolotable],
  )

  const rollRpgCombatAction = useCallback(
    (actionKind: 'melee' | 'spell' | 'heal') => {
      const me = localProfileRef.current
      const prev = holotableRef.current
      const d20 = Math.floor(Math.random() * 20) + 1
      const dmg =
        actionKind === 'melee'
          ? Math.floor(Math.random() * 10) + 6 + (d20 === 20 ? 12 : 0)
          : actionKind === 'spell'
            ? Math.floor(Math.random() * 14) + 8 + (d20 === 20 ? 14 : 0)
            : Math.floor(Math.random() * 10) + 8

      const selected =
        prev.miniatures.find((m) => m.id === prev.selectedMiniId) ?? prev.miniatures[0]
      const actorName = selected?.label ?? me.displayName

      // Find boss / monster target for attacks, or selected hero for heals
      const monsterTarget =
        prev.miniatures.find((m) => m.kind.startsWith('monster-')) ??
        prev.miniatures[prev.miniatures.length - 1]

      let summary: string
      const nextMinis = prev.miniatures.map((m) => {
        const curHp = m.hp ?? 40
        const maxHp = m.maxHp ?? 40
        if (actionKind === 'heal' && m.id === selected?.id) {
          const healed = Math.min(maxHp, curHp + dmg)
          return { ...m, hp: healed }
        }
        if (actionKind !== 'heal' && m.id === monsterTarget?.id && d20 >= 8) {
          const remainingHp = Math.max(0, curHp - dmg)
          return { ...m, hp: remainingHp }
        }
        return m
      })

      if (actionKind === 'heal') {
        summary = `✨ ${actorName} cast Divine Heal (+${dmg} HP)!`
      } else if (d20 === 20) {
        summary = `🔥 NAT 20 CRIT! ${actorName} struck ${monsterTarget?.label ?? 'Boss'} for ${dmg} DMG!`
      } else if (d20 >= 8) {
        summary = `⚔️ ${actorName} rolled D20(${d20}) HIT on ${monsterTarget?.label ?? 'Boss'} for ${dmg} DMG!`
      } else {
        summary = `🛡️ ${actorName} rolled D20(${d20}) — attack grazed ${monsterTarget?.label ?? 'Boss'}'s armor!`
      }

      const prevLog = prev.rpgCombatLog ?? []
      const nextTurnIdx = ((prev.rpgActiveTurnIndex ?? 0) + 1) % Math.max(1, nextMinis.length)
      const nextRound =
        nextTurnIdx === 0 ? (prev.rpgRound ?? 1) + 1 : (prev.rpgRound ?? 1)

      commitHolotable({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        miniatures: nextMinis,
        rpgRound: nextRound,
        rpgActiveTurnIndex: nextTurnIdx,
        rpgCombatLog: [summary, ...prevLog].slice(0, 6),
        lastActionSummary: summary,
      })
    },
    [commitHolotable],
  )

  const adjustHolotableMiniHp = useCallback(
    (miniId: string, delta: number) => {
      const prev = holotableRef.current
      const nextMinis = prev.miniatures.map((m) => {
        if (m.id !== miniId) return m
        const maxHp = m.maxHp ?? 50
        const curHp = m.hp ?? maxHp
        return {
          ...m,
          hp: Math.max(0, Math.min(maxHp, curHp + delta)),
        }
      })
      commitHolotable({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        miniatures: nextMinis,
      })
    },
    [commitHolotable],
  )

  const clickCheckersCell = useCallback(
    (cellIdx: number) => {
      const me = localProfileRef.current
      const prev = holotableRef.current
      const board = [...(prev.checkersBoard ?? createInitialCheckersBoard())]
      const turn = prev.checkersTurn ?? 'red'
      const selectedIdx = prev.checkersSelectedIdx ?? null

      if (prev.checkersWinner) return

      const clickedPiece = board[cellIdx] ?? 0
      const clickedIsOwn =
        (turn === 'red' && (clickedPiece === 1 || clickedPiece === 3)) ||
        (turn === 'black' && (clickedPiece === 2 || clickedPiece === 4))

      if (clickedIsOwn) {
        commitHolotable({
          ...prev,
          revision: prev.revision + 1,
          updatedAt: Date.now(),
          checkersSelectedIdx: cellIdx,
          lastActionSummary: `${me.displayName} selected ${turn.toUpperCase()} checker at square #${cellIdx}.`,
        })
        return
      }

      if (selectedIdx !== null) {
        const legal = getCheckersLegalMoves(board, selectedIdx, turn)
        const move = legal.find((m) => m.toIdx === cellIdx)
        if (move) {
          let movingPiece = board[selectedIdx]
          board[selectedIdx] = 0
          if (move.jumpedIdx !== null) {
            board[move.jumpedIdx] = 0
          }
          const destRow = Math.floor(cellIdx / 8)
          if (movingPiece === 1 && destRow === 0) movingPiece = 3
          if (movingPiece === 2 && destRow === 7) movingPiece = 4
          board[cellIdx] = movingPiece

          const redLeft = board.some((p) => p === 1 || p === 3)
          const blackLeft = board.some((p) => p === 2 || p === 4)
          const winner: 'red' | 'black' | null = !blackLeft
            ? 'red'
            : !redLeft
              ? 'black'
              : null
          const nextTurn = turn === 'red' ? 'black' : 'red'

          commitHolotable({
            ...prev,
            revision: prev.revision + 1,
            updatedAt: Date.now(),
            checkersBoard: board,
            checkersTurn: nextTurn,
            checkersSelectedIdx: null,
            checkersWinner: winner,
            lastActionSummary: winner
              ? `🏆 ${winner.toUpperCase()} WINS Checkers on the Game Room Table!`
              : `🔴 ${me.displayName} moved ${turn.toUpperCase()}${move.jumpedIdx !== null ? ' (JUMP CAPTURE!)' : ''} · ${nextTurn.toUpperCase()}'s turn.`,
          })
        }
      }
    },
    [commitHolotable],
  )

  const resetCheckersBoard = useCallback(() => {
    const prev = holotableRef.current
    commitHolotable({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      gameMode: 'checkers',
      checkersBoard: createInitialCheckersBoard(),
      checkersTurn: 'red',
      checkersSelectedIdx: null,
      checkersWinner: null,
      lastActionSummary: 'Fresh Checkers match started — RED moves first!',
    })
  }, [commitHolotable])

  const clickChessCell = useCallback(
    (cellIdx: number) => {
      const me = localProfileRef.current
      const prev = holotableRef.current
      const board = [...(prev.chessBoard ?? createInitialChessBoard())]
      const turn = prev.chessTurn ?? 'w'
      const selectedIdx = prev.chessSelectedIdx ?? null

      if (prev.chessWinner) return

      const clicked = board[cellIdx] || ''
      if (clicked && clicked[0] === turn) {
        commitHolotable({
          ...prev,
          revision: prev.revision + 1,
          updatedAt: Date.now(),
          chessSelectedIdx: cellIdx,
          lastActionSummary: `${me.displayName} selected ${turn === 'w' ? 'Gold' : 'Obsidian'} ${clicked[1]} at square #${cellIdx}.`,
        })
        return
      }

      if (selectedIdx !== null) {
        const legal = getChessLegalMoves(board, selectedIdx, turn)
        if (legal.includes(cellIdx)) {
          let moving = board[selectedIdx]
          const captured = board[cellIdx]
          board[selectedIdx] = ''
          const destRow = Math.floor(cellIdx / 8)
          if (moving === 'wP' && destRow === 0) moving = 'wQ'
          if (moving === 'bP' && destRow === 7) moving = 'bQ'
          board[cellIdx] = moving

          const winner: 'w' | 'b' | null =
            captured === 'bK' ? 'w' : captured === 'wK' ? 'b' : null
          const nextTurn = turn === 'w' ? 'b' : 'w'

          commitHolotable({
            ...prev,
            revision: prev.revision + 1,
            updatedAt: Date.now(),
            chessBoard: board,
            chessTurn: nextTurn,
            chessSelectedIdx: null,
            chessWinner: winner,
            lastActionSummary: winner
              ? `🏆 CHECKMATE! ${winner === 'w' ? 'GOLD' : 'OBSIDIAN'} wins Chess!`
              : `♟️ ${me.displayName} moved ${moving}${captured ? ` capturing ${captured}` : ''} · ${nextTurn === 'w' ? 'Gold' : 'Obsidian'}'s turn.`,
          })
        }
      }
    },
    [commitHolotable],
  )

  const resetChessBoard = useCallback(() => {
    const prev = holotableRef.current
    commitHolotable({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      gameMode: 'chess',
      chessBoard: createInitialChessBoard(),
      chessTurn: 'w',
      chessSelectedIdx: null,
      chessWinner: null,
      lastActionSummary: 'Fresh Chess match started — Gold (White) moves first!',
    })
  }, [commitHolotable])

  const dropConnect4Column = useCallback(
    (col: number) => {
      const me = localProfileRef.current
      const prev = holotableRef.current
      if (col < 0 || col >= 7 || prev.connect4Winner) return
      const grid = [...(prev.connect4Grid ?? createInitialConnect4Grid())]
      const turn = prev.connect4Turn ?? 1

      let placedRow = -1
      for (let r = 5; r >= 0; r--) {
        if (grid[r * 7 + col] === 0) {
          grid[r * 7 + col] = turn
          placedRow = r
          break
        }
      }
      if (placedRow === -1) return

      const winner = checkConnect4Winner(grid)
      const nextTurn: 1 | 2 = turn === 1 ? 2 : 1

      commitHolotable({
        ...prev,
        revision: prev.revision + 1,
        updatedAt: Date.now(),
        connect4Grid: grid,
        connect4Turn: nextTurn,
        connect4Winner: winner,
        lastActionSummary: winner
          ? `🏆 ${winner === 1 ? 'GOLD' : 'CYAN'} connects 4 in a row and wins!`
          : `🟡 ${me.displayName} dropped ${turn === 1 ? 'GOLD' : 'CYAN'} disc in Column ${col + 1} · ${nextTurn === 1 ? 'GOLD' : 'CYAN'}'s turn.`,
      })
    },
    [commitHolotable],
  )

  const resetConnect4Grid = useCallback(() => {
    const prev = holotableRef.current
    commitHolotable({
      ...prev,
      revision: prev.revision + 1,
      updatedAt: Date.now(),
      gameMode: 'connect4',
      connect4Grid: createInitialConnect4Grid(),
      connect4Turn: 1,
      connect4Winner: null,
      lastActionSummary: 'Fresh Connect-4 match started — GOLD drops first!',
    })
  }, [commitHolotable])

  const recordArcadeStationScore = useCallback(
    (
      game: 'arcade-hoops' | 'arcade-skeeball' | 'arcade-retro',
      score: number,
      highlight: string,
    ) => {
      if (score <= 0) return
      const me = localProfileRef.current
      const now = Date.now()
      const completedMatch: CompletedMatchRecord = {
        id: `arc-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        game,
        winnerId: localUserId,
        winnerName: me.displayName,
        participants: [
          {
            userId: localUserId,
            displayName: me.displayName,
            finalScore: score,
          },
        ],
        highlight,
        completedAt: now,
      }
      const nextClub = recordClubhouseAchievement(clubhouseRef.current, {
        shooterName: me.displayName,
        arcadeScore: score,
        completedMatch,
      })
      if (nextClub !== clubhouseRef.current) {
        persistAndBroadcastClubhouse(nextClub)
      }
      appendSystemMessage(`🕹 ${me.displayName} posted ${score} PTS on ${highlight}!`)
    },
    [appendSystemMessage, localUserId, persistAndBroadcastClubhouse],
  )

  return {
    dartsState,
    puttingState,
    tabletopState,
    clubhouseState,
    shuffleboardState,
    cornholeState,
    holotableState,
    activeDartShot,
    activePuttShot,
    // Darts
    launchDartShot,
    settleDartShot,
    joinDartsMatch,
    configureDartsMatch,
    resetDartsMatch,
    // Putting
    launchPuttShot,
    settlePuttShot,
    joinPuttingMatch,
    configurePuttingMatch,
    resetPuttingBallToTee,
    resetPuttingMatch,
    // Game & Dice Table
    rollPolyhedralDice,
    rerollSingleDie,
    setTableSurface,
    setTableGameMode,
    betTableChips,
    dealBlackjackRound,
    hitBlackjack,
    standBlackjack,
    dealHoldemRound,
    advanceHoldemStreet,
    shuffleDeck,
    drawCardToHand,
    playCardFromHand,
    dealCardToTable,
    flipTableCard,
    resetCardDeck,
    spawnTableToken,
    moveTableToken,
    clearTableTokens,
    // Prediction Chalkboard & Ledger
    createPredictionProp,
    pickPropOption,
    lockPredictionProp,
    resolvePredictionProp,
    deletePredictionProp,
    // Shuffleboard
    recordShuffleboardShot,
    resetShuffleboard,
    // Deck Cornhole
    recordCornholeThrow,
    resetCornhole,
    // Game Room Tactical Holotable, Board Games & Arcade
    setHolotableGameMode,
    setHolotableTerrain,
    selectHolotableMini,
    spawnHolotableMini,
    updateHolotableMini,
    deleteHolotableMini,
    resetHolotableMinis,
    toggleHolotableFog,
    toggleHolotableFogCell,
    revealAllHolotableFog,
    shroudAllHolotableFog,
    rollRpgCombatAction,
    adjustHolotableMiniHp,
    clickCheckersCell,
    resetCheckersBoard,
    clickChessCell,
    resetChessBoard,
    dropConnect4Column,
    resetConnect4Grid,
    recordArcadeStationScore,
  }
}
