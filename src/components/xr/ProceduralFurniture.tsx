import { RoundedBox, Text } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useState } from 'react'
import * as THREE from 'three'
import { FURNITURE_COLOR_SWATCHES, getCatalogEntry } from '../../constants/hangout'
import type {
  ComputedSeat,
  ParticipantProfile,
  PlacedFurnitureItem,
} from '../../types/lounge'

const presetTextureCache = new Map<string, THREE.CanvasTexture>()

function getPresetPosterTexture(presetKey: string): THREE.CanvasTexture | null {
  if (typeof document === 'undefined') return null
  const cached = presetTextureCache.get(presetKey)
  if (cached) return cached

  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 360
  const ctx = canvas.getContext('2d')
  if (!ctx) return null

  if (presetKey === 'preset:cosmos') {
    const grad = ctx.createLinearGradient(0, 0, 0, 360)
    grad.addColorStop(0, '#050816')
    grad.addColorStop(0.55, '#132247')
    grad.addColorStop(1, '#2D1B4E')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 360)

    // Stars
    ctx.fillStyle = '#F8FAFC'
    for (let i = 0; i < 55; i++) {
      const sx = ((i * 73) % 240) + 8
      const sy = ((i * 47) % 260) + 10
      ctx.fillRect(sx, sy, i % 4 === 0 ? 3 : 2, i % 4 === 0 ? 3 : 2)
    }

    // Ringed planet
    ctx.beginPath()
    ctx.arc(128, 155, 54, 0, Math.PI * 2)
    const pGrad = ctx.createLinearGradient(80, 105, 175, 205)
    pGrad.addColorStop(0, '#38BDF8')
    pGrad.addColorStop(1, '#4F46E5')
    ctx.fillStyle = pGrad
    ctx.fill()

    ctx.strokeStyle = '#F59E0B'
    ctx.lineWidth = 6
    ctx.beginPath()
    ctx.ellipse(128, 160, 88, 20, -0.25, 0, Math.PI * 2)
    ctx.stroke()

    ctx.fillStyle = '#F4F1EA'
    ctx.font = 'bold 20px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('ODYSSEY', 128, 316)
  } else if (presetKey === 'preset:lofi') {
    const grad = ctx.createLinearGradient(0, 0, 256, 360)
    grad.addColorStop(0, '#1E1B4B')
    grad.addColorStop(1, '#7C2D12')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 360)

    // Vinyl record
    ctx.beginPath()
    ctx.arc(128, 160, 74, 0, Math.PI * 2)
    ctx.fillStyle = '#090A0F'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(128, 160, 26, 0, Math.PI * 2)
    ctx.fillStyle = '#E5A93C'
    ctx.fill()

    ctx.beginPath()
    ctx.arc(128, 160, 6, 0, Math.PI * 2)
    ctx.fillStyle = '#090A0F'
    ctx.fill()

    ctx.fillStyle = '#FDE68A'
    ctx.font = 'bold 18px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('LO-FI LOUNGE', 128, 312)
  } else if (presetKey === 'preset:arcade') {
    ctx.fillStyle = '#090717'
    ctx.fillRect(0, 0, 256, 360)

    // Neon grid
    ctx.strokeStyle = '#9333EA'
    ctx.lineWidth = 2
    for (let y = 210; y < 350; y += 22) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(256, y)
      ctx.stroke()
    }
    ctx.beginPath()
    ctx.arc(128, 150, 58, Math.PI, 0)
    ctx.fillStyle = '#EC4899'
    ctx.fill()

    ctx.fillStyle = '#22D3EE'
    ctx.font = 'bold 22px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('INSERT COIN', 128, 290)
  } else {
    // Default 'preset:synthwave'
    const grad = ctx.createLinearGradient(0, 0, 0, 360)
    grad.addColorStop(0, '#0F172A')
    grad.addColorStop(0.55, '#6B21A8')
    grad.addColorStop(1, '#DB2777')
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, 256, 360)

    ctx.beginPath()
    ctx.arc(128, 175, 62, 0, Math.PI * 2)
    const sunGrad = ctx.createLinearGradient(0, 110, 0, 238)
    sunGrad.addColorStop(0, '#FDE047')
    sunGrad.addColorStop(1, '#F97316')
    ctx.fillStyle = sunGrad
    ctx.fill()

    // Horizon mountains
    ctx.fillStyle = '#090D16'
    ctx.beginPath()
    ctx.moveTo(0, 240)
    ctx.lineTo(68, 192)
    ctx.lineTo(132, 228)
    ctx.lineTo(195, 184)
    ctx.lineTo(256, 236)
    ctx.lineTo(256, 360)
    ctx.lineTo(0, 360)
    ctx.closePath()
    ctx.fill()

    ctx.fillStyle = '#F4F1EA'
    ctx.font = 'bold 19px monospace'
    ctx.textAlign = 'center'
    ctx.fillText('NIGHT DRIVE', 128, 322)
  }

  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  presetTextureCache.set(presetKey, tex)
  return tex
}

