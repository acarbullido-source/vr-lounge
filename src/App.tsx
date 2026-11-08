import { OrbitControls } from '@react-three/drei'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  IfInSessionMode,
  PointerEvents,
  XR,
  XROrigin,
  noEvents,
  useXR,
  useXRInputSourceState,
} from '@react-three/xr'
import {
  Component,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import * as THREE from 'three'
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib'
import { AvatarWardrobeDrawer } from './components/ui/AvatarWardrobeDrawer'
import { BarGamesDrawer, type BarGamesTabId } from './components/ui/BarGamesDrawer'
import {
  ClubhouseRoomsAndOpsDrawer,
  type ClubhouseDrawerTabId,
} from './components/ui/ClubhouseRoomsAndOpsDrawer'
import { CompanionOverlay } from './components/ui/CompanionOverlay'
import { PasscodeGate } from './components/ui/PasscodeGate'
import { AvatarManager } from './components/xr/AvatarManager'
import { BarGamesCorner3D } from './components/xr/BarGamesCorner3D'
import { BuildModePanel3D } from './components/xr/BuildModePanel3D'
import { CinemaRoom } from './components/xr/CinemaRoom'
import { ExpansionWing3D } from './components/xr/ExpansionWing3D'
import { SpatialChatPanel } from './components/xr/SpatialChatPanel'
import { SpatialControlDock } from './components/xr/SpatialControlDock'
import type { VRKeyboardMode } from './components/xr/VRKeyboard3D'
import { WardrobeMirror3D } from './components/xr/WardrobeMirror3D'
import { YouTubeBrowser3D } from './components/xr/YouTubeBrowser3D'
import {
  detectActiveLoungeWing,
  resolveExpansionWingState,
  type ExpansionRoomDestination,
} from './constants/expansionRooms'
import {
  FREE_ROAM_SEAT_ID,
  LIGHTING_PRESETS,
  ROOM_SIZE_SPECS,
  getCatalogEntry,
  resolveWalkablePosition,
} from './constants/hangout'
import { useBarGames } from './hooks/useBarGames'
import { useMediaScreen } from './hooks/useMediaScreen'
import { useRoomSession, type JoinRoomOptions } from './hooks/useRoomSession'
import { useWebRTC, type ScreenShareQualityMode } from './hooks/useWebRTC'
import {
  isDeviceUnlocked,
  isPasscodeGateEnabled,
  lockDevicePasscode,
} from './services/passcode'
import {
  isControllerButtonPressed,
  readControllerThumbstick,
  readXRSpaceWorldPose,
} from './services/xrTracking'
import type { YouTubeVideoItem } from './services/youtube'
import { exitVRSession, xrStore } from './store/xrStore'
import type {
  ComputedSeat,
  ExpansionWingSyncedState,
  FurnitureCatalogId,
  LightingPresetId,
  LoungeWingId,
  PlacedFurnitureItem,
  RoomArchitectureConfig,
  RoomLightingConfig,
  RoomScreenTransform,
  WebRTCSignalMessage,
} from './types/lounge'

class CanvasRootBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('CanvasRootBoundary caught unexpected 3D tree error:', error)
  }

  render() {
    if (this.state.hasError) {
      return <ambientLight intensity={1.2} />
    }
    return this.props.children
  }
}

class SceneSectionBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.warn('3D panel boundary caught non-fatal error:', error)
  }

  render() {
    if (this.state.hasError) return null
    return <Suspense fallback={null}>{this.props.children}</Suspense>
  }
}

const UP_AXIS = new THREE.Vector3(0, 1, 0)

const MOVEMENT_KEY_CODES = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
])

function isEditableDomElement(el: Element | null): boolean {
  if (!el) return false
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  return (el as HTMLElement).isContentEditable === true
}

export interface TeleportFloorRequest {
  id: number
  position: [number, number, number]
  yaw?: number
}

interface SeatRigProps {
  joined: boolean
  seat: ComputedSeat
  isFreeRoaming: boolean
  architecture: RoomArchitectureConfig
  screenCenter: [number, number, number]
  recenterVersion: number
  keyboardOpen: boolean
  buildMode: boolean
  teleportRequest: TeleportFloorRequest | null
  localRoamPoseRef: React.MutableRefObject<{
    position: [number, number, number]
    yaw: number
  }>
  onEnterFreeRoam: () => void
  onSummonDockToggle: () => void
  onInVRChange: (inVR: boolean) => void
  onRoamWingChange?: (wing: LoungeWingId) => void
  children?: React.ReactNode
}

/**
 * Unified Seated + Free-Roam Locomotion Rig for both Meta Quest 3 and Desktop:
 * 1. Immersive VR:
 *    - Left (or single) thumbstick smooth headset-relative walking clamped to room/alcove walls
 *      with smooth `0.38m` Rear Balcony step-up.
 *    - Right (or single) thumbstick `45°` comfort snap-turn pivoting around the user's exact
 *      physical `headWorld` position so room-scale walkers are never swung sideways.
 *    - `A` / `X` hold-to-aim & release comfort floor teleport ring.
 *    - `B` / `Y` press summons or minimizes the floating `SpatialControlDock`.
 * 2. Desktop / Companion:
 *    - `WASD` / Arrow keys smooth walking (`Shift` faster) + floor double-click smooth glide,
 *      preserving natural first-person `OrbitControls` mouse-look while roaming.
 *    - 1-click snap-to-seat back onto any chair, sofa, barstool, or Bar Games station.
 */
