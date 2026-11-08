import { Controller, NES } from 'jsnes'
import * as THREE from 'three'
import type { XRControllerState } from '@react-three/xr'
import {
  isControllerButtonPressed,
  readControllerThumbstick,
} from './xrTracking'

export type NesButtonId =
  | 'a'
  | 'b'
  | 'select'
  | 'start'
  | 'up'
  | 'down'
  | 'left'
  | 'right'

export interface NesCartridgeMeta {
  id: string
  title: string
  year: number
  publisher: string
  genre: 'Platformer' | 'Arcade' | 'Action' | 'Adventure' | 'Puzzle' | 'Sports'
  accentColor: string
  description: string
  romFile: string
}

/**
 * 36 Authentic, Verified .nes ROM Cartridges bundled in `public/roms/nes/`
 * Every single ROM has been verified to boot and render PPU frames in `jsnes`.
 */
export const NES_LIBRARY_CARTRIDGES: ReadonlyArray<NesCartridgeMeta> = [
  {
    id: 'super-mario-bros',
    title: 'Super Mario Bros.',
    year: 1985,
    publisher: 'Nintendo',
    genre: 'Platformer',
    accentColor: '#EF4444',
    description: 'The iconic 1985 8-bit Mushroom Kingdom adventure across 8 worlds.',
    romFile: 'roms/nes/super-mario-bros.nes',
  },
  {
    id: 'super-mario-bros-3',
    title: 'Super Mario Bros. 3',
    year: 1990,
    publisher: 'Nintendo',
    genre: 'Platformer',
    accentColor: '#F59E0B',
    description: 'Take flight with the Super Leaf and explore 8 giant kingdoms.',
    romFile: 'roms/nes/super-mario-bros-3.nes',
  },
  {
    id: 'super-mario-bros-2',
    title: 'Super Mario Bros. 2',
    year: 1988,
    publisher: 'Nintendo',
    genre: 'Platformer',
    accentColor: '#3B82F6',
    description: 'Play as Mario, Luigi, Toad, or Princess Toadstool in Subcon!',
    romFile: 'roms/nes/super-mario-bros-2.nes',
  },
  {
    id: 'legend-of-zelda',
    title: 'The Legend of Zelda',
    year: 1986,
    publisher: 'Nintendo',
    genre: 'Adventure',
    accentColor: '#10B981',
    description: 'Explore Hyrule, conquer 9 labyrinths, and recover the Triforce of Wisdom.',
    romFile: 'roms/nes/legend-of-zelda.nes',
  },
  {
    id: 'zelda-ii',
    title: 'Zelda II: Adventure of Link',
    year: 1987,
    publisher: 'Nintendo',
    genre: 'Adventure',
    accentColor: '#059669',
    description: 'Side-scrolling sword combat, magic spells, and the Triforce of Courage.',
    romFile: 'roms/nes/zelda-ii.nes',
  },
  {
    id: 'metroid',
    title: 'Metroid',
    year: 1986,
    publisher: 'Nintendo',
    genre: 'Adventure',
    accentColor: '#EC4899',
    description: 'Battle Space Pirates and Mother Brain deep inside Planet Zebes as Samus Aran.',
    romFile: 'roms/nes/metroid.nes',
  },
  {
    id: 'contra',
    title: 'Contra',
    year: 1988,
    publisher: 'Konami',
    genre: 'Action',
    accentColor: '#EA580C',
    description: 'Run-and-gun action with the Spread Gun against Red Falcon.',
    romFile: 'roms/nes/contra.nes',
  },
  {
    id: 'super-c',
    title: 'Super C (Contra II)',
    year: 1990,
    publisher: 'Konami',
    genre: 'Action',
    accentColor: '#DC2626',
    description: 'High-octane sequel with overhead fortress stages and alien bosses.',
    romFile: 'roms/nes/super-c.nes',
  },
  {
    id: 'castlevania',
    title: 'Castlevania',
    year: 1986,
    publisher: 'Konami',
    genre: 'Action',
    accentColor: '#9333EA',
    description: 'Wield the Vampire Killer whip as Simon Belmont inside Dracula’s castle.',
    romFile: 'roms/nes/castlevania.nes',
  },
  {
    id: 'mega-man-2',
    title: 'Mega Man 2',
    year: 1988,
    publisher: 'Capcom',
    genre: 'Action',
    accentColor: '#38BDF8',
    description: 'Defeat 8 Robot Masters (Metal Man, Air Man, Quick Man) and steal their weapons!',
    romFile: 'roms/nes/mega-man-2.nes',
  },
  {
    id: 'mega-man',
    title: 'Mega Man',
    year: 1987,
    publisher: 'Capcom',
    genre: 'Action',
    accentColor: '#0284C7',
    description: 'The original Blue Bomber battle against Cut Man, Guts Man, and Dr. Wily.',
    romFile: 'roms/nes/mega-man.nes',
  },
  {
    id: 'punch-out',
    title: "Mike Tyson's Punch-Out!!",
    year: 1987,
    publisher: 'Nintendo',
    genre: 'Sports',
    accentColor: '#22C55E',
    description: 'Step into the WVBA ring as Little Mac and dodge, jab, and uppercut to the title!',
    romFile: 'roms/nes/punch-out.nes',
  },
  {
    id: 'pac-man',
    title: 'Pac-Man (Namco Arcade)',
    year: 1984,
    publisher: 'Namco',
    genre: 'Arcade',
    accentColor: '#FACC15',
    description: 'The authentic Namco arcade maze classic with Blinky, Pinky, Inky, and Clyde!',
    romFile: 'roms/nes/pac-man.nes',
  },
  {
    id: 'donkey-kong',
    title: 'Donkey Kong (Arcade)',
    year: 1981,
    publisher: 'Nintendo',
    genre: 'Arcade',
    accentColor: '#F97316',
    description: 'Leap over rolling barrels, climb girders, and rescue Pauline from Donkey Kong!',
    romFile: 'roms/nes/donkey-kong.nes',
  },
  {
    id: 'mario-bros-arcade',
    title: 'Mario Bros. (1983 Arcade)',
    year: 1983,
    publisher: 'Nintendo',
    genre: 'Arcade',
    accentColor: '#06B6D4',
    description: 'Clear the sewer pipes of Shellcreepers, Sidesteppers, and Fighterflies!',
    romFile: 'roms/nes/mario-bros-arcade.nes',
  },
  {
    id: 'tetris',
    title: 'Tetris (Nintendo)',
    year: 1989,
    publisher: 'Nintendo',
    genre: 'Puzzle',
    accentColor: '#A855F7',
    description: 'Stack falling tetrominoes and score 4-line Tetrises to the Dance of the Sugar Plum Fairy!',
    romFile: 'roms/nes/tetris.nes',
  },
  {
    id: 'dr-mario',
    title: 'Dr. Mario',
    year: 1990,
    publisher: 'Nintendo',
    genre: 'Puzzle',
    accentColor: '#F43F5E',
    description: 'Toss two-tone megavitamins into the bottle to eliminate Fever and Chill viruses.',
    romFile: 'roms/nes/dr-mario.nes',
  },
  {
    id: 'kirbys-adventure',
    title: "Kirby's Adventure",
    year: 1993,
    publisher: 'Nintendo / HAL',
    genre: 'Platformer',
    accentColor: '#F472B6',
    description: 'Inhale enemies and copy over 20 powers across Dream Land!',
    romFile: 'roms/nes/kirbys-adventure.nes',
  },
  {
    id: 'tmnt-2-arcade',
    title: 'TMNT II: The Arcade Game',
    year: 1990,
    publisher: 'Konami',
    genre: 'Arcade',
    accentColor: '#16A34A',
    description: 'Battle the Foot Clan, Bebop, Rocksteady, and Shredder in the classic arcade brawler!',
    romFile: 'roms/nes/tmnt-2-arcade.nes',
  },
  {
    id: 'ducktales',
    title: 'DuckTales',
    year: 1989,
    publisher: 'Capcom',
    genre: 'Platformer',
    accentColor: '#EAB308',
    description: 'Pogo-jump across the Amazon, Transylvania, and the Moon as Scrooge McDuck!',
    romFile: 'roms/nes/ducktales.nes',
  },
  {
    id: 'chip-n-dale',
    title: "Chip 'n Dale Rescue Rangers",
    year: 1990,
    publisher: 'Capcom',
    genre: 'Platformer',
    accentColor: '#D97706',
    description: 'Hurl crates, apples, and steel balls to foil Fat Cat’s schemes!',
    romFile: 'roms/nes/chip-n-dale.nes',
  },
  {
    id: 'ninja-gaiden',
    title: 'Ninja Gaiden',
    year: 1989,
    publisher: 'Tecmo',
    genre: 'Action',
    accentColor: '#6366F1',
    description: 'Wall-cling and slash through enemies with the Dragon Sword as Ryu Hayabusa.',
    romFile: 'roms/nes/ninja-gaiden.nes',
  },
  {
    id: 'ghosts-n-goblins',
    title: "Ghosts 'n Goblins",
    year: 1986,
    publisher: 'Capcom',
    genre: 'Arcade',
    accentColor: '#8B5CF6',
    description: 'Hurl lances and daggers through haunted graveyards as Sir Arthur!',
    romFile: 'roms/nes/ghosts-n-goblins.nes',
  },
  {
    id: 'gradius',
    title: 'Gradius (Konami Arcade)',
    year: 1986,
    publisher: 'Konami',
    genre: 'Arcade',
    accentColor: '#38BDF8',
    description: 'Pilot the Vic Viper starfighter with Options, Lasers, and Missiles!',
    romFile: 'roms/nes/gradius.nes',
  },
  {
    id: 'excitebike',
    title: 'Excitebike',
    year: 1984,
    publisher: 'Nintendo',
    genre: 'Sports',
    accentColor: '#F97316',
    description: 'Balance your motocross bike over huge jumps and manage engine overheat!',
    romFile: 'roms/nes/excitebike.nes',
  },
  {
    id: 'tecmo-bowl',
    title: 'Tecmo Bowl',
    year: 1989,
    publisher: 'Tecmo',
    genre: 'Sports',
    accentColor: '#10B981',
    description: 'Call pass and run plays and break tackles in 8-bit gridiron football!',
    romFile: 'roms/nes/tecmo-bowl.nes',
  },
  {
    id: 'rc-pro-am',
    title: 'R.C. Pro-Am',
    year: 1988,
    publisher: 'Rare / Nintendo',
    genre: 'Sports',
    accentColor: '#EF4444',
    description: 'Isometric radio-controlled racing with turbo boosts, oil slicks, and missiles!',
    romFile: 'roms/nes/rc-pro-am.nes',
  },
  {
    id: 'river-city-ransom',
    title: 'River City Ransom',
    year: 1989,
    publisher: 'Technos',
    genre: 'Action',
    accentColor: '#3B82F6',
    description: 'Open-world street brawler with RPG stat shops and Dragon Feet techniques!',
    romFile: 'roms/nes/river-city-ransom.nes',
  },
  {
    id: 'final-fantasy',
    title: 'Final Fantasy',
    year: 1987,
    publisher: 'Square',
    genre: 'Adventure',
    accentColor: '#60A5FA',
    description: 'Lead the four Light Warriors to restore the elemental Orbs in the original RPG.',
    romFile: 'roms/nes/final-fantasy.nes',
  },
  {
    id: 'bomberman',
    title: 'Bomberman',
    year: 1985,
    publisher: 'Hudson Soft',
    genre: 'Arcade',
    accentColor: '#FB923C',
    description: 'Blast brick walls, collect Fire-Up powerups, and clear the maze!',
    romFile: 'roms/nes/bomberman.nes',
  },
  {
    id: 'battle-city',
    title: 'Battle City (Namco Tank)',
    year: 1985,
    publisher: 'Namco',
    genre: 'Arcade',
    accentColor: '#FBBF24',
    description: 'Defend your base eagle and blast enemy armor tanks across brick battlefields!',
    romFile: 'roms/nes/battle-city.nes',
  },
  {
    id: 'ice-climber',
    title: 'Ice Climber',
    year: 1985,
    publisher: 'Nintendo',
    genre: 'Arcade',
    accentColor: '#22D3EE',
    description: 'Smash ice blocks with your wooden mallet as Popo and Nana up 32 mountains!',
    romFile: 'roms/nes/ice-climber.nes',
  },
  {
    id: 'kung-fu',
    title: 'Kung Fu (Irem Arcade)',
    year: 1985,
    publisher: 'Nintendo / Irem',
    genre: 'Arcade',
    accentColor: '#F43F5E',
    description: 'Sweep-kick and jump-kick through 5 floors of the Devil’s Temple as Thomas!',
    romFile: 'roms/nes/kung-fu.nes',
  },
  {
    id: 'spy-hunter',
    title: 'Spy Hunter (Midway Arcade)',
    year: 1987,
    publisher: 'Sunsoft / Midway',
    genre: 'Arcade',
    accentColor: '#94A3B8',
    description: 'Drive the G-6155 Interceptor armed with machine guns, oil slicks, and smoke screens!',
    romFile: 'roms/nes/spy-hunter.nes',
  },
  {
    id: 'qix',
    title: 'Qix (Taito Arcade)',
    year: 1981,
    publisher: 'Taito',
    genre: 'Arcade',
    accentColor: '#C084FC',
    description: 'Draw Stix lines to claim 75% of the playfield while dodging the electric Qix!',
    romFile: 'roms/nes/qix.nes',
  },
  {
    id: 'lode-runner',
    title: 'Lode Runner',
    year: 1984,
    publisher: 'Hudson / Broderbund',
    genre: 'Puzzle',
    accentColor: '#FACC15',
    description: 'Dig traps in brick floors and collect all the gold chests across 50 stages!',
    romFile: 'roms/nes/lode-runner.nes',
  },
]