function useSafePosterTexture(imageUrl?: string): THREE.Texture | null {
  const [externalTex, setExternalTex] = useState<THREE.Texture | null>(null)
  const effectiveKey = imageUrl?.trim() || 'preset:synthwave'
  const isPreset = effectiveKey.startsWith('preset:')

  const presetTex = useMemo(
    () => (isPreset ? getPresetPosterTexture(effectiveKey) : getPresetPosterTexture('preset:synthwave')),
    [effectiveKey, isPreset],
  )

  useEffect(() => {
    if (isPreset) {
      setExternalTex(null)
      return
    }
    let cancelled = false
    let loadedTexture: THREE.Texture | null = null
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      effectiveKey,
      (tex) => {
        if (cancelled) {
          tex.dispose()
          return
        }
        tex.colorSpace = THREE.SRGBColorSpace
        loadedTexture = tex
        setExternalTex(tex)
      },
      undefined,
      () => {
        if (!cancelled) setExternalTex(null)
      },
    )

    return () => {
      cancelled = true
      if (loadedTexture) {
        loadedTexture.dispose()
      }
    }
  }, [effectiveKey, isPreset])

  return isPreset ? presetTex : (externalTex ?? presetTex)
}

interface SeatCushionInteractiveProps {
  seat: ComputedSeat
  isLocalSeat: boolean
  occupant: ParticipantProfile | undefined
  buildMode: boolean
  onSelectSeat: (seatId: string) => void
}

function SeatCushionInteractive({
  seat,
  isLocalSeat,
  occupant,
  buildMode,
  onSelectSeat,
}: SeatCushionInteractiveProps) {
  const [hovered, setHovered] = useState(false)
  const isOccupiedByOther = Boolean(occupant && !isLocalSeat)
  const canSit = !buildMode && !isOccupiedByOther

  const ringColor = isLocalSeat
    ? '#E5A93C'
    : occupant
      ? occupant.avatarColor
      : hovered
        ? '#F2BE5C'
        : '#3B485E'

  const yRing = 0.015

  return (
    <group position={seat.localCushionOffset}>
      {/* Subtle floor / cushion anchor ring */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, yRing, 0]}>
        <ringGeometry args={[0.32, 0.38, 24]} />
        <meshBasicMaterial
          color={ringColor}
          transparent
          opacity={isLocalSeat ? 0.78 : hovered && canSit ? 0.72 : 0.25}
        />
      </mesh>

      {/* Invisible comfortable hit volume over the cushion when not in Build Mode */}
      {!buildMode && (
        <mesh
          position={[0, 0.36 + seat.seatHeightOffset, 0]}
          pointerEventsType={{ deny: 'grab' }}
          onPointerOver={(e) => {
            if (!canSit) return
            e.stopPropagation()
            setHovered(true)
          }}
          onPointerOut={() => setHovered(false)}
          onClick={(e) => {
            if (!canSit) return
            e.stopPropagation()
            onSelectSeat(seat.id)
          }}
        >
          <boxGeometry args={[0.72, 0.56, 0.72]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        </mesh>
      )}

      {/* Hover "Sit Here" badge */}
      {hovered && canSit && !isLocalSeat && (
        <group position={[0, 1.12 + seat.seatHeightOffset, 0]}>
          <RoundedBox args={[0.68, 0.17, 0.02]} radius={0.04} smoothness={2}>
            <meshBasicMaterial color="#0B0E14" transparent opacity={0.92} />
          </RoundedBox>
          <Suspense fallback={null}>
            <Text
              position={[0, 0, 0.014]}
              fontSize={0.062}
              color="#E5A93C"
              anchorX="center"
              anchorY="middle"
            >
              {`Sit · ${seat.label}`}
            </Text>
          </Suspense>
        </group>
      )}
    </group>
  )
}

