import { RoundedBox } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef } from 'react'
import * as THREE from 'three'
import { resolveAvatarCustomization } from '../../constants/avatars'
import type {
  AvatarAccessoryId,
  AvatarCustomization,
  AvatarFaceId,
  AvatarHatId,
  AvatarOutfitId,
  AvatarStyleId,
} from '../../types/lounge'

const NOOP_RAYCAST = () => null

function AvatarHat3D({
  hat,
  accentColor,
  bodyColor,
  baseY,
}: {
  hat: AvatarHatId
  accentColor: string
  bodyColor: string
  baseY: number
}) {
  if (hat === 'none') return null

  return (
    <group position={[0, baseY, 0]}>
      {hat === 'beanie' && (
        <group position={[0, 0.015, 0.005]}>
          {/* Ribbed cuff */}
          <mesh raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.128, 0.126, 0.042, 20]} />
            <meshStandardMaterial color={accentColor} roughness={0.85} />
          </mesh>
          {/* Knit dome */}
          <mesh position={[0, 0.032, 0.006]} scale={[1, 0.72, 1.04]} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.122, 18, 14]} />
            <meshStandardMaterial color={bodyColor} roughness={0.88} />
          </mesh>
          {/* Pom-pom */}
          <mesh position={[0, 0.11, 0.012]} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.028, 12, 12]} />
            <meshStandardMaterial color={accentColor} roughness={0.9} />
          </mesh>
        </group>
      )}

      {hat === 'baseball-cap' && (
        <group position={[0, 0.012, 0]}>
          {/* Cap crown */}
          <mesh scale={[1, 0.68, 1.05]} position={[0, 0.02, 0.005]} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.124, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.6]} />
            <meshStandardMaterial color={accentColor} roughness={0.68} />
          </mesh>
          {/* Forward visor bill (-Z forward) */}
          <RoundedBox
            args={[0.165, 0.012, 0.11]}
            radius={0.005}
            smoothness={2}
            position={[0, 0.006, -0.125]}
            rotation={[0.12, 0, 0]}
            raycast={NOOP_RAYCAST}
          >
            <meshStandardMaterial color="#0F172A" roughness={0.55} />
          </RoundedBox>
          {/* Top button */}
          <mesh position={[0, 0.098, 0.005]} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.013, 10, 10]} />
            <meshBasicMaterial color="#F8FAFC" />
          </mesh>
        </group>
      )}

      {hat === 'crown' && (
        <group position={[0, 0.026, 0]}>
          {/* Gold circlet base */}
          <mesh raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.098, 0.092, 0.044, 20]} />
            <meshStandardMaterial color="#F59E0B" metalness={0.85} roughness={0.22} />
          </mesh>
          {/* 5 Royal spires */}
          {[0, 1, 2, 3, 4].map((idx) => {
            const ang = (idx / 5) * Math.PI * 2
            return (
              <mesh
                key={idx}
                position={[Math.sin(ang) * 0.088, 0.044, -Math.cos(ang) * 0.088]}
                raycast={NOOP_RAYCAST}
              >
                <coneGeometry args={[0.024, 0.052, 6]} />
                <meshStandardMaterial color="#FBBF24" metalness={0.88} roughness={0.2} />
              </mesh>
            )
          })}
          {/* Front accent gem */}
          <mesh position={[0, 0.004, -0.098]} raycast={NOOP_RAYCAST}>
            <octahedronGeometry args={[0.018, 0]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </group>
      )}

      {hat === 'cowboy' && (
        <group position={[0, 0.018, 0]}>
          {/* Wide Western brim */}
          <mesh scale={[1.05, 0.25, 1.18]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.2, 0.21, 0.04, 24]} />
            <meshStandardMaterial color="#78350F" roughness={0.78} />
          </mesh>
          {/* Pinched crown */}
          <RoundedBox
            args={[0.145, 0.085, 0.175]}
            radius={0.038}
            smoothness={3}
            position={[0, 0.048, 0]}
            raycast={NOOP_RAYCAST}
          >
            <meshStandardMaterial color="#78350F" roughness={0.75} />
          </RoundedBox>
          {/* Accent leather hatband */}
          <mesh position={[0, 0.016, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.095, 0.098, 0.018, 18]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </group>
      )}

      {hat === 'wizard' && (
        <group position={[0, 0.016, 0]} rotation={[-0.08, 0, 0]}>
          {/* Wide arcane brim */}
          <mesh raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.21, 0.22, 0.012, 24]} />
            <meshStandardMaterial color="#312E81" roughness={0.72} />
          </mesh>
          {/* Gold hatband */}
          <mesh position={[0, 0.018, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.102, 0.11, 0.024, 18]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          {/* Tall wizard cone */}
          <mesh position={[0, 0.135, 0.012]} rotation={[-0.14, 0, 0.06]} raycast={NOOP_RAYCAST}>
            <coneGeometry args={[0.102, 0.25, 18]} />
            <meshStandardMaterial color="#312E81" roughness={0.7} />
          </mesh>
        </group>
      )}

      {hat === 'top-hat' && (
        <group position={[0, 0.016, 0]}>
          {/* Satin brim */}
          <mesh raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.175, 0.18, 0.014, 24]} />
            <meshStandardMaterial color="#0F172A" roughness={0.35} metalness={0.3} />
          </mesh>
          {/* Tall silk cylinder */}
          <mesh position={[0, 0.082, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.108, 0.098, 0.15, 22]} />
            <meshStandardMaterial color="#111827" roughness={0.32} metalness={0.35} />
          </mesh>
          {/* Accent ribbon */}
          <mesh position={[0, 0.022, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.101, 0.1, 0.024, 22]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </group>
      )}

      {hat === 'party-cone' && (
        <group position={[0, 0.018, 0]}>
          <mesh position={[0, 0.085, 0]} raycast={NOOP_RAYCAST}>
            <coneGeometry args={[0.082, 0.17, 18]} />
            <meshStandardMaterial color={accentColor} roughness={0.45} />
          </mesh>
          <mesh position={[0, 0.065, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <torusGeometry args={[0.052, 0.008, 8, 18]} />
            <meshBasicMaterial color="#F8FAFC" />
          </mesh>
          <mesh position={[0, 0.178, 0]} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.024, 12, 12]} />
            <meshBasicMaterial color="#22D3EE" />
          </mesh>
        </group>
      )}
    </group>
  )
}

