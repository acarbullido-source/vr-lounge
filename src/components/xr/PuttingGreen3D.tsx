import { Line, RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { useXR } from '@react-three/xr'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { PUTTING_STRIP_SPECS } from '../../constants/barGames'
import {
  getPuttingSurfaceHeight,
  stepPuttingBallCCD,
  type ActivePuttSim,
} from '../../services/barGamesPhysics'
import { readXRSpaceWorldPose } from '../../services/xrTracking'
import type {
  LivePuttShotPacket,
  PuttShotSettlePacket,
  PuttingGameMode,
  PuttingMatchState,
} from '../../types/barGames'

export interface PuttingGreen3DProps {
  localUserId: string
  localSeatId: string | undefined
  stripOrigin: [number, number, number]
  teeFloorPos: [number, number, number]
  accentColor: string
  buildMode: boolean
  puttingState: PuttingMatchState
  activePuttShot: LivePuttShotPacket | null
  onSelectSeat: (seatId: string) => void
  onLaunchPuttShot: (
    localOrigin: [number, number],
    localVelocity: [number, number],
  ) => void
  onSettlePuttShot: (packet: PuttShotSettlePacket) => void
  onJoinPutting: () => void
  onConfigurePutting: (patch: { mode?: PuttingGameMode; rampEnabled?: boolean }) => void
  onResetBallToTee: () => void
  onResetPutting: () => void
}

function createRampGeometry(): THREE.BufferGeometry {
  const width = PUTTING_STRIP_SPECS.width - 0.08
  const segsZ = 28
  const geo = new THREE.PlaneGeometry(
    width,
    PUTTING_STRIP_SPECS.rampHalfLength * 2,
    2,
    segsZ,
  )
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i)
    const u = Math.max(-1, Math.min(1, z / PUTTING_STRIP_SPECS.rampHalfLength))
    const h = 0.5 * PUTTING_STRIP_SPECS.rampPeakHeight * (1 + Math.cos(Math.PI * u))
    pos.setY(i, h)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()
  return geo
}

function PutterClubMesh({ highlighted = false }: { highlighted?: boolean }) {
  return (
    <group>
      {/* Rubber grip */}
      <mesh position={[0, 0.36, 0]}>
        <cylinderGeometry args={[0.014, 0.012, 0.24, 10]} />
        <meshStandardMaterial color="#1E293B" roughness={0.85} />
      </mesh>
      {/* Brushed steel shaft */}
      <mesh position={[0, 0.02, 0]}>
        <cylinderGeometry args={[0.007, 0.006, 0.62, 10]} />
        <meshStandardMaterial color="#CBD5E1" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Brass mallet putter blade at y = -0.29 */}
      <RoundedBox
        args={[0.125, 0.032, 0.036]}
        radius={0.006}
        smoothness={2}
        position={[0.035, -0.29, 0]}
      >
        <meshStandardMaterial
          color={highlighted ? '#22D3EE' : '#E5A93C'}
          emissive={highlighted ? '#22D3EE' : '#000000'}
          emissiveIntensity={highlighted ? 0.35 : 0}
          metalness={0.75}
          roughness={0.25}
        />
      </RoundedBox>
    </group>
  )
}

/**
 * Local blade-center offset in `grip-space` for `HeldVRPutterClubMesh`.
 * Origin `(0, 0, 0)` sits directly inside the player's Quest controller palm,
 * while the `0.81m` shaft angles slightly forward (`~20°`) so the mallet head
 * rests naturally on the turf when holding the controller at waist height.
 */
const LOCAL_VR_BLADE_OFFSET = new THREE.Vector3(0.035, -0.76, -0.28)