function ProceduralItemGeometry({ item }: { item: PlacedFurnitureItem }) {
  const posterTexture = useSafePosterTexture(
    item.type === 'wall-poster' ? item.imageUrl : undefined,
  )

  switch (item.type) {
    case 'sofa-3':
      return (
        <group>
          {/* Base frame */}
          <RoundedBox args={[2.56, 0.22, 0.9]} radius={0.05} smoothness={2} position={[0, 0.14, 0]}>
            <meshStandardMaterial color="#171C26" roughness={0.82} metalness={0.14} />
          </RoundedBox>
          {/* 3 Plush seat cushions */}
          {[-0.82, 0, 0.82].map((cx) => (
            <RoundedBox
              key={cx}
              args={[0.78, 0.17, 0.78]}
              radius={0.055}
              smoothness={3}
              position={[cx, 0.32, -0.02]}
            >
              <meshStandardMaterial color={item.color} roughness={0.76} metalness={0.06} />
            </RoundedBox>
          ))}
          {/* Backrest */}
          <RoundedBox
            args={[2.52, 0.68, 0.2]}
            radius={0.07}
            smoothness={3}
            position={[0, 0.64, 0.35]}
            rotation={[0.12, 0, 0]}
          >
            <meshStandardMaterial color={item.color} roughness={0.78} metalness={0.06} />
          </RoundedBox>
          {/* Left & Right armrests */}
          <RoundedBox args={[0.16, 0.42, 0.86]} radius={0.05} smoothness={2} position={[-1.28, 0.42, 0.01]}>
            <meshStandardMaterial color={item.color} roughness={0.72} metalness={0.08} />
          </RoundedBox>
          <RoundedBox args={[0.16, 0.42, 0.86]} radius={0.05} smoothness={2} position={[1.28, 0.42, 0.01]}>
            <meshStandardMaterial color={item.color} roughness={0.72} metalness={0.08} />
          </RoundedBox>
          {/* Throw pillows */}
          <RoundedBox
            args={[0.3, 0.28, 0.12]}
            radius={0.05}
            smoothness={2}
            position={[-1.02, 0.52, 0.18]}
            rotation={[0.1, 0.25, -0.12]}
          >
            <meshStandardMaterial color="#E5A93C" roughness={0.85} />
          </RoundedBox>
          <RoundedBox
            args={[0.3, 0.28, 0.12]}
            radius={0.05}
            smoothness={2}
            position={[1.02, 0.52, 0.18]}
            rotation={[0.1, -0.25, 0.12]}
          >
            <meshStandardMaterial color="#E5A93C" roughness={0.85} />
          </RoundedBox>
        </group>
      )

    case 'loveseat-2':
      return (
        <group>
          <RoundedBox args={[1.78, 0.22, 0.88]} radius={0.05} smoothness={2} position={[0, 0.14, 0]}>
            <meshStandardMaterial color="#171C26" roughness={0.82} metalness={0.14} />
          </RoundedBox>
          {[-0.44, 0.44].map((cx) => (
            <RoundedBox
              key={cx}
              args={[0.82, 0.17, 0.76]}
              radius={0.055}
              smoothness={3}
              position={[cx, 0.32, -0.02]}
            >
              <meshStandardMaterial color={item.color} roughness={0.76} metalness={0.06} />
            </RoundedBox>
          ))}
          <RoundedBox
            args={[1.74, 0.66, 0.2]}
            radius={0.07}
            smoothness={3}
            position={[0, 0.63, 0.34]}
            rotation={[0.12, 0, 0]}
          >
            <meshStandardMaterial color={item.color} roughness={0.78} metalness={0.06} />
          </RoundedBox>
          <RoundedBox args={[0.15, 0.4, 0.84]} radius={0.05} smoothness={2} position={[-0.9, 0.41, 0.01]}>
            <meshStandardMaterial color={item.color} roughness={0.74} />
          </RoundedBox>
          <RoundedBox args={[0.15, 0.4, 0.84]} radius={0.05} smoothness={2} position={[0.9, 0.41, 0.01]}>
            <meshStandardMaterial color={item.color} roughness={0.74} />
          </RoundedBox>
        </group>
      )

    case 'armchair':
      return (
        <group>
          <RoundedBox args={[0.92, 0.22, 0.84]} radius={0.05} smoothness={3} position={[0, 0.14, 0]}>
            <meshStandardMaterial color="#181F2B" roughness={0.8} metalness={0.15} />
          </RoundedBox>
          <RoundedBox args={[0.82, 0.17, 0.76]} radius={0.06} smoothness={3} position={[0, 0.32, -0.02]}>
            <meshStandardMaterial color={item.color} roughness={0.72} metalness={0.08} />
          </RoundedBox>
          <RoundedBox
            args={[0.84, 0.7, 0.18]}
            radius={0.07}
            smoothness={3}
            position={[0, 0.65, 0.33]}
            rotation={[0.14, 0, 0]}
          >
            <meshStandardMaterial color={item.color} roughness={0.76} metalness={0.08} />
          </RoundedBox>
          <RoundedBox args={[0.13, 0.36, 0.76]} radius={0.04} smoothness={2} position={[-0.46, 0.42, 0.02]}>
            <meshStandardMaterial color={item.color} roughness={0.68} metalness={0.12} />
          </RoundedBox>
          <RoundedBox args={[0.13, 0.36, 0.76]} radius={0.04} smoothness={2} position={[0.46, 0.42, 0.02]}>
            <meshStandardMaterial color={item.color} roughness={0.68} metalness={0.12} />
          </RoundedBox>
        </group>
      )

    case 'beanbag':
      return (
        <group>
          <mesh position={[0, 0.24, 0.02]} scale={[1.05, 0.56, 1.1]}>
            <sphereGeometry args={[0.52, 20, 16]} />
            <meshStandardMaterial color={item.color} roughness={0.88} metalness={0.03} />
          </mesh>
          <mesh position={[0, 0.42, 0.24]} scale={[0.78, 0.65, 0.62]}>
            <sphereGeometry args={[0.38, 16, 14]} />
            <meshStandardMaterial color={item.color} roughness={0.88} metalness={0.03} />
          </mesh>
        </group>
      )

    case 'barstool':
      return (
        <group>
          {/* Weighted floor disc */}
          <mesh position={[0, 0.02, 0]}>
            <cylinderGeometry args={[0.26, 0.28, 0.04, 20]} />
            <meshStandardMaterial color="#1E2430" roughness={0.35} metalness={0.68} />
          </mesh>
          {/* Central column */}
          <mesh position={[0, 0.36, 0]}>
            <cylinderGeometry args={[0.04, 0.045, 0.66, 14]} />
            <meshStandardMaterial color="#94A3B8" roughness={0.28} metalness={0.78} />
          </mesh>
          {/* Footrest ring */}
          <mesh position={[0, 0.24, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.19, 0.014, 10, 24]} />
            <meshStandardMaterial color="#94A3B8" roughness={0.3} metalness={0.78} />
          </mesh>
          {/* Padded swivel cushion */}
          <mesh position={[0, 0.71, 0]}>
            <cylinderGeometry args={[0.26, 0.25, 0.1, 22]} />
            <meshStandardMaterial color={item.color} roughness={0.62} metalness={0.12} />
          </mesh>
          {/* Low lumbar lip */}
          <RoundedBox args={[0.38, 0.16, 0.07]} radius={0.03} smoothness={2} position={[0, 0.82, 0.21]}>
            <meshStandardMaterial color={item.color} roughness={0.65} />
          </RoundedBox>
        </group>
      )

    case 'coffee-table':
      return (
        <group>
          {/* Tabletop */}
          <RoundedBox args={[2.05, 0.08, 0.84]} radius={0.035} smoothness={3} position={[0, 0.38, 0]}>
            <meshStandardMaterial color={item.color} roughness={0.48} metalness={0.24} />
          </RoundedBox>
          {/* Lower magazine shelf */}
          <RoundedBox args={[1.65, 0.04, 0.62]} radius={0.02} smoothness={2} position={[0, 0.14, 0]}>
            <meshStandardMaterial color="#181E2A" roughness={0.7} metalness={0.2} />
          </RoundedBox>
          {/* 4 Legs */}
          {[
            [-0.86, -0.32],
            [0.86, -0.32],
            [-0.86, 0.32],
            [0.86, 0.32],
          ].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, 0.19, lz]}>
              <cylinderGeometry args={[0.03, 0.024, 0.36, 10]} />
              <meshStandardMaterial color="#12161F" roughness={0.4} metalness={0.55} />
            </mesh>
          ))}
          {/* Glowing coasters */}
          <mesh position={[-0.52, 0.424, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.085, 18]} />
            <meshBasicMaterial color="#E5A93C" />
          </mesh>
          <mesh position={[0.52, 0.424, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.085, 18]} />
            <meshBasicMaterial color="#E5A93C" />
          </mesh>
        </group>
      )

    case 'bar-counter':
      return (
        <group>
          {/* Counter body */}
          <RoundedBox args={[2.8, 1.02, 0.68]} radius={0.04} smoothness={2} position={[0, 0.51, 0]}>
            <meshStandardMaterial color={item.color} roughness={0.68} metalness={0.22} />
          </RoundedBox>
          {/* Overhanging bar top */}
          <RoundedBox args={[2.96, 0.07, 0.84]} radius={0.03} smoothness={3} position={[0, 1.05, 0.04]}>
            <meshStandardMaterial color="#1A1412" roughness={0.36} metalness={0.3} />
          </RoundedBox>
          {/* Under-bar LED accent strip */}
          <mesh position={[0, 0.98, 0.36]}>
            <boxGeometry args={[2.76, 0.024, 0.02]} />
            <meshBasicMaterial color="#E5A93C" />
          </mesh>
          {/* Decorative cocktail shaker & glasses */}
          <mesh position={[-0.7, 1.16, 0]}>
            <cylinderGeometry args={[0.045, 0.038, 0.16, 12]} />
            <meshStandardMaterial color="#CBD5E1" roughness={0.2} metalness={0.85} />
          </mesh>
          <mesh position={[-0.45, 1.13, 0.04]}>
            <cylinderGeometry args={[0.04, 0.03, 0.1, 12]} />
            <meshBasicMaterial color="#38BDF8" transparent opacity={0.65} />
          </mesh>
        </group>
      )

    case 'rug-plush':
      return (
        <group>
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.008, 0]}>
            <planeGeometry args={[4.8, 3.0]} />
            <meshStandardMaterial color={item.color} roughness={0.96} metalness={0.02} />
          </mesh>
          {/* Woven border trim */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]}>
            <planeGeometry args={[5.0, 3.2]} />
            <meshStandardMaterial color="#E5A93C" roughness={0.9} metalness={0.08} />
          </mesh>
        </group>
      )

    case 'plant-monstera':
      return (
        <group>
          {/* Ceramic pot */}
          <mesh position={[0, 0.24, 0]}>
            <cylinderGeometry args={[0.24, 0.18, 0.48, 16]} />
            <meshStandardMaterial color="#D6D3D1" roughness={0.65} metalness={0.08} />
          </mesh>
          {/* Soil */}
          <mesh position={[0, 0.47, 0]}>
            <cylinderGeometry args={[0.22, 0.22, 0.03, 16]} />
            <meshStandardMaterial color="#291D16" roughness={0.95} />
          </mesh>
          {/* Lush layered botanical leaves */}
          {[0, 1.1, 2.2, 3.3, 4.4, 5.4].map((ang, idx) => {
            const tilt = 0.42 + (idx % 2) * 0.22
            const h = 0.72 + (idx % 3) * 0.16
            return (
              <group key={idx} position={[0, 0.46, 0]} rotation={[0, ang, 0]}>
                <mesh position={[0, h * 0.45, 0.14]} rotation={[0.32, 0, 0]}>
                  <cylinderGeometry args={[0.012, 0.016, h, 6]} />
                  <meshStandardMaterial color="#166534" roughness={0.7} />
                </mesh>
                <mesh
                  position={[0, h * 0.85, 0.28]}
                  rotation={[tilt, 0, 0]}
                  scale={[1, 0.12, 1.35]}
                >
                  <sphereGeometry args={[0.19, 12, 10]} />
                  <meshStandardMaterial color={item.color} roughness={0.55} metalness={0.05} />
                </mesh>
              </group>
            )
          })}
        </group>
      )

    case 'lamp-floor':
      return (
        <group>
          {/* Tripod legs */}
          {[0, (Math.PI * 2) / 3, (Math.PI * 4) / 3].map((ang, i) => (
            <group key={i} rotation={[0, ang, 0]}>
              <mesh position={[0, 0.68, 0.14]} rotation={[-0.18, 0, 0]}>
                <cylinderGeometry args={[0.016, 0.02, 1.4, 8]} />
                <meshStandardMaterial color="#27272A" roughness={0.45} metalness={0.55} />
              </mesh>
            </group>
          ))}
          {/* Warm emissive drum shade (zero pointLight shader cost!) */}
          <mesh position={[0, 1.46, 0]}>
            <cylinderGeometry args={[0.21, 0.27, 0.36, 20]} />
            <meshStandardMaterial
              color={item.color}
              emissive={item.color}
              emissiveIntensity={1.15}
              roughness={0.5}
            />
          </mesh>
          {/* Inner glowing bulb core */}
          <mesh position={[0, 1.42, 0]}>
            <sphereGeometry args={[0.08, 12, 12]} />
            <meshBasicMaterial color="#FFFBEB" />
          </mesh>
          {/* Soft floor light pool */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.009, 0]}>
            <circleGeometry args={[0.85, 24]} />
            <meshBasicMaterial color={item.color} transparent opacity={0.16} depthWrite={false} />
          </mesh>
        </group>
      )

    case 'popcorn-cart':
      return (
        <group>
          {/* Red & gold vintage base */}
          <RoundedBox args={[0.66, 0.72, 0.52]} radius={0.03} smoothness={2} position={[0, 0.42, 0]}>
            <meshStandardMaterial color={item.color} roughness={0.45} metalness={0.25} />
          </RoundedBox>
          {/* Warm illuminated glass kettle box */}
          <RoundedBox args={[0.62, 0.56, 0.48]} radius={0.02} smoothness={2} position={[0, 1.06, 0]}>
            <meshStandardMaterial
              color="#FEF3C7"
              emissive="#F59E0B"
              emissiveIntensity={0.65}
              transparent
              opacity={0.78}
            />
          </RoundedBox>
          {/* Striped canopy roof */}
          <RoundedBox args={[0.72, 0.1, 0.58]} radius={0.03} smoothness={2} position={[0, 1.38, 0]}>
            <meshStandardMaterial color={item.color} roughness={0.5} />
          </RoundedBox>
          {/* Vintage spoked wheels */}
          {[-0.35, 0.35].map((wx) => (
            <mesh key={wx} position={[wx, 0.18, 0.12]} rotation={[0, Math.PI / 2, 0]}>
              <torusGeometry args={[0.16, 0.022, 8, 20]} />
              <meshStandardMaterial color="#E5A93C" roughness={0.35} metalness={0.65} />
            </mesh>
          ))}
        </group>
      )

    case 'arcade-cabinet':
      return (
        <group>
          {/* Main upright cabinet */}
          <RoundedBox args={[0.74, 1.72, 0.68]} radius={0.04} smoothness={2} position={[0, 0.86, 0]}>
            <meshStandardMaterial color="#131624" roughness={0.55} metalness={0.28} />
          </RoundedBox>
          {/* Neon side trim */}
          <mesh position={[-0.375, 0.88, -0.02]}>
            <boxGeometry args={[0.015, 1.62, 0.58]} />
            <meshBasicMaterial color={item.color} />
          </mesh>
          <mesh position={[0.375, 0.88, -0.02]}>
            <boxGeometry args={[0.015, 1.62, 0.58]} />
            <meshBasicMaterial color={item.color} />
          </mesh>
          {/* Illuminated top marquee */}
          <mesh position={[0, 1.58, -0.32]} rotation={[0.18, 0, 0]}>
            <planeGeometry args={[0.66, 0.18]} />
            <meshBasicMaterial color={item.color} />
          </mesh>
          {/* Glowing CRT screen */}
          <mesh position={[0, 1.18, -0.31]} rotation={[-0.22, 0, 0]}>
            <planeGeometry args={[0.58, 0.44]} />
            <meshBasicMaterial color="#22D3EE" />
          </mesh>
          {/* Control deck */}
          <RoundedBox args={[0.7, 0.08, 0.32]} radius={0.02} smoothness={2} position={[0, 0.88, -0.28]}>
            <meshStandardMaterial color="#1E293B" roughness={0.4} />
          </RoundedBox>
        </group>
      )

    case 'wall-poster':
      return (
        <group>
          {/* Gallery frame */}
          <RoundedBox args={[1.42, 1.96, 0.05]} radius={0.03} smoothness={2} position={[0, 0, 0.025]}>
            <meshStandardMaterial color={item.color} roughness={0.42} metalness={0.35} />
          </RoundedBox>
          {/* Poster canvas */}
          <mesh position={[0, 0, 0.054]}>
            <planeGeometry args={[1.26, 1.8]} />
            {posterTexture ? (
              <meshBasicMaterial map={posterTexture} toneMapped={false} />
            ) : (
              <meshBasicMaterial color="#1E293B" />
            )}
          </mesh>
        </group>
      )

    case 'neon-sign': {
      const signText = (item.label?.trim() || 'GOOD VIBES').slice(0, 16)
      return (
        <group>
          {/* Smoked acrylic backing */}
          <RoundedBox args={[1.85, 0.58, 0.03]} radius={0.08} smoothness={2} position={[0, 0, 0.02]}>
            <meshStandardMaterial color="#090C14" transparent opacity={0.72} roughness={0.2} />
          </RoundedBox>
          {/* Outer neon border tube */}
          <mesh position={[0, 0, 0.042]}>
            <ringGeometry args={[0.84, 0.87, 4]} />
            <meshBasicMaterial transparent opacity={0} />
          </mesh>
          <mesh position={[0, 0.25, 0.04]}>
            <boxGeometry args={[1.68, 0.024, 0.02]} />
            <meshBasicMaterial color={item.color} />
          </mesh>
          <mesh position={[0, -0.25, 0.04]}>
            <boxGeometry args={[1.68, 0.024, 0.02]} />
            <meshBasicMaterial color={item.color} />
          </mesh>
          {/* Soft wall halo */}
          <mesh position={[0, 0, 0.008]}>
            <planeGeometry args={[2.3, 0.95]} />
            <meshBasicMaterial color={item.color} transparent opacity={0.18} depthWrite={false} />
          </mesh>
          <Suspense fallback={null}>
            <Text
              position={[0, 0, 0.05]}
              fontSize={0.19}
              letterSpacing={0.08}
              color={item.color}
              anchorX="center"
              anchorY="middle"
            >
              {signText}
            </Text>
          </Suspense>
        </group>
      )
    }
  }
}

