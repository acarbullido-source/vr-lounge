import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  isControllerButtonPressed,
  readXRSpaceWorldPose,
} from '../../services/xrTracking'
import type { LoungeWingId, PresenterState } from '../../types/lounge'

export interface WristWatchHUD3DProps {
  visible: boolean
  xrOriginRef: React.RefObject<THREE.Group | null>
  activeLoungeWing: LoungeWingId
  flyMode: boolean
  isMuted: boolean
  cinemaVolume: number
  effectiveCinemaVolume: number
  presenterState: PresenterState
  liveAlertText?: string
  onJumpToWing: (wingId: LoungeWingId) => void
  onToggleFlyMode: () => void
  onDropToFloor: () => void
  onRecenterView: () => void
  onToggleMute: () => void
  onCycleStreamVolume: () => void
  onSummonMainDock: () => void
}

const WING_LABELS: Record<LoungeWingId, { short: string; emoji: string }> = {
  'main-lounge': { short: 'Main Theater', emoji: '🎬' },
  hallway: { short: 'Grand Hallway', emoji: '🏛' },
  boardroom: { short: 'Boardroom', emoji: '💼' },
  library: { short: 'Quiet Library', emoji: '🔥' },
  'command-center': { short: 'Control Room', emoji: '🛰' },
  'game-room': { short: 'The Game Room', emoji: '🕹' },
  'shooting-range': { short: 'Shooting Range', emoji: '🎯' },
  'outdoor-deck': { short: 'Lake Deck', emoji: '🏔' },
}

const TELEPORT_BUTTONS: ReadonlyArray<{
  wing: LoungeWingId
  label: string
  pos: [number, number, number]
  width?: number
}> = [
  { wing: 'main-lounge', label: '🎬 Theater', pos: [-0.072, 0.036, 0.008], width: 0.068 },
  { wing: 'library', label: '🔥 Library', pos: [0, 0.036, 0.008], width: 0.068 },
  { wing: 'outdoor-deck', label: '🏔 Deck', pos: [0.072, 0.036, 0.008], width: 0.068 },
  { wing: 'command-center', label: '🛰 Ops', pos: [-0.081, 0.002, 0.008], width: 0.051 },
  { wing: 'game-room', label: '🕹 Game', pos: [-0.027, 0.002, 0.008], width: 0.051 },
  { wing: 'shooting-range', label: '🎯 Range', pos: [0.027, 0.002, 0.008], width: 0.051 },
  { wing: 'boardroom', label: '💼 Board', pos: [0.081, 0.002, 0.008], width: 0.051 },
]

interface WatchChipButtonProps {
  label: string
  sublabel?: string
  position: [number, number, number]
  width?: number
  height?: number
  active?: boolean
  accentColor?: string
  danger?: boolean
  onClick: () => void
}

function WatchChipButton({
  label,
  sublabel,
  position,
  width = 0.066,
  height = 0.028,
  active = false,
  accentColor = '#E5A93C',
  danger = false,
  onClick,
}: WatchChipButtonProps) {
  const [hovered, setHovered] = useState(false)

  const bg = danger
    ? hovered
      ? '#EF4444'
      : '#B91C1C'
    : active
      ? hovered
        ? '#F2BE5C'
        : accentColor
      : hovered
        ? '#28354A'
        : '#161E2C'

  const fg = active && !danger ? '#090C10' : '#F4F1EA'

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
      <RoundedBox args={[width, height, 0.005]} radius={0.005} smoothness={2}>
        <meshBasicMaterial color={bg} />
      </RoundedBox>
      <Text
        position={[0, sublabel ? 0.004 : 0, 0.0035]}
        fontSize={0.0082}
        color={fg}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      {sublabel && (
        <Text
          position={[0, -0.0065, 0.0035]}
          fontSize={0.0062}
          color={active && !danger ? '#1E293B' : '#94A3B8'}
          anchorX="center"
          anchorY="middle"
        >
          {sublabel}
        </Text>
      )}
    </group>
  )
}

/**
 * Left-Wrist Smartwatch & Quick HUD for WebXR:
 * - Attaches to the local player's left VR controller (`gripSpace`) or tracked left hand (`wrist`).
 * - Glance-to-Open: Automatically expands into a holographic command deck when the user turns
 *   their left wrist toward their headset, and collapses into a compact wristband when lowered.
 * - Also supports manual pinning via watch-face tap or Left Thumbstick click (`thumbstick`).
 */
