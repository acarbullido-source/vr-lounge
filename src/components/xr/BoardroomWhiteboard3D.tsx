import { RoundedBox, Text } from '@react-three/drei'
import { type ThreeEvent } from '@react-three/fiber'
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import * as THREE from 'three'
import {
  sanitizeBoardroomWhiteboardStrokes,
  savePersistedBoardroomWhiteboard,
} from '../../constants/expansionRooms'
import { playSpatialUiFeedback } from '../../services/soundboardAudio'
import {
  setSpatialDrawingSurfaceActive,
  setSpatialUiHovered,
} from '../../services/xrTracking'
import type {
  BoardroomWhiteboardStroke,
  ExpansionWingSyncedState,
} from '../../types/lounge'

const noopRaycast = () => null

const CANVAS_WIDTH = 1600
const CANVAS_HEIGHT = 640
const PORCELAIN_BG = '#F8FAFC'

export interface WhiteboardMarkerColorSpec {
  id: string
  label: string
  hex: string
}

export const WHITEBOARD_MARKER_COLORS: readonly WhiteboardMarkerColorSpec[] = [
  { id: 'black', label: 'Ink', hex: '#0F172A' },
  { id: 'blue', label: 'Blue', hex: '#2563EB' },
  { id: 'red', label: 'Red', hex: '#DC2626' },
  { id: 'green', label: 'Green', hex: '#059669' },
  { id: 'amber', label: 'Gold', hex: '#D97706' },
  { id: 'purple', label: 'Purple', hex: '#7C3AED' },
] as const

const PEN_PIXEL_WIDTHS: Record<1 | 2 | 3, number> = {
  1: 5,
  2: 10,
  3: 18,
}

const ERASER_PIXEL_WIDTHS: Record<1 | 2 | 3, number> = {
  1: 30,
  2: 54,
  3: 86,
}

function drawStrokeOnContext(
  ctx: CanvasRenderingContext2D,
  stroke: BoardroomWhiteboardStroke,
): void {
  const pts = stroke.points
  if (pts.length < 2) return

  const isEraser = stroke.tool === 'eraser'
  const lineWidth = isEraser
    ? ERASER_PIXEL_WIDTHS[stroke.size] ?? 54
    : PEN_PIXEL_WIDTHS[stroke.size] ?? 10
  const strokeColor = isEraser ? PORCELAIN_BG : stroke.color

  ctx.save()
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.lineWidth = lineWidth
  ctx.strokeStyle = strokeColor
  ctx.fillStyle = strokeColor

  const x0 = pts[0] * CANVAS_WIDTH
  const y0 = pts[1] * CANVAS_HEIGHT

  if (pts.length === 2) {
    ctx.beginPath()
    ctx.arc(x0, y0, lineWidth * 0.5, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
    return
  }

  ctx.beginPath()
  ctx.moveTo(x0, y0)

  if (pts.length === 4) {
    ctx.lineTo(pts[2] * CANVAS_WIDTH, pts[3] * CANVAS_HEIGHT)
  } else {
    for (let i = 2; i + 1 < pts.length; i += 2) {
      const prevX = pts[i - 2] * CANVAS_WIDTH
      const prevY = pts[i - 1] * CANVAS_HEIGHT
      const curX = pts[i] * CANVAS_WIDTH
      const curY = pts[i + 1] * CANVAS_HEIGHT
      const midX = (prevX + curX) * 0.5
      const midY = (prevY + curY) * 0.5
      if (i === 2) {
        ctx.lineTo(midX, midY)
      } else {
        ctx.quadraticCurveTo(prevX, prevY, midX, midY)
      }
    }
    const lastX = pts[pts.length - 2] * CANVAS_WIDTH
    const lastY = pts[pts.length - 1] * CANVAS_HEIGHT
    ctx.lineTo(lastX, lastY)
  }

  ctx.stroke()
  ctx.restore()
}

function drawBlueprintGridOverlay(ctx: CanvasRenderingContext2D): void {
  ctx.save()
  ctx.lineWidth = 1
  for (let x = 40; x < CANVAS_WIDTH; x += 40) {
    ctx.strokeStyle =
      x % 160 === 0 ? 'rgba(15, 23, 42, 0.085)' : 'rgba(15, 23, 42, 0.04)'
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, CANVAS_HEIGHT)
    ctx.stroke()
  }
  for (let y = 40; y < CANVAS_HEIGHT; y += 40) {
    ctx.strokeStyle =
      y % 160 === 0 ? 'rgba(15, 23, 42, 0.085)' : 'rgba(15, 23, 42, 0.04)'
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(CANVAS_WIDTH, y)
    ctx.stroke()
  }
  ctx.restore()
}

