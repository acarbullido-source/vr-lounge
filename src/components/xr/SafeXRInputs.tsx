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
        {/* Ergonomic matte obsidian grip handle */}
        <mesh position={[0, -0.032, 0.032]} rotation={[0.42, 0, 0]}>
          <capsuleGeometry args={[0.017, 0.075, 6, 12]} />
          <meshStandardMaterial color="#1b212d" roughness={0.45} metalness={0.35} />
        </mesh>
        {/* Top thumbpad face */}
        <mesh position={[0, 0.008, -0.004]} rotation={[-0.25, 0, 0]}>
          <cylinderGeometry args={[0.025, 0.022, 0.012, 18]} />
          <meshStandardMaterial color="#12161f" roughness={0.35} metalness={0.45} />
        </mesh>
        {/* Warm tungsten status ring */}
        <mesh position={[0, 0.015, -0.005]} rotation={[Math.PI / 2 - 0.25, 0, 0]}>
          <torusGeometry args={[0.022, 0.0022, 8, 24]} />
          <meshBasicMaterial color="#e5a93c" />
        </mesh>
      </group>
    </XRSpace>
  )
}

/**
 * Minimalist procedural wrist/pinch marker rendered while hand GLTF loads or if offline.
 */
function ProceduralQuestHand() {
  return (
    <>
      <XRSpace space="wrist">
        <mesh>
          <boxGeometry args={[0.052, 0.016, 0.038]} />
          <meshStandardMaterial
            color="#222938"
            roughness={0.45}
            metalness={0.3}
            transparent
            opacity={0.85}
          />
        </mesh>
      </XRSpace>
      <XRSpace space="index-finger-tip">
        <mesh>
          <sphereGeometry args={[0.007, 10, 10]} />
          <meshBasicMaterial color="#e5a93c" />
        </mesh>
      </XRSpace>
    </>
  )
}

/**
 * Crash-proof Quest 3 controller implementation:
 * - Ray pointer (`#E5A93C`) is mounted outside `<Suspense>` so pointing works on Frame 0.
 * - GLTF controller model is wrapped in both `<Suspense>` and `<XRModelErrorBoundary>`
 *   inside the R3F `XRElements` portal so a CDN timeout/block can never crash `<XR>`.
 */
export function SafeXRController() {
  const fallback = <ProceduralQuestController />
  return (
    <>
      <XRModelErrorBoundary fallback={fallback}>
        <Suspense fallback={fallback}>
          <XRControllerModel />
        </Suspense>
      </XRModelErrorBoundary>

      <CombinedPointer>
        <DefaultXRInputSourceRayPointer
          makeDefault
          minDistance={0.2}
          rayModel={{
            color: '#E5A93C',
            opacity: 0.78,
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