function HeldVRPutterClubMesh() {
  return (
    <group rotation={[-0.35, 0, 0]} position={[0, -0.46, -0.16]}>
      {/* Rubber grip aligned right inside Quest controller hand */}
      <mesh position={[0, 0.44, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.015, 0.013, 0.24, 10]} />
        <meshStandardMaterial color="#1E293B" roughness={0.82} />
      </mesh>
      {/* Full-length 0.78m brushed steel putter shaft */}
      <mesh position={[0, -0.02, 0]} raycast={() => null}>
        <cylinderGeometry args={[0.007, 0.006, 0.76, 10]} />
        <meshStandardMaterial color="#CBD5E1" metalness={0.85} roughness={0.2} />
      </mesh>
      {/* Glowing mallet putter blade */}
      <RoundedBox
        args={[0.13, 0.034, 0.038]}
        radius={0.006}
        smoothness={2}
        position={[0.035, -0.39, 0]}
        raycast={() => null}
      >
        <meshStandardMaterial
          color="#22D3EE"
          emissive="#22D3EE"
          emissiveIntensity={0.32}
          metalness={0.75}
          roughness={0.25}
        />
      </RoundedBox>
    </group>
  )
}

interface MiniSignButtonProps {
  label: string
  position: [number, number, number]
  width?: number
  active?: boolean
  accentColor?: string
  onClick: () => void
}

function MiniSignButton({
  label,
  position,
  width = 0.21,
  active = false,
  accentColor = '#10B981',
  onClick,
}: MiniSignButtonProps) {
  const [hovered, setHovered] = useState(false)
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
        onClick()
      }}
    >
      <RoundedBox args={[width, 0.068, 0.014]} radius={0.014} smoothness={2}>
        <meshBasicMaterial
          color={active ? accentColor : hovered ? '#243447' : '#15202E'}
        />
      </RoundedBox>
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.024}
          color={active ? '#06130E' : '#F4F1EA'}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Suspense>
    </group>
  )
}

