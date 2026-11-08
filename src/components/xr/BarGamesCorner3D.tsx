import { useMemo } from 'react'
import { computeBarGamesLayout } from '../../constants/hangout'
import type {
  ClubhousePersistentState,
  DartGameMode,
  DartShotSettlePacket,
  DartsMatchState,
  DieKind,
  LiveDartShotPacket,
  LivePuttShotPacket,
  PuttShotSettlePacket,
  PuttingGameMode,
  PuttingMatchState,
  ShuffleboardPuck,
  ShuffleboardState,
  TableGameMode,
  TableSurfaceStyle,
  TabletopState,
} from '../../types/barGames'
import type { ParticipantProfile, RoomCustomizationState } from '../../types/lounge'
import { DartboardStation3D } from './DartboardStation3D'
import { InteractiveGameTable3D } from './InteractiveGameTable3D'
import { PredictionChalkboard3D } from './PredictionChalkboard3D'
import { PuttingGreen3D } from './PuttingGreen3D'
import { ShuffleboardTable3D } from './ShuffleboardTable3D'

export interface BarGamesCorner3DProps {
  localUserId: string
  localDisplayName: string
  localSeatId: string | undefined
  participants: ParticipantProfile[]
  roomCustomization: RoomCustomizationState
  buildMode: boolean
  dartsState: DartsMatchState
  puttingState: PuttingMatchState
  tabletopState: TabletopState
  clubhouseState: ClubhousePersistentState
  shuffleboardState: ShuffleboardState
  activeDartShot: LiveDartShotPacket | null
  activePuttShot: LivePuttShotPacket | null
  onSelectSeat: (seatId: string) => void
  onOpen2DPropsDrawer?: () => void
  // Darts
  onLaunchDartShot: (
    origin: [number, number, number],
    velocity: [number, number, number],
    boardCenter: [number, number, number],
  ) => void
  onSettleDartShot: (packet: DartShotSettlePacket) => void
  onJoinDarts: () => void
  onConfigureDarts: (patch: { mode?: DartGameMode; doubleOut?: boolean }) => void
  onResetDarts: () => void
  // Putting
  onLaunchPuttShot: (
    localOrigin: [number, number],
    localVelocity: [number, number],
  ) => void
  onSettlePuttShot: (packet: PuttShotSettlePacket) => void
  onJoinPutting: () => void
  onConfigurePutting: (patch: { mode?: PuttingGameMode; rampEnabled?: boolean }) => void
  onResetBallToTee: () => void
  onResetPutting: () => void
  // Tabletop
  onRollDice: (kinds: DieKind[]) => void
  onRerollSingleDie: (dieId: string) => void
  onSetSurface: (surface: TableSurfaceStyle) => void
  onSetGameMode?: (mode: TableGameMode) => void
  onBetChips?: (amount: number) => void
  onDealBlackjack?: () => void
  onHitBlackjack?: () => void
  onStandBlackjack?: () => void
  onDealHoldem?: () => void
  onAdvanceHoldemStreet?: () => void
  onShuffleDeck: () => void
  onDrawCardToHand: () => void
  onPlayCardFromHand: (cardId: string, faceUp: boolean) => void
  onDealCardToTable: (faceUp: boolean) => void
  onFlipTableCard: (cardId: string) => void
  onResetDeck: () => void
  onSpawnToken: (label: string, color: string) => void
  onMoveToken: (tokenId: string, localX: number, localZ: number) => void
  // Chalkboard
  onCreateProp: (title: string, options: string[], stakeDollars?: number) => void
  onPickPropOption: (propId: string, optionIndex: number) => void
  onLockProp: (propId: string) => void
  onResolveProp: (propId: string, winningOptionIndex: number) => void
  // Shuffleboard
  onRecordShuffleboardShot: (
    puck: ShuffleboardPuck,
    updatedPucks?: ShuffleboardPuck[],
  ) => void
  onResetShuffleboard: () => void
}

