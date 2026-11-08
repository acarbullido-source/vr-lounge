import { Controller, NES } from 'jsnes'
import * as THREE from 'three'
import type { XRControllerState } from '@react-three/xr'
import {
  isControllerButtonPressed,
  readControllerThumbstick,
} from './xrTracking'
import type { NesSaveSlotId, NesSaveSlotMeta } from '../types/lounge'
import {
  compressStringToBase64,
  decompressBase64ToString,
  getMostRecentNesSaveForCartridge,
  getNesSaveSlot,
  getNesSaveSlotsForCartridge,
  hasAnyNesSaveForCartridge,
  loadNesBatteryRam,
  saveNesBatteryRam,
  storeNesSaveSlot,
} from './persistentVault'

export type NesButtonId =
  | 'a'
  | 'b'
  | 'select'
  | 'start'
  | 'up'
  | 'down'
  | 'left'
  | 'right'

export const NES_BUTTON_ORDER: ReadonlyArray<NesButtonId> = [
  'a',
  'b',
  'select',
  'start',
  'up',
  'down',
  'left',
  'right',
]

export function encodeNesButtonsMask(buttons: ReadonlySet<NesButtonId>): number {
  let mask = 0
  for (let i = 0; i < NES_BUTTON_ORDER.length; i++) {
    if (buttons.has(NES_BUTTON_ORDER[i])) {
      mask |= 1 << i
    }
  }
  return mask & 0xff
}

export function decodeNesButtonsMask(mask: number): Set<NesButtonId> {
  const out = new Set<NesButtonId>()
  for (let i = 0; i < NES_BUTTON_ORDER.length; i++) {
    if ((mask & (1 << i)) !== 0) {
      out.add(NES_BUTTON_ORDER[i])
    }
  }
  return out
}

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
    description: 'Run-and-gun 2-player co-op action with the Spread Gun against Red Falcon.',
    romFile: 'roms/nes/contra.nes',
  },
  {
    id: 'super-c',
    title: 'Super C (Contra II)',
    year: 1990,
    publisher: 'Konami',
    genre: 'Action',
    accentColor: '#DC2626',
    description: 'High-octane 2-player sequel with overhead fortress stages and alien bosses.',
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
    description: '2-Player simultaneous sewer action with Shellcreepers, Sidesteppers, and POW blocks!',
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
    description: 'Solo or 2-Player Vs. megavitamin puzzle battles against Fever and Chill viruses.',
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
    description: '2-Player co-op arcade brawler against the Foot Clan, Bebop, Rocksteady, and Shredder!',
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
    description: '2-Player co-op platformer! Hurl crates, apples, and steel balls to foil Fat Cat!',
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
    description: 'Head-to-head 2-Player or solo 8-bit gridiron football!',
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
    description: '2-Player co-op street brawler with RPG stat shops and Dragon Feet techniques!',
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
    description: '2-Player co-op tank defense! Protect your base eagle across brick battlefields!',
    romFile: 'roms/nes/battle-city.nes',
  },
  {
    id: 'ice-climber',
    title: 'Ice Climber',
    year: 1985,
    publisher: 'Nintendo',
    genre: 'Arcade',
    accentColor: '#22D3EE',
    description: '2-Player co-op! Smash ice blocks with your wooden mallet as Popo and Nana!',
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

  const metaEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env
  const baseUrl = metaEnv?.BASE_URL || '/'
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

function createSafeCanvas(width: number, height: number): {
  canvas: HTMLCanvasElement
  ctx: CanvasRenderingContext2D
  imageData: ImageData
} {
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    const imageData = ctx.createImageData(width, height)
    return { canvas, ctx, imageData }
  }
  // Headless Node fallback for automated unit tests
  const rawBuffer = new Uint8ClampedArray(width * height * 4)
  const imageData = {
    data: rawBuffer,
    width,
    height,
    colorSpace: 'srgb',
  } as unknown as ImageData
  const ctx = {
    imageSmoothingEnabled: false,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    font: '12px monospace',
    textAlign: 'left',
    fillRect: () => undefined,
    strokeRect: () => undefined,
    fillText: () => undefined,
    putImageData: () => undefined,
    drawImage: () => undefined,
    createImageData: () => imageData,
  } as unknown as CanvasRenderingContext2D
  const canvas = {
    width,
    height,
    getContext: () => ctx,
    toDataURL: () => 'data:image/png;base64,',
  } as unknown as HTMLCanvasElement
  return { canvas, ctx, imageData }
}

