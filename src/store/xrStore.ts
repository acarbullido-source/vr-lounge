import { createXRStore } from '@react-three/xr'

/**
 * Shared @react-three/xr v6 store configured for Meta Quest 3 (72Hz/90Hz)
 * and desktop pointer parity.
 *
 * - `offerSession: 'immersive-vr'` prompts the Meta Quest Browser directly for VR.
 * - `emulate` automatically provides a Quest 3 WebXR runtime on `localhost` when no
 *   physical headset is attached, while LAN connections (`https://<LAN-IP>:5173`) on
 *   Meta Quest 3 use the native hardware WebXR runtime directly.
 * - `handTracking: true` enables both Quest Touch Plus controllers and bare hands.
 */
export const xrStore = createXRStore({
  offerSession: 'immersive-vr',
  emulate: {
    type: 'metaQuest3',
    syntheticEnvironment: false,
  },
  foveation: 1,
  frameRate: 'high',
  handTracking: true,
  controller: {
    teleportPointer: false,
    grabPointer: false,
    rayPointer: {
      rayModel: {
        color: '#E5A93C',
        opacity: 0.78,
      },
      cursorModel: {
        color: '#F4F1EA',
      },
    },
  },
  hand: {
    teleportPointer: false,
    grabPointer: false,
    touchPointer: {
      cursorModel: {
        color: '#E5A93C',
      },
    },
    rayPointer: {
      rayModel: {
        color: '#E5A93C',
        opacity: 0.65,
      },
      cursorModel: {
        color: '#F4F1EA',
      },
    },
  },
  gaze: false,
})

/**
 * Enters an immersive WebXR VR session (`xrStore.enterVR()`), activating the built-in
 * Quest 3 WebXR emulator if invoked from a desktop browser without native WebXR hardware.
 */
export async function enterVRWithFallback(): Promise<{
  ok: boolean
  usedEmulator: boolean
  error?: string
}> {
  try {
    const xrSystem = typeof navigator !== 'undefined' ? navigator.xr : undefined
    const hasNativeOrInjectedXR =
      xrSystem != null &&
      (await xrSystem.isSessionSupported('immersive-vr').catch(() => false))

    if (hasNativeOrInjectedXR) {
      const isLocalDesktop =
        typeof window !== 'undefined' && window.location.hostname === 'localhost'
      await xrStore.enterVR()
      return { ok: true, usedEmulator: isLocalDesktop && !('ontouchstart' in window) }
    }

    // Trigger @pmndrs/xr's built-in Quest 3 emulator shortcut on non-localhost desktop browsers
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new KeyboardEvent('keydown', {
          altKey: true,
          metaKey: true,
          code: 'KeyE',
        }),
      )
      await new Promise((resolve) => window.setTimeout(resolve, 250))
      if (navigator.xr) {
        await xrStore.enterVR()
        return { ok: true, usedEmulator: true }
      }
    }

    return {
      ok: false,
      usedEmulator: false,
      error:
        'WebXR immersive-vr is unavailable. Open this HTTPS URL in the Meta Quest Browser or Chrome/Edge.',
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to start WebXR session'
    return { ok: false, usedEmulator: false, error: message }
  }
}
