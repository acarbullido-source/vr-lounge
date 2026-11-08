import * as jsnes from 'jsnes'

export type NesButtonId =
  | 'up'
  | 'down'
  | 'left'
  | 'right'
  | 'a'
  | 'b'
  | 'select'
  | 'start'

export interface NesCartridgeMeta {
  id: string
  title: string
  year: number
  genre: 'Platformer' | 'Arcade' | 'Action' | 'Adventure' | 'Puzzle' | 'Sports'
  accentColor: string
  description: string
  engineKind: 'platformer' | 'maze' | 'shooter' | 'blocks' | 'adventure' | 'racer'
}

export const NES_LIBRARY_CARTRIDGES: readonly NesCartridgeMeta[] = [
  {
    id: 'super-bros-85',
    title: "Super Plumber Bros. '85",
    year: 1985,
    genre: 'Platformer',
    accentColor: '#EF4444',
    description: 'Run, jump, hit [?] coin blocks, stomp Goombas, and clear World 1-1!',
    engineKind: 'platformer',
  },
  {
    id: 'zelda-hyrule-86',
    title: "Legend of Hyrule '86",
    year: 1986,
    genre: 'Adventure',
    accentColor: '#10B981',
    description: 'Explore the overworld, slash Octoroks with your sword, and collect Triforce shards!',
    engineKind: 'adventure',
  },
  {
    id: 'pac-maze-nes',
    title: 'Pac-Maze Championship NES',
    year: 1984,
    genre: 'Arcade',
    accentColor: '#FACC15',
    description: 'Chomp dots & power pellets while outsmarting Blinky, Pinky, Inky & Clyde!',
    engineKind: 'maze',
  },
  {
    id: 'contra-commando-87',
    title: "Contra Jungle Commando '87",
    year: 1987,
    genre: 'Action',
    accentColor: '#F97316',
    description: 'Run-and-gun jungle blitz with Spread-Gun rapid fire and alien turrets!',
    engineKind: 'platformer',
  },
  {
    id: 'tetra-blocks-89',
    title: "Tetra-Blocks Championship '89",
    year: 1989,
    genre: 'Puzzle',
    accentColor: '#38BDF8',
    description: 'Rotate and drop falling 8-bit tetromino blocks to clear lines and rack up Tetrises!',
    engineKind: 'blocks',
  },
  {
    id: 'mega-blaster-87',
    title: "Mega Android Blaster '87",
    year: 1987,
    genre: 'Platformer',
    accentColor: '#06B6D4',
    description: 'Leap across cyber stages firing the Arm Cannon against Robot Masters!',
    engineKind: 'platformer',
  },
  {
    id: 'galaxia-nes',
    title: 'Galaxia Starfighter NES',
    year: 1985,
    genre: 'Arcade',
    accentColor: '#EC4899',
    description: 'Defend the galaxy from diving insectoid fleets with twin plasma cannons!',
    engineKind: 'shooter',
  },
  {
    id: 'excite-moto-84',
    title: "Excite Dirtbike '84",
    year: 1984,
    genre: 'Sports',
    accentColor: '#EAB308',
    description: 'Hit turbo stadium ramps, dodge mud pits, and race for the track record!',
    engineKind: 'racer',
  },
  {
    id: 'metroid-zebes-86',
    title: "Planet Zebes Bounty '86",
    year: 1986,
    genre: 'Adventure',
    accentColor: '#A855F7',
    description: 'Battle through alien caverns with power beams and morph-ball bombs!',
    engineKind: 'platformer',
  },
  {
    id: 'punch-boxer-87',
    title: "Title Bout Punch-Boxer '87",
    year: 1987,
    genre: 'Sports',
    accentColor: '#22C55E',
    description: 'Dodge and unleash star uppercuts in championship 8-bit ring action!',
    engineKind: 'shooter',
  },
  {
    id: 'castlevania-crypt-86',
    title: "Vampire Crypt Whip '86",
    year: 1986,
    genre: 'Platformer',
    accentColor: '#DC2626',
    description: 'Storm the dark castle, crack the Vampire Killer whip, and defeat Count Dracula!',
    engineKind: 'platformer',
  },
  {
    id: 'battle-tank-85',
    title: "Battle Tank City '85",
    year: 1985,
    genre: 'Action',
    accentColor: '#F59E0B',
    description: 'Command your armored tank through brick mazes and defend the Eagle base!',
    engineKind: 'adventure',
  },
  {
    id: 'duck-target-84',
    title: "Zapper Duck Target Hunt '84",
    year: 1984,
    genre: 'Arcade',
    accentColor: '#34D399',
    description: 'Track fast-flying ducks across the marsh and fire for high-score combos!',
    engineKind: 'shooter',
  },
  {
    id: 'bomber-maze-85',
    title: "Bomber Maze Blast '85",
    year: 1985,
    genre: 'Arcade',
    accentColor: '#60A5FA',
    description: 'Navigate the grid, clear obstacles, and trap patrolling monsters!',
    engineKind: 'maze',
  },
  {
    id: 'ice-climber-85',
    title: "Ice Summit Climber '85",
    year: 1985,
    genre: 'Platformer',
    accentColor: '#7DD3FC',
    description: 'Ascend icy mountain ledges with your mallet and catch the condor at the peak!',
    engineKind: 'platformer',
  },
  {
    id: 'balloon-flyer-84',
    title: "Balloon Night Flyer '84",
    year: 1984,
    genre: 'Arcade',
    accentColor: '#F472B6',
    description: 'Flap across the night sky popping rival balloons over lightning clouds!',
    engineKind: 'platformer',
  },
  {
    id: 'dr-capsule-90',
    title: "Dr. Capsule Virus Lab '90",
    year: 1990,
    genre: 'Puzzle',
    accentColor: '#FB7185',
    description: 'Align falling two-color vitamin capsules to clear viruses in the bottle!',
    engineKind: 'blocks',
  },
  {
    id: 'gradius-viper-86',
    title: "Vic Viper Space Wing '86",
    year: 1986,
    genre: 'Action',
    accentColor: '#818CF8',
    description: 'Power up the Vic Viper with lasers, missiles, and glowing Option drones!',
    engineKind: 'shooter',
  },
  {
    id: 'arkanoid-vaus-86',
    title: "Arkanoid Vaus NES '86",
    year: 1986,
    genre: 'Arcade',
    accentColor: '#2DD4BF',
    description: 'Deflect the energy ball with the Vaus spacecraft to shatter neon fortresses!',
    engineKind: 'shooter',
  },
  {
    id: 'frogger-river-nes',
    title: 'Highway & River Frog NES',
    year: 1985,
    genre: 'Arcade',
    accentColor: '#4ADE80',
    description: 'Hop across busy 8-bit highways and floating river logs to reach home bays!',
    engineKind: 'maze',
  },
  {
    id: 'rc-pro-racer-88',
    title: "RC Pro Turbo Track '88",
    year: 1988,
    genre: 'Sports',
    accentColor: '#FBBF24',
    description: 'Hit speed zippers, dodge oil slicks, and drift around the championship circuit!',
    engineKind: 'racer',
  },
  {
    id: 'blades-hockey-88',
    title: "Blades of Ice Hockey '88",
    year: 1988,
    genre: 'Sports',
    accentColor: '#38BDF8',
    description: 'Fast-paced 8-bit rink action with blistering slapshots!',
    engineKind: 'racer',
  },
  {
    id: 'techmo-bowl-89',
    title: "8-Bit Gridiron Bowl '89",
    year: 1989,
    genre: 'Sports',
    accentColor: '#FB923C',
    description: 'Break tackles down the sideline and score 80-yard 8-bit touchdowns!',
    engineKind: 'racer',
  },
  {
    id: 'snake-rattle-90',
    title: "Nibbler Snake DX '90",
    year: 1990,
    genre: 'Arcade',
    accentColor: '#A3E635',
    description: 'Guide the 8-bit serpent through the neon arena collecting power apples!',
    engineKind: 'maze',
  },
]