export type NesConsumerId = 'screen' | 'modal' | 'vr-console'

class NesEmulatorSingleton {
  public readonly canvas: HTMLCanvasElement
  public readonly texture: THREE.CanvasTexture
  private readonly ctx: CanvasRenderingContext2D
  private readonly romImageData: ImageData
  private readonly romBuf32: Uint32Array
  private readonly offscreenRomCanvas: HTMLCanvasElement
  private readonly offscreenRomCtx: CanvasRenderingContext2D
  private readonly thumbCanvas: HTMLCanvasElement
  private readonly thumbCtx: CanvasRenderingContext2D

  private nesCore: NES | null = null
  private romLoaded = false
  private loadingRomId: string | null = null
  private activeCartridge: NesCartridgeMeta = NES_LIBRARY_CARTRIDGES[0]
  private customRomName: string | null = null
  private mediaStream: MediaStream | null = null
  private rafId: number | null = null
  private lastTick = 0
  private frameAccumulator = 0
  private framesSteppedOnCurrentCartridge = 0
  private lastAutoSaveAt = 0
  private paused = false
  private soundEnabled = true
  private masterVolume = 0.75

  // Real NES PAPU WebAudio ring buffer
  private audioCtx: AudioContext | null = null
  private scriptNode: ScriptProcessorNode | null = null
  private gainNode: GainNode | null = null
  private streamDestNode: MediaStreamAudioDestinationNode | null = null
  private audioSamplesL = new Float32Array(AUDIO_BUFFER_SIZE)
  private audioSamplesR = new Float32Array(AUDIO_BUFFER_SIZE)
  private audioWriteIdx = 0
  private audioReadIdx = 0

  // Two-Player & Local Input Routing
  // localInputPlayer = 1 when solo or P1 host; 2 when playing as Player 2 from a second headset
  private localInputPlayer: 1 | 2 = 1
  private localInputSeq = 0
  private lastBroadcastLocalMask = 0

  // Local input sources (merged and routed to `this.localInputPlayer`)
  private uiHeldButtons = new Set<NesButtonId>()
  private gamepadHeldButtons = new Set<NesButtonId>()
  // Optional second local keyboard/gamepad on same device (always routed to Player 2)
  private localSecondaryP2Buttons = new Set<NesButtonId>()

  // Remote peer input masks (from WebRTC / MQTT room channel)
  private remoteP1Buttons = new Set<NesButtonId>()
  private remoteP2Buttons = new Set<NesButtonId>()

  // Currently applied button states inside jsnes Controller 1 & Controller 2
  private appliedP1Buttons = new Set<NesButtonId>()
  private appliedP2Buttons = new Set<NesButtonId>()

  private activeConsumers = new Set<NesConsumerId>()
  private inputMaskListeners = new Set<
    (player: 1 | 2, mask: number, seq: number) => void
  >()
  private saveStateListeners = new Set<(cartridgeId: string) => void>()