interface GizmoChipProps {
  label: string
  position: [number, number, number]
  width?: number
  color?: string
  textColor?: string
  onClick: () => void
}

function GizmoChip({
  label,
  position,
  width = 0.22,
  color = '#161D2A',
  textColor = '#F4F1EA',
  onClick,
}: GizmoChipProps) {
  const [hovered, setHovered] = useState(false)
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
      <RoundedBox args={[width, 0.11, 0.02]} radius={0.025} smoothness={2}>
        <meshBasicMaterial color={hovered ? '#E5A93C' : color} />
      </RoundedBox>
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.015]}
          fontSize={0.042}
          color={hovered ? '#080A0D' : textColor}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Suspense>
    </group>
  )
}

export interface ProceduralFurnitureLayerProps {
  furniture: PlacedFurnitureItem[]
  computedSeats: ComputedSeat[]
  localSeatId: string | undefined
  localSeatIndex: number
  participants: ParticipantProfile[]
  rearBalcony: boolean
  balconyZ: number
  buildMode: boolean
  selectedFurnitureId: string | null
  onSelectSeat: (seatId: string) => void
  onSelectFurniture: (id: string | null) => void
  onUpdateFurnitureItem: (id: string, patch: Partial<PlacedFurnitureItem>) => void
  onDuplicateFurnitureItem: (id: string) => void
  onDeleteFurnitureItem: (id: string) => void
  onEditFurnitureMedia?: (id: string) => void
}