const JSNES_BUTTON_MAP: Record<NesButtonId, jsnes.ButtonKey> = {
  a: jsnes.Controller.BUTTON_A,
  b: jsnes.Controller.BUTTON_B,
  select: jsnes.Controller.BUTTON_SELECT,
  start: jsnes.Controller.BUTTON_START,
  up: jsnes.Controller.BUTTON_UP,
  down: jsnes.Controller.BUTTON_DOWN,
  left: jsnes.Controller.BUTTON_LEFT,
  right: jsnes.Controller.BUTTON_RIGHT,
}

class NesEmulatorSingleton {
  public readonly canvas: HTMLCanvasElement
  private readonly ctx: CanvasRenderingContext2D
  private readonly romImageData: ImageData
  private readonly romBuf32: Uint32Array
  private readonly offscreenRomCanvas: HTMLCanvasElement
  private readonly offscreenRomCtx: CanvasRenderingContext2D

  private nesCore: jsnes.NES | null = null
  private usingBinaryRom = false
  private activeCartridge: NesCartridgeMeta = NES_LIBRARY_CARTRIDGES[0]
  private customRomName: string | null = null
  private mediaStream: MediaStream | null = null
  private rafId: number | null = null
  private lastTick = 0
  private soundEnabled = true
  private audioCtx: AudioContext | null = null