function SeatCameraAndOriginRig({
  joined,
  seat,
  isFreeRoaming,
  architecture,
  screenCenter,
  recenterVersion,
  keyboardOpen,
  buildMode,
  teleportRequest,
  localRoamPoseRef,
  onEnterFreeRoam,
  onSummonDockToggle,
  onInVRChange,
  onRoamWingChange,
  children,
}: SeatRigProps) {
  const { camera, gl } = useThree()
  const xrSession = useXR((s) => s.session)
  const xrOriginRefSpace = useXR((s) => s.originReferenceSpace)
  const inVR = Boolean(xrSession)

  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  const originRef = useRef<THREE.Group>(null)
  const dockGroupRef = useRef<THREE.Group>(null)
  const orbitRef = useRef<OrbitControlsImpl>(null)
  const vrLocalOffsetRef = useRef<[number, number, number]>([0, 0, 0])
  const [vrTeleportRingPos, setVrTeleportRingPos] = useState<
    [number, number, number] | null
  >(null)

  const pressedKeysRef = useRef<Set<string>>(new Set())
  const desktopTransitionRemainingRef = useRef(0)
  const desktopGlideTargetRef = useRef<[number, number, number] | null>(null)
  const desktopFloorYRef = useRef(0)
  const handledTeleportIdRef = useRef(0)

  const initialIsStanding = seat.id.startsWith('station:')
  const initialErgonomicFloorY =
    seat.position[1] + (initialIsStanding ? 0 : Math.max(0, seat.seatHeightOffset - 0.38))
  const vrOriginTargetPosRef = useRef(
    new THREE.Vector3(
      seat.position[0],
      initialErgonomicFloorY + (initialIsStanding ? 0 : 0.06),
      seat.position[2],
    ),
  )
  const vrOriginYawRef = useRef(seat.rotationY)
  const vrDockYawRef = useRef(seat.rotationY)
  const canSnapTurnRef = useRef(true)
  const prevBOrYPressedRef = useRef(false)
  const prevAOrXPressedRef = useRef(false)
  const activeVrTeleportTargetRef = useRef<[number, number, number] | null>(null)

  const prevIsFreeRoamingRef = useRef(isFreeRoaming)
  const isFreeRoamingRef = useRef(isFreeRoaming)
  isFreeRoamingRef.current = isFreeRoaming

  const desiredCamPos = useMemo(() => new THREE.Vector3(), [])
  const desiredLookTarget = useMemo(() => new THREE.Vector3(), [])
  const desiredDockPos = useMemo(() => new THREE.Vector3(), [])
  const desiredQuat = useMemo(() => new THREE.Quaternion(), [])
  const desiredDockQuat = useMemo(() => new THREE.Quaternion(), [])
  const tmpEuler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])
  const scratchHeadWorld = useMemo(() => new THREE.Vector3(), [])
  const scratchCamQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchCamForward = useMemo(() => new THREE.Vector3(), [])
  const scratchOffset = useMemo(() => new THREE.Vector3(), [])
  const scratchRayPos = useMemo(() => new THREE.Vector3(), [])
  const scratchRayQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchRayDir = useMemo(() => new THREE.Vector3(), [])

  const onInVRChangeRef = useRef(onInVRChange)
  onInVRChangeRef.current = onInVRChange
  const onEnterFreeRoamRef = useRef(onEnterFreeRoam)
  onEnterFreeRoamRef.current = onEnterFreeRoam
  const onSummonDockToggleRef = useRef(onSummonDockToggle)
  onSummonDockToggleRef.current = onSummonDockToggle
  const onRoamWingChangeRef = useRef(onRoamWingChange)
  onRoamWingChangeRef.current = onRoamWingChange
  const lastReportedWingRef = useRef<LoungeWingId>('main-lounge')

  // Initialize <XROrigin> & dockGroupRef once on mount so JSX re-renders never reset VR walk transforms
  useEffect(() => {
    if (originRef.current) {
      originRef.current.position.copy(vrOriginTargetPosRef.current)
      originRef.current.rotation.set(0, vrOriginYawRef.current, 0)
    }
    if (dockGroupRef.current) {
      dockGroupRef.current.position.set(
        vrOriginTargetPosRef.current.x,
        Math.max(0, vrOriginTargetPosRef.current.y - 0.06),
        vrOriginTargetPosRef.current.z,
      )
      dockGroupRef.current.rotation.set(0, vrDockYawRef.current, 0)
    }
  }, [])

  useEffect(() => {
    onInVRChangeRef.current(inVR)
  }, [inVR])

  // Desktop WASD / Arrow-Key Walk Listener (safely ignores form inputs)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!joined || isEditableDomElement(document.activeElement)) return
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
        pressedKeysRef.current.add(e.code)
        return
      }
      if (!MOVEMENT_KEY_CODES.has(e.code)) return
      if (e.code.startsWith('Arrow')) {
        e.preventDefault()
      }
      pressedKeysRef.current.add(e.code)
      if (!inVR && !isFreeRoamingRef.current) {
        onEnterFreeRoamRef.current()
      }
    }

    const onKeyUp = (e: KeyboardEvent) => {
      pressedKeysRef.current.delete(e.code)
    }

    const clearKeys = () => {
      pressedKeysRef.current.clear()
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', clearKeys)
    document.addEventListener('visibilitychange', clearKeys)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', clearKeys)
      document.removeEventListener('visibilitychange', clearKeys)
    }
  }, [inVR, joined])

  // Update seated VR & Desktop targets whenever concrete seat changes
  useEffect(() => {
    if (isFreeRoaming) return
    vrLocalOffsetRef.current = [0, 0, 0]
    const isStandingStation = seat.id.startsWith('station:')
    const seatDeltaY = isStandingStation ? 0 : Math.max(0, seat.seatHeightOffset - 0.38)
    const ergonomicFloorY =
      seat.position[1] + seatDeltaY + (isStandingStation ? 0 : 0.06)
    vrOriginTargetPosRef.current.set(
      seat.position[0],
      ergonomicFloorY,
      seat.position[2],
    )
    vrOriginYawRef.current = seat.rotationY
    vrDockYawRef.current = seat.rotationY
    desktopGlideTargetRef.current = null
    if (!inVR) {
      desktopTransitionRemainingRef.current = 0.45
    }
  }, [
    inVR,
    isFreeRoaming,
    seat.id,
    seat.position[0],
    seat.position[1],
    seat.position[2],
    seat.rotationY,
    seat.seatHeightOffset,
  ])

  // Smooth transition when entering or leaving Free-Roam mode
  useEffect(() => {
    if (isFreeRoaming && !prevIsFreeRoamingRef.current) {
      if (inVR) {
        if (originRef.current) {
          vrOriginTargetPosRef.current.copy(originRef.current.position)
        }
        camera.getWorldPosition(scratchHeadWorld)
        camera.getWorldQuaternion(scratchCamQuat)
        tmpEuler.setFromQuaternion(scratchCamQuat, 'YXZ')
        const walked = resolveWalkablePosition(
          scratchHeadWorld.x,
          scratchHeadWorld.z,
          architecture,
        )
        localRoamPoseRef.current = {
          position: walked,
          yaw: tmpEuler.y,
        }
        vrDockYawRef.current = tmpEuler.y
      } else {
        // Desktop: step cleanly into first-person walk mode with a tight 0.85m look sphere
        camera.getWorldDirection(scratchCamForward)
        const horizLen = Math.hypot(scratchCamForward.x, scratchCamForward.z)
        const fx = horizLen > 0.01 ? scratchCamForward.x / horizLen : 0
        const fz = horizLen > 0.01 ? scratchCamForward.z / horizLen : -1

        const hasKeyHeld = Array.from(pressedKeysRef.current).some((k) =>
          MOVEMENT_KEY_CODES.has(k),
        )
        // If user clicked "Walk Free" while sitting in a chair (no teleport & no WASD yet),
        // step 0.42m forward off the seat cushion so they aren't standing inside the sofa
        const baseStartX = hasKeyHeld
          ? camera.position.x
          : seat.position[0] - Math.sin(seat.rotationY) * 0.42
        const baseStartZ = hasKeyHeld
          ? camera.position.z
          : seat.position[2] - Math.cos(seat.rotationY) * 0.42
        const startWalk = resolveWalkablePosition(baseStartX, baseStartZ, architecture)

        const hasPendingTeleport = Boolean(
          teleportRequest && teleportRequest.id !== handledTeleportIdRef.current,
        )
        if (!hasPendingTeleport) {
          const currentWalk = resolveWalkablePosition(
            camera.position.x,
            camera.position.z,
            architecture,
          )
          localRoamPoseRef.current = {
            position: currentWalk,
            yaw: Math.atan2(-fx, -fz),
          }
          desktopFloorYRef.current = currentWalk[1]

          // Pull OrbitControls target onto a 0.85m sphere around head so mouse drag turns head in place
          camera.position.y = currentWalk[1] + 1.56
          if (orbitRef.current) {
            orbitRef.current.target.set(
              camera.position.x + fx * 0.85,
              camera.position.y + Math.max(-0.35, Math.min(0.35, scratchCamForward.y)) * 0.85,
              camera.position.z + fz * 0.85,
            )
            orbitRef.current.update()
          }

          if (!hasKeyHeld && !desktopGlideTargetRef.current) {
            desktopGlideTargetRef.current = startWalk
          }
        }
      }
    } else if (!isFreeRoaming && prevIsFreeRoamingRef.current && !inVR) {
      desktopGlideTargetRef.current = null
      desktopTransitionRemainingRef.current = 0.45
    }
    prevIsFreeRoamingRef.current = isFreeRoaming
  }, [
    architecture,
    camera,
    inVR,
    isFreeRoaming,
    localRoamPoseRef,
    scratchCamForward,
    scratchCamQuat,
    scratchHeadWorld,
    seat.position,
    seat.rotationY,
    teleportRequest,
    tmpEuler,
  ])

  // Handle explicit floor double-click / room fast-travel requests on both VR and Desktop
  useEffect(() => {
    if (!teleportRequest || teleportRequest.id === handledTeleportIdRef.current) return
    handledTeleportIdRef.current = teleportRequest.id
    const target = resolveWalkablePosition(
      teleportRequest.position[0],
      teleportRequest.position[2],
      architecture,
    )
    const spec =
      ROOM_SIZE_SPECS[architecture.sizePreset] ?? ROOM_SIZE_SPECS.classic
    const detectedWing = detectActiveLoungeWing(target[0], target[2], spec.backZ)
    lastReportedWingRef.current = detectedWing
    onRoamWingChangeRef.current?.(detectedWing)

    if (inVR) {
      camera.getWorldPosition(scratchHeadWorld)
      vrOriginTargetPosRef.current.x += target[0] - scratchHeadWorld.x
      vrOriginTargetPosRef.current.z += target[2] - scratchHeadWorld.z
      vrOriginTargetPosRef.current.y = target[1]
      localRoamPoseRef.current.position = target
      if (typeof teleportRequest.yaw === 'number') {
        vrOriginYawRef.current = teleportRequest.yaw
        vrDockYawRef.current = teleportRequest.yaw
        localRoamPoseRef.current.yaw = teleportRequest.yaw
      }
    } else if (typeof teleportRequest.yaw === 'number') {
      // Room fast-travel: snap cleanly into the target room doorway facing the room centerpiece
      desktopGlideTargetRef.current = null
      desktopFloorYRef.current = target[1]
      localRoamPoseRef.current = {
        position: target,
        yaw: teleportRequest.yaw,
      }
      const fx = -Math.sin(teleportRequest.yaw)
      const fz = -Math.cos(teleportRequest.yaw)
      camera.position.set(target[0], target[1] + 1.56, target[2])
      if (orbitRef.current) {
        orbitRef.current.target.set(
          target[0] + fx * 0.85,
          target[1] + 1.54,
          target[2] + fz * 0.85,
        )
        orbitRef.current.update()
      } else {
        camera.lookAt(target[0] + fx * 3, target[1] + 1.5, target[2] + fz * 3)
      }
    } else {
      desktopGlideTargetRef.current = target
    }
  }, [architecture, camera, inVR, localRoamPoseRef, scratchHeadWorld, teleportRequest])

  // Calibrate physical headset horizontal drift (or align floating dock) when Recenter is clicked
  useEffect(() => {
    if (recenterVersion === 0) return
    if (inVR) {
      camera.getWorldPosition(scratchHeadWorld)
      camera.getWorldQuaternion(scratchCamQuat)
      tmpEuler.setFromQuaternion(scratchCamQuat, 'YXZ')
      if (isFreeRoaming) {
        vrDockYawRef.current = tmpEuler.y
      } else {
        const dx = seat.position[0] - scratchHeadWorld.x
        const dz = seat.position[2] - scratchHeadWorld.z
        const prev = vrLocalOffsetRef.current
        const next: [number, number, number] = [prev[0] + dx, 0, prev[2] + dz]
        vrLocalOffsetRef.current = next
        vrOriginTargetPosRef.current.x = seat.position[0] + next[0]
        vrOriginTargetPosRef.current.z = seat.position[2] + next[2]
        vrOriginYawRef.current = seat.rotationY
      }
    } else if (!isFreeRoaming) {
      desktopTransitionRemainingRef.current = 0.45
    }
  }, [
    camera,
    inVR,
    isFreeRoaming,
    recenterVersion,
    scratchCamQuat,
    scratchHeadWorld,
    seat.position,
    seat.rotationY,
    tmpEuler,
  ])

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    const rigAlpha = 1 - Math.exp(-12 * dt)

    if (inVR) {
      // 1. Quest B/Y button toggles the floating Lounge Controls dock
      const bOrYPressed =
        isControllerButtonPressed(rightController, ['b-button', 'y-button'], 5) ||
        isControllerButtonPressed(leftController, ['y-button', 'b-button'], 5)
      if (bOrYPressed && !prevBOrYPressedRef.current && joined) {
        onSummonDockToggleRef.current()
      }
      prevBOrYPressedRef.current = bOrYPressed

      // 2. Quest A/X hold-to-aim & release comfort floor teleport
      const rightAX = isControllerButtonPressed(
        rightController,
        ['a-button', 'x-button'],
        4,
      )
      const leftAX = isControllerButtonPressed(
        leftController,
        ['x-button', 'a-button'],
        4,
      )
      const aOrXPressed = (rightAX || leftAX) && joined && !buildMode && !keyboardOpen
      if (aOrXPressed) {
        const xrFrame = gl.xr.getFrame?.()
        const refSpace = xrOriginRefSpace ?? gl.xr.getReferenceSpace?.()
        const teleportCtrl = rightAX ? rightController : leftController
        const hasRay = readXRSpaceWorldPose(
          xrFrame,
          teleportCtrl?.inputSource?.targetRaySpace,
          refSpace,
          originRef.current,
          scratchRayPos,
          scratchRayQuat,
        )
        if (hasRay) {
          scratchRayDir.set(0, 0, -1).applyQuaternion(scratchRayQuat).normalize()
          if (scratchRayDir.y < -0.06) {
            const tZero = -scratchRayPos.y / scratchRayDir.y
            if (tZero > 0.25 && tZero < 17.0) {
              const hitX = scratchRayPos.x + scratchRayDir.x * tZero
              const hitZ = scratchRayPos.z + scratchRayDir.z * tZero
              const clamped = resolveWalkablePosition(hitX, hitZ, architecture)
              activeVrTeleportTargetRef.current = clamped
              setVrTeleportRingPos([clamped[0], clamped[1] + 0.022, clamped[2]])
            }
          }
        }
      } else if (prevAOrXPressedRef.current) {
        const dest = activeVrTeleportTargetRef.current
        activeVrTeleportTargetRef.current = null
        setVrTeleportRingPos(null)
        if (dest) {
          if (!isFreeRoamingRef.current) {
            onEnterFreeRoamRef.current()
          }
          camera.getWorldPosition(scratchHeadWorld)
          vrOriginTargetPosRef.current.x += dest[0] - scratchHeadWorld.x
          vrOriginTargetPosRef.current.z += dest[2] - scratchHeadWorld.z
          vrOriginTargetPosRef.current.y = dest[1]
          localRoamPoseRef.current.position = dest
        }
      }
      prevAOrXPressedRef.current = aOrXPressed

      // 3. VR Thumbstick Smooth Walk + Head-Pivoted 45° Snap-Turn (supports 1 or 2 controllers!)
      if (joined && !keyboardOpen) {
        const hasBothControllers = Boolean(leftController && rightController)
        let moveX = 0
        let moveY = 0
        let turnX = 0

        if (hasBothControllers) {
          const leftStick = readControllerThumbstick(leftController)
          const rightStick = readControllerThumbstick(rightController)
          moveX = Math.abs(leftStick.x) > 0.18 ? leftStick.x : 0
          moveY =
            Math.abs(leftStick.y) > 0.18
              ? leftStick.y
              : Math.abs(rightStick.y) > 0.36 && Math.abs(rightStick.x) < 0.42
                ? rightStick.y
                : 0
          turnX = rightStick.x
        } else {
          const singleStick = readControllerThumbstick(rightController ?? leftController)
          moveY = Math.abs(singleStick.y) > 0.22 ? singleStick.y : 0
          turnX =
            Math.abs(singleStick.x) > 0.58 && Math.abs(singleStick.y) < 0.48
              ? singleStick.x
              : 0
        }

        // Head-pivoted 45° comfort snap-turn
        if (Math.abs(turnX) < 0.36) {
          canSnapTurnRef.current = true
        } else if (canSnapTurnRef.current && Math.abs(turnX) > 0.62) {
          canSnapTurnRef.current = false
          const deltaYaw = (turnX > 0 ? -1 : 1) * (Math.PI / 4)
          camera.getWorldPosition(scratchHeadWorld)
          scratchOffset
            .set(
              scratchHeadWorld.x - vrOriginTargetPosRef.current.x,
              0,
              scratchHeadWorld.z - vrOriginTargetPosRef.current.z,
            )
            .applyAxisAngle(UP_AXIS, deltaYaw)
          vrOriginTargetPosRef.current.x = scratchHeadWorld.x - scratchOffset.x
          vrOriginTargetPosRef.current.z = scratchHeadWorld.z - scratchOffset.z
          vrOriginYawRef.current += deltaYaw
          vrDockYawRef.current += deltaYaw
          if (originRef.current) {
            originRef.current.position.x = vrOriginTargetPosRef.current.x
            originRef.current.position.z = vrOriginTargetPosRef.current.z
            originRef.current.rotation.set(0, vrOriginYawRef.current, 0)
          }
        }

        // Smooth headset-relative walk
        if (moveX !== 0 || moveY !== 0) {
          if (!isFreeRoamingRef.current) {
            if (originRef.current) {
              vrOriginTargetPosRef.current.copy(originRef.current.position)
            }
            onEnterFreeRoamRef.current()
          }

          camera.getWorldPosition(scratchHeadWorld)
          camera.getWorldQuaternion(scratchCamQuat)
          tmpEuler.setFromQuaternion(scratchCamQuat, 'YXZ')
          const headYaw = tmpEuler.y

          const fwdAmt = -moveY
          const rightAmt = moveX
          const walkSpeed = 2.65
          const stepX =
            (-Math.sin(headYaw) * fwdAmt + Math.cos(headYaw) * rightAmt) *
            walkSpeed *
            dt
          const stepZ =
            (-Math.cos(headYaw) * fwdAmt - Math.sin(headYaw) * rightAmt) *
            walkSpeed *
            dt

          const [clampedHeadX, floorY, clampedHeadZ] = resolveWalkablePosition(
            scratchHeadWorld.x + stepX,
            scratchHeadWorld.z + stepZ,
            architecture,
          )
          vrOriginTargetPosRef.current.x += clampedHeadX - scratchHeadWorld.x
          vrOriginTargetPosRef.current.z += clampedHeadZ - scratchHeadWorld.z
          vrOriginTargetPosRef.current.y = floorY
          localRoamPoseRef.current = {
            position: [clampedHeadX, floorY, clampedHeadZ],
            yaw: headYaw,
          }
        }
      }

      // Apply VR <XROrigin> & floating SpatialControlDock transforms
      desiredQuat.setFromEuler(tmpEuler.set(0, vrOriginYawRef.current, 0))
      if (originRef.current) {
        originRef.current.position.lerp(vrOriginTargetPosRef.current, rigAlpha)
        originRef.current.quaternion.slerp(desiredQuat, rigAlpha)
      }

      if (dockGroupRef.current) {
        if (isFreeRoaming) {
          camera.getWorldPosition(scratchHeadWorld)
          camera.getWorldQuaternion(scratchCamQuat)
          tmpEuler.setFromQuaternion(scratchCamQuat, 'YXZ')
          // Lazily follow horizontal gaze when user turns > ~32° so dock stays comfortably in front
          let yawDiff = tmpEuler.y - vrDockYawRef.current
          while (yawDiff > Math.PI) yawDiff -= Math.PI * 2
          while (yawDiff < -Math.PI) yawDiff += Math.PI * 2
          if (Math.abs(yawDiff) > 0.56) {
            vrDockYawRef.current += (yawDiff - Math.sign(yawDiff) * 0.48) * 0.25
          }
          desiredDockPos.set(
            scratchHeadWorld.x,
            vrOriginTargetPosRef.current.y,
            scratchHeadWorld.z,
          )
          desiredDockQuat.setFromEuler(tmpEuler.set(0, vrDockYawRef.current, 0))
          dockGroupRef.current.position.lerp(desiredDockPos, rigAlpha)
          dockGroupRef.current.quaternion.slerp(desiredDockQuat, rigAlpha)
          const spec =
            ROOM_SIZE_SPECS[architecture.sizePreset] ?? ROOM_SIZE_SPECS.classic
          const detectedWing = detectActiveLoungeWing(
            localRoamPoseRef.current.position[0],
            localRoamPoseRef.current.position[2],
            spec.backZ,
          )
          if (detectedWing !== lastReportedWingRef.current) {
            lastReportedWingRef.current = detectedWing
            onRoamWingChangeRef.current?.(detectedWing)
          }
        } else {
          const seatDeltaY = Math.max(0, seat.seatHeightOffset - 0.38)
          const ergonomicFloorY = seat.position[1] + seatDeltaY
          desiredDockPos.set(seat.position[0], ergonomicFloorY, seat.position[2])
          dockGroupRef.current.position.lerp(desiredDockPos, rigAlpha)
          dockGroupRef.current.quaternion.slerp(desiredQuat, rigAlpha)
        }
      }
      return
    }

    // =========================================================================
    // DESKTOP / COMPANION MODE: SEATED GLIDE + WASD / FLOOR-GLIDE FREE ROAM
    // =========================================================================
    if (isFreeRoaming) {
      const keys = pressedKeysRef.current
      const fwd =
        (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) -
        (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0)
      const strafe =
        (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) -
        (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0)

      const curRoam = localRoamPoseRef.current.position

      if (fwd !== 0 || strafe !== 0) {
        desktopGlideTargetRef.current = null
        camera.getWorldDirection(scratchCamForward)
        const hLen = Math.hypot(scratchCamForward.x, scratchCamForward.z)
        const fx = hLen > 0.001 ? scratchCamForward.x / hLen : 0
        const fz = hLen > 0.001 ? scratchCamForward.z / hLen : -1
        const rx = -fz
        const rz = fx

        let moveX = fx * fwd + rx * strafe
        let moveZ = fz * fwd + rz * strafe
        const mLen = Math.hypot(moveX, moveZ)
        if (mLen > 0.001) {
          moveX /= mLen
          moveZ /= mLen
        }

        const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 5.0 : 3.1
        const nextWalk = resolveWalkablePosition(
          curRoam[0] + moveX * speed * dt,
          curRoam[2] + moveZ * speed * dt,
          architecture,
        )

        const dx = nextWalk[0] - curRoam[0]
        const dz = nextWalk[2] - curRoam[2]
        const nextFloorY = THREE.MathUtils.lerp(
          desktopFloorYRef.current,
          nextWalk[1],
          1 - Math.exp(-12 * dt),
        )
        const dyFloor = nextFloorY - desktopFloorYRef.current
        desktopFloorYRef.current = nextFloorY

        localRoamPoseRef.current = {
          position: [nextWalk[0], nextWalk[1], nextWalk[2]],
          yaw: Math.atan2(-fx, -fz),
        }

        camera.position.x += dx
        camera.position.y += dyFloor
        camera.position.z += dz
        if (orbitRef.current) {
          orbitRef.current.target.x += dx
          orbitRef.current.target.y += dyFloor
          orbitRef.current.target.z += dz
          orbitRef.current.update()
        }
      } else if (desktopGlideTargetRef.current) {
        const target = desktopGlideTargetRef.current
        const glideAlpha = 1 - Math.exp(-9.5 * dt)
        const nextX = THREE.MathUtils.lerp(curRoam[0], target[0], glideAlpha)
        const nextZ = THREE.MathUtils.lerp(curRoam[2], target[2], glideAlpha)
        const nextFloorY = THREE.MathUtils.lerp(
          desktopFloorYRef.current,
          target[1],
          glideAlpha,
        )

        const dx = nextX - curRoam[0]
        const dz = nextZ - curRoam[2]
        const dyFloor = nextFloorY - desktopFloorYRef.current
        desktopFloorYRef.current = nextFloorY

        camera.getWorldDirection(scratchCamForward)
        localRoamPoseRef.current = {
          position: [
            Number(nextX.toFixed(3)),
            target[1],
            Number(nextZ.toFixed(3)),
          ],
          yaw: Math.atan2(-scratchCamForward.x, -scratchCamForward.z),
        }

        camera.position.x += dx
        camera.position.y += dyFloor
        camera.position.z += dz
        if (orbitRef.current) {
          orbitRef.current.target.x += dx
          orbitRef.current.target.y += dyFloor
          orbitRef.current.target.z += dz
          orbitRef.current.update()
        }

        if (
          Math.hypot(target[0] - nextX, target[2] - nextZ) < 0.02 &&
          Math.abs(target[1] - nextFloorY) < 0.01
        ) {
          desktopGlideTargetRef.current = null
        }
      }
      const spec =
        ROOM_SIZE_SPECS[architecture.sizePreset] ?? ROOM_SIZE_SPECS.classic
      const detectedWing = detectActiveLoungeWing(
        localRoamPoseRef.current.position[0],
        localRoamPoseRef.current.position[2],
        spec.backZ,
      )
      if (detectedWing !== lastReportedWingRef.current) {
        lastReportedWingRef.current = detectedWing
        onRoamWingChangeRef.current?.(detectedWing)
      }
      return
    }

    // Desktop Seated Camera Glide
    const seatDeltaY = Math.max(0, seat.seatHeightOffset - 0.38)
    const ergonomicFloorY = seat.position[1] + seatDeltaY
    desiredDockPos.set(seat.position[0], ergonomicFloorY, seat.position[2])
    desiredQuat.setFromEuler(tmpEuler.set(0, seat.rotationY, 0))
    if (dockGroupRef.current) {
      dockGroupRef.current.position.lerp(desiredDockPos, rigAlpha)
      dockGroupRef.current.quaternion.slerp(desiredQuat, rigAlpha)
    }

    if (desktopTransitionRemainingRef.current > 0) {
      desktopTransitionRemainingRef.current = Math.max(
        0,
        desktopTransitionRemainingRef.current - dt,
      )
      const camAlpha = 1 - Math.exp(-9.5 * dt)
      const backSin = Math.sin(seat.rotationY)
      const backCos = Math.cos(seat.rotationY)

      desiredCamPos.set(
        seat.position[0] + backSin * 0.14,
        ergonomicFloorY + 1.38,
        seat.position[2] + backCos * 0.14,
      )
      if (seat.lookAtTarget) {
        desiredLookTarget.set(
          seat.lookAtTarget[0],
          seat.lookAtTarget[1],
          seat.lookAtTarget[2],
        )
      } else {
        desiredLookTarget.set(
          screenCenter[0],
          screenCenter[1] - 0.35,
          screenCenter[2] + 1.4,
        )
      }

      camera.position.lerp(desiredCamPos, camAlpha)
      if (orbitRef.current) {
        orbitRef.current.target.lerp(desiredLookTarget, camAlpha)
        orbitRef.current.update()
      } else {
        camera.lookAt(desiredLookTarget)
      }
    }
  })

  return (
    <>
      <XROrigin ref={originRef} />

      {/* VR A/X Hold-to-Aim Comfort Teleport Ring */}
      {inVR && vrTeleportRingPos && (
        <group position={vrTeleportRingPos}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <ringGeometry args={[0.28, 0.36, 32]} />
            <meshBasicMaterial color="#38BDF8" transparent opacity={0.92} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <circleGeometry args={[0.16, 24]} />
            <meshBasicMaterial color="#E5A93C" transparent opacity={0.5} />
          </mesh>
        </group>
      )}

      {/* Ergonomic Spatial Dock & VR Panels anchored at dynamic seat or floating in Walk Mode */}
      <group ref={dockGroupRef}>{children}</group>

      {/* Desktop OrbitControls disabled automatically during immersive VR sessions */}
      <IfInSessionMode deny={['immersive-vr', 'immersive-ar']}>
        <OrbitControls
          ref={orbitRef}
          enablePan={false}
          minDistance={isFreeRoaming ? 0.25 : 0.95}
          maxDistance={isFreeRoaming ? 4.5 : 15.5}
          minPolarAngle={Math.PI * 0.12}
          maxPolarAngle={Math.PI * 0.84}
          rotateSpeed={0.62}
        />
      </IfInSessionMode>
    </>
  )
}

