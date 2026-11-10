import { createXRStore } from '@react-three/xr'
import { SafeXRController, SafeXRHand } from '../components/xr/SafeXRInputs'

/**
 * Shared @react-three/xr v6 store configured specifically for Meta Quest 3
 * immersive VR watch parties (72Hz/90Hz) without unnecessary AR spatial-mesh
 * permission popups or competing `offerSession` locks.
 */
export const xrStore = createXRStore({
  offerSession: false,
  emulate: false,
  foveation: 0.5,
  frameRate: false,
  handTracking: true,
  // CRITICAL: Must be `true` (`optionalFeatures: ['layers']`) because Three.js WebXRManager
  // uses `XRWebGLBinding.createProjectionLayer` whenever `XRWebGLBinding` exists (Meta Quest 3).
  // Setting `layers: false` causes `setSession()` to throw `NotSupportedError` and leave VR black.
  layers: true,
  meshDetection: false,
  planeDetection: false,
  anchors: false,
  hitTest: false,
  domOverlay: false,
  controller: SafeXRController,
  hand: SafeXRHand,
  gaze: false,
})

export type VRSupportKind = 'checking' | 'native' | 'simulator-ready'

let cachedNativeVRSupported: boolean | null = null
let simulatorInstalled = false
const supportListeners = new Set<(kind: VRSupportKind) => void>()

function notifySupportListeners() {
  const current = getVRSupportKind()
  for (const fn of supportListeners) {
    fn(current)
  }
}

export function getVRSupportKind(): VRSupportKind {
  if (cachedNativeVRSupported === true && !simulatorInstalled) return 'native'
  if (cachedNativeVRSupported === null) return 'checking'
  return 'simulator-ready'
}

export function subscribeVRSupport(listener: (kind: VRSupportKind) => void): () => void {
  supportListeners.add(listener)
  return () => {
    supportListeners.delete(listener)
  }
}

function probeNativeVRSupport(): void {
  if (typeof navigator === 'undefined' || !navigator.xr?.isSessionSupported) {
    cachedNativeVRSupported = false
    notifySupportListeners()
    return
  }

  navigator.xr
    .isSessionSupported('immersive-vr')
    .then((supported) => {
      cachedNativeVRSupported = Boolean(supported)
      notifySupportListeners()
    })
    .catch(() => {
      cachedNativeVRSupported = false
      notifySupportListeners()
    })
}

// Pre-probe on module load so button clicks never need to `await isSessionSupported()`
// before calling `navigator.xr.requestSession('immersive-vr')` inside a user gesture.
probeNativeVRSupport()

let inFlightSimulatorPromise: Promise<{
  ok: boolean
  usedEmulator: boolean
  error?: string
}> | null = null

async function installQuest3SimulatorAndEnter(): Promise<{
  ok: boolean
  usedEmulator: boolean
  error?: string
}> {
  if (inFlightSimulatorPromise) return inFlightSimulatorPromise

  inFlightSimulatorPromise = (async () => {
    try {
      if (!simulatorInstalled) {
        const [{ XRDevice, metaQuest3 }, { DevUI }] = await Promise.all([
          import('iwer'),
          import('@iwer/devui'),
        ])
        const xrDevice = new XRDevice(metaQuest3, {
          ipd: 0,
          stereoEnabled: false,
        })
        xrDevice.position.set(0, 1.2, 0)
        xrDevice.primaryInputMode = 'controller'
        xrDevice.installRuntime({ forceInstall: true })
        xrDevice.installDevUI(DevUI)
        simulatorInstalled = true
        cachedNativeVRSupported = true
        notifySupportListeners()
      }
      try {
        await xrStore.enterVR()
      } catch (firstErr) {
        const msg = firstErr instanceof Error ? firstErr.message : String(firstErr)
        if (msg.includes('not connected to three.js')) {
          await new Promise<void>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r())),
          )
          await xrStore.enterVR()
        } else {
          throw firstErr
        }
      }
      return { ok: true, usedEmulator: true }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unable to start WebXR session in this browser.'
      return { ok: false, usedEmulator: false, error: message }
    } finally {
      inFlightSimulatorPromise = null
    }
  })()

  return inFlightSimulatorPromise
}

/**
 * MUST be invoked synchronously as the VERY FIRST CALL inside a DOM button `onClick` handler!
 *
 * Why this function is NOT declared `async`:
 * On Meta Quest Browser (and Chromium WebXR), `navigator.xr.requestSession('immersive-vr')`
 * must execute on the exact synchronous tick of the user tap—any preceding `await` expires
 * transient user activation and causes `requestSession` to be rejected.
 */
export function triggerEnterVRFromGesture(): Promise<{
  ok: boolean
  usedEmulator: boolean
  error?: string
}> {
  const hasXRObject = typeof navigator !== 'undefined' && navigator.xr != null
  const isQuestHeadset =
    typeof navigator !== 'undefined' &&
    /Quest|OculusBrowser|MetaQuest/i.test(navigator.userAgent)

  // Path 1: Native Quest 3 / PCVR headset (or still probing on a device with navigator.xr)
  if (hasXRObject && (cachedNativeVRSupported !== false || simulatorInstalled || isQuestHeadset)) {
    // SYNCHRONOUS call on tick 0 of the click event!
    const nativePromise = xrStore.enterVR()
    return nativePromise.then(
      (session) => {
        // Gently request 90Hz if supported without failing session setup if declined
        if (session?.supportedFrameRates?.includes(90)) {
          void session.updateTargetFrameRate(90).catch(() => undefined)
        }
        return {
          ok: true,
          usedEmulator: simulatorInstalled,
        }
      },
      async (err: unknown) => {
        const errName = err instanceof DOMException ? err.name : ''
        const errMsg = err instanceof Error ? err.message : String(err)

        // Only fall back to desktop simulator when NOT on a physical Quest headset
        // and native immersive-vr is genuinely unsupported (desktop browser without headset).
        if (
          !isQuestHeadset &&
          cachedNativeVRSupported !== true &&
          !simulatorInstalled &&
          (errName === 'NotSupportedError' ||
            errMsg.toLowerCase().includes('not supported'))
        ) {
          cachedNativeVRSupported = false
          return installQuest3SimulatorAndEnter()
        }

        // Ensure any half-opened session is closed so headset never stays on a blank screen
        const dangling = xrStore.getState().session
        if (dangling) {
          void dangling.end().catch(() => undefined)
        }

        return {
          ok: false,
          usedEmulator: false,
          error: errMsg || 'WebXR session request was declined.',
        }
      },
    )
  }

  // Path 2: Desktop / browser without native WebXR -> launch interactive Quest 3 Simulator
  const isTouchMobile =
    typeof navigator !== 'undefined' &&
    /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) &&
    !isQuestHeadset

  if (isTouchMobile) {
    return Promise.resolve({
      ok: false,
      usedEmulator: false,
      error:
        'Open this link inside Meta Quest Browser on your Quest 3 for VR, or tap "Join in Desktop Mode" on mobile.',
    })
  }

  return installQuest3SimulatorAndEnter()
}

export function exitVRSession(): void {
  if (typeof document !== 'undefined' && document.pointerLockElement) {
    try {
      document.exitPointerLock()
    } catch {
      // Ignore pointer lock exit errors
    }
  }
  const activeSession = xrStore.getState().session
  if (activeSession) {
    void activeSession.end().catch(() => undefined)
  }
}