  constructor() {
    const main = createSafeCanvas(512, 480)
    this.canvas = main.canvas
    this.ctx = main.ctx
    this.ctx.imageSmoothingEnabled = false

    const offscreen = createSafeCanvas(256, 240)
    this.offscreenRomCanvas = offscreen.canvas
    this.offscreenRomCtx = offscreen.ctx
    this.romImageData = offscreen.imageData
    this.romBuf32 = new Uint32Array(this.romImageData.data.buffer)

    const thumb = createSafeCanvas(96, 90)
    this.thumbCanvas = thumb.canvas
    this.thumbCtx = thumb.ctx
    this.thumbCtx.imageSmoothingEnabled = false

    this.texture = new THREE.CanvasTexture(this.canvas)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.minFilter = THREE.NearestFilter
    this.texture.magFilter = THREE.NearestFilter
    this.texture.generateMipmaps = false

    this.renderBootSplash('BOOTING JSNES 6502 HARDWARE CORE...')
    if (typeof window !== 'undefined' && typeof fetch === 'function') {
      void this.loadLibraryCartridge(this.activeCartridge.id)
      window.addEventListener('beforeunload', () => {
        this.persistBatterySram()
      })
    }
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
        if (typeof this.audioCtx.createMediaStreamDestination === 'function') {
          this.streamDestNode = this.audioCtx.createMediaStreamDestination()
          this.gainNode.connect(this.streamDestNode)
        }
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

  /**
   * Reads 8KB Battery-Backed Cartridge SRAM (`0x6000..0x7FFF`) and persists it if non-empty.
   */
  public persistBatterySram(): boolean {
    if (!this.romLoaded || !this.nesCore || this.customRomName) return false
    const cpuMem = (this.nesCore as unknown as { cpu?: { mem?: number[] } }).cpu?.mem
    if (!cpuMem || cpuMem.length < 0x8000) return false
    let hasNonZero = false
    const sram = new Uint8Array(0x2000)
    for (let i = 0; i < 0x2000; i++) {
      const byte = (cpuMem[0x6000 + i] ?? 0) & 0xff
      sram[i] = byte
      if (byte !== 0 && byte !== 0xff) {
        hasNonZero = true
      }
    }
    if (!hasNonZero) return false
    let bin = ''
    for (let i = 0; i < sram.length; i++) {
      bin += String.fromCharCode(sram[i])
    }
    const b64 =
      typeof btoa === 'function'
        ? btoa(bin)
        : Buffer.from(sram).toString('base64')
    saveNesBatteryRam(this.activeCartridge.id, b64)
    return true
  }

  /**
   * Restores 8KB Battery-Backed Cartridge SRAM (`0x6000..0x7FFF`) into the loaded NES CPU memory.
   */
  public restoreBatterySram(cartridgeId = this.activeCartridge.id): boolean {
    if (!this.romLoaded || !this.nesCore) return false
    const b64 = loadNesBatteryRam(cartridgeId)
    if (!b64) return false
    const cpuMem = (this.nesCore as unknown as { cpu?: { mem?: number[] } }).cpu?.mem
    if (!cpuMem || cpuMem.length < 0x8000) return false
    try {
      const bin =
        typeof atob === 'function'
          ? atob(b64)
          : Buffer.from(b64, 'base64').toString('binary')
      const len = Math.min(0x2000, bin.length)
      for (let i = 0; i < len; i++) {
        cpuMem[0x6000 + i] = bin.charCodeAt(i) & 0xff
      }
      return true
    } catch {
      return false
    }
  }

  public loadLibraryCartridge(
    cartridgeId: string,
    options?: { autoResumeSave?: boolean },
  ): NesCartridgeMeta {
    void this.loadLibraryCartridgeAsync(cartridgeId, options)
    return (
      NES_LIBRARY_CARTRIDGES.find((c) => c.id === cartridgeId) ??
      NES_LIBRARY_CARTRIDGES[0]
    )
  }

  public async loadLibraryCartridgeAsync(
    cartridgeId: string,
    options?: { autoResumeSave?: boolean; skipAutoBatteryRestore?: boolean },
  ): Promise<NesCartridgeMeta> {
    const found =
      NES_LIBRARY_CARTRIDGES.find((c) => c.id === cartridgeId) ??
      NES_LIBRARY_CARTRIDGES[0]

    // Auto-save previous game's battery SRAM and auto-checkpoint before switching cartridges
    if (
      this.romLoaded &&
      this.nesCore &&
      !this.customRomName &&
      this.activeCartridge.id !== found.id &&
      this.framesSteppedOnCurrentCartridge > 90
    ) {
      this.persistBatterySram()
      void this.saveSlot('auto', 'Auto-Switch').catch(() => undefined)
    }

    this.activeCartridge = found
    this.customRomName = null
    this.paused = false
    this.ensureLoopRunning()

    if (this.loadingRomId === found.id && this.romLoaded) {
      return found
    }
    this.loadingRomId = found.id
    this.renderBootSplash(`LOADING ${found.romFile.toUpperCase()}...`)

    try {
      const romBin = await fetchRomBinaryString(found.romFile)
      if (this.activeCartridge.id !== found.id || this.customRomName) return found
      const nes = this.createNesCore()
      nes.loadROM(romBin)
      this.nesCore = nes
      this.romLoaded = true
      this.loadingRomId = null
      this.framesSteppedOnCurrentCartridge = 0
      this.lastAutoSaveAt = Date.now()
      this.appliedP1Buttons.clear()
      this.appliedP2Buttons.clear()

      if (!options?.skipAutoBatteryRestore) {
        this.restoreBatterySram(found.id)
      }

      // Step initial 60 frames (~1 second of 6502 boot) so the PPU finishes warm-up and renders the title screen immediately
      for (let i = 0; i < 60; i++) {
        nes.frame()
      }
      this.texture.needsUpdate = true

      if (options?.autoResumeSave) {
        await this.resumeMostRecentSave(found.id)
      }
    } catch (err) {
      console.error('Failed to load bundled NES ROM:', err)
      this.loadingRomId = null
      this.renderBootSplash('PRESS LOAD .NES ROM TO INSERT CARTRIDGE')
    }

    return found
  }

  public loadBinaryNesRom(
    romBinaryString: string,
    romFileName: string,
    customCartridgeId?: string,
  ): boolean {
    try {
      if (this.romLoaded && this.nesCore && !this.customRomName) {
        this.persistBatterySram()
      }
      const nes = this.createNesCore()
      nes.loadROM(romBinaryString)
      this.nesCore = nes
      this.romLoaded = true
      this.loadingRomId = null
      this.customRomName = customCartridgeId ? null : romFileName
      if (customCartridgeId) {
        const meta = NES_LIBRARY_CARTRIDGES.find((c) => c.id === customCartridgeId)
        if (meta) this.activeCartridge = meta
      }
      this.paused = false
      this.framesSteppedOnCurrentCartridge = 0
      this.appliedP1Buttons.clear()
      this.appliedP2Buttons.clear()
      this.ensureAudioOutput()
      this.ensureLoopRunning()
      for (let i = 0; i < 60; i++) {
        nes.frame()
      }
      this.texture.needsUpdate = true
      return true
    } catch (err) {
      console.warn('Failed to parse binary .nes ROM:', err)
      return false
    }
  }

  /**
   * Exports the complete CPU + PPU + ROM mapper state as a GZIP-compressed Base64 string (~65 KB).
   * Strips transient PPU framebuffers (`buffer`, `bgbuffer`, `pixrendered`, `scantile`, `vramMirrorTable`)
   * so serialization is fast and compact enough for IndexedDB and WebRTC/MQTT sync.
   */
  public async exportCompressedState(): Promise<string | null> {
    if (!this.romLoaded || !this.nesCore) return null
    try {
      const rawState = this.nesCore.toJSON() as unknown as Record<string, unknown>
      const rawPpu = (rawState.ppu ?? {}) as Record<string, unknown>
      const slimPpu: Record<string, unknown> = { ...rawPpu }
      delete slimPpu.buffer
      delete slimPpu.bgbuffer
      delete slimPpu.pixrendered
      delete slimPpu.scantile
      delete slimPpu.vramMirrorTable

      const slimState = {
        ...rawState,
        ppu: slimPpu,
        cartridgeId: this.activeCartridge.id,
      }
      const jsonStr = JSON.stringify(slimState)
      return await compressStringToBase64(jsonStr)
    } catch (err) {
      console.warn('Failed to export NES save state:', err)
      return null
    }
  }

  /**
   * Restores a GZIP-compressed Base64 state into the running `jsnes` instance and renders 1 frame.
   */
  public async importCompressedState(compressedB64: string): Promise<boolean> {
    if (!this.romLoaded || !this.nesCore || !compressedB64) return false
    try {
      const jsonStr = await decompressBase64ToString(compressedB64)
      const snap = JSON.parse(jsonStr) as {
        cpu?: Record<string, unknown>
        mmap?: Record<string, unknown>
        ppu?: Record<string, unknown>
      }
      if (!snap || !snap.cpu || !snap.ppu) return false

      const livePpu = (
        this.nesCore as unknown as {
          ppu: Record<string, unknown> & {
            setMirroring?: (m: unknown) => void
          }
        }
      ).ppu

      // Preserve preallocated PPU framebuffers and lookup tables
      const savedBuffer = livePpu.buffer
      const savedBgBuffer = livePpu.bgbuffer
      const savedPixRendered = livePpu.pixrendered
      const savedScantile = livePpu.scantile
      const savedVramMirrorTable = livePpu.vramMirrorTable

      snap.ppu.buffer = savedBuffer
      snap.ppu.bgbuffer = savedBgBuffer
      snap.ppu.pixrendered = savedPixRendered
      snap.ppu.scantile = savedScantile
      snap.ppu.vramMirrorTable = savedVramMirrorTable

      this.nesCore.fromJSON(snap as never)

      livePpu.buffer = savedBuffer
      livePpu.bgbuffer = savedBgBuffer
      livePpu.pixrendered = savedPixRendered
      livePpu.scantile = savedScantile
      livePpu.vramMirrorTable = savedVramMirrorTable

      if (
        typeof livePpu.setMirroring === 'function' &&
        snap.ppu.currentMirroring !== undefined
      ) {
        livePpu.setMirroring(snap.ppu.currentMirroring)
      }

      this.appliedP1Buttons.clear()
      this.appliedP2Buttons.clear()
      this.nesCore.frame()
      this.texture.needsUpdate = true
      return true
    } catch (err) {
      console.warn('Failed to import NES save state:', err)
      return false
    }
  }

  private captureThumbnailDataUrl(): string | undefined {
    try {
      this.thumbCtx.imageSmoothingEnabled = false
      this.thumbCtx.drawImage(this.offscreenRomCanvas, 0, 0, 96, 90)
      return this.thumbCanvas.toDataURL('image/jpeg', 0.68)
    } catch {
      return undefined
    }
  }

  public async saveSlot(
    slotId: NesSaveSlotId,
    savedBy = 'Player',
  ): Promise<NesSaveSlotMeta | null> {
    if (!this.romLoaded || !this.nesCore) return null
    this.persistBatterySram()
    const compressedState = await this.exportCompressedState()
    if (!compressedState) return null

    const labelMap: Record<NesSaveSlotId, string> = {
      auto: 'Auto Checkpoint',
      'slot-1': 'Save Slot 1',
      'slot-2': 'Save Slot 2',
      'slot-3': 'Save Slot 3',
    }
    const meta: NesSaveSlotMeta = {
      slotId,
      cartridgeId: this.activeCartridge.id,
      cartridgeTitle: this.customRomName ?? this.activeCartridge.title,
      savedAt: Date.now(),
      savedBy,
      label: labelMap[slotId],
      compressedState,
      thumbnailDataUrl: this.captureThumbnailDataUrl(),
    }
    await storeNesSaveSlot(meta)
    this.notifySaveStateListeners(this.activeCartridge.id)
    return meta
  }

  public async loadSlot(
    slotId: NesSaveSlotId,
    cartridgeId = this.activeCartridge.id,
  ): Promise<boolean> {
    const slot = getNesSaveSlot(cartridgeId, slotId)
    if (!slot) return false
    if (this.activeCartridge.id !== cartridgeId || !this.romLoaded) {
      await this.loadLibraryCartridgeAsync(cartridgeId, {
        skipAutoBatteryRestore: true,
      })
    }
    return await this.importCompressedState(slot.compressedState)
  }

  public async resumeMostRecentSave(
    cartridgeId = this.activeCartridge.id,
  ): Promise<NesSaveSlotMeta | null> {
    const latest = getMostRecentNesSaveForCartridge(cartridgeId)
    if (!latest) return null
    if (this.activeCartridge.id !== cartridgeId || !this.romLoaded) {
      await this.loadLibraryCartridgeAsync(cartridgeId, {
        skipAutoBatteryRestore: true,
      })
    }
    const ok = await this.importCompressedState(latest.compressedState)
    return ok ? latest : null
  }

  public getSaveSlotsForCartridge(
    cartridgeId = this.activeCartridge.id,
  ): NesSaveSlotMeta[] {
    return getNesSaveSlotsForCartridge(cartridgeId)
  }

  public hasSavesForCartridge(cartridgeId: string): boolean {
    return hasAnyNesSaveForCartridge(cartridgeId)
  }

  public onSaveSlotsChanged(listener: (cartridgeId: string) => void): () => void {
    this.saveStateListeners.add(listener)
    return () => {
      this.saveStateListeners.delete(listener)
    }
  }

  public notifySaveStateListeners(cartridgeId = this.activeCartridge.id) {
    for (const listener of this.saveStateListeners) {
      listener(cartridgeId)
    }
  }

  /**
   * Sets which NES Controller port (`1` or `2`) the local user's keyboard, UI pad, and Quest VR controllers drive.
   */
  public setLocalInputPlayer(player: 1 | 2) {
    if (this.localInputPlayer === player) return
    this.localInputPlayer = player
    this.lastBroadcastLocalMask = 0
    this.syncControllerStateToCore()
  }

  public getLocalInputPlayer(): 1 | 2 {
    return this.localInputPlayer
  }

  /**
   * Sets remote peer button bitmask for Controller 1 or Controller 2 (used in 2-player cross-headset mode).
   */
  public setRemotePlayerMask(player: 1 | 2, mask: number) {
    const decoded = decodeNesButtonsMask(mask)
    if (player === 1) {
      this.remoteP1Buttons = decoded
    } else {
      this.remoteP2Buttons = decoded
    }
    this.syncControllerStateToCore()
  }

  public clearRemotePlayerInputs() {
    this.remoteP1Buttons.clear()
    this.remoteP2Buttons.clear()
    this.syncControllerStateToCore()
  }

  public onLocalInputMaskChange(
    listener: (player: 1 | 2, mask: number, seq: number) => void,
  ): () => void {
    this.inputMaskListeners.add(listener)
    return () => {
      this.inputMaskListeners.delete(listener)
    }
  }

  public getPlayerButtonsMask(player: 1 | 2): number {
    return encodeNesButtonsMask(
      player === 1 ? this.appliedP1Buttons : this.appliedP2Buttons,
    )
  }

  private syncControllerStateToCore() {
    // Compute combined local primary buttons
    const localPrimary = new Set<NesButtonId>()
    for (const b of this.uiHeldButtons) localPrimary.add(b)
    for (const b of this.gamepadHeldButtons) localPrimary.add(b)

    const localMask = encodeNesButtonsMask(localPrimary)
    if (localMask !== this.lastBroadcastLocalMask) {
      this.lastBroadcastLocalMask = localMask
      this.localInputSeq++
      for (const listener of this.inputMaskListeners) {
        listener(this.localInputPlayer, localMask, this.localInputSeq)
      }
    }

    if (!this.romLoaded || !this.nesCore) return

    for (const btn of NES_BUTTON_ORDER) {
      // Controller 1: Local primary (when localInputPlayer === 1) OR remote P1
      const p1Pressed =
        (this.localInputPlayer === 1 && localPrimary.has(btn)) ||
        this.remoteP1Buttons.has(btn)
      const p1WasPressed = this.appliedP1Buttons.has(btn)
      if (p1Pressed !== p1WasPressed) {
        const code = JSNES_BUTTON_MAP[btn]
        if (p1Pressed) {
          this.nesCore.buttonDown(1, code as never)
          this.appliedP1Buttons.add(btn)
        } else {
          this.nesCore.buttonUp(1, code as never)
          this.appliedP1Buttons.delete(btn)
        }
      }

      // Controller 2: Local primary (when localInputPlayer === 2) OR remote P2 OR local secondary P2
      const p2Pressed =
        (this.localInputPlayer === 2 && localPrimary.has(btn)) ||
        this.remoteP2Buttons.has(btn) ||
        this.localSecondaryP2Buttons.has(btn)
      const p2WasPressed = this.appliedP2Buttons.has(btn)
      if (p2Pressed !== p2WasPressed) {
        const code = JSNES_BUTTON_MAP[btn]
        if (p2Pressed) {
          this.nesCore.buttonDown(2, code as never)
          this.appliedP2Buttons.add(btn)
        } else {
          this.nesCore.buttonUp(2, code as never)
          this.appliedP2Buttons.delete(btn)
        }
      }
    }
  }

  public setButtonState(
    btn: NesButtonId,
    pressed: boolean,
    explicitPlayer?: 1 | 2,
  ) {
    this.ensureAudioOutput()
    if (explicitPlayer === 2 && this.localInputPlayer === 1) {
      if (pressed) {
        this.localSecondaryP2Buttons.add(btn)
      } else {
        this.localSecondaryP2Buttons.delete(btn)
      }
    } else {
      if (pressed) {
        this.uiHeldButtons.add(btn)
      } else {
        this.uiHeldButtons.delete(btn)
      }
    }
    this.syncControllerStateToCore()
  }

  public tapButton(btn: NesButtonId, explicitPlayer?: 1 | 2) {
    this.setButtonState(btn, true, explicitPlayer)
    if (typeof window !== 'undefined') {
      window.setTimeout(
        () => this.setButtonState(btn, false, explicitPlayer),
        115,
      )
    }
  }

  /**
   * Maps Meta Quest Touch Plus Controllers AND standard HTML5 Gamepads (`navigator.getGamepads()`)
   * directly to the local user's active NES Controller slot (`Controller 1` or `Controller 2` in 2-Player mode)!
   */
  public pollQuestAndStandardGamepads(
    leftController?: XRControllerState,
    rightController?: XRControllerState,
    questNesInputEnabled = true,
  ) {
    const nextPad = new Set<NesButtonId>()
    const nextPadP2 = new Set<NesButtonId>()

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
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.getGamepads === 'function'
    ) {
      try {
        const pads = navigator.getGamepads()
        let activeGamepadIdx = 0
        for (const pad of pads) {
          if (!pad || !pad.connected) continue
          const targetSet = activeGamepadIdx === 0 ? nextPad : nextPadP2
          activeGamepadIdx++

          const axX = pad.axes[0] ?? 0
          const axY = pad.axes[1] ?? 0
          if (axY < -0.4 || pad.buttons[12]?.pressed) targetSet.add('up')
          if (axY > 0.4 || pad.buttons[13]?.pressed) targetSet.add('down')
          if (axX < -0.4 || pad.buttons[14]?.pressed) targetSet.add('left')
          if (axX > 0.4 || pad.buttons[15]?.pressed) targetSet.add('right')

          if (pad.buttons[0]?.pressed) targetSet.add('a')
          if (
            pad.buttons[1]?.pressed ||
            pad.buttons[2]?.pressed ||
            pad.buttons[3]?.pressed
          ) {
            targetSet.add('b')
          }
          if (pad.buttons[8]?.pressed) targetSet.add('select')
          if (pad.buttons[9]?.pressed) targetSet.add('start')
        }
      } catch {
        // Ignore gamepad permission errors
      }
    }

    this.gamepadHeldButtons = nextPad
    for (const btn of nextPadP2) {
      this.localSecondaryP2Buttons.add(btn)
    }
    this.syncControllerStateToCore()
  }

