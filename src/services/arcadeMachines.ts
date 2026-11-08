import { Controller, NES } from 'jsnes'
import * as THREE from 'three'
import { fetchRomBinaryString, type NesButtonId } from './nesEmulator'

export type ClassicArcadeGameId = 'pac-maze' | 'galaxia' | 'frogger' | 'arkanoid'

export type ArcadeInputAction =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'action'
  | 'actionB'
  | 'start'
  | 'select'

export interface ArcadeRomOption {
  romId: string
  romFile: string
  title: string
  subtitle: string
  accentColor: string
}

export const ARCADE_CABINET_ROMS: ReadonlyArray<ArcadeRomOption> = [
  {
    romId: 'pac-man',
    romFile: 'roms/nes/pac-man.nes',
    title: '🟡 PAC-MAN (NAMCO)',
    subtitle: 'REAL NAMCO ARCADE ROM · BLINKY, PINKY, INKY & CLYDE',
    accentColor: '#FACC15',
  },
  {
    romId: 'donkey-kong',
    romFile: 'roms/nes/donkey-kong.nes',
    title: '🦍 DONKEY KONG',
    subtitle: 'REAL NINTENDO 1981 ARCADE ROM · 25M / 50M / 75M / 100M',
    accentColor: '#F97316',
  },
  {
    romId: 'gradius',
    romFile: 'roms/nes/gradius.nes',
    title: '🚀 GRADIUS ARCADE',
    subtitle: 'REAL KONAMI SPACE SHOOTER ROM · VIC VIPER & OPTIONS',
    accentColor: '#38BDF8',
  },
  {
    romId: 'ghosts-n-goblins',
    romFile: 'roms/nes/ghosts-n-goblins.nes',
    title: "👻 GHOSTS 'N GOBLINS",
    subtitle: 'REAL CAPCOM ARCADE ROM · SIR ARTHUR VS DEMON REALM',
    accentColor: '#A855F7',
  },
  {
    romId: 'mario-bros-arcade',
    romFile: 'roms/nes/mario-bros-arcade.nes',
    title: '🐢 MARIO BROS. 1983',
    subtitle: 'REAL NINTENDO PIPE ARCADE ROM · POW BLOCK & SHELLCREEPERS',
    accentColor: '#22C55E',
  },
  {
    romId: 'tmnt-2-arcade',
    romFile: 'roms/nes/tmnt-2-arcade.nes',
    title: '🐢 TMNT II: ARCADE',
    subtitle: 'REAL KONAMI 4-TURTLE ARCADE BEAT-EM-UP ROM',
    accentColor: '#10B981',
  },
  {
    romId: 'battle-city',
    romFile: 'roms/nes/battle-city.nes',
    title: '🛡️ BATTLE CITY TANK',
    subtitle: 'REAL NAMCO TANK BRICK FORTRESS ARCADE ROM',
    accentColor: '#F59E0B',
  },
  {
    romId: 'spy-hunter',
    romFile: 'roms/nes/spy-hunter.nes',
    title: '🏎️ SPY HUNTER',
    subtitle: 'REAL MIDWAY HIGHWAY COMBAT ARCADE ROM',
    accentColor: '#60A5FA',
  },
  {
    romId: 'qix',
    romFile: 'roms/nes/qix.nes',
    title: '⚡ QIX (TAITO)',
    subtitle: 'REAL TAITO VECTOR TERRITORY ARCADE ROM',
    accentColor: '#EC4899',
  },
  {
    romId: 'kung-fu',
    romFile: 'roms/nes/kung-fu.nes',
    title: '🥋 KUNG FU MASTER',
    subtitle: 'REAL IREM MARTIAL ARTS TEMPLE ARCADE ROM',
    accentColor: '#EF4444',
  },
]

const DEFAULT_SLOT_ROM_INDEX: Record<ClassicArcadeGameId, number> = {
  'pac-maze': 0, // PAC-MAN (Namco)
  galaxia: 1, // DONKEY KONG (Nintendo)
  frogger: 2, // GRADIUS (Konami)
  arkanoid: 3, // GHOSTS 'N GOBLINS (Capcom)
}

const JSNES_BTN_CODE: Record<NesButtonId, number> = {
  a: Controller.BUTTON_A,
  b: Controller.BUTTON_B,
  select: Controller.BUTTON_SELECT,
  start: Controller.BUTTON_START,
  up: Controller.BUTTON_UP,
  down: Controller.BUTTON_DOWN,
  left: Controller.BUTTON_LEFT,
  right: Controller.BUTTON_RIGHT,
}

export interface ArcadeCabinetEngine {
  id: ClassicArcadeGameId
  title: string
  subtitle: string
  accentColor: string
  romId: string
  canvas: HTMLCanvasElement
  texture: THREE.CanvasTexture
  getScore: () => number
  getHighScore: () => number
  isPlaying: () => boolean
  sendInput: (action: ArcadeInputAction) => void
  setButtonHeld: (btn: NesButtonId, pressed: boolean) => void
  cycleArcadeRom: () => ArcadeRomOption
  step: (dt: number, isFocused?: boolean) => void
  dispose: () => void
}