  // Built-in 8-bit game engine state
  private score = 0
  private hiScore = 12500
  private coins = 0
  private lives = 3
  private stage = 1
  private paused = false
  private heldButtons = new Set<NesButtonId>()

  // Platformer state
  private heroX = 64
  private heroY = 172
  private heroVx = 0
  private heroVy = 0
  private onGround = true
  private scrollX = 0
  private enemies: Array<{ x: number; y: number; vx: number; alive: boolean }> = []
  private fireballs: Array<{ x: number; y: number; vx: number }> = []
  private blocks: Array<{ x: number; y: number; hit: boolean }> = []

  // Maze / Adventure state
  private gridX = 7
  private gridY = 7
  private dirX = 1
  private dirY = 0
  private swordTimer = 0
  private pellets: Set<string> = new Set()
  private mobList: Array<{ x: number; y: number; dx: number; dy: number; color: string }> = []

  // Blocks (Tetris-style) state
  private well: string[][] = Array.from({ length: 16 }, () => Array(10).fill(''))
  private pieceX = 4
  private pieceY = 0
  private pieceShape: number[][] = [
    [1, 1, 1],
    [0, 1, 0],
  ]
  private pieceColor = '#38BDF8'
  private dropTimer = 0

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

    this.initCartridgeState(this.activeCartridge)
  }

  private playChiptuneBeep(freq: number, durationMs: number, type: OscillatorType = 'square') {
    if (!this.soundEnabled || typeof window === 'undefined') return
    try {
      if (!this.audioCtx) {
        const Ctor =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
        if (!Ctor) return
        this.audioCtx = new Ctor()
      }
      if (this.audioCtx.state === 'suspended') {
        void this.audioCtx.resume()
      }
      const osc = this.audioCtx.createOscillator()
      const gain = this.audioCtx.createGain()
      osc.type = type
      osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime)
      gain.gain.setValueAtTime(0.04, this.audioCtx.currentTime)
      gain.gain.exponentialRampToValueAtTime(
        0.001,
        this.audioCtx.currentTime + durationMs / 1000,
      )
      osc.connect(gain)
      gain.connect(this.audioCtx.destination)
      osc.start()
      osc.stop(this.audioCtx.currentTime + durationMs / 1000)
    } catch {
      // Ignore audio unlock errors
    }
  }

  private initCartridgeState(cart: NesCartridgeMeta) {
    this.usingBinaryRom = false
    this.customRomName = null
    this.activeCartridge = cart
    this.score = 0
    this.coins = 0
    this.lives = 3
    this.stage = 1
    this.paused = false

    // Reset platformer entities
    this.heroX = 56
    this.heroY = 172
    this.heroVx = 0
    this.heroVy = 0
    this.onGround = true
    this.scrollX = 0
    this.fireballs = []
    this.blocks = [
      { x: 110, y: 124, hit: false },
      { x: 134, y: 124, hit: false },
      { x: 158, y: 124, hit: false },
      { x: 134, y: 84, hit: false },
      { x: 210, y: 124, hit: false },
    ]
    this.enemies = [
      { x: 145, y: 172, vx: -36, alive: true },
      { x: 205, y: 172, vx: -42, alive: true },
      { x: 255, y: 172, vx: -38, alive: true },
    ]

    // Reset maze / adventure entities
    this.gridX = 7
    this.gridY = 7
    this.pellets.clear()
    for (let r = 1; r < 12; r++) {
      for (let c = 1; c < 15; c++) {
        if ((r + c) % 2 === 0 || r === 6 || c === 7) {
          this.pellets.add(`${r},${c}`)
        }
      }
    }
    this.mobList = [
      { x: 2, y: 2, dx: 1, dy: 0, color: '#EF4444' },
      { x: 13, y: 2, dx: -1, dy: 0, color: '#F472B6' },
      { x: 2, y: 10, dx: 0, dy: -1, color: '#22D3EE' },
      { x: 13, y: 10, dx: 0, dy: 1, color: '#F97316' },
    ]

    // Reset Tetris well
    this.well = Array.from({ length: 16 }, () => Array(10).fill(''))
    this.spawnTetromino()
  }

  private spawnTetromino() {
    const shapes: Array<{ shape: number[][]; color: string }> = [
      { shape: [[1, 1, 1, 1]], color: '#22D3EE' },
      {
        shape: [
          [1, 1],
          [1, 1],
        ],
        color: '#FACC15',
      },
      {
        shape: [
          [1, 1, 1],
          [0, 1, 0],
        ],
        color: '#A855F7',
      },
      {
        shape: [
          [1, 1, 0],
          [0, 1, 1],
        ],
        color: '#EF4444',
      },
      {
        shape: [
          [0, 1, 1],
          [1, 1, 0],
        ],
        color: '#22C55E',
      },
    ]
    const pick = shapes[Math.floor(Math.random() * shapes.length)]
    this.pieceShape = pick.shape
    this.pieceColor = pick.color
    this.pieceX = 3
    this.pieceY = 0
  }

  public loadLibraryCartridge(cartridgeId: string): NesCartridgeMeta {
    const found =
      NES_LIBRARY_CARTRIDGES.find((c) => c.id === cartridgeId) ??
      NES_LIBRARY_CARTRIDGES[0]
    this.initCartridgeState(found)
    this.ensureLoopRunning()
    this.playChiptuneBeep(587.33, 90, 'square')
    return found
  }

  public loadBinaryNesRom(romBinaryString: string, romFileName: string): boolean {
    try {
      const nes = new jsnes.NES({
        onFrame: (frameBuffer: ArrayLike<number>) => {
          for (let i = 0; i < 256 * 240; i++) {
            this.romBuf32[i] = 0xff000000 | frameBuffer[i]
          }
          this.offscreenRomCtx.putImageData(this.romImageData, 0, 0)
          this.ctx.drawImage(this.offscreenRomCanvas, 0, 0, 512, 480)
        },
        onAudioSample: () => undefined,
      })
      nes.loadROM(romBinaryString)
      this.nesCore = nes
      this.usingBinaryRom = true
      this.customRomName = romFileName
      this.ensureLoopRunning()
      this.playChiptuneBeep(880, 120, 'square')
      return true
    } catch (err) {
      console.warn('Failed to parse binary .nes ROM, falling back to built-in cartridge:', err)
      this.usingBinaryRom = false
      return false
    }
  }

  public setButtonState(btn: NesButtonId, pressed: boolean) {
    if (pressed) {
      this.heldButtons.add(btn)
    } else {
      this.heldButtons.delete(btn)
    }

    if (this.usingBinaryRom && this.nesCore) {
      const code = JSNES_BUTTON_MAP[btn]
      if (pressed) this.nesCore.buttonDown(1, code)
      else this.nesCore.buttonUp(1, code)
      return
    }

    if (pressed) {
      this.triggerDiscreteInput(btn)
    }
  }

  public tapButton(btn: NesButtonId) {
    this.setButtonState(btn, true)
    window.setTimeout(() => this.setButtonState(btn, false), 110)
  }

  private triggerDiscreteInput(btn: NesButtonId) {
    if (btn === 'start') {
      this.paused = !this.paused
      this.playChiptuneBeep(660, 80)
      return
    }
    if (btn === 'select') {
      // Cycle to next cartridge in library!
      const idx = NES_LIBRARY_CARTRIDGES.findIndex(
        (c) => c.id === this.activeCartridge.id,
      )
      const next =
        NES_LIBRARY_CARTRIDGES[(idx + 1) % NES_LIBRARY_CARTRIDGES.length]
      this.loadLibraryCartridge(next.id)
      return
    }

    const kind = this.activeCartridge.engineKind
    if (kind === 'platformer' || kind === 'shooter' || kind === 'racer') {
      if ((btn === 'a' || btn === 'up') && this.onGround) {
        this.heroVy = -245
        this.onGround = false
        this.playChiptuneBeep(440, 85, 'square')
      }
      if (btn === 'b') {
        this.fireballs.push({ x: this.heroX + 12, y: this.heroY - 10, vx: 210 })
        this.playChiptuneBeep(740, 55, 'sawtooth')
      }
    } else if (kind === 'maze' || kind === 'adventure') {
      if (btn === 'up') {
        this.gridY = Math.max(1, this.gridY - 1)
        this.dirX = 0
        this.dirY = -1
      } else if (btn === 'down') {
        this.gridY = Math.min(11, this.gridY + 1)
        this.dirX = 0
        this.dirY = 1
      } else if (btn === 'left') {
        this.gridX = Math.max(1, this.gridX - 1)
        this.dirX = -1
        this.dirY = 0
      } else if (btn === 'right') {
        this.gridX = Math.min(14, this.gridX + 1)
        this.dirX = 1
        this.dirY = 0
      } else if (btn === 'a' || btn === 'b') {
        this.swordTimer = 0.25
        this.playChiptuneBeep(520, 70, 'triangle')
        // Slash nearby monsters
        for (const m of this.mobList) {
          if (Math.hypot(m.x - this.gridX, m.y - this.gridY) <= 2.2) {
            this.score += 250
            m.x = 1
            m.y = 1
          }
        }
      }
      const key = `${this.gridY},${this.gridX}`
      if (this.pellets.has(key)) {
        this.pellets.delete(key)
        this.score += 50
        this.coins += 1
        this.playChiptuneBeep(680, 35, 'square')
        if (this.pellets.size === 0) {
          this.stage += 1
          this.score += 1000
          this.initCartridgeState(this.activeCartridge)
        }
      }
    } else if (kind === 'blocks') {
      if (btn === 'left') this.pieceX = Math.max(0, this.pieceX - 1)
      if (btn === 'right')
        this.pieceX = Math.min(10 - this.pieceShape[0].length, this.pieceX + 1)
      if (btn === 'down') this.stepTetrominoDown()
      if (btn === 'a' || btn === 'b' || btn === 'up') {
        // Rotate 90 deg clockwise
        const rows = this.pieceShape.length
        const cols = this.pieceShape[0].length
        const rotated: number[][] = Array.from({ length: cols }, () =>
          Array(rows).fill(0),
        )
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            rotated[c][rows - 1 - r] = this.pieceShape[r][c]
          }
        }
        if (this.pieceX + rotated[0].length <= 10) {
          this.pieceShape = rotated
          this.playChiptuneBeep(490, 40)
        }
      }
    }
  }

  private stepTetrominoDown() {
    const nextY = this.pieceY + 1
    let collision = false
    for (let r = 0; r < this.pieceShape.length; r++) {
      for (let c = 0; c < this.pieceShape[0].length; c++) {
        if (!this.pieceShape[r][c]) continue
        const wy = nextY + r
        const wx = this.pieceX + c
        if (wy >= 16 || this.well[wy]?.[wx]) {
          collision = true
        }
      }
    }
    if (!collision) {
      this.pieceY = nextY
    } else {
      for (let r = 0; r < this.pieceShape.length; r++) {
        for (let c = 0; c < this.pieceShape[0].length; c++) {
          if (this.pieceShape[r][c]) {
            const wy = this.pieceY + r
            const wx = this.pieceX + c
            if (wy >= 0 && wy < 16 && wx >= 0 && wx < 10) {
              this.well[wy][wx] = this.pieceColor
            }
          }
        }
      }
      // Clear full lines
      let cleared = 0
      this.well = this.well.filter((row) => {
        const full = row.every((cell) => cell !== '')
        if (full) cleared += 1
        return !full
      })
      while (this.well.length < 16) {
        this.well.unshift(Array(10).fill(''))
      }
      if (cleared > 0) {
        this.score += cleared * 300
        this.coins += cleared
        this.playChiptuneBeep(880, 120)
      } else {
        this.score += 25
      }
      if (this.pieceY <= 0) {
        this.well = Array.from({ length: 16 }, () => Array(10).fill(''))
      }
      this.spawnTetromino()
    }
  }

  private stepBuiltInFrame(dt: number) {
    const cart = this.activeCartridge
    const ctx = this.ctx

    // 1. Update logic if not paused
    if (!this.paused) {
      if (
        cart.engineKind === 'platformer' ||
        cart.engineKind === 'shooter' ||
        cart.engineKind === 'racer'
      ) {
        const moveSpeed = cart.engineKind === 'racer' ? 145 : 115
        if (this.heldButtons.has('left')) this.heroVx = -moveSpeed
        else if (this.heldButtons.has('right')) this.heroVx = moveSpeed
        else this.heroVx = cart.engineKind === 'racer' ? 75 : 0

        this.heroX = Math.max(24, Math.min(220, this.heroX + this.heroVx * dt))
        this.scrollX += (this.heroVx > 0 ? this.heroVx : 28) * dt

        this.heroVy += 540 * dt
        this.heroY += this.heroVy * dt
        if (this.heroY >= 172) {
          this.heroY = 172
          this.heroVy = 0
          this.onGround = true
        }

        // Check question block head-bonks
        for (const b of this.blocks) {
          if (
            !b.hit &&
            Math.abs(this.heroX - b.x) < 16 &&
            this.heroY - 24 <= b.y + 10 &&
            this.heroVy < 0
          ) {
            b.hit = true
            this.heroVy = 40
            this.coins += 1
            this.score += 200
            this.playChiptuneBeep(987.77, 80)
          }
        }

        // Update fireballs
        for (const fb of this.fireballs) {
          fb.x += fb.vx * dt
          for (const en of this.enemies) {
            if (en.alive && Math.abs(fb.x - en.x) < 14 && Math.abs(fb.y - en.y) < 18) {
              en.alive = false
              fb.x = 999
              this.score += 150
              this.playChiptuneBeep(620, 60)
            }
          }
        }
        this.fireballs = this.fireballs.filter((f) => f.x < 260)

        // Update enemies
        for (const en of this.enemies) {
          if (!en.alive) {
            if (Math.random() < 0.015) {
              en.alive = true
              en.x = 248
            }
            continue
          }
          en.x += en.vx * dt
          if (en.x < -10) en.x = 252

          if (Math.abs(en.x - this.heroX) < 13 && Math.abs(en.y - this.heroY) < 14) {
            if (this.heroVy > 20) {
              // Stomp!
              en.alive = false
              this.heroVy = -165
              this.score += 100
              this.playChiptuneBeep(784, 70)
            } else {
              this.heroX = 42
            }
          }
        }
      } else if (cart.engineKind === 'maze' || cart.engineKind === 'adventure') {
        if (this.swordTimer > 0) this.swordTimer = Math.max(0, this.swordTimer - dt)
        if (Math.random() < dt * 2.5) {
          for (const m of this.mobList) {
            m.x = Math.max(1, Math.min(14, m.x + (Math.random() > 0.5 ? 1 : -1)))
            m.y = Math.max(1, Math.min(11, m.y + (Math.random() > 0.5 ? 1 : -1)))
          }
        }
      } else if (cart.engineKind === 'blocks') {
        this.dropTimer += dt
        if (this.dropTimer >= 0.48) {
          this.dropTimer = 0
          this.stepTetrominoDown()
        }
      }

      if (this.score > this.hiScore) this.hiScore = this.score
    }

    // 2. Render 8-Bit NES Frame (scaled 2x on 512x480 canvas)
    ctx.save()
    ctx.scale(2, 2) // Draw in authentic 256x240 NES coordinates!

    // Sky / Backdrop
    ctx.fillStyle =
      cart.engineKind === 'platformer'
        ? '#5C94FC'
        : cart.engineKind === 'adventure'
          ? '#064E3B'
          : '#090D16'
    ctx.fillRect(0, 0, 256, 240)

    // Top 8-Bit NES Status Bar
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 256, 26)
    ctx.font = 'bold 8px monospace'
    ctx.fillStyle = '#FFFFFF'
    ctx.fillText(cart.title.slice(0, 18).toUpperCase(), 6, 10)
    ctx.fillStyle = '#FACC15'
    ctx.fillText(`SCORE:${this.score.toString().padStart(6, '0')}`, 6, 21)
    ctx.fillStyle = '#38BDF8'
    ctx.fillText(`COINS:${this.coins.toString().padStart(2, '0')}`, 96, 21)
    ctx.fillStyle = '#4ADE80'
    ctx.fillText(`WORLD ${this.stage}-1`, 152, 21)
    ctx.fillStyle = '#F43F5E'
    ctx.fillText(`♥x${this.lives}`, 218, 21)

    if (
      cart.engineKind === 'platformer' ||
      cart.engineKind === 'shooter' ||
      cart.engineKind === 'racer'
    ) {
      // Clouds & Hills
      ctx.fillStyle = '#FFFFFF'
      for (let i = 0; i < 4; i++) {
        const cx = ((i * 75 - Math.floor(this.scrollX * 0.25)) % 280 + 280) % 280 - 20
        ctx.fillRect(cx, 42 + (i % 2) * 14, 26, 10)
      }

      // Ground Bricks
      ctx.fillStyle = cart.engineKind === 'racer' ? '#334155' : '#C84C0C'
      ctx.fillRect(0, 184, 256, 56)
      ctx.fillStyle = '#22C55E'
      ctx.fillRect(0, 182, 256, 4)

      // Question Blocks
      for (const b of this.blocks) {
        ctx.fillStyle = b.hit ? '#78350F' : '#FACC15'
        ctx.fillRect(b.x - 8, b.y - 8, 16, 16)
        ctx.fillStyle = '#000000'
        ctx.fillText(b.hit ? '·' : '?', b.x - 3, b.y + 3)
      }

      // Green Warp Pipe
      const pipeX = ((220 - Math.floor(this.scrollX * 0.6)) % 260 + 260) % 260
      ctx.fillStyle = '#16A34A'
      ctx.fillRect(pipeX, 154, 22, 30)
      ctx.fillRect(pipeX - 2, 150, 26, 6)

      // Enemies (Goombas / Bots)
      for (const en of this.enemies) {
        if (!en.alive) continue
        ctx.fillStyle = '#9A3412'
        ctx.fillRect(en.x - 7, en.y - 12, 14, 12)
        ctx.fillStyle = '#FEF08A'
        ctx.fillRect(en.x - 4, en.y - 9, 2, 3)
        ctx.fillRect(en.x + 2, en.y - 9, 2, 3)
      }

      // Fireballs / Lasers
      ctx.fillStyle = '#FACC15'
      for (const fb of this.fireballs) {
        ctx.fillRect(fb.x - 3, fb.y - 3, 6, 4)
      }

      // 8-Bit Hero Sprite
      ctx.fillStyle = cart.accentColor
      ctx.fillRect(this.heroX - 7, this.heroY - 18, 14, 18)
      ctx.fillStyle = '#FDE68A'
      ctx.fillRect(this.heroX - 5, this.heroY - 16, 10, 6)
      ctx.fillStyle = '#1D4ED8'
      ctx.fillRect(this.heroX - 6, this.heroY - 8, 12, 8)
    } else if (cart.engineKind === 'maze' || cart.engineKind === 'adventure') {
      // Draw Overworld / Dungeon Grid
      for (let r = 1; r < 12; r++) {
        for (let c = 1; c < 15; c++) {
          const gx = c * 16
          const gy = 24 + r * 16
          if ((r + c) % 2 === 1 && r !== 6 && c !== 7) {
            ctx.fillStyle = cart.engineKind === 'adventure' ? '#14532D' : '#1E3A8A'
            ctx.fillRect(gx, gy, 14, 14)
          } else if (this.pellets.has(`${r},${c}`)) {
            ctx.fillStyle = '#FACC15'
            ctx.fillRect(gx + 5, gy + 5, 4, 4)
          }
        }
      }

      // Draw Hero
      const hx = this.gridX * 16 + 7
      const hy = 24 + this.gridY * 16 + 7
      ctx.fillStyle = cart.accentColor
      ctx.fillRect(hx - 6, hy - 6, 12, 12)

      // Sword beam if attacking
      if (this.swordTimer > 0) {
        ctx.fillStyle = '#FEF08A'
        ctx.fillRect(
          hx + this.dirX * 10 - 4,
          hy + this.dirY * 10 - 4,
          8,
          8,
        )
      }

      // Draw Mobs
      for (const m of this.mobList) {
        const mx = m.x * 16 + 7
        const my = 24 + m.y * 16 + 7
        ctx.fillStyle = m.color
        ctx.fillRect(mx - 6, my - 6, 12, 12)
      }
    } else if (cart.engineKind === 'blocks') {
      // Draw 10x16 Tetris Well
      const wellX = 78
      const wellY = 34
      ctx.strokeStyle = '#38BDF8'
      ctx.strokeRect(wellX - 2, wellY - 2, 104, 164)
      ctx.fillStyle = '#020617'
      ctx.fillRect(wellX, wellY, 100, 160)

      for (let r = 0; r < 16; r++) {
        for (let c = 0; c < 10; c++) {
          const color = this.well[r][c]
          if (color) {
            ctx.fillStyle = color
            ctx.fillRect(wellX + c * 10, wellY + r * 10, 9, 9)
          }
        }
      }

      // Active piece
      ctx.fillStyle = this.pieceColor
      for (let r = 0; r < this.pieceShape.length; r++) {
        for (let c = 0; c < this.pieceShape[0].length; c++) {
          if (this.pieceShape[r][c]) {
            ctx.fillRect(
              wellX + (this.pieceX + c) * 10,
              wellY + (this.pieceY + r) * 10,
              9,
              9,
            )
          }
        }
      }
    }

    // Bottom Controls Legend Strip
    ctx.fillStyle = 'rgba(0, 0, 0, 0.78)'
    ctx.fillRect(0, 224, 256, 16)
    ctx.fillStyle = '#E2E8F0'
    ctx.font = '7px monospace'
    ctx.fillText(
      'D-PAD:ARROWS  A:JUMP/ROT(X)  B:FIRE(Z)  SELECT:NEXT GAME',
      8,
      234,
    )

    ctx.restore()
  }

  public ensureLoopRunning() {
    if (this.rafId !== null) return
    this.lastTick = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - this.lastTick) / 1000)
      this.lastTick = now
      if (this.usingBinaryRom && this.nesCore) {
        try {
          this.nesCore.frame()
        } catch {
          this.usingBinaryRom = false
        }
      } else {
        this.stepBuiltInFrame(dt)
      }
      this.rafId = window.requestAnimationFrame(loop)
    }
    this.rafId = window.requestAnimationFrame(loop)
  }

  public getStream(): MediaStream {
    this.ensureLoopRunning()
    if (!this.mediaStream) {
      const capturable = this.canvas as HTMLCanvasElement & {
        captureStream?: (fps?: number) => MediaStream
      }
      if (typeof capturable.captureStream === 'function') {
        this.mediaStream = capturable.captureStream(60)
      } else {
        this.mediaStream = new MediaStream()
      }
    }
    return this.mediaStream
  }

  public getStateSummary() {
    return {
      cartridge: this.activeCartridge,
      usingBinaryRom: this.usingBinaryRom,
      customRomName: this.customRomName,
      score: this.score,
      hiScore: this.hiScore,
      coins: this.coins,
      stage: this.stage,
      soundEnabled: this.soundEnabled,
    }
  }

  public setSoundEnabled(enabled: boolean) {
    this.soundEnabled = enabled
  }
}

let sharedNesInstance: NesEmulatorSingleton | null = null

export function getNesEmulator(): NesEmulatorSingleton {
  if (!sharedNesInstance) {
    sharedNesInstance = new NesEmulatorSingleton()
  }
  return sharedNesInstance
}

export function isNesMediaUrl(url: string): boolean {
  return url.trim().toLowerCase().startsWith('nes://')
}

export function parseNesCartridgeIdFromUrl(url: string): string {
  const cleaned = url.trim().replace(/^nes:\/\//i, '').trim()
  return cleaned || NES_LIBRARY_CARTRIDGES[0].id
}