export function PuttingGreen3D({
  localUserId,
  localSeatId,
  stripOrigin,
  teeFloorPos,
  accentColor,
  buildMode,
  puttingState,
  activePuttShot,
  onSelectSeat,
  onLaunchPuttShot,
  onSettlePuttShot,
  onJoinPutting,
  onConfigurePutting,
  onResetBallToTee,
  onResetPutting,
}: PuttingGreen3DProps) {
  const { gl, camera } = useThree()
  const xrSession = useXR((s) => s.session)
  const xrOrigin = useXR((s) => s.origin)
  const xrOriginRefSpace = useXR((s) => s.originReferenceSpace)
  const inVR = Boolean(xrSession)

  const rampGeometry = useMemo(() => createRampGeometry(), [])

  const [vrPutterHolstered, setVrPutterHolstered] = useState(false)
  const [isHoldingVrPutterUi, setIsHoldingVrPutterUi] = useState(false)
  const [putterRackHovered, setPutterRackHovered] = useState(false)
  const [teeSpotHovered, setTeeSpotHovered] = useState(false)
  const [dragAimLocal, setDragAimLocal] = useState<[number, number] | null>(null)
  const [isDraggingPutt, setIsDraggingPutt] = useState(false)

  const dragStartLocalRef = useRef<[number, number] | null>(null)
  const ballMeshRef = useRef<THREE.Mesh>(null)
  const vrPutterGroupRef = useRef<THREE.Group>(null)
  const isHoldingVrPutterRef = useRef(false)
  const simRef = useRef<ActivePuttSim | null>(null)
  const activeShotIdRef = useRef<string | null>(null)
  const settledShotIdRef = useRef<string | null>(null)
  const prevBladeLocalRef = useRef<{ x: number; z: number; t: number } | null>(null)
  const lastVrStrikeAtRef = useRef<number>(0)

  // Pre-allocated scratch math vectors/quaternions (zero per-frame heap allocations)
  const scratchHeadWorld = useMemo(() => new THREE.Vector3(), [])
  const scratchHandWorld = useMemo(() => new THREE.Vector3(), [])
  const scratchHandQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchBladeOffset = useMemo(() => new THREE.Vector3(), [])

  // Sync resting ball position whenever no shot is active
  useEffect(() => {
    if (activePuttShot) return
    simRef.current = null
    activeShotIdRef.current = null
    if (ballMeshRef.current) {
      ballMeshRef.current.position.set(
        puttingState.ballRestLocal[0],
        puttingState.ballRestLocal[1],
        puttingState.ballRestLocal[2],
      )
    }
  }, [activePuttShot, puttingState.ballRestLocal])

  // Initialize deterministic 10x sub-stepped CCD putt simulation on shot launch
  useEffect(() => {
    if (!activePuttShot) return
    if (activeShotIdRef.current === activePuttShot.shotId) return
    activeShotIdRef.current = activePuttShot.shotId
    const { height } = getPuttingSurfaceHeight(
      activePuttShot.localOrigin[1],
      activePuttShot.rampEnabled,
    )
    simRef.current = {
      localPos: [
        activePuttShot.localOrigin[0],
        height + PUTTING_STRIP_SPECS.ballRadius,
        activePuttShot.localOrigin[1],
      ],
      localVel: [...activePuttShot.localVelocity],
      settled: false,
      holed: false,
      lipOut: false,
    }
  }, [activePuttShot])

  // Step golf ball CCD physics + world-space VR physical putter blade collision in useFrame
  useFrame((_, delta) => {
    const sim = simRef.current
    if (sim && activePuttShot && !sim.settled) {
      stepPuttingBallCCD(sim, delta, activePuttShot.rampEnabled)
      if (ballMeshRef.current) {
        ballMeshRef.current.position.set(
          sim.localPos[0],
          sim.localPos[1],
          sim.localPos[2],
        )
      }

      if (sim.settled && activePuttShot.shooterId === localUserId) {
        if (settledShotIdRef.current !== activePuttShot.shotId) {
          settledShotIdRef.current = activePuttShot.shotId
          const dist = Math.hypot(
            activePuttShot.localOrigin[0] - 0,
            activePuttShot.localOrigin[1] - PUTTING_STRIP_SPECS.cupLocalZ,
          )
          onSettlePuttShot({
            shotId: activePuttShot.shotId,
            shooterId: activePuttShot.shooterId,
            shooterName: activePuttShot.shooterName,
            holed: sim.holed,
            lipOut: sim.lipOut,
            restLocalPos: sim.localPos,
            distanceMeters: Number(dist.toFixed(2)),
            rampEnabled: activePuttShot.rampEnabled,
            timestamp: Date.now(),
          })
        }
      }
    }

    // Check whether the VR player is physically standing near the Putting Strip
    const setHoldingUi = (next: boolean) => {
      if (isHoldingVrPutterRef.current !== next) {
        isHoldingVrPutterRef.current = next
        setIsHoldingVrPutterUi(next)
      }
    }

    if (!inVR || !xrSession || buildMode) {
      if (vrPutterGroupRef.current) vrPutterGroupRef.current.visible = false
      prevBladeLocalRef.current = null
      setHoldingUi(false)
      return
    }

    camera.getWorldPosition(scratchHeadWorld)
    const dxStrip = scratchHeadWorld.x - stripOrigin[0]
    const dzStrip = scratchHeadWorld.z - stripOrigin[2]
    const nearPuttingZone = Math.abs(dxStrip) < 1.95 && Math.abs(dzStrip) < 2.65

    // Auto-reset manual rack holster once player walks > 2.9m away so returning auto-equips
    if (vrPutterHolstered && Math.hypot(dxStrip, dzStrip) > 2.95) {
      setVrPutterHolstered(false)
    }

    if (!nearPuttingZone || vrPutterHolstered) {
      if (vrPutterGroupRef.current) vrPutterGroupRef.current.visible = false
      prevBladeLocalRef.current = null
      setHoldingUi(false)
      return
    }

    const xrFrame = gl.xr.getFrame?.()
    const refSpace = xrOriginRefSpace ?? gl.xr.getReferenceSpace?.()
    if (!xrFrame || !refSpace) {
      if (vrPutterGroupRef.current) vrPutterGroupRef.current.visible = false
      prevBladeLocalRef.current = null
      setHoldingUi(false)
      return
    }

    let rightSource: XRInputSource | null = null
    for (const src of xrSession.inputSources) {
      if (src.gripSpace || src.targetRaySpace) {
        if (!rightSource || src.handedness === 'right') {
          rightSource = src
        }
      }
    }
    const space = rightSource?.gripSpace ?? rightSource?.targetRaySpace
    const hasPose = readXRSpaceWorldPose(
      xrFrame,
      space,
      refSpace,
      xrOrigin,
      scratchHandWorld,
      scratchHandQuat,
    )
    if (!hasPose) {
      if (vrPutterGroupRef.current) vrPutterGroupRef.current.visible = false
      prevBladeLocalRef.current = null
      setHoldingUi(false)
      return
    }

    setHoldingUi(true)
    if (vrPutterGroupRef.current) {
      vrPutterGroupRef.current.visible = true
      vrPutterGroupRef.current.position.set(
        scratchHandWorld.x - stripOrigin[0],
        scratchHandWorld.y - stripOrigin[1],
        scratchHandWorld.z - stripOrigin[2],
      )
      vrPutterGroupRef.current.quaternion.copy(scratchHandQuat)
    }

    // Compute world-space blade head -> Putting Strip local coordinates
    scratchBladeOffset.copy(LOCAL_VR_BLADE_OFFSET).applyQuaternion(scratchHandQuat)
    const bladeLocalX = scratchHandWorld.x + scratchBladeOffset.x - stripOrigin[0]
    const bladeLocalY = scratchHandWorld.y + scratchBladeOffset.y - stripOrigin[1]
    const bladeLocalZ = scratchHandWorld.z + scratchBladeOffset.z - stripOrigin[2]

    const nowMs = performance.now()
    const prev = prevBladeLocalRef.current
    prevBladeLocalRef.current = { x: bladeLocalX, z: bladeLocalZ, t: nowMs }

    if (
      prev &&
      !activePuttShot &&
      nowMs - lastVrStrikeAtRef.current > 900 &&
      bladeLocalY < 0.26
    ) {
      const ballX = puttingState.ballRestLocal[0]
      const ballZ = puttingState.ballRestLocal[2]
      const distToBall = Math.hypot(bladeLocalX - ballX, bladeLocalZ - ballZ)
      if (distToBall < 0.095) {
        const dtSec = Math.max(0.012, (nowMs - prev.t) / 1000)
        const vx = Math.max(-2.2, Math.min(2.2, ((bladeLocalX - prev.x) / dtSec) * 1.25))
        const vz = Math.max(-4.2, Math.min(4.2, ((bladeLocalZ - prev.z) / dtSec) * 1.25))
        if (Math.hypot(vx, vz) > 0.25) {
          lastVrStrikeAtRef.current = nowMs
          onLaunchPuttShot(
            [Number(ballX.toFixed(3)), Number(ballZ.toFixed(3))],
            [Number(vx.toFixed(3)), Number(vz.toFixed(3))],
          )
        }
      }
    }
  })

  const worldToStripLocal = (pt: THREE.Vector3): [number, number] => [
    pt.x - stripOrigin[0],
    pt.z - stripOrigin[2],
  ]

  const computePuttVelocityFromInput = (
    ballXZ: [number, number],
    startXZ: [number, number],
    endXZ: [number, number],
  ): [number, number] => {
    const dragDist = Math.hypot(endXZ[0] - startXZ[0], endXZ[1] - startXZ[1])

    // Click-to-putt: calibrate smooth speed directly toward clicked point (or cup)
    if (dragDist < 0.07) {
      const dx = endXZ[0] - ballXZ[0]
      const dz = endXZ[1] - ballXZ[1]
      const dist = Math.max(0.25, Math.hypot(dx, dz))
      // Ideal entry speed v0 = sqrt(2 * a * dist + v_entry^2) where decel a = 0.76 m/s^2
      const extraRampBoost = puttingState.rampEnabled ? 0.34 : 0
      const targetSpeed = Math.min(
        3.6,
        Math.sqrt(2 * 0.76 * dist + 0.85 * 0.85) + extraRampBoost,
      )
      return [
        Number(((dx / dist) * targetSpeed).toFixed(3)),
        Number(((dz / dist) * targetSpeed).toFixed(3)),
      ]
    }

    // Drag-to-putt: if user pulled backward (+Z away from cup), invert slingshot; if dragged toward cup (-Z), follow drag!
    let dirX = endXZ[0] - startXZ[0]
    let dirZ = endXZ[1] - startXZ[1]
    if (dirZ > 0.08 && startXZ[1] >= ballXZ[1] - 0.25) {
      dirX = -dirX
      dirZ = -dirZ
    }
    const len = Math.max(0.05, Math.hypot(dirX, dirZ))
    const speed = Math.max(0.7, Math.min(3.8, dragDist * 3.1))
    return [
      Number(((dirX / len) * speed).toFixed(3)),
      Number(((dirZ / len) * speed).toFixed(3)),
    ]
  }

  const aimPreviewLine = useMemo(() => {
    if (!isDraggingPutt || !dragAimLocal || !dragStartLocalRef.current) return null
    const ballXZ: [number, number] = [
      puttingState.ballRestLocal[0],
      puttingState.ballRestLocal[2],
    ]
    const vel = computePuttVelocityFromInput(ballXZ, dragStartLocalRef.current, dragAimLocal)
    return [
      [ballXZ[0], 0.04, ballXZ[1]] as [number, number, number],
      [
        ballXZ[0] + vel[0] * 0.45,
        0.04,
        ballXZ[1] + vel[1] * 0.45,
      ] as [number, number, number],
    ]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragAimLocal, isDraggingPutt, puttingState.ballRestLocal, puttingState.rampEnabled])

  const atTee = localSeatId === 'station:putting-tee'

  return (
    <group name="bar-games-putting-green">
      <group position={stripOrigin}>
        {/* Equippable Live VR Putter attached to VR Controller in World Space */}
        <group ref={vrPutterGroupRef} visible={false}>
          <HeldVRPutterClubMesh />
        </group>

        {/* Rubber Base Underlay */}
        <RoundedBox
          args={[PUTTING_STRIP_SPECS.width + 0.08, 0.026, PUTTING_STRIP_SPECS.length + 0.08]}
          radius={0.012}
          smoothness={2}
          position={[0, 0.013, 0]}
        >
          <meshStandardMaterial color="#1E1813" roughness={0.75} metalness={0.12} />
        </RoundedBox>

        {/* Emerald Championship Putting Turf Surface (Click Cup/Turf or Drag Ball to Putt!) */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.028, 0]}
          pointerEventsType={{ deny: 'grab' }}
          onPointerDown={(e: ThreeEvent<PointerEvent>) => {
            if (buildMode || activePuttShot) return
            e.stopPropagation()
            const localXZ = worldToStripLocal(e.point)
            dragStartLocalRef.current = localXZ
            setDragAimLocal(localXZ)
            setIsDraggingPutt(true)
          }}
          onPointerMove={(e: ThreeEvent<PointerEvent>) => {
            if (!isDraggingPutt || buildMode) return
            e.stopPropagation()
            setDragAimLocal(worldToStripLocal(e.point))
          }}
          onPointerUp={(e: ThreeEvent<PointerEvent>) => {
            if (!isDraggingPutt || buildMode) return
            e.stopPropagation()
            setIsDraggingPutt(false)
            const startXZ = dragStartLocalRef.current
            const endXZ = worldToStripLocal(e.point)
            dragStartLocalRef.current = null
            setDragAimLocal(null)
            if (!startXZ || activePuttShot) return
            const ballXZ: [number, number] = [
              puttingState.ballRestLocal[0],
              puttingState.ballRestLocal[2],
            ]
            const vel = computePuttVelocityFromInput(ballXZ, startXZ, endXZ)
            onLaunchPuttShot(ballXZ, vel)
          }}
        >
          <planeGeometry args={[PUTTING_STRIP_SPECS.width, PUTTING_STRIP_SPECS.length]} />
          <meshStandardMaterial color="#0F6B42" roughness={0.86} metalness={0.02} />
        </mesh>

        {/* Subtle Walnut & Brass Bumper Rails */}
        <mesh position={[-PUTTING_STRIP_SPECS.width / 2 - 0.018, 0.048, 0]}>
          <boxGeometry args={[0.036, 0.045, PUTTING_STRIP_SPECS.length + 0.06]} />
          <meshStandardMaterial color="#3E2718" roughness={0.55} metalness={0.15} />
        </mesh>
        <mesh position={[PUTTING_STRIP_SPECS.width / 2 + 0.018, 0.048, 0]}>
          <boxGeometry args={[0.036, 0.045, PUTTING_STRIP_SPECS.length + 0.06]} />
          <meshStandardMaterial color="#3E2718" roughness={0.55} metalness={0.15} />
        </mesh>
        <mesh position={[0, 0.052, -PUTTING_STRIP_SPECS.length / 2 - 0.018]}>
          <boxGeometry args={[PUTTING_STRIP_SPECS.width + 0.1, 0.055, 0.036]} />
          <meshStandardMaterial color="#3E2718" roughness={0.55} metalness={0.15} />
        </mesh>

        {/* Distance Alignment Striping (Tee, 1m, 2m, 3m) */}
        {[
          { z: PUTTING_STRIP_SPECS.teeLocalZ, label: 'TEE' },
          { z: PUTTING_STRIP_SPECS.teeLocalZ - 1.0, label: '1m' },
          { z: PUTTING_STRIP_SPECS.teeLocalZ - 2.0, label: '2m' },
          { z: PUTTING_STRIP_SPECS.cupLocalZ + 0.25, label: '3m' },
        ].map((mk) => (
          <group key={mk.label} position={[0, 0.03, mk.z]}>
            <mesh rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[PUTTING_STRIP_SPECS.width - 0.16, 0.012]} />
              <meshBasicMaterial color="#D1FAE5" transparent opacity={0.45} />
            </mesh>
            <Suspense fallback={null}>
              <Text
                position={[-PUTTING_STRIP_SPECS.width / 2 + 0.1, 0.002, -0.05]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={0.045}
                color="#A7F3D0"
                anchorX="left"
                anchorY="middle"
              >
                {mk.label}
              </Text>
            </Suspense>
          </group>
        ))}

        {/* Toggleable Curved Bridge Obstacle Ramp */}
        {puttingState.rampEnabled && (
          <group position={[0, 0.029, PUTTING_STRIP_SPECS.rampCenterZ]}>
            <mesh geometry={rampGeometry} pointerEventsType={{ deny: 'all' }}>
              <meshStandardMaterial color="#15803D" roughness={0.78} />
            </mesh>
            <mesh position={[-PUTTING_STRIP_SPECS.width / 2 + 0.05, 0.042, 0]}>
              <boxGeometry
                args={[0.018, 0.022, PUTTING_STRIP_SPECS.rampHalfLength * 1.85]}
              />
              <meshBasicMaterial color={accentColor} />
            </mesh>
            <mesh position={[PUTTING_STRIP_SPECS.width / 2 - 0.05, 0.042, 0]}>
              <boxGeometry
                args={[0.018, 0.022, PUTTING_STRIP_SPECS.rampHalfLength * 1.85]}
              />
              <meshBasicMaterial color={accentColor} />
            </mesh>
          </group>
        )}

        {/* Recessed Cup + Brass Rim + Flagstick */}
        <group position={[0, 0.029, PUTTING_STRIP_SPECS.cupLocalZ]}>
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[PUTTING_STRIP_SPECS.cupRadius, 28]} />
            <meshBasicMaterial color="#05070B" />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]}>
            <ringGeometry
              args={[
                PUTTING_STRIP_SPECS.cupRadius,
                PUTTING_STRIP_SPECS.cupRadius + 0.01,
                28,
              ]}
            />
            <meshBasicMaterial color="#F8FAFC" />
          </mesh>
          {/* Thin Pin Flagstick */}
          <mesh position={[0, 0.34, -0.02]} pointerEventsType={{ deny: 'all' }}>
            <cylinderGeometry args={[0.004, 0.004, 0.68, 8]} />
            <meshStandardMaterial color="#F8FAFC" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0.065, 0.61, -0.02]} pointerEventsType={{ deny: 'all' }}>
            <boxGeometry args={[0.13, 0.085, 0.004]} />
            <meshBasicMaterial color="#EF4444" />
          </mesh>
        </group>

        {/* Live Aim Vector Preview Line */}
        {aimPreviewLine && (
          <Line
            points={aimPreviewLine}
            color="#22D3EE"
            lineWidth={2.5}
          />
        )}

        {/* 3D Dimpled White Golf Ball */}
        <mesh
          ref={ballMeshRef}
          position={[
            puttingState.ballRestLocal[0],
            puttingState.ballRestLocal[1] + 0.028,
            puttingState.ballRestLocal[2],
          ]}
          pointerEventsType={{ deny: 'all' }}
        >
          <sphereGeometry args={[PUTTING_STRIP_SPECS.ballRadius, 20, 20]} />
          <meshStandardMaterial color="#FFFFFF" roughness={0.28} metalness={0.05} />
        </mesh>

        {/* Resting VR Putter Stand beside Tee (hides club mesh while held in VR hand) */}
        <group
          position={[PUTTING_STRIP_SPECS.width / 2 + 0.16, 0.34, 1.25]}
          rotation={[0, 0, -0.14]}
          pointerEventsType={{ deny: 'grab' }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setPutterRackHovered(true)
          }}
          onPointerOut={() => setPutterRackHovered(false)}
          onClick={(e) => {
            if (buildMode) return
            e.stopPropagation()
            if (inVR) {
              setVrPutterHolstered((v) => !v)
            } else {
              onSelectSeat('station:putting-tee')
            }
          }}
        >
          {/* Stand base post so rack remains clickable when putter is in hand */}
          <mesh position={[0, -0.22, 0]}>
            <cylinderGeometry args={[0.045, 0.055, 0.22, 12]} />
            <meshStandardMaterial color="#1E293B" roughness={0.55} metalness={0.35} />
          </mesh>
          <group visible={!isHoldingVrPutterUi}>
            <PutterClubMesh highlighted={putterRackHovered} />
          </group>
          <Suspense fallback={null}>
            <Text
              position={[0, 0.56, 0]}
              fontSize={0.03}
              color={isHoldingVrPutterUi ? '#22D3EE' : '#E5A93C'}
              anchorX="center"
              anchorY="middle"
            >
              {isHoldingVrPutterUi
                ? '🏌️ IN HAND (TAP TO RACK)'
                : inVR
                  ? '🏌️ GRAB PUTTER'
                  : '⛳ STEP TO TEE'}
            </Text>
          </Suspense>
        </group>

        {/* 3D Putting Green Score & Controls Pedestal Sign */}
        <group
          position={[0, 0.72, -PUTTING_STRIP_SPECS.length / 2 - 0.12]}
          rotation={[0, 0, 0]}
        >
          <mesh position={[0, -0.36, 0]}>
            <cylinderGeometry args={[0.018, 0.024, 0.72, 10]} />
            <meshStandardMaterial color="#1E293B" metalness={0.5} roughness={0.4} />
          </mesh>
          <RoundedBox args={[0.98, 0.54, 0.03]} radius={0.022} smoothness={2}>
            <meshStandardMaterial color="#0B131E" roughness={0.45} metalness={0.3} />
          </RoundedBox>

          <Suspense fallback={null}>
            <Text
              position={[-0.44, 0.2, 0.02]}
              fontSize={0.028}
              color="#10B981"
              anchorX="left"
              anchorY="middle"
            >
              {`⛳ MINI-GOLF · ${
                puttingState.mode === 'puttoff'
                  ? `PUTT-OFF (RD ${puttingState.round}/${puttingState.maxRounds})`
                  : 'STREAK CHALLENGE'
              }`}
            </Text>
          </Suspense>

          <MiniSignButton
            label="Streak"
            position={[-0.36, 0.11, 0.02]}
            width={0.18}
            active={puttingState.mode === 'streak'}
            onClick={() => onConfigurePutting({ mode: 'streak' })}
          />
          <MiniSignButton
            label="Putt-Off"
            position={[-0.15, 0.11, 0.02]}
            width={0.2}
            active={puttingState.mode === 'puttoff'}
            onClick={() => onConfigurePutting({ mode: 'puttoff' })}
          />
          <MiniSignButton
            label={puttingState.rampEnabled ? 'Ramp: ON' : 'Ramp: OFF'}
            position={[0.09, 0.11, 0.02]}
            width={0.22}
            active={puttingState.rampEnabled}
            accentColor={accentColor}
            onClick={() =>
              onConfigurePutting({ rampEnabled: !puttingState.rampEnabled })
            }
          />
          <MiniSignButton
            label="Re-Tee"
            position={[0.31, 0.11, 0.02]}
            width={0.16}
            onClick={onResetBallToTee}
          />
          <MiniSignButton
            label="+Join"
            position={[0.43, 0.2, 0.02]}
            width={0.11}
            onClick={onJoinPutting}
          />

          <Suspense fallback={null}>
            {puttingState.players.length === 0 ? (
              <Text
                position={[0, -0.02, 0.02]}
                fontSize={0.025}
                color="#94A3B8"
                maxWidth={0.88}
                textAlign="center"
                anchorX="center"
                anchorY="middle"
              >
                Click the cup or drag from the golf ball to sink putts & build your streak!
              </Text>
            ) : (
              puttingState.players.slice(0, 3).map((p, idx) => (
                <Text
                  key={p.userId}
                  position={[-0.43, 0.01 - idx * 0.048, 0.02]}
                  fontSize={0.025}
                  color={
                    idx === puttingState.activePlayerIndex ? '#34D399' : '#E2E8F0'
                  }
                  anchorX="left"
                  anchorY="middle"
                >
                  {`${p.displayName.slice(0, 10)} · 🔥 Streak: ${p.currentStreak} (Best ${p.bestSessionStreak})${
                    puttingState.mode === 'puttoff' ? ` · Pts: ${p.puttOffScore}` : ''
                  }`}
                </Text>
              ))
            )}

            <Text
              position={[0, -0.17, 0.02]}
              fontSize={0.022}
              color="#CBD5E1"
              maxWidth={0.9}
              textAlign="center"
              anchorX="center"
              anchorY="middle"
            >
              {puttingState.lastOutcomeText}
            </Text>
          </Suspense>

          <MiniSignButton
            label="Reset Session"
            position={[0.34, -0.22, 0.02]}
            width={0.22}
            onClick={onResetPutting}
          />
        </group>
      </group>

      {/* Clickable Step-to-Tee Floor Badge */}
      <group
        position={[teeFloorPos[0], teeFloorPos[1] + 0.02, teeFloorPos[2]]}
        rotation={[-Math.PI / 2, 0, 0]}
        pointerEventsType={{ deny: 'grab' }}
        onPointerOver={(e) => {
          e.stopPropagation()
          setTeeSpotHovered(true)
        }}
        onPointerOut={() => setTeeSpotHovered(false)}
        onClick={(e) => {
          if (buildMode) return
          e.stopPropagation()
          onSelectSeat('station:putting-tee')
        }}
      >
        <RoundedBox args={[0.64, 0.22, 0.014]} radius={0.05} smoothness={2}>
          <meshBasicMaterial
            color={atTee ? '#065F46' : teeSpotHovered ? '#1E293B' : '#111827'}
          />
        </RoundedBox>
        <Suspense fallback={null}>
          <Text
            position={[0, 0, 0.01]}
            fontSize={0.038}
            color={atTee ? '#A7F3D0' : '#F4F1EA'}
            anchorX="center"
            anchorY="middle"
          >
            {atTee ? '⛳ AT PUTTING TEE' : '⛳ STEP TO TEE'}
          </Text>
        </Suspense>
      </group>
    </group>
  )
}
