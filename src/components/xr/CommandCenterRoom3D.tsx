import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import type Hls from 'hls.js'
import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  COMMAND_STREAM_PRESETS,
  type ExpansionWingLayout,
} from '../../constants/expansionRooms'
import {
  COMMAND_WEATHER_CITIES,
  fetchCommandNewsFeed,
  fetchCommandWeather,
  getCommandWorldClocks,
  type CommandNewsFeedResult,
  type CommandWeatherReport,
  type WorldClockEntry,
} from '../../services/commandFeeds'
import type {
  CommandNewsCategoryId,
  ComputedSeat,
  ExpansionWingSyncedState,
  ParticipantProfile,
  PresenterState,
  RoomLightingConfig,
} from '../../types/lounge'

let hlsCtorPromise: Promise<typeof Hls> | null = null
function getHlsConstructor(): Promise<typeof Hls> {
  if (!hlsCtorPromise) {
    hlsCtorPromise = import('hls.js').then((m) => m.default)
  }
  return hlsCtorPromise
}

function isHlsStream(url: string): boolean {
  return /\.m3u8(\?|#|$)/i.test(url) || url.includes('mpegurl')
}

interface OpsButton3DProps {
  label: string
  position: [number, number, number]
  width?: number
  height?: number
  active?: boolean
  accent?: string
  fontSize?: number
  onClick: () => void
}

function OpsButton3D({
  label,
  position,
  width = 0.34,
  height = 0.085,
  active = false,
  accent = '#38BDF8',
  fontSize = 0.028,
  onClick,
}: OpsButton3DProps) {
  const [hovered, setHovered] = useState(false)
  const bg = active
    ? accent
    : hovered
      ? '#1E293B'
      : '#0F172A'
  const fg = active ? '#040810' : '#E2E8F0'

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
      <RoundedBox args={[width, height, 0.016]} radius={0.016} smoothness={2}>
        <meshBasicMaterial color={bg} />
      </RoundedBox>
      <Text
        position={[0, 0, 0.011]}
        fontSize={fontSize}
        color={fg}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  )
}

interface OperatorChairProps {
  seat: ComputedSeat
  isLocalSeat: boolean
  occupant?: ParticipantProfile
  onSelectSeat: (seatId: string) => void
}

function TacticalOperatorChair({
  seat,
  isLocalSeat,
  occupant,
  onSelectSeat,
}: OperatorChairProps) {
  const [hovered, setHovered] = useState(false)
  const takenByOther = Boolean(occupant && !isLocalSeat)

  return (
    <group
      position={seat.position}
      rotation={[0, seat.rotationY, 0]}
      onPointerOver={(e) => {
        e.stopPropagation()
        setHovered(true)
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation()
        if (!takenByOther) {
          onSelectSeat(seat.id)
        }
      }}
    >
      {/* Five-star caster pedestal base */}
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 0.05, 12]} />
        <meshStandardMaterial color="#1E293B" metalness={0.65} roughness={0.32} />
      </mesh>
      <mesh position={[0, 0.22, 0]}>
        <cylinderGeometry args={[0.05, 0.06, 0.34, 10]} />
        <meshStandardMaterial color="#475569" metalness={0.7} roughness={0.28} />
      </mesh>
      {/* Contoured tactical seat cushion */}
      <RoundedBox args={[0.54, 0.09, 0.52]} position={[0, 0.41, 0]} radius={0.03} smoothness={2}>
        <meshStandardMaterial
          color={hovered && !takenByOther ? '#254C78' : '#1E2D45'}
          roughness={0.55}
          metalness={0.18}
          emissive="#111C2D"
          emissiveIntensity={0.24}
        />
      </RoundedBox>
      {/* High ergonomic backrest + cyan trim */}
      <RoundedBox
        args={[0.5, 0.72, 0.08]}
        position={[0, 0.8, 0.23]}
        rotation={[0.08, 0, 0]}
        radius={0.03}
        smoothness={2}
      >
        <meshStandardMaterial
          color="#1A273D"
          roughness={0.52}
          metalness={0.22}
          emissive="#0F172A"
          emissiveIntensity={0.22}
        />
      </RoundedBox>
      <mesh position={[0, 1.12, 0.215]}>
        <boxGeometry args={[0.32, 0.025, 0.09]} />
        <meshBasicMaterial color={isLocalSeat ? '#E5A93C' : '#38BDF8'} />
      </mesh>
      {/* Armrests */}
      {[-0.28, 0.28].map((ax) => (
        <mesh key={ax} position={[ax, 0.58, 0.02]}>
          <boxGeometry args={[0.06, 0.04, 0.36]} />
          <meshStandardMaterial color="#334155" roughness={0.45} metalness={0.45} />
        </mesh>
      ))}
      {/* Floor interactive seat ring */}
      {(hovered || isLocalSeat) && (
        <mesh position={[0, 0.015, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.35, 0.41, 24]} />
          <meshBasicMaterial
            color={isLocalSeat ? '#E5A93C' : takenByOther ? '#EF4444' : '#38BDF8'}
          />
        </mesh>
      )}
    </group>
  )
}