export function WristWatchHUD3D({
  visible,
  xrOriginRef,
  activeLoungeWing,
  flyMode,
  isMuted,
  cinemaVolume,
  effectiveCinemaVolume,
  presenterState,
  liveAlertText,
  onJumpToWing,
  onToggleFlyMode,
  onDropToFloor,
  onRecenterView,
  onToggleMute,
  onCycleStreamVolume,
  onSummonMainDock,
}: WristWatchHUD3DProps) {
  const { camera, gl } = useThree()
  const xrOriginRefSpace = useXR((s) => s.originReferenceSpace)
  const leftController = useXRInputSourceState('controller', 'left')
  const leftHand = useXRInputSourceState('hand', 'left')

  const wristRootRef = useRef<THREE.Group>(null)
  const holoDeckRef = useRef<THREE.Group>(null)

  const [glancedOpen, setGlancedOpen] = useState(false)
  const [pinnedOpen, setPinnedOpen] = useState(false)
  const glancedOpenRef = useRef(false)
  const prevStickClickRef = useRef(false)
  const scaleAnimRef = useRef(0)

  // Pre-allocated scratch math vectors/quaternions (zero per-frame GC allocations)
  const scratchWristPos = useMemo(() => new THREE.Vector3(), [])
  const scratchWristQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchHeadPos = useMemo(() => new THREE.Vector3(), [])
  const scratchHeadQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchToHead = useMemo(() => new THREE.Vector3(), [])
  const scratchWatchNormal = useMemo(() => new THREE.Vector3(), [])
  const scratchLocalOffset = useMemo(() => new THREE.Vector3(), [])
  const wristMountEulerOffset = useMemo(
    () => new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.55, 0.25, 0.35)),
    [],
  )

  const isExpanded = pinnedOpen || glancedOpen

  useFrame((_, delta) => {
    if (!visible || !wristRootRef.current) return
    const dt = Math.min(delta, 0.1)
    const alpha = 1 - Math.exp(-18 * dt)

    // 1. Left Controller Thumbstick Click (or X button when pinned) toggles manual pin
    const stickClicked = isControllerButtonPressed(
      leftController,
      ['xr-standard-thumbstick', 'thumbstick'],
      3,
    )
    if (stickClicked && !prevStickClickRef.current) {
      setPinnedOpen((v) => !v)
    }
    prevStickClickRef.current = stickClicked

    // 2. Resolve Left Wrist world pose from Hand `wrist`, Controller `gripSpace`, or Simulator fallback
    const xrFrame = gl.xr.getFrame?.()
    const refSpace = xrOriginRefSpace ?? gl.xr.getReferenceSpace?.()
    let hasTrackedWrist = false

    const handInput = leftHand?.inputSource as
      | (XRInputSource & { hand?: XRHand })
      | undefined
    const wristJointSpace = handInput?.hand?.get?.('wrist' as XRHandJoint)
    const ctrlSpace =
      leftController?.inputSource?.gripSpace ??
      leftController?.inputSource?.targetRaySpace

    if (xrFrame && refSpace) {
      hasTrackedWrist = readXRSpaceWorldPose(
        xrFrame,
        wristJointSpace ?? ctrlSpace,
        refSpace,
        xrOriginRef.current,
        scratchWristPos,
        scratchWristQuat,
      )
    }

    camera.getWorldPosition(scratchHeadPos)
    camera.getWorldQuaternion(scratchHeadQuat)

    if (hasTrackedWrist) {
      // Shift watch slightly onto the inner-top left wrist and orient watch face upward/inward
      scratchLocalOffset
        .set(0.018, 0.028, 0.048)
        .applyQuaternion(scratchWristQuat)
      scratchWristPos.add(scratchLocalOffset)
      scratchWristQuat.multiply(wristMountEulerOffset)

      wristRootRef.current.position.lerp(scratchWristPos, alpha)
      wristRootRef.current.quaternion.slerp(scratchWristQuat, alpha)

      // Glance-to-open check: watch face normal (+Z in watch space) pointing toward headset
      scratchWatchNormal.set(0, 0, 1).applyQuaternion(wristRootRef.current.quaternion)
      scratchToHead.subVectors(scratchHeadPos, wristRootRef.current.position)
      const dist = scratchToHead.length()
      if (dist > 0.001) {
        scratchToHead.divideScalar(dist)
      }
      const dot = scratchWatchNormal.dot(scratchToHead)
      const shouldGlanceOpen = glancedOpenRef.current
        ? dot > 0.28 && dist < 0.88
        : dot > 0.45 && dist < 0.76

      if (shouldGlanceOpen !== glancedOpenRef.current) {
        glancedOpenRef.current = shouldGlanceOpen
        setGlancedOpen(shouldGlanceOpen)
      }
    } else {
      // Simulator / 1-controller fallback: float a compact virtual left-wrist watch in lower-left FOV
      scratchLocalOffset.set(-0.23, -0.24, -0.42).applyQuaternion(scratchHeadQuat)
      scratchWristPos.copy(scratchHeadPos).add(scratchLocalOffset)
      wristRootRef.current.position.lerp(scratchWristPos, alpha)
      wristRootRef.current.lookAt(scratchHeadPos)
    }

    // Smooth scale animation for holographic popup deck
    const targetScale = isExpanded ? 1 : 0.001
    scaleAnimRef.current = THREE.MathUtils.lerp(scaleAnimRef.current, targetScale, alpha)
    if (holoDeckRef.current) {
      holoDeckRef.current.visible = scaleAnimRef.current > 0.02
      holoDeckRef.current.scale.setScalar(Math.max(0.001, scaleAnimRef.current))
    }
  })

  if (!visible) return null

  const wingMeta = WING_LABELS[activeLoungeWing] ?? WING_LABELS['main-lounge']
  const streamPct = Math.round(effectiveCinemaVolume * 100)
  const presenterSummary =
    liveAlertText ||
    (presenterState.screenMode !== 'idle'
      ? `📺 ${presenterState.mediaTitle.slice(0, 24)}`
      : `${wingMeta.emoji} ${wingMeta.short}`)

  return (
    <group ref={wristRootRef} name="left-wrist-smartwatch-hud">
      {/* =====================================================================
          SLEEK TITANIUM WRISTBAND & ALWAYS-ON SMARTWATCH BEZEL (Tap to Pin/Open)
         ===================================================================== */}
      <group
        pointerEventsType={{ deny: 'grab' }}
        onClick={(e) => {
          e.stopPropagation()
          setPinnedOpen((v) => !v)
        }}
      >
        {/* Curved wrist strap */}
        <mesh position={[0, 0, -0.016]} rotation={[0, Math.PI / 2, 0]} raycast={() => null}>
          <torusGeometry args={[0.032, 0.0055, 8, 20]} />
          <meshStandardMaterial color="#1E293B" roughness={0.45} metalness={0.55} />
        </mesh>

        {/* Smartwatch titanium casing */}
        <RoundedBox args={[0.058, 0.04, 0.009]} radius={0.007} smoothness={3}>
          <meshStandardMaterial color="#0F172A" roughness={0.28} metalness={0.72} />
        </RoundedBox>

        {/* Glowing accent bezel */}
        <RoundedBox
          args={[0.054, 0.036, 0.0095]}
          radius={0.006}
          smoothness={2}
          position={[0, 0, 0.0005]}
        >
          <meshBasicMaterial color={flyMode ? '#38BDF8' : isExpanded ? '#E5A93C' : '#334155'} />
        </RoundedBox>

        {/* Watch OLED face */}
        <RoundedBox
          args={[0.05, 0.032, 0.01]}
          radius={0.005}
          smoothness={2}
          position={[0, 0, 0.001]}
        >
          <meshBasicMaterial color="#070A10" />
        </RoundedBox>

        <Text
          position={[0, 0.006, 0.0068]}
          fontSize={0.0068}
          color="#F4F1EA"
          anchorX="center"
          anchorY="middle"
        >
          {`${wingMeta.emoji} ${wingMeta.short.slice(0, 10)}`}
        </Text>
        <Text
          position={[0, -0.006, 0.0068]}
          fontSize={0.0056}
          color={flyMode ? '#38BDF8' : isMuted ? '#F87171' : '#34D399'}
          anchorX="center"
          anchorY="middle"
        >
          {flyMode
            ? '🚀 FLY ON · TAP'
            : `${isMuted ? '🔇 MUTED' : '🎙 LIVE'} · ${isExpanded ? '▼ CLOSE' : '▲ OPEN'}`}
        </Text>
      </group>

      {/* =====================================================================
          EXPANDED HOLOGRAPHIC WRIST COMMAND DECK (Floating 9cm above watch face)
         ===================================================================== */}
      <group ref={holoDeckRef} position={[0, 0.102, 0.018]}>
        {/* Frosted obsidian holographic backplate */}
        <RoundedBox args={[0.232, 0.168, 0.006]} radius={0.012} smoothness={3}>
          <meshBasicMaterial color="#090D15" transparent opacity={0.94} />
        </RoundedBox>

        {/* Outer neon border frame */}
        <RoundedBox
          args={[0.236, 0.172, 0.004]}
          radius={0.013}
          smoothness={2}
          position={[0, 0, -0.0015]}
        >
          <meshBasicMaterial
            color={flyMode ? '#38BDF8' : '#E5A93C'}
            transparent
            opacity={0.45}
          />
        </RoundedBox>

        {/* Top Status Readout Bar */}
        <RoundedBox
          args={[0.216, 0.024, 0.005]}
          radius={0.005}
          smoothness={2}
          position={[0, 0.066, 0.003]}
        >
          <meshBasicMaterial color="#111827" />
        </RoundedBox>
        <Text
          position={[-0.098, 0.066, 0.0065]}
          fontSize={0.0072}
          color="#E5A93C"
          anchorX="left"
          anchorY="middle"
        >
          {presenterSummary}
        </Text>
        <WatchChipButton
          label={pinnedOpen ? '📌 PINNED' : '📌 PIN'}
          position={[0.08, 0.066, 0.004]}
          width={0.048}
          height={0.019}
          active={pinnedOpen}
          onClick={() => setPinnedOpen((v) => !v)}
        />

        {/* Row 1 & 2: One-Tap Room Teleport Grid */}
        {TELEPORT_BUTTONS.map((btn) => (
          <WatchChipButton
            key={btn.wing}
            label={btn.label}
            position={btn.pos}
            width={btn.width ?? 0.068}
            height={0.028}
            active={activeLoungeWing === btn.wing}
            onClick={() => onJumpToWing(btn.wing)}
          />
        ))}

        {/* Row 3: Movement & Comfort (Fly Mode, Drop to Floor, Recenter View) */}
        <WatchChipButton
          label={flyMode ? '🚀 Fly: ON' : '🚀 Fly: OFF'}
          sublabel={flyMode ? 'R-Stick ▲▼' : 'Free 3D'}
          position={[-0.072, -0.033, 0.008]}
          width={0.068}
          height={0.03}
          active={flyMode}
          accentColor="#38BDF8"
          onClick={onToggleFlyMode}
        />
        <WatchChipButton
          label="⬇ Floor"
          sublabel="Drop Y=0"
          position={[0, -0.033, 0.008]}
          width={0.068}
          height={0.03}
          onClick={onDropToFloor}
        />
        <WatchChipButton
          label="🎯 Recenter"
          sublabel="Align View"
          position={[0.072, -0.033, 0.008]}
          width={0.068}
          height={0.03}
          onClick={onRecenterView}
        />

        {/* Row 4: Audio & Media (Mic Mute, Stream Volume/Mute, Main Dock) */}
        <WatchChipButton
          label={isMuted ? '🔇 Mic Off' : '🎙 Mic On'}
          sublabel={isMuted ? 'Tap Unmute' : 'Voice Live'}
          position={[-0.072, -0.067, 0.008]}
          width={0.068}
          height={0.028}
          danger={isMuted}
          active={!isMuted}
          accentColor="#10B981"
          onClick={onToggleMute}
        />
        <WatchChipButton
          label={streamPct === 0 ? '🔇 TV 0%' : `🔊 TV ${streamPct}%`}
          sublabel={`Saved ${Math.round(cinemaVolume * 100)}%`}
          position={[0, -0.067, 0.008]}
          width={0.068}
          height={0.028}
          active={streamPct > 0}
          onClick={onCycleStreamVolume}
        />
        <WatchChipButton
          label="🎛 Main Dock"
          sublabel="Toggle UI"
          position={[0.072, -0.067, 0.008]}
          width={0.068}
          height={0.028}
          onClick={onSummonMainDock}
        />
      </group>
    </group>
  )
}
