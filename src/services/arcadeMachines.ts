import * as THREE from 'three'

export type ClassicArcadeGameId = 'pac-maze' | 'galaxia' | 'frogger' | 'arkanoid'

export type ArcadeInputAction = 'up' | 'down' | 'left' | 'right' | 'action' | 'start'

export interface ArcadeCabinetEngine {
  id: ClassicArcadeGameId
  title: string
  subtitle: string
  accentColor: string
  canvas: HTMLCanvasElement
  texture: THREE.CanvasTexture
  getScore: () => number
  getHighScore: () => number
  isPlaying: () => boolean
  sendInput: (action: ArcadeInputAction) => void
  step: (dt: number) => void
}

const PAC_GRID_TEMPLATE = [
  '###############',
  '#o...........o#',
  '#.###.###.###.#',
  '#.............#',
  '#.###.#.#.###.#',
  '#.....#.#.....#',
  '#####.###.#####',
  '#.............#',
  '#####.#.#.#####',
  '#.....#.#.....#',
  '#.###.###.###.#',
  '#.............#',
  '#.###.###.###.#',
  '#o...........o#',
  '###############',
]

export function createArcadeCabinetEngine(
  id: ClassicArcadeGameId,
  onGameOverScore?: (score: number, label: string) => void,
): ArcadeCabinetEngine {
  const canvas = document.createElement('canvas')
  canvas.width = 320
  canvas.height = 240
  const ctx = canvas.getContext('2d')!
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace

  let score = 0
  let highScore = id === 'pac-maze' ? 1240 : id === 'galaxia' ? 1680 : id === 'frogger' ? 950 : 1120
  let playing = true
  let lives = 3
  let level = 1
  let flashTimer = 0

  const recordScoreIfHigh = (finalScore: number, label: string) => {
    if (finalScore > highScore) {
      highScore = finalScore
    }
    if (finalScore > 0 && onGameOverScore) {
      onGameOverScore(finalScore, label)
    }
  }

  // ==========================================================================
  // GAME 1: PAC-MAZE '84 (Classic Pac-Man Arcade)
  // ==========================================================================
  const pacGrid: string[][] = PAC_GRID_TEMPLATE.map((r) => r.split(''))
  let pacRow = 11
  let pacCol = 7
  let pacDir: [number, number] = [0, -1]
  let pacNextDir: [number, number] = [0, -1]
  let pacStepAccum = 0
  let frightenedTimer = 0
  let mouthPhase = 0

  interface Ghost {
    row: number
    col: number
    dr: number
    dc: number
    color: string
  }
  let ghosts: Ghost[] = [
    { row: 7, col: 6, dr: 0, dc: -1, color: '#EF4444' },
    { row: 7, col: 7, dr: -1, dc: 0, color: '#F472B6' },
    { row: 7, col: 8, dr: 0, dc: 1, color: '#22D3EE' },
    { row: 5, col: 7, dr: 1, dc: 0, color: '#F97316' },
  ]

  const resetPacMaze = (fullReset: boolean) => {
    if (fullReset) {
      score = 0
      lives = 3
      level = 1
    }
    for (let r = 0; r < 15; r++) {
      pacGrid[r] = PAC_GRID_TEMPLATE[r].split('')
    }
    pacRow = 11
    pacCol = 7
    pacDir = [0, -1]
    pacNextDir = [0, -1]
    frightenedTimer = 0
    ghosts = [
      { row: 7, col: 6, dr: 0, dc: -1, color: '#EF4444' },
      { row: 7, col: 7, dr: -1, dc: 0, color: '#F472B6' },
      { row: 7, col: 8, dr: 0, dc: 1, color: '#22D3EE' },
      { row: 5, col: 7, dr: 1, dc: 0, color: '#F97316' },
    ]
    playing = true
  }

  // ==========================================================================
  // GAME 2: GALAXIA '84 (Classic Space Invaders / Galaga)
  // ==========================================================================
  let shipX = 160
  let shipDir = 0
  interface Bullet {
    x: number
    y: number
    vy: number
    enemy: boolean
  }
  interface Alien {
    x: number
    y: number
    alive: boolean
    tier: number
  }
  let bullets: Bullet[] = []
  let aliens: Alien[] = []
  let alienFleetDir = 1
  let alienFireCooldown = 0.8

  const spawnGalaxiaWave = (resetAll: boolean) => {
    if (resetAll) {
      score = 0
      lives = 3
      level = 1
    }
    shipX = 160
    bullets = []
    aliens = []
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 8; c++) {
        aliens.push({
          x: 46 + c * 32,
          y: 44 + r * 22,
          alive: true,
          tier: r,
        })
      }
    }
    playing = true
  }
  if (id === 'galaxia') spawnGalaxiaWave(true)

  // ==========================================================================
  // GAME 3: FROGGER CROSSING (Classic Highway & River Hopper)
  // ==========================================================================
  let frogCol = 5
  let frogRow = 9 // 9 = bottom start, 5..8 = road, 4 = median, 1..3 = river, 0 = lilypads
  let lilypadsFilled = [false, false, false, false, false]
  interface LaneObstacle {
    x: number
    row: number
    width: number
    speed: number
    color: string
    isLog: boolean
  }
  const froggerObstacles: LaneObstacle[] = [
    { x: 20, row: 8, width: 34, speed: 55, color: '#EF4444', isLog: false },
    { x: 160, row: 8, width: 34, speed: 55, color: '#EF4444', isLog: false },
    { x: 80, row: 7, width: 44, speed: -68, color: '#F59E0B', isLog: false },
    { x: 230, row: 7, width: 44, speed: -68, color: '#F59E0B', isLog: false },
    { x: 40, row: 6, width: 32, speed: 82, color: '#38BDF8', isLog: false },
    { x: 190, row: 6, width: 32, speed: 82, color: '#38BDF8', isLog: false },
    { x: 110, row: 5, width: 52, speed: -50, color: '#EC4899', isLog: false },
    // River logs
    { x: 30, row: 3, width: 76, speed: 42, color: '#92400E', isLog: true },
    { x: 190, row: 3, width: 76, speed: 42, color: '#92400E', isLog: true },
    { x: 60, row: 2, width: 84, speed: -52, color: '#B45309', isLog: true },
    { x: 210, row: 2, width: 84, speed: -52, color: '#B45309', isLog: true },
    { x: 20, row: 1, width: 72, speed: 48, color: '#78350F', isLog: true },
    { x: 175, row: 1, width: 72, speed: 48, color: '#78350F', isLog: true },
  ]

  const resetFrogger = (full: boolean) => {
    if (full) {
      score = 0
      lives = 3
      lilypadsFilled = [false, false, false, false, false]
    }
    frogCol = 5
    frogRow = 9
    playing = true
  }

  // ==========================================================================
  // GAME 4: NEON ARKANOID (Classic Brick Breaker)
  // ==========================================================================
  let paddleX = 160
  let ballX = 160
  let ballY = 190
  let ballVx = 115
  let ballVy = -135
  interface Brick {
    x: number
    y: number
    alive: boolean
    color: string
    pts: number
  }
  let bricks: Brick[] = []

  const resetArkanoid = (full: boolean) => {
    if (full) {
      score = 0
      lives = 3
    }
    paddleX = 160
    ballX = 160
    ballY = 188
    ballVx = 115 * (Math.random() > 0.5 ? 1 : -1)
    ballVy = -135
    const rowColors = ['#EF4444', '#F97316', '#FACC15', '#10B981', '#38BDF8']
    bricks = []
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 8; c++) {
        bricks.push({
          x: 28 + c * 36,
          y: 44 + r * 16,
          alive: true,
          color: rowColors[r],
          pts: (5 - r) * 20,
        })
      }
    }
    playing = true
  }
  if (id === 'arkanoid') resetArkanoid(true)

  // ==========================================================================
  // UNIFIED INPUT HANDLER
  // ==========================================================================
  const sendInput = (action: ArcadeInputAction) => {
    if (action === 'start') {
      if (id === 'pac-maze') resetPacMaze(true)
      else if (id === 'galaxia') spawnGalaxiaWave(true)
      else if (id === 'frogger') resetFrogger(true)
      else resetArkanoid(true)
      return
    }

    if (id === 'pac-maze') {
      if (action === 'up') pacNextDir = [-1, 0]
      if (action === 'down') pacNextDir = [1, 0]
      if (action === 'left') pacNextDir = [0, -1]
      if (action === 'right') pacNextDir = [0, 1]
      if (action === 'action') {
        // Rotate direction clockwise for quick single-button play
        pacNextDir = [pacDir[1], -pacDir[0]]
      }
    } else if (id === 'galaxia') {
      if (action === 'left') {
        shipX = Math.max(24, shipX - 22)
        shipDir = -1
      }
      if (action === 'right') {
        shipX = Math.min(296, shipX + 22)
        shipDir = 1
      }
      if (action === 'action' || action === 'up') {
        bullets.push({ x: shipX - 6, y: 204, vy: -240, enemy: false })
        bullets.push({ x: shipX + 6, y: 204, vy: -240, enemy: false })
      }
    } else if (id === 'frogger') {
      if (action === 'up' || action === 'action') frogRow = Math.max(0, frogRow - 1)
      if (action === 'down') frogRow = Math.min(9, frogRow + 1)
      if (action === 'left') frogCol = Math.max(0, frogCol - 1)
      if (action === 'right') frogCol = Math.min(9, frogCol + 1)

      if (frogRow === 0) {
        const bayIdx = Math.min(4, Math.floor(frogCol / 2))
        lilypadsFilled[bayIdx] = true
        score += 150
        recordScoreIfHigh(score, 'Frogger Crossing')
        if (lilypadsFilled.every(Boolean)) {
          score += 500
          lilypadsFilled = [false, false, false, false, false]
        }
        frogRow = 9
        frogCol = 5
      } else if (action === 'up' || action === 'action') {
        score += 15
      }
    } else if (id === 'arkanoid') {
      if (action === 'left') paddleX = Math.max(38, paddleX - 28)
      if (action === 'right') paddleX = Math.min(282, paddleX + 28)
      if (action === 'action' || action === 'up') {
        // Nudge ball speed & add bonus points
        ballVy = -Math.abs(ballVy)
      }
    }
  }

  // ==========================================================================
  // 60FPS STEP & RENDER LOOP
  // ==========================================================================
  const step = (dt: number) => {
    const clampedDt = Math.min(0.05, dt)
    flashTimer += clampedDt
    mouthPhase += clampedDt * 12

    // Background CRT screen clear
    ctx.fillStyle = '#050814'
    ctx.fillRect(0, 0, 320, 240)

    // Top Arcade HUD Bar
    ctx.fillStyle = '#0F172A'
    ctx.fillRect(0, 0, 320, 24)
    ctx.font = 'bold 11px monospace'
    ctx.fillStyle = '#FACC15'
    ctx.fillText(`SCORE ${score.toString().padStart(5, '0')}`, 8, 16)
    ctx.fillStyle = '#38BDF8'
    ctx.fillText(`HI ${highScore.toString().padStart(5, '0')}`, 124, 16)
    ctx.fillStyle = '#F43F5E'
    ctx.fillText(`♥x${lives} L${level}`, 248, 16)

    if (id === 'pac-maze') {
      if (frightenedTimer > 0) frightenedTimer = Math.max(0, frightenedTimer - clampedDt)
      pacStepAccum += clampedDt
      if (pacStepAccum >= 0.18) {
        pacStepAccum = 0
        const tryR = pacRow + pacNextDir[0]
        const tryC = pacCol + pacNextDir[1]
        if (pacGrid[tryR]?.[tryC] && pacGrid[tryR][tryC] !== '#') {
          pacDir = pacNextDir
        }
        const nr = pacRow + pacDir[0]
        const nc = pacCol + pacDir[1]
        if (pacGrid[nr]?.[nc] && pacGrid[nr][nc] !== '#') {
          pacRow = nr
          pacCol = nc
        }
        const cell = pacGrid[pacRow]?.[pacCol]
        if (cell === '.') {
          pacGrid[pacRow][pacCol] = ' '
          score += 10
        } else if (cell === 'o') {
          pacGrid[pacRow][pacCol] = ' '
          score += 50
          frightenedTimer = 6.0
        }

        // Check if all pellets cleared
        const anyLeft = pacGrid.some((row) => row.some((c) => c === '.' || c === 'o'))
        if (!anyLeft) {
          level += 1
          score += 300
          recordScoreIfHigh(score, "Pac-Maze '84")
          resetPacMaze(false)
        }

        // Move ghosts
        for (const g of ghosts) {
          const dirs: Array<[number, number]> = [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]
          const valid = dirs.filter(([dr, dc]) => {
            const gr = g.row + dr
            const gc = g.col + dc
            return pacGrid[gr]?.[gc] && pacGrid[gr][gc] !== '#'
          })
          if (valid.length > 0) {
            const forward = valid.find(([dr, dc]) => dr === g.dr && dc === g.dc)
            const pick =
              forward && Math.random() < 0.65
                ? forward
                : valid[Math.floor(Math.random() * valid.length)]
            g.dr = pick[0]
            g.dc = pick[1]
            g.row += g.dr
            g.col += g.dc
          }

          if (g.row === pacRow && g.col === pacCol) {
            if (frightenedTimer > 0) {
              score += 200
              g.row = 7
              g.col = 7
              recordScoreIfHigh(score, "Pac-Maze '84")
            } else {
              lives -= 1
              if (lives <= 0) {
                recordScoreIfHigh(score, "Pac-Maze '84")
                resetPacMaze(true)
              } else {
                pacRow = 11
                pacCol = 7
              }
            }
          }
        }
      }

      // Draw Maze
      const cellW = 14
      const cellH = 13.5
      const offX = 55
      const offY = 30
      for (let r = 0; r < 15; r++) {
        for (let c = 0; c < 15; c++) {
          const ch = pacGrid[r][c]
          const cx = offX + c * cellW
          const cy = offY + r * cellH
          if (ch === '#') {
            ctx.fillStyle = '#1D4ED8'
            ctx.fillRect(cx + 1, cy + 1, cellW - 2, cellH - 2)
          } else if (ch === '.') {
            ctx.fillStyle = '#FDE68A'
            ctx.fillRect(cx + 5, cy + 5, 3, 3)
          } else if (ch === 'o') {
            ctx.fillStyle = Math.sin(flashTimer * 8) > 0 ? '#FACC15' : '#FB923C'
            ctx.beginPath()
            ctx.arc(cx + cellW / 2, cy + cellH / 2, 4.2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      // Draw Pac-Hero
      const px = offX + pacCol * cellW + cellW / 2
      const py = offY + pacRow * cellH + cellH / 2
      const mouthAngle = 0.15 + Math.abs(Math.sin(mouthPhase)) * 0.28
      const baseAngle =
        pacDir[1] === 1
          ? 0
          : pacDir[1] === -1
            ? Math.PI
            : pacDir[0] === -1
              ? -Math.PI / 2
              : Math.PI / 2
      ctx.fillStyle = '#FACC15'
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.arc(px, py, 6, baseAngle + mouthAngle, baseAngle + Math.PI * 2 - mouthAngle)
      ctx.closePath()
      ctx.fill()

      // Draw Ghosts
      for (const g of ghosts) {
        const gx = offX + g.col * cellW + cellW / 2
        const gy = offY + g.row * cellH + cellH / 2
        ctx.fillStyle = frightenedTimer > 0 ? '#3B82F6' : g.color
        ctx.beginPath()
        ctx.arc(gx, gy - 1, 5.5, Math.PI, 0)
        ctx.lineTo(gx + 5.5, gy + 5)
        ctx.lineTo(gx - 5.5, gy + 5)
        ctx.closePath()
        ctx.fill()
        ctx.fillStyle = '#FFFFFF'
        ctx.fillRect(gx - 3, gy - 3, 2, 2)
        ctx.fillRect(gx + 1, gy - 3, 2, 2)
      }
    } else if (id === 'galaxia') {
      // Move alien formation
      let hitEdge = false
      for (const a of aliens) {
        if (!a.alive) continue
        a.x += alienFleetDir * (28 + level * 6) * clampedDt
        if (a.x > 296 || a.x < 24) hitEdge = true
      }
      if (hitEdge) {
        alienFleetDir *= -1
        for (const a of aliens) {
          if (a.alive) a.y += 8
        }
      }

      alienFireCooldown -= clampedDt
      if (alienFireCooldown <= 0) {
        alienFireCooldown = Math.max(0.35, 1.1 - level * 0.1)
        const living = aliens.filter((a) => a.alive)
        if (living.length > 0) {
          const shooter = living[Math.floor(Math.random() * living.length)]
          bullets.push({ x: shooter.x, y: shooter.y + 8, vy: 115, enemy: true })
        }
      }

      // Auto-fire periodic laser so cabinet looks alive and responsive
      if (Math.floor((flashTimer - clampedDt) * 2.5) !== Math.floor(flashTimer * 2.5)) {
        bullets.push({ x: shipX, y: 204, vy: -230, enemy: false })
      }
      shipX = Math.max(24, Math.min(296, shipX + shipDir * 18 * clampedDt))

      // Update bullets
      for (const b of bullets) {
        b.y += b.vy * clampedDt
        if (!b.enemy) {
          for (const a of aliens) {
            if (a.alive && Math.abs(b.x - a.x) < 11 && Math.abs(b.y - a.y) < 9) {
              a.alive = false
              b.y = -999
              score += (4 - a.tier) * 25
              recordScoreIfHigh(score, "Galaxia '84")
            }
          }
        } else if (Math.abs(b.x - shipX) < 12 && Math.abs(b.y - 212) < 10) {
          b.y = 999
          lives -= 1
          if (lives <= 0) {
            recordScoreIfHigh(score, "Galaxia '84")
            spawnGalaxiaWave(true)
          }
        }
      }
      bullets = bullets.filter((b) => b.y > 24 && b.y < 236)

      if (aliens.every((a) => !a.alive)) {
        level += 1
        score += 400
        recordScoreIfHigh(score, "Galaxia '84")
        spawnGalaxiaWave(false)
      }

      // Draw Aliens
      const tierColors = ['#F43F5E', '#A855F7', '#22D3EE', '#10B981']
      for (const a of aliens) {
        if (!a.alive) continue
        ctx.fillStyle = tierColors[a.tier % tierColors.length]
        ctx.fillRect(a.x - 9, a.y - 6, 18, 11)
        ctx.fillStyle = '#F8FAFC'
        ctx.fillRect(a.x - 5, a.y - 3, 3, 3)
        ctx.fillRect(a.x + 2, a.y - 3, 3, 3)
      }

      // Draw Starfighter
      ctx.fillStyle = '#38BDF8'
      ctx.beginPath()
      ctx.moveTo(shipX, 200)
      ctx.lineTo(shipX + 12, 220)
      ctx.lineTo(shipX - 12, 220)
      ctx.closePath()
      ctx.fill()

      // Draw Bullets
      for (const b of bullets) {
        ctx.fillStyle = b.enemy ? '#FB7185' : '#FACC15'
        ctx.fillRect(b.x - 1.5, b.y - 4, 3, 8)
      }
    } else if (id === 'frogger') {
      // Draw Zones
      ctx.fillStyle = '#064E3B'
      ctx.fillRect(0, 26, 320, 22) // Top lilypad bank
      ctx.fillStyle = '#0C4A6E'
      ctx.fillRect(0, 48, 320, 66) // River
      ctx.fillStyle = '#3F3F46'
      ctx.fillRect(0, 114, 320, 22) // Safe Median
      ctx.fillStyle = '#18181B'
      ctx.fillRect(0, 136, 320, 78) // Highway
      ctx.fillStyle = '#14532D'
      ctx.fillRect(0, 214, 320, 26) // Start bank

      // Draw Lilypad Bays
      for (let i = 0; i < 5; i++) {
        const bx = 32 + i * 62
        ctx.fillStyle = lilypadsFilled[i] ? '#22C55E' : '#1E293B'
        ctx.beginPath()
        ctx.arc(bx, 37, 9, 0, Math.PI * 2)
        ctx.fill()
      }

      const frogX = 16 + frogCol * 30
      const frogY = 30 + frogRow * 20

      // Update & draw obstacles
      let onSafeLog = false
      for (const ob of froggerObstacles) {
        ob.x += ob.speed * clampedDt
        if (ob.speed > 0 && ob.x > 330) ob.x = -ob.width
        if (ob.speed < 0 && ob.x + ob.width < -10) ob.x = 330

        const oy = 30 + ob.row * 20
        ctx.fillStyle = ob.color
        ctx.fillRect(ob.x, oy - 7, ob.width, 14)

        if (ob.row === frogRow) {
          const overlap = frogX + 6 > ob.x && frogX - 6 < ob.x + ob.width
          if (ob.isLog && overlap) {
            onSafeLog = true
          } else if (!ob.isLog && overlap) {
            lives -= 1
            if (lives <= 0) {
              recordScoreIfHigh(score, 'Frogger Crossing')
              resetFrogger(true)
            } else {
              frogRow = 9
              frogCol = 5
            }
          }
        }
      }

      if (frogRow >= 1 && frogRow <= 3 && !onSafeLog) {
        lives -= 1
        if (lives <= 0) {
          recordScoreIfHigh(score, 'Frogger Crossing')
          resetFrogger(true)
        } else {
          frogRow = 9
          frogCol = 5
        }
      }

      // Draw Frog
      ctx.fillStyle = '#4ADE80'
      ctx.beginPath()
      ctx.arc(frogX, frogY, 7.5, 0, Math.PI * 2)
      ctx.fill()
    } else if (id === 'arkanoid') {
      // Step ball
      ballX += ballVx * clampedDt
      ballY += ballVy * clampedDt
      if (ballX < 12 || ballX > 308) ballVx *= -1
      if (ballY < 30) ballVy = Math.abs(ballVy)

      // Paddle bounce
      if (ballY >= 206 && ballY <= 218 && Math.abs(ballX - paddleX) <= 34) {
        ballVy = -Math.abs(ballVy)
        ballVx = (ballX - paddleX) * 4.5
      }

      if (ballY > 235) {
        lives -= 1
        if (lives <= 0) {
          recordScoreIfHigh(score, 'Neon Arkanoid')
          resetArkanoid(true)
        } else {
          ballX = paddleX
          ballY = 190
          ballVy = -135
        }
      }

      for (const br of bricks) {
        if (!br.alive) continue
        if (Math.abs(ballX - br.x) < 17 && Math.abs(ballY - br.y) < 7) {
          br.alive = false
          ballVy *= -1
          score += br.pts
          recordScoreIfHigh(score, 'Neon Arkanoid')
          break
        }
      }

      if (bricks.every((b) => !b.alive)) {
        level += 1
        score += 350
        resetArkanoid(false)
      }

      // Draw Bricks
      for (const br of bricks) {
        if (!br.alive) continue
        ctx.fillStyle = br.color
        ctx.fillRect(br.x - 16, br.y - 5, 32, 10)
      }

      // Draw Paddle
      ctx.fillStyle = '#22D3EE'
      ctx.fillRect(paddleX - 30, 210, 60, 8)

      // Draw Ball
      ctx.fillStyle = '#FACC15'
      ctx.beginPath()
      ctx.arc(ballX, ballY, 5, 0, Math.PI * 2)
      ctx.fill()
    }

    texture.needsUpdate = true
  }

  const meta: Record<
    ClassicArcadeGameId,
    { title: string; subtitle: string; accentColor: string }
  > = {
    'pac-maze': {
      title: "PAC-MAZE '84",
      subtitle: 'CHOMP PELLETS & DODGE GHOSTS',
      accentColor: '#FACC15',
    },
    galaxia: {
      title: "GALAXIA '84",
      subtitle: 'STARFIGHTER ALIEN FLEET ASSAULT',
      accentColor: '#EC4899',
    },
    frogger: {
      title: 'FROGGER CROSSING',
      subtitle: 'HIGHWAY & RIVER LOG HOPPER',
      accentColor: '#22C55E',
    },
    arkanoid: {
      title: 'NEON ARKANOID',
      subtitle: 'CYBER PADDLE BRICK BREAKER',
      accentColor: '#38BDF8',
    },
  }

  return {
    id,
    title: meta[id].title,
    subtitle: meta[id].subtitle,
    accentColor: meta[id].accentColor,
    canvas,
    texture,
    getScore: () => score,
    getHighScore: () => highScore,
    isPlaying: () => playing,
    sendInput,
    step,
  }
}