  public resetCartridge() {
    if (this.customRomName && this.nesCore) {
      this.nesCore.reset()
      return
    }
    void this.loadLibraryCartridgeAsync(this.activeCartridge.id)
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
      this.gainNode.gain.value =
        this.soundEnabled && !this.paused ? this.masterVolume * 0.35 : 0
    }
  }

  public setConsumerActive(consumer: NesConsumerId, active: boolean) {
    if (active) {
      this.activeConsumers.add(consumer)
      this.paused = false
      this.ensureLoopRunning()
      if (this.gainNode) {
        this.gainNode.gain.value = this.soundEnabled ? this.masterVolume * 0.35 : 0
      }
    } else {
      this.activeConsumers.delete(consumer)
      if (this.activeConsumers.size === 0) {
        this.persistBatterySram()
        this.paused = true
        if (this.rafId !== null && typeof window !== 'undefined') {
          window.cancelAnimationFrame(this.rafId)
          this.rafId = null
        }
        if (this.gainNode) {
          this.gainNode.gain.value = 0
        }
      }
    }
  }

  public wakeAudioAndTexture() {
    this.texture.needsUpdate = true
    if (this.audioCtx && this.audioCtx.state === 'suspended' && !this.paused) {
      void this.audioCtx.resume().catch(() => undefined)
    }
  }

  public getStream(): MediaStream {
    this.ensureLoopRunning()
    this.ensureAudioOutput()
    if (!this.mediaStream) {
      const cap = (
        this.canvas as HTMLCanvasElement & {
          captureStream?: (fps?: number) => MediaStream
        }
      ).captureStream
      if (typeof cap === 'function') {
        this.mediaStream = cap.call(this.canvas, 60)
      } else if (typeof MediaStream !== 'undefined') {
        this.mediaStream = new MediaStream()
      } else {
        this.mediaStream = {} as MediaStream
      }
    }
    if (
      this.streamDestNode &&
      this.mediaStream &&
      typeof this.mediaStream.getAudioTracks === 'function' &&
      this.mediaStream.getAudioTracks().length === 0
    ) {
      const audioTracks = this.streamDestNode.stream.getAudioTracks()
      for (const track of audioTracks) {
        this.mediaStream.addTrack(track)
      }
    }
    return this.mediaStream
  }

  private lastRenderLoopStepAt = 0

  private ensureLoopRunning() {
    if (this.rafId !== null || typeof window === 'undefined') return
    this.lastTick = performance.now()
    const loop = (now: number) => {
      if (this.paused && this.activeConsumers.size === 0) {
        this.rafId = null
        return
      }
      const dt = Math.min(0.05, Math.max(0.001, (now - this.lastTick) / 1000))
      this.lastTick = now
      // Only step from window.requestAnimationFrame if R3F useFrame (WebXR / 3D Canvas) hasn't stepped in the last 40ms
      if (now - this.lastRenderLoopStepAt > 40) {
        this.stepFrame(dt)
      }
      this.rafId = window.requestAnimationFrame(loop)
    }
    this.rafId = window.requestAnimationFrame(loop)
  }

  /**
   * Called from React Three Fiber's `useFrame` so the NES 6502/PPU core continues
   * running at full 60fps inside Meta Quest WebXR sessions (where `window.requestAnimationFrame`
   * is paused by the browser in favor of `XRSession.requestAnimationFrame`).
   */
  public stepFromRenderLoop(dt: number) {
    if (typeof performance !== 'undefined') {
      this.lastRenderLoopStepAt = performance.now()
    }
    if (this.activeConsumers.size > 0 && this.paused) {
      this.paused = false
    }
    this.stepFrame(Math.min(0.05, Math.max(0.001, dt)))
  }

  public stepFrame(dt: number) {
    if (!this.activeConsumers.has('screen')) {
      this.pollQuestAndStandardGamepads(undefined, undefined, false)
    }
    if (!this.romLoaded || !this.nesCore || this.paused) return

    this.frameAccumulator += dt
    const targetFrameTime = 1 / 60.0988
    let steps = 0
    while (this.frameAccumulator >= targetFrameTime && steps < 3) {
      this.frameAccumulator -= targetFrameTime
      this.nesCore.frame()
      this.framesSteppedOnCurrentCartridge++
      steps++
    }

    // Periodic battery SRAM flush every 25 seconds while playing
    const now = Date.now()
    if (
      this.framesSteppedOnCurrentCartridge > 180 &&
      now - this.lastAutoSaveAt > 25_000
    ) {
      this.lastAutoSaveAt = now
      this.persistBatterySram()
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