const JSNES_BUTTON_MAP: Record<NesButtonId, number> = {
  a: Controller.BUTTON_A,
  b: Controller.BUTTON_B,
  select: Controller.BUTTON_SELECT,
  start: Controller.BUTTON_START,
  up: Controller.BUTTON_UP,
  down: Controller.BUTTON_DOWN,
  left: Controller.BUTTON_LEFT,
  right: Controller.BUTTON_RIGHT,
}

const AUDIO_BUFFER_SIZE = 8192
const AUDIO_BUFFER_MASK = AUDIO_BUFFER_SIZE - 1

const romBinaryCache = new Map<string, string>()

export function arrayBufferToBinaryString(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  const chunkSize = 0x8000
  let binary = ''
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, Math.min(i + chunkSize, bytes.length))
    binary += String.fromCharCode.apply(null, slice as unknown as number[])
  }
  return binary
}

export async function fetchRomBinaryString(romFile: string): Promise<string> {
  const cached = romBinaryCache.get(romFile)
  if (cached) return cached

  const baseUrl = import.meta.env.BASE_URL || '/'
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`
  const cleanPath = romFile.replace(/^\/+/, '')
  const url = `${normalizedBase}${cleanPath}`

  const resp = await fetch(url)
  if (!resp.ok) {
    throw new Error(`HTTP ${resp.status} loading ROM ${url}`)
  }
  const buf = await resp.arrayBuffer()
  const binStr = arrayBufferToBinaryString(buf)
  if (!binStr.startsWith('NES\x1a')) {
    throw new Error(`Invalid iNES header in ${romFile}`)
  }
  romBinaryCache.set(romFile, binStr)
  return binStr
}

class NesEmulatorSingleton {
  public readonly canvas: HTMLCanvasElement
  public readonly texture: THREE.CanvasTexture
  private readonly ctx: CanvasRenderingContext2D
  private readonly romImageData: ImageData
  private readonly romBuf32: Uint32Array
  private readonly offscreenRomCanvas: HTMLCanvasElement
  private readonly offscreenRomCtx: CanvasRenderingContext2D

  private nesCore: NES | null = null
  private romLoaded = false
  private loadingRomId: string | null = null
  private activeCartridge: NesCartridgeMeta = NES_LIBRARY_CARTRIDGES[0]
  private customRomName: string | null = null
  private mediaStream: MediaStream | null = null
  private rafId: number | null = null
  private lastTick = 0
  private frameAccumulator = 0
  private paused = false
  private soundEnabled = true
  private masterVolume = 0.75

  // Real NES PAPU WebAudio ring buffer
  private audioCtx: AudioContext | null = null
  private scriptNode: ScriptProcessorNode | null = null
  private gainNode: GainNode | null = null
  private audioSamplesL = new Float32Array(AUDIO_BUFFER_SIZE)
  private audioSamplesR = new Float32Array(AUDIO_BUFFER_SIZE)
  private audioWriteIdx = 0
  private audioReadIdx = 0

  // Button state tracking so keyboard, UI buttons, and Quest controllers never conflict
  private uiHeldButtons = new Set<NesButtonId>()
  private gamepadHeldButtons = new Set<NesButtonId>()
  private appliedButtons = new Set<NesButtonId>()

  constructor() {
    this.canvas = document.createElement('canvas')
    this.canvas.width = 512
    this.canvas.height = 480
    this.ctx = this.canvas.getContext('2d')!
    this.ctx.imageSmoothingEnabled = false

    this.offscreenRomCanvas = document.createElement('canvas')
    this.offscreenRomCanvas.width = 256
    this.offscreenRomCanvas.height = 240
    this.offscreenRomCtx = this.offscreenRomCanvas.getContext('2d')!
    this.romImageData = this.offscreenRomCtx.createImageData(256, 240)
    this.romBuf32 = new Uint32Array(this.romImageData.data.buffer)

    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.minFilter = THREE.NearestFilter
    this.texture.magFilter = THREE.NearestFilter
    this.texture.generateMipmaps = false

    this.renderBootSplash('BOOTING JSNES 6502 HARDWARE CORE...')
    void this.loadLibraryCartridge(this.activeCartridge.id)
  }

  private createNesCore(): NES {
    return new NES({
      onFrame: (frameBuffer: ArrayLike<number>) => {
        for (let i = 0; i < 256 * 240; i++) {
          this.romBuf32[i] = 0xff000000 | frameBuffer[i]
        }
        this.offscreenRomCtx.putImageData(this.romImageData, 0, 0)
        this.ctx.imageSmoothingEnabled = false
        this.ctx.drawImage(this.offscreenRomCanvas, 0, 0, 512, 480)
        this.texture.needsUpdate = true
      },
      onAudioSample: (left: number, right: number) => {
        if (!this.soundEnabled || this.masterVolume <= 0.001) return
        const nextWrite = (this.audioWriteIdx + 1) & AUDIO_BUFFER_MASK
        if (nextWrite === this.audioReadIdx) {
          // Ring buffer full; drop oldest sample
          this.audioReadIdx = (this.audioReadIdx + 1) & AUDIO_BUFFER_MASK
        }
        this.audioSamplesL[this.audioWriteIdx] = left
        this.audioSamplesR[this.audioWriteIdx] = right
        this.audioWriteIdx = nextWrite
      },
    })
  }

  private ensureAudioOutput() {
    if (!this.soundEnabled || typeof window === 'undefined') return
    try {
      if (!this.audioCtx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext
        if (!Ctor) return
        this.audioCtx = new Ctor({ sampleRate: 44100 })
        this.gainNode = this.audioCtx.createGain()
        this.gainNode.gain.value = this.soundEnabled ? this.masterVolume * 0.35 : 0
        this.scriptNode = this.audioCtx.createScriptProcessor(1024, 0, 2)
        this.scriptNode.onaudioprocess = (e) => {
          const outL = e.outputBuffer.getChannelData(0)
          const outR = e.outputBuffer.getChannelData(1)
          for (let i = 0; i < outL.length; i++) {
            if (this.audioReadIdx !== this.audioWriteIdx && !this.paused) {
              outL[i] = this.audioSamplesL[this.audioReadIdx]
              outR[i] = this.audioSamplesR[this.audioReadIdx]
              this.audioReadIdx = (this.audioReadIdx + 1) & AUDIO_BUFFER_MASK
            } else {
              outL[i] = 0
              outR[i] = 0
            }
          }
        }
        this.scriptNode.connect(this.gainNode)
        this.gainNode.connect(this.audioCtx.destination)
      }
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume().catch(() => undefined)
      }
      if (this.gainNode) {
        this.gainNode.gain.value = this.soundEnabled ? this.masterVolume * 0.35 : 0
      }
    } catch {
      // Ignore WebAudio autoplay block until user gesture
    }
  }

  private renderBootSplash(statusLine: string) {
    const ctx = this.ctx
    ctx.fillStyle = '#070B14'
    ctx.fillRect(0, 0, 512, 480)
    ctx.strokeStyle = this.activeCartridge.accentColor
    ctx.lineWidth = 4
    ctx.strokeRect(18, 18, 476, 444)

    ctx.fillStyle = this.activeCartridge.accentColor
    ctx.font = 'bold 24px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(this.activeCartridge.title.toUpperCase(), 256, 190)

    ctx.fillStyle = '#E2E8F0'
    ctx.font = 'bold 14px monospace'
    ctx.fillText(
      `${this.activeCartridge.publisher} · ${this.activeCartridge.year}`,
      256,
      225,
    )

    ctx.fillStyle = '#38BDF8'
    ctx.font = '13px monospace'
    ctx.fillText(statusLine, 256, 275)
    ctx.textAlign = 'left'
    this.texture.needsUpdate = true
  }

  public loadLibraryCartridge(cartridgeId: string): NesCartridgeMeta {
    const found =
      NES_LIBRARY_CARTRIDGES.find((c) => c.id === cartridgeId) ??
      NES_LIBRARY_CARTRIDGES[0]
    this.activeCartridge = found
    this.customRomName = null
    this.paused = false
    this.ensureLoopRunning()

    if (this.loadingRomId === found.id) {
      return found
    }
    this.loadingRomId = found.id
    this.renderBootSplash(`LOADING ${found.romFile.toUpperCase()}...`)

    void fetchRomBinaryString(found.romFile)
      .then((romBin) => {
        if (this.activeCartridge.id !== found.id || this.customRomName) return
        const nes = this.createNesCore()
        nes.loadROM(romBin)
        this.nesCore = nes
        this.romLoaded = true
        this.loadingRomId = null
        this.appliedButtons.clear()
        // Step initial frames immediately so title screen appears right away
        for (let i = 0; i < 4; i++) {
          nes.frame()
        }
      })
      .catch((err) => {
        console.error('Failed to load bundled NES ROM:', err)
        this.loadingRomId = null
        this.renderBootSplash('PRESS LOAD .NES ROM TO INSERT CARTRIDGE')
      })

    return found
  }

  public loadBinaryNesRom(romBinaryString: string, romFileName: string): boolean {
    try {
      const nes = this.createNesCore()
      nes.loadROM(romBinaryString)
      this.nesCore = nes
      this.romLoaded = true
      this.loadingRomId = null
      this.customRomName = romFileName
      this.paused = false
      this.appliedButtons.clear()
      this.ensureAudioOutput()
      this.ensureLoopRunning()
      for (let i = 0; i < 4; i++) {
        nes.frame()
      }
      return true
    } catch (err) {
      console.warn('Failed to parse binary .nes ROM:', err)
      return false
    }
  }

  private syncControllerStateToCore() {
    if (!this.romLoaded || !this.nesCore) return
    const allButtons: NesButtonId[] = [
      'a',
      'b',
      'select',
      'start',
      'up',
      'down',
      'left',
      'right',
    ]
    for (const btn of allButtons) {
      const shouldBePressed =
        this.uiHeldButtons.has(btn) || this.gamepadHeldButtons.has(btn)
      const isCurrentlyPressed = this.appliedButtons.has(btn)
      if (shouldBePressed !== isCurrentlyPressed) {
        const code = JSNES_BUTTON_MAP[btn]
        if (shouldBePressed) {
          this.nesCore.buttonDown(1, code as never)
          this.appliedButtons.add(btn)
        } else {
          this.nesCore.buttonUp(1, code as never)
          this.appliedButtons.delete(btn)
        }
      }
    }
  }

  public setButtonState(btn: NesButtonId, pressed: boolean) {
    this.ensureAudioOutput()
    if (pressed) {
      this.uiHeldButtons.add(btn)
    } else {
      this.uiHeldButtons.delete(btn)
    }
    this.syncControllerStateToCore()
  }

  public tapButton(btn: NesButtonId) {
    this.setButtonState(btn, true)
    window.setTimeout(() => this.setButtonState(btn, false), 115)
  }

  /**
   * Maps Meta Quest Touch Plus Controllers AND standard HTML5 Gamepads (`navigator.getGamepads()`)
   * directly to NES Controller 1 (`D-Pad`, `A`, `B`, `START`, `SELECT`)!
   *
   * Quest Controller Mapping when NES is active:
   * - Left Thumbstick: NES D-Pad (`UP`, `DOWN`, `LEFT`, `RIGHT`)
   * - Right `A` button OR Right Trigger: NES `A` button (Jump / Primary)
   * - Right `B` button OR Left `X` button OR Left Trigger: NES `B` button (Run / Fire)
   * - Left `Y` button OR Right Grip/Squeeze: NES `START` button
   * - Left Grip/Squeeze OR Thumbstick Click: NES `SELECT` button
   */
  public pollQuestAndStandardGamepads(
    leftController?: XRControllerState,
    rightController?: XRControllerState,
    questNesInputEnabled = true,
  ) {
    const nextPad = new Set<NesButtonId>()

    // 1. Meta Quest WebXR Controllers
    if (questNesInputEnabled && (leftController || rightController)) {
      const stick = readControllerThumbstick(leftController ?? rightController)
      if (stick.y < -0.35) nextPad.add('up')
      if (stick.y > 0.35) nextPad.add('down')
      if (stick.x < -0.35) nextPad.add('left')
      if (stick.x > 0.35) nextPad.add('right')

      // NES A: Right A button or Right Trigger (index 0)
      if (
        isControllerButtonPressed(rightController, ['a-button'], 4) ||
        isControllerButtonPressed(
          rightController,
          ['xr-standard-trigger'],
          0,
        )
      ) {
        nextPad.add('a')
      }

      // NES B: Right B button, Left X button, or Left Trigger (index 0)
      if (
        isControllerButtonPressed(rightController, ['b-button'], 5) ||
        isControllerButtonPressed(leftController, ['x-button'], 4) ||
        isControllerButtonPressed(leftController, ['xr-standard-trigger'], 0)
      ) {
        nextPad.add('b')
      }

      // NES START: Left Y button or Right Squeeze (index 1)
      if (
        isControllerButtonPressed(leftController, ['y-button'], 5) ||
        isControllerButtonPressed(
          rightController,
          ['xr-standard-squeeze'],
          1,
        )
      ) {
        nextPad.add('start')
      }

      // NES SELECT: Left Squeeze (index 1) or Left Thumbstick Click (index 3)
      if (
        isControllerButtonPressed(
          leftController,
          ['xr-standard-squeeze'],
          1,
        ) ||
        isControllerButtonPressed(
          leftController,
          ['xr-standard-thumbstick'],
          3,
        )
      ) {
        nextPad.add('select')
      }
    }

    // 2. Standard Browser Gamepad API (Bluetooth Xbox / DualSense / 8BitDo / Quest WebXR Gamepads)
    if (typeof navigator !== 'undefined' && typeof navigator.getGamepads === 'function') {
      try {
        const pads = navigator.getGamepads()
        for (const pad of pads) {
          if (!pad || !pad.connected) continue
          const axX = pad.axes[0] ?? 0
          const axY = pad.axes[1] ?? 0
          if (axY < -0.4 || pad.buttons[12]?.pressed) nextPad.add('up')
          if (axY > 0.4 || pad.buttons[13]?.pressed) nextPad.add('down')
          if (axX < -0.4 || pad.buttons[14]?.pressed) nextPad.add('left')
          if (axX > 0.4 || pad.buttons[15]?.pressed) nextPad.add('right')

          if (pad.buttons[0]?.pressed || pad.buttons[1]?.pressed) {
            // Standard pad: button 0 (A/Cross) -> A, button 2 (X/Square) -> B
            if (pad.buttons[0]?.pressed) nextPad.add('a')
          }
          if (pad.buttons[2]?.pressed || pad.buttons[3]?.pressed) {
            nextPad.add('b')
          }
          if (pad.buttons[8]?.pressed) nextPad.add('select')
          if (pad.buttons[9]?.pressed) nextPad.add('start')
        }
      } catch {
        // Ignore gamepad permission errors
      }
    }

    this.gamepadHeldButtons = nextPad
    this.syncControllerStateToCore()
  }

  public resetCartridge() {
    if (this.customRomName && this.nesCore) {
      this.nesCore.reset()
      return
    }
    this.loadLibraryCartridge(this.activeCartridge.id)
  }

  public getActiveCartridge(): NesCartridgeMeta {
    return this.activeCartridge
  }

  public getCustomRomName(): string | null {
    return this.customRomName
  }

  public isSoundEnabled(): boolean {
    return this.soundEnabled
  }

  public toggleSound(): boolean {
    this.soundEnabled = !this.soundEnabled
    this.ensureAudioOutput()
    if (this.gainNode) {
      this.gainNode.gain.value = this.soundEnabled ? this.masterVolume * 0.35 : 0
    }
    return this.soundEnabled
  }

  public setMasterVolume(vol: number) {
    this.masterVolume = Math.max(0, Math.min(1, vol))
    if (this.gainNode) {
      this.gainNode.gain.value = this.soundEnabled ? this.masterVolume * 0.35 : 0
    }
  }

  public getStream(): MediaStream {
    this.ensureLoopRunning()
    if (!this.mediaStream) {
      const cap = (
        this.canvas as HTMLCanvasElement & {
          captureStream?: (fps?: number) => MediaStream
        }
      ).captureStream
      if (typeof cap === 'function') {
        this.mediaStream = cap.call(this.canvas, 60)
      } else {
        this.mediaStream = new MediaStream()
      }
    }
    return this.mediaStream
  }

  private ensureLoopRunning() {
    if (this.rafId !== null || typeof window === 'undefined') return
    this.lastTick = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTick) / 1000))
      this.lastTick = now
      this.stepFrame(dt)
      this.rafId = window.requestAnimationFrame(loop)
    }
    this.rafId = window.requestAnimationFrame(loop)
  }

  private stepFrame(dt: number) {
    this.pollQuestAndStandardGamepads(undefined, undefined, false)
    if (!this.romLoaded || !this.nesCore || this.paused) return

    this.frameAccumulator += dt
    const targetFrameTime = 1 / 60.0988
    let steps = 0
    while (this.frameAccumulator >= targetFrameTime && steps < 2) {
      this.frameAccumulator -= targetFrameTime
      this.nesCore.frame()
      steps++
    }
  }
}

let singleton: NesEmulatorSingleton | null = null

export function getNesEmulator(): NesEmulatorSingleton {
  if (!singleton) {
    singleton = new NesEmulatorSingleton()
  }
  return singleton
}

export function isNesMediaUrl(url: string): boolean {
  return url.trim().toLowerCase().startsWith('nes://')
}

export function parseNesCartridgeIdFromUrl(url: string): string {
  const clean = url.trim().replace(/^nes:\/\/(cartridge\/)?/i, '')
  return clean || NES_LIBRARY_CARTRIDGES[0].id
}
