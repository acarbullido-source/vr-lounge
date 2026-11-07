import { RoundedBox, Text } from '@react-three/drei'
import { Suspense, useMemo, useState } from 'react'
import { QUICK_PROP_TEMPLATES, normalizePlayerKey } from '../../constants/barGames'
import type { ClubhousePersistentState } from '../../types/barGames'

export interface PredictionChalkboard3DProps {
  localDisplayName: string
  chalkboardCenter: [number, number, number]
  accentColor: string
  buildMode: boolean
  clubhouseState: ClubhousePersistentState
  onCreateProp: (title: string, options: string[], stakeDollars?: number) => void
  onPickOption: (propId: string, optionIndex: number) => void
  onLockProp: (propId: string) => void
  onResolveProp: (propId: string, winningOptionIndex: number) => void
  onOpen2DPropsDrawer?: () => void
}

interface ChalkButtonProps {
  label: string
  position: [number, number, number]
  width?: number
  height?: number
  fill?: string
  hoverFill?: string
  textColor?: string
  onClick: () => void
}

function ChalkButton({
  label,
  position,
  width = 0.28,
  height = 0.068,
  fill = '#1F2E27',
  hoverFill = '#2D4439',
  textColor = '#F4F1EA',
  onClick,
}: ChalkButtonProps) {
  const [hovered, setHovered] = useState(false)
  return (
    <group
      position={position}
      pointerEventsType={{ deny: 'grab' }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      <RoundedBox args={[width, height, 0.014]} radius={0.014} smoothness={2}>
        <meshBasicMaterial color={hovered ? hoverFill : fill} />
      </RoundedBox>
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.023}
          color={textColor}
          maxWidth={width - 0.02}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Suspense>
    </group>
  )
}

