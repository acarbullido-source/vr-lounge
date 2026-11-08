import { RoundedBox, Text } from '@react-three/drei'
import { Suspense, useMemo, useState } from 'react'
import {
  NES_LIBRARY_CARTRIDGES,
  getNesEmulator,
  parseNesCartridgeIdFromUrl,
  type NesCartridgeMeta,
} from '../../services/nesEmulator'
import { hasAnyNesSaveForCartridge } from '../../services/persistentVault'
import type {
  NesMultiplayerState,
  NesSaveSlotMeta,
  ParticipantProfile,
} from '../../types/lounge'

const GENRE_TABS: Array<{
  id: 'All' | NesCartridgeMeta['genre']
  label: string
}> = [
  { id: 'All', label: '🕹 All (36)' },
  { id: 'Platformer', label: '🍄 Platformer' },
  { id: 'Arcade', label: '👾 Arcade' },
  { id: 'Action', label: '⚔️ Action' },
  { id: 'Adventure', label: '🗺️ Adventure' },
  { id: 'Puzzle', label: '🧩 Puzzle' },
  { id: 'Sports', label: '🏆 Sports' },
]

function truncateText(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text
  return `${text.slice(0, maxLen - 1)}…`
}

interface NesPillButton3DProps {
  label: string
  sublabel?: string
  position: [number, number, number]
  width?: number
  height?: number
  fontSize?: number
  variant?: 'default' | 'amber' | 'crimson' | 'emerald' | 'active'
  disabled?: boolean
  onClick: () => void
}

function NesPillButton3D({
  label,
  sublabel,
  position,
  width = 0.22,
  height = 0.056,
  fontSize = 0.019,
  variant = 'default',
  disabled = false,
  onClick,
}: NesPillButton3DProps) {
  const [hovered, setHovered] = useState(false)

  const bg = disabled
    ? '#11151E'
    : variant === 'amber'
      ? hovered
        ? '#F2BE5C'
        : '#E5A93C'
      : variant === 'crimson'
        ? hovered
          ? '#EF4444'
          : '#DC2626'
        : variant === 'emerald'
          ? hovered
            ? '#10B981'
            : '#059669'
          : variant === 'active'
            ? hovered
              ? '#334155'
              : '#253146'
            : hovered
              ? '#263145'
              : '#161D2A'

  const fg = disabled
    ? '#4B5563'
    : variant === 'amber'
      ? '#090C10'
      : '#F8FAFC'

  return (
    <group
      position={position}
      pointerEventsType={{ deny: 'grab' }}
      onPointerOver={(e) => {
        if (disabled) return
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        if (disabled) return
        e.stopPropagation()
        onClick()
      }}
    >
      <RoundedBox args={[width, height, 0.014]} radius={0.016} smoothness={2}>
        <meshBasicMaterial color={bg} />
      </RoundedBox>
      <Suspense fallback={null}>
        <Text
          position={[0, sublabel ? 0.008 : 0, 0.009]}
          fontSize={fontSize}
          color={fg}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
        {sublabel && (
          <Text
            position={[0, -0.014, 0.009]}
            fontSize={0.0135}
            color={disabled ? '#475569' : variant === 'amber' ? '#1E293B' : '#CBD5E1'}
            anchorX="center"
            anchorY="middle"
          >
            {sublabel}
          </Text>
        )}
      </Suspense>
    </group>
  )
}

interface NesCartridgeCard3DProps {
  cart: NesCartridgeMeta
  position: [number, number, number]
  isPlayingNow: boolean
  hasSavedData: boolean
  onSelect: (cart: NesCartridgeMeta) => void
}

