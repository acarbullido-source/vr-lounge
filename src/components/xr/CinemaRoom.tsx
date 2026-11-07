import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import { Suspense, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { SCREEN_CONFIG } from '../../constants/cinema'
import {
  ROOM_MATERIAL_THEMES,
  ROOM_SIZE_SPECS,
  getCatalogEntry,
} from '../../constants/hangout'
import type {
  ComputedSeat,
  ParticipantProfile,
  PlacedFurnitureItem,
  PresenterState,
  RoomCustomizationState,
} from '../../types/lounge'
import { ProceduralFurnitureLayer } from './ProceduralFurniture'

export interface CinemaRoomProps {
  roomCode: string
  presenterState: PresenterState
  roomCustomization: RoomCustomizationState
  computedSeats: ComputedSeat[]
  videoTexture: THREE.VideoTexture
  hasVideoFrames: boolean
  isResolvingMedia?: boolean
  activeStreamQuality?: string | null
  mediaError: string | null
  needsAudioUnlock: boolean
  localSeatId: string | undefined
  localSeatIndex: number
  participants: ParticipantProfile[]
  canTakeControl: boolean
  buildMode: boolean
  selectedFurnitureId: string | null
  onTakeControl: () => void
  onOpenYouTubeBrowser?: () => void
  onUnlockAudio: () => void
  onSelectSeat: (seatId: string) => void
  onTeleportToFloor?: (worldPoint: [number, number, number]) => void
  onSelectFurniture: (id: string | null) => void
  onUpdateFurnitureItem: (id: string, patch: Partial<PlacedFurnitureItem>) => void
  onDuplicateFurnitureItem: (id: string) => void
  onDeleteFurnitureItem: (id: string) => void
  onEditFurnitureMedia?: (id: string) => void
}

function createCurvedScreenGeometry(
  width: number,
  height: number,
  radius: number,
  segmentsX = 48,
): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(width, height, segmentsX, 2)
  const pos = geometry.attributes.position

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const theta = x / radius
    const curvedX = radius * Math.sin(theta)
    const curvedZ = radius * (1 - Math.cos(theta))
    pos.setX(i, curvedX)
    pos.setZ(i, curvedZ)
  }

  pos.needsUpdate = true
  geometry.computeVertexNormals()
  return geometry
}

const STARFIELD_POSITIONS = (() => {
  const count = 90
  const arr = new Float32Array(count * 3)
  for (let i = 0; i < count; i++) {
    arr[i * 3] = (((i * 97) % 100) / 100 - 0.5) * 11.5
    arr[i * 3 + 1] = (((i * 53) % 100) / 100) * 0.35
    arr[i * 3 + 2] = (((i * 137) % 100) / 100 - 0.5) * 11.5
  }
  return arr
})()