function AvatarFace3D({
  faceStyle,
  accentColor,
  visorZ,
  speakLevelRef,
}: {
  faceStyle: AvatarFaceId
  accentColor: string
  visorZ: number
  speakLevelRef?: React.RefObject<number>
}) {
  const leftBlinkRef = useRef<THREE.Group>(null)
  const rightBlinkRef = useRef<THREE.Group>(null)
  const scannerDotRef = useRef<THREE.Mesh>(null)
  const mouthCenterRef = useRef<THREE.Mesh>(null)
  const mouthLeftRef = useRef<THREE.Mesh>(null)
  const mouthRightRef = useRef<THREE.Mesh>(null)
  const blinkOffsetRef = useRef((Math.PI * 1.37) % 4)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() + blinkOffsetRef.current
    // Subtle natural eye blink every ~4.2 seconds
    const cycle = t % 4.2
    const blinkScaleY = cycle > 4.06 ? 0.12 : 1
    if (leftBlinkRef.current) leftBlinkRef.current.scale.y = blinkScaleY
    if (rightBlinkRef.current) rightBlinkRef.current.scale.y = blinkScaleY

    if (scannerDotRef.current) {
      scannerDotRef.current.position.x = Math.sin(t * 3.6) * 0.068
    }

    const level = speakLevelRef?.current ?? 0
    const active = level > 0.04
    if (mouthCenterRef.current) {
      mouthCenterRef.current.scale.y = active ? 1 + level * 4.2 : 0.45
      ;(mouthCenterRef.current.material as THREE.MeshBasicMaterial).opacity = active
        ? 0.95
        : 0.28
    }
    if (mouthLeftRef.current) {
      mouthLeftRef.current.scale.y = active ? 0.8 + level * 2.8 : 0.35
      ;(mouthLeftRef.current.material as THREE.MeshBasicMaterial).opacity = active
        ? 0.88
        : 0.2
    }
    if (mouthRightRef.current) {
      mouthRightRef.current.scale.y = active ? 0.8 + level * 2.8 : 0.35
      ;(mouthRightRef.current.material as THREE.MeshBasicMaterial).opacity = active
        ? 0.88
        : 0.2
    }
  })

  return (
    <group position={[0, 0.015, visorZ]}>
      {faceStyle === 'visor-led' && (
        <>
          <group ref={leftBlinkRef} position={[-0.048, 0.012, 0]}>
            <RoundedBox args={[0.026, 0.036, 0.008]} radius={0.01} smoothness={2} raycast={NOOP_RAYCAST}>
              <meshBasicMaterial color={accentColor} />
            </RoundedBox>
          </group>
          <group ref={rightBlinkRef} position={[0.048, 0.012, 0]}>
            <RoundedBox args={[0.026, 0.036, 0.008]} radius={0.01} smoothness={2} raycast={NOOP_RAYCAST}>
              <meshBasicMaterial color={accentColor} />
            </RoundedBox>
          </group>
        </>
      )}

      {faceStyle === 'happy-pixel' && (
        <>
          {/* Left ^ chevron */}
          <group ref={leftBlinkRef} position={[-0.048, 0.014, 0]}>
            <mesh position={[-0.01, 0, 0]} rotation={[0, 0, -0.58]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.026, 0.009, 0.008]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
            <mesh position={[0.01, 0, 0]} rotation={[0, 0, 0.58]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.026, 0.009, 0.008]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
          </group>
          {/* Right ^ chevron */}
          <group ref={rightBlinkRef} position={[0.048, 0.014, 0]}>
            <mesh position={[-0.01, 0, 0]} rotation={[0, 0, -0.58]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.026, 0.009, 0.008]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
            <mesh position={[0.01, 0, 0]} rotation={[0, 0, 0.58]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.026, 0.009, 0.008]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
          </group>
        </>
      )}

      {faceStyle === 'cool-shades' && (
        <group position={[0, 0.012, -0.006]}>
          {/* Left & Right neon-rimmed shades */}
          <RoundedBox args={[0.082, 0.044, 0.01]} radius={0.008} smoothness={2} position={[-0.05, 0, 0]} raycast={NOOP_RAYCAST}>
            <meshBasicMaterial color={accentColor} />
          </RoundedBox>
          <RoundedBox args={[0.068, 0.032, 0.012]} radius={0.005} smoothness={2} position={[-0.05, 0, -0.002]} raycast={NOOP_RAYCAST}>
            <meshBasicMaterial color="#05070B" />
          </RoundedBox>
          <RoundedBox args={[0.082, 0.044, 0.01]} radius={0.008} smoothness={2} position={[0.05, 0, 0]} raycast={NOOP_RAYCAST}>
            <meshBasicMaterial color={accentColor} />
          </RoundedBox>
          <RoundedBox args={[0.068, 0.032, 0.012]} radius={0.005} smoothness={2} position={[0.05, 0, -0.002]} raycast={NOOP_RAYCAST}>
            <meshBasicMaterial color="#05070B" />
          </RoundedBox>
          {/* Bridge */}
          <mesh position={[0, 0.008, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.028, 0.008, 0.01]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </group>
      )}

      {faceStyle === 'starry' && (
        <>
          <group ref={leftBlinkRef} position={[-0.048, 0.012, 0]} rotation={[0, 0, Math.PI / 4]}>
            <mesh raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.028, 0.028, 0.008]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
          </group>
          <group ref={rightBlinkRef} position={[0.048, 0.012, 0]} rotation={[0, 0, Math.PI / 4]}>
            <mesh raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.028, 0.028, 0.008]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
          </group>
        </>
      )}

      {faceStyle === 'cyber-scan' && (
        <group position={[0, 0.01, 0]}>
          <mesh raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.165, 0.008, 0.006]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.35} />
          </mesh>
          <mesh ref={scannerDotRef} position={[0, 0, -0.003]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.036, 0.016, 0.008]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </group>
      )}

      {faceStyle === 'wink' && (
        <>
          <group position={[-0.048, 0.014, 0]}>
            <mesh position={[-0.01, 0, 0]} rotation={[0, 0, -0.58]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.026, 0.009, 0.008]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
            <mesh position={[0.01, 0, 0]} rotation={[0, 0, 0.58]} raycast={NOOP_RAYCAST}>
              <boxGeometry args={[0.026, 0.009, 0.008]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
          </group>
          <mesh position={[0.048, 0.012, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.034, 0.009, 0.008]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </>
      )}

      {/* Voice-reactive 3-bar LED mouth equalizer */}
      {faceStyle !== 'minimal' && (
        <group position={[0, -0.032, 0]}>
          <mesh ref={mouthLeftRef} position={[-0.02, 0, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.01, 0.008, 0.006]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.22} />
          </mesh>
          <mesh ref={mouthCenterRef} position={[0, 0, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.018, 0.009, 0.006]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.3} />
          </mesh>
          <mesh ref={mouthRightRef} position={[0.02, 0, 0]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.01, 0.008, 0.006]} />
            <meshBasicMaterial color={accentColor} transparent opacity={0.22} />
          </mesh>
        </group>
      )}
    </group>
  )
}