export function BarGamesCorner3D({
  localUserId,
  localDisplayName,
  localSeatId,
  participants,
  roomCustomization,
  buildMode,
  dartsState,
  puttingState,
  tabletopState,
  clubhouseState,
  shuffleboardState,
  activeDartShot,
  activePuttShot,
  onSelectSeat,
  onOpen2DPropsDrawer,
  onLaunchDartShot,
  onSettleDartShot,
  onJoinDarts,
  onConfigureDarts,
  onResetDarts,
  onLaunchPuttShot,
  onSettlePuttShot,
  onJoinPutting,
  onConfigurePutting,
  onResetBallToTee,
  onResetPutting,
  onRollDice,
  onRerollSingleDie,
  onSetSurface,
  onSetGameMode,
  onBetChips,
  onDealBlackjack,
  onHitBlackjack,
  onStandBlackjack,
  onDealHoldem,
  onAdvanceHoldemStreet,
  onShuffleDeck,
  onDrawCardToHand,
  onPlayCardFromHand,
  onDealCardToTable,
  onFlipTableCard,
  onResetDeck,
  onSpawnToken,
  onMoveToken,
  onCreateProp,
  onPickPropOption,
  onLockProp,
  onResolveProp,
  onRecordShuffleboardShot,
  onResetShuffleboard,
}: BarGamesCorner3DProps) {
  const layout = useMemo(
    () => computeBarGamesLayout(roomCustomization),
    [roomCustomization],
  )
  const accentColor = roomCustomization.lighting.accentColor || '#E5A93C'

  return (
    <group name="bar-games-and-tabletop-corner">
      <DartboardStation3D
        localUserId={localUserId}
        localSeatId={localSeatId}
        dartboardCenter={layout.dartboardCenter}
        scoreboardCenter={layout.scoreboardCenter}
        ocheFloorPos={layout.ocheFloorPos}
        accentColor={accentColor}
        buildMode={buildMode}
        dartsState={dartsState}
        clubhouseState={clubhouseState}
        activeDartShot={activeDartShot}
        onSelectSeat={onSelectSeat}
        onLaunchDartShot={onLaunchDartShot}
        onSettleDartShot={onSettleDartShot}
        onJoinDarts={onJoinDarts}
        onConfigureDarts={onConfigureDarts}
        onResetDarts={onResetDarts}
      />

      <PuttingGreen3D
        localUserId={localUserId}
        localSeatId={localSeatId}
        stripOrigin={layout.puttingStripOrigin}
        teeFloorPos={layout.puttingTeePos}
        accentColor={accentColor}
        buildMode={buildMode}
        puttingState={puttingState}
        activePuttShot={activePuttShot}
        onSelectSeat={onSelectSeat}
        onLaunchPuttShot={onLaunchPuttShot}
        onSettlePuttShot={onSettlePuttShot}
        onJoinPutting={onJoinPutting}
        onConfigurePutting={onConfigurePutting}
        onResetBallToTee={onResetBallToTee}
        onResetPutting={onResetPutting}
      />

      <InteractiveGameTable3D
        localUserId={localUserId}
        localSeatId={localSeatId}
        participants={participants}
        tableOrigin={layout.gameTableOrigin}
        accentColor={accentColor}
        buildMode={buildMode}
        tabletopState={tabletopState}
        onSelectSeat={onSelectSeat}
        onRollDice={onRollDice}
        onRerollSingleDie={onRerollSingleDie}
        onSetSurface={onSetSurface}
        onSetGameMode={onSetGameMode}
        onBetChips={onBetChips}
        onDealBlackjack={onDealBlackjack}
        onHitBlackjack={onHitBlackjack}
        onStandBlackjack={onStandBlackjack}
        onDealHoldem={onDealHoldem}
        onAdvanceHoldemStreet={onAdvanceHoldemStreet}
        onShuffleDeck={onShuffleDeck}
        onDrawCardToHand={onDrawCardToHand}
        onPlayCardFromHand={onPlayCardFromHand}
        onDealCardToTable={onDealCardToTable}
        onFlipTableCard={onFlipTableCard}
        onResetDeck={onResetDeck}
        onSpawnToken={onSpawnToken}
        onMoveToken={onMoveToken}
      />

      <PredictionChalkboard3D
        localDisplayName={localDisplayName}
        chalkboardCenter={layout.chalkboardCenter}
        accentColor={accentColor}
        buildMode={buildMode}
        clubhouseState={clubhouseState}
        onCreateProp={onCreateProp}
        onPickOption={onPickPropOption}
        onLockProp={onLockProp}
        onResolveProp={onResolveProp}
        onOpen2DPropsDrawer={onOpen2DPropsDrawer}
      />

      <ShuffleboardTable3D
        origin={layout.shuffleboardOrigin}
        state={shuffleboardState}
        localDisplayName={localDisplayName}
        onRecordShot={onRecordShuffleboardShot}
        onReset={onResetShuffleboard}
        onSnapToStation={() => onSelectSeat('station:shuffleboard')}
      />
    </group>
  )
}
