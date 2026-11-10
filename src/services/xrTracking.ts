import type { XRControllerState } from '@react-three/xr'
import * as THREE from 'three'

const scratchOriginQuat = new THREE.Quaternion()

/**
 * Computes the exact Three.js world-space position and orientation of any WebXR
 * `XRSpace` (`gripSpace` or `targetRaySpace`) by transforming the raw `XRFrame`
 * reference-space pose through `<XROrigin>`'s `matrixWorld`.
 *
 * Works on Frame 0 even before CDN controller GLTF models finish loading, and stays
 * 100% accurate when `<XROrigin>` translates or snap-turns anywhere in the room.
 */
export function readXRSpaceWorldPose(
  xrFrame: XRFrame | undefined | null,
  space: XRSpace | undefined | null,
  refSpace: XRReferenceSpace | undefined | null,
  xrOrigin: THREE.Object3D | undefined | null,
  outPos: THREE.Vector3,
  outQuat: THREE.Quaternion,
): boolean {
  if (!xrFrame || !space || !refSpace) return false
  let pose: XRPose | null = null
  try {
    pose = xrFrame.getPose(space, refSpace) ?? null
  } catch {
    return false
  }
  if (!pose) return false

  outPos.set(
    pose.transform.position.x,
    pose.transform.position.y,
    pose.transform.position.z,
  )
  outQuat.set(
    pose.transform.orientation.x,
    pose.transform.orientation.y,
    pose.transform.orientation.z,
    pose.transform.orientation.w,
  )

  if (xrOrigin) {
    xrOrigin.updateWorldMatrix(true, false)
    outPos.applyMatrix4(xrOrigin.matrixWorld)
    xrOrigin.getWorldQuaternion(scratchOriginQuat)
    outQuat.premultiply(scratchOriginQuat)
  }

  return true
}

/**
 * Reads thumbstick `(x, y)` axes (`-1..+1`, where `y < 0` is pushed forward) across
 * Meta Quest Touch Plus (`xr-standard`), Quest Link, and WebXR browser emulators.
 */
export function readControllerThumbstick(
  controller: XRControllerState | undefined,
): { x: number; y: number } {
  if (!controller) return { x: 0, y: 0 }

  const xrStick = controller.gamepad?.['xr-standard-thumbstick']
  if (
    xrStick &&
    (typeof xrStick.xAxis === 'number' || typeof xrStick.yAxis === 'number')
  ) {
    const sx = xrStick.xAxis ?? 0
    const sy = xrStick.yAxis ?? 0
    if (sx !== 0 || sy !== 0) {
      return { x: sx, y: sy }
    }
  }

  const axes = controller.inputSource?.gamepad?.axes
  if (!axes || axes.length === 0) return { x: 0, y: 0 }

  // WebXR `xr-standard` mapping stores thumbstick on axes[2], axes[3] (touchpad on 0, 1)
  if (axes.length >= 4) {
    const x2 = axes[2] ?? 0
    const y3 = axes[3] ?? 0
    if (Math.abs(x2) > 0.01 || Math.abs(y3) > 0.01) {
      return { x: x2, y: y3 }
    }
  }

  return {
    x: axes[0] ?? 0,
    y: axes[1] ?? 0,
  }
}

/**
 * Checks whether a named gamepad component (e.g. `'a-button'`, `'b-button'`) or raw
 * `xr-standard` button index is currently pressed on a WebXR controller.
 */
export function isControllerButtonPressed(
  controller: XRControllerState | undefined,
  componentIds: readonly string[],
  fallbackButtonIndex?: number,
): boolean {
  if (!controller) return false
  for (const id of componentIds) {
    if (controller.gamepad?.[id]?.state === 'pressed') {
      return true
    }
  }
  if (fallbackButtonIndex !== undefined) {
    return Boolean(
      controller.inputSource?.gamepad?.buttons?.[fallbackButtonIndex]?.pressed,
    )
  }
  return false
}

let activeSpatialUiHoverId: string | null = null

/**
 * Tracks whether a 3D UI button/control is currently hovered by the user's pointer ray
 * so station trigger handlers (e.g. Shooting Range firearm trigger, Dartboard throw, NES A/B)
 * never misfire while clicking 3D menus.
 */
export function setSpatialUiHovered(hovered: boolean, sourceId = 'ui'): void {
  if (hovered) {
    activeSpatialUiHoverId = sourceId
  } else if (!activeSpatialUiHoverId || activeSpatialUiHoverId === sourceId) {
    activeSpatialUiHoverId = null
  }
}

export function isSpatialUiHovered(): boolean {
  return activeSpatialUiHoverId !== null
}

let activeSpatialDrawingSurfaceId: string | null = null
const spatialDrawingListeners = new Set<(active: boolean) => void>()

/**
 * Tracks when the user's pointer is hovering or actively drawing on a 3D whiteboard
 * so desktop/mobile OrbitControls rotation pauses cleanly during freehand strokes.
 */
export function setSpatialDrawingSurfaceActive(
  active: boolean,
  sourceId = 'whiteboard',
): void {
  const prev = activeSpatialDrawingSurfaceId !== null
  if (active) {
    activeSpatialDrawingSurfaceId = sourceId
  } else if (
    !activeSpatialDrawingSurfaceId ||
    activeSpatialDrawingSurfaceId === sourceId
  ) {
    activeSpatialDrawingSurfaceId = null
  }
  const next = activeSpatialDrawingSurfaceId !== null
  if (prev !== next) {
    for (const listener of spatialDrawingListeners) {
      try {
        listener(next)
      } catch {
        // Ignore listener error
      }
    }
  }
}

export function isSpatialDrawingSurfaceActive(): boolean {
  return activeSpatialDrawingSurfaceId !== null
}

export function onSpatialDrawingSurfaceChange(
  listener: (active: boolean) => void,
): () => void {
  spatialDrawingListeners.add(listener)
  return () => {
    spatialDrawingListeners.delete(listener)
  }
}

/**
 * Fires a lightweight WebXR controller haptic pulse on the specified controller
 * or XRInputSource (or any active controller with a haptic actuator).
 */
export function triggerXRHapticPulse(
  controller?: XRControllerState | XRInputSource | null,
  intensity = 0.28,
  durationMs = 20,
): void {
  try {
    if (!controller) return
    const rawGamepad =
      'inputSource' in controller
        ? controller.inputSource?.gamepad
        : controller.gamepad
    const gamepad = rawGamepad as
      | (Gamepad & {
          hapticActuators?: ReadonlyArray<{
            pulse?: (value: number, duration: number) => Promise<unknown> | void
          }>
        })
      | undefined
    const actuator = gamepad?.hapticActuators?.[0]
    if (actuator?.pulse) {
      void actuator.pulse(
        Math.max(0.05, Math.min(1, intensity)),
        Math.max(8, Math.min(200, durationMs)),
      )
    }
  } catch {
    // Ignore unsupported haptic actuators
  }
}
