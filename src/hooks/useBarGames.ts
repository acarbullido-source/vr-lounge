import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DIE_COLORS,
  DIE_MAX_VALUES,
  PUTTING_STRIP_SPECS,
  applyDartHitToMatch,
  applyPuttSettleToMatch,
  createDartPlayerSlot,
  createEmptyCricketMarks,
  createInitialClubhouseState,
  createInitialDartsMatchState,
  createInitialPuttingMatchState,
  createInitialTabletopState,
  createOrderedDeck52,
  createPuttingPlayerSlot,
  normalizePlayerKey,
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
  DartGameMode,
  DartShotSettlePacket,
  DartsMatchState,
  DieKind,
  LedgerEntry,
  LiveDartShotPacket,
  LivePuttShotPacket,
  PredictionProp,
  PuttShotSettlePacket,
  PuttingGameMode,
  PuttingMatchState,
  RolledDie,
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

  const [activeDartShot, setActiveDartShot] = useState<LiveDartShotPacket | null>(null)
  const [activePuttShot, setActivePuttShot] = useState<LivePuttShotPacket | null>(null)

  const dartsRef = useRef<DartsMatchState>(dartsState)
  const puttingRef = useRef<PuttingMatchState>(puttingState)
  const tabletopRef = useRef<TabletopState>(tabletopState)
  const clubhouseRef = useRef<ClubhousePersistentState>(clubhouseState)
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
      const savedClubhouse =
        loadLocalClubhouseState(normalizedRoomCode) ?? createInitialClubhouseState()

      dartsRef.current = freshDarts
      puttingRef.current = freshPutting
      tabletopRef.current = freshTabletop
      clubhouseRef.current = savedClubhouse

      setDartsState(freshDarts)
      setPuttingState(freshPutting)
      setTabletopState(freshTabletop)
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
        clubhouseRef.current.revision > 0
      if (!hasAnyActivity) return

      sendEvent({
        kind: 'bar-games-full-sync',
        darts: dartsRef.current,
        putting: puttingRef.current,
        tabletop: tabletopRef.current,
        clubhouse: clubhouseRef.current,
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
            tabletopRef.current = event.payload
            return event.payload
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
            tabletopRef.current = event.tabletop
            return event.tabletop
          })
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
      tabletopRef.current = next
      setTabletopState(next)
      broadcastBarGamesEvent({ kind: 'tabletop-state', payload: next })
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

  return {
    dartsState,
    puttingState,
    tabletopState,
    clubhouseState,
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
  }
}