export function App() {
  const signalHandlerRef = useRef<((signal: WebRTCSignalMessage) => void) | null>(null)

  const [passcodeUnlocked, setPasscodeUnlocked] = useState<boolean>(() =>
    isDeviceUnlocked(),
  )
  const passcodeEnabled = isPasscodeGateEnabled()

  const [selectedMicId, setSelectedMicId] = useState('')
  const [selectedSpeakerId, setSelectedSpeakerId] = useState('')
  const [cinemaVolume, setCinemaVolume] = useState(0.8)
  const [voiceVolume, setVoiceVolume] = useState(0.9)
  const [freeRoamWing, setFreeRoamWing] = useState<LoungeWingId>('main-lounge')
  const [gameRoomStreamMuted, setGameRoomStreamMuted] = useState(false)
  const [inVRSession, setInVRSession] = useState(false)
  const [recenterVersion, setRecenterVersion] = useState(0)
  const [spatialChatOpen, setSpatialChatOpen] = useState(true)
  const [youtubeBrowserOpen, setYoutubeBrowserOpen] = useState(false)
  const [youtubeSearchQuery, setYoutubeSearchQuery] = useState('')
  const [youtubeSearchTrigger, setYoutubeSearchTrigger] = useState(0)
  const [buildMode, setBuildMode] = useState(false)
  const [barGamesOpen, setBarGamesOpen] = useState(false)
  const [barGamesTab, setBarGamesTab] = useState<BarGamesTabId>('play')
  const [wardrobeOpen, setWardrobeOpen] = useState(false)
  const [clubhouseOpen, setClubhouseOpen] = useState(false)
  const [clubhouseTab, setClubhouseTab] = useState<ClubhouseDrawerTabId>('rooms')
  const [selectedFurnitureId, setSelectedFurnitureId] = useState<string | null>(null)
  const [editingPosterItemId, setEditingPosterItemId] = useState<string | null>(null)
  const [keyboardMode, setKeyboardMode] = useState<VRKeyboardMode | null>(null)
  const [statusBanner, setStatusBanner] = useState<string | null>(null)
  const [usingSimulator, setUsingSimulator] = useState(false)
  const [dockSummonToggleVersion, setDockSummonToggleVersion] = useState(0)
  const [teleportRequest, setTeleportRequest] = useState<TeleportFloorRequest | null>(
    null,
  )
  const localRoamPoseRef = useRef<{
    position: [number, number, number]
    yaw: number
  }>({
    position: [0, 0, 0.8],
    yaw: 0,
  })

  const room = useRoomSession(signalHandlerRef)
  const barGames = useBarGames({
    roomCode: room.roomCode,
    joined: room.joined,
    localUserId: room.localUserId,
    localProfile: room.localProfile,
    barGamesBridgeRef: room.barGamesBridgeRef,
    broadcastBarGamesEvent: room.broadcastBarGamesEvent,
    appendSystemMessage: room.appendSystemMessage,
  })

  const {
    joined: roomJoined,
    isLocalPresenter: roomIsLocalPresenter,
    presenterState: roomPresenterState,
    localProfile: roomLocalProfile,
    roomCustomization,
    computedSeats,
    selectSeat: roomSelectSeat,
    takeControl: roomTakeControl,
    updatePresenterMedia: roomUpdatePresenterMedia,
    updateLocalProfile: roomUpdateLocalProfile,
    updateRoomCustomization: roomUpdateCustomization,
    resetRoomCustomization: roomResetCustomization,
    importRoomCustomizationJson: roomImportBlueprintJson,
    joinRoom: roomJoinRoom,
  } = room

  const isFreeRoaming = roomLocalProfile.seatId === FREE_ROAM_SEAT_ID

  const activeSeat = useMemo<ComputedSeat>(() => {
    const byId =
      roomLocalProfile.seatId && roomLocalProfile.seatId !== FREE_ROAM_SEAT_ID
        ? computedSeats.find((s) => s.id === roomLocalProfile.seatId)
        : undefined
    const byIndex =
      roomLocalProfile.seatIndex >= 0
        ? computedSeats[roomLocalProfile.seatIndex]
        : undefined
    return byId ?? byIndex ?? computedSeats[0]
  }, [computedSeats, roomLocalProfile.seatId, roomLocalProfile.seatIndex])

  const activeLoungeWing: LoungeWingId = isFreeRoaming
    ? freeRoamWing
    : (activeSeat?.roomWing ?? 'main-lounge')

  // Upgrade #1: Library Audio Isolation (automatically mute main stream inside Library & restore on exit)
  // Plus Upgrade #5: Local mute toggle on The Game Room's mirrored stream screen
  const isLibraryQuietZone = roomJoined && activeLoungeWing === 'library'
  const isGameRoomStreamMuted =
    roomJoined && activeLoungeWing === 'game-room' && gameRoomStreamMuted
  const effectiveCinemaVolume =
    isLibraryQuietZone || isGameRoomStreamMuted ? 0 : cinemaVolume

  const handleEnterFreeRoam = useCallback(() => {
    setFreeRoamWing(activeSeat?.roomWing ?? 'main-lounge')
    roomSelectSeat(FREE_ROAM_SEAT_ID)
  }, [activeSeat?.roomWing, roomSelectSeat])

  const handleTeleportToFloor = useCallback(
    (worldPoint: [number, number, number]) => {
      if (!roomJoined) return
      roomSelectSeat(FREE_ROAM_SEAT_ID)
      localRoamPoseRef.current.position = worldPoint
      const spec =
        ROOM_SIZE_SPECS[roomCustomization.architecture.sizePreset] ??
        ROOM_SIZE_SPECS.classic
      setFreeRoamWing(
        detectActiveLoungeWing(worldPoint[0], worldPoint[2], spec.backZ),
      )
      setTeleportRequest((prev) => ({
        id: (prev?.id ?? 0) + 1,
        position: worldPoint,
      }))
    },
    [roomCustomization.architecture.sizePreset, roomJoined, roomSelectSeat],
  )

  const skyBgColor =
    LIGHTING_PRESETS[roomCustomization.lighting.preset]?.skyBg ?? '#111724'

  const handleScreenShareEndedByBrowser = useCallback(() => {
    if (roomIsLocalPresenter && roomPresenterState.screenMode === 'tab-stream') {
      roomUpdatePresenterMedia({
        screenMode: 'idle',
        isPlaying: false,
      })
    }
  }, [roomIsLocalPresenter, roomPresenterState.screenMode, roomUpdatePresenterMedia])

  const webrtc = useWebRTC({
    joined: room.joined,
    inVRSession,
    localUserId: room.localUserId,
    participants: room.participants,
    activePresenterId: room.presenterState.activePresenterId,
    isMuted: room.localProfile.isMuted,
    selectedMicId,
    sendSignal: room.sendWebRTCSignal,
    onScreenShareEndedByBrowser: handleScreenShareEndedByBrowser,
  })

  const {
    localScreenStream: webrtcLocalScreenStream,
    startTabShare: webrtcStartTabShare,
    stopTabShare: webrtcStopTabShare,
  } = webrtc

  useEffect(() => {
    signalHandlerRef.current = webrtc.handleWebRTCSignal
  }, [webrtc.handleWebRTCSignal])

  const handlePresenterHeartbeatProgress = useCallback(
    (currentTime: number, duration: number) => {
      roomUpdatePresenterMedia(
        {
          currentTime,
          duration,
        },
        false,
      )
    },
    [roomUpdatePresenterMedia],
  )

  const media = useMediaScreen({
    presenterState: room.presenterState,
    localUserId: room.localUserId,
    localScreenStream: webrtc.localScreenStream,
    remoteScreenStreams: webrtc.remoteScreenStreams,
    cinemaVolume: effectiveCinemaVolume,
    selectedSpeakerId,
    onPresenterProgress: handlePresenterHeartbeatProgress,
  })

  const {
    localCurrentTime: mediaLocalCurrentTime,
    localDuration: mediaLocalDuration,
    seekLocalVideo: mediaSeekLocalVideo,
    unlockAudio: unlockMediaAudio,
  } = media

  const handleInVRChange = useCallback(
    (activeVR: boolean) => {
      setInVRSession(activeVR)
      if (!activeVR) {
        setUsingSimulator(false)
      }
      if (roomJoined) {
        roomUpdateLocalProfile({ inVR: activeVR })
      }
    },
    [roomJoined, roomUpdateLocalProfile],
  )

  const handleEnterVR = useCallback(
    async (
      vrAttemptPromise: Promise<{ ok: boolean; usedEmulator: boolean; error?: string }>,
    ) => {
      unlockMediaAudio()
      const res = await vrAttemptPromise
      if (res.ok) {
        setUsingSimulator(res.usedEmulator)
      } else if (res.error) {
        setStatusBanner(res.error)
      }
    },
    [unlockMediaAudio],
  )

  const handleJoinRoom = useCallback(
    async (
      opts: JoinRoomOptions,
      vrAttemptPromise: Promise<{
        ok: boolean
        usedEmulator: boolean
        error?: string
      }> | null,
    ) => {
      unlockMediaAudio()
      if (vrAttemptPromise) {
        const [, vrResult] = await Promise.all([roomJoinRoom(opts), vrAttemptPromise])
        if (vrResult.ok) {
          setUsingSimulator(vrResult.usedEmulator)
        } else {
          roomUpdateLocalProfile({ inVR: false })
          setStatusBanner(
            vrResult.error
              ? `Could not enter VR (${vrResult.error}) — joined room in 3D Desktop Mode.`
              : 'Could not start VR session — joined room in 3D Desktop Mode.',
          )
        }
      } else {
        await roomJoinRoom(opts)
      }
    },
    [roomJoinRoom, roomUpdateLocalProfile, unlockMediaAudio],
  )

  const handleStartTabShare = useCallback(
    async (qualityOverride?: ScreenShareQualityMode, customTitle?: string) => {
      if (!roomIsLocalPresenter) {
        const claimed = roomTakeControl('tab-stream')
        if (!claimed) return
      }
      const result = await webrtcStartTabShare(qualityOverride)
      if (!result.ok) {
        setStatusBanner(result.error ?? 'Unable to share browser tab.')
        return
      }
      roomUpdatePresenterMedia({
        screenMode: 'tab-stream',
        mediaTitle: customTitle || result.title || 'Live Browser Tab',
        isPlaying: true,
      })
    },
    [roomIsLocalPresenter, roomTakeControl, roomUpdatePresenterMedia, webrtcStartTabShare],
  )

  const handleStopTabShare = useCallback(() => {
    webrtcStopTabShare()
    if (roomIsLocalPresenter) {
      roomUpdatePresenterMedia({
        screenMode: 'idle',
        isPlaying: false,
      })
    }
  }, [roomIsLocalPresenter, roomUpdatePresenterMedia, webrtcStopTabShare])

  const handleLoadStreamUrl = useCallback(
    (url: string, title = 'Cinema Stream', useCorsProxy = false) => {
      if (!roomIsLocalPresenter) {
        const claimed = roomTakeControl('url-sync')
        if (!claimed) return
      }
      if (webrtcLocalScreenStream) {
        webrtcStopTabShare()
      }
      roomUpdatePresenterMedia({
        screenMode: 'url-sync',
        mediaUrl: url,
        mediaTitle: title,
        useCorsProxy,
        currentTime: 0,
        isPlaying: true,
      })
      unlockMediaAudio()
    },
    [
      roomIsLocalPresenter,
      roomTakeControl,
      roomUpdatePresenterMedia,
      unlockMediaAudio,
      webrtcLocalScreenStream,
      webrtcStopTabShare,
    ],
  )

  const handleTogglePlayPause = useCallback(() => {
    if (!roomIsLocalPresenter || roomPresenterState.screenMode !== 'url-sync') return
    const nextPlaying = !roomPresenterState.isPlaying
    roomUpdatePresenterMedia({
      isPlaying: nextPlaying,
      currentTime: mediaLocalCurrentTime,
      duration: mediaLocalDuration,
    })
  }, [
    mediaLocalCurrentTime,
    mediaLocalDuration,
    roomIsLocalPresenter,
    roomPresenterState.isPlaying,
    roomPresenterState.screenMode,
    roomUpdatePresenterMedia,
  ])

  const handleSeekTo = useCallback(
    (targetSeconds: number) => {
      if (!roomIsLocalPresenter || roomPresenterState.screenMode !== 'url-sync') return
      const clamped = Math.max(
        0,
        mediaLocalDuration > 0 ? Math.min(mediaLocalDuration, targetSeconds) : targetSeconds,
      )
      mediaSeekLocalVideo(clamped)
      roomUpdatePresenterMedia({
        currentTime: clamped,
        duration: mediaLocalDuration,
      })
    },
    [
      mediaLocalDuration,
      mediaSeekLocalVideo,
      roomIsLocalPresenter,
      roomPresenterState.screenMode,
      roomUpdatePresenterMedia,
    ],
  )

  const handleSeekRelative = useCallback(
    (deltaSeconds: number) => {
      handleSeekTo(mediaLocalCurrentTime + deltaSeconds)
    },
    [handleSeekTo, mediaLocalCurrentTime],
  )

  const handleSeekFraction = useCallback(
    (fraction: number) => {
      if (mediaLocalDuration <= 0) return
      handleSeekTo(fraction * mediaLocalDuration)
    },
    [handleSeekTo, mediaLocalDuration],
  )

  const handleToggleMute = useCallback(() => {
    roomUpdateLocalProfile({ isMuted: !roomLocalProfile.isMuted })
  }, [roomLocalProfile.isMuted, roomUpdateLocalProfile])

  const handleToggleYouTubeBrowser = useCallback(() => {
    setYoutubeBrowserOpen((open) => {
      const next = !open
      if (next) {
        setBuildMode(false)
        setWardrobeOpen(false)
      } else {
        setKeyboardMode((m) => (m === 'youtube' ? null : m))
      }
      return next
    })
  }, [])

  const handleOpenYouTubeBrowser = useCallback(() => {
    setBuildMode(false)
    setWardrobeOpen(false)
    setYoutubeBrowserOpen(true)
  }, [])

  const handleCloseYouTubeBrowser = useCallback(() => {
    setYoutubeBrowserOpen(false)
    setKeyboardMode((m) => (m === 'youtube' ? null : m))
  }, [])

  const handleOpenYouTubeSearchKeyboard = useCallback(() => {
    setYoutubeBrowserOpen(true)
    setKeyboardMode((m) => (m === 'youtube' ? null : 'youtube'))
  }, [])

  const handleSubmitYouTubeSearch = useCallback((query: string) => {
    setYoutubeSearchQuery(query.trim())
    setYoutubeSearchTrigger((n) => n + 1)
    setYoutubeBrowserOpen(true)
  }, [])

  const handleClearYouTubeSearch = useCallback(() => {
    setYoutubeSearchQuery('')
    setYoutubeSearchTrigger((n) => n + 1)
  }, [])

  const handleSelectYouTubeVideo = useCallback(
    (video: YouTubeVideoItem, keepOpen: boolean) => {
      handleLoadStreamUrl(video.playUrl, video.title, false)
      if (!keepOpen) {
        setYoutubeBrowserOpen(false)
      }
      setKeyboardMode(null)
    },
    [handleLoadStreamUrl],
  )

  // =========================================================================
  // HANGOUT BUILDER, ARCHITECTURE, SCREEN, MOOD & AVATAR STUDIO HANDLERS
  // =========================================================================

  const handleToggleWardrobe = useCallback((enabled?: boolean) => {
    setWardrobeOpen((prev) => (typeof enabled === 'boolean' ? enabled : !prev))
    if (enabled !== false) {
      setBuildMode(false)
      setBarGamesOpen(false)
      setClubhouseOpen(false)
      setYoutubeBrowserOpen(false)
    }
  }, [])

  const handleToggleBuildMode = useCallback((enabled?: boolean) => {
    setBuildMode((prev) => (typeof enabled === 'boolean' ? enabled : !prev))
    if (enabled === false) {
      setSelectedFurnitureId(null)
      setEditingPosterItemId(null)
      setKeyboardMode((m) => (m === 'poster' ? null : m))
    } else {
      setYoutubeBrowserOpen(false)
      setBarGamesOpen(false)
      setWardrobeOpen(false)
      setClubhouseOpen(false)
    }
  }, [])

  const handleToggleClubhouse = useCallback(
    (enabled?: boolean, tab?: ClubhouseDrawerTabId) => {
      if (tab) setClubhouseTab(tab)
      setClubhouseOpen((prev) => (typeof enabled === 'boolean' ? enabled : !prev))
      if (enabled !== false) {
        setBuildMode(false)
        setBarGamesOpen(false)
        setWardrobeOpen(false)
        setYoutubeBrowserOpen(false)
      }
    },
    [],
  )

  const handleJumpToDestination = useCallback(
    (dest: ExpansionRoomDestination) => {
      roomSelectSeat(FREE_ROAM_SEAT_ID)
      localRoamPoseRef.current = {
        position: dest.spawnPosition,
        yaw: dest.spawnYaw,
      }
      setFreeRoamWing(dest.id)
      setTeleportRequest((prev) => ({
        id: (prev?.id ?? 0) + 1,
        position: dest.spawnPosition,
        yaw: dest.spawnYaw,
      }))
    },
    [roomSelectSeat],
  )

  const handleUpdateWingState = useCallback(
    (patch: Partial<ExpansionWingSyncedState>) => {
      roomUpdateCustomization((prev) => ({
        ...prev,
        expansionWing: {
          ...resolveExpansionWingState(prev.expansionWing),
          ...patch,
        },
      }))
    },
    [roomUpdateCustomization],
  )

  const handleSpawnFurniture = useCallback(
    (type: FurnitureCatalogId) => {
      const entry = getCatalogEntry(type)
      const newId = `furn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`

      roomUpdateCustomization((prev) => {
        const sizeSpec =
          ROOM_SIZE_SPECS[prev.architecture.sizePreset] ?? ROOM_SIZE_SPECS.classic
        const halfW = sizeSpec.width / 2

        let spawnPos: [number, number, number]
        let spawnRotY = 0

        if (entry.placementSurface === 'wall') {
          const wallItemsCount = prev.furniture.filter(
            (f) => getCatalogEntry(f.type).placementSurface === 'wall',
          ).length
          const mountLeft = wallItemsCount % 2 === 0
          const wallX = mountLeft ? -(halfW - 0.1) : halfW - 0.1
          const wallZ = Number(
            Math.max(
              sizeSpec.frontZ + 2.2,
              Math.min(sizeSpec.backZ - 2.2, activeSeat.position[2] - 0.8),
            ).toFixed(2),
          )
          spawnPos = [Number(wallX.toFixed(2)), 2.75, wallZ]
          spawnRotY = mountLeft ? Math.PI / 2 : -Math.PI / 2
        } else {
          // Spawn ~2.0m in front of the user's current seat with slight jitter to avoid exact overlap
          const jitterX = (prev.furniture.length % 3 - 1) * 0.45
          const rawX =
            activeSeat.position[0] - Math.sin(activeSeat.rotationY) * 2.0 + jitterX
          const rawZ =
            activeSeat.position[2] - Math.cos(activeSeat.rotationY) * 2.0
          const clampedX = Number(
            Math.max(-(halfW - 0.9), Math.min(halfW - 0.9, rawX)).toFixed(2),
          )
          const clampedZ = Number(
            Math.max(
              sizeSpec.frontZ + 1.2,
              Math.min(sizeSpec.backZ - 1.2, rawZ),
            ).toFixed(2),
          )
          const onBalcony =
            prev.architecture.rearBalcony &&
            Math.abs(clampedX) < 4.7 &&
            clampedZ > sizeSpec.balconyZ - 1.65 &&
            clampedZ < sizeSpec.balconyZ + 1.65
          spawnPos = [clampedX, onBalcony ? 0.38 : 0, clampedZ]
          spawnRotY = Number(activeSeat.rotationY.toFixed(4))
        }

        const newItem: PlacedFurnitureItem = {
          id: newId,
          type,
          position: spawnPos,
          rotationY: spawnRotY,
          scale: 1,
          color: entry.defaultColor,
          imageUrl: entry.defaultImageUrl,
          label: entry.defaultLabel,
        }

        return {
          ...prev,
          furniture: [...prev.furniture, newItem],
        }
      })

      setBuildMode(true)
      setSelectedFurnitureId(newId)
    },
    [activeSeat.position, activeSeat.rotationY, roomUpdateCustomization],
  )

  const handleUpdateFurnitureItem = useCallback(
    (id: string, patch: Partial<PlacedFurnitureItem>) => {
      roomUpdateCustomization((prev) => ({
        ...prev,
        furniture: prev.furniture.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }))
    },
    [roomUpdateCustomization],
  )

  const handleDuplicateFurnitureItem = useCallback(
    (id: string) => {
      let clonedId: string | null = null
      roomUpdateCustomization((prev) => {
        const source = prev.furniture.find((f) => f.id === id)
        if (!source) return prev
        clonedId = `furn-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
        const isWall = getCatalogEntry(source.type).placementSurface === 'wall'
        const clone: PlacedFurnitureItem = {
          ...source,
          id: clonedId,
          position: isWall
            ? [
                source.position[0],
                source.position[1],
                Number((source.position[2] + 1.6).toFixed(2)),
              ]
            : [
                Number((source.position[0] + 0.95).toFixed(2)),
                source.position[1],
                Number((source.position[2] + 0.35).toFixed(2)),
              ],
        }
        return {
          ...prev,
          furniture: [...prev.furniture, clone],
        }
      })
      if (clonedId) setSelectedFurnitureId(clonedId)
    },
    [roomUpdateCustomization],
  )

  const handleDeleteFurnitureItem = useCallback(
    (id: string) => {
      roomUpdateCustomization((prev) => ({
        ...prev,
        furniture: prev.furniture.filter((item) => item.id !== id),
      }))
      setSelectedFurnitureId((curr) => (curr === id ? null : curr))
    },
    [roomUpdateCustomization],
  )

  const handleEditFurnitureMediaInVR = useCallback((id: string) => {
    setEditingPosterItemId(id)
    setKeyboardMode('poster')
  }, [])

  const handleSubmitPosterKeyboardValue = useCallback(
    (val: string) => {
      const targetId = editingPosterItemId ?? selectedFurnitureId
      if (!targetId) return
      roomUpdateCustomization((prev) => ({
        ...prev,
        furniture: prev.furniture.map((item) => {
          if (item.id !== targetId) return item
          if (item.type === 'neon-sign') {
            return { ...item, label: val.toUpperCase().slice(0, 16) }
          }
          return { ...item, imageUrl: val }
        }),
      }))
      setEditingPosterItemId(null)
    },
    [editingPosterItemId, roomUpdateCustomization, selectedFurnitureId],
  )

  const handleUpdateArchitecture = useCallback(
    (patch: Partial<RoomArchitectureConfig>) => {
      roomUpdateCustomization((prev) => ({
        ...prev,
        architecture: {
          ...prev.architecture,
          ...patch,
        },
      }))
    },
    [roomUpdateCustomization],
  )

  const handleUpdateLighting = useCallback(
    (patch: Partial<RoomLightingConfig>) => {
      roomUpdateCustomization((prev) => ({
        ...prev,
        lighting: {
          ...prev.lighting,
          ...patch,
        },
      }))
    },
    [roomUpdateCustomization],
  )

  const handleApplyLightingPreset = useCallback(
    (presetId: LightingPresetId) => {
      const spec = LIGHTING_PRESETS[presetId]
      if (!spec) return
      roomUpdateCustomization((prev) => ({
        ...prev,
        lighting: {
          ...prev.lighting,
          preset: presetId,
          brightness: spec.brightness,
          accentColor: spec.accentColor,
          ambientTint: spec.ambientTint,
        },
      }))
    },
    [roomUpdateCustomization],
  )

  const handleUpdateScreen = useCallback(
    (patch: Partial<RoomScreenTransform>) => {
      roomUpdateCustomization((prev) => ({
        ...prev,
        screen: {
          ...prev.screen,
          ...patch,
        },
      }))
    },
    [roomUpdateCustomization],
  )

  const editingPosterInitialValue = useMemo(() => {
    const targetId = editingPosterItemId ?? selectedFurnitureId
    if (!targetId) return ''
    const item = roomCustomization.furniture.find((f) => f.id === targetId)
    if (!item) return ''
    return item.type === 'neon-sign' ? (item.label ?? '') : (item.imageUrl ?? '')
  }, [editingPosterItemId, roomCustomization.furniture, selectedFurnitureId])

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#080a0d]">
      {/* Persistent WebGL / WebXR Canvas (mounted behind Gate & Lobby so store.enterVR() works on click 0) */}
      <Canvas
        events={noEvents}
        dpr={[1, 1.75]}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
        camera={{ fov: 62, near: 0.08, far: 185, position: [0, 1.35, 1.2] }}
      >
        <color attach="background" args={[skyBgColor]} />
        <fog attach="fog" args={[skyBgColor, 34, 125]} />

        <CanvasRootBoundary>
          <XR store={xrStore}>
            <PointerEvents batchEvents={false} />

            {/* Keep XROrigin & core CinemaRoom outside Suspense so VR renders on Frame 0 */}
            <SeatCameraAndOriginRig
              joined={room.joined}
              seat={activeSeat}
              isFreeRoaming={isFreeRoaming}
              architecture={roomCustomization.architecture}
              screenCenter={roomCustomization.screen.position}
              recenterVersion={recenterVersion}
              keyboardOpen={keyboardMode !== null}
              buildMode={buildMode}
              teleportRequest={teleportRequest}
              localRoamPoseRef={localRoamPoseRef}
              onEnterFreeRoam={handleEnterFreeRoam}
              onRoamWingChange={setFreeRoamWing}
              onSummonDockToggle={() => setDockSummonToggleVersion((v) => v + 1)}
              onInVRChange={handleInVRChange}
            >
              {room.joined && (
                <>
                  <SceneSectionBoundary>
                    <YouTubeBrowser3D
                      visible={youtubeBrowserOpen}
                      keyboardOpenForSearch={keyboardMode === 'youtube'}
                      searchQuery={youtubeSearchQuery}
                      searchTrigger={youtubeSearchTrigger}
                      activeMediaUrl={room.presenterState.mediaUrl}
                      relatedVideos={media.relatedVideos}
                      onOpenSearchKeyboard={handleOpenYouTubeSearchKeyboard}
                      onVoiceSearchQuery={handleSubmitYouTubeSearch}
                      onClearSearch={handleClearYouTubeSearch}
                      onSelectVideo={handleSelectYouTubeVideo}
                      onClose={handleCloseYouTubeBrowser}
                    />
                  </SceneSectionBoundary>

                  <SceneSectionBoundary>
                    <BuildModePanel3D
                      visible={buildMode && inVRSession}
                      customization={roomCustomization}
                      selectedFurnitureId={selectedFurnitureId}
                      onSpawnFurniture={handleSpawnFurniture}
                      onUpdateFurnitureItem={handleUpdateFurnitureItem}
                      onDeleteFurnitureItem={handleDeleteFurnitureItem}
                      onEditFurnitureMedia={handleEditFurnitureMediaInVR}
                      onUpdateArchitecture={handleUpdateArchitecture}
                      onUpdateLighting={handleUpdateLighting}
                      onApplyLightingPreset={handleApplyLightingPreset}
                      onUpdateScreen={handleUpdateScreen}
                      onResetRoom={roomResetCustomization}
                      onClose={() => handleToggleBuildMode(false)}
                    />
                  </SceneSectionBoundary>

                  <SceneSectionBoundary>
                    <WardrobeMirror3D
                      open={wardrobeOpen && inVRSession}
                      inVR={true}
                      localProfile={room.localProfile}
                      localMicLevel={webrtc.localMicLevel}
                      onUpdateAvatar={room.updateAvatarAppearance}
                      onClose={() => handleToggleWardrobe(false)}
                    />
                  </SceneSectionBoundary>

                  {(inVRSession ||
                    keyboardMode !== null ||
                    (!isFreeRoaming &&
                      (!activeSeat?.roomWing ||
                        activeSeat.roomWing === 'main-lounge') &&
                      (!activeSeat?.stationKind ||
                        activeSeat.stationKind === 'seat'))) && (
                    <SceneSectionBoundary>
                      <SpatialControlDock
                        presenterState={room.presenterState}
                        isLocalPresenter={room.isLocalPresenter}
                        canTakeControl={room.canTakeControl}
                        isMuted={room.localProfile.isMuted}
                        cinemaVolume={cinemaVolume}
                        voiceVolume={voiceVolume}
                        localCurrentTime={media.localCurrentTime}
                        localDuration={media.localDuration}
                        chatPanelOpen={spatialChatOpen}
                        youtubeBrowserOpen={youtubeBrowserOpen}
                        buildModeOpen={buildMode}
                        wardrobeOpen={wardrobeOpen}
                        youtubeSearchQuery={youtubeSearchQuery}
                        posterInitialValue={editingPosterInitialValue}
                        keyboardMode={keyboardMode}
                        onSetKeyboardMode={setKeyboardMode}
                        onToggleYouTubeBrowser={handleToggleYouTubeBrowser}
                        onToggleBuildMode={() => handleToggleBuildMode()}
                        onToggleWardrobe={() => handleToggleWardrobe()}
                        onSubmitYouTubeSearch={handleSubmitYouTubeSearch}
                        onSubmitPosterValue={handleSubmitPosterKeyboardValue}
                        onTakeControl={() => room.takeControl()}
                        onReleaseControl={() => {
                          webrtc.stopTabShare()
                          room.releaseControl()
                        }}
                        onTogglePlayPause={handleTogglePlayPause}
                        onSeekRelative={handleSeekRelative}
                        onSeekFraction={handleSeekFraction}
                        onSelectStreamUrl={(url, title) => handleLoadStreamUrl(url, title, false)}
                        onStartTabShare={() => void handleStartTabShare()}
                        onToggleMute={handleToggleMute}
                        onChangeCinemaVolume={setCinemaVolume}
                        onChangeVoiceVolume={setVoiceVolume}
                        onSendReaction={(emoji) => room.sendReaction(emoji)}
                        onSendChatMessage={room.sendChatMessage}
                        onToggleChatPanel={() => setSpatialChatOpen((v) => !v)}
                        onRecenterSeat={() => setRecenterVersion((v) => v + 1)}
                        localSeatId={room.localProfile.seatId}
                        onSelectSeat={room.selectSeat}
                        atGameStation={Boolean(
                          !isFreeRoaming &&
                            activeSeat?.stationKind &&
                            activeSeat.stationKind !== 'seat',
                        )}
                        isFreeRoaming={isFreeRoaming}
                        dockSummonToggleVersion={dockSummonToggleVersion}
                      />
                    </SceneSectionBoundary>
                  )}
                </>
              )}
            </SeatCameraAndOriginRig>

            <CinemaRoom
              roomCode={room.roomCode}
              presenterState={room.presenterState}
              roomCustomization={roomCustomization}
              computedSeats={computedSeats}
              videoTexture={media.videoTexture}
              hasVideoFrames={media.hasVideoFrames}
              isResolvingMedia={media.isResolvingMedia}
              activeStreamQuality={media.activeStreamQuality}
              mediaError={media.mediaError}
              needsAudioUnlock={media.needsAudioUnlock}
              localSeatId={room.localProfile.seatId}
              localSeatIndex={room.localProfile.seatIndex}
              participants={room.participants}
              canTakeControl={room.canTakeControl}
              buildMode={buildMode}
              selectedFurnitureId={selectedFurnitureId}
              onTakeControl={() => room.takeControl()}
              onOpenYouTubeBrowser={room.joined ? handleOpenYouTubeBrowser : undefined}
              onUnlockAudio={media.unlockAudio}
              onSelectSeat={room.selectSeat}
              onTeleportToFloor={room.joined ? handleTeleportToFloor : undefined}
              onSelectFurniture={setSelectedFurnitureId}
              onUpdateFurnitureItem={handleUpdateFurnitureItem}
              onDuplicateFurnitureItem={handleDuplicateFurnitureItem}
              onDeleteFurnitureItem={handleDeleteFurnitureItem}
              onEditFurnitureMedia={handleEditFurnitureMediaInVR}
            />

            <SceneSectionBoundary>
              <ExpansionWing3D
                roomCustomization={roomCustomization}
                presenterState={room.presenterState}
                mainVideoTexture={media.videoTexture}
                hasMainVideoFrames={media.hasVideoFrames}
                computedSeats={computedSeats}
                localSeatId={room.localProfile.seatId}
                localDisplayName={room.localProfile.displayName}
                participants={room.participants}
                cinemaVolume={effectiveCinemaVolume}
                cornholeState={barGames.cornholeState}
                holotableState={barGames.holotableState}
                gameRoomStreamMuted={gameRoomStreamMuted}
                onToggleGameRoomStreamMute={() =>
                  setGameRoomStreamMuted((prev) => !prev)
                }
                onRecordCornholeThrow={barGames.recordCornholeThrow}
                onResetCornhole={barGames.resetCornhole}
                onSetHolotableTerrain={barGames.setHolotableTerrain}
                onSelectHolotableMini={barGames.selectHolotableMini}
                onSpawnHolotableMini={barGames.spawnHolotableMini}
                onUpdateHolotableMini={barGames.updateHolotableMini}
                onDeleteHolotableMini={barGames.deleteHolotableMini}
                onResetHolotableMinis={barGames.resetHolotableMinis}
                onToggleHolotableFog={barGames.toggleHolotableFog}
                onToggleHolotableFogCell={barGames.toggleHolotableFogCell}
                onRevealAllHolotableFog={barGames.revealAllHolotableFog}
                onShroudAllHolotableFog={barGames.shroudAllHolotableFog}
                onRecordArcadeScore={barGames.recordArcadeStationScore}
                onSelectSeat={room.selectSeat}
                onTeleportToFloor={room.joined ? handleTeleportToFloor : undefined}
                onJumpToDestination={handleJumpToDestination}
                onUpdateWingState={handleUpdateWingState}
                onUpdateLighting={handleUpdateLighting}
                onApplyLightingPreset={handleApplyLightingPreset}
                onOpenCommandOpsDrawer={
                  !inVRSession
                    ? () => handleToggleClubhouse(true, 'command-ops')
                    : undefined
                }
              />
            </SceneSectionBoundary>

            <SceneSectionBoundary>
              <BarGamesCorner3D
                localUserId={room.localUserId}
                localDisplayName={room.localProfile.displayName}
                localSeatId={room.localProfile.seatId}
                participants={room.participants}
                roomCustomization={roomCustomization}
                buildMode={buildMode}
                dartsState={barGames.dartsState}
                puttingState={barGames.puttingState}
                tabletopState={barGames.tabletopState}
                shuffleboardState={barGames.shuffleboardState}
                clubhouseState={barGames.clubhouseState}
                activeDartShot={barGames.activeDartShot}
                activePuttShot={barGames.activePuttShot}
                onSelectSeat={room.selectSeat}
                onOpen2DPropsDrawer={
                  !inVRSession
                    ? () => {
                        setBuildMode(false)
                        setWardrobeOpen(false)
                        setClubhouseOpen(false)
                        setBarGamesTab('props')
                        setBarGamesOpen(true)
                      }
                    : undefined
                }
                onLaunchDartShot={barGames.launchDartShot}
                onSettleDartShot={barGames.settleDartShot}
                onJoinDarts={barGames.joinDartsMatch}
                onConfigureDarts={barGames.configureDartsMatch}
                onResetDarts={barGames.resetDartsMatch}
                onLaunchPuttShot={barGames.launchPuttShot}
                onSettlePuttShot={barGames.settlePuttShot}
                onJoinPutting={barGames.joinPuttingMatch}
                onConfigurePutting={barGames.configurePuttingMatch}
                onResetBallToTee={barGames.resetPuttingBallToTee}
                onResetPutting={barGames.resetPuttingMatch}
                onRollDice={barGames.rollPolyhedralDice}
                onRerollSingleDie={barGames.rerollSingleDie}
                onSetSurface={barGames.setTableSurface}
                onShuffleDeck={barGames.shuffleDeck}
                onDrawCardToHand={barGames.drawCardToHand}
                onPlayCardFromHand={barGames.playCardFromHand}
                onDealCardToTable={barGames.dealCardToTable}
                onFlipTableCard={barGames.flipTableCard}
                onResetDeck={barGames.resetCardDeck}
                onSpawnToken={barGames.spawnTableToken}
                onMoveToken={barGames.moveTableToken}
                onCreateProp={barGames.createPredictionProp}
                onPickPropOption={barGames.pickPropOption}
                onLockProp={barGames.lockPredictionProp}
                onResolveProp={barGames.resolvePredictionProp}
                onRecordShuffleboardShot={barGames.recordShuffleboardShot}
                onResetShuffleboard={barGames.resetShuffleboard}
              />
            </SceneSectionBoundary>

            <SceneSectionBoundary>
              <AvatarManager
                joined={room.joined}
                localProfile={room.localProfile}
                participants={room.participants}
                computedSeats={computedSeats}
                activePresenterId={room.presenterState.activePresenterId}
                remotePosesRef={room.remotePosesRef}
                localRoamPoseRef={localRoamPoseRef}
                remoteVoiceStreams={webrtc.remoteVoiceStreams}
                voiceVolume={voiceVolume}
                broadcastPose={room.broadcastPose}
              />
            </SceneSectionBoundary>

            <SceneSectionBoundary>
              <WardrobeMirror3D
                open={room.joined && wardrobeOpen && !inVRSession}
                inVR={false}
                localProfile={room.localProfile}
                localMicLevel={webrtc.localMicLevel}
                onUpdateAvatar={room.updateAvatarAppearance}
                onClose={() => handleToggleWardrobe(false)}
              />
            </SceneSectionBoundary>

            <SceneSectionBoundary>
              <SpatialChatPanel
                visible={room.joined && spatialChatOpen}
                messages={room.messages}
                reactions={room.reactions}
                screenTransform={roomCustomization.screen}
                onSendReaction={(emoji) => room.sendReaction(emoji)}
                onOpenChatKeyboard={() => {
                  setSpatialChatOpen(true)
                  setKeyboardMode('chat')
                }}
                onClosePanel={() => setSpatialChatOpen(false)}
              />
            </SceneSectionBoundary>
          </XR>
        </CanvasRootBoundary>
      </Canvas>

      {/* Secret Passcode Gate (blocks unauthenticated visitors before Lobby while keeping Canvas alive) */}
      {!passcodeUnlocked && (
        <PasscodeGate onUnlocked={() => setPasscodeUnlocked(true)} />
      )}

      {/* 2D Lobby & Desktop Companion Presenter Bar */}
      {passcodeUnlocked && (
        <CompanionOverlay
          joined={room.joined}
          connected={room.connected}
          inVRSession={inVRSession}
          roomCode={room.roomCode}
          transportMode={room.transportMode}
          localProfile={room.localProfile}
          participants={room.participants}
          computedSeats={computedSeats}
          roomCustomization={roomCustomization}
          buildMode={buildMode}
          selectedFurnitureId={selectedFurnitureId}
          passcodeEnabled={passcodeEnabled}
          presenterState={room.presenterState}
          isLocalPresenter={room.isLocalPresenter}
          canTakeControl={room.canTakeControl}
          messages={room.messages}
          audioInputs={webrtc.audioInputs}
          audioOutputs={webrtc.audioOutputs}
          selectedMicId={selectedMicId}
          selectedSpeakerId={selectedSpeakerId}
          micPermissionError={webrtc.micPermissionError}
          localMicLevel={webrtc.localMicLevel}
          isSharingTab={Boolean(webrtc.localScreenStream)}
          hasScreenAudioTrack={webrtc.hasScreenAudioTrack}
          screenShareQuality={webrtc.screenShareQuality}
          cinemaVolume={cinemaVolume}
          voiceVolume={voiceVolume}
          localCurrentTime={media.localCurrentTime}
          localDuration={media.localDuration}
          mediaError={media.mediaError}
          needsAudioUnlock={media.needsAudioUnlock}
          statusBanner={statusBanner}
          onDismissBanner={() => setStatusBanner(null)}
          onLockPasscode={() => {
            lockDevicePasscode()
            setPasscodeUnlocked(false)
          }}
          onSelectMic={setSelectedMicId}
          onSelectSpeaker={setSelectedSpeakerId}
          onJoinRoom={handleJoinRoom}
          onEnterVR={handleEnterVR}
          onLeaveRoom={async () => {
            webrtc.stopTabShare()
            setBuildMode(false)
            setBarGamesOpen(false)
            setWardrobeOpen(false)
            setClubhouseOpen(false)
            setSelectedFurnitureId(null)
            await room.leaveRoom()
          }}
          onToggleMute={handleToggleMute}
          onSelectSeat={room.selectSeat}
          onRecenterSeat={() => setRecenterVersion((v) => v + 1)}
          onToggleBuildMode={handleToggleBuildMode}
          onSelectFurniture={setSelectedFurnitureId}
          onSpawnFurniture={handleSpawnFurniture}
          onUpdateFurnitureItem={handleUpdateFurnitureItem}
          onDuplicateFurnitureItem={handleDuplicateFurnitureItem}
          onDeleteFurnitureItem={handleDeleteFurnitureItem}
          onUpdateArchitecture={handleUpdateArchitecture}
          onUpdateLighting={handleUpdateLighting}
          onApplyLightingPreset={handleApplyLightingPreset}
          onUpdateScreen={handleUpdateScreen}
          onResetRoom={roomResetCustomization}
          onImportBlueprintJson={roomImportBlueprintJson}
          onTakeControl={() => room.takeControl()}
          onReleaseControl={() => {
            webrtc.stopTabShare()
            room.releaseControl()
          }}
          onToggleHostLock={room.toggleHostLock}
          onChangeScreenShareQuality={webrtc.setScreenShareQuality}
          onStartTabShare={handleStartTabShare}
          onStopTabShare={handleStopTabShare}
          onLoadStreamUrl={handleLoadStreamUrl}
          onTogglePlayPause={handleTogglePlayPause}
          onSeekTo={handleSeekTo}
          onChangeCinemaVolume={setCinemaVolume}
          onChangeVoiceVolume={setVoiceVolume}
          onUnlockAudio={media.unlockAudio}
          onSendChat={room.sendChatMessage}
          onSendReaction={(emoji) => room.sendReaction(emoji)}
          barGamesOpen={barGamesOpen}
          onToggleBarGames={() => {
            const next = !barGamesOpen
            setBarGamesOpen(next)
            if (next) {
              setWardrobeOpen(false)
              setClubhouseOpen(false)
            }
          }}
          wardrobeOpen={wardrobeOpen}
          onToggleWardrobe={handleToggleWardrobe}
          clubhouseOpen={clubhouseOpen}
          onToggleClubhouse={(open) => handleToggleClubhouse(open)}
        />
      )}

      {/* 2D Clubhouse Wing Directory & Command Ops Drawer */}
      {passcodeUnlocked && room.joined && !inVRSession && (
        <ClubhouseRoomsAndOpsDrawer
          open={clubhouseOpen}
          activeTab={clubhouseTab}
          onChangeTab={setClubhouseTab}
          onClose={() => handleToggleClubhouse(false)}
          roomCustomization={roomCustomization}
          computedSeats={computedSeats}
          participants={room.participants}
          localUserId={room.localUserId}
          localRoamPosition={localRoamPoseRef.current.position}
          onSelectSeat={room.selectSeat}
          onJumpToDestination={handleJumpToDestination}
          onUpdateWingState={handleUpdateWingState}
          onUpdateLighting={handleUpdateLighting}
          onApplyLightingPreset={handleApplyLightingPreset}
        />
      )}

      {/* 2D Avatar Studio & Live 3D Mirror Drawer */}
      {passcodeUnlocked && room.joined && !inVRSession && (
        <AvatarWardrobeDrawer
          open={wardrobeOpen}
          localProfile={room.localProfile}
          onUpdateAvatar={room.updateAvatarAppearance}
          onClose={() => handleToggleWardrobe(false)}
        />
      )}

      {/* 2D Bar Games, Tabletop & Clubhouse Props Drawer */}
      {passcodeUnlocked && room.joined && !inVRSession && (
        <BarGamesDrawer
          open={barGamesOpen}
          activeTab={barGamesTab}
          onChangeTab={setBarGamesTab}
          onClose={() => setBarGamesOpen(false)}
          localUserId={room.localUserId}
          localDisplayName={room.localProfile.displayName}
          localSeatId={room.localProfile.seatId}
          roomCustomization={roomCustomization}
          dartsState={barGames.dartsState}
          puttingState={barGames.puttingState}
          tabletopState={barGames.tabletopState}
          clubhouseState={barGames.clubhouseState}
          hasActiveDartShot={Boolean(barGames.activeDartShot)}
          hasActivePuttShot={Boolean(barGames.activePuttShot)}
          onSelectSeat={room.selectSeat}
          onLaunchDartShot={barGames.launchDartShot}
          onJoinDarts={barGames.joinDartsMatch}
          onConfigureDarts={barGames.configureDartsMatch}
          onResetDarts={barGames.resetDartsMatch}
          onLaunchPuttShot={barGames.launchPuttShot}
          onJoinPutting={barGames.joinPuttingMatch}
          onConfigurePutting={barGames.configurePuttingMatch}
          onResetBallToTee={barGames.resetPuttingBallToTee}
          onResetPutting={barGames.resetPuttingMatch}
          onRollDice={barGames.rollPolyhedralDice}
          onSetSurface={barGames.setTableSurface}
          onShuffleDeck={barGames.shuffleDeck}
          onDrawCardToHand={barGames.drawCardToHand}
          onPlayCardFromHand={barGames.playCardFromHand}
          onDealCardToTable={barGames.dealCardToTable}
          onFlipTableCard={barGames.flipTableCard}
          onResetDeck={barGames.resetCardDeck}
          onSpawnToken={barGames.spawnTableToken}
          onMoveToken={barGames.moveTableToken}
          onClearTokens={barGames.clearTableTokens}
          onCreateProp={barGames.createPredictionProp}
          onPickPropOption={barGames.pickPropOption}
          onLockProp={barGames.lockPredictionProp}
          onResolveProp={barGames.resolvePredictionProp}
          onDeleteProp={barGames.deletePredictionProp}
        />
      )}

      {/* Library Audio Isolation Quiet-Zone Indicator */}
      {passcodeUnlocked && room.joined && isLibraryQuietZone && (
        <div
          id="library-audio-isolation-badge"
          data-effective-volume={effectiveCinemaVolume}
          data-saved-volume={cinemaVolume}
          className="pointer-events-none fixed top-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full border border-orange-400/45 bg-[#120b07]/90 px-4 py-1.5 text-xs font-semibold text-orange-200 shadow-xl backdrop-blur-md"
        >
          <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
          <span>
            🔇 Library Quiet Zone — Main Stream Audio Auto-Muted (Restores to{' '}
            {Math.round(cinemaVolume * 100)}% on Exit)
          </span>
        </div>
      )}

      {/* Game Room Local Stream Mute Indicator */}
      {passcodeUnlocked &&
        room.joined &&
        activeLoungeWing === 'game-room' &&
        !isLibraryQuietZone && (
          <div
            id="gameroom-audio-status-badge"
            data-stream-muted={gameRoomStreamMuted}
            data-effective-volume={effectiveCinemaVolume}
            className="pointer-events-auto fixed top-16 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2.5 rounded-full border border-purple-400/40 bg-[#10091c]/90 px-4 py-1.5 text-xs font-semibold text-purple-200 shadow-xl backdrop-blur-md"
          >
            <span>
              🕹 The Game Room · Main Stream Mirror{' '}
              {gameRoomStreamMuted
                ? 'Muted Locally (0%)'
                : `Audio Live (${Math.round(cinemaVolume * 100)}%)`}
            </span>
            <button
              id="btn-gameroom-hud-mute-toggle"
              type="button"
              onClick={() => setGameRoomStreamMuted((m) => !m)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold transition ${
                gameRoomStreamMuted
                  ? 'bg-red-500/30 text-red-200 hover:bg-red-500/45'
                  : 'bg-emerald-500/30 text-emerald-200 hover:bg-emerald-500/45'
              }`}
            >
              {gameRoomStreamMuted ? 'Unmute Stream' : 'Mute Stream'}
            </button>
          </div>
        )}

      {inVRSession && usingSimulator && (
        <button
          id="btn-exit-vr-simulator"
          type="button"
          onClick={() => exitVRSession()}
          style={{ zIndex: 1100 }}
          className="pointer-events-auto fixed bottom-4 left-4 flex items-center gap-2 rounded-xl border border-[#e5a93c]/50 bg-[#080a0d]/90 px-4 py-2.5 text-xs font-semibold text-[#f4f1ea] shadow-xl backdrop-blur-md transition hover:border-[#e5a93c] hover:bg-[#141922]"
        >
          <span className="h-2 w-2 rounded-full bg-[#e5a93c]" />
          <span>Exit Quest 3 Simulator (Return to 2D Controls)</span>
        </button>
      )}
    </div>
  )
}

export default App
