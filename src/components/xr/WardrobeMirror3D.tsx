import { RoundedBox, Text } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import { useXR, useXRInputSourceState } from '@react-three/xr'
import { Suspense, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import {
  AVATAR_ACCESSORIES,
  AVATAR_BODY_COLORS,
  AVATAR_COLORS,
  AVATAR_FACES,
  AVATAR_FLAIR_BADGES,
  AVATAR_HATS,
  AVATAR_OUTFITS,
  AVATAR_PRESETS,
  AVATAR_STYLES,
  createRandomAvatarLook,
  resolveAvatarCustomization,
} from '../../constants/avatars'
import { readXRSpaceWorldPose } from '../../services/xrTracking'
import type {
  AvatarCustomization,
  AvatarStyleId,
  ParticipantProfile,
} from '../../types/lounge'
import { AvatarHand3D, AvatarHead3D, AvatarTorso3D } from './AvatarCharacterParts3D'

export interface WardrobeMirror3DProps {
  open: boolean
  inVR: boolean
  localProfile: ParticipantProfile
  localMicLevel: number
  onUpdateAvatar: (patch: {
    displayName?: string
    avatarColor?: string
    avatarStyle?: AvatarStyleId
    avatarCustomization?: Partial<AvatarCustomization>
  }) => void
  onClose: () => void
}

function MirrorBtn3D({
  label,
  position,
  width = 0.24,
  height = 0.068,
  active = false,
  accentColor = '#E5A93C',
  onClick,
}: {
  label: string
  position: [number, number, number]
  width?: number
  height?: number
  active?: boolean
  accentColor?: string
  onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <group
      position={position}
      scale={hovered ? 1.04 : 1}
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
      {(hovered || active) && (
        <RoundedBox
          args={[width + 0.006, height + 0.006, 0.012]}
          radius={0.018}
          smoothness={2}
          position={[0, 0, -0.0015]}
        >
          <meshBasicMaterial
            color={accentColor}
            transparent
            opacity={hovered ? 0.78 : 0.38}
          />
        </RoundedBox>
      )}
      <RoundedBox args={[width, height, 0.014]} radius={0.016} smoothness={2}>
        <meshBasicMaterial
          color={active ? accentColor : hovered ? '#243044' : '#141B27'}
        />
      </RoundedBox>
      <Suspense fallback={null}>
        <Text
          position={[0, 0, 0.01]}
          fontSize={0.025}
          color={active ? '#090C12' : '#F4F1EA'}
          maxWidth={width - 0.02}
          anchorX="center"
          anchorY="middle"
        >
          {label}
        </Text>
      </Suspense>
    </group>
  )
}

function cycleItem<T>(list: readonly T[], currentIdx: number, dir: 1 | -1): T {
  const safeIdx = currentIdx < 0 ? 0 : currentIdx
  return list[(safeIdx + dir + list.length) % list.length]
}

export function WardrobeMirror3D({
  open,
  inVR,
  localProfile,
  localMicLevel,
  onUpdateAvatar,
  onClose,
}: WardrobeMirror3DProps) {
  const { camera, gl } = useThree()
  const xrOrigin = useXR((s) => s.origin)
  const xrOriginRefSpace = useXR((s) => s.originReferenceSpace)
  const leftController = useXRInputSourceState('controller', 'left')
  const rightController = useXRInputSourceState('controller', 'right')

  const rootGroupRef = useRef<THREE.Group>(null)
  const avatarTurntableRef = useRef<THREE.Group>(null)
  const mirrorHeadRef = useRef<THREE.Group>(null)
  const mirrorLeftHandRef = useRef<THREE.Group>(null)
  const mirrorRightHandRef = useRef<THREE.Group>(null)
  const speakLevelRef = useRef(0)
  const [spinPreview, setSpinPreview] = useState(false)

  const scratchForward = useMemo(() => new THREE.Vector3(), [])
  const scratchRight = useMemo(() => new THREE.Vector3(), [])
  const scratchUp = useMemo(() => new THREE.Vector3(), [])
  const scratchTargetPos = useMemo(() => new THREE.Vector3(), [])
  const scratchCamQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchHeadEuler = useMemo(() => new THREE.Euler(0, 0, 0, 'YXZ'), [])
  const scratchHandWorld = useMemo(() => new THREE.Vector3(), [])
  const scratchHandQuat = useMemo(() => new THREE.Quaternion(), [])
  const scratchHeadWorld = useMemo(() => new THREE.Vector3(), [])

  const cust = resolveAvatarCustomization(localProfile.avatarCustomization)
  speakLevelRef.current = localProfile.isMuted ? 0 : localMicLevel

  useFrame(({ clock }, delta) => {
    if (!open || !rootGroupRef.current) return
    const dt = Math.min(delta, 0.1)
    const t = clock.getElapsedTime()

    if (!inVR) {
      // Desktop: position holographic mirror smoothly in front-left of camera so right-side drawer stays clear
      camera.getWorldDirection(scratchForward)
      scratchRight.set(-scratchForward.z, 0, scratchForward.x).normalize()
      scratchUp.set(0, 1, 0)

      scratchTargetPos
        .copy(camera.position)
        .addScaledVector(scratchForward, 1.72)
        .addScaledVector(scratchRight, -0.34)
        .addScaledVector(scratchUp, -0.14)

      rootGroupRef.current.position.lerp(scratchTargetPos, 1 - Math.exp(-14 * dt))
      rootGroupRef.current.lookAt(
        camera.position.x - scratchRight.x * 0.18,
        rootGroupRef.current.position.y + 0.06,
        camera.position.z - scratchRight.z * 0.18,
      )
    } else {
      // VR: anchored cleanly inside SeatCameraAndOriginRig's dockGroupRef above the SpatialControlDock
      rootGroupRef.current.position.set(0, 1.44, -1.28)
      rootGroupRef.current.rotation.set(0, 0, 0)
    }

    // Animate reflection avatar turntable / natural mirror gaze
    if (avatarTurntableRef.current) {
      if (spinPreview) {
        avatarTurntableRef.current.rotation.y += dt * 1.15
      } else {
        // Math.PI faces AvatarHead3D (-Z front) toward +Z (directly at the viewer!)
        const gentleSway = inVR ? 0 : Math.sin(t * 0.95) * 0.24
        avatarTurntableRef.current.rotation.y = THREE.MathUtils.lerp(
          avatarTurntableRef.current.rotation.y,
          Math.PI + gentleSway,
          1 - Math.exp(-10 * dt),
        )
      }
    }

    if (mirrorHeadRef.current) {
      if (inVR) {
        camera.getWorldQuaternion(scratchCamQuat)
        scratchHeadEuler.setFromQuaternion(scratchCamQuat, 'YXZ')
        mirrorHeadRef.current.rotation.set(
          -scratchHeadEuler.x * 0.75,
          0,
          -scratchHeadEuler.z * 0.85,
        )
      } else {
        mirrorHeadRef.current.rotation.set(
          Math.sin(t * 1.5) * 0.05,
          0,
          Math.cos(t * 1.1) * 0.04,
        )
      }
    }

    // Mirror VR controller hands live so Quest 3 players can wave at themselves!
    if (inVR && mirrorLeftHandRef.current && mirrorRightHandRef.current) {
      const xrFrame = gl.xr.getFrame?.()
      const refSpace = xrOriginRefSpace ?? gl.xr.getReferenceSpace?.()
      camera.getWorldPosition(scratchHeadWorld)

      const updateMirroredHand = (
        ctrl: typeof leftController,
        meshGroup: THREE.Group,
        fallbackX: number,
      ) => {
        const space = ctrl?.inputSource?.gripSpace ?? ctrl?.inputSource?.targetRaySpace
        const ok = readXRSpaceWorldPose(
          xrFrame,
          space,
          refSpace,
          xrOrigin,
          scratchHandWorld,
          scratchHandQuat,
        )
        meshGroup.visible = true
        if (ok) {
          const relX = THREE.MathUtils.clamp(scratchHandWorld.x - scratchHeadWorld.x, -0.5, 0.5)
          const relY = THREE.MathUtils.clamp(scratchHandWorld.y - scratchHeadWorld.y, -0.55, 0.35)
          meshGroup.position.set(-relX, 0.19 + relY * 0.75, -0.14)
        } else {
          meshGroup.position.set(fallbackX, -0.06, -0.14)
        }
      }

      updateMirroredHand(leftController, mirrorLeftHandRef.current, 0.25)
      updateMirroredHand(rightController, mirrorRightHandRef.current, -0.25)
    } else {
      if (mirrorLeftHandRef.current) {
        mirrorLeftHandRef.current.visible = true
        mirrorLeftHandRef.current.position.set(
          0.25,
          -0.05 + Math.sin(t * 1.8) * 0.015,
          -0.11,
        )
      }
      if (mirrorRightHandRef.current) {
        mirrorRightHandRef.current.visible = true
        mirrorRightHandRef.current.position.set(
          -0.25,
          -0.05 + Math.cos(t * 1.8) * 0.015,
          -0.11,
        )
      }
    }
  })

  if (!open) return null

  const styleIdx = AVATAR_STYLES.findIndex((s) => s.id === localProfile.avatarStyle)
  const faceIdx = AVATAR_FACES.findIndex((f) => f.id === cust.faceStyle)
  const hatIdx = AVATAR_HATS.findIndex((h) => h.id === cust.hat)
  const outfitIdx = AVATAR_OUTFITS.findIndex((o) => o.id === cust.outfit)
  const accentIdx = AVATAR_COLORS.findIndex((c) => c.hex === localProfile.avatarColor)
  const bodyIdx = AVATAR_BODY_COLORS.findIndex((c) => c.hex === cust.bodyColor)
  const accIdx = AVATAR_ACCESSORIES.findIndex((a) => a.id === cust.accessory)
  const flairIdx = AVATAR_FLAIR_BADGES.findIndex((b) => b.emoji === cust.flairEmoji)

  const displayTitle = cust.flairEmoji
    ? `${cust.flairEmoji} ${localProfile.displayName}`
    : localProfile.displayName

  return (
    <group ref={rootGroupRef} name="wardrobe-mirror-3d">
      {/* ================================================================= */}
      {/* HOLOGRAPHIC VANITY MIRROR PEDESTAL                                */}
      {/* ================================================================= */}
      <group position={inVR ? [-0.44, 0, 0] : [0, 0, 0]}>
        {/* Brushed Metallic Outer Mirror Frame */}
        <RoundedBox args={[0.812, 1.192, 0.022]} position={[0, 0, -0.004]} radius={0.044} smoothness={3}>
          <meshStandardMaterial
            color="#1E293B"
            roughness={0.25}
            metalness={0.75}
          />
        </RoundedBox>

        {/* Solid dark studio mirror backing (prevents background screen text bleed-through) */}
        <RoundedBox args={[0.78, 1.16, 0.026]} radius={0.04} smoothness={3}>
          <meshStandardMaterial
            color="#080C14"
            roughness={0.25}
            metalness={0.75}
          />
        </RoundedBox>

        {/* Subtle inner reflective mirror glass pane */}
        <mesh position={[0, 0.01, 0.014]}>
          <planeGeometry args={[0.7, 0.94]} />
          <meshStandardMaterial
            color="#0D1422"
            roughness={0.14}
            metalness={0.78}
          />
        </mesh>

        {/* Glowing neon mirror border */}
        <mesh position={[0, 0.562, 0.016]}>
          <boxGeometry args={[0.68, 0.008, 0.006]} />
          <meshBasicMaterial color={localProfile.avatarColor} />
        </mesh>
        <mesh position={[0, -0.562, 0.016]}>
          <boxGeometry args={[0.68, 0.008, 0.006]} />
          <meshBasicMaterial color={localProfile.avatarColor} />
        </mesh>

        {/* Soft local studio key light so dark colors pop crisply in Movie Mode */}
        <pointLight
          position={[0, 0.25, 0.62]}
          intensity={1.45}
          distance={2.4}
          color="#FFF7ED"
        />

        <Suspense fallback={null}>
          <Text
            position={[0, 0.515, 0.02]}
            fontSize={0.026}
            color="#94A3B8"
            anchorX="center"
            anchorY="middle"
          >
            LIVE 3D AVATAR MIRROR
          </Text>

          {/* Mirrored Nameplate Preview (positioned cleanly above tallest hats) */}
          <group position={[0, 0.425, 0.03]}>
            <RoundedBox args={[0.54, 0.076, 0.012]} radius={0.024} smoothness={2}>
              <meshBasicMaterial color="#0B0E13" />
            </RoundedBox>
            <Text
              position={[0, 0.003, 0.01]}
              fontSize={0.033}
              color="#F4F1EA"
              maxWidth={0.5}
              anchorX="center"
              anchorY="middle"
            >
              {displayTitle}
            </Text>
          </group>
        </Suspense>

        {/* 3D Character Reflection on Turntable */}
        <group
          ref={avatarTurntableRef}
          position={[0, -0.095, 0.145]}
          rotation={[0, Math.PI, 0]}
          scale={0.74}
        >
          <group ref={mirrorHeadRef} position={[0, 0.19, 0]}>
            <AvatarHead3D
              style={localProfile.avatarStyle}
              accentColor={localProfile.avatarColor}
              customization={cust}
              speakLevelRef={speakLevelRef}
            />
          </group>
          <group position={[0, -0.15, 0]}>
            <AvatarTorso3D
              accentColor={localProfile.avatarColor}
              customization={cust}
            />
          </group>
          <group ref={mirrorLeftHandRef} position={[0.25, -0.05, -0.11]}>
            <AvatarHand3D
              accentColor={localProfile.avatarColor}
              bodyColor={cust.bodyColor}
            />
          </group>
          <group ref={mirrorRightHandRef} position={[-0.25, -0.05, -0.11]}>
            <AvatarHand3D
              accentColor={localProfile.avatarColor}
              bodyColor={cust.bodyColor}
            />
          </group>
        </group>

        {/* Bottom Spin & Randomize Buttons on Mirror Frame */}
        <MirrorBtn3D
          label={spinPreview ? '⟳ Auto-Spin: ON' : '⟳ Spin 360°'}
          position={[-0.145, -0.49, 0.024]}
          width={0.29}
          height={0.058}
          active={spinPreview}
          accentColor={localProfile.avatarColor}
          onClick={() => setSpinPreview((v) => !v)}
        />
        <MirrorBtn3D
          label="🎲 Randomize"
          position={[0.165, -0.49, 0.024]}
          width={0.25}
          height={0.058}
          accentColor={localProfile.avatarColor}
          onClick={() => onUpdateAvatar(createRandomAvatarLook())}
        />
      </group>

      {/* ================================================================= */}
      {/* IN-VR INTERACTIVE WARDROBE PANEL (MOUNTED RIGHT BESIDE MIRROR)    */}
      {/* ================================================================= */}
      {inVR && (
        <group position={[0.42, 0, 0]}>
          <RoundedBox args={[0.84, 0.96, 0.024]} radius={0.04} smoothness={3}>
            <meshStandardMaterial color="#0B0F17" roughness={0.58} metalness={0.28} />
          </RoundedBox>

          <Suspense fallback={null}>
            <Text
              position={[-0.36, 0.415, 0.018]}
              fontSize={0.03}
              color={localProfile.avatarColor}
              anchorX="left"
              anchorY="middle"
            >
              AVATAR WARDROBE
            </Text>
          </Suspense>

          <MirrorBtn3D
            label="Done ✕"
            position={[0.29, 0.415, 0.018]}
            width={0.18}
            height={0.06}
            accentColor={localProfile.avatarColor}
            onClick={onClose}
          />

          {/* Quick Presets Row */}
          {AVATAR_PRESETS.slice(0, 4).map((preset, idx) => (
            <MirrorBtn3D
              key={preset.id}
              label={`${preset.icon} ${preset.label.split(' ')[0]}`}
              position={[-0.285 + idx * 0.19, 0.32, 0.018]}
              width={0.178}
              height={0.058}
              accentColor={localProfile.avatarColor}
              onClick={() =>
                onUpdateAvatar({
                  avatarColor: preset.avatarColor,
                  avatarStyle: preset.avatarStyle,
                  avatarCustomization: preset.customization,
                })
              }
            />
          ))}

          {/* 8 Slot Cyclers */}
          {(
            [
              {
                title: `Head: ${AVATAR_STYLES[Math.max(0, styleIdx)]?.label}`,
                onPrev: () =>
                  onUpdateAvatar({
                    avatarStyle: cycleItem(AVATAR_STYLES, styleIdx, -1).id,
                  }),
                onNext: () =>
                  onUpdateAvatar({
                    avatarStyle: cycleItem(AVATAR_STYLES, styleIdx, 1).id,
                  }),
              },
              {
                title: `Face: ${AVATAR_FACES[Math.max(0, faceIdx)]?.label}`,
                onPrev: () =>
                  onUpdateAvatar({
                    avatarCustomization: {
                      faceStyle: cycleItem(AVATAR_FACES, faceIdx, -1).id,
                    },
                  }),
                onNext: () =>
                  onUpdateAvatar({
                    avatarCustomization: {
                      faceStyle: cycleItem(AVATAR_FACES, faceIdx, 1).id,
                    },
                  }),
              },
              {
                title: `Hat: ${AVATAR_HATS[Math.max(0, hatIdx)]?.label}`,
                onPrev: () =>
                  onUpdateAvatar({
                    avatarCustomization: {
                      hat: cycleItem(AVATAR_HATS, hatIdx, -1).id,
                    },
                  }),
                onNext: () =>
                  onUpdateAvatar({
                    avatarCustomization: {
                      hat: cycleItem(AVATAR_HATS, hatIdx, 1).id,
                    },
                  }),
              },
              {
                title: `Outfit: ${AVATAR_OUTFITS[Math.max(0, outfitIdx)]?.label}`,
                onPrev: () =>
                  onUpdateAvatar({
                    avatarCustomization: {
                      outfit: cycleItem(AVATAR_OUTFITS, outfitIdx, -1).id,
                    },
                  }),
                onNext: () =>
                  onUpdateAvatar({
                    avatarCustomization: {
                      outfit: cycleItem(AVATAR_OUTFITS, outfitIdx, 1).id,
                    },
                  }),
              },
              {
                title: `Trim: ${AVATAR_COLORS[Math.max(0, accentIdx)]?.name ?? 'Custom'}`,
                onPrev: () =>
                  onUpdateAvatar({
                    avatarColor: cycleItem(AVATAR_COLORS, accentIdx, -1).hex,
                  }),
                onNext: () =>
                  onUpdateAvatar({
                    avatarColor: cycleItem(AVATAR_COLORS, accentIdx, 1).hex,
                  }),
              },
              {
                title: `Body: ${AVATAR_BODY_COLORS[Math.max(0, bodyIdx)]?.name ?? 'Slate'}`,
                onPrev: () =>
                  onUpdateAvatar({
                    avatarCustomization: {
                      bodyColor: cycleItem(AVATAR_BODY_COLORS, bodyIdx, -1).hex,
                    },
                  }),
                onNext: () =>
                  onUpdateAvatar({
                    avatarCustomization: {
                      bodyColor: cycleItem(AVATAR_BODY_COLORS, bodyIdx, 1).hex,
                    },
                  }),
              },
              {
                title: `Aura: ${AVATAR_ACCESSORIES[Math.max(0, accIdx)]?.label}`,
                onPrev: () =>
                  onUpdateAvatar({
                    avatarCustomization: {
                      accessory: cycleItem(AVATAR_ACCESSORIES, accIdx, -1).id,
                    },
                  }),
                onNext: () =>
                  onUpdateAvatar({
                    avatarCustomization: {
                      accessory: cycleItem(AVATAR_ACCESSORIES, accIdx, 1).id,
                    },
                  }),
              },
              {
                title: `Badge: ${AVATAR_FLAIR_BADGES[Math.max(0, flairIdx)]?.label}`,
                onPrev: () =>
                  onUpdateAvatar({
                    avatarCustomization: {
                      flairEmoji: cycleItem(AVATAR_FLAIR_BADGES, flairIdx, -1).emoji,
                    },
                  }),
                onNext: () =>
                  onUpdateAvatar({
                    avatarCustomization: {
                      flairEmoji: cycleItem(AVATAR_FLAIR_BADGES, flairIdx, 1).emoji,
                    },
                  }),
              },
            ] as const
          ).map((row, rIdx) => {
            const y = 0.21 - rIdx * 0.088
            return (
              <group key={row.title} position={[0, y, 0.018]}>
                <MirrorBtn3D
                  label="◀"
                  position={[-0.33, 0, 0]}
                  width={0.09}
                  height={0.064}
                  onClick={row.onPrev}
                />
                <Suspense fallback={null}>
                  <Text
                    position={[0, 0, 0.008]}
                    fontSize={0.024}
                    color="#E2E8F0"
                    maxWidth={0.52}
                    anchorX="center"
                    anchorY="middle"
                  >
                    {row.title}
                  </Text>
                </Suspense>
                <MirrorBtn3D
                  label="▶"
                  position={[0.33, 0, 0]}
                  width={0.09}
                  height={0.064}
                  onClick={row.onNext}
                />
              </group>
            )
          })}
        </group>
      )}
    </group>
  )
}