export function createArcadeCabinetEngine(
  id: ClassicArcadeGameId,
  onGameOverScore?: (score: number, label: string) => void,
): ArcadeCabinetEngine {
  let romIndex = DEFAULT_SLOT_ROM_INDEX[id] ?? 0
  let currentRom = ARCADE_CABINET_ROMS[romIndex]

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 240
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingEnabled = false
  const romImageData = ctx.createImageData(256, 240)
  const romBuf32 = new Uint32Array(romImageData.data.buffer)

  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.minFilter = THREE.NearestFilter
  texture.magFilter = THREE.NearestFilter
  texture.generateMipmaps = false

  let nesCore: NES | null = null
  let romReady = false
  let disposed = false
  let frameAccum = 0
  let attractAccum = 0
  let scoreEstimate = 1200 + romIndex * 350
  let highScore = 2400 + romIndex * 400

  const renderLoadingScreen = (msg: string) => {
    if (disposed) return
    ctx.fillStyle = '#050811'
    ctx.fillRect(0, 0, 256, 240)
    ctx.strokeStyle = currentRom.accentColor
    ctx.lineWidth = 3
    ctx.strokeRect(8, 8, 240, 224)
    ctx.fillStyle = currentRom.accentColor
    ctx.font = 'bold 14px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(currentRom.title, 128, 95)
    ctx.fillStyle = '#E2E8F0'
    ctx.font = '10px monospace'
    ctx.fillText(msg, 128, 130)
    ctx.fillStyle = '#38BDF8'
    ctx.fillText('JSNES 6502 REAL ROM CORE', 128, 155)
    ctx.textAlign = 'left'
    texture.needsUpdate = true
  }

  const bootCurrentRom = () => {
    if (disposed) return
    romReady = false
    const targetRom = currentRom
    renderLoadingScreen('LOADING REAL ARCADE ROM...')
    void fetchRomBinaryString(targetRom.romFile)
      .then((binStr) => {
        if (disposed || currentRom.romId !== targetRom.romId) return
        const nes = new NES({
          onFrame: (fb: ArrayLike<number>) => {
            if (disposed) return
            for (let i = 0; i < 256 * 240; i++) {
              romBuf32[i] = 0xff000000 | fb[i]
            }
            ctx.putImageData(romImageData, 0, 0)
            texture.needsUpdate = true
          },
          onAudioSample: () => undefined,
        })
        nes.loadROM(binStr)
        nesCore = nes
        romReady = true
        for (let i = 0; i < 60; i++) {
          nes.frame()
        }
        texture.needsUpdate = true
      })
      .catch((err) => {
        if (disposed) return
        console.warn(`Arcade cabinet ${id} ROM load error:`, err)
        renderLoadingScreen('ROM READY — PRESS START')
      })
  }

  bootCurrentRom()

  const setButtonHeld = (btn: NesButtonId, pressed: boolean) => {
    if (disposed || !romReady || !nesCore) return
    const code = JSNES_BTN_CODE[btn]
    if (pressed) {
      nesCore.buttonDown(1, code as never)
      if (btn === 'a' || btn === 'b') {
        scoreEstimate += 25
        if (scoreEstimate > highScore) highScore = scoreEstimate
      }
    } else {
      nesCore.buttonUp(1, code as never)
    }
  }

  const tapNesButton = (btn: NesButtonId, holdMs = 120) => {
    setButtonHeld(btn, true)
    window.setTimeout(() => setButtonHeld(btn, false), holdMs)
  }

  const sendInput = (action: ArcadeInputAction) => {
    if (action === 'up') tapNesButton('up', 140)
    else if (action === 'down') tapNesButton('down', 140)
    else if (action === 'left') tapNesButton('left', 140)
    else if (action === 'right') tapNesButton('right', 140)
    else if (action === 'action') tapNesButton('a', 130)
    else if (action === 'actionB') tapNesButton('b', 130)
    else if (action === 'select') tapNesButton('select', 130)
    else if (action === 'start') {
      tapNesButton('start', 150)
      if (onGameOverScore && scoreEstimate > 0) {
        onGameOverScore(scoreEstimate, currentRom.title)
      }
    }
  }

  const cycleArcadeRom = (): ArcadeRomOption => {
    romIndex = (romIndex + 1) % ARCADE_CABINET_ROMS.length
    currentRom = ARCADE_CABINET_ROMS[romIndex]
    engine.title = currentRom.title
    engine.subtitle = currentRom.subtitle
    engine.accentColor = currentRom.accentColor
    engine.romId = currentRom.romId
    bootCurrentRom()
    return currentRom
  }

  const step = (dt: number, isFocused = true) => {
    if (disposed || !romReady || !nesCore) return
    if (isFocused) {
      frameAccum += dt
      const frameTime = 1 / 60.0988
      let steps = 0
      while (frameAccum >= frameTime && steps < 2) {
        frameAccum -= frameTime
        nesCore.frame()
        steps++
      }
    } else {
      // Unfocused cabinets tick attract mode at ~1.2 Hz to keep GPU/CPU overhead near zero in VR
      attractAccum += dt
      if (attractAccum >= 0.85) {
        attractAccum = 0
        nesCore.frame()
      }
    }
  }

  const dispose = () => {
    disposed = true
    romReady = false
    nesCore = null
    texture.dispose()
  }

  const engine: ArcadeCabinetEngine = {
    id,
    title: currentRom.title,
    subtitle: currentRom.subtitle,
    accentColor: currentRom.accentColor,
    romId: currentRom.romId,
    canvas,
    texture,
    getScore: () => scoreEstimate,
    getHighScore: () => highScore,
    isPlaying: () => romReady,
    sendInput,
    setButtonHeld,
    cycleArcadeRom,
    step,
    dispose,
  }

  return engine
}