export function AvatarHead3D({
  style,
  accentColor,
  customization,
  speakLevelRef,
}: {
  style: AvatarStyleId
  accentColor: string
  customization?: Partial<AvatarCustomization>
  speakLevelRef?: React.RefObject<number>
}) {
  const resolved = resolveAvatarCustomization(customization)
  const { bodyColor, faceStyle, hat } = resolved

  const hatBaseY =
    style === 'astro-dome'
      ? 0.145
      : style === 'cat-ears' || style === 'knight-helm'
        ? 0.132
        : style === 'bot-retro'
          ? 0.118
          : 0.105

  const visorFrontZ = style === 'bot-retro' ? -0.132 : -0.142

  return (
    <group>
      {/* ================================================================= */}
      {/* ARCHETYPE 1–4: VISOR CLASSIC / SLEEK / HALO / STUDIO              */}
      {/* ================================================================= */}
      {(style === 'visor-classic' ||
        style === 'visor-sleek' ||
        style === 'visor-halo' ||
        style === 'visor-studio') && (
        <>
          <RoundedBox args={[0.23, 0.21, 0.24]} radius={0.075} smoothness={4} raycast={NOOP_RAYCAST}>
            <meshStandardMaterial color={bodyColor} roughness={0.42} metalness={0.3} />
          </RoundedBox>
          <RoundedBox
            args={style === 'visor-sleek' ? [0.252, 0.092, 0.068] : [0.242, 0.118, 0.072]}
            radius={0.03}
            smoothness={3}
            position={[0, 0.015, -0.105]}
            raycast={NOOP_RAYCAST}
          >
            <meshStandardMaterial color="#07090D" roughness={0.14} metalness={0.85} />
          </RoundedBox>
          <mesh
            position={[0, style === 'visor-sleek' ? 0.064 : 0.078, -0.126]}
            raycast={NOOP_RAYCAST}
          >
            <boxGeometry args={[0.195, 0.013, 0.02]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>

          {style === 'visor-sleek' && (
            <>
              <mesh position={[-0.128, 0.03, 0.04]} rotation={[0.25, -0.18, 0]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.014, 0.045, 0.13]} />
                <meshBasicMaterial color={accentColor} />
              </mesh>
              <mesh position={[0.128, 0.03, 0.04]} rotation={[0.25, 0.18, 0]} raycast={NOOP_RAYCAST}>
                <boxGeometry args={[0.014, 0.045, 0.13]} />
                <meshBasicMaterial color={accentColor} />
              </mesh>
            </>
          )}

          {style === 'visor-halo' && (
            <mesh position={[0, 0.125, 0.01]} rotation={[Math.PI / 2 + 0.18, 0, 0]} raycast={NOOP_RAYCAST}>
              <torusGeometry args={[0.145, 0.013, 10, 28]} />
              <meshBasicMaterial color={accentColor} />
            </mesh>
          )}

          {style === 'visor-studio' && (
            <>
              <mesh position={[-0.132, 0.0, -0.005]} rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.054, 0.054, 0.036, 16]} />
                <meshStandardMaterial color={accentColor} roughness={0.35} metalness={0.45} />
              </mesh>
              <mesh position={[0.132, 0.0, -0.005]} rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.054, 0.054, 0.036, 16]} />
                <meshStandardMaterial color={accentColor} roughness={0.35} metalness={0.45} />
              </mesh>
              {/* Boom mic */}
              <mesh position={[-0.105, -0.048, -0.085]} rotation={[0.45, 0.35, 0]} raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.005, 0.005, 0.11, 8]} />
                <meshStandardMaterial color="#CBD5E1" metalness={0.8} roughness={0.2} />
              </mesh>
              <mesh position={[-0.072, -0.068, -0.13]} raycast={NOOP_RAYCAST}>
                <sphereGeometry args={[0.013, 10, 10]} />
                <meshBasicMaterial color={accentColor} />
              </mesh>
            </>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* ARCHETYPE 5: RETRO CRT MONITOR BOT                                */}
      {/* ================================================================= */}
      {style === 'bot-retro' && (
        <>
          <RoundedBox args={[0.275, 0.225, 0.24]} radius={0.042} smoothness={3} raycast={NOOP_RAYCAST}>
            <meshStandardMaterial color={bodyColor} roughness={0.5} metalness={0.25} />
          </RoundedBox>
          {/* Accent screen bezel */}
          <RoundedBox
            args={[0.235, 0.175, 0.022]}
            radius={0.025}
            smoothness={2}
            position={[0, 0.008, -0.116]}
            raycast={NOOP_RAYCAST}
          >
            <meshBasicMaterial color={accentColor} />
          </RoundedBox>
          {/* Recessed CRT glass */}
          <RoundedBox
            args={[0.212, 0.152, 0.024]}
            radius={0.02}
            smoothness={2}
            position={[0, 0.008, -0.12]}
            raycast={NOOP_RAYCAST}
          >
            <meshStandardMaterial color="#070B12" roughness={0.15} metalness={0.8} />
          </RoundedBox>
          {/* Top antenna + glowing tip (hidden if wearing a tall hat) */}
          {hat === 'none' && (
            <group position={[0.055, 0.135, 0]}>
              <mesh raycast={NOOP_RAYCAST}>
                <cylinderGeometry args={[0.005, 0.007, 0.065, 8]} />
                <meshStandardMaterial color="#94A3B8" metalness={0.8} roughness={0.25} />
              </mesh>
              <mesh position={[0, 0.042, 0]} raycast={NOOP_RAYCAST}>
                <sphereGeometry args={[0.018, 12, 12]} />
                <meshBasicMaterial color={accentColor} />
              </mesh>
            </group>
          )}
        </>
      )}

      {/* ================================================================= */}
      {/* ARCHETYPE 6: SPACE EXPLORER ASTRO DOME                            */}
      {/* ================================================================= */}
      {style === 'astro-dome' && (
        <>
          {/* Inner head pod */}
          <mesh raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.118, 20, 16]} />
            <meshStandardMaterial color="#070A10" roughness={0.18} metalness={0.85} />
          </mesh>
          {/* Outer tinted astronaut bubble */}
          <mesh raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.148, 22, 18]} />
            <meshStandardMaterial
              color={bodyColor}
              transparent
              opacity={0.42}
              roughness={0.12}
              metalness={0.65}
            />
          </mesh>
          {/* Metallic neck ring */}
          <mesh position={[0, -0.115, 0]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <torusGeometry args={[0.115, 0.018, 10, 24]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          {/* Side helmet torches */}
          <mesh position={[-0.142, 0.02, -0.02]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.014, 0.014, 0.05, 10]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          <mesh position={[0.142, 0.02, -0.02]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.014, 0.014, 0.05, 10]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </>
      )}

      {/* ================================================================= */}
      {/* ARCHETYPE 7: NEKO SYNTH CAT-EAR HEADPHONES                        */}
      {/* ================================================================= */}
      {style === 'cat-ears' && (
        <>
          <RoundedBox args={[0.228, 0.208, 0.236]} radius={0.078} smoothness={4} raycast={NOOP_RAYCAST}>
            <meshStandardMaterial color={bodyColor} roughness={0.42} metalness={0.28} />
          </RoundedBox>
          <RoundedBox
            args={[0.238, 0.115, 0.07]}
            radius={0.032}
            smoothness={3}
            position={[0, 0.012, -0.105]}
            raycast={NOOP_RAYCAST}
          >
            <meshStandardMaterial color="#07090D" roughness={0.14} metalness={0.85} />
          </RoundedBox>
          {/* Left & Right Sculpted Cat Ears */}
          {[-1, 1].map((dir) => (
            <group
              key={dir}
              position={[dir * 0.082, 0.128, -0.01]}
              rotation={[0, 0, -dir * 0.22]}
            >
              <mesh raycast={NOOP_RAYCAST}>
                <coneGeometry args={[0.044, 0.078, 4]} />
                <meshStandardMaterial color={bodyColor} roughness={0.45} />
              </mesh>
              <mesh position={[0, -0.004, -0.016]} raycast={NOOP_RAYCAST}>
                <coneGeometry args={[0.025, 0.05, 4]} />
                <meshBasicMaterial color={accentColor} />
              </mesh>
            </group>
          ))}
        </>
      )}

      {/* ================================================================= */}
      {/* ARCHETYPE 8: STARLIGHT KNIGHT CRESTED HELM                        */}
      {/* ================================================================= */}
      {style === 'knight-helm' && (
        <>
          <RoundedBox args={[0.235, 0.225, 0.248]} radius={0.06} smoothness={3} raycast={NOOP_RAYCAST}>
            <meshStandardMaterial color={bodyColor} roughness={0.32} metalness={0.62} />
          </RoundedBox>
          <RoundedBox
            args={[0.242, 0.112, 0.072]}
            radius={0.022}
            smoothness={2}
            position={[0, 0.015, -0.106]}
            raycast={NOOP_RAYCAST}
          >
            <meshStandardMaterial color="#06080C" roughness={0.15} metalness={0.88} />
          </RoundedBox>
          {/* Top paladin crest */}
          <RoundedBox
            args={[0.034, 0.052, 0.22]}
            radius={0.012}
            smoothness={2}
            position={[0, 0.122, 0.01]}
            raycast={NOOP_RAYCAST}
          >
            <meshBasicMaterial color={accentColor} />
          </RoundedBox>
          {/* Glowing vertical nose/chin T-bar */}
          <mesh position={[0, -0.048, -0.132]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.018, 0.068, 0.012]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </>
      )}

      {/* Modular Visor Face Expression + Voice-Reactive LED Mouth */}
      <AvatarFace3D
        faceStyle={faceStyle}
        accentColor={accentColor}
        visorZ={visorFrontZ}
        speakLevelRef={speakLevelRef}
      />

      {/* Modular Hat / Headwear */}
      <AvatarHat3D
        hat={hat}
        accentColor={accentColor}
        bodyColor={bodyColor}
        baseY={hatBaseY}
      />
    </group>
  )
}

