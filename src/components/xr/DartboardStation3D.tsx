import { Line, RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  CRICKET_TARGETS,
  DARTBOARD_RADII,
  DARTBOARD_SECTORS,
  formatCricketMarkSymbol,
  scoreDartPolar,
} from '../../constants/barGames'
import {
  computeBallisticDartVelocity,
  sampleDartTrajectoryArc,
  stepDartFlightCCD,
  type ActiveDartSim,
} from '../../services/barGamesPhysics'
import { playSpatialUiFeedback } from '../../services/soundboardAudio'
import {
  isSpatialUiHovered,
  readXRSpaceWorldPose,
  setSpatialUiHovered,
  triggerXRHapticPulse,
} from '../../services/xrTracking'
import type {
  ClubhousePersistentState,
  DartGameMode,
  DartShotSettlePacket,
  DartsMatchState,
  LiveDartShotPacket,
} from '../../types/barGames'

export interface DartboardStation3DProps {
  localUserId: string
  localSeatId: string | undefined
  dartboardCenter: [number, number, number]
  scoreboardCenter: [number, number, number]
  ocheFloorPos: [number, number, number]
  accentColor: string
  buildMode: boolean
  dartsState: DartsMatchState
  clubhouseState: ClubhousePersistentState
  activeDartShot: LiveDartShotPacket | null
  onSelectSeat: (seatId: string) => void
  onLaunchDartShot: (
    origin: [number, number, number],
    velocity: [number, number, number],
    boardCenter: [number, number, number],
  ) => void
  onSettleDartShot: (packet: DartShotSettlePacket) => void
  onJoinDarts: () => void
  onConfigureDarts: (patch: { mode?: DartGameMode; doubleOut?: boolean }) => void
  onResetDarts: () => void
}

/**
 * Generates a crisp regulation 20-sector bristle dartboard texture aligned 1:1 with `scoreDartPolar`.
 */