export function PredictionChalkboard3D({
  localDisplayName,
  chalkboardCenter,
  accentColor,
  buildMode,
  clubhouseState,
  onCreateProp,
  onPickOption,
  onLockProp,
  onResolveProp,
  onOpen2DPropsDrawer,
}: PredictionChalkboard3DProps) {
  const [propCursor, setPropCursor] = useState(0)
  const propsList = clubhouseState.props
  const safeIdx = propsList.length > 0 ? propCursor % propsList.length : 0
  const activeProp = propsList[safeIdx] ?? null
  const myUserKey = normalizePlayerKey(localDisplayName)

  const ledgerEntries = useMemo(() => {
    return Object.values(clubhouseState.ledger)
      .sort((a, b) => b.netDollars - a.netDollars || b.propsWon - a.propsWon)
      .slice(0, 4)
  }, [clubhouseState.ledger])

  return (
    <group
      name="bar-games-prediction-chalkboard"
      position={chalkboardCenter}
      rotation={[0, Math.PI, 0]}
    >
      {/* Warm Oak Chalkboard Frame */}
      <RoundedBox args={[1.56, 1.24, 0.042]} radius={0.024} smoothness={2}>
        <meshStandardMaterial color="#3A2416" roughness={0.65} metalness={0.1} />
      </RoundedBox>

      {/* Matte Slate Chalkboard Writing Surface */}
      <mesh position={[0, 0, 0.022]}>
        <planeGeometry args={[1.46, 1.14]} />
        <meshStandardMaterial color="#14231C" roughness={0.92} metalness={0.02} />
      </mesh>

      {/* Lower Wooden Chalk Tray + Colored Chalk Sticks */}
      <mesh position={[0, -0.59, 0.055]}>
        <boxGeometry args={[1.42, 0.028, 0.075]} />
        <meshStandardMaterial color="#4A2E1B" roughness={0.6} />
      </mesh>
      <mesh position={[-0.32, -0.568, 0.058]} rotation={[0, 0.12, Math.PI / 2]}>
        <cylinderGeometry args={[0.007, 0.007, 0.08, 8]} />
        <meshBasicMaterial color="#F8FAFC" />
      </mesh>
      <mesh position={[-0.18, -0.568, 0.058]} rotation={[0, -0.2, Math.PI / 2]}>
        <cylinderGeometry args={[0.007, 0.007, 0.075, 8]} />
        <meshBasicMaterial color="#FDE047" />
      </mesh>

      {/* Header + Quick $1 Prop Template Buttons */}
      <Suspense fallback={null}>
        <Text
          position={[-0.68, 0.5, 0.028]}
          fontSize={0.033}
          color="#FDE68A"
          anchorX="left"
          anchorY="middle"
        >
          📋 WATCH-PARTY & $1 PROP CHALKBOARD
        </Text>
      </Suspense>

      {!buildMode && (
        <>
          <ChalkButton
            label="+ Game Winner $1"
            position={[-0.51, 0.41, 0.028]}
            width={0.32}
            onClick={() => {
              const t = QUICK_PROP_TEMPLATES[0]
              onCreateProp(t.title, [...t.options], t.stakeDollars)
              setPropCursor(0)
            }}
          />
          <ChalkButton
            label="+ Next Putt $1"
            position={[-0.16, 0.41, 0.028]}
            width={0.3}
            onClick={() => {
              const t = QUICK_PROP_TEMPLATES[1]
              onCreateProp(t.title, [...t.options], t.stakeDollars)
              setPropCursor(0)
            }}
          />
          <ChalkButton
            label="+ Over / Under $1"
            position={[0.18, 0.41, 0.028]}
            width={0.31}
            onClick={() => {
              const t = QUICK_PROP_TEMPLATES[2]
              onCreateProp(t.title, [...t.options], t.stakeDollars)
              setPropCursor(0)
            }}
          />
          {onOpen2DPropsDrawer && (
            <ChalkButton
              label="Custom Prop ✎"
              position={[0.53, 0.41, 0.028]}
              width={0.29}
              fill="#78350F"
              hoverFill="#92400E"
              textColor="#FEF3C7"
              onClick={onOpen2DPropsDrawer}
            />
          )}
        </>
      )}

      {/* Active Prop Section */}
      {activeProp ? (
        <group position={[0, 0.11, 0.028]}>
          <Suspense fallback={null}>
            <Text
              position={[-0.67, 0.19, 0]}
              fontSize={0.028}
              color="#F8FAFC"
              maxWidth={1.08}
              anchorX="left"
              anchorY="middle"
            >
              {`$${activeProp.stakeDollars} PROP: ${activeProp.title}`}
            </Text>
            <Text
              position={[0.67, 0.19, 0]}
              fontSize={0.023}
              color={
                activeProp.status === 'open'
                  ? '#34D399'
                  : activeProp.status === 'locked'
                    ? '#FBBF24'
                    : '#38BDF8'
              }
              anchorX="right"
              anchorY="middle"
            >
              {activeProp.status === 'open'
                ? '● OPEN FOR PICKS'
                : activeProp.status === 'locked'
                  ? '🔒 LOCKED'
                  : '✅ SETTLED'}
            </Text>
          </Suspense>

          {/* Clickable Option Rows */}
          {activeProp.options.slice(0, 3).map((opt, idx) => {
            const picksForOpt = activeProp.picks.filter((pk) => pk.optionIndex === idx)
            const iPicked = picksForOpt.some((pk) => pk.userKey === myUserKey)
            const isWinner =
              activeProp.status === 'resolved' && activeProp.winningOptionIndex === idx
            const y = 0.09 - idx * 0.088
            const names = picksForOpt.map((p) => p.displayName.slice(0, 8)).join(', ')

            return (
              <group key={`${activeProp.id}-opt-${idx}`} position={[0, y, 0]}>
                <ChalkButton
                  label={`${isWinner ? '🏆 ' : iPicked ? '✓ ' : ''}${opt} (${
                    picksForOpt.length
                  }${names ? `: ${names}` : ''})`}
                  position={[-0.14, 0, 0]}
                  width={1.04}
                  height={0.072}
                  fill={
                    isWinner
                      ? '#065F46'
                      : iPicked
                        ? '#1E3A8A'
                        : '#1B2E25'
                  }
                  hoverFill={activeProp.status === 'open' ? '#2A4739' : '#1B2E25'}
                  textColor="#F8FAFC"
                  onClick={() => {
                    if (!buildMode && activeProp.status === 'open') {
                      onPickOption(activeProp.id, idx)
                    }
                  }}
                />

                {/* Direct Winner Settlement Button per Option */}
                {activeProp.status !== 'resolved' && !buildMode && (
                  <ChalkButton
                    label="Mark Won"
                    position={[0.53, 0, 0]}
                    width={0.25}
                    height={0.068}
                    fill="#3F2E16"
                    hoverFill="#78350F"
                    textColor={accentColor}
                    onClick={() => onResolveProp(activeProp.id, idx)}
                  />
                )}
              </group>
            )
          })}

          {/* Prop Controls Strip: Lock + Prev/Next Prop */}
          <group position={[0, -0.17, 0]}>
            {activeProp.status === 'open' && !buildMode && (
              <ChalkButton
                label="🔒 Lock Picks"
                position={[-0.48, 0, 0]}
                width={0.34}
                height={0.062}
                fill="#3B2F15"
                hoverFill="#57431A"
                textColor="#FDE68A"
                onClick={() => onLockProp(activeProp.id)}
              />
            )}
            {propsList.length > 1 && (
              <>
                <ChalkButton
                  label={`◀ Prev (${safeIdx + 1}/${propsList.length})`}
                  position={[0.16, 0, 0]}
                  width={0.32}
                  height={0.062}
                  onClick={() =>
                    setPropCursor((c) => (c - 1 + propsList.length) % propsList.length)
                  }
                />
                <ChalkButton
                  label="Next ▶"
                  position={[0.51, 0, 0]}
                  width={0.26}
                  height={0.062}
                  onClick={() => setPropCursor((c) => (c + 1) % propsList.length)}
                />
              </>
            )}
          </group>
        </group>
      ) : (
        <Suspense fallback={null}>
          <Text
            position={[0, 0.14, 0.028]}
            fontSize={0.028}
            color="#94A3B8"
            anchorX="center"
            anchorY="middle"
          >
            Tap a + $1 Prop button above to start friendly watch-party predictions!
          </Text>
        </Suspense>
      )}

      {/* ================================================================= */}
      {/* PERSISTENT ALL-TIME CLUBHOUSE LEDGER (+/- $ & WIN RATE %)         */}
      {/* ================================================================= */}
      <group position={[0, -0.34, 0.026]}>
        <RoundedBox args={[1.38, 0.34, 0.006]} radius={0.014} position={[0, 0, -0.002]}>
          <meshBasicMaterial color="#0E1A15" />
        </RoundedBox>
        <Suspense fallback={null}>
          <Text
            position={[-0.65, 0.12, 0.004]}
            fontSize={0.025}
            color="#FDE68A"
            anchorX="left"
            anchorY="middle"
          >
            💰 ALL-TIME CLUBHOUSE LEDGER (NET +/- & WIN RATE)
          </Text>
          {ledgerEntries.length === 0 ? (
            <Text
              position={[0, -0.02, 0.004]}
              fontSize={0.023}
              color="#94A3B8"
              anchorX="center"
              anchorY="middle"
            >
              Lock in picks on a $1 prop & mark the winner to record balances on the All-Time Ledger!
            </Text>
          ) : (
            ledgerEntries.map((entry, idx) => {
              const total = entry.propsWon + entry.propsLost
              const winPct = total > 0 ? Math.round((entry.propsWon / total) * 100) : 0
              const sign = entry.netDollars >= 0 ? `+$${entry.netDollars}` : `-$${Math.abs(entry.netDollars)}`
              return (
                <Text
                  key={entry.key}
                  position={[-0.64, 0.055 - idx * 0.055, 0.004]}
                  fontSize={0.024}
                  color={entry.netDollars >= 0 ? '#6EE7B7' : '#FCA5A5'}
                  anchorX="left"
                  anchorY="middle"
                >
                  {`${idx + 1}. ${entry.displayName.slice(0, 14)}   ${sign}   ·   ${winPct}% Win (${entry.propsWon}W-${entry.propsLost}L)`}
                </Text>
              )
            })
          )}
        </Suspense>
      </group>
    </group>
  )
}
