import { PUTTING_STRIP_SPECS, scoreDartPolar } from '../constants/barGames'
import type { DartHitResult } from '../types/barGames'

export interface ActiveDartSim {
  pos: [number, number, number]
  vel: [number, number, number]
  settled: boolean
  hitBoard: boolean
  boardLocalPos: [number, number, number]
  hit: DartHitResult
}

const GRAVITY = -9.81

/**
 * Computes an exact ballistic launch velocity from `origin` so a dart reaches `targetWorld`
 * cleanly under gravity, given a comfortable throw speed (`8.5–13.5 m/s`).
 */
export function computeBallisticDartVelocity(
  origin: [number, number, number],
  targetWorld: [number, number, number],
  speedMultiplier = 1.0,
): [number, number, number] {
  const dx = targetWorld[0] - origin[0]
  const dy = targetWorld[1] - origin[1]
  const dz = targetWorld[2] - origin[2]
  const horizDist = Math.max(0.6, Math.hypot(dx, dz))
  const speed = Math.max(6.5, Math.min(15.5, 9.8 * speedMultiplier))
  const flightTime = horizDist / speed

  const vx = dx / flightTime
  const vz = dz / flightTime
  // Compensate vertical drop y = y0 + vy*t + 0.5*g*t^2 => vy = (dy - 0.5*g*t^2) / t
  const vy = (dy - 0.5 * GRAVITY * flightTime * flightTime) / flightTime
  return [
    Number(vx.toFixed(4)),
    Number(vy.toFixed(4)),
    Number(vz.toFixed(4)),
  ]
}

/**
 * Samples 3D points along the ballistic dart arc for VR controller / mouse aim preview.
 */
export function sampleDartTrajectoryArc(
  origin: [number, number, number],
  velocity: [number, number, number],
  boardFaceZ: number,
  segments = 18,
): Array<[number, number, number]> {
  const pts: Array<[number, number, number]> = []
  const vz = Math.max(0.5, velocity[2])
  const maxT = Math.min(0.65, Math.max(0.08, (boardFaceZ - origin[2]) / vz))
  for (let i = 0; i <= segments; i++) {
    const t = (i / segments) * maxT
    const drag = Math.max(0.88, 1 - 0.03 * t)
    const x = origin[0] + velocity[0] * t * drag
    const y = Math.max(0.05, origin[1] + velocity[1] * t + 0.5 * GRAVITY * t * t)
    const z = origin[2] + velocity[2] * t * drag
    pts.push([x, y, z])
  }
  return pts
}

/**
 * Sub-stepped Continuous Collision Detection (CCD) solver for 3D dart flight.
 * Uses analytical ray-plane intersection across 8 sub-steps per frame so fast throws
 * never tunnel through the bristle board.
 */
export function stepDartFlightCCD(
  sim: ActiveDartSim,
  dt: number,
  boardCenter: [number, number, number],
): void {
  if (sim.settled) return

  let remaining = Math.max(0, Math.min(dt, 1.25))
  const FIXED_STEP = 1 / 240
  // Bristle face sits 0.028m out from board group center toward -Z (into room)
  const boardFaceZ = boardCenter[2] - 0.028

  while (remaining > 1e-6) {
    const subDt = Math.min(remaining, FIXED_STEP)
    remaining -= subDt

    const [px, py, pz] = sim.pos
    let [vx, vy, vz] = sim.vel

    vy += GRAVITY * subDt
    const drag = Math.max(0, 1 - 0.035 * subDt)
    vx *= drag
    vz *= drag

    const nx = px + vx * subDt
    const ny = py + vy * subDt
    const nz = pz + vz * subDt

    // Swept CCD check: did segment [pz -> nz] cross boardFaceZ?
    if (pz <= boardFaceZ && nz >= boardFaceZ && vz > 0) {
      const denom = nz - pz
      const alpha = denom > 1e-6 ? Math.max(0, Math.min(1, (boardFaceZ - pz) / denom)) : 1
      const hitX = px + (nx - px) * alpha
      const hitY = py + (ny - py) * alpha
      const hitZ = boardFaceZ

      // Convert world impact into dartboard group local coordinates (rotated by Ry = PI)
      const localX = boardCenter[0] - hitX
      const localY = hitY - boardCenter[1]
      const hit = scoreDartPolar(localX, localY)

      sim.pos = [hitX, hitY, hitZ]
      sim.vel = [0, 0, 0]
      sim.settled = true
      sim.hitBoard = true
      sim.boardLocalPos = [
        Number(localX.toFixed(4)),
        Number(localY.toFixed(4)),
        0.032,
      ]
      sim.hit = hit
      return
    }

    // Floor or far-wall miss guard
    if (ny <= 0.03 || nz > boardCenter[2] + 0.35 || Math.abs(nx) > 12) {
      const clampedY = Math.max(0.03, ny)
      const localX = boardCenter[0] - nx
      const localY = clampedY - boardCenter[1]
      sim.pos = [nx, clampedY, Math.min(nz, boardFaceZ)]
      sim.vel = [0, 0, 0]
      sim.settled = true
      sim.hitBoard = false
      sim.boardLocalPos = [
        Number(localX.toFixed(4)),
        Number(localY.toFixed(4)),
        0.02,
      ]
      sim.hit = {
        points: 0,
        sector: 0,
        multiplier: 0,
        ring: 'miss',
        label: 'MISS',
        localX,
        localY,
      }
      return
    }

    sim.pos = [nx, ny, nz]
    sim.vel = [vx, vy, vz]
  }
}

// ============================================================================
// Mini-Golf Putting Strip Sub-Stepped CCD Solver
// ============================================================================