function createDartboardTexture(): THREE.CanvasTexture {
  const size = 1024
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const cx = size / 2
  const cy = size / 2
  // Map surroundOuter (0.285m) to canvas radius 496px
  const pxPerMeter = 496 / DARTBOARD_RADII.surroundOuter

  ctx.clearRect(0, 0, size, size)

  // Matte black surround ring
  ctx.beginPath()
  ctx.arc(cx, cy, DARTBOARD_RADII.surroundOuter * pxPerMeter, 0, Math.PI * 2)
  ctx.fillStyle = '#10131A'
  ctx.fill()

  ctx.lineWidth = 4
  ctx.strokeStyle = '#D97706'
  ctx.stroke()

  const rDoubleOut = DARTBOARD_RADII.doubleOuter * pxPerMeter
  const rDoubleIn = DARTBOARD_RADII.doubleInner * pxPerMeter
  const rTripleOut = DARTBOARD_RADII.tripleOuter * pxPerMeter
  const rTripleIn = DARTBOARD_RADII.tripleInner * pxPerMeter
  const rOuterBull = DARTBOARD_RADII.outerBull * pxPerMeter
  const rInnerBull = DARTBOARD_RADII.innerBull * pxPerMeter

  // Draw 20 sectors clockwise starting at 12 o'clock (sector 20)
  const sectorStep = (Math.PI * 2) / 20
  for (let i = 0; i < 20; i++) {
    // In canvas coords (0 rad = +X = 3 o'clock, +pi/2 = +Y = 6 o'clock, -pi/2 = 12 o'clock):
    // Clockwise angle from 12 o'clock `theta` maps to canvas angle `theta - pi/2`.
    const a0 = -Math.PI / 2 - sectorStep / 2 + i * sectorStep
    const a1 = a0 + sectorStep
    const isEven = i % 2 === 0
    const singleFill = isEven ? '#14171F' : '#F3EBD8'
    const ringFill = isEven ? '#DC2626' : '#15803D'

    // Outer & inner single bed
    ctx.beginPath()
    ctx.moveTo(cx, cy)
    ctx.arc(cx, cy, rDoubleOut, a0, a1)
    ctx.closePath()
    ctx.fillStyle = singleFill
    ctx.fill()

    // Double ring
    ctx.beginPath()
    ctx.arc(cx, cy, rDoubleOut, a0, a1)
    ctx.arc(cx, cy, rDoubleIn, a1, a0, true)
    ctx.closePath()
    ctx.fillStyle = ringFill
    ctx.fill()

    // Triple ring
    ctx.beginPath()
    ctx.arc(cx, cy, rTripleOut, a0, a1)
    ctx.arc(cx, cy, rTripleIn, a1, a0, true)
    ctx.closePath()
    ctx.fillStyle = ringFill
    ctx.fill()
  }

  // Outer Bull (25 - green)
  ctx.beginPath()
  ctx.arc(cx, cy, rOuterBull, 0, Math.PI * 2)
  ctx.fillStyle = '#15803D'
  ctx.fill()

  // Inner Bullseye (50 - crimson)
  ctx.beginPath()
  ctx.arc(cx, cy, rInnerBull, 0, Math.PI * 2)
  ctx.fillStyle = '#DC2626'
  ctx.fill()

  // Spider wire dividers & concentric rings
  ctx.strokeStyle = '#CBD5E1'
  ctx.lineWidth = 2.2
  for (const r of [rDoubleOut, rDoubleIn, rTripleOut, rTripleIn, rOuterBull, rInnerBull]) {
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.stroke()
  }

  for (let i = 0; i < 20; i++) {
    const a = -Math.PI / 2 - sectorStep / 2 + i * sectorStep
    ctx.beginPath()
    ctx.moveTo(cx + Math.cos(a) * rOuterBull, cy + Math.sin(a) * rOuterBull)
    ctx.lineTo(cx + Math.cos(a) * rDoubleOut, cy + Math.sin(a) * rDoubleOut)
    ctx.stroke()
  }

  // Crisp metallic sector numbers around surround ring
  const numRadius = ((DARTBOARD_RADII.doubleOuter + DARTBOARD_RADII.surroundOuter) * 0.5) * pxPerMeter
  ctx.fillStyle = '#F8FAFC'
  ctx.font = 'bold 42px Inter, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = 0; i < 20; i++) {
    const midAngle = -Math.PI / 2 + i * sectorStep
    const nx = cx + Math.cos(midAngle) * numRadius
    const ny = cy + Math.sin(midAngle) * numRadius
    ctx.fillText(String(DARTBOARD_SECTORS[i]), nx, ny)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

let cachedDartboardTex: THREE.CanvasTexture | null = null
function getDartboardTexture(): THREE.CanvasTexture {
  if (!cachedDartboardTex && typeof document !== 'undefined') {
    cachedDartboardTex = createDartboardTexture()
  }
  return cachedDartboardTex!
}

function DartModel3D({ color }: { color: string }) {
  return (
    <group>
      {/* Steel needle tip pointing along +Z (in flight) or -Z (into board) */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.032]}>
        <coneGeometry args={[0.0028, 0.042, 8]} />
        <meshStandardMaterial color="#E2E8F0" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Knurled tungsten/brass barrel */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.008]}>
        <cylinderGeometry args={[0.0058, 0.0048, 0.052, 10]} />
        <meshStandardMaterial color="#E5A93C" metalness={0.72} roughness={0.28} />
      </mesh>
      {/* Colored shaft */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.052]}>
        <cylinderGeometry args={[0.0034, 0.0042, 0.045, 8]} />
        <meshStandardMaterial color={color} roughness={0.45} />
      </mesh>
      {/* Crossed aerodynamic tail flights */}
      <mesh position={[0, 0, -0.088]}>
        <boxGeometry args={[0.038, 0.0018, 0.042]} />
        <meshBasicMaterial color={color} />
      </mesh>
      <mesh position={[0, 0, -0.088]}>
        <boxGeometry args={[0.0018, 0.038, 0.042]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  )
}

interface ScoreButton3DProps {
  label: string
  position: [number, number, number]
  width?: number
  height?: number
  active?: boolean
  accentColor?: string
  onClick: () => void
}

function ScoreButton3D({
  label,
  position,
  width = 0.22,
  height = 0.072,
  active = false,
  accentColor = '#E5A93C',
  onClick,
}: ScoreButton3DProps) {
  const [hovered, setHovered] = useState(false)
  const hoverId = `darts-btn-${label}`

  useEffect(() => {
    return () => setSpatialUiHovered(false, hoverId)
  }, [hoverId])

  return (
    <group
      position={position}
      pointerEventsType={{ deny: 'grab' }}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
        setSpatialUiHovered(true, hoverId)
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        setSpatialUiHovered(false, hoverId)
      }}
      onClick={(e) => {
        e.stopPropagation()
        playSpatialUiFeedback('ui-click')
        onClick()
      }}
    >
      <RoundedBox args={[width, height, 0.016]} radius={0.015} smoothness={2}>
        <meshBasicMaterial
          color={active ? accentColor : hovered ? '#273449' : '#182130'}
        />
      </RoundedBox>
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.011]}
          fontSize={0.026}
          color={active ? '#0B0D10' : '#F4F1EA'}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Suspense>
    </group>
  )
}

