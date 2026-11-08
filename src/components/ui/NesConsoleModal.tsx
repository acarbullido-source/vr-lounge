import { useEffect, useMemo, useRef, useState } from 'react'
import {
  NES_LIBRARY_CARTRIDGES,
  arrayBufferToBinaryString,
  getNesEmulator,
  parseNesCartridgeIdFromUrl,
  type NesButtonId,
  type NesCartridgeMeta,
} from '../../services/nesEmulator'
import {
  exportFullLoungeVaultBundle,
  hasAnyNesSaveForCartridge,
  importFullLoungeVaultBundle,
  subscribeVaultStatus,
} from '../../services/persistentVault'
import type {
  NesMultiplayerState,
  NesSaveSlotId,
  NesSaveSlotMeta,
} from '../../types/lounge'

export interface NesConsoleModalProps {
  open: boolean
  activeMediaUrl: string
  localUserId?: string
  nesMultiplayerState?: NesMultiplayerState
  onClose: () => void
  onLaunchNesToMainScreen: (nesUrl: string, title: string) => void
  onClaimNesPlayerSlot?: (slot: 1 | 2 | null) => void
  onShareNesCheckpoint?: () => void
  onShareNesSaveSlot?: (slot: NesSaveSlotMeta) => void
}

const GENRE_FILTERS = [
  'All',
  'Platformer',
  'Arcade',
  'Action',
  'Adventure',
  'Puzzle',
  'Sports',
] as const

