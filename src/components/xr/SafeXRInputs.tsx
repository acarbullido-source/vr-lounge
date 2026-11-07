import {
  CombinedPointer,
  DefaultXRHandTouchPointer,
  DefaultXRInputSourceRayPointer,
  XRControllerModel,
  XRHandModel,
  XRSpace,
} from '@react-three/xr'
import { Component, Suspense, type ReactNode } from 'react'

class XRModelErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true }
  }

  componentDidCatch(err: unknown) {
    console.warn('XR input model fell back to procedural mesh:', err)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}

/**
 * Sleek procedural Meta Quest 3 Touch Plus silhouette rendered on Frame 0 while
 * `@webxr-input-profiles` GLTF loads from CDN (and permanently if offline/blocked).
 */
function ProceduralQuestController() {
  return (
    <XRSpace space="grip-space">
      <group>
        {/* Ergonomic slate-titanium grip handle (clearly visible in dark Movie Mode) */}
        <mesh position={[0, -0.032, 0.032]} rotation={[0.42, 0, 0]} raycast={() => null}>
          <capsuleGeometry args={[0.017, 0.075, 6, 12]} />
          <meshStandardMaterial color="#283347" roughness={0.38} metalness={0.42} />
        </mesh>
        {/* Top thumbpad face */}
        <mesh position={[0, 0.008, -0.004]} rotation={[-0.25, 0, 0]} raycast={() => null}>
          <cylinderGeometry args={[0.025, 0.022, 0.012, 18]} />
          <meshStandardMaterial color="#182030" roughness={0.32} metalness={0.48} />
        </mesh>
        {/* Warm tungsten status ring */}
        <mesh
          position={[0, 0.015, -0.005]}
          rotation={[Math.PI / 2 - 0.25, 0, 0]}
          raycast={() => null}
        >
          <torusGeometry args={[0.022, 0.0024, 8, 24]} />
          <meshBasicMaterial color="#e5a93c" />
        </mesh>
      </group>
    </XRSpace>
  )
}

/**
 * Subtle always-visible aim beam rendered in `target-ray-space` (`-Z` forward).
 * `@pmndrs/xr`'s `DefaultXRInputSourceRayPointer` hides its ray whenever `intersection == null`
 * (e.g. pointing at open air, ceiling, or non-interactive walls), which previously made it
 * feel as if controller tracking dropped when turning around. `raycast={() => null}` ensures
 * this guide beam never intercepts pointer raycasts.
 */
function AlwaysOnControllerAimGuide() {
  return (
    <group>
      {/* Glowing emitter nozzle dot */}
      <mesh position={[0, 0, -0.018]} raycast={() => null}>
        <sphereGeometry args={[0.0032, 8, 8]} />
        <meshBasicMaterial color="#38BDF8" />
      </mesh>
      {/* Soft 0.44m tapered aim beam along -Z */}
      <mesh
        position={[0, 0, -0.24]}
        rotation={[Math.PI / 2, 0, 0]}
        raycast={() => null}
      >
        <cylinderGeometry args={[0.0005, 0.0016, 0.44, 8]} />
        <meshBasicMaterial
          color="#E5A93C"
          transparent
          opacity={0.32}
          depthWrite={false}
        />
      </mesh>
    </group>
  )
}

/**
 * Minimalist procedural wrist/pinch marker rendered while hand GLTF loads or if offline.
 */
function ProceduralQuestHand() {
  return (
    <>
      <XRSpace space="wrist">
        <mesh raycast={() => null}>
          <boxGeometry args={[0.052, 0.016, 0.038]} />
          <meshStandardMaterial
            color="#283347"
            roughness={0.42}
            metalness={0.35}
            transparent
            opacity={0.88}
          />
        </mesh>
      </XRSpace>
      <XRSpace space="index-finger-tip">
        <mesh raycast={() => null}>
          <sphereGeometry args={[0.007, 10, 10]} />
          <meshBasicMaterial color="#e5a93c" />
        </mesh>
      </XRSpace>
    </>
  )
}

/**
 * Crash-proof Quest 3 controller implementation:
 * - Always-on subtle aim guide keeps hand pose & pointing direction visible 100% of the time.
 * - Full-length `#E5A93C` pointer ray + `#F4F1EA` cursor illuminate on any interactive target.
 * - GLTF controller model is wrapped in both `<Suspense>` and `<XRModelErrorBoundary>`
 *   inside the R3F `XRElements` portal so a CDN timeout/block can never crash `<XR>`.
 */
export function SafeXRController() {
  const fallback = <ProceduralQuestController />
  return (
    <>
      <AlwaysOnControllerAimGuide />

      <XRModelErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <XRControllerModel />
        </Suspense>
      </XRModelErrorBoundary>

      <CombinedPointer>
        <DefaultXRInputSourceRayPointer
          makeDefault
          minDistance={0.15}
          rayModel={{
            color: '#E5A93C',
            opacity: 0.84,
          }}
          cursorModel={{
            color: '#F4F1EA',
          }}
        />
      </CombinedPointer>
    </>
  )
}

/**
 * Crash-proof Quest 3 hand-tracking implementation with Frame-0 touch + ray pointers.
 */
export function SafeXRHand() {
  const fallback = <ProceduralQuestHand />
  return (
    <>
      <XRModelErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <XRHandModel />
        </Suspense>
      </XRModelErrorBoundary>

      <CombinedPointer>
        <DefaultXRHandTouchPointer
          cursorModel={{
            color: '#E5A93C',
          }}
        />
        <DefaultXRInputSourceRayPointer
          makeDefault
          minDistance={0.2}
          rayModel={{
            color: '#E5A93C',
            opacity: 0.65,
            maxLength: 0.2,
          }}
          cursorModel={{
            color: '#F4F1EA',
          }}
        />
      </CombinedPointer>
    </>
  )
}