function renderFullWhiteboardCanvas(
  ctx: CanvasRenderingContext2D,
  strokes: readonly BoardroomWhiteboardStroke[],
  activeStroke: BoardroomWhiteboardStroke | null,
  showGrid: boolean,
): void {
  ctx.fillStyle = PORCELAIN_BG
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  for (const stroke of strokes) {
    drawStrokeOnContext(ctx, stroke)
  }
  if (activeStroke) {
    drawStrokeOnContext(ctx, activeStroke)
  }

  if (showGrid) {
    drawBlueprintGridOverlay(ctx)
  }
}

interface ToolbarChipProps {
  id: string
  label: string
  position: [number, number, number]
  width?: number
  height?: number
  active?: boolean
  accentColor?: string
  textColor?: string
  disabled?: boolean
  onClick: () => void
}

function WhiteboardToolbarChip({
  id,
  label,
  position,
  width = 0.34,
  height = 0.11,
  active = false,
  accentColor = '#E5A93C',
  textColor,
  disabled = false,
  onClick,
}: ToolbarChipProps) {
  const [hovered, setHovered] = useState(false)
  const hoverKey = `wb-btn-${id}`

  useEffect(() => {
    return () => setSpatialUiHovered(false, hoverKey)
  }, [hoverKey])

  const bg = disabled
    ? '#0F172A'
    : active
      ? accentColor
      : hovered
        ? '#334155'
        : '#1E293B'
  const fg =
    textColor ??
    (disabled
      ? '#475569'
      : active
        ? '#080A0D'
        : hovered
          ? '#FDE047'
          : '#F8FAFC')

  return (
    <group
      position={position}
      scale={hovered && !disabled ? 1.04 : 1}
      onPointerOver={(e) => {
        e.stopPropagation()
        if (!disabled) {
          setHovered(true)
          setSpatialUiHovered(true, hoverKey)
        }
      }}
      onPointerOut={(e) => {
        e.stopPropagation()
        setHovered(false)
        setSpatialUiHovered(false, hoverKey)
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (disabled) return
        playSpatialUiFeedback('ui-click')
        onClick()
      }}
    >
      {(hovered || active) && !disabled && (
        <RoundedBox
          args={[width + 0.014, height + 0.014, 0.012]}
          radius={0.018}
          smoothness={2}
          position={[0, 0, -0.002]}
          raycast={noopRaycast}
        >
          <meshBasicMaterial color={active ? accentColor : '#FDE047'} />
        </RoundedBox>
      )}
      <RoundedBox args={[width, height, 0.016]} radius={0.016} smoothness={2}>
        <meshBasicMaterial color={bg} />
      </RoundedBox>
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.011]}
          fontSize={0.036}
          color={fg}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Suspense>
    </group>
  )
}

export interface BoardroomWhiteboard3DProps {
  position: [number, number, number]
  rotationY?: number
  /** Scale factor so the same whiteboard component can also be embedded on the West Presentation Wall */
  scale?: number
  surfaceId?: string
  wingState: ExpansionWingSyncedState
  localDisplayName: string
  isStandingAtBoard?: boolean
  onStandAtBoard?: () => void
  onUpdateWingState: (patch: Partial<ExpansionWingSyncedState>) => void
}