export function ProceduralFurnitureLayer({
  furniture,
  computedSeats,
  localSeatId,
  localSeatIndex,
  participants,
  rearBalcony,
  balconyZ,
  buildMode,
  selectedFurnitureId,
  onSelectSeat,
  onSelectFurniture,
  onUpdateFurnitureItem,
  onDuplicateFurnitureItem,
  onDeleteFurnitureItem,
  onEditFurnitureMedia,
}: ProceduralFurnitureLayerProps) {
  const seatsByFurniture = useMemo(() => {
    const map = new Map<string, ComputedSeat[]>()
    for (const s of computedSeats) {
      const list = map.get(s.furnitureId) ?? []
      list.push(s)
      map.set(s.furnitureId, list)
    }
    return map
  }, [computedSeats])

  return (
    <group name="procedural-hangout-furniture">
      {furniture.map((item) => {
        const entry = getCatalogEntry(item.type)
        const isWallItem = entry.placementSurface === 'wall'
        const isSelected = buildMode && selectedFurnitureId === item.id
        const itemScale = Math.max(0.6, Math.min(1.6, item.scale || 1))

        // Auto-elevate floor furniture sitting on the rear balcony riser
        const onBalcony =
          !isWallItem &&
          rearBalcony &&
          Math.abs(item.position[0]) < 4.7 &&
          item.position[2] > balconyZ - 1.65 &&
          item.position[2] < balconyZ + 1.65
        const effectiveY = isWallItem ? item.position[1] : onBalcony ? 0.38 : 0

        const attachedSeats = seatsByFurniture.get(item.id) ?? []

        return (
          <group
            key={item.id}
            position={[item.position[0], effectiveY, item.position[2]]}
            rotation={[0, item.rotationY, 0]}
          >
            {/* Build Mode selection highlight ring */}
            {buildMode && (
              <mesh
                rotation={isWallItem ? [0, 0, 0] : [-Math.PI / 2, 0, 0]}
                position={isWallItem ? [0, 0, 0.01] : [0, 0.018, 0]}
              >
                <ringGeometry args={[0.75 * itemScale, 0.84 * itemScale, 32]} />
                <meshBasicMaterial
                  color={isSelected ? '#22D3EE' : '#E5A93C'}
                  transparent
                  opacity={isSelected ? 0.9 : 0.28}
                />
              </mesh>
            )}

            {/* Scaled Procedural 3D Mesh */}
            <group
              scale={[itemScale, itemScale, itemScale]}
              pointerEventsType={{ deny: 'grab' }}
              onClick={
                buildMode
                  ? (e) => {
                      e.stopPropagation()
                      onSelectFurniture(item.id)
                    }
                  : undefined
              }
            >
              <ProceduralItemGeometry item={item} />

              {/* Dynamic Seating Cushion Targets */}
              {attachedSeats.map((seat) => {
                const isLocal = localSeatId
                  ? seat.id === localSeatId
                  : seat.index === localSeatIndex
                const occupant = participants.find((p) =>
                  p.seatId ? p.seatId === seat.id : p.seatIndex === seat.index,
                )
                return (
                  <SeatCushionInteractive
                    key={seat.id}
                    seat={seat}
                    isLocalSeat={isLocal}
                    occupant={occupant}
                    buildMode={buildMode}
                    onSelectSeat={onSelectSeat}
                  />
                )
              })}
            </group>

            {/* Floating 3D Quick-Edit Gizmo above Selected Item in Build Mode */}
            {isSelected && (
              <group
                position={[0, isWallItem ? 1.22 * itemScale : 1.55 * itemScale, isWallItem ? 0.14 : 0]}
              >
                <RoundedBox args={[1.64, 0.34, 0.024]} radius={0.04} smoothness={2}>
                  <meshBasicMaterial color="#0A0E16" transparent opacity={0.94} />
                </RoundedBox>
                <Suspense fallback={null}>
                  <Text
                    position={[0, 0.105, 0.016]}
                    fontSize={0.044}
                    color="#22D3EE"
                    anchorX="center"
                    anchorY="middle"
                  >
                    {`${entry.label.toUpperCase()} · POINT & CLICK ${isWallItem ? 'ANY WALL' : 'FLOOR'} TO MOVE`}
                  </Text>
                </Suspense>

                <GizmoChip
                  label="⟲ -30°"
                  position={[-0.64, -0.045, 0.016]}
                  width={0.21}
                  onClick={() =>
                    onUpdateFurnitureItem(item.id, {
                      rotationY: Number((item.rotationY - Math.PI / 6).toFixed(4)),
                    })
                  }
                />
                <GizmoChip
                  label="⟳ +30°"
                  position={[-0.41, -0.045, 0.016]}
                  width={0.21}
                  onClick={() =>
                    onUpdateFurnitureItem(item.id, {
                      rotationY: Number((item.rotationY + Math.PI / 6).toFixed(4)),
                    })
                  }
                />
                <GizmoChip
                  label="Size -"
                  position={[-0.19, -0.045, 0.016]}
                  width={0.19}
                  onClick={() =>
                    onUpdateFurnitureItem(item.id, {
                      scale: Math.max(0.65, Number((itemScale - 0.12).toFixed(2))),
                    })
                  }
                />
                <GizmoChip
                  label="Size +"
                  position={[0.02, -0.045, 0.016]}
                  width={0.19}
                  onClick={() =>
                    onUpdateFurnitureItem(item.id, {
                      scale: Math.min(1.55, Number((itemScale + 0.12).toFixed(2))),
                    })
                  }
                />
                <GizmoChip
                  label="Color ●"
                  position={[0.24, -0.045, 0.016]}
                  width={0.21}
                  onClick={() => {
                    const idx = FURNITURE_COLOR_SWATCHES.findIndex(
                      (s) => s.hex.toLowerCase() === item.color.toLowerCase(),
                    )
                    const nextSwatch =
                      FURNITURE_COLOR_SWATCHES[(idx + 1) % FURNITURE_COLOR_SWATCHES.length]
                    onUpdateFurnitureItem(item.id, { color: nextSwatch.hex })
                  }}
                />
                {(item.type === 'wall-poster' || item.type === 'neon-sign') &&
                onEditFurnitureMedia ? (
                  <GizmoChip
                    label={item.type === 'wall-poster' ? 'Image' : 'Text'}
                    position={[0.46, -0.045, 0.016]}
                    width={0.19}
                    color="#1E3A5F"
                    onClick={() => onEditFurnitureMedia(item.id)}
                  />
                ) : (
                  <GizmoChip
                    label="Clone"
                    position={[0.46, -0.045, 0.016]}
                    width={0.19}
                    onClick={() => onDuplicateFurnitureItem(item.id)}
                  />
                )}
                <GizmoChip
                  label="Delete"
                  position={[0.67, -0.045, 0.016]}
                  width={0.19}
                  color="#7F1D1D"
                  onClick={() => onDeleteFurnitureItem(item.id)}
                />
              </group>
            )}
          </group>
        )
      })}
    </group>
  )
}