export function NesConsoleModal({
  open,
  activeMediaUrl,
  localUserId,
  nesMultiplayerState,
  onClose,
  onLaunchNesToMainScreen,
  onClaimNesPlayerSlot,
  onShareNesCheckpoint,
  onShareNesSaveSlot,
}: NesConsoleModalProps) {
  const nes = useMemo(() => getNesEmulator(), [])
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [genreFilter, setGenreFilter] =
    useState<(typeof GENRE_FILTERS)[number]>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCartridge, setSelectedCartridge] = useState<NesCartridgeMeta>(
    () => nes.getActiveCartridge(),
  )
  const [soundOn, setSoundOn] = useState(() => nes.isSoundEnabled())
  const [customRomTitle, setCustomRomTitle] = useState<string | null>(() =>
    nes.getCustomRomName(),
  )
  const [localPlayerNum, setLocalPlayerNum] = useState<1 | 2>(() =>
    nes.getLocalInputPlayer(),
  )
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null)
  const [, setVaultTick] = useState(0)

  useEffect(() => {
    const unsubNes = nes.onSaveSlotsChanged(() => {
      setSelectedCartridge(nes.getActiveCartridge())
      setCustomRomTitle(nes.getCustomRomName())
      setLocalPlayerNum(nes.getLocalInputPlayer())
      setVaultTick((t) => t + 1)
    })
    const unsubVault = subscribeVaultStatus(() => {
      setVaultTick((t) => t + 1)
    })
    return () => {
      unsubNes()
      unsubVault()
    }
  }, [nes])

  useEffect(() => {
    const cartId = parseNesCartridgeIdFromUrl(activeMediaUrl)
    if (cartId) {
      const found = NES_LIBRARY_CARTRIDGES.find((c) => c.id === cartId)
      if (found) setSelectedCartridge(found)
    }
  }, [activeMediaUrl])

  const filteredCartridges = useMemo(() => {
    return NES_LIBRARY_CARTRIDGES.filter((c) => {
      if (genreFilter !== 'All' && c.genre !== genreFilter) return false
      if (
        searchQuery.trim() &&
        !c.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
        !c.publisher.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
        !c.description.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false
      }
      return true
    })
  }, [genreFilter, searchQuery])

  const isNesCurrentlyOnScreen = activeMediaUrl
    .trim()
    .toLowerCase()
    .startsWith('nes://')

  // Mirror the real JSNES PPU canvas into the modal's preview monitor ONLY while open
  useEffect(() => {
    if (!open) return
    nes.setConsumerActive('modal', true)
    let raf = 0
    const copyFrame = () => {
      const dst = previewCanvasRef.current
      if (dst) {
        const ctx = dst.getContext('2d')
        if (ctx) {
          ctx.imageSmoothingEnabled = false
          ctx.drawImage(nes.canvas, 0, 0, dst.width, dst.height)
        }
      }
      raf = window.requestAnimationFrame(copyFrame)
    }
    raf = window.requestAnimationFrame(copyFrame)
    return () => {
      window.cancelAnimationFrame(raf)
      nes.setConsumerActive('modal', false)
    }
  }, [nes, open])

  // Keyboard controls when Modal is open and NES is not already handled by main screen
  useEffect(() => {
    if (!open || isNesCurrentlyOnScreen) return

    const mapKeyToNes = (code: string): NesButtonId | null => {
      if (code === 'ArrowUp' || code === 'KeyI') return 'up'
      if (code === 'ArrowDown' || code === 'KeyK') return 'down'
      if (code === 'ArrowLeft' || code === 'KeyJ') return 'left'
      if (code === 'ArrowRight' || code === 'KeyL') return 'right'
      if (code === 'KeyX' || code === 'Space') return 'a'
      if (code === 'KeyZ' || code === 'ShiftLeft') return 'b'
      if (code === 'Enter') return 'start'
      if (code === 'ShiftRight' || code === 'Backspace') return 'select'
      return null
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (
        document.activeElement &&
        (document.activeElement.tagName === 'INPUT' ||
          document.activeElement.tagName === 'TEXTAREA')
      ) {
        return
      }
      const btn = mapKeyToNes(e.code)
      if (btn) {
        e.preventDefault()
        nes.setButtonState(btn, true, localPlayerNum)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const btn = mapKeyToNes(e.code)
      if (btn) {
        nes.setButtonState(btn, false, localPlayerNum)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [isNesCurrentlyOnScreen, localPlayerNum, nes, open])

  if (!open) return null

  const activeCartId = customRomTitle ? 'custom-rom' : selectedCartridge.id
  const saveSlots = nes.getSaveSlotsForCartridge(activeCartId)

  const showNotice = (msg: string) => {
    setSaveFeedback(msg)
    window.setTimeout(() => {
      setSaveFeedback((prev) => (prev === msg ? null : prev))
    }, 3200)
  }

  const handleSelectAndPlay = (cart: NesCartridgeMeta) => {
    setSelectedCartridge(cart)
    setCustomRomTitle(null)
    nes.loadLibraryCartridge(cart.id)
    onLaunchNesToMainScreen(`nes://${cart.id}`, `🕹 NES: ${cart.title}`)
  }

  const handleRomUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (result instanceof ArrayBuffer) {
        const binStr = arrayBufferToBinaryString(result)
        const ok = nes.loadBinaryNesRom(binStr, file.name)
        if (ok) {
          setCustomRomTitle(file.name)
          onLaunchNesToMainScreen(`nes://custom-rom`, `🕹 NES ROM: ${file.name}`)
          showNotice(`Loaded custom ROM: ${file.name}`)
        }
      }
    }
    reader.readAsArrayBuffer(file)
  }

  const handleSaveSlot = async (slot: NesSaveSlotId) => {
    const meta = await nes.saveSlot(slot)
    if (meta) {
      onShareNesSaveSlot?.(meta)
      setVaultTick((t) => t + 1)
      showNotice(`💾 Saved ${meta.cartridgeTitle} to ${slot.toUpperCase()} (Synced to Vault)`)
    } else {
      showNotice('⚠️ Wait for ROM to finish booting before saving.')
    }
  }

  const handleLoadSlot = async (slot: NesSaveSlotId) => {
    const ok = await nes.loadSlot(slot)
    if (ok) {
      onShareNesCheckpoint?.()
      showNotice(`📂 Restored ${slot.toUpperCase()} state!`)
    } else {
      showNotice(`No save found in ${slot.toUpperCase()} yet.`)
    }
  }

  const handleExportVault = () => {
    const json = exportFullLoungeVaultBundle()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vr-lounge-vault-${new Date().toISOString().slice(0, 10)}.vrlounge.json`
    a.click()
    URL.revokeObjectURL(url)
    showNotice('📦 Exported Full Persistent Vault (.vrlounge.json)')
  }

  const handleImportVault = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        void importFullLoungeVaultBundle(reader.result).then((res) => {
          if (res.ok) {
            showNotice(`✅ Imported Vault (${res.restoredSaves} NES saves restored)`)
            setVaultTick((t) => t + 1)
          } else {
            showNotice('⚠️ Vault import failed: Invalid backup file')
          }
        })
      }
    }
    reader.readAsText(file)
  }

  const bindPadHold = (btn: NesButtonId) => ({
    onPointerDown: () => nes.setButtonState(btn, true, localPlayerNum),
    onPointerUp: () => nes.setButtonState(btn, false, localPlayerNum),
    onPointerLeave: () => nes.setButtonState(btn, false, localPlayerNum),
    onClick: () => nes.tapButton(btn, localPlayerNum),
  })

  return (
    <div
      id="modal-nes-console"
      className="nes-console-modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 95,
        background: 'rgba(4, 7, 17, 0.84)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        className="nes-console-modal"
        style={{
          width: 'min(1140px, 96vw)',
          maxHeight: '92vh',
          background: 'linear-gradient(165deg, #0F172A 0%, #090D1A 100%)',
          border: '1px solid rgba(239, 68, 68, 0.45)',
          borderRadius: '18px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.75)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          color: '#F8FAFC',
        }}
      >
        {/* Header Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 20px',
            background: 'rgba(15, 23, 42, 0.95)',
            borderBottom: '1px solid rgba(148, 163, 184, 0.18)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{
                background: '#DC2626',
                color: '#FFFFFF',
                fontWeight: 800,
                fontSize: '0.78rem',
                padding: '4px 10px',
                borderRadius: '6px',
                letterSpacing: '0.06em',
              }}
            >
              JSNES 6502 HARDWARE EMULATOR
            </span>
            <strong style={{ fontSize: '1.02rem' }}>
              🕹 Authentic NES Console · 36 Verified .NES ROMs (Main Screen + All Mirrors + Quest Controllers)
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              id="btn-nes-export-vault"
              type="button"
              className="secondary-btn"
              style={{ fontSize: '0.76rem', padding: '5px 10px' }}
              onClick={handleExportVault}
              title="Export all NES Save States, Battery SRAM, Room Blueprints, and Profiles to a .vrlounge.json file"
            >
              📦 Export Vault
            </button>
            <label
              className="secondary-btn"
              style={{
                fontSize: '0.76rem',
                padding: '5px 10px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
              }}
              title="Import a .vrlounge.json Vault backup"
            >
              📥 Import Vault
              <input
                type="file"
                accept=".json,.vrlounge.json"
                style={{ display: 'none' }}
                onChange={handleImportVault}
              />
            </label>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => nes.resetCartridge()}
            >
              ↺ Reset ROM
            </button>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                const next = nes.toggleSound()
                setSoundOn(next)
              }}
            >
              {soundOn ? '🔊 APU Audio ON' : '🔇 APU Muted'}
            </button>
            <button
              id="btn-close-nes-modal"
              type="button"
              className="secondary-btn"
              onClick={onClose}
            >
              ✕ Close (Keep Playing on Screen)
            </button>
          </div>
        </div>

        {saveFeedback && (
          <div
            style={{
              background: 'rgba(16, 185, 129, 0.18)',
              borderBottom: '1px solid rgba(16, 185, 129, 0.45)',
              color: '#A7F3D0',
              fontSize: '0.82rem',
              fontWeight: 600,
              padding: '7px 20px',
              textAlign: 'center',
            }}
          >
            {saveFeedback}
          </div>
        )}

        {/* Main Two-Column Body */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(350px, 440px) 1fr',
            gap: '18px',
            padding: '18px',
            overflowY: 'auto',
          }}
        >
          {/* Left Column: Live NES CRT Monitor, Save States, 1P/2P Co-Op, Controller Pad & Quest Guide */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div
              style={{
                background: '#020617',
                border: '3px solid #334155',
                borderRadius: '12px',
                padding: '8px',
                textAlign: 'center',
              }}
            >
              <canvas
                ref={previewCanvasRef}
                width={512}
                height={480}
                style={{
                  width: '100%',
                  height: 'auto',
                  borderRadius: '6px',
                  background: '#000',
                  imageRendering: 'pixelated',
                }}
              />
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginTop: '6px',
                  fontSize: '0.8rem',
                  color: '#94A3B8',
                }}
              >
                <span>
                  ROM:{' '}
                  <strong style={{ color: '#FACC15' }}>
                    {customRomTitle || selectedCartridge.title}
                  </strong>
                </span>
                <span style={{ color: isNesCurrentlyOnScreen ? '#4ADE80' : '#38BDF8' }}>
                  {isNesCurrentlyOnScreen
                    ? '● LIVE ON ALL LOUNGE SCREENS'
                    : 'Ready to Cast'}
                </span>
              </div>
            </div>

            {/* Cast to Main Theater Screen Button */}
            <button
              id="btn-nes-cast-to-screen"
              type="button"
              className="primary-btn"
              data-testid="nes-cast-to-main-screen-btn"
              style={{
                background: isNesCurrentlyOnScreen
                  ? 'linear-gradient(90deg, #059669 0%, #10B981 100%)'
                  : 'linear-gradient(90deg, #DC2626 0%, #EA580C 100%)',
                padding: '10px 14px',
                fontWeight: 700,
              }}
              onClick={() =>
                onLaunchNesToMainScreen(
                  `nes://${customRomTitle ? 'custom-rom' : selectedCartridge.id}`,
                  `🕹 NES: ${customRomTitle || selectedCartridge.title}`,
                )
              }
            >
              {isNesCurrentlyOnScreen
                ? '📺 Live on Main Screen & All Mirrored Lounge Screens (Click to Re-Sync)'
                : '📺 Cast NES Live to Main Screen & All Mirrored Lounge Screens'}
            </button>

            {/* Persistent Save States (Slots 1-3 + Auto) & 8KB Battery SRAM Panel */}
            <div
              data-testid="nes-save-states-panel"
              style={{
                background: 'rgba(15, 23, 42, 0.92)',
                border: '1px solid rgba(250, 204, 21, 0.35)',
                borderRadius: '10px',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.76rem',
                }}
              >
                <strong style={{ color: '#FACC15' }}>
                  💾 Persistent Save States &amp; 8KB Battery SRAM
                </strong>
                <button
                  id="btn-nes-resume-latest"
                  type="button"
                  className="secondary-btn"
                  style={{ fontSize: '0.72rem', padding: '3px 8px' }}
                  onClick={() => {
                    void nes.resumeMostRecentSave().then((restored) => {
                      if (restored) {
                        onShareNesCheckpoint?.()
                        showNotice('⚡ Resumed latest saved state!')
                      } else {
                        showNotice('No saved state found for this cartridge yet.')
                      }
                    })
                  }}
                >
                  ⚡ Resume Latest Save
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '6px',
                }}
              >
                {(['slot-1', 'slot-2', 'slot-3'] as const).map((slotId, idx) => {
                  const existing = saveSlots.find((s) => s.slotId === slotId)
                  return (
                    <div
                      key={slotId}
                      style={{
                        background: '#090D1A',
                        border: `1px solid ${existing ? 'rgba(74, 222, 128, 0.45)' : '#334155'}`,
                        borderRadius: '8px',
                        padding: '6px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '4px',
                        fontSize: '0.72rem',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          color: existing ? '#4ADE80' : '#94A3B8',
                          fontWeight: 700,
                        }}
                      >
                        <span>Slot {idx + 1}</span>
                        <span>
                          {existing
                            ? new Date(existing.savedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : 'Empty'}
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          id={`btn-nes-save-${slotId}`}
                          type="button"
                          className="secondary-btn"
                          style={{ flex: 1, fontSize: '0.68rem', padding: '3px 4px' }}
                          onClick={() => void handleSaveSlot(slotId)}
                        >
                          💾 Save
                        </button>
                        <button
                          id={`btn-nes-load-${slotId}`}
                          type="button"
                          className="secondary-btn"
                          disabled={!existing}
                          style={{
                            flex: 1,
                            fontSize: '0.68rem',
                            padding: '3px 4px',
                            opacity: existing ? 1 : 0.45,
                          }}
                          onClick={() => void handleLoadSlot(slotId)}
                        >
                          📂 Load
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 1P / 2P Multiplayer Co-Op Controller Selector */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.92)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '10px',
                padding: '8px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                flexWrap: 'wrap',
                fontSize: '0.75rem',
              }}
            >
              <span style={{ color: '#7DD3FC', fontWeight: 700 }}>
                🎮 Active Controller Port:
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  id="btn-nes-claim-p1"
                  type="button"
                  className={localPlayerNum === 1 ? 'primary-btn' : 'secondary-btn'}
                  style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                  onClick={() => {
                    nes.setLocalInputPlayer(1)
                    setLocalPlayerNum(1)
                    onClaimNesPlayerSlot?.(1)
                  }}
                >
                  🕹 Player 1
                  {nesMultiplayerState?.player1Name
                    ? ` (${nesMultiplayerState.player1Id === localUserId ? 'You' : nesMultiplayerState.player1Name.slice(0, 8)})`
                    : ''}
                </button>
                <button
                  id="btn-nes-claim-p2"
                  type="button"
                  className={localPlayerNum === 2 ? 'primary-btn' : 'secondary-btn'}
                  style={{ fontSize: '0.72rem', padding: '4px 10px' }}
                  onClick={() => {
                    nes.setLocalInputPlayer(2)
                    setLocalPlayerNum(2)
                    onClaimNesPlayerSlot?.(2)
                  }}
                >
                  🕹 Player 2 (Co-Op)
                  {nesMultiplayerState?.player2Name
                    ? ` (${nesMultiplayerState.player2Id === localUserId ? 'You' : nesMultiplayerState.player2Name.slice(0, 8)})`
                    : ''}
                </button>
                {onShareNesCheckpoint && (
                  <button
                    id="btn-nes-sync-room"
                    type="button"
                    className="secondary-btn"
                    style={{ fontSize: '0.72rem', padding: '4px 8px' }}
                    onClick={() => {
                      onShareNesCheckpoint()
                      showNotice('📡 Synced live NES state to all players in the room!')
                    }}
                    title="Broadcast exact NES CPU/PPU state to all room members"
                  >
                    📡 Sync Room
                  </button>
                )}
              </div>
            </div>

            {/* Interactive NES Controller Deck */}
            <div
              style={{
                background: '#1E293B',
                border: '2px solid #475569',
                borderRadius: '12px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                userSelect: 'none',
              }}
            >
              {/* D-Pad */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 36px)',
                  gridTemplateRows: 'repeat(3, 32px)',
                  gap: '3px',
                }}
              >
                <div />
                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="nes-btn-up"
                  {...bindPadHold('up')}
                >
                  ▲
                </button>
                <div />
                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="nes-btn-left"
                  {...bindPadHold('left')}
                >
                  ◀
                </button>
                <div
                  style={{
                    background: '#0F172A',
                    borderRadius: '4px',
                  }}
                />
                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="nes-btn-right"
                  {...bindPadHold('right')}
                >
                  ▶
                </button>
                <div />
                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="nes-btn-down"
                  {...bindPadHold('down')}
                >
                  ▼
                </button>
                <div />
              </div>

              {/* SELECT & START */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="nes-btn-select"
                  style={{ fontSize: '0.72rem', padding: '6px 10px' }}
                  {...bindPadHold('select')}
                >
                  SELECT
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="nes-btn-start"
                  style={{
                    fontSize: '0.72rem',
                    padding: '6px 10px',
                    border: '1px solid #FACC15',
                    color: '#FACC15',
                  }}
                  {...bindPadHold('start')}
                >
                  START
                </button>
              </div>

              {/* B & A Red Buttons */}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  data-testid="nes-btn-b"
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: '#DC2626',
                    color: '#FFF',
                    fontWeight: 800,
                    border: '2px solid #FCA5A5',
                    cursor: 'pointer',
                  }}
                  {...bindPadHold('b')}
                >
                  B
                </button>
                <button
                  type="button"
                  data-testid="nes-btn-a"
                  style={{
                    width: '46px',
                    height: '46px',
                    borderRadius: '50%',
                    background: '#DC2626',
                    color: '#FFF',
                    fontWeight: 800,
                    border: '2px solid #FCA5A5',
                    cursor: 'pointer',
                  }}
                  {...bindPadHold('a')}
                >
                  A
                </button>
              </div>
            </div>

            {/* Meta Quest VR Controller & Keyboard Mapping Box */}
            <div
              style={{
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid rgba(56, 189, 248, 0.35)',
                borderRadius: '10px',
                padding: '10px 12px',
                fontSize: '0.76rem',
                color: '#CBD5E1',
                lineHeight: 1.45,
              }}
            >
              <div style={{ color: '#38BDF8', fontWeight: 700, marginBottom: '4px' }}>
                🥽 Meta Quest VR Controller &amp; Keyboard Mapping:
              </div>
              <div>
                • <strong>Quest Left Stick:</strong> NES D-Pad (Up / Down / Left / Right)
              </div>
              <div>
                • <strong>Quest A / Right Trigger:</strong> NES <strong>A</strong> (Jump / Confirm) ·{' '}
                <strong>B / X / Left Trigger:</strong> NES <strong>B</strong> (Fire / Run)
              </div>
              <div>
                • <strong>Quest Y / Right Grip:</strong> NES <strong>START</strong> ·{' '}
                <strong>Left Grip:</strong> NES <strong>SELECT</strong>
              </div>
              <div>
                • <strong>Keyboard:</strong> Arrow Keys / IJKL = D-Pad · Space/X = A · Z = B · Enter = START · R-Shift = SELECT
              </div>
            </div>
          </div>

          {/* Right Column: 36-Cartridge Verified .NES ROM Library & Custom .NES File Loader */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {GENRE_FILTERS.map((g) => (
                  <button
                    key={g}
                    type="button"
                    className={genreFilter === g ? 'primary-btn' : 'secondary-btn'}
                    style={{ padding: '4px 10px', fontSize: '0.78rem' }}
                    onClick={() => setGenreFilter(g)}
                  >
                    {g}
                  </button>
                ))}
              </div>

              <label
                style={{
                  background: '#1E293B',
                  border: '1px dashed #38BDF8',
                  borderRadius: '8px',
                  padding: '6px 12px',
                  fontSize: '0.78rem',
                  color: '#38BDF8',
                  cursor: 'pointer',
                }}
              >
                📂 Load Custom .NES ROM File
                <input
                  type="file"
                  accept=".nes"
                  style={{ display: 'none' }}
                  onChange={handleRomUpload}
                />
              </label>
            </div>

            <input
              type="text"
              placeholder="Search 36 authentic .NES ROMs (Super Mario Bros. 1/2/3, Zelda, Contra, Pac-Man, Metroid, Mega Man, Punch-Out!!, Tetris)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: '8px',
                background: '#020617',
                border: '1px solid #334155',
                color: '#F8FAFC',
              }}
            />

            {/* 36-Cartridge Grid */}
            <div
              data-testid="nes-cartridge-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))',
                gap: '10px',
                maxHeight: '530px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {filteredCartridges.map((cart) => {
                const isSelected =
                  selectedCartridge.id === cart.id && !customRomTitle
                const hasSave = hasAnyNesSaveForCartridge(cart.id)
                return (
                  <button
                    key={cart.id}
                    id={`btn-nes-cart-${cart.id}`}
                    type="button"
                    data-testid={`nes-cart-${cart.id}`}
                    onClick={() => handleSelectAndPlay(cart)}
                    style={{
                      textAlign: 'left',
                      background: isSelected
                        ? 'rgba(220, 38, 38, 0.22)'
                        : 'rgba(30, 41, 59, 0.72)',
                      border: `1px solid ${isSelected ? '#EF4444' : 'rgba(148, 163, 184, 0.22)'}`,
                      borderRadius: '10px',
                      padding: '10px',
                      color: '#F8FAFC',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '0.66rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: cart.accentColor,
                          color: '#040810',
                        }}
                      >
                        {cart.genre.toUpperCase()} · {cart.year}
                      </span>
                      {isSelected ? (
                        <span style={{ fontSize: '0.7rem', color: '#4ADE80' }}>
                          ● ACTIVE ROM
                        </span>
                      ) : hasSave ? (
                        <span style={{ fontSize: '0.68rem', color: '#FACC15' }}>
                          💾 SAVED
                        </span>
                      ) : null}
                    </div>
                    <strong style={{ fontSize: '0.88rem' }}>{cart.title}</strong>
                    <span
                      style={{
                        fontSize: '0.68rem',
                        color: '#38BDF8',
                        fontWeight: 600,
                      }}
                    >
                      {cart.publisher} · /{cart.romFile}
                    </span>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        color: '#94A3B8',
                        lineHeight: 1.28,
                      }}
                    >
                      {cart.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