export function BoardroomWhiteboard3D({
  position,
  rotationY = Math.PI,
  scale = 1,
  surfaceId = 'boardroom-south-whiteboard',
  wingState,
  localDisplayName,
  isStandingAtBoard = false,
  onStandAtBoard,
  onUpdateWingState,
}: BoardroomWhiteboard3DProps) {
  const [activeTool, setActiveTool] = useState<'pen' | 'eraser'>('pen')
  const [activeColor, setActiveColor] = useState<string>(
    WHITEBOARD_MARKER_COLORS[0].hex,
  )
  const [activeSize, setActiveSize] = useState<1 | 2 | 3>(2)
  const [hoveredColorId, setHoveredColorId] = useState<string | null>(null)
  const [cursorUv, setCursorUv] = useState<[number, number] | null>(null)
  const [isDrawing, setIsDrawing] = useState(false)

  // Local optimistic strokes state so drawing feels instantaneous before parent state round-trips
  const syncedStrokes = useMemo(
    () =>
      sanitizeBoardroomWhiteboardStrokes(wingState.boardroomWhiteboardStrokes),
    [wingState.boardroomWhiteboardStrokes],
  )
  const [localStrokes, setLocalStrokes] =
    useState<BoardroomWhiteboardStroke[]>(syncedStrokes)
  const showGrid = wingState.boardroomWhiteboardGrid ?? true

  // Keep a backup of the last cleared stroke list so "Undo" can even restore an accidental "Erase All"
  const lastClearedStrokesBackupRef = useRef<BoardroomWhiteboardStroke[] | null>(
    null,
  )
  const activeStrokeRef = useRef<BoardroomWhiteboardStroke | null>(null)
  const isPointerOverBoardRef = useRef(false)
  const localStrokesRef = useRef<BoardroomWhiteboardStroke[]>(localStrokes)

  useEffect(() => {
    localStrokesRef.current = localStrokes
  }, [localStrokes])

  useEffect(() => {
    if (!activeStrokeRef.current) {
      setLocalStrokes(syncedStrokes)
    }
  }, [syncedStrokes])

  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas')
    c.width = CANVAS_WIDTH
    c.height = CANVAS_HEIGHT
    const ctx = c.getContext('2d')
    if (ctx) {
      ctx.fillStyle = PORCELAIN_BG
      ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)
    }
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.needsUpdate = true
    return { canvas: c, texture: tex }
  }, [])

  const redrawCanvas = useCallback(
    (
      strokesToRender: readonly BoardroomWhiteboardStroke[],
      inProgressStroke: BoardroomWhiteboardStroke | null,
      gridEnabled: boolean,
    ) => {
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      renderFullWhiteboardCanvas(
        ctx,
        strokesToRender,
        inProgressStroke,
        gridEnabled,
      )
      texture.needsUpdate = true
    },
    [canvas, texture],
  )

  useEffect(() => {
    redrawCanvas(localStrokes, activeStrokeRef.current, showGrid)
  }, [localStrokes, redrawCanvas, showGrid])

  useEffect(() => {
    return () => {
      setSpatialDrawingSurfaceActive(false, surfaceId)
      setSpatialUiHovered(false, surfaceId)
      texture.dispose()
    }
  }, [surfaceId, texture])

  const commitStrokes = useCallback(
    (
      nextStrokes: BoardroomWhiteboardStroke[],
      clearedAtOverride?: number,
      gridOverride?: boolean,
    ) => {
      const sanitized = sanitizeBoardroomWhiteboardStrokes(nextStrokes)
      const nextClearedAt =
        clearedAtOverride ?? ( wingState.boardroomWhiteboardClearedAt ?? 0 )
      const nextGrid = gridOverride ?? showGrid
      localStrokesRef.current = sanitized
      setLocalStrokes(sanitized)

      savePersistedBoardroomWhiteboard({
        strokes: sanitized,
        grid: nextGrid,
        clearedAt: nextClearedAt,
        updatedAt: Date.now(),
      })

      onUpdateWingState({
        boardroomWhiteboardStrokes: sanitized,
        boardroomWhiteboardGrid: nextGrid,
        boardroomWhiteboardClearedAt: nextClearedAt,
      })
    },
    [
      onUpdateWingState,
      showGrid,
      wingState.boardroomWhiteboardClearedAt,
    ],
  )

  const finishActiveStroke = useCallback(() => {
    const finished = activeStrokeRef.current
    if (!finished) return
    activeStrokeRef.current = null
    setIsDrawing(false)
    if (!isPointerOverBoardRef.current) {
      setSpatialDrawingSurfaceActive(false, surfaceId)
      setSpatialUiHovered(false, surfaceId)
    }

    if (finished.points.length >= 2) {
      lastClearedStrokesBackupRef.current = null
      const next = [...localStrokesRef.current.slice(-319), finished]
      commitStrokes(next)
    } else {
      redrawCanvas(localStrokesRef.current, null, showGrid)
    }
  }, [commitStrokes, redrawCanvas, showGrid, surfaceId])

  useEffect(() => {
    if (!isDrawing) return
    const handleGlobalPointerUp = () => {
      finishActiveStroke()
    }
    window.addEventListener('pointerup', handleGlobalPointerUp)
    window.addEventListener('pointercancel', handleGlobalPointerUp)
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp)
      window.removeEventListener('pointercancel', handleGlobalPointerUp)
    }
  }, [finishActiveStroke, isDrawing])

  const extractCanvasUv = (
    e: ThreeEvent<PointerEvent>,
  ): [number, number] | null => {
    if (!e.uv) return null
    const u = Number(Math.max(0, Math.min(1, e.uv.x)).toFixed(4))
    const v = Number(Math.max(0, Math.min(1, 1 - e.uv.y)).toFixed(4))
    return [u, v]
  }

  const handleSurfacePointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    isPointerOverBoardRef.current = true
    setSpatialDrawingSurfaceActive(true, surfaceId)
    setSpatialUiHovered(true, surfaceId)
    const uv = extractCanvasUv(e)
    if (uv) setCursorUv(uv)
  }

  const handleSurfacePointerOut = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    isPointerOverBoardRef.current = false
    setCursorUv(null)
    if (activeStrokeRef.current) {
      finishActiveStroke()
    } else {
      setSpatialDrawingSurfaceActive(false, surfaceId)
      setSpatialUiHovered(false, surfaceId)
    }
  }

  const handleSurfacePointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const uv = extractCanvasUv(e)
    if (!uv) return
    setSpatialDrawingSurfaceActive(true, surfaceId)
    setSpatialUiHovered(true, surfaceId)
    setCursorUv(uv)

    const newStroke: BoardroomWhiteboardStroke = {
      id: `wb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      tool: activeTool,
      color: activeTool === 'eraser' ? PORCELAIN_BG : activeColor,
      size: activeSize,
      points: [uv[0], uv[1]],
      author: localDisplayName,
      createdAt: Date.now(),
    }
    activeStrokeRef.current = newStroke
    setIsDrawing(true)
    redrawCanvas(localStrokesRef.current, newStroke, showGrid)
  }

  const handleSurfacePointerMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const uv = extractCanvasUv(e)
    if (!uv) return
    setCursorUv(uv)

    const cur = activeStrokeRef.current
    if (!cur) return

    const pts = cur.points
    const lastU = pts[pts.length - 2] ?? uv[0]
    const lastV = pts[pts.length - 1] ?? uv[1]
    const dist = Math.hypot(uv[0] - lastU, uv[1] - lastV)

    if (dist >= 0.0022 && pts.length < 638) {
      pts.push(uv[0], uv[1])
      redrawCanvas(localStrokesRef.current, cur, showGrid)
    }
  }

  const handleSurfacePointerUp = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    finishActiveStroke()
  }

  const handleUndo = () => {
    if (localStrokesRef.current.length > 0) {
      const next = localStrokesRef.current.slice(0, -1)
      commitStrokes(next)
    } else if (
      lastClearedStrokesBackupRef.current &&
      lastClearedStrokesBackupRef.current.length > 0
    ) {
      const restored = lastClearedStrokesBackupRef.current
      lastClearedStrokesBackupRef.current = null
      commitStrokes(restored)
    }
  }

  const handleClearAll = () => {
    if (localStrokesRef.current.length > 0) {
      lastClearedStrokesBackupRef.current = [...localStrokesRef.current]
    }
    const now = Date.now()
    commitStrokes([], now)
  }

  const handleToggleGrid = () => {
    const nextGrid = !showGrid
    commitStrokes(localStrokesRef.current, undefined, nextGrid)
  }

  // Board surface dimensions in meters
  const boardWidth = 4.42
  const boardHeight = 1.76
  const cursorLocalX = cursorUv ? (cursorUv[0] - 0.5) * boardWidth : 0
  const cursorLocalY = cursorUv ? (0.5 - cursorUv[1]) * boardHeight + 0.05 : 0
  const cursorRadius =
    activeTool === 'eraser'
      ? activeSize === 1
        ? 0.038
        : activeSize === 2
          ? 0.064
          : 0.095
      : activeSize === 1
        ? 0.012
        : activeSize === 2
          ? 0.02
          : 0.032

  const canUndo =
    localStrokes.length > 0 ||
    Boolean(
      lastClearedStrokesBackupRef.current &&
        lastClearedStrokesBackupRef.current.length > 0,
    )

  return (
    <group
      position={position}
      rotation={[0, rotationY, 0]}
      scale={scale}
      name={`whiteboard-group-${surfaceId}`}
    >
      {/* Overhead Brushed-Brass Linear Gallery Light Bar */}
      <group position={[0, 1.16, 0.06]}>
        <RoundedBox
          args={[3.6, 0.045, 0.09]}
          radius={0.015}
          smoothness={2}
          raycast={noopRaycast}
        >
          <meshStandardMaterial
            color="#D4A54E"
            emissive="#785418"
            emissiveIntensity={0.42}
            metalness={0.75}
            roughness={0.25}
          />
        </RoundedBox>
        <mesh position={[0, -0.024, 0.01]} raycast={noopRaycast}>
          <boxGeometry args={[3.44, 0.012, 0.05]} />
          <meshBasicMaterial color="#FEF9C3" />
        </mesh>
      </group>

      {/* Outer Brushed Metallic & Warm Brass Architectural Bezel */}
      <RoundedBox
        args={[4.68, 2.22, 0.045]}
        radius={0.03}
        smoothness={2}
        position={[0, 0, -0.008]}
        raycast={noopRaycast}
      >
        <meshStandardMaterial
          color="#1E293B"
          metalness={0.75}
          roughness={0.25}
        />
      </RoundedBox>
      <RoundedBox
        args={[4.58, 2.12, 0.048]}
        radius={0.024}
        smoothness={2}
        position={[0, 0, -0.003]}
        raycast={noopRaycast}
      >
        <meshStandardMaterial
          color="#0F172A"
          metalness={0.65}
          roughness={0.3}
        />
      </RoundedBox>

      {/* Top Header Status Bar */}
      <mesh position={[0, 0.995, 0.024]} raycast={noopRaycast}>
        <planeGeometry args={[4.42, 0.09]} />
        <meshBasicMaterial color="#0F172A" />
      </mesh>
      <mesh position={[0, 0.948, 0.025]} raycast={noopRaycast}>
        <planeGeometry args={[4.42, 0.008]} />
        <meshBasicMaterial color="#E5A93C" />
      </mesh>
      <Suspense fallback={null}>
        <Text
          position={[-2.14, 0.995, 0.027]}
          fontSize={0.04}
          color="#E5A93C"
          anchorX="left"
          anchorY="middle"
        >
          📝 EXECUTIVE BOARDROOM WHITEBOARD · POINT & DRAG TO DRAW
        </Text>
        <Text
          position={[2.14, 0.995, 0.027]}
          fontSize={0.035}
          color="#94A3B8"
          anchorX="right"
          anchorY="middle"
        >
          {localStrokes.length === 0
            ? 'Clean Porcelain Canvas · Persistent Storage'
            : `${localStrokes.length} Stroke${localStrokes.length === 1 ? '' : 's'} Saved · Persistent`}
        </Text>
      </Suspense>

      {/* Interactive Porcelain-Enamel Drawing Surface */}
      <mesh
        position={[0, 0.05, 0.024]}
        onPointerOver={handleSurfacePointerOver}
        onPointerOut={handleSurfacePointerOut}
        onPointerDown={handleSurfacePointerDown}
        onPointerMove={handleSurfacePointerMove}
        onPointerUp={handleSurfacePointerUp}
      >
        <planeGeometry args={[boardWidth, boardHeight]} />
        <meshBasicMaterial
          map={texture}
          color="#ffffff"
          toneMapped={false}
        />
      </mesh>

      {/* Live 3D Marker / Eraser Nib Cursor Ring on the Whiteboard Surface */}
      {cursorUv && (
        <group
          position={[cursorLocalX, cursorLocalY, 0.027]}
          raycast={noopRaycast}
        >
          <mesh raycast={noopRaycast}>
            <ringGeometry args={[cursorRadius * 0.72, cursorRadius, 28]} />
            <meshBasicMaterial
              color={activeTool === 'eraser' ? '#F43F5E' : activeColor}
            />
          </mesh>
          {activeTool === 'pen' && (
            <mesh raycast={noopRaycast}>
              <circleGeometry args={[cursorRadius * 0.42, 20]} />
              <meshBasicMaterial
                color={activeColor}
                transparent
                opacity={0.45}
              />
            </mesh>
          )}
        </group>
      )}

      {/* Physical Brushed-Aluminum Marker & Eraser Tray Ledge */}
      <RoundedBox
        args={[4.48, 0.032, 0.11]}
        radius={0.008}
        smoothness={2}
        position={[0, -0.845, 0.048]}
        raycast={noopRaycast}
      >
        <meshStandardMaterial
          color="#334155"
          metalness={0.75}
          roughness={0.25}
        />
      </RoundedBox>

      {/* 3D Physical Dry-Erase Markers Resting on the Ledge */}
      {WHITEBOARD_MARKER_COLORS.map((m, idx) => {
        const isSelected = activeTool === 'pen' && activeColor === m.hex
        const mx = -1.78 + idx * 0.25
        return (
          <group
            key={`physical-marker-${m.id}`}
            position={[mx, isSelected ? -0.812 : -0.822, 0.072]}
            rotation={[0, 0, Math.PI / 2]}
            onClick={(e) => {
              e.stopPropagation()
              playSpatialUiFeedback('ui-click')
              setActiveTool('pen')
              setActiveColor(m.hex)
            }}
          >
            {/* White Marker Barrel */}
            <mesh raycast={noopRaycast}>
              <cylinderGeometry args={[0.011, 0.011, 0.15, 12]} />
              <meshStandardMaterial
                color="#F8FAFC"
                roughness={0.3}
                metalness={0.1}
              />
            </mesh>
            {/* Colored Marker Cap & Band */}
            <mesh position={[0, 0.055, 0]} raycast={noopRaycast}>
              <cylinderGeometry args={[0.0125, 0.0125, 0.048, 12]} />
              <meshStandardMaterial
                color={m.hex}
                emissive={m.hex}
                emissiveIntensity={isSelected ? 0.5 : 0.15}
                roughness={0.25}
              />
            </mesh>
          </group>
        )
      })}

      {/* 3D Physical Felt Dry-Erase Block Resting on the Ledge */}
      <group
        position={[-0.14, activeTool === 'eraser' ? -0.808 : -0.818, 0.074]}
        onClick={(e) => {
          e.stopPropagation()
          playSpatialUiFeedback('ui-click')
          setActiveTool((prev) => (prev === 'eraser' ? 'pen' : 'eraser'))
        }}
      >
        <RoundedBox
          args={[0.16, 0.032, 0.052]}
          radius={0.006}
          smoothness={2}
          raycast={noopRaycast}
        >
          <meshStandardMaterial
            color={activeTool === 'eraser' ? '#F43F5E' : '#475569'}
            roughness={0.85}
          />
        </RoundedBox>
        <mesh position={[0, -0.014, 0]} raycast={noopRaycast}>
          <boxGeometry args={[0.156, 0.008, 0.05]} />
          <meshStandardMaterial color="#E2E8F0" roughness={0.85} />
        </mesh>
      </group>

      {/* Bottom Interactive Toolbar Row (y = -0.955) */}
      <group position={[0, -0.955, 0.028]}>
        {/* 1. Six Marker Color Swatch Buttons */}
        {WHITEBOARD_MARKER_COLORS.map((c, idx) => {
          const isSelected = activeTool === 'pen' && activeColor === c.hex
          const isHovered = hoveredColorId === c.id
          const xPos = -2.04 + idx * 0.255
          return (
            <group
              key={c.id}
              position={[xPos, 0, 0]}
              scale={isHovered ? 1.06 : 1}
              onPointerOver={(e) => {
                e.stopPropagation()
                setHoveredColorId(c.id)
                setSpatialUiHovered(true, `wb-color-${c.id}`)
              }}
              onPointerOut={(e) => {
                e.stopPropagation()
                setHoveredColorId((prev) => (prev === c.id ? null : prev))
                setSpatialUiHovered(false, `wb-color-${c.id}`)
              }}
              onClick={(e) => {
                e.stopPropagation()
                playSpatialUiFeedback('ui-click')
                setActiveTool('pen')
                setActiveColor(c.hex)
              }}
            >
              {(isSelected || isHovered) && (
                <RoundedBox
                  args={[0.238, 0.124, 0.012]}
                  radius={0.018}
                  smoothness={2}
                  position={[0, 0, -0.002]}
                  raycast={noopRaycast}
                >
                  <meshBasicMaterial
                    color={isSelected ? '#FDE047' : '#94A3B8'}
                  />
                </RoundedBox>
              )}
              <RoundedBox
                args={[0.224, 0.11, 0.016]}
                radius={0.015}
                smoothness={2}
              >
                <meshBasicMaterial
                  color={isSelected ? '#1E293B' : '#0F172A'}
                />
              </RoundedBox>
              <mesh position={[-0.062, 0, 0.01]} raycast={noopRaycast}>
                <circleGeometry args={[0.028, 20]} />
                <meshBasicMaterial color={c.hex} />
              </mesh>
              <Suspense fallback={null}>
                <Text
                  position={[0.028, 0, 0.011]}
                  fontSize={0.032}
                  color={isSelected ? '#FDE047' : '#F8FAFC'}
                  anchorX="center"
                  anchorY="middle"
                >
                  {c.label}
                </Text>
              </Suspense>
            </group>
          )
        })}

        {/* 2. Selective Eraser Tool Toggle */}
        <WhiteboardToolbarChip
          id="eraser"
          label={activeTool === 'eraser' ? '🧽 Erasing' : '🧽 Eraser'}
          position={[-0.36, 0, 0]}
          width={0.34}
          active={activeTool === 'eraser'}
          accentColor="#F43F5E"
          textColor={activeTool === 'eraser' ? '#FFF1F2' : undefined}
          onClick={() =>
            setActiveTool((prev) => (prev === 'eraser' ? 'pen' : 'eraser'))
          }
        />

        {/* 3. Stroke Width Selector (Fine / Med / Bold) */}
        {(
          [
            { size: 1 as const, label: 'Fine' },
            { size: 2 as const, label: 'Med' },
            { size: 3 as const, label: 'Bold' },
          ] as const
        ).map((sz, idx) => (
          <WhiteboardToolbarChip
            key={sz.size}
            id={`size-${sz.size}`}
            label={sz.label}
            position={[-0.02 + idx * 0.23, 0, 0]}
            width={0.21}
            active={activeSize === sz.size}
            accentColor="#38BDF8"
            onClick={() => setActiveSize(sz.size)}
          />
        ))}

        {/* 4. Blueprint Grid Toggle */}
        <WhiteboardToolbarChip
          id="grid"
          label={showGrid ? '# Grid On' : '# Grid Off'}
          position={[0.74, 0, 0]}
          width={0.31}
          active={showGrid}
          accentColor="#334155"
          textColor={showGrid ? '#38BDF8' : '#94A3B8'}
          onClick={handleToggleGrid}
        />

        {/* 5. Undo Last Stroke (or Restore Cleared Board) */}
        <WhiteboardToolbarChip
          id="undo"
          label="↩ Undo"
          position={[1.1, 0, 0]}
          width={0.31}
          disabled={!canUndo}
          onClick={handleUndo}
        />

        {/* 6. Explicit Erase All / Clear Board */}
        <WhiteboardToolbarChip
          id="clear"
          label="🗑 Erase Board"
          position={[1.53, 0, 0]}
          width={0.44}
          disabled={localStrokes.length === 0}
          accentColor="#EF4444"
          textColor={localStrokes.length > 0 ? '#FCA5A5' : undefined}
          onClick={handleClearAll}
        />

        {/* 7. Optional Focus / Step Up to Board Button */}
        {onStandAtBoard && (
          <WhiteboardToolbarChip
            id="focus-board"
            label={isStandingAtBoard ? '📍 At Board' : '👣 Focus View'}
            position={[2.01, 0, 0]}
            width={0.42}
            active={isStandingAtBoard}
            accentColor="#E5A93C"
            onClick={onStandAtBoard}
          />
        )}
      </group>
    </group>
  )
}
