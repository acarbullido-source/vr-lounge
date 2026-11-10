import { RoundedBox, Text } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import { useRef, useState } from 'react'
import * as THREE from 'three'
import { QUICK_REACTIONS } from '../../constants/cinema'
import type { ChatMessage, FloatingReaction } from '../../types/lounge'

function FloatingEmojiParticle({ reaction }: { reaction: FloatingReaction }) {
  const groupRef = useRef<THREE.Group>(null)
  const phase = useRef(Math.random() * Math.PI * 2)

  useFrame(({ camera }) => {
    if (!groupRef.current) return
    const ageSec = (Date.now() - reaction.createdAt) / 1000
    const progress = Math.min(1, ageSec / 3.6)

    const riseY = reaction.origin[1] + ageSec * 0.72
    const swayX = reaction.origin[0] + Math.sin(ageSec * 2.8 + phase.current) * 0.16
    groupRef.current.position.set(swayX, riseY, reaction.origin[2])
    groupRef.current.lookAt(camera.position)

    const popScale =
      progress < 0.12
        ? THREE.MathUtils.lerp(0.2, 1.15, progress / 0.12)
        : THREE.MathUtils.lerp(1.15, 0.45, (progress - 0.12) / 0.88)
    groupRef.current.scale.setScalar(Math.max(0.01, popScale))
  })

  return (
    <group ref={groupRef} position={reaction.origin}>
      <Text fontSize={0.28} anchorX="center" anchorY="middle">
        {reaction.emoji}
      </Text>
      <Text
        position={[0, -0.19, 0]}
        fontSize={0.055}
        color="#E5A93C"
        anchorX="center"
        anchorY="middle"
      >
        {reaction.displayName}
      </Text>
    </group>
  )
}

export interface SpatialChatPanelProps {
  visible: boolean
  messages: ChatMessage[]
  reactions: FloatingReaction[]
  screenTransform?: {
    position: [number, number, number]
    rotationY: number
    scale: number
  }
  onSendReaction: (emoji: string) => void
  onOpenChatKeyboard: () => void
  onClosePanel: () => void
}