export interface ActivePuttSim {
  localPos: [number, number, number] // [x, y, z] in putting strip local space
  localVel: [number, number] // [vx, vz]
  settled: boolean
  holed: boolean
  lipOut: boolean
}

export function getPuttingSurfaceHeight(localZ: number, rampEnabled: boolean): {
  height: number
  slopeDz: number
} {
  if (!rampEnabled) {
    return { height: 0, slopeDz: 0 }
  }
  const { rampCenterZ, rampHalfLength, rampPeakHeight } = PUTTING_STRIP_SPECS
  const rel = localZ - rampCenterZ
  if (Math.abs(rel) >= rampHalfLength) {
    return { height: 0, slopeDz: 0 }
  }
  // Smooth raised cosine bridge profile: h(u) = 0.5 * peak * (1 + cos(pi * u))
  const u = rel / rampHalfLength
  const height = 0.5 * rampPeakHeight * (1 + Math.cos(Math.PI * u))
  const slopeDz =
    (-0.5 * rampPeakHeight * Math.PI * Math.sin(Math.PI * u)) / rampHalfLength
  return { height, slopeDz }
}

/**
 * Fixed-timestep (180Hz) sub-stepped CCD putting green physics with bumper reflection,
 * ramp incline gravity, Stimpmeter turf deceleration, and realistic cup capture vs. lip-out.
 */
export function stepPuttingBallCCD(
  sim: ActivePuttSim,
  dt: number,
  rampEnabled: boolean,
): void {
  if (sim.settled) return

  let remaining = Math.max(0, Math.min(dt, 1.25))
  const FIXED_STEP = 1 / 180

  const halfRailX = PUTTING_STRIP_SPECS.width / 2 - PUTTING_STRIP_SPECS.ballRadius - 0.035
  const minZ = -PUTTING_STRIP_SPECS.length / 2 + PUTTING_STRIP_SPECS.ballRadius + 0.05
  const maxZ = PUTTING_STRIP_SPECS.length / 2 - PUTTING_STRIP_SPECS.ballRadius - 0.05
  const cupZ = PUTTING_STRIP_SPECS.cupLocalZ
  const cupR = PUTTING_STRIP_SPECS.cupRadius

  while (remaining > 1e-6) {
    const subDt = Math.min(remaining, FIXED_STEP)
    remaining -= subDt

    let [x, , z] = sim.localPos
    let [vx, vz] = sim.localVel

    // Ramp slope longitudinal acceleration (a_z = -g * dh/dz)
    const { slopeDz } = getPuttingSurfaceHeight(z, rampEnabled)
    vz += -9.81 * slopeDz * 0.58 * subDt

    // Rolling turf deceleration
    const speed = Math.hypot(vx, vz)
    if (speed > 1e-5) {
      const decel = 0.76 * subDt
      const nextSpeed = Math.max(0, speed - decel)
      const scale = nextSpeed / speed
      vx *= scale
      vz *= scale
    }

    let nx = x + vx * subDt
    let nz = z + vz * subDt

    // Bumper rail continuous specular bounce
    if (nx < -halfRailX) {
      nx = -halfRailX + (-halfRailX - nx) * 0.72
      vx = Math.abs(vx) * 0.72
    } else if (nx > halfRailX) {
      nx = halfRailX - (nx - halfRailX) * 0.72
      vx = -Math.abs(vx) * 0.72
    }

    if (nz < minZ) {
      nz = minZ + (minZ - nz) * 0.65
      vz = Math.abs(vz) * 0.65
    } else if (nz > maxZ) {
      nz = maxZ - (nz - maxZ) * 0.65
      vz = -Math.abs(vz) * 0.65
    }

    // Swept closest-approach check to the cup at (0, cupZ)
    const segDx = nx - x
    const segDz = nz - z
    const segLenSq = segDx * segDx + segDz * segDz
    let tCup = 0
    if (segLenSq > 1e-9) {
      tCup = Math.max(0, Math.min(1, ((0 - x) * segDx + (cupZ - z) * segDz) / segLenSq))
    }
    const closestX = x + segDx * tCup
    const closestZ = z + segDz * tCup
    const distToCup = Math.hypot(closestX, closestZ - cupZ)
    const curSpeed = Math.hypot(vx, vz)

    if (distToCup <= cupR * 0.94) {
      if (curSpeed <= 2.15) {
        // Clean Hole-Out!
        sim.localPos = [0, -0.024, cupZ]
        sim.localVel = [0, 0]
        sim.holed = true
        sim.settled = true
        return
      } else {
        // Hit way too hard -> realistic lip-out deflection!
        sim.lipOut = true
        vx = (closestX >= 0 ? 0.42 : -0.42) + vx * 0.32
        vz *= 0.42
      }
    } else if (distToCup <= cupR * 1.14 && curSpeed > 0.35) {
      // Rim graze lip-out
      sim.lipOut = true
      vx += (closestX >= 0 ? 0.22 : -0.22)
      vz *= 0.78
    }

    const { height: nextSurfH } = getPuttingSurfaceHeight(nz, rampEnabled)
    const nextY = nextSurfH + PUTTING_STRIP_SPECS.ballRadius
    sim.localPos = [nx, nextY, nz]
    sim.localVel = [vx, vz]

    // Rest settle check (only settle when not perched on steep ramp face)
    if (Math.hypot(vx, vz) < 0.022 && Math.abs(slopeDz) < 0.03) {
      sim.localPos = [
        Number(nx.toFixed(4)),
        Number(nextY.toFixed(4)),
        Number(nz.toFixed(4)),
      ]
      sim.localVel = [0, 0]
      sim.settled = true
      return
    }
  }
}