export function DartboardStation3D({
  localUserId,
  localSeatId,
  dartboardCenter,
  scoreboardCenter,
  ocheFloorPos,
  accentColor,
  buildMode,
  dartsState,
  clubhouseState,
  activeDartShot,
  onSelectSeat,
  onLaunchDartShot,
  onSettleDartShot,
  onJoinDarts,
  onConfigureDarts,
  onResetDarts,
}: DartboardStation3DProps) {
  const { gl, camera } = useThree()
  const xrSession = useXR((s) => s.session)
  const xrOrigin = useXR((s) => s.origin)
  const xrOriginRefSpace = useXR((s) => s.originReferenceSpace)
  const boardTexture = useMemo(() => getDartboardTexture(), [])

  const [aimBoardLocal, setAimBoardLocal] = useState<[number, number] | null>(null)
  const [pointerDragging, setPointerDragging] = useState(false)
  const [vrTriggerAimArc, setVrTriggerAimArc] = useState<Array<[number, number, number]> | null>(
    null,
  )
  const [ocheHovered, setOcheHovered] = useState(false)

  const dragStartWorldRef = useRef<[number, number, number] | null>(null)
  const flyingDartRef = useRef<THREE.Group>(null)
  const simRef = useRef<ActiveDartSim | null>(null)
  const activeShotIdRef = useRef<string | null>(null)
  const settledShotIdRef = useRef<string | null>(null)

  // VR controller trigger throw tracking
  const vrTriggerWasPressedRef = useRef(false)
  const vrHandHistoryRef = useRef<Array<{ pos: THREE.Vector3; t: number }>>([])
  const vrLastAimVelRef = useRef<[number, number, number] | null>(null)
  const vrLastOriginRef = useRef<[number, number, number] | null>(null)
  const lastAimArcUpdateRef = useRef<number>(0)
  const lastVrTriggerThrowAtRef = useRef<number>(0)

  const tmpDir = useMemo(() => new THREE.Vector3(), [])
  const tmpQuat = useMemo(() => new THREE.Quaternion(), [])
  const forwardAxis = useMemo(() => new THREE.Vector3(0, 0, 1), [])
  const scratchHeadWorld = useMemo(() => new THREE.Vector3(), [])
  const scratchOriginVec = useMemo(() => new THREE.Vector3(), [])
  const scratchRotQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchRayForward = useMemo(() => new THREE.Vector3(), [])

  const throwOriginWorld: [number, number, number] = useMemo(
    () => [ocheFloorPos[0], ocheFloorPos[1] + 1.5, ocheFloorPos[2]],
    [ocheFloorPos],
  )

  // Initialize deterministic CCD simulation whenever a new dart-launch packet arrives
  useEffect(() => {
    if (!activeDartShot) {
      simRef.current = null
      activeShotIdRef.current = null
      return
    }
    if (activeShotIdRef.current === activeDartShot.shotId) return
    activeShotIdRef.current = activeDartShot.shotId
    simRef.current = {
      pos: [...activeDartShot.origin],
      vel: [...activeDartShot.velocity],
      settled: false,
      hitBoard: false,
      boardLocalPos: [0, 0, 0.032],
      hit: {
        points: 0,
        sector: 0,
        multiplier: 0,
        ring: 'miss',
        label: 'MISS',
        localX: 0,
        localY: 0,
      },
    }
  }, [activeDartShot])

  // Step flying dart CCD & VR controller trigger-release throwing at 72Hz/90Hz
  useFrame((_, delta) => {
    // 1. Flying dart CCD physics step
    const sim = simRef.current
    if (sim && activeDartShot && !sim.settled) {
      stepDartFlightCCD(sim, delta, activeDartShot.boardCenter)
      if (flyingDartRef.current) {
        flyingDartRef.current.visible = true
        flyingDartRef.current.position.set(sim.pos[0], sim.pos[1], sim.pos[2])
        if (Math.hypot(sim.vel[0], sim.vel[1], sim.vel[2]) > 0.1) {
          tmpDir.set(sim.vel[0], sim.vel[1], sim.vel[2]).normalize()
          tmpQuat.setFromUnitVectors(forwardAxis, tmpDir)
          flyingDartRef.current.quaternion.copy(tmpQuat)
        }
      }

      if (sim.settled && activeDartShot.shooterId === localUserId) {
        if (settledShotIdRef.current !== activeDartShot.shotId) {
          settledShotIdRef.current = activeDartShot.shotId
          playSpatialUiFeedback('dart-hit')
          onSettleDartShot({
            shotId: activeDartShot.shotId,
            shooterId: activeDartShot.shooterId,
            shooterName: activeDartShot.shooterName,
            color: activeDartShot.color,
            boardLocalPos: sim.boardLocalPos,
            hit: sim.hit,
            timestamp: Date.now(),
          })
        }
      }
    } else if (flyingDartRef.current) {
      flyingDartRef.current.visible = false
    }

    // 2. World-space VR Controller Trigger-Hold & Release Throw at Oche or Free-Roam Throw Zone
    if (!xrSession || buildMode || activeDartShot || isSpatialUiHovered()) {
      if (vrTriggerWasPressedRef.current) {
        vrTriggerWasPressedRef.current = false
        setVrTriggerAimArc(null)
      }
      return
    }

    const xrFrame = gl.xr.getFrame?.()
    const refSpace = xrOriginRefSpace ?? gl.xr.getReferenceSpace?.()
    if (!xrFrame || !refSpace) return

    let chosenSource: XRInputSource | null = null
    for (const src of xrSession.inputSources) {
      if (src.targetRaySpace && src.gamepad) {
        if (!chosenSource || src.handedness === 'right') {
          chosenSource = src
        }
      }
    }
    if (!chosenSource?.targetRaySpace || !chosenSource.gamepad) return

    const hasPose = readXRSpaceWorldPose(
      xrFrame,
      chosenSource.targetRaySpace,
      refSpace,
      xrOrigin,
      scratchOriginVec,
      scratchRotQuat,
    )
    if (!hasPose) return

    scratchRayForward.set(0, 0, -1).applyQuaternion(scratchRotQuat).normalize()

    // Check ray intersection with the dartboard plane (Z = dartboardCenter[2] - 0.028)
    const boardPlaneZ = dartboardCenter[2] - 0.028
    const dz = boardPlaneZ - scratchOriginVec.z
    const aimingAtBoard =
      scratchRayForward.z > 0.35 &&
      dz > 0.4 &&
      (() => {
        const t = dz / scratchRayForward.z
        const hitX = scratchOriginVec.x + scratchRayForward.x * t
        const hitY = scratchOriginVec.y + scratchRayForward.y * t
        return (
          Math.abs(hitX - dartboardCenter[0]) <= 0.44 &&
          Math.abs(hitY - dartboardCenter[1]) <= 0.44
        )
      })()

    camera.getWorldPosition(scratchHeadWorld)
    const nearOcheZone =
      Math.abs(scratchHeadWorld.x - ocheFloorPos[0]) < 1.95 &&
      scratchHeadWorld.z > ocheFloorPos[2] - 1.65 &&
      scratchHeadWorld.z < dartboardCenter[2] - 0.75

    const triggerPressed =
      Boolean(chosenSource.gamepad.buttons[1]?.pressed) ||
      ((localSeatId === 'station:darts-oche' || nearOcheZone) &&
        aimingAtBoard &&
        Boolean(chosenSource.gamepad.buttons[0]?.pressed))

    const nowMs = performance.now()
    if (triggerPressed && aimingAtBoard) {
      vrHandHistoryRef.current.push({ pos: scratchOriginVec.clone(), t: nowMs })
      if (vrHandHistoryRef.current.length > 7) {
        vrHandHistoryRef.current.shift()
      }

      const tRay = dz / scratchRayForward.z
      const targetWorld: [number, number, number] = [
        scratchOriginVec.x + scratchRayForward.x * tRay,
        scratchOriginVec.y + scratchRayForward.y * tRay,
        boardPlaneZ,
      ]

      // Blend physical wrist flick speed if user swings controller forward
      let speedMult = 1.05
      if (vrHandHistoryRef.current.length >= 2) {
        const first = vrHandHistoryRef.current[0]
        const dtSec = Math.max(0.016, (nowMs - first.t) / 1000)
        const handSpeed = scratchOriginVec.distanceTo(first.pos) / dtSec
        speedMult = Math.max(0.88, Math.min(1.42, 0.92 + handSpeed * 0.22))
      }

      const originTuple: [number, number, number] = [
        Number(scratchOriginVec.x.toFixed(3)),
        Number(scratchOriginVec.y.toFixed(3)),
        Number(scratchOriginVec.z.toFixed(3)),
      ]
      const vel = computeBallisticDartVelocity(originTuple, targetWorld, speedMult)
      vrLastOriginRef.current = originTuple
      vrLastAimVelRef.current = vel
      vrTriggerWasPressedRef.current = true
      if (nowMs - lastAimArcUpdateRef.current >= 65) {
        lastAimArcUpdateRef.current = nowMs
        setVrTriggerAimArc(sampleDartTrajectoryArc(originTuple, vel, boardPlaneZ, 16))
      }
    } else if (vrTriggerWasPressedRef.current) {
      vrTriggerWasPressedRef.current = false
      vrHandHistoryRef.current = []
      setVrTriggerAimArc(null)
      if (vrLastOriginRef.current && vrLastAimVelRef.current) {
        lastVrTriggerThrowAtRef.current = nowMs
        playSpatialUiFeedback('dart-throw')
        triggerXRHapticPulse(chosenSource, 0.55, 40)
        onLaunchDartShot(vrLastOriginRef.current, vrLastAimVelRef.current, dartboardCenter)
      }
    }
  })

  const worldPointToBoardLocal = (pt: THREE.Vector3): [number, number] => [
    dartboardCenter[0] - pt.x,
    pt.y - dartboardCenter[1],
  ]

  const previewArcPoints = useMemo(() => {
    if (vrTriggerAimArc) return vrTriggerAimArc
    if (!aimBoardLocal || buildMode) return null
    const targetWorld: [number, number, number] = [
      dartboardCenter[0] - aimBoardLocal[0],
      dartboardCenter[1] + aimBoardLocal[1],
      dartboardCenter[2] - 0.028,
    ]
    const vel = computeBallisticDartVelocity(throwOriginWorld, targetWorld, 1.04)
    return sampleDartTrajectoryArc(throwOriginWorld, vel, dartboardCenter[2] - 0.028, 16)
  }, [aimBoardLocal, buildMode, dartboardCenter, throwOriginWorld, vrTriggerAimArc])

  const previewHitLabel = useMemo(() => {
    if (!aimBoardLocal) return null
    return scoreDartPolar(aimBoardLocal[0], aimBoardLocal[1]).label
  }, [aimBoardLocal])

  const fireDartTowardBoardPoint = (pt: THREE.Vector3, flickDelta?: [number, number]) => {
    if (buildMode || activeDartShot) return
    const jitterX = (Math.random() - 0.5) * 0.006 + (flickDelta?.[0] ?? 0)
    const jitterY = (Math.random() - 0.5) * 0.006 + (flickDelta?.[1] ?? 0)
    const targetWorld: [number, number, number] = [
      pt.x - jitterX,
      pt.y + jitterY,
      dartboardCenter[2] - 0.028,
    ]
    const vel = computeBallisticDartVelocity(throwOriginWorld, targetWorld, 1.06)
    playSpatialUiFeedback('dart-throw')
    onLaunchDartShot(throwOriginWorld, vel, dartboardCenter)
  }

  const topLeaders = useMemo(() => {
    return Object.values(clubhouseState.playerStats)
      .sort(
        (a, b) =>
          b.dartWins + b.puttingWins - (a.dartWins + a.puttingWins) ||
          b.highestCheckout - a.highestCheckout,
      )
      .slice(0, 3)
  }, [clubhouseState.playerStats])

  const atOche = localSeatId === 'station:darts-oche'

  return (
    <group name="bar-games-dartboard-station">
      {/* Live Flying Dart in World Space */}
      <group ref={flyingDartRef} visible={false}>
        <DartModel3D color={activeDartShot?.color ?? accentColor} />
      </group>

      {/* Parabolic Aim Trajectory Arc */}
      {previewArcPoints && previewArcPoints.length >= 2 && (
        <Line
          points={previewArcPoints}
          color={accentColor}
          lineWidth={2}
          transparent
          opacity={0.75}
          raycast={() => null}
        />
      )}

      {/* ================================================================= */}
      {/* REGULATION 3D BRISTLE DARTBOARD ON BACK WALL                      */}
      {/* ================================================================= */}
      <group position={dartboardCenter} rotation={[0, Math.PI, 0]}>
        {/* Walnut Cabinet Backboard */}
        <RoundedBox args={[0.74, 0.78, 0.045]} radius={0.025} smoothness={2}>
          <meshStandardMaterial color="#271A12" roughness={0.68} metalness={0.12} />
        </RoundedBox>

        {/* Overhead Brass Pub Hood Bar */}
        <mesh position={[0, 0.42, 0.06]}>
          <boxGeometry args={[0.52, 0.032, 0.12]} />
          <meshStandardMaterial
            color="#D97706"
            emissive={accentColor}
            emissiveIntensity={0.35}
            metalness={0.75}
            roughness={0.28}
          />
        </mesh>

        {/* 3D Cylindrical Sisal BristlePuck */}
        <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.012]}>
          <cylinderGeometry
            args={[
              DARTBOARD_RADII.surroundOuter,
              DARTBOARD_RADII.surroundOuter,
              0.034,
              48,
            ]}
          />
          <meshStandardMaterial color="#111622" roughness={0.85} metalness={0.1} />
        </mesh>

        {/* Interactive Bristle Target Face (Click or Click-Drag-Flick to Throw!) */}
        <mesh
          position={[0, 0, 0.03]}
          pointerEventsType={{ deny: 'grab' }}
          onPointerMove={(e: ThreeEvent<PointerEvent>) => {
            if (buildMode) return
            e.stopPropagation()
            setAimBoardLocal(worldPointToBoardLocal(e.point))
          }}
          onPointerOut={() => {
            setAimBoardLocal(null)
            setPointerDragging(false)
          }}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (buildMode) return
            e.stopPropagation()
            setPointerDragging(true)
            dragStartWorldRef.current = [e.point.x, e.point.y, e.point.z]
            setAimBoardLocal(worldPointToBoardLocal(e.point))
          }}
          onPointerUp={(e: ThreeEvent<PointerEvent>) => {
            if (buildMode || !pointerDragging) return
            e.stopPropagation()
            setPointerDragging(false)
            const start = dragStartWorldRef.current
            dragStartWorldRef.current = null
            // Avoid duplicate throw if VR controller trigger release already launched a dart
            if (performance.now() - lastVrTriggerThrowAtRef.current < 350) {
              return
            }
            if (start) {
              const flickY = Math.max(-0.06, Math.min(0.06, (e.point.y - start[1]) * 0.25))
              fireDartTowardBoardPoint(e.point, [0, flickY])
            } else {
              fireDartTowardBoardPoint(e.point)
            }
          }}
        >
          <circleGeometry args={[DARTBOARD_RADII.surroundOuter, 56]} />
          <meshStandardMaterial map={boardTexture} roughness={0.78} metalness={0.05} />
        </mesh>

        {/* Aim Crosshair Reticle & Live Polar Segment Readout */}
        {aimBoardLocal && !buildMode && (
          <group position={[aimBoardLocal[0], aimBoardLocal[1], 0.034]}>
            <mesh>
              <ringGeometry args={[0.011, 0.016, 20]} />
              <meshBasicMaterial color="#22D3EE" />
            </mesh>
            {previewHitLabel && (
              <Suspense fallback={null}>
                <Text
                  position={[0, 0.036, 0.004]}
                  fontSize={0.024}
                  color="#22D3EE"
                  anchorX="center"
                  anchorY="middle"
                >
                  {previewHitLabel}
                </Text>
              </Suspense>
            )}
          </group>
        )}

        {/* Stuck 3D Darts from Current Visit */}
        {dartsState.stuckDarts.map((d) => (
          <group
            key={d.id}
            position={d.boardLocalPos}
            rotation={[0.08, Math.PI, 0]}
          >
            <DartModel3D color={d.color} />
          </group>
        ))}

        {/* Bottom Brass Nameplate */}
        <Suspense fallback={null}>
          <Text
            position={[0, -0.34, 0.03]}
            fontSize={0.025}
            color="#E5A93C"
            anchorX="center"
            anchorY="middle"
          >
            {atOche
              ? 'CLICK BOARD OR HOLD TRIGGER TO AIM & THROW'
              : 'CLICK DARTBOARD TO THROW · STEP TO OCHE'}
          </Text>
        </Suspense>
      </group>

      {/* ================================================================= */}
      {/* OCHE (REGULATION 2.37m FLOOR THROW LINE)                          */}
      {/* ================================================================= */}
      <group position={ocheFloorPos}>
        {/* Brass & Illuminated Throw Line Strip */}
        <mesh position={[0, 0.01, 0]}>
          <boxGeometry args={[0.96, 0.018, 0.065]} />
          <meshStandardMaterial
            color={atOche ? '#22D3EE' : accentColor}
            emissive={atOche ? '#22D3EE' : accentColor}
            emissiveIntensity={atOche ? 0.65 : 0.32}
            metalness={0.6}
            roughness={0.3}
          />
        </mesh>

        {/* Subtle Lane Mat Carpet Runner */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004, 0.95]}>
          <planeGeometry args={[0.88, 1.9]} />
          <meshStandardMaterial color="#151C28" roughness={0.92} />
        </mesh>

        {/* Clickable Stand-at-Oche Pill */}
        <group
          position={[0, 0.024, -0.22]}
          rotation={[-Math.PI / 2, 0, Math.PI]}
          pointerEventsType={{ deny: 'grab' }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setOcheHovered(true)
          }}
          onPointerOut={() => setOcheHovered(false)}
          onClick={(e) => {
            if (buildMode) return
            e.stopPropagation()
            onSelectSeat('station:darts-oche')
          }}
        >
          <RoundedBox args={[0.82, 0.22, 0.015]} radius={0.05} smoothness={2}>
            <meshBasicMaterial
              color={atOche ? '#0E7490' : ocheHovered ? '#28354B' : '#131A26'}
            />
          </RoundedBox>
          <Suspense fallback={null}>
            <Text
              position={[0, 0, 0.012]}
              fontSize={0.042}
              color={atOche ? '#ECFEFF' : '#F4F1EA'}
              anchorX="center"
              anchorY="middle"
            >
              {atOche ? '🎯 AT OCHE (2.37m)' : '🎯 STAND AT OCHE'}
            </Text>
          </Suspense>
        </group>
      </group>

      {/* ================================================================= */}
      {/* 3D HEAD-TO-HEAD DIGITAL SCOREBOARD & CLUBHOUSE LEADERBOARD        */}
      {/* ================================================================= */}
      <group position={scoreboardCenter} rotation={[0, Math.PI, 0]}>
        <RoundedBox args={[1.28, 1.18, 0.04]} radius={0.03} smoothness={2}>
          <meshStandardMaterial color="#0D121B" roughness={0.45} metalness={0.35} />
        </RoundedBox>
        <mesh position={[0, 0, 0.021]}>
          <planeGeometry args={[1.22, 1.12]} />
          <meshBasicMaterial color="#090D14" />
        </mesh>

        {/* Top Mode & Controls Row */}
        <Suspense fallback={null}>
          <Text
            position={[-0.56, 0.49, 0.026]}
            fontSize={0.034}
            color={accentColor}
            anchorX="left"
            anchorY="middle"
          >
            {`🎯 DARTS · ${dartsState.mode.toUpperCase()}${
              dartsState.mode === '501'
                ? dartsState.doubleOut
                  ? ' (DBL-OUT)'
                  : ' (OPEN-OUT)'
                : ''
            }`}
          </Text>
        </Suspense>

        <ScoreButton3D
          label="501"
          position={[-0.45, 0.39, 0.026]}
          width={0.18}
          active={dartsState.mode === '501'}
          accentColor={accentColor}
          onClick={() => onConfigureDarts({ mode: '501' })}
        />
        <ScoreButton3D
          label="Cricket"
          position={[-0.23, 0.39, 0.026]}
          width={0.21}
          active={dartsState.mode === 'cricket'}
          accentColor={accentColor}
          onClick={() => onConfigureDarts({ mode: 'cricket' })}
        />
        {dartsState.mode === '501' && (
          <ScoreButton3D
            label={dartsState.doubleOut ? 'Dbl-Out: ON' : 'Dbl-Out: OFF'}
            position={[0.03, 0.39, 0.026]}
            width={0.26}
            active={dartsState.doubleOut}
            accentColor="#22D3EE"
            onClick={() => onConfigureDarts({ doubleOut: !dartsState.doubleOut })}
          />
        )}
        <ScoreButton3D
          label="+ Join"
          position={[0.29, 0.39, 0.026]}
          width={0.19}
          onClick={onJoinDarts}
        />
        <ScoreButton3D
          label="Reset"
          position={[0.49, 0.39, 0.026]}
          width={0.17}
          onClick={onResetDarts}
        />

        {/* Live Match Body: 501 Countdown OR Cricket Marks Matrix */}
        <Suspense fallback={null}>
          {dartsState.players.length === 0 ? (
            <Text
              position={[0, 0.08, 0.026]}
              fontSize={0.032}
              color="#94A3B8"
              maxWidth={1.08}
              textAlign="center"
              anchorX="center"
              anchorY="middle"
            >
              Throw a dart or tap + Join to start an automated 501 or Cricket match!
            </Text>
          ) : dartsState.mode === '501' ? (
            <group position={[0, 0.11, 0.026]}>
              {dartsState.players.slice(0, 4).map((p, idx) => {
                const count = Math.min(4, dartsState.players.length)
                const colWidth = 1.12 / count
                const x = -0.56 + colWidth * (idx + 0.5)
                const isActive = idx === dartsState.activePlayerIndex && !dartsState.winnerId
                return (
                  <group key={p.userId} position={[x, 0, 0]}>
                    <RoundedBox
                      args={[colWidth - 0.04, 0.34, 0.006]}
                      radius={0.015}
                      position={[0, 0, -0.002]}
                    >
                      <meshBasicMaterial color={isActive ? '#172336' : '#0F1623'} />
                    </RoundedBox>
                    <Text
                      position={[0, 0.11, 0.005]}
                      fontSize={0.028}
                      color={isActive ? '#22D3EE' : '#E2E8F0'}
                      anchorX="center"
                      anchorY="middle"
                    >
                      {`${isActive ? '▶ ' : ''}${p.displayName.slice(0, 10)}`}
                    </Text>
                    <Text
                      position={[0, -0.01, 0.005]}
                      fontSize={0.085}
                      color={p.score501 === 0 ? '#10B981' : accentColor}
                      anchorX="center"
                      anchorY="middle"
                    >
                      {String(p.score501)}
                    </Text>
                    {isActive && (
                      <Text
                        position={[0, -0.12, 0.005]}
                        fontSize={0.023}
                        color="#94A3B8"
                        anchorX="center"
                        anchorY="middle"
                      >
                        {`Darts: ${'●'.repeat(dartsState.dartsThrownInTurn)}${'○'.repeat(
                          Math.max(0, 3 - dartsState.dartsThrownInTurn),
                        )}`}
                      </Text>
                    )}
                  </group>
                )
              })}
            </group>
          ) : (
            /* CRICKET MARK BOARD (20, 19, 18, 17, 16, 15, BULL) */
            <group position={[0, 0.06, 0.026]}>
              {/* Header row */}
              <Text
                position={[-0.46, 0.21, 0]}
                fontSize={0.024}
                color="#94A3B8"
                anchorX="center"
                anchorY="middle"
              >
                TARGET
              </Text>
              {dartsState.players.slice(0, 3).map((p, idx) => {
                const x = -0.18 + idx * 0.32
                const isActive = idx === dartsState.activePlayerIndex && !dartsState.winnerId
                return (
                  <Text
                    key={p.userId}
                    position={[x, 0.21, 0]}
                    fontSize={0.025}
                    color={isActive ? '#22D3EE' : '#F4F1EA'}
                    anchorX="center"
                    anchorY="middle"
                  >
                    {`${p.displayName.slice(0, 8)} (${p.cricketPoints})`}
                  </Text>
                )
              })}

              {CRICKET_TARGETS.map((t, rIdx) => {
                const y = 0.15 - rIdx * 0.048
                return (
                  <group key={t} position={[0, y, 0]}>
                    <Text
                      position={[-0.46, 0, 0]}
                      fontSize={0.024}
                      color={accentColor}
                      anchorX="center"
                      anchorY="middle"
                    >
                      {t === 25 ? 'BULL' : String(t)}
                    </Text>
                    {dartsState.players.slice(0, 3).map((p, idx) => {
                      const marks = p.cricketMarks[t] ?? 0
                      return (
                        <Text
                          key={p.userId}
                          position={[-0.18 + idx * 0.32, 0, 0]}
                          fontSize={0.027}
                          color={marks >= 3 ? '#10B981' : marks > 0 ? '#F8FAFC' : '#475569'}
                          anchorX="center"
                          anchorY="middle"
                        >
                          {formatCricketMarkSymbol(marks)}
                        </Text>
                      )
                    })}
                  </group>
                )
              })}
            </group>
          )}

          {/* Last Visit Summary Strip */}
          <Text
            position={[0, -0.22, 0.026]}
            fontSize={0.025}
            color="#E2E8F0"
            maxWidth={1.14}
            textAlign="center"
            anchorX="center"
            anchorY="middle"
          >
            {dartsState.lastTurnSummary}
          </Text>

          {/* All-Time Clubhouse Leaderboard Footer */}
          <RoundedBox args={[1.16, 0.24, 0.006]} radius={0.014} position={[0, -0.41, 0.024]}>
            <meshBasicMaterial color="#111827" />
          </RoundedBox>
          <Text
            position={[-0.54, -0.33, 0.028]}
            fontSize={0.023}
            color={accentColor}
            anchorX="left"
            anchorY="middle"
          >
            🏆 ALL-TIME CLUBHOUSE LEADERS
          </Text>
          {topLeaders.length === 0 ? (
            <Text
              position={[0, -0.43, 0.028]}
              fontSize={0.022}
              color="#64748B"
              anchorX="center"
              anchorY="middle"
            >
              Win a 501, Cricket, or Putt-Off match to claim #1 on the Clubhouse board!
            </Text>
          ) : (
            topLeaders.map((st, idx) => (
              <Text
                key={st.key}
                position={[-0.53, -0.385 - idx * 0.048, 0.028]}
                fontSize={0.022}
                color="#CBD5E1"
                anchorX="left"
                anchorY="middle"
              >
                {`#${idx + 1} ${st.displayName.slice(0, 12)} · Darts ${st.dartWins}-${st.dartLosses} · Putt ${st.puttingWins}-${st.puttingLosses} · HiOut ${st.highestCheckout || '-'} · Streak ${st.longestPuttingStreak}`}
              </Text>
            ))
          )}
        </Suspense>
      </group>
    </group>
  )
}