export function CinemaRoom({
  roomCode,
  presenterState,
  roomCustomization,
  computedSeats,
  videoTexture,
  hasVideoFrames,
  isResolvingMedia = false,
  activeStreamQuality = null,
  mediaError,
  needsAudioUnlock,
  localSeatId,
  localSeatIndex,
  participants,
  canTakeControl,
  buildMode,
  selectedFurnitureId,
  onTakeControl,
  onOpenYouTubeBrowser,
  onUnlockAudio,
  onSelectSeat,
  onTeleportToFloor,
  onSelectFurniture,
  onUpdateFurnitureItem,
  onDuplicateFurnitureItem,
  onDeleteFurnitureItem,
  onEditFurnitureMedia,
}: CinemaRoomProps) {
  const ambientLightRef = useRef<THREE.AmbientLight>(null)
  const hemiLightRef = useRef<THREE.HemisphereLight>(null)
  const screenGlowRef = useRef<THREE.PointLight>(null)
  const leftMoodLightRef = useRef<THREE.PointLight>(null)
  const rightMoodLightRef = useRef<THREE.PointLight>(null)
  const ceilingFillRef = useRef<THREE.PointLight>(null)

  const [screenHovered, setScreenHovered] = useState(false)
  const [ytBtnHovered, setYtBtnHovered] = useState(false)
  const [draggingPlacement, setDraggingPlacement] = useState(false)
  const [hoverReticle, setHoverReticle] = useState<[number, number, number] | null>(null)
  const [walkTargetRing, setWalkTargetRing] = useState<[number, number, number] | null>(null)
  const walkRingTimerRef = useRef<number | null>(null)

  const { architecture, lighting, screen, furniture } = roomCustomization
  const sizeSpec = ROOM_SIZE_SPECS[architecture.sizePreset] ?? ROOM_SIZE_SPECS.classic
  const themeSpec =
    ROOM_MATERIAL_THEMES[architecture.materialTheme] ??
    ROOM_MATERIAL_THEMES['obsidian-theater']

  const halfW = sizeSpec.width / 2
  const centerZ = (sizeSpec.frontZ + sizeSpec.backZ) / 2
  const roomDepth = sizeSpec.backZ - sizeSpec.frontZ

  const selectedItem = useMemo(
    () =>
      buildMode && selectedFurnitureId
        ? furniture.find((f) => f.id === selectedFurnitureId) ?? null
        : null,
    [buildMode, furniture, selectedFurnitureId],
  )
  const selectedEntry = selectedItem ? getCatalogEntry(selectedItem.type) : null

  const curvedScreenGeo = useMemo(
    () =>
      createCurvedScreenGeometry(
        SCREEN_CONFIG.width,
        SCREEN_CONFIG.height,
        SCREEN_CONFIG.curveRadius,
      ),
    [],
  )
  const curvedFrameGeo = useMemo(
    () =>
      createCurvedScreenGeometry(
        SCREEN_CONFIG.width + 0.34,
        SCREEN_CONFIG.height + 0.34,
        SCREEN_CONFIG.curveRadius + 0.05,
      ),
    [],
  )
  const flatScreenGeo = useMemo(
    () => new THREE.PlaneGeometry(SCREEN_CONFIG.width, SCREEN_CONFIG.height),
    [],
  )
  const flatFrameGeo = useMemo(
    () => new THREE.PlaneGeometry(SCREEN_CONFIG.width + 0.34, SCREEN_CONFIG.height + 0.34),
    [],
  )

  const starGeometry = useMemo(() => {
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(STARFIELD_POSITIONS, 3))
    return geo
  }, [])

  const isShowingVideo =
    presenterState.screenMode !== 'idle' &&
    Boolean(presenterState.activePresenterId) &&
    hasVideoFrames &&
    !mediaError

  const isActivelyPlayingMedia =
    (presenterState.screenMode === 'url-sync' &&
      Boolean(presenterState.activePresenterId) &&
      presenterState.isPlaying) ||
    (presenterState.screenMode === 'tab-stream' &&
      Boolean(presenterState.activePresenterId))

  const targetAccentColor = useMemo(
    () => new THREE.Color(lighting.accentColor || '#E5A93C'),
    [lighting.accentColor],
  )
  const targetAmbientColor = useMemo(
    () => new THREE.Color(lighting.ambientTint || '#DCE4F5'),
    [lighting.ambientTint],
  )

  // Smoothly interpolate mood brightness, colors & playback Auto-Dim at 72Hz/90Hz
  useFrame(({ clock }, delta) => {
    const lerpAlpha = 1 - Math.exp(-4.5 * Math.min(delta, 0.1))
    const dimFactor =
      lighting.autoDimOnPlay && isActivelyPlayingMedia && !buildMode ? 0.24 : 1.0
    const masterGain = Math.max(0.12, lighting.brightness * dimFactor)

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = THREE.MathUtils.lerp(
        ambientLightRef.current.intensity,
        0.52 * masterGain,
        lerpAlpha,
      )
      ambientLightRef.current.color.lerp(targetAmbientColor, lerpAlpha)
    }

    if (hemiLightRef.current) {
      hemiLightRef.current.intensity = THREE.MathUtils.lerp(
        hemiLightRef.current.intensity,
        1.55 * masterGain,
        lerpAlpha,
      )
    }

    if (leftMoodLightRef.current) {
      leftMoodLightRef.current.intensity = THREE.MathUtils.lerp(
        leftMoodLightRef.current.intensity,
        8.8 * masterGain,
        lerpAlpha,
      )
      leftMoodLightRef.current.color.lerp(targetAccentColor, lerpAlpha)
    }

    if (rightMoodLightRef.current) {
      rightMoodLightRef.current.intensity = THREE.MathUtils.lerp(
        rightMoodLightRef.current.intensity,
        8.8 * masterGain,
        lerpAlpha,
      )
      rightMoodLightRef.current.color.lerp(targetAccentColor, lerpAlpha)
    }

    if (ceilingFillRef.current) {
      ceilingFillRef.current.intensity = THREE.MathUtils.lerp(
        ceilingFillRef.current.intensity,
        6.0 * masterGain,
        lerpAlpha,
      )
      ceilingFillRef.current.color.lerp(targetAmbientColor, lerpAlpha)
    }

    if (screenGlowRef.current) {
      if (isShowingVideo && presenterState.isPlaying) {
        const wave =
          Math.sin(clock.elapsedTime * 1.9) * 1.5 +
          Math.cos(clock.elapsedTime * 0.7) * 0.9
        screenGlowRef.current.intensity = 18.5 + wave
      } else {
        screenGlowRef.current.intensity = THREE.MathUtils.lerp(
          screenGlowRef.current.intensity,
          11.0 * Math.max(0.45, masterGain),
          lerpAlpha,
        )
      }
    }
  })

  const wallSlatOffsets = useMemo(() => {
    const list: number[] = []
    for (let z = sizeSpec.frontZ + 1.4; z <= sizeSpec.backZ - 1.2; z += 1.85) {
      list.push(Number(z.toFixed(2)))
    }
    return list
  }, [sizeSpec.backZ, sizeSpec.frontZ])

  // Floor placement handler in Build Mode (supports both one-click point-to-move and drag)
  const applyFloorPlacement = (pt: THREE.Vector3) => {
    if (!buildMode || !selectedItem || selectedEntry?.placementSurface !== 'floor') return
    const maxW = halfW + (architecture.leftBarAlcove && pt.x < 0 ? 3.2 : 0) + (architecture.rightArcadeAlcove && pt.x > 0 ? 3.2 : 0) - 0.55
    const clampedX = Math.max(-maxW, Math.min(maxW, Number(pt.x.toFixed(2))))
    const clampedZ = Math.max(
      sizeSpec.frontZ + 0.7,
      Math.min(sizeSpec.backZ - 0.7, Number(pt.z.toFixed(2))),
    )
    const onBalcony =
      architecture.rearBalcony &&
      Math.abs(clampedX) < 4.7 &&
      clampedZ > sizeSpec.balconyZ - 1.65 &&
      clampedZ < sizeSpec.balconyZ + 1.65
    const targetY = onBalcony ? 0.38 : 0

    onUpdateFurnitureItem(selectedItem.id, {
      position: [clampedX, targetY, clampedZ],
    })
  }

  const handleFloorPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!buildMode || !selectedItem || selectedEntry?.placementSurface !== 'floor') return
    e.stopPropagation()
    setHoverReticle([e.point.x, e.point.y + 0.02, e.point.z])
    if (draggingPlacement) {
      applyFloorPlacement(e.point)
    }
  }

  // Wall placement handler for posters & neon signs in Build Mode
  const applyWallPlacement = (pt: THREE.Vector3, wallRotY: number) => {
    if (!buildMode || !selectedItem || selectedEntry?.placementSurface !== 'wall') return
    const clampedY = Math.max(1.2, Math.min(sizeSpec.height - 1.0, Number(pt.y.toFixed(2))))
    onUpdateFurnitureItem(selectedItem.id, {
      position: [Number(pt.x.toFixed(2)), clampedY, Number(pt.z.toFixed(2))],
      rotationY: Number(wallRotY.toFixed(4)),
    })
  }

  const handleFloorDoubleClick = (e: ThreeEvent<MouseEvent>) => {
    if (buildMode || !onTeleportToFloor) return
    e.stopPropagation()
    const ringPos: [number, number, number] = [e.point.x, e.point.y + 0.02, e.point.z]
    setWalkTargetRing(ringPos)
    if (walkRingTimerRef.current !== null) {
      window.clearTimeout(walkRingTimerRef.current)
    }
    walkRingTimerRef.current = window.setTimeout(() => {
      setWalkTargetRing(null)
    }, 600)
    onTeleportToFloor([e.point.x, e.point.y, e.point.z])
  }

  const screenScale = Math.max(0.65, Math.min(1.55, screen.scale || 1))

  return (
    <group
      name="vr-lounge-environment"
      onPointerUp={() => {
        if (draggingPlacement) setDraggingPlacement(false)
      }}
    >
      {/* Quest-3-Safe 5-Light Rig (0 shadow maps, smooth mood interpolation) */}
      <ambientLight ref={ambientLightRef} color={lighting.ambientTint} intensity={0.55} />
      <hemisphereLight ref={hemiLightRef} args={['#3E5278', '#141924', 1.6]} />
      <pointLight
        ref={screenGlowRef}
        position={[
          screen.position[0],
          screen.position[1],
          screen.position[2] + 2.35,
        ]}
        color={isShowingVideo ? '#DCE6F7' : lighting.accentColor}
        intensity={12}
        distance={25}
        decay={1.35}
      />
      <pointLight
        ref={leftMoodLightRef}
        position={[-halfW + 1.8, 2.8, 0.8]}
        color={lighting.accentColor}
        intensity={8.5}
        distance={18}
        decay={1.45}
      />
      <pointLight
        ref={rightMoodLightRef}
        position={[halfW - 1.8, 2.8, 0.8]}
        color={lighting.accentColor}
        intensity={8.5}
        distance={18}
        decay={1.45}
      />
      <pointLight
        ref={ceilingFillRef}
        position={[0, sizeSpec.height - 1.6, 2.0]}
        color={lighting.ambientTint}
        intensity={6.0}
        distance={20}
        decay={1.5}
      />

      {/* ================================================================= */}
      {/* EXPANDABLE & THEMED ROOM ARCHITECTURE                             */}
      {/* ================================================================= */}

      {/* Main Acoustic / Hardwood / Slate Floor (Double-Click to Walk / Glide) */}
      <mesh
        name="lounge-main-floor"
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, centerZ]}
        onPointerMove={handleFloorPointerMove}
        onPointerOut={() => setHoverReticle(null)}
        onDoubleClick={handleFloorDoubleClick}
        onPointerDown={(e) => {
          if (!buildMode || selectedEntry?.placementSurface !== 'floor') return
          e.stopPropagation()
          setDraggingPlacement(true)
          applyFloorPlacement(e.point)
        }}
        onClick={(e) => {
          if (!buildMode || selectedEntry?.placementSurface !== 'floor') return
          e.stopPropagation()
          applyFloorPlacement(e.point)
        }}
      >
        <planeGeometry args={[sizeSpec.width, roomDepth]} />
        <meshStandardMaterial
          color={themeSpec.floorColor}
          roughness={themeSpec.floorRoughness}
          metalness={0.06}
        />
      </mesh>

      {/* Ghost Placement Reticle in Build Mode */}
      {buildMode && selectedItem && hoverReticle && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={hoverReticle} raycast={() => null}>
          <ringGeometry args={[0.38, 0.46, 28]} />
          <meshBasicMaterial color="#22D3EE" transparent opacity={0.85} />
        </mesh>
      )}

      {/* Transient Free-Roam Walk / Teleport Destination Ring */}
      {!buildMode && walkTargetRing && (
        <group position={walkTargetRing}>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <ringGeometry args={[0.26, 0.34, 28]} />
            <meshBasicMaterial color="#38BDF8" transparent opacity={0.88} />
          </mesh>
          <mesh rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
            <circleGeometry args={[0.14, 20]} />
            <meshBasicMaterial color="#E5A93C" transparent opacity={0.45} />
          </mesh>
        </group>
      )}

      {/* Optional Elevated Rear Balcony Riser */}
      {architecture.rearBalcony && (
        <group>
          <RoundedBox
            name="lounge-rear-balcony"
            args={[Math.min(10.6, sizeSpec.width - 2.4), 0.38, 3.3]}
            radius={0.04}
            smoothness={2}
            position={[0, 0.19, sizeSpec.balconyZ]}
            onPointerMove={handleFloorPointerMove}
            onDoubleClick={handleFloorDoubleClick}
            onClick={(e) => {
              if (!buildMode || selectedEntry?.placementSurface !== 'floor') return
              e.stopPropagation()
              applyFloorPlacement(e.point)
            }}
          >
            <meshStandardMaterial
              color={themeSpec.riserColor}
              roughness={0.86}
              metalness={0.08}
            />
          </RoundedBox>
          <mesh position={[0, 0.368, sizeSpec.balconyZ - 1.64]}>
            <boxGeometry args={[Math.min(10.2, sizeSpec.width - 2.8), 0.024, 0.032]} />
            <meshBasicMaterial color={lighting.accentColor} />
          </mesh>
        </group>
      )}

      {/* Stage Dais beneath Screen */}
      <RoundedBox
        args={[Math.min(11.2, sizeSpec.width - 2.2), 0.28, 1.9]}
        radius={0.05}
        smoothness={2}
        position={[0, 0.14, sizeSpec.frontZ + 1.25]}
      >
        <meshStandardMaterial color={themeSpec.riserColor} roughness={0.8} metalness={0.16} />
      </RoundedBox>
      <mesh position={[0, 0.275, sizeSpec.frontZ + 2.19]}>
        <boxGeometry args={[Math.min(10.4, sizeSpec.width - 2.8), 0.022, 0.034]} />
        <meshBasicMaterial color={lighting.accentColor} />
      </mesh>

      {/* Front & Back Walls (clickable for Wall Posters & Neon Signs in Build Mode) */}
      <mesh
        position={[0, sizeSpec.height / 2, sizeSpec.frontZ]}
        onClick={(e) => {
          if (!buildMode || selectedEntry?.placementSurface !== 'wall') return
          e.stopPropagation()
          applyWallPlacement(e.point, 0)
        }}
      >
        <planeGeometry args={[sizeSpec.width, sizeSpec.height]} />
        <meshStandardMaterial color={themeSpec.backWallColor} roughness={0.93} />
      </mesh>

      <mesh
        position={[0, sizeSpec.height / 2, sizeSpec.backZ]}
        rotation={[0, Math.PI, 0]}
        onClick={(e) => {
          if (!buildMode || selectedEntry?.placementSurface !== 'wall') return
          e.stopPropagation()
          applyWallPlacement(e.point, Math.PI)
        }}
      >
        <planeGeometry args={[sizeSpec.width, sizeSpec.height]} />
        <meshStandardMaterial color={themeSpec.wallColor} roughness={0.93} />
      </mesh>

      {/* Left Wall — Solid OR Opened into the Pub & Bar Hangout Alcove */}
      {!architecture.leftBarAlcove ? (
        <mesh
          position={[-halfW, sizeSpec.height / 2, centerZ]}
          rotation={[0, Math.PI / 2, 0]}
          onClick={(e) => {
            if (!buildMode || selectedEntry?.placementSurface !== 'wall') return
            e.stopPropagation()
            applyWallPlacement(e.point, Math.PI / 2)
          }}
        >
          <planeGeometry args={[roomDepth, sizeSpec.height]} />
          <meshStandardMaterial color={themeSpec.wallColor} roughness={0.9} />
        </mesh>
      ) : (
        <group name="left-pub-bar-alcove">
          {/* Front & rear wall segments framing the 6.4m wide alcove archway */}
          <mesh
            position={[-halfW, sizeSpec.height / 2, sizeSpec.frontZ + (roomDepth - 6.4) / 4]}
            rotation={[0, Math.PI / 2, 0]}
            onClick={(e) => {
              if (!buildMode || selectedEntry?.placementSurface !== 'wall') return
              e.stopPropagation()
              applyWallPlacement(e.point, Math.PI / 2)
            }}
          >
            <planeGeometry args={[(roomDepth - 6.4) / 2, sizeSpec.height]} />
            <meshStandardMaterial color={themeSpec.wallColor} roughness={0.9} />
          </mesh>
          <mesh
            position={[-halfW, sizeSpec.height / 2, sizeSpec.backZ - (roomDepth - 6.4) / 4]}
            rotation={[0, Math.PI / 2, 0]}
            onClick={(e) => {
              if (!buildMode || selectedEntry?.placementSurface !== 'wall') return
              e.stopPropagation()
              applyWallPlacement(e.point, Math.PI / 2)
            }}
          >
            <planeGeometry args={[(roomDepth - 6.4) / 2, sizeSpec.height]} />
            <meshStandardMaterial color={themeSpec.wallColor} roughness={0.9} />
          </mesh>
          {/* Archway lintel header + accent trim */}
          <mesh position={[-halfW, sizeSpec.height - 0.7, centerZ]} rotation={[0, Math.PI / 2, 0]}>
            <planeGeometry args={[6.4, 1.4]} />
            <meshStandardMaterial color={themeSpec.wallColor} roughness={0.9} />
          </mesh>
          <mesh position={[-halfW + 0.03, sizeSpec.height - 1.4, centerZ]}>
            <boxGeometry args={[0.06, 0.04, 6.4]} />
            <meshBasicMaterial color={lighting.accentColor} />
          </mesh>
          {/* Alcove Floor (placeable & walkable!) */}
          <mesh
            name="lounge-left-alcove-floor"
            rotation={[-Math.PI / 2, 0, 0]}
            position={[-halfW - 1.9, 0.002, centerZ]}
            onPointerMove={handleFloorPointerMove}
            onDoubleClick={handleFloorDoubleClick}
            onClick={(e) => {
              if (!buildMode || selectedEntry?.placementSurface !== 'floor') return
              e.stopPropagation()
              applyFloorPlacement(e.point)
            }}
          >
            <planeGeometry args={[3.8, 6.4]} />
            <meshStandardMaterial color={themeSpec.riserColor} roughness={0.72} />
          </mesh>
          {/* Alcove Back & Side Walls + Ceiling */}
          <mesh
            position={[-halfW - 3.8, (sizeSpec.height - 1.4) / 2, centerZ]}
            rotation={[0, Math.PI / 2, 0]}
            onClick={(e) => {
              if (!buildMode || selectedEntry?.placementSurface !== 'wall') return
              e.stopPropagation()
              applyWallPlacement(e.point, Math.PI / 2)
            }}
          >
            <planeGeometry args={[6.4, sizeSpec.height - 1.4]} />
            <meshStandardMaterial color={themeSpec.backWallColor} roughness={0.88} />
          </mesh>
          <mesh position={[-halfW - 1.9, (sizeSpec.height - 1.4) / 2, centerZ - 3.2]}>
            <planeGeometry args={[3.8, sizeSpec.height - 1.4]} />
            <meshStandardMaterial color={themeSpec.wallColor} roughness={0.9} />
          </mesh>
          <mesh
            position={[-halfW - 1.9, (sizeSpec.height - 1.4) / 2, centerZ + 3.2]}
            rotation={[0, Math.PI, 0]}
          >
            <planeGeometry args={[3.8, sizeSpec.height - 1.4]} />
            <meshStandardMaterial color={themeSpec.wallColor} roughness={0.9} />
          </mesh>
          <mesh
            position={[-halfW - 1.9, sizeSpec.height - 1.4, centerZ]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[3.8, 6.4]} />
            <meshStandardMaterial color={themeSpec.ceilingColor} roughness={0.92} />
          </mesh>
          {/* Built-in glowing Pub Shelf & Sign inside Left Alcove */}
          <RoundedBox
            args={[0.28, 0.06, 3.6]}
            radius={0.02}
            position={[-halfW - 3.62, 1.85, centerZ]}
          >
            <meshStandardMaterial color={themeSpec.slatColor} roughness={0.5} />
          </RoundedBox>
          <mesh position={[-halfW - 3.74, 2.55, centerZ]}>
            <boxGeometry args={[0.03, 0.03, 3.2]} />
            <meshBasicMaterial color={lighting.accentColor} />
          </mesh>
        </group>
      )}

      {/* Right Wall — Solid OR Opened into the Arcade & Chill Alcove */}
      {!architecture.rightArcadeAlcove ? (
        <mesh
          position={[halfW, sizeSpec.height / 2, centerZ]}
          rotation={[0, -Math.PI / 2, 0]}
          onClick={(e) => {
            if (!buildMode || selectedEntry?.placementSurface !== 'wall') return
            e.stopPropagation()
            applyWallPlacement(e.point, -Math.PI / 2)
          }}
        >
          <planeGeometry args={[roomDepth, sizeSpec.height]} />
          <meshStandardMaterial color={themeSpec.wallColor} roughness={0.9} />
        </mesh>
      ) : (
        <group name="right-arcade-chill-alcove">
          <mesh
            position={[halfW, sizeSpec.height / 2, sizeSpec.frontZ + (roomDepth - 6.4) / 4]}
            rotation={[0, -Math.PI / 2, 0]}
            onClick={(e) => {
              if (!buildMode || selectedEntry?.placementSurface !== 'wall') return
              e.stopPropagation()
              applyWallPlacement(e.point, -Math.PI / 2)
            }}
          >
            <planeGeometry args={[(roomDepth - 6.4) / 2, sizeSpec.height]} />
            <meshStandardMaterial color={themeSpec.wallColor} roughness={0.9} />
          </mesh>
          <mesh
            position={[halfW, sizeSpec.height / 2, sizeSpec.backZ - (roomDepth - 6.4) / 4]}
            rotation={[0, -Math.PI / 2, 0]}
            onClick={(e) => {
              if (!buildMode || selectedEntry?.placementSurface !== 'wall') return
              e.stopPropagation()
              applyWallPlacement(e.point, -Math.PI / 2)
            }}
          >
            <planeGeometry args={[(roomDepth - 6.4) / 2, sizeSpec.height]} />
            <meshStandardMaterial color={themeSpec.wallColor} roughness={0.9} />
          </mesh>
          <mesh position={[halfW, sizeSpec.height - 0.7, centerZ]} rotation={[0, -Math.PI / 2, 0]}>
            <planeGeometry args={[6.4, 1.4]} />
            <meshStandardMaterial color={themeSpec.wallColor} roughness={0.9} />
          </mesh>
          <mesh position={[halfW - 0.03, sizeSpec.height - 1.4, centerZ]}>
            <boxGeometry args={[0.06, 0.04, 6.4]} />
            <meshBasicMaterial color={lighting.accentColor} />
          </mesh>
          <mesh
            name="lounge-right-alcove-floor"
            rotation={[-Math.PI / 2, 0, 0]}
            position={[halfW + 1.9, 0.002, centerZ]}
            onPointerMove={handleFloorPointerMove}
            onDoubleClick={handleFloorDoubleClick}
            onClick={(e) => {
              if (!buildMode || selectedEntry?.placementSurface !== 'floor') return
              e.stopPropagation()
              applyFloorPlacement(e.point)
            }}
          >
            <planeGeometry args={[3.8, 6.4]} />
            <meshStandardMaterial color={themeSpec.riserColor} roughness={0.72} />
          </mesh>
          <mesh
            position={[halfW + 3.8, (sizeSpec.height - 1.4) / 2, centerZ]}
            rotation={[0, -Math.PI / 2, 0]}
            onClick={(e) => {
              if (!buildMode || selectedEntry?.placementSurface !== 'wall') return
              e.stopPropagation()
              applyWallPlacement(e.point, -Math.PI / 2)
            }}
          >
            <planeGeometry args={[6.4, sizeSpec.height - 1.4]} />
            <meshStandardMaterial color={themeSpec.backWallColor} roughness={0.88} />
          </mesh>
          <mesh position={[halfW + 1.9, (sizeSpec.height - 1.4) / 2, centerZ - 3.2]}>
            <planeGeometry args={[3.8, sizeSpec.height - 1.4]} />
            <meshStandardMaterial color={themeSpec.wallColor} roughness={0.9} />
          </mesh>
          <mesh
            position={[halfW + 1.9, (sizeSpec.height - 1.4) / 2, centerZ + 3.2]}
            rotation={[0, Math.PI, 0]}
          >
            <planeGeometry args={[3.8, sizeSpec.height - 1.4]} />
            <meshStandardMaterial color={themeSpec.wallColor} roughness={0.9} />
          </mesh>
          <mesh
            position={[halfW + 1.9, sizeSpec.height - 1.4, centerZ]}
            rotation={[Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[3.8, 6.4]} />
            <meshStandardMaterial color={themeSpec.ceilingColor} roughness={0.92} />
          </mesh>
        </group>
      )}

      {/* Ceiling Styles: Coffered Acoustic, Starlight Skylight, or Industrial Loft Beams */}
      <mesh position={[0, sizeSpec.height, centerZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[sizeSpec.width, roomDepth]} />
        <meshStandardMaterial color={themeSpec.ceilingColor} roughness={0.95} />
      </mesh>

      {architecture.ceilingStyle === 'skylight-stars' && (
        <group position={[0, sizeSpec.height - 0.06, centerZ]}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[sizeSpec.width * 0.62, roomDepth * 0.62]} />
            <meshBasicMaterial color="#050814" />
          </mesh>
          <points geometry={starGeometry} position={[0, -0.08, 0]}>
            <pointsMaterial color="#F8FAFC" size={0.075} sizeAttenuation />
          </points>
          <mesh position={[0, -0.02, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[sizeSpec.width * 0.3, sizeSpec.width * 0.32, 4]} />
            <meshBasicMaterial color={lighting.accentColor} />
          </mesh>
        </group>
      )}

      {architecture.ceilingStyle === 'industrial-beams' &&
        [-4.5, -1.5, 1.5, 4.5].map((zBeam) => (
          <mesh key={zBeam} position={[0, sizeSpec.height - 0.22, centerZ + zBeam]}>
            <boxGeometry args={[sizeSpec.width - 0.3, 0.34, 0.28]} />
            <meshStandardMaterial color={themeSpec.slatColor} roughness={0.72} metalness={0.18} />
          </mesh>
        ))}

      {/* Acoustic Wall Ribs + Accent Sconce Strips */}
      {wallSlatOffsets.map((zPos) => {
        const inAlcoveOpening = Math.abs(zPos - centerZ) < 3.1
        return (
          <group key={zPos}>
            {(!architecture.leftBarAlcove || !inAlcoveOpening) && (
              <>
                <mesh position={[-halfW + 0.08, 2.75, zPos]}>
                  <boxGeometry args={[0.12, Math.min(4.9, sizeSpec.height - 0.7), 0.34]} />
                  <meshStandardMaterial
                    color={themeSpec.slatColor}
                    roughness={0.75}
                    metalness={0.1}
                  />
                </mesh>
                <mesh position={[-halfW + 0.15, 2.55, zPos]}>
                  <boxGeometry args={[0.025, 0.72, 0.045]} />
                  <meshBasicMaterial color={lighting.accentColor} />
                </mesh>
              </>
            )}

            {(!architecture.rightArcadeAlcove || !inAlcoveOpening) && (
              <>
                <mesh position={[halfW - 0.08, 2.75, zPos]}>
                  <boxGeometry args={[0.12, Math.min(4.9, sizeSpec.height - 0.7), 0.34]} />
                  <meshStandardMaterial
                    color={themeSpec.slatColor}
                    roughness={0.75}
                    metalness={0.1}
                  />
                </mesh>
                <mesh position={[halfW - 0.15, 2.55, zPos]}>
                  <boxGeometry args={[0.025, 0.72, 0.045]} />
                  <meshBasicMaterial color={lighting.accentColor} />
                </mesh>
              </>
            )}
          </group>
        )
      })}

      {/* ================================================================= */}
      {/* REPOSITIONABLE & RESIZABLE 16:9 MAIN VIEWING SCREEN               */}
      {/* ================================================================= */}
      <group
        position={screen.position}
        rotation={[0, screen.rotationY, 0]}
        scale={[screenScale, screenScale, screenScale]}
      >
        {/* Brushed dark bezel behind screen */}
        <mesh
          geometry={screen.curved ? curvedFrameGeo : flatFrameGeo}
          position={[0, 0, -0.06]}
        >
          <meshStandardMaterial
            color="#1A212E"
            emissive={lighting.accentColor}
            emissiveIntensity={isShowingVideo ? 0.04 : 0.15}
            roughness={0.58}
            metalness={0.35}
          />
        </mesh>

        {/* Active Video Texture Surface vs Idle Lounge Standby Canvas */}
        <mesh
          geometry={screen.curved ? curvedScreenGeo : flatScreenGeo}
          pointerEventsType={{ deny: 'grab' }}
          onPointerOver={() => setScreenHovered(true)}
          onPointerOut={() => setScreenHovered(false)}
          onClick={(e) => {
            e.stopPropagation()
            if (needsAudioUnlock) {
              onUnlockAudio()
              return
            }
            if (!presenterState.activePresenterId && canTakeControl) {
              if (onOpenYouTubeBrowser) {
                onOpenYouTubeBrowser()
              } else {
                onTakeControl()
              }
            }
          }}
        >
          {isShowingVideo ? (
            <meshBasicMaterial map={videoTexture} toneMapped={false} />
          ) : (
            <meshStandardMaterial
              color={screenHovered && !presenterState.activePresenterId ? '#1C2536' : '#141B28'}
              emissive="#182234"
              emissiveIntensity={0.45}
              roughness={0.8}
              metalness={0.1}
            />
          )}
        </mesh>

        {/* Screen Idle / Waiting / Error 3D Overlay */}
        {!isShowingVideo && (
          <group position={[0, 0, screen.curved ? 0.42 : 0.08]}>
            {canTakeControl && !isResolvingMedia && (
              <group position={[0, -1.08, 0.02]}>
                {onOpenYouTubeBrowser && (
                  <group
                    position={[-1.42, 0, 0]}
                    pointerEventsType={{ deny: 'grab' }}
                    onPointerOver={(e) => {
                      e.stopPropagation()
                      setYtBtnHovered(true)
                    }}
                    onPointerOut={() => setYtBtnHovered(false)}
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenYouTubeBrowser()
                    }}
                  >
                    <RoundedBox args={[2.55, 0.48, 0.04]} radius={0.09} smoothness={3}>
                      <meshBasicMaterial color={ytBtnHovered ? '#EA6B58' : '#E05A47'} />
                    </RoundedBox>
                    <Suspense fallback={null}>
                      <Text
                        position={[0, 0, 0.03]}
                        fontSize={0.165}
                        color="#F4F1EA"
                        anchorX="center"
                        anchorY="middle"
                      >
                        ▶ Browse YouTube in VR
                      </Text>
                    </Suspense>
                  </group>
                )}

                {!presenterState.activePresenterId && (
                  <group
                    position={[onOpenYouTubeBrowser ? 1.42 : 0, 0, 0]}
                    pointerEventsType={{ deny: 'grab' }}
                    onClick={(e) => {
                      e.stopPropagation()
                      onTakeControl()
                    }}
                  >
                    <RoundedBox args={[2.55, 0.48, 0.04]} radius={0.09} smoothness={3}>
                      <meshBasicMaterial color={screenHovered ? '#F2BE5C' : '#E5A93C'} />
                    </RoundedBox>
                    <Suspense fallback={null}>
                      <Text
                        position={[0, 0, 0.03]}
                        fontSize={0.165}
                        color="#0B0D10"
                        anchorX="center"
                        anchorY="middle"
                      >
                        Take Control of Screen
                      </Text>
                    </Suspense>
                  </group>
                )}
              </group>
            )}

            <Suspense fallback={null}>
              <Text
                position={[0, 0.92, 0]}
                fontSize={0.16}
                letterSpacing={0.16}
                color={lighting.accentColor}
                anchorX="center"
                anchorY="middle"
              >
                {`VR LOUNGE · ROOM ${roomCode || 'LOBBY'}`}
              </Text>

              <Text
                position={[0, 0.32, 0]}
                fontSize={0.42}
                color="#F4F1EA"
                maxWidth={7.2}
                textAlign="center"
                anchorX="center"
                anchorY="middle"
              >
                {isResolvingMedia
                  ? `Resolving "${presenterState.mediaTitle || 'YouTube Video'}"…`
                  : presenterState.activePresenterId
                    ? presenterState.screenMode === 'tab-stream'
                      ? `${presenterState.presenterName ?? 'Presenter'} is starting browser share...`
                      : `Loading "${presenterState.mediaTitle || 'Cinema Stream'}"...`
                    : 'Private Hangout Ready'}
              </Text>

              <Text
                position={[0, -0.32, 0]}
                fontSize={0.18}
                color={mediaError ? '#E05A47' : '#C7C2B8'}
                maxWidth={6.8}
                textAlign="center"
                anchorX="center"
                anchorY="middle"
              >
                {mediaError
                  ? mediaError
                  : isResolvingMedia
                    ? 'Connecting to fastest CORS-enabled HD cinema relay for synchronized VR playback…'
                    : presenterState.activePresenterId
                      ? 'Tap "▶ YouTube" on your 3D seat dock to queue another video anytime.'
                      : 'Browse YouTube in VR, share a browser tab, or tap 🛠 Build to customize your room!'}
              </Text>
            </Suspense>
          </group>
        )}

        {/* Audio Autoplay Unlock Prompt inside 3D */}
        {needsAudioUnlock && isShowingVideo && (
          <group
            position={[0, -1.85, 0.2]}
            pointerEventsType={{ deny: 'grab' }}
            onClick={(e) => {
              e.stopPropagation()
              onUnlockAudio()
            }}
          >
            <RoundedBox args={[2.9, 0.42, 0.04]} radius={0.08} smoothness={3}>
              <meshBasicMaterial color="#E5A93C" />
            </RoundedBox>
            <Suspense fallback={null}>
              <Text
                position={[0, 0, 0.03]}
                fontSize={0.15}
                color="#0B0D10"
                anchorX="center"
                anchorY="middle"
              >
                Click Screen to Enable Cinema Audio
              </Text>
            </Suspense>
          </group>
        )}

        {/* Top Presenter Status Strip above bezel */}
        <group position={[0, SCREEN_CONFIG.height / 2 + 0.34, 0.05]}>
          <RoundedBox args={[5.2, 0.32, 0.03]} radius={0.07} smoothness={2}>
            <meshBasicMaterial color="#0D1015" transparent opacity={0.88} />
          </RoundedBox>
          <Suspense fallback={null}>
            <Text
              position={[0, 0, 0.022]}
              fontSize={0.12}
              color={presenterState.activePresenterId ? '#E5A93C' : '#9CA3AF'}
              anchorX="center"
              anchorY="middle"
            >
              {presenterState.activePresenterId
                ? `LIVE PRESENTER: ${(presenterState.presenterName ?? 'Guest').toUpperCase()} · ${
                    presenterState.screenMode === 'tab-stream'
                      ? 'BROWSER TAB'
                      : activeStreamQuality
                        ? activeStreamQuality.toUpperCase()
                        : 'SYNC STREAM'
                  }${presenterState.lockedByHostId ? ' · LOCKED' : ''}`
                : 'CUSTOMIZABLE HANGOUT · YOUTUBE VR · LIVE TAB SHARE'}
            </Text>
          </Suspense>
        </group>
      </group>

      {/* ================================================================= */}
      {/* PLACEABLE PROCEDURAL FURNITURE & DYNAMIC SEATING ANCHORS          */}
      {/* ================================================================= */}
      <ProceduralFurnitureLayer
        furniture={furniture}
        computedSeats={computedSeats}
        localSeatId={localSeatId}
        localSeatIndex={localSeatIndex}
        participants={participants}
        rearBalcony={architecture.rearBalcony}
        balconyZ={sizeSpec.balconyZ}
        buildMode={buildMode}
        selectedFurnitureId={selectedFurnitureId}
        onSelectSeat={onSelectSeat}
        onSelectFurniture={onSelectFurniture}
        onUpdateFurnitureItem={onUpdateFurnitureItem}
        onDuplicateFurnitureItem={onDuplicateFurnitureItem}
        onDeleteFurnitureItem={onDeleteFurnitureItem}
        onEditFurnitureMedia={onEditFurnitureMedia}
      />
    </group>
  )
}