export function SpatialChatPanel({
  visible,
  messages,
  reactions,
  screenTransform,
  onSendReaction,
  onOpenChatKeyboard,
  onClosePanel,
}: SpatialChatPanelProps) {
  const [hoveredBtn, setHoveredBtn] = useState<string | null>(null)
  const visibleMessages = messages.slice(-8)

  const sc = screenTransform?.scale ?? 1
  const sx = screenTransform?.position[0] ?? 0
  const sy = screenTransform?.position[1] ?? 3.05
  const sz = screenTransform?.position[2] ?? -6.45
  const sRot = screenTransform?.rotationY ?? 0

  const localOffsetX = 4.25 * sc + 1.15
  const localOffsetZ = 1.8
  const cos = Math.cos(sRot)
  const sin = Math.sin(sRot)
  const panelX = sx + localOffsetX * cos + localOffsetZ * sin
  const panelZ = sz - localOffsetX * sin + localOffsetZ * cos

  return (
    <group name="spatial-chat-and-reactions">
      {/* Buoyant 3D Emoji Reactions rising from lounge seats */}
      {reactions.map((rx) => (
        <FloatingEmojiParticle key={rx.id} reaction={rx} />
      ))}

      {/* Toggleable 3D Spatial Chat Panel beside the cinema screen */}
      {visible && (
        <group position={[panelX, Math.max(1.9, sy - 0.4), panelZ]} rotation={[0, sRot - 0.44, 0]}>
          {/* Brushed Metallic Outer Bezel */}
          <RoundedBox args={[2.41, 3.21, 0.036]} position={[0, 0, -0.006]} radius={0.09} smoothness={3}>
            <meshStandardMaterial color="#1E293B" roughness={0.25} metalness={0.75} />
          </RoundedBox>

          {/* Outer frame */}
          <RoundedBox args={[2.35, 3.15, 0.04]} radius={0.08} smoothness={3}>
            <meshStandardMaterial color="#0D1118" roughness={0.45} metalness={0.34} />
          </RoundedBox>

          {/* Top Amber Header Accent Strip */}
          <mesh position={[0, 1.54, 0.025]}>
            <boxGeometry args={[2.16, 0.01, 0.005]} />
            <meshBasicMaterial color="#E5A93C" />
          </mesh>

          {/* Header */}
          <Text
            position={[-0.98, 1.36, 0.03]}
            fontSize={0.11}
            color="#E5A93C"
            anchorX="left"
            anchorY="middle"
          >
            LOUNGE CHAT
          </Text>

          {/* Hide button */}
          <group
            position={[0.88, 1.36, 0.03]}
            scale={hoveredBtn === 'close' ? 1.04 : 1}
            pointerEventsType={{ deny: 'grab' }}
            onPointerOver={() => setHoveredBtn('close')}
            onPointerOut={() => setHoveredBtn(null)}
            onClick={(e) => {
              e.stopPropagation()
              onClosePanel()
            }}
          >
            <RoundedBox args={[0.34, 0.19, 0.02]} radius={0.04} smoothness={2}>
              <meshBasicMaterial color={hoveredBtn === 'close' ? '#2A3346' : '#1A202C'} />
            </RoundedBox>
            <Text position={[0, 0, 0.015]} fontSize={0.075} color="#F4F1EA" anchorX="center" anchorY="middle">
              Hide
            </Text>
          </group>

          {/* Divider */}
          <mesh position={[0, 1.2, 0.025]}>
            <planeGeometry args={[2.05, 0.008]} />
            <meshBasicMaterial color="#262F3F" />
          </mesh>

          {/* Message Feed */}
          {visibleMessages.length === 0 ? (
            <Text
              position={[0, 0.25, 0.03]}
              fontSize={0.09}
              color="#94A3B8"
              maxWidth={1.9}
              textAlign="center"
              anchorX="center"
              anchorY="middle"
            >
              No messages yet. Tap an emoji below or compose a message!
            </Text>
          ) : (
            visibleMessages.map((msg, idx) => {
              const rowY = 0.98 - idx * 0.255
              return (
                <group key={msg.id} position={[-0.98, rowY, 0.03]}>
                  <Text
                    position={[0, 0.045, 0]}
                    fontSize={0.068}
                    color={msg.isSystem ? '#E5A93C' : msg.avatarColor}
                    anchorX="left"
                    anchorY="middle"
                  >
                    {msg.displayName}
                  </Text>
                  <Text
                    position={[0, -0.042, 0]}
                    fontSize={0.078}
                    color={msg.isSystem ? '#E2E8F0' : '#F4F1EA'}
                    maxWidth={1.95}
                    anchorX="left"
                    anchorY="middle"
                  >
                    {msg.text.length > 62 ? `${msg.text.slice(0, 62)}…` : msg.text}
                  </Text>
                </group>
              )
            })
          )}

          {/* Quick Emoji Burst Bar */}
          <group position={[0, -1.08, 0.03]}>
            {QUICK_REACTIONS.map((emoji, idx) => {
              const x = -0.82 + idx * 0.328
              const key = `rx-${emoji}`
              const isHovered = hoveredBtn === key
              return (
                <group
                  key={emoji}
                  position={[x, 0, 0]}
                  scale={isHovered ? 1.04 : 1}
                  pointerEventsType={{ deny: 'grab' }}
                  onPointerOver={() => setHoveredBtn(key)}
                  onPointerOut={() => setHoveredBtn(null)}
                  onClick={(e) => {
                    e.stopPropagation()
                    onSendReaction(emoji)
                  }}
                >
                  <RoundedBox args={[0.27, 0.24, 0.02]} radius={0.05} smoothness={2}>
                    <meshBasicMaterial
                      color={isHovered ? '#2A3447' : '#171D29'}
                    />
                  </RoundedBox>
                  <Text position={[0, 0, 0.015]} fontSize={0.12} anchorX="center" anchorY="middle">
                    {emoji}
                  </Text>
                </group>
              )
            })}
          </group>

          {/* Compose in VR Button */}
          <group
            position={[0, -1.39, 0.03]}
            scale={hoveredBtn === 'compose' ? 1.04 : 1}
            pointerEventsType={{ deny: 'grab' }}
            onPointerOver={() => setHoveredBtn('compose')}
            onPointerOut={() => setHoveredBtn(null)}
            onClick={(e) => {
              e.stopPropagation()
              onOpenChatKeyboard()
            }}
          >
            <RoundedBox args={[2.0, 0.24, 0.025]} radius={0.055} smoothness={2}>
              <meshBasicMaterial color={hoveredBtn === 'compose' ? '#F2BE5C' : '#E5A93C'} />
            </RoundedBox>
            <Text
              position={[0, 0, 0.016]}
              fontSize={0.082}
              color="#0B0D10"
              anchorX="center"
              anchorY="middle"
            >
              Compose Message (VR Keyboard)
            </Text>
          </group>
        </group>
      )}
    </group>
  )
}