function NesCartridgeCard3D({
  cart,
  position,
  isPlayingNow,
  hasSavedData,
  onSelect,
}: NesCartridgeCard3DProps) {
  const [hovered, setHovered] = useState(false)

  const cardBg = isPlayingNow
    ? '#1E293B'
    : hovered
      ? '#1A2436'
      : '#111723'

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
        onSelect(cart)
      }}
    >
      {/* Outer Cartridge Card Frame */}
      <RoundedBox args={[0.5, 0.275, 0.016]} radius={0.02} smoothness={2}>
        <meshBasicMaterial color={cardBg} />
      </RoundedBox>

      {/* Top Cartridge Accent Label Banner */}
      <mesh position={[0, 0.112, 0.009]}>
        <planeGeometry args={[0.468, 0.036]} />
        <meshBasicMaterial color={cart.accentColor} />
      </mesh>

      {/* Active / Hover Border Highlight */}
      {(isPlayingNow || hovered) && (
        <mesh position={[0, -0.128, 0.01]}>
          <planeGeometry args={[0.46, 0.006]} />
          <meshBasicMaterial color={isPlayingNow ? '#4ADE80' : '#E5A93C'} />
        </mesh>
      )}

      <Suspense fallback={null}>
        {/* Genre & Year Header */}
        <Text
          position={[-0.22, 0.112, 0.012]}
          fontSize={0.015}
          color="#090D16"
          anchorX="left"
          anchorY="middle"
        >
          {`${cart.genre.toUpperCase()} · ${cart.year}`}
        </Text>

        <Text
          position={[0.22, 0.112, 0.012]}
          fontSize={0.014}
          color="#090D16"
          anchorX="right"
          anchorY="middle"
        >
          {hasSavedData ? '💾 SAVED' : '1P / 2P'}
        </Text>

        {/* Cartridge Title */}
        <Text
          position={[-0.22, 0.056, 0.011]}
          fontSize={0.022}
          maxWidth={0.44}
          color="#F8FAFC"
          anchorX="left"
          anchorY="middle"
        >
          {truncateText(cart.title, 24)}
        </Text>

        {/* Publisher */}
        <Text
          position={[-0.22, 0.022, 0.011]}
          fontSize={0.015}
          maxWidth={0.44}
          color="#94A3B8"
          anchorX="left"
          anchorY="middle"
        >
          {truncateText(cart.publisher, 30)}
        </Text>

        {/* Description */}
        <Text
          position={[-0.22, -0.028, 0.011]}
          fontSize={0.0145}
          maxWidth={0.44}
          lineHeight={1.25}
          color="#CBD5E1"
          anchorX="left"
          anchorY="middle"
        >
          {truncateText(cart.description, 68)}
        </Text>

        {/* Bottom Play Callout */}
        <Text
          position={[0, -0.098, 0.012]}
          fontSize={0.0165}
          color={isPlayingNow ? '#4ADE80' : hovered ? '#FACC15' : '#38BDF8'}
          anchorX="center"
          anchorY="middle"
        >
          {isPlayingNow
            ? '● PLAYING ON MAIN SCREEN'
            : '▶ CLICK TO START ON MAIN SCREEN'}
        </Text>
      </Suspense>
    </group>
  )
}

export interface NesLibraryBrowser3DProps {
  visible: boolean
  activeMediaUrl: string
  localUserId?: string
  participants?: ParticipantProfile[]
  nesMultiplayerState?: NesMultiplayerState
  engagedPlayerSlot: 1 | 2 | null
  onSelectCartridge: (cart: NesCartridgeMeta, keepOpen: boolean) => void
  onClaimNesPlayerSlot: (slot: 1 | 2 | null) => boolean | void
  onShareNesCheckpoint?: () => void
  onShareNesSaveSlot?: (slot: NesSaveSlotMeta) => void
  onClose: () => void
}

const ITEMS_PER_PAGE = 6