export type LoungeMirrorCamPreset = 'wide' | 'screen' | 'games'

export interface CommandCenterRoom3DProps {
  wingLayout: ExpansionWingLayout
  wingState: ExpansionWingSyncedState
  lighting: RoomLightingConfig
  presenterState: PresenterState
  mainVideoTexture: THREE.VideoTexture
  hasMainVideoFrames: boolean
  loungeMirrorTexture: THREE.Texture
  loungeCamPreset: LoungeMirrorCamPreset
  onCycleLoungeCamPreset: () => void
  computedSeats: ComputedSeat[]
  localSeatId?: string
  participants: ParticipantProfile[]
  cinemaVolume: number
  onSelectSeat: (seatId: string) => void
  onTeleportToFloor?: (point: [number, number, number]) => void
  onUpdateWingState: (patch: Partial<ExpansionWingSyncedState>) => void
  onOpenCommandOpsDrawer?: () => void
}

export function CommandCenterRoom3D({
  wingLayout,
  wingState,
  lighting,
  presenterState,
  mainVideoTexture,
  hasMainVideoFrames,
  loungeMirrorTexture,
  loungeCamPreset,
  onCycleLoungeCamPreset,
  computedSeats,
  localSeatId,
  participants,
  cinemaVolume,
  onSelectSeat,
  onTeleportToFloor,
  onUpdateWingState,
  onOpenCommandOpsDrawer,
}: CommandCenterRoom3DProps) {
  const z0 = wingLayout.hallStartZ
  const cmdZ = wingLayout.commandCenter[2] // z0 + 15.1

  const [weather, setWeather] = useState<CommandWeatherReport | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherNonce, setWeatherNonce] = useState(0)

  const [news, setNews] = useState<CommandNewsFeedResult | null>(null)
  const [newsLoading, setNewsLoading] = useState(false)
  const [newsNonce, setNewsNonce] = useState(0)

  const [clocks, setClocks] = useState<WorldClockEntry[]>(() => getCommandWorldClocks())
  const [opsAudioUnmuted, setOpsAudioUnmuted] = useState(false)
  const [hasOpsFrames, setHasOpsFrames] = useState(false)
  const [preferRoomCam, setPreferRoomCam] = useState(false)

  // Dedicated lightweight HTML5 <video> + VideoTexture for independent Command Ops streams
  const opsMedia = useMemo(() => {
    const el = document.createElement('video')
    el.playsInline = true
    el.crossOrigin = 'anonymous'
    el.preload = 'metadata'
    el.loop = true
    el.muted = true
    const tex = new THREE.VideoTexture(el)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.minFilter = THREE.LinearFilter
    tex.magFilter = THREE.LinearFilter
    tex.generateMipmaps = false
    return { videoEl: el, texture: tex }
  }, [])

  const activeOpsPreset = useMemo(
    () =>
      COMMAND_STREAM_PRESETS.find((p) => p.id === wingState.commandStreamPresetId) ??
      COMMAND_STREAM_PRESETS[0],
    [wingState.commandStreamPresetId],
  )

  const effectiveOpsUrl =
    wingState.commandStreamPresetId === 'custom' && wingState.commandCustomStreamUrl
      ? wingState.commandCustomStreamUrl
      : activeOpsPreset.url
  const effectiveOpsTitle =
    wingState.commandStreamPresetId === 'custom' && wingState.commandCustomStreamTitle
      ? wingState.commandCustomStreamTitle
      : activeOpsPreset.label

  useEffect(() => {
    const { videoEl } = opsMedia
    videoEl.muted = !opsAudioUnmuted
    videoEl.volume = Math.max(0, Math.min(1, cinemaVolume))
  }, [cinemaVolume, opsAudioUnmuted, opsMedia])

  useEffect(() => {
    const { videoEl, texture } = opsMedia
    if (wingState.commandScreenMode !== 'ops-stream') {
      videoEl.pause()
      setHasOpsFrames(false)
      return
    }

    let hlsInstance: Hls | null = null
    let cancelled = false
    setHasOpsFrames(false)

    const markReady = () => {
      if (!cancelled) {
        setHasOpsFrames(true)
        texture.needsUpdate = true
      }
    }

    videoEl.addEventListener('loadeddata', markReady)
    videoEl.addEventListener('playing', markReady)

    const startPlayback = async () => {
      if (isHlsStream(effectiveOpsUrl) && !videoEl.canPlayType('application/vnd.apple.mpegurl')) {
        try {
          const HlsCtor = await getHlsConstructor()
          if (cancelled) return
          if (HlsCtor.isSupported()) {
            hlsInstance = new HlsCtor({ enableWorker: true, lowLatencyMode: true })
            hlsInstance.loadSource(effectiveOpsUrl)
            hlsInstance.attachMedia(videoEl)
            hlsInstance.on(HlsCtor.Events.MANIFEST_PARSED, () => {
              if (!cancelled) {
                void videoEl.play().catch(() => undefined)
              }
            })
            return
          }
        } catch {
          // Fall back to direct src
        }
      }
      videoEl.src = effectiveOpsUrl
      videoEl.load()
      void videoEl.play().catch(() => undefined)
    }

    void startPlayback()

    return () => {
      cancelled = true
      videoEl.removeEventListener('loadeddata', markReady)
      videoEl.removeEventListener('playing', markReady)
      if (hlsInstance) {
        hlsInstance.destroy()
      }
      videoEl.pause()
    }
  }, [effectiveOpsUrl, opsMedia, wingState.commandScreenMode])

  useEffect(() => {
    return () => {
      opsMedia.videoEl.pause()
      opsMedia.videoEl.removeAttribute('src')
      opsMedia.texture.dispose()
    }
  }, [opsMedia])

  // Live Weather Fetcher + 3-minute auto-refresh
  useEffect(() => {
    let cancelled = false
    setWeatherLoading(true)
    const run = async (force: boolean) => {
      const report = await fetchCommandWeather(
        wingState.commandWeatherCityId,
        wingState.commandCustomCityQuery,
        force,
      )
      if (!cancelled) {
        setWeather(report)
        setWeatherLoading(false)
      }
    }
    void run(weatherNonce > 0)
    const timer = window.setInterval(() => void run(true), 180_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [
    weatherNonce,
    wingState.commandCustomCityQuery,
    wingState.commandWeatherCityId,
  ])

  // Live News / Space / Markets Fetcher + 2.5-minute auto-refresh
  useEffect(() => {
    let cancelled = false
    setNewsLoading(true)
    const run = async (force: boolean) => {
      const feed = await fetchCommandNewsFeed(wingState.commandNewsCategory, force)
      if (!cancelled) {
        setNews(feed)
        setNewsLoading(false)
      }
    }
    void run(newsNonce > 0)
    const timer = window.setInterval(() => void run(true), 150_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [newsNonce, wingState.commandNewsCategory])

  // World clocks tick every 1s
  useEffect(() => {
    const id = window.setInterval(() => {
      setClocks(getCommandWorldClocks())
    }, 1000)
    return () => window.clearInterval(id)
  }, [])

  // Rotating 3D Holographic Tactical Globe (zero per-frame allocations)
  const globeRef = useRef<THREE.Group>(null)
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.1)
    if (globeRef.current) {
      globeRef.current.rotation.y += dt * 0.34
    }
    if (ring1Ref.current) {
      ring1Ref.current.rotation.z += dt * 0.45
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x -= dt * 0.32
    }
  })

  const commandSeats = useMemo(
    () => computedSeats.filter((s) => s.roomWing === 'command-center'),
    [computedSeats],
  )

  const seatOccupants = useMemo(() => {
    const map = new Map<string, ParticipantProfile>()
    for (const p of participants) {
      if (p.seatId) map.set(p.seatId, p)
    }
    return map
  }, [participants])

  const isMirrorMode = wingState.commandScreenMode === 'mirror-lounge'
  const showingDirectVideoMirror =
    isMirrorMode && hasMainVideoFrames && !preferRoomCam
  const showingLoungeRoomCam =
    isMirrorMode && (!hasMainVideoFrames || preferRoomCam)
  const showingOpsVideo =
    wingState.commandScreenMode === 'ops-stream' && hasOpsFrames

  const handleCycleOpsPreset = () => {
    const idx = COMMAND_STREAM_PRESETS.findIndex(
      (p) => p.id === wingState.commandStreamPresetId,
    )
    const next =
      COMMAND_STREAM_PRESETS[(idx + 1) % COMMAND_STREAM_PRESETS.length]
    onUpdateWingState({
      commandScreenMode: 'ops-stream',
      commandStreamPresetId: next.id,
    })
  }

  // Room geometry bounds: x in [-12.2, -1.65] (width = 10.55, center X = -6.925), dz in [10.6, 19.6] (depth = 9.0, center Z = z0 + 15.1)
  const roomW = 10.55
  const roomD = 9.0
  const roomH = 3.9
  const centerX = -6.925
  const brightnessScale = Math.max(0.55, Math.min(1.65, lighting.brightness))

  return (
    <group name="wing-command-center">
      {/* Anti-Static Tactical Slate Floor (supports double-click / VR glide) */}
      <mesh
        position={[centerX, 0.005, cmdZ]}
        rotation={[-Math.PI / 2, 0, 0]}
        onDoubleClick={(e) => {
          if (!onTeleportToFloor) return
          e.stopPropagation()
          onTeleportToFloor([e.point.x, 0, e.point.z])
        }}
      >
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial
          color="#162238"
          roughness={0.62}
          metalness={0.28}
          emissive="#0D1729"
          emissiveIntensity={0.34 * brightnessScale}
        />
      </mesh>

      {/* Luminous Tactical Floor Grid & Operator Pathway Strips */}
      {[-9.8, -7.8, -5.8, -3.8].map((gx, i) => (
        <mesh key={gx} position={[gx, 0.011, cmdZ]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <planeGeometry args={[0.032, roomD - 0.6]} />
          <meshBasicMaterial color={i % 2 === 0 ? '#38BDF8' : '#1E40AF'} />
        </mesh>
      ))}
      {[-3.2, 0, 3.2].map((gzOff, i) => (
        <mesh
          key={`hz-${i}`}
          position={[centerX, 0.011, cmdZ + gzOff]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={() => null}
        >
          <planeGeometry args={[roomW - 0.8, 0.026]} />
          <meshBasicMaterial color={i === 1 ? '#E5A93C' : '#0284C7'} />
        </mesh>
      ))}

      {/* Ceiling + Dual Overhead Cyan & Amber Tactical Halos */}
      <mesh position={[centerX, roomH, cmdZ]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[roomW, roomD]} />
        <meshStandardMaterial
          color="#121D31"
          roughness={0.82}
          emissive="#0B1526"
          emissiveIntensity={0.32 * brightnessScale}
        />
      </mesh>
      <mesh position={[-6.8, roomH - 0.04, cmdZ]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[2.25, 2.42, 36]} />
        <meshBasicMaterial color="#38BDF8" side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[-6.8, roomH - 0.045, cmdZ]} rotation={[Math.PI / 2, 0, 0]} raycast={() => null}>
        <ringGeometry args={[1.35, 1.44, 32]} />
        <meshBasicMaterial color="#E5A93C" side={THREE.DoubleSide} />
      </mesh>

      {/* West Media Wall (x = -12.2), North Wall (z0 + 10.6), South Wall (z0 + 19.6) */}
      <mesh position={[-12.2, roomH / 2, cmdZ]}>
        <boxGeometry args={[0.14, roomH, roomD]} />
        <meshStandardMaterial
          color="#18263E"
          roughness={0.68}
          metalness={0.28}
          emissive="#0E192D"
          emissiveIntensity={0.32 * brightnessScale}
        />
      </mesh>
      <mesh position={[centerX, roomH / 2, z0 + 10.6]}>
        <boxGeometry args={[roomW, roomH, 0.14]} />
        <meshStandardMaterial
          color="#1D2D47"
          roughness={0.72}
          metalness={0.22}
          emissive="#111C30"
          emissiveIntensity={0.32 * brightnessScale}
        />
      </mesh>
      <mesh position={[centerX, roomH / 2, z0 + 19.6]}>
        <boxGeometry args={[roomW, roomH, 0.14]} />
        <meshStandardMaterial
          color="#1D2D47"
          roughness={0.72}
          metalness={0.22}
          emissive="#111C30"
          emissiveIntensity={0.32 * brightnessScale}
        />
      </mesh>

      {/* Cyan & Gold Perimeter Cove Light Strips */}
      <mesh position={[-12.1, 3.76, cmdZ]} raycast={() => null}>
        <boxGeometry args={[0.04, 0.045, roomD - 0.4]} />
        <meshBasicMaterial color="#38BDF8" />
      </mesh>
      <mesh position={[-12.1, 0.12, cmdZ]} raycast={() => null}>
        <boxGeometry args={[0.04, 0.035, roomD - 0.4]} />
        <meshBasicMaterial color="#0EA5E9" />
      </mesh>
      <mesh position={[centerX, 3.76, z0 + 10.7]} raycast={() => null}>
        <boxGeometry args={[roomW - 0.6, 0.04, 0.04]} />
        <meshBasicMaterial color="#38BDF8" />
      </mesh>
      <mesh position={[centerX, 3.76, z0 + 19.5]} raycast={() => null}>
        <boxGeometry args={[roomW - 0.6, 0.04, 0.04]} />
        <meshBasicMaterial color="#38BDF8" />
      </mesh>

      {/* =================================================================== */}
      {/* TOP OVERHEAD 5-ZONE WORLD CLOCK & DEFCON STATUS BAR (West Wall)     */}
      {/* =================================================================== */}
      <group position={[-12.04, 3.48, cmdZ]} rotation={[0, Math.PI / 2, 0]}>
        <RoundedBox args={[7.4, 0.42, 0.04]} radius={0.02} smoothness={2}>
          <meshBasicMaterial color="#060B14" />
        </RoundedBox>
        <Text
          position={[-3.05, 0, 0.026]}
          fontSize={0.072}
          color="#38BDF8"
          anchorX="left"
          anchorY="middle"
        >
          🛰 COMMAND OPS
        </Text>
        {clocks.map((clk, idx) => (
          <group key={clk.code} position={[-1.35 + idx * 1.12, 0, 0.026]}>
            <Text
              position={[0, 0.08, 0]}
              fontSize={0.052}
              color="#94A3B8"
              anchorX="center"
              anchorY="middle"
            >
              {`${clk.code} · ${clk.city}`}
            </Text>
            <Text
              position={[0, -0.06, 0]}
              fontSize={0.085}
              color="#F8FAFC"
              anchorX="center"
              anchorY="middle"
            >
              {clk.time}
            </Text>
          </group>
        ))}
      </group>

      {/* =================================================================== */}
      {/* CENTER PRIMARY AUXILIARY VIEWING SCREEN (Mirror Lounge or Ops Feed) */}
      {/* =================================================================== */}
      <group position={[-12.04, 2.08, cmdZ]} rotation={[0, Math.PI / 2, 0]}>
        {/* Outer Bezel */}
        <RoundedBox args={[4.02, 2.34, 0.05]} radius={0.03} smoothness={2}>
          <meshStandardMaterial color="#090F1A" metalness={0.55} roughness={0.35} />
        </RoundedBox>

        {/* Active Video / Live Main Lounge Mirror Surface */}
        <mesh
          position={[0, 0.05, 0.029]}
          onClick={(e) => {
            e.stopPropagation()
            if (wingState.commandScreenMode === 'ops-stream') {
              if (opsMedia.videoEl.paused) {
                void opsMedia.videoEl.play().catch(() => undefined)
              } else {
                opsMedia.videoEl.pause()
              }
            } else if (isMirrorMode && hasMainVideoFrames) {
              setPreferRoomCam((v) => !v)
            } else if (isMirrorMode) {
              onCycleLoungeCamPreset()
            }
          }}
        >
          <planeGeometry args={[3.84, 2.02]} />
          {showingDirectVideoMirror ? (
            <meshBasicMaterial
              key="cmd-main-video"
              map={mainVideoTexture}
              color="#ffffff"
              toneMapped={false}
            />
          ) : showingLoungeRoomCam ? (
            <meshBasicMaterial
              key="cmd-lounge-cam"
              map={loungeMirrorTexture}
              color="#ffffff"
              toneMapped={false}
            />
          ) : showingOpsVideo ? (
            <meshBasicMaterial
              key="cmd-ops-video"
              map={opsMedia.texture}
              color="#ffffff"
              toneMapped={false}
            />
          ) : (
            <meshBasicMaterial key="cmd-standby" color="#07101E" />
          )}
        </mesh>

        {/* Live Main Lounge Mirror Status Badge + Optional Picture-in-Picture Room Cam */}
        {isMirrorMode && (
          <group position={[0, 0, 0.034]}>
            {/* Top-left live indicator pill */}
            <group position={[-1.12, 0.92, 0]}>
              <RoundedBox args={[1.48, 0.13, 0.008]} radius={0.015}>
                <meshBasicMaterial color="#060D1A" transparent opacity={0.82} />
              </RoundedBox>
              <Text
                position={[0, 0, 0.006]}
                fontSize={0.044}
                color="#34D399"
                anchorX="center"
                anchorY="middle"
              >
                {showingDirectVideoMirror
                  ? `🟢 LIVE MAIN LOUNGE STREAM · ${presenterState.mediaTitle || 'Active Feed'}`
                  : `🟢 LIVE MAIN LOUNGE CAM · ${loungeCamPreset === 'wide' ? 'WIDE HANGOUT' : loungeCamPreset === 'screen' ? 'CINEMA SCREEN' : 'BAR & GAMES'}`}
              </Text>
            </group>

            {/* Picture-in-Picture (PiP) 3D Room Cam when Main Video is Fullscreen */}
            {showingDirectVideoMirror && (
              <group
                position={[1.26, -0.58, 0.003]}
                onClick={(e) => {
                  e.stopPropagation()
                  setPreferRoomCam(true)
                }}
              >
                <RoundedBox args={[1.16, 0.66, 0.008]} radius={0.015}>
                  <meshBasicMaterial color="#E5A93C" />
                </RoundedBox>
                <mesh position={[0, 0, 0.006]}>
                  <planeGeometry args={[1.11, 0.61]} />
                  <meshBasicMaterial
                    key="cmd-pip-lounge-cam"
                    map={loungeMirrorTexture}
                    color="#ffffff"
                    toneMapped={false}
                  />
                </mesh>
                <Text
                  position={[0, -0.25, 0.01]}
                  fontSize={0.036}
                  color="#FDE68A"
                  anchorX="center"
                  anchorY="middle"
                >
                  🎥 LOUNGE ROOM CAM (CLICK TO EXPAND)
                </Text>
              </group>
            )}
          </group>
        )}

        {/* Loading Overlay only when Ops Stream is still buffering frames */}
        {!isMirrorMode && !showingOpsVideo && (
          <group position={[0, 0.08, 0.035]}>
            <Text
              position={[0, 0.24, 0]}
              fontSize={0.12}
              color="#38BDF8"
              anchorX="center"
              anchorY="middle"
            >
              CONNECTING TACTICAL STREAM…
            </Text>
            <Text
              position={[0, -0.02, 0]}
              fontSize={0.068}
              color="#94A3B8"
              maxWidth={3.3}
              textAlign="center"
              anchorX="center"
              anchorY="middle"
            >
              {`Loading ${effectiveOpsTitle}…`}
            </Text>
          </group>
        )}

        {/* Bottom Tactical Control Strip on Screen Bezel */}
        <group position={[0, -1.03, 0.032]}>
          <OpsButton3D
            label="📺 Mirror Main Lounge"
            position={[-1.32, 0, 0]}
            width={1.06}
            height={0.13}
            fontSize={0.052}
            active={isMirrorMode}
            accent="#E5A93C"
            onClick={() => {
              if (isMirrorMode && hasMainVideoFrames) {
                setPreferRoomCam((v) => !v)
              } else {
                setPreferRoomCam(false)
                onUpdateWingState({ commandScreenMode: 'mirror-lounge' })
              }
            }}
          />
          <OpsButton3D
            label="🛰 Independent Ops Feed"
            position={[-0.18, 0, 0]}
            width={1.1}
            height={0.13}
            fontSize={0.052}
            active={wingState.commandScreenMode === 'ops-stream'}
            accent="#38BDF8"
            onClick={() => onUpdateWingState({ commandScreenMode: 'ops-stream' })}
          />
          <OpsButton3D
            label={
              isMirrorMode
                ? `🎥 Cam: ${loungeCamPreset === 'wide' ? 'Wide' : loungeCamPreset === 'screen' ? 'Screen' : 'Games'}`
                : '⏭ Next Channel'
            }
            position={[0.84, 0, 0]}
            width={0.82}
            height={0.13}
            fontSize={0.05}
            active={isMirrorMode}
            accent="#38BDF8"
            onClick={() => {
              if (isMirrorMode) {
                if (hasMainVideoFrames && !preferRoomCam) {
                  setPreferRoomCam(true)
                } else {
                  onCycleLoungeCamPreset()
                }
              } else {
                handleCycleOpsPreset()
              }
            }}
          />
          <OpsButton3D
            label={opsAudioUnmuted ? '🔊 Ops Audio' : '🔇 Muted'}
            position={[1.62, 0, 0]}
            width={0.62}
            height={0.13}
            fontSize={0.048}
            active={opsAudioUnmuted}
            accent="#34D399"
            onClick={() => setOpsAudioUnmuted((v) => !v)}
          />
        </group>
      </group>

      {/* =================================================================== */}
      {/* LEFT FLANKING SCREEN (z = cmdZ + 2.95, angled inward) — LIVE WEATHER */}
      {/* =================================================================== */}
      <group
        position={[-11.58, 2.04, cmdZ + 2.96]}
        rotation={[0, Math.PI / 2 + 0.25, 0]}
      >
        <RoundedBox args={[2.32, 2.06, 0.04]} radius={0.028} smoothness={2}>
          <meshStandardMaterial color="#08111F" metalness={0.45} roughness={0.45} />
        </RoundedBox>
        <mesh position={[0, 0.98, 0.024]}>
          <planeGeometry args={[2.2, 0.025]} />
          <meshBasicMaterial color="#38BDF8" />
        </mesh>

        <Text
          position={[-1.04, 0.86, 0.026]}
          fontSize={0.068}
          color="#38BDF8"
          anchorX="left"
          anchorY="middle"
        >
          ⛅ ATMOSPHERIC &amp; RADAR
        </Text>
        <OpsButton3D
          label={weatherLoading ? '…' : '↻'}
          position={[0.96, 0.86, 0.026]}
          width={0.18}
          height={0.11}
          fontSize={0.055}
          onClick={() => setWeatherNonce((n) => n + 1)}
        />

        {/* City Selector Pills */}
        {COMMAND_WEATHER_CITIES.map((city, idx) => (
          <OpsButton3D
            key={city.id}
            label={city.shortLabel}
            position={[-0.88 + idx * 0.35, 0.68, 0.026]}
            width={0.31}
            height={0.11}
            fontSize={0.048}
            active={wingState.commandWeatherCityId === city.id}
            accent="#38BDF8"
            onClick={() => onUpdateWingState({ commandWeatherCityId: city.id })}
          />
        ))}

        {/* Current Conditions Readout */}
        {weather && (
          <group position={[0, 0.14, 0.026]}>
            <Text
              position={[-1.02, 0.32, 0]}
              fontSize={0.105}
              color="#F8FAFC"
              anchorX="left"
              anchorY="middle"
            >
              {`${weather.conditionIcon} ${weather.cityName}`}
            </Text>
            <Text
              position={[-1.02, 0.18, 0]}
              fontSize={0.052}
              color="#94A3B8"
              anchorX="left"
              anchorY="middle"
            >
              {`${weather.region} · ${weather.conditionLabel}`}
            </Text>
            <Text
              position={[1.02, 0.27, 0]}
              fontSize={0.19}
              color="#38BDF8"
              anchorX="right"
              anchorY="middle"
            >
              {`${weather.tempF}°F`}
            </Text>
            <Text
              position={[1.02, 0.09, 0]}
              fontSize={0.052}
              color="#94A3B8"
              anchorX="right"
              anchorY="middle"
            >
              {`${weather.tempC}°C · Feels ${weather.feelsLikeF}°F`}
            </Text>

            {/* Telemetry Metrics Bar */}
            <mesh position={[0, -0.08, -0.002]}>
              <planeGeometry args={[2.08, 0.18]} />
              <meshBasicMaterial color="#0F1C30" />
            </mesh>
            <Text
              position={[0, -0.08, 0.004]}
              fontSize={0.05}
              color="#CBD5E1"
              anchorX="center"
              anchorY="middle"
            >
              {`WIND ${weather.windMph} mph (G${weather.gustMph})  ·  HUM ${weather.humidity}%  ·  ${weather.pressureHpa} hPa`}
            </Text>

            {/* 4-Day Forecast Strip */}
            {weather.forecast.slice(0, 4).map((day, idx) => (
              <group key={day.dayLabel} position={[-0.78 + idx * 0.52, -0.44, 0]}>
                <mesh position={[0, 0, -0.002]}>
                  <planeGeometry args={[0.47, 0.42]} />
                  <meshBasicMaterial color="#0C1729" />
                </mesh>
                <Text position={[0, 0.13, 0.004]} fontSize={0.046} color="#94A3B8" anchorX="center" anchorY="middle">
                  {day.dayLabel}
                </Text>
                <Text position={[0, 0.01, 0.004]} fontSize={0.085} color="#F8FAFC" anchorX="center" anchorY="middle">
                  {day.icon}
                </Text>
                <Text position={[0, -0.12, 0.004]} fontSize={0.048} color="#E2E8F0" anchorX="center" anchorY="middle">
                  {`${day.highF}° / ${day.lowF}°`}
                </Text>
              </group>
            ))}

            <Text
              position={[-1.02, -0.82, 0]}
              fontSize={0.042}
              color={weather.source === 'open-meteo-live' ? '#34D399' : '#E5A93C'}
              anchorX="left"
              anchorY="middle"
            >
              {weather.source === 'open-meteo-live'
                ? '● LIVE OPEN-METEO SATELLITE TELEMETRY'
                : '● TELEMETRY RELAY STANDBY'}
            </Text>
          </group>
        )}
      </group>

      {/* =================================================================== */}
      {/* RIGHT FLANKING SCREEN (z = cmdZ - 2.96, angled inward) — LIVE NEWS   */}
      {/* =================================================================== */}
      <group
        position={[-11.58, 2.04, cmdZ - 2.96]}
        rotation={[0, Math.PI / 2 - 0.25, 0]}
      >
        <RoundedBox args={[2.32, 2.06, 0.04]} radius={0.028} smoothness={2}>
          <meshStandardMaterial color="#08111F" metalness={0.45} roughness={0.45} />
        </RoundedBox>
        <mesh position={[0, 0.98, 0.024]}>
          <planeGeometry args={[2.2, 0.025]} />
          <meshBasicMaterial color="#E5A93C" />
        </mesh>

        <Text
          position={[-1.04, 0.86, 0.026]}
          fontSize={0.068}
          color="#E5A93C"
          anchorX="left"
          anchorY="middle"
        >
          📡 GLOBAL WIRE &amp; MARKETS
        </Text>
        <OpsButton3D
          label={newsLoading ? '…' : '↻'}
          position={[0.96, 0.86, 0.026]}
          width={0.18}
          height={0.11}
          fontSize={0.055}
          accent="#E5A93C"
          onClick={() => setNewsNonce((n) => n + 1)}
        />

        {/* Category Tabs */}
        {(
          [
            { id: 'top', label: 'WORLD' },
            { id: 'tech', label: 'TECH' },
            { id: 'space', label: 'SPACE' },
            { id: 'markets', label: 'MARKETS' },
          ] as Array<{ id: CommandNewsCategoryId; label: string }>
        ).map((tab, idx) => (
          <OpsButton3D
            key={tab.id}
            label={tab.label}
            position={[-0.78 + idx * 0.52, 0.68, 0.026]}
            width={0.47}
            height={0.11}
            fontSize={0.046}
            active={wingState.commandNewsCategory === tab.id}
            accent="#E5A93C"
            onClick={() => onUpdateWingState({ commandNewsCategory: tab.id })}
          />
        ))}

        {/* Live Headlines List */}
        {news && (
          <group position={[0, 0.42, 0.026]}>
            {news.items.slice(0, 5).map((item, idx) => (
              <group key={item.id} position={[0, -idx * 0.255, 0]}>
                <mesh position={[0, -0.02, -0.002]}>
                  <planeGeometry args={[2.1, 0.22]} />
                  <meshBasicMaterial color={idx % 2 === 0 ? '#0C1729' : '#0F1D33'} />
                </mesh>
                <Text
                  position={[-1.0, 0.035, 0.004]}
                  fontSize={0.045}
                  color="#F8FAFC"
                  maxWidth={1.98}
                  anchorX="left"
                  anchorY="middle"
                >
                  {item.title.length > 74 ? `${item.title.slice(0, 72)}…` : item.title}
                </Text>
                <Text
                  position={[-1.0, -0.065, 0.004]}
                  fontSize={0.038}
                  color="#94A3B8"
                  anchorX="left"
                  anchorY="middle"
                >
                  {`${item.source} · ${item.publishedAgo}`}
                </Text>
                {item.badge && (
                  <Text
                    position={[1.0, -0.065, 0.004]}
                    fontSize={0.04}
                    color={item.badgeColor ?? '#38BDF8'}
                    anchorX="right"
                    anchorY="middle"
                  >
                    {item.badge}
                  </Text>
                )}
              </group>
            ))}

            <Text
              position={[-1.02, -1.28, 0]}
              fontSize={0.04}
              color={news.isLive ? '#34D399' : '#E5A93C'}
              anchorX="left"
              anchorY="middle"
            >
              {`● ${news.providerLabel.toUpperCase()}`}
            </Text>

            {onOpenCommandOpsDrawer && (
              <OpsButton3D
                label="Open Full Ops Console ↗"
                position={[0.58, -1.28, 0.006]}
                width={0.86}
                height={0.11}
                fontSize={0.042}
                accent="#38BDF8"
                onClick={onOpenCommandOpsDrawer}
              />
            )}
          </group>
        )}
      </group>

      {/* =================================================================== */}
      {/* CENTRAL HOLOGRAPHIC TACTICAL EARTH TABLE + OPERATOR DESK            */}
      {/* =================================================================== */}
      <group position={[-5.65, 0, cmdZ]}>
        {/* Pedestal */}
        <mesh position={[0, 0.34, 0]}>
          <cylinderGeometry args={[0.76, 0.9, 0.68, 8]} />
          <meshStandardMaterial
            color="#1E2D45"
            metalness={0.55}
            roughness={0.32}
            emissive="#111C30"
            emissiveIntensity={0.28 * brightnessScale}
          />
        </mesh>
        {/* Glowing Emitter Ring */}
        <mesh position={[0, 0.69, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.42, 0.72, 28]} />
          <meshBasicMaterial color="#0284C7" />
        </mesh>
        <mesh position={[0, 0.695, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <circleGeometry args={[0.41, 24]} />
          <meshBasicMaterial color="#38BDF8" transparent opacity={0.48} />
        </mesh>

        {/* Rotating 3D Wireframe Hologram Globe */}
        <group position={[0, 1.08, 0]} ref={globeRef}>
          <mesh raycast={() => null}>
            <sphereGeometry args={[0.34, 16, 12]} />
            <meshBasicMaterial color="#38BDF8" wireframe transparent opacity={0.78} />
          </mesh>
          <mesh raycast={() => null}>
            <sphereGeometry args={[0.19, 10, 8]} />
            <meshBasicMaterial color="#38BDF8" transparent opacity={0.32} />
          </mesh>
        </group>
        <mesh
          ref={ring1Ref}
          position={[0, 1.08, 0]}
          rotation={[Math.PI / 3, 0, 0]}
          raycast={() => null}
        >
          <torusGeometry args={[0.45, 0.008, 8, 36]} />
          <meshBasicMaterial color="#E5A93C" />
        </mesh>
        <mesh
          ref={ring2Ref}
          position={[0, 1.08, 0]}
          rotation={[-Math.PI / 4, 0.4, 0]}
          raycast={() => null}
        >
          <torusGeometry args={[0.52, 0.006, 8, 36]} />
          <meshBasicMaterial color="#38BDF8" />
        </mesh>
      </group>

      {/* Long Tactical Operator Bridge Desk facing West Media Wall */}
      <group position={[-8.95, 0, cmdZ]}>
        <RoundedBox args={[0.84, 0.74, 5.25]} position={[0, 0.37, 0]} radius={0.03} smoothness={2}>
          <meshStandardMaterial
            color="#1E2D45"
            roughness={0.45}
            metalness={0.42}
            emissive="#111C30"
            emissiveIntensity={0.28 * brightnessScale}
          />
        </RoundedBox>
        {/* Front & Rear Cyan LED Trim on Operator Bridge Desk */}
        <mesh position={[0.425, 0.68, 0]} raycast={() => null}>
          <boxGeometry args={[0.015, 0.025, 5.15]} />
          <meshBasicMaterial color="#38BDF8" />
        </mesh>
        <mesh position={[-0.425, 0.68, 0]} raycast={() => null}>
          <boxGeometry args={[0.015, 0.025, 5.15]} />
          <meshBasicMaterial color="#E5A93C" />
        </mesh>
        {/* Glowing console status pads & angled tactical mini-monitors at each station */}
        {[-1.95, -0.68, 0.68, 1.95].map((dzOff, i) => (
          <group key={i} position={[0, 0.746, dzOff]}>
            <mesh position={[0.14, 0, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
              <planeGeometry args={[0.38, 0.68]} />
              <meshBasicMaterial
                color={i % 2 === 0 ? '#38BDF8' : '#E5A93C'}
                transparent
                opacity={0.55}
              />
            </mesh>
            {/* Angled Mini Telemetry Monitor on Desk */}
            <mesh
              position={[-0.18, 0.14, 0]}
              rotation={[0, Math.PI / 2, -0.35]}
              raycast={() => null}
            >
              <boxGeometry args={[0.52, 0.24, 0.02]} />
              <meshBasicMaterial color="#0EA5E9" />
            </mesh>
          </group>
        ))}
      </group>

      {/* 4 Click-to-Sit Tactical Operator Chairs */}
      {commandSeats.map((seat) => (
        <TacticalOperatorChair
          key={seat.id}
          seat={seat}
          isLocalSeat={localSeatId === seat.id}
          occupant={seatOccupants.get(seat.id)}
          onSelectSeat={onSelectSeat}
        />
      ))}
    </group>
  )
}