function AvatarAccessory3D({
  accessory,
  accentColor,
  bodyColor,
}: {
  accessory: AvatarAccessoryId
  accentColor: string
  bodyColor: string
}) {
  const droneRef = useRef<THREE.Group>(null)
  const orbitRef = useRef<THREE.Group>(null)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (droneRef.current) {
      droneRef.current.position.y = 0.25 + Math.sin(t * 2.4) * 0.028
      droneRef.current.rotation.y = Math.sin(t * 1.1) * 0.24
    }
    if (orbitRef.current) {
      orbitRef.current.rotation.y = t * 1.35
    }
  })

  if (accessory === 'none') return null

  return (
    <group>
      {accessory === 'shoulder-drone' && (
        <group ref={droneRef} position={[0.27, 0.25, -0.02]}>
          <mesh raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.044, 14, 14]} />
            <meshStandardMaterial color={bodyColor} roughness={0.35} metalness={0.5} />
          </mesh>
          <mesh position={[0, 0, -0.04]} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.015, 10, 10]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <torusGeometry args={[0.066, 0.005, 8, 20]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </group>
      )}

      {accessory === 'orbit-rings' && (
        <group ref={orbitRef} position={[0, 0.05, 0]}>
          <mesh position={[0.26, 0.04, 0]} raycast={NOOP_RAYCAST}>
            <octahedronGeometry args={[0.024, 0]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          <mesh position={[-0.26, -0.02, 0]} raycast={NOOP_RAYCAST}>
            <octahedronGeometry args={[0.02, 0]} />
            <meshBasicMaterial color="#F8FAFC" />
          </mesh>
        </group>
      )}

      {accessory === 'vip-halo' && (
        <group position={[0, -0.19, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <mesh raycast={NOOP_RAYCAST}>
            <ringGeometry args={[0.22, 0.255, 28]} />
            <meshBasicMaterial
              color={accentColor}
              transparent
              opacity={0.55}
              side={THREE.DoubleSide}
            />
          </mesh>
        </group>
      )}

      {accessory === 'bowtie' && (
        <group position={[0, 0.165, -0.098]}>
          <mesh position={[-0.026, 0, 0]} rotation={[0, 0, -Math.PI / 2]} raycast={NOOP_RAYCAST}>
            <coneGeometry args={[0.022, 0.045, 4]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          <mesh position={[0.026, 0, 0]} rotation={[0, 0, Math.PI / 2]} raycast={NOOP_RAYCAST}>
            <coneGeometry args={[0.022, 0.045, 4]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          <mesh raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.012, 8, 8]} />
            <meshBasicMaterial color="#F8FAFC" />
          </mesh>
        </group>
      )}
    </group>
  )
}

export function AvatarTorso3D({
  accentColor,
  customization,
}: {
  accentColor: string
  customization?: Partial<AvatarCustomization>
}) {
  const resolved = resolveAvatarCustomization(customization)
  const { bodyColor, outfit, accessory } = resolved as {
    bodyColor: string
    outfit: AvatarOutfitId
    accessory: AvatarAccessoryId
  }

  return (
    <group>
      {/* Core sculpted torso block */}
      <RoundedBox args={[0.34, 0.36, 0.185]} radius={0.08} smoothness={3} raycast={NOOP_RAYCAST}>
        <meshStandardMaterial color={bodyColor} roughness={0.62} metalness={0.18} />
      </RoundedBox>

      {outfit === 'hoodie' && (
        <>
          {/* Cozy hood neck roll */}
          <mesh position={[0, 0.175, 0.02]} rotation={[Math.PI / 2 + 0.15, 0, 0]} raycast={NOOP_RAYCAST}>
            <torusGeometry args={[0.105, 0.028, 10, 20]} />
            <meshStandardMaterial color={bodyColor} roughness={0.75} />
          </mesh>
          {/* Kangaroo pouch */}
          <RoundedBox
            args={[0.21, 0.095, 0.022]}
            radius={0.022}
            smoothness={2}
            position={[0, -0.075, -0.09]}
            raycast={NOOP_RAYCAST}
          >
            <meshStandardMaterial color={bodyColor} roughness={0.78} />
          </RoundedBox>
          {/* Accent drawstrings */}
          <mesh position={[-0.036, 0.095, -0.096]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.01, 0.11, 0.01]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          <mesh position={[0.036, 0.095, -0.096]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.01, 0.11, 0.01]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </>
      )}

      {outfit === 'varsity' && (
        <>
          {/* Contrast varsity shoulder caps */}
          <RoundedBox args={[0.065, 0.28, 0.17]} radius={0.03} smoothness={2} position={[-0.175, 0.01, 0]} raycast={NOOP_RAYCAST}>
            <meshStandardMaterial color="#F1F5F9" roughness={0.65} />
          </RoundedBox>
          <RoundedBox args={[0.065, 0.28, 0.17]} radius={0.03} smoothness={2} position={[0.175, 0.01, 0]} raycast={NOOP_RAYCAST}>
            <meshStandardMaterial color="#F1F5F9" roughness={0.65} />
          </RoundedBox>
          {/* Button placket + chest letter badge */}
          <mesh position={[0, 0, -0.095]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.016, 0.31, 0.008]} />
            <meshBasicMaterial color="#F1F5F9" />
          </mesh>
          <RoundedBox args={[0.065, 0.065, 0.012]} radius={0.014} smoothness={2} position={[-0.082, 0.07, -0.095]} raycast={NOOP_RAYCAST}>
            <meshBasicMaterial color={accentColor} />
          </RoundedBox>
        </>
      )}

      {outfit === 'cyber-vest' && (
        <>
          {/* Upturned glowing tech collar */}
          <mesh position={[-0.095, 0.185, 0.01]} rotation={[0, 0.25, 0.35]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.018, 0.09, 0.15]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          <mesh position={[0.095, 0.185, 0.01]} rotation={[0, -0.25, -0.35]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.018, 0.09, 0.15]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          {/* Glowing chest power core */}
          <mesh position={[0, 0.065, -0.096]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.042, 0.042, 0.012, 16]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
          <mesh position={[0, 0.065, -0.102]} rotation={[Math.PI / 2, 0, 0]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.022, 0.022, 0.012, 16]} />
            <meshBasicMaterial color="#F8FAFC" />
          </mesh>
        </>
      )}

      {outfit === 'tuxedo' && (
        <>
          {/* White pleated shirt V-front */}
          <mesh position={[0, 0.055, -0.095]} rotation={[0, 0, Math.PI]} raycast={NOOP_RAYCAST}>
            <coneGeometry args={[0.095, 0.22, 4]} />
            <meshBasicMaterial color="#F8FAFC" />
          </mesh>
          {/* Accent bow tie */}
          <mesh position={[0, 0.135, -0.102]} raycast={NOOP_RAYCAST}>
            <boxGeometry args={[0.072, 0.028, 0.012]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </>
      )}

      {outfit === 'astronaut' && (
        <>
          {/* EVA chest life-support module */}
          <RoundedBox args={[0.185, 0.145, 0.045]} radius={0.018} smoothness={2} position={[0, 0.04, -0.102]} raycast={NOOP_RAYCAST}>
            <meshStandardMaterial color="#E2E8F0" roughness={0.35} metalness={0.35} />
          </RoundedBox>
          <mesh position={[-0.045, 0.05, -0.128]} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.016, 10, 10]} />
            <meshBasicMaterial color="#EF4444" />
          </mesh>
          <mesh position={[0.045, 0.05, -0.128]} raycast={NOOP_RAYCAST}>
            <sphereGeometry args={[0.016, 10, 10]} />
            <meshBasicMaterial color={accentColor} />
          </mesh>
        </>
      )}

      {outfit === 'cloak' && (
        <>
          {/* Draped adventurer mantle */}
          <mesh position={[0, 0.115, 0.01]} raycast={NOOP_RAYCAST}>
            <cylinderGeometry args={[0.145, 0.215, 0.14, 18]} />
            <meshStandardMaterial color={accentColor} roughness={0.78} />
          </mesh>
          {/* Gold clasp medallion */}
          <mesh position={[0, 0.12, -0.112]} raycast={NOOP_RAYCAST}>
            <octahedronGeometry args={[0.026, 0]} />
            <meshStandardMaterial color="#FBBF24" metalness={0.85} roughness={0.2} />
          </mesh>
        </>
      )}

      <AvatarAccessory3D
        accessory={accessory}
        accentColor={accentColor}
        bodyColor={bodyColor}
      />
    </group>
  )
}

export function AvatarHand3D({
  accentColor,
  bodyColor = '#1D2432',
}: {
  accentColor: string
  bodyColor?: string
}) {
  return (
    <group>
      <RoundedBox args={[0.075, 0.065, 0.14]} radius={0.028} smoothness={3} raycast={NOOP_RAYCAST}>
        <meshStandardMaterial color={bodyColor} roughness={0.45} metalness={0.35} />
      </RoundedBox>
      <mesh position={[0, 0.022, -0.038]} raycast={NOOP_RAYCAST}>
        <boxGeometry args={[0.048, 0.012, 0.055]} />
        <meshBasicMaterial color={accentColor} />
      </mesh>
    </group>
  )
}