export function NesLibraryBrowser3D({
  visible,
  activeMediaUrl,
  localUserId,
  participants = [],
  nesMultiplayerState,
  engagedPlayerSlot,
  onSelectCartridge,
  onClaimNesPlayerSlot,
  onShareNesCheckpoint,
  onShareNesSaveSlot,
  onClose,
}: NesLibraryBrowser3DProps) {
  const [selectedGenre, setSelectedGenre] = useState<
    'All' | NesCartridgeMeta['genre']
  >('All')
  const [page, setPage] = useState(0)
  const [keepPinned, setKeepPinned] = useState(true)
  const [notice, setNotice] = useState<string | null>(null)

  const filteredCartridges = useMemo(() => {
    if (selectedGenre === 'All') return NES_LIBRARY_CARTRIDGES
    return NES_LIBRARY_CARTRIDGES.filter((c) => c.genre === selectedGenre)
  }, [selectedGenre])

  const totalPages = Math.max(
    1,
    Math.ceil(filteredCartridges.length / ITEMS_PER_PAGE),
  )
  const safePage = Math.min(page, totalPages - 1)
  const visibleSlice = filteredCartridges.slice(
    safePage * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE + ITEMS_PER_PAGE,
  )

  if (!visible) return null

  const activeCartId =
    parseNesCartridgeIdFromUrl(activeMediaUrl) ??
    getNesEmulator().getActiveCartridge().id

  const activeParticipantIds = new Set(participants.map((p) => p.userId))
  const p1HolderId =
    nesMultiplayerState?.player1Id &&
    (nesMultiplayerState.player1Id === localUserId ||
      activeParticipantIds.size === 0 ||
      activeParticipantIds.has(nesMultiplayerState.player1Id))
      ? nesMultiplayerState.player1Id
      : null
  const p2HolderId =
    nesMultiplayerState?.player2Id &&
    (nesMultiplayerState.player2Id === localUserId ||
      activeParticipantIds.size === 0 ||
      activeParticipantIds.has(nesMultiplayerState.player2Id))
      ? nesMultiplayerState.player2Id
      : null

  const isLocalP1 = engagedPlayerSlot === 1 || (Boolean(localUserId) && p1HolderId === localUserId)
  const isLocalP2 = engagedPlayerSlot === 2 || (Boolean(localUserId) && p2HolderId === localUserId)
  const isP1LockedByOther = Boolean(p1HolderId && p1HolderId !== localUserId)
  const isP2LockedByOther = Boolean(p2HolderId && p2HolderId !== localUserId)

  const showTempNotice = (msg: string) => {
    setNotice(msg)
    window.setTimeout(() => {
      setNotice((curr) => (curr === msg ? null : curr))
    }, 3200)
  }

  return (
    <group
      name="nes-library-browser-3d"
      position={[0, 1.62, -1.58]}
      rotation={[-0.04, 0, 0]}
    >
      {/* Main 3D NES Deck Chassis */}
      <RoundedBox args={[1.76, 1.1, 0.026]} radius={0.036} smoothness={3}>
        <meshStandardMaterial color="#0A0E17" roughness={0.58} metalness={0.3} />
      </RoundedBox>

      {/* Top Nintendo Crimson & Gold Accent Bars */}
      <mesh position={[-0.43, 0.54, 0.015]}>
        <boxGeometry args={[0.84, 0.007, 0.004]} />
        <meshBasicMaterial color="#DC2626" />
      </mesh>
      <mesh position={[0.43, 0.54, 0.015]}>
        <boxGeometry args={[0.84, 0.007, 0.004]} />
        <meshBasicMaterial color="#E5A93C" />
      </mesh>

      {/* Row 1: Header + Save/Load/Reset + Close */}
      <group position={[0, 0.475, 0.015]}>
        <RoundedBox
          args={[0.11, 0.048, 0.008]}
          radius={0.01}
          smoothness={2}
          position={[-0.78, 0, 0]}
        >
          <meshBasicMaterial color="#DC2626" />
        </RoundedBox>
        <Suspense fallback={null}>
          <Text
            position={[-0.78, 0, 0.008]}
            fontSize={0.02}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
          >
            NES 6502
          </Text>
          <Text
            position={[-0.7, 0, 0.006]}
            fontSize={0.023}
            color="#F8FAFC"
            anchorX="left"
            anchorY="middle"
          >
            VR ROM LIBRARY (36 GAMES)
          </Text>
        </Suspense>

        <NesPillButton3D
          label="💾 Save State"
          position={[-0.04, 0, 0]}
          width={0.21}
          height={0.052}
          fontSize={0.018}
          variant="emerald"
          onClick={() => {
            void getNesEmulator()
              .saveSlot('slot-1')
              .then((saved) => {
                if (saved) {
                  onShareNesSaveSlot?.(saved)
                  showTempNotice(`💾 Saved ${saved.cartridgeTitle} (Slot 1)`)
                }
              })
          }}
        />

        <NesPillButton3D
          label="📂 Load Save"
          position={[0.19, 0, 0]}
          width={0.21}
          height={0.052}
          fontSize={0.018}
          variant="active"
          onClick={() => {
            void getNesEmulator()
              .resumeMostRecentSave()
              .then((ok) => {
                if (ok) {
                  onShareNesCheckpoint?.()
                  showTempNotice('📂 Loaded latest saved state!')
                } else {
                  showTempNotice('No saved state found for this game yet.')
                }
              })
          }}
        />

        <NesPillButton3D
          label="↺ Reset ROM"
          position={[0.41, 0, 0]}
          width={0.19}
          height={0.052}
          fontSize={0.018}
          onClick={() => {
            getNesEmulator().resetCartridge()
            showTempNotice('↺ Reset active NES cartridge')
          }}
        />

        <NesPillButton3D
          label={keepPinned ? '📌 Pinned' : 'Auto-Close'}
          position={[0.6, 0, 0]}
          width={0.15}
          height={0.052}
          fontSize={0.0165}
          variant={keepPinned ? 'active' : 'default'}
          onClick={() => setKeepPinned((p) => !p)}
        />

        <NesPillButton3D
          label="✕ Close"
          position={[0.76, 0, 0]}
          width={0.14}
          height={0.052}
          fontSize={0.018}
          variant="crimson"
          onClick={onClose}
        />
      </group>

      {/* Row 2: Explicit Quest Controller Engage / Disengage & Exclusive Player 1 / Player 2 Lock Bar */}
      <group position={[0, 0.382, 0.015]}>
        <RoundedBox args={[1.68, 0.078, 0.01]} radius={0.016} smoothness={2}>
          <meshBasicMaterial color="#0F172A" />
        </RoundedBox>

        {/* Engage Player 1 Button */}
        <NesPillButton3D
          label={
            isLocalP1
              ? '🟢 P1 Engaged (You)'
              : isP1LockedByOther
                ? `🔒 P1: ${truncateText(nesMultiplayerState?.player1Name || 'In Use', 10)}`
                : '🎮 Engage Player 1'
          }
          sublabel={
            isLocalP1
              ? 'Quest Controllers = P1'
              : isP1LockedByOther
                ? 'Locked by Player 1'
                : 'Take P1 Controls'
          }
          position={[-0.55, 0, 0.006]}
          width={0.5}
          height={0.064}
          fontSize={0.019}
          variant={isLocalP1 ? 'emerald' : isP1LockedByOther ? 'default' : 'amber'}
          disabled={isP1LockedByOther}
          onClick={() => {
            if (isLocalP1) {
              onClaimNesPlayerSlot(null)
              showTempNotice('🔓 Disengaged Player 1 Controllers')
            } else {
              const ok = onClaimNesPlayerSlot(1)
              if (ok !== false) {
                showTempNotice(
                  '🎮 Engaged Player 1! Hold Right Grip for 1s anytime to disengage.',
                )
              }
            }
          }}
        />

        {/* Engage Player 2 Button */}
        <NesPillButton3D
          label={
            isLocalP2
              ? '🟢 P2 Engaged (You)'
              : isP2LockedByOther
                ? `🔒 P2: ${truncateText(nesMultiplayerState?.player2Name || 'In Use', 10)}`
                : '🎮 Engage Player 2'
          }
          sublabel={
            isLocalP2
              ? 'Quest Controllers = P2'
              : isP2LockedByOther
                ? 'Locked by Player 2'
                : 'Take P2 Co-Op Controls'
          }
          position={[0.0, 0, 0.006]}
          width={0.5}
          height={0.064}
          fontSize={0.019}
          variant={isLocalP2 ? 'emerald' : isP2LockedByOther ? 'default' : 'active'}
          disabled={isP2LockedByOther}
          onClick={() => {
            if (isLocalP2) {
              onClaimNesPlayerSlot(null)
              showTempNotice('🔓 Disengaged Player 2 Controllers')
            } else {
              const ok = onClaimNesPlayerSlot(2)
              if (ok !== false) {
                showTempNotice(
                  '🎮 Engaged Player 2! Hold Right Grip for 1s anytime to disengage.',
                )
              }
            }
          }}
        />

        {/* Disengage Button / Hold Right Grip Hint */}
        <NesPillButton3D
          label={
            engagedPlayerSlot !== null
              ? `🔓 Disengage P${engagedPlayerSlot}`
              : '🤚 Free Locomotion'
          }
          sublabel={
            engagedPlayerSlot !== null
              ? 'Or Hold Right Grip (1s)'
              : 'Controllers Move Avatar'
          }
          position={[0.55, 0, 0.006]}
          width={0.5}
          height={0.064}
          fontSize={0.0185}
          variant={engagedPlayerSlot !== null ? 'crimson' : 'default'}
          disabled={engagedPlayerSlot === null}
          onClick={() => {
            onClaimNesPlayerSlot(null)
            showTempNotice('🔓 Disengaged NES Controllers')
          }}
        />
      </group>

      {/* Row 3: Genre Filter Tabs */}
      <group position={[0, 0.288, 0.015]}>
        {GENRE_TABS.map((tab, idx) => {
          const x = -0.72 + idx * 0.24
          const isSelected = selectedGenre === tab.id
          return (
            <NesPillButton3D
              key={tab.id}
              label={tab.label}
              position={[x, 0, 0]}
              width={0.225}
              height={0.05}
              fontSize={0.0175}
              variant={isSelected ? 'amber' : 'default'}
              onClick={() => {
                setSelectedGenre(tab.id)
                setPage(0)
              }}
            />
          )
        })}
      </group>

      {/* Rows 4 & 5: 3x2 Paginated 3D NES Cartridges */}
      <group name="nes-vr-cartridge-grid">
        {visibleSlice.map((cart, idx) => {
          const col = idx % 3
          const row = Math.floor(idx / 3)
          const x = -0.54 + col * 0.54
          const y = row === 0 ? 0.085 : -0.22
          return (
            <NesCartridgeCard3D
              key={cart.id}
              cart={cart}
              position={[x, y, 0.014]}
              isPlayingNow={
                activeMediaUrl.trim().toLowerCase().startsWith('nes://') &&
                activeCartId === cart.id
              }
              hasSavedData={hasAnyNesSaveForCartridge(cart.id)}
              onSelect={(picked) => {
                getNesEmulator().loadLibraryCartridge(picked.id)
                onSelectCartridge(picked, keepPinned)
                // If user hasn't engaged a controller yet and P1 is free, auto-engage P1 so they can play right away!
                if (engagedPlayerSlot === null && !isP1LockedByOther) {
                  onClaimNesPlayerSlot(1)
                }
                showTempNotice(`🕹 Launched ${picked.title} on Main Screen!`)
              }}
            />
          )
        })}
      </group>

      {/* Row 6: Pagination & Controller Mapping Legend Footer */}
      <group position={[0, -0.46, 0.015]}>
        <NesPillButton3D
          label="◀ Prev Page"
          position={[-0.69, 0, 0]}
          width={0.24}
          height={0.056}
          disabled={safePage <= 0}
          onClick={() => setPage((p) => Math.max(0, p - 1))}
        />

        <Suspense fallback={null}>
          <Text
            position={[0, 0.009, 0.008]}
            fontSize={0.0175}
            maxWidth={1.06}
            color={notice ? '#4ADE80' : '#F8FAFC'}
            anchorX="center"
            anchorY="middle"
          >
            {notice
              ? truncateText(notice, 68)
              : `Page ${safePage + 1} of ${totalPages} · ${filteredCartridges.length} NES ROMs · Select any game to play on Main Screen`}
          </Text>
          <Text
            position={[0, -0.015, 0.008]}
            fontSize={0.014}
            maxWidth={1.08}
            color="#94A3B8"
            anchorX="center"
            anchorY="middle"
          >
            Quest Pad: Left Stick=D-Pad · A/R-Trig=Jump(A) · B/X/L-Trig=Fire(B) · Y=START · L-Grip=SELECT · Hold R-Grip=Disengage
          </Text>
        </Suspense>

        <NesPillButton3D
          label="Next Page ▶"
          position={[0.69, 0, 0]}
          width={0.24}
          height={0.056}
          disabled={safePage >= totalPages - 1}
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
        />
      </group>
    </group>
  )
}
