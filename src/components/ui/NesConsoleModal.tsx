import { useEffect, useMemo, useRef, useState } from 'react'
import {
  NES_LIBRARY_CARTRIDGES,
  getNesEmulator,
  type NesButtonId,
  type NesCartridgeMeta,
} from '../../services/nesEmulator'

export interface NesConsoleModalProps {
  open: boolean
  activeMediaUrl: string
  onClose: () => void
  onLaunchNesToMainScreen: (nesUrl: string, title: string) => void
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
  onClose,
  onLaunchNesToMainScreen,
}: NesConsoleModalProps) {
  const nes = useMemo(() => getNesEmulator(), [])
  const previewCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [genreFilter, setGenreFilter] = useState<(typeof GENRE_FILTERS)[number]>('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCartridge, setSelectedCartridge] = useState<NesCartridgeMeta>(
    NES_LIBRARY_CARTRIDGES[0],
  )
  const [soundOn, setSoundOn] = useState(true)
  const [customRomTitle, setCustomRomTitle] = useState<string | null>(null)
  const [liveScore, setLiveScore] = useState(0)

  const filteredCartridges = useMemo(() => {
    return NES_LIBRARY_CARTRIDGES.filter((c) => {
      if (genreFilter !== 'All' && c.genre !== genreFilter) return false
      if (
        searchQuery.trim() &&
        !c.title.toLowerCase().includes(searchQuery.trim().toLowerCase()) &&
        !c.description.toLowerCase().includes(searchQuery.trim().toLowerCase())
      ) {
        return false
      }
      return true
    })
  }, [genreFilter, searchQuery])

  // Mirror the NES emulator canvas into the modal's local preview canvas while open
  useEffect(() => {
    if (!open) return
    nes.ensureLoopRunning()
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
      setLiveScore(nes.getStateSummary().score)
      raf = window.requestAnimationFrame(copyFrame)
    }
    raf = window.requestAnimationFrame(copyFrame)
    return () => window.cancelAnimationFrame(raf)
  }, [nes, open])

  // Global keyboard controls whenever NES is playing on Main Screen or Modal is open
  const isNesCurrentlyOnScreen = activeMediaUrl.trim().toLowerCase().startsWith('nes://')
  useEffect(() => {
    if (!open && !isNesCurrentlyOnScreen) return

    const mapKeyToNes = (code: string): NesButtonId | null => {
      if (code === 'ArrowUp' || code === 'KeyI') return 'up'
      if (code === 'ArrowDown' || code === 'KeyK') return 'down'
      if (code === 'ArrowLeft' || code === 'KeyJ') return 'left'
      if (code === 'ArrowRight' || code === 'KeyL') return 'right'
      if (code === 'KeyX' || code === 'Space') return 'a'
      if (code === 'KeyZ' || code === 'ShiftLeft' || code === 'ShiftRight') return 'b'
      if (code === 'Enter') return 'start'
      if (code === 'Backspace') return 'select'
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
        nes.setButtonState(btn, true)
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      const btn = mapKeyToNes(e.code)
      if (btn) {
        nes.setButtonState(btn, false)
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [isNesCurrentlyOnScreen, nes, open])

  if (!open) return null

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
      if (typeof result === 'string') {
        const ok = nes.loadBinaryNesRom(result, file.name)
        if (ok) {
          setCustomRomTitle(file.name)
          onLaunchNesToMainScreen(`nes://custom-rom`, `🕹 NES ROM: ${file.name}`)
        }
      }
    }
    reader.readAsBinaryString(file)
  }

  return (
    <div
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
          width: 'min(1080px, 96vw)',
          maxHeight: '90vh',
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
              NINTENDO 8-BIT ENTERTAINMENT SYSTEM
            </span>
            <strong style={{ fontSize: '1.05rem' }}>
              🕹 NES Emulator & 24-Cartridge Library (Mirrored to Main & Secondary Screens)
            </strong>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => {
                const next = !soundOn
                setSoundOn(next)
                nes.setSoundEnabled(next)
              }}
            >
              {soundOn ? '🔊 8-Bit Audio ON' : '🔇 8-Bit Audio Muted'}
            </button>
            <button type="button" className="secondary-btn" onClick={onClose}>
              ✕ Close Deck
            </button>
          </div>
        </div>

        {/* Main Two-Column Body: Left = Live NES Monitor & Controller, Right = 24-Game Library + .NES Upload */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(340px, 430px) 1fr',
            gap: '18px',
            padding: '18px',
            overflowY: 'auto',
          }}
        >
          {/* Left Column: Live NES CRT Monitor & Interactive NES Controller Pad */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
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
                width={384}
                height={360}
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
                  Playing:{' '}
                  <strong style={{ color: '#FACC15' }}>
                    {customRomTitle || selectedCartridge.title}
                  </strong>
                </span>
                <span>
                  SCORE: <strong style={{ color: '#38BDF8' }}>{liveScore}</strong>
                </span>
              </div>
            </div>

            {/* Cast to Main Theater Screen Button */}
            <button
              type="button"
              className="primary-btn"
              data-testid="nes-cast-to-main-screen-btn"
              style={{
                background: 'linear-gradient(90deg, #DC2626 0%, #EA580C 100%)',
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
              📺 Cast NES Live to Main Screen & All Mirrored Lounge Screens
            </button>

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
                  onClick={() => nes.tapButton('up')}
                >
                  ▲
                </button>
                <div />
                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="nes-btn-left"
                  onClick={() => nes.tapButton('left')}
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
                  onClick={() => nes.tapButton('right')}
                >
                  ▶
                </button>
                <div />
                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="nes-btn-down"
                  onClick={() => nes.tapButton('down')}
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
                  onClick={() => nes.tapButton('select')}
                >
                  SELECT
                </button>
                <button
                  type="button"
                  className="secondary-btn"
                  data-testid="nes-btn-start"
                  style={{ fontSize: '0.72rem', padding: '6px 10px' }}
                  onClick={() => nes.tapButton('start')}
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
                  onClick={() => nes.tapButton('b')}
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
                  onClick={() => nes.tapButton('a')}
                >
                  A
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: 24-Cartridge Library & Custom .NES File Loader */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {/* Filter & ROM Upload Row */}
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
              placeholder="Search 24 NES cartridges (e.g. Super Plumber, Zelda, Pac-Maze, Contra, Tetra-Blocks)..."
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

            {/* 24-Cartridge Grid */}
            <div
              data-testid="nes-cartridge-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(195px, 1fr))',
                gap: '10px',
                maxHeight: '410px',
                overflowY: 'auto',
                paddingRight: '4px',
              }}
            >
              {filteredCartridges.map((cart) => {
                const isSelected = selectedCartridge.id === cart.id && !customRomTitle
                return (
                  <button
                    key={cart.id}
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
                          fontSize: '0.68rem',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '4px',
                          background: cart.accentColor,
                          color: '#040810',
                        }}
                      >
                        {cart.genre.toUpperCase()} · {cart.year}
                      </span>
                      {isSelected && (
                        <span style={{ fontSize: '0.72rem', color: '#4ADE80' }}>
                          ● PLAYING
                        </span>
                      )}
                    </div>
                    <strong style={{ fontSize: '0.88rem' }}>{cart.title}</strong>
                    <span
                      style={{
                        fontSize: '0.73rem',
                        color: '#94A3B8',
                        lineHeight: 1.3,
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
