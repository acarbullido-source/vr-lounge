import { RoundedBox, Text } from '@react-three/drei'
import { useEffect, useState } from 'react'
import { SAMPLE_MEDIA_PRESETS } from '../../constants/cinema'
import type { SampleMediaPreset } from '../../types/lounge'

export type VRKeyboardMode = 'url' | 'chat' | 'youtube'

export interface VRKeyboard3DProps {
  mode: VRKeyboardMode
  initialValue: string
  onSubmitUrl: (url: string, title?: string) => void
  onSubmitChat: (message: string) => void
  onSubmitYouTubeSearch?: (query: string) => void
  onClose: () => void
}

const YOUTUBE_QUICK_CHIPS: ReadonlyArray<string> = [
  '4K trailers',
  'lofi beats',
  'music video',
  'sci-fi short',
]

const KEY_ROWS: ReadonlyArray<ReadonlyArray<string>> = [
  ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '_'],
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p', '/', ':'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l', '.', '?', '='],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm', '&', '%', '+', '#'],
]

interface KeyCap3DProps {
  label: string
  position: [number, number, number]
  width?: number
  accent?: 'default' | 'amber' | 'muted'
  onPress: () => void
}

function KeyCap3D({
  label,
  position,
  width = 0.088,
  accent = 'default',
  onPress,
}: KeyCap3DProps) {
  const [hovered, setHovered] = useState(false)

  const fill =
    accent === 'amber'
      ? hovered
        ? '#F2BE5C'
        : '#E5A93C'
      : accent === 'muted'
        ? hovered
          ? '#2B3548'
          : '#1F2634'
        : hovered
          ? '#2A3346'
          : '#181E2B'

  const fg = accent === 'amber' ? '#0B0D10' : '#F4F1EA'

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
        onPress()
      }}
    >
      <RoundedBox args={[width, 0.072, 0.018]} radius={0.014} smoothness={2}>
        <meshBasicMaterial color={fill} />
      </RoundedBox>
      <Text
        position={[0, 0, 0.012]}
        fontSize={0.03}
        color={fg}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
    </group>
  )
}

export function VRKeyboard3D({
  mode,
  initialValue,
  onSubmitUrl,
  onSubmitChat,
  onSubmitYouTubeSearch,
  onClose,
}: VRKeyboard3DProps) {
  const [buffer, setBuffer] = useState(initialValue)
  const [uppercase, setUppercase] = useState(false)

  useEffect(() => {
    setBuffer(initialValue)
  }, [initialValue, mode])

  const hasTopPresetRow = mode === 'url' || mode === 'youtube'

  const appendText = (chunk: string) => {
    setBuffer((prev) => prev + chunk)
  }

  const handlePasteClipboard = async () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.readText) {
      try {
        const clip = await navigator.clipboard.readText()
        if (clip) setBuffer(clip.trim())
      } catch {
        // Ignore clipboard permission denial inside XR
      }
    }
  }

  const handlePresetPick = (preset: SampleMediaPreset) => {
    setBuffer(preset.url)
    onSubmitUrl(preset.url, preset.title)
  }

  const handleConfirm = () => {
    const trimmed = buffer.trim()
    if (!trimmed) return
    if (mode === 'youtube') {
      onSubmitYouTubeSearch?.(trimmed)
    } else if (mode === 'url') {
      onSubmitUrl(trimmed, 'Custom Stream')
    } else {
      onSubmitChat(trimmed)
      setBuffer('')
    }
  }

  return (
    <group name="vr-virtual-keyboard">
      {/* Main backing plate */}
      <RoundedBox
        args={[1.38, hasTopPresetRow ? 0.92 : 0.68, 0.022]}
        radius={0.035}
        smoothness={3}
      >
        <meshStandardMaterial color="#0D1118" roughness={0.65} metalness={0.25} />
      </RoundedBox>

      {/* Header bar */}
      <Text
        position={[-0.62, hasTopPresetRow ? 0.395 : 0.275, 0.015]}
        fontSize={0.034}
        color="#E5A93C"
        anchorX="left"
        anchorY="middle"
      >
        {mode === 'youtube'
          ? 'SEARCH YOUTUBE OR PASTE VIDEO LINK'
          : mode === 'url'
            ? 'HEADSET URL & STREAM DECK (MP4 / HLS .M3U8)'
            : 'COMPOSE SPATIAL CHAT MESSAGE'}
      </Text>

      <KeyCap3D
        label="Close ✕"
        position={[0.56, hasTopPresetRow ? 0.395 : 0.275, 0.015]}
        width={0.16}
        accent="muted"
        onPress={onClose}
      />

      {/* Quick Cinema Stream Presets when in URL mode */}
      {mode === 'url' && (
        <group position={[0, 0.285, 0.015]}>
          {SAMPLE_MEDIA_PRESETS.slice(0, 4).map((preset, idx) => {
            const xOffset = -0.48 + idx * 0.32
            return (
              <KeyCap3D
                key={preset.id}
                label={preset.title.split('(')[0].split('—')[0].trim().slice(0, 14)}
                position={[xOffset, 0, 0]}
                width={0.3}
                accent="muted"
                onPress={() => handlePresetPick(preset)}
              />
            )
          })}
        </group>
      )}

      {/* Quick Watch-Party Search Chips when in YouTube mode */}
      {mode === 'youtube' && (
        <group position={[0, 0.285, 0.015]}>
          {YOUTUBE_QUICK_CHIPS.map((chip, idx) => {
            const xOffset = -0.48 + idx * 0.32
            return (
              <KeyCap3D
                key={chip}
                label={`🔍 ${chip}`}
                position={[xOffset, 0, 0]}
                width={0.3}
                accent="muted"
                onPress={() => {
                  setBuffer(chip)
                  onSubmitYouTubeSearch?.(chip)
                }}
              />
            )
          })}
        </group>
      )}

      {/* Input readout field */}
      <group position={[0, 0.175, 0.014]}>
        <RoundedBox args={[1.26, 0.088, 0.012]} radius={0.018} smoothness={2}>
          <meshBasicMaterial color="#07090D" />
        </RoundedBox>
        <Text
          position={[-0.59, 0, 0.01]}
          fontSize={0.031}
          color={buffer ? '#F4F1EA' : '#6B7280'}
          maxWidth={1.18}
          anchorX="left"
          anchorY="middle"
        >
          {buffer
            ? buffer.length > 52
              ? `…${buffer.slice(-52)}|`
              : `${buffer}|`
            : mode === 'youtube'
              ? 'Search YouTube videos, channels, or paste watch URL...'
              : mode === 'url'
                ? 'https://example.com/stream.m3u8'
                : 'Type a message to the room...'}
        </Text>
      </group>

      {/* Shortcut tokens row */}
      <group position={[0, 0.085, 0.015]}>
        {mode === 'youtube' ? (
          <>
            <KeyCap3D
              label="4K"
              position={[-0.51, 0, 0]}
              width={0.16}
              accent="muted"
              onPress={() => appendText(' 4K')}
            />
            <KeyCap3D
              label="live"
              position={[-0.32, 0, 0]}
              width={0.17}
              accent="muted"
              onPress={() => appendText(' live')}
            />
            <KeyCap3D
              label="Paste"
              position={[-0.11, 0, 0]}
              width={0.19}
              accent="muted"
              onPress={() => void handlePasteClipboard()}
            />
            <KeyCap3D
              label="Clear"
              position={[0.11, 0, 0]}
              width={0.18}
              accent="muted"
              onPress={() => setBuffer('')}
            />
            <KeyCap3D
              label="Search YouTube 🔍"
              position={[0.42, 0, 0]}
              width={0.38}
              accent="amber"
              onPress={handleConfirm}
            />
          </>
        ) : mode === 'url' ? (
          <>
            <KeyCap3D
              label="https://"
              position={[-0.5, 0, 0]}
              width={0.19}
              accent="muted"
              onPress={() => appendText('https://')}
            />
            <KeyCap3D
              label=".m3u8"
              position={[-0.29, 0, 0]}
              width={0.17}
              accent="muted"
              onPress={() => appendText('.m3u8')}
            />
            <KeyCap3D
              label=".mp4"
              position={[-0.1, 0, 0]}
              width={0.16}
              accent="muted"
              onPress={() => appendText('.mp4')}
            />
            <KeyCap3D
              label="Paste"
              position={[0.1, 0, 0]}
              width={0.18}
              accent="muted"
              onPress={() => void handlePasteClipboard()}
            />
            <KeyCap3D
              label="Clear"
              position={[0.3, 0, 0]}
              width={0.17}
              accent="muted"
              onPress={() => setBuffer('')}
            />
            <KeyCap3D
              label="Load URL"
              position={[0.51, 0, 0]}
              width={0.21}
              accent="amber"
              onPress={handleConfirm}
            />
          </>
        ) : (
          <>
            <KeyCap3D
              label="Ready! 🍿"
              position={[-0.48, 0, 0]}
              width={0.23}
              accent="muted"
              onPress={() => onSubmitChat('Ready! 🍿')}
            />
            <KeyCap3D
              label="Pause 1 sec"
              position={[-0.22, 0, 0]}
              width={0.24}
              accent="muted"
              onPress={() => onSubmitChat('Pause 1 sec please!')}
            />
            <KeyCap3D
              label="Clear"
              position={[0.04, 0, 0]}
              width={0.18}
              accent="muted"
              onPress={() => setBuffer('')}
            />
            <KeyCap3D
              label="Send Message"
              position={[0.42, 0, 0]}
              width={0.36}
              accent="amber"
              onPress={handleConfirm}
            />
          </>
        )}
      </group>

      {/* Main QWERTY Matrix */}
      {KEY_ROWS.map((row, rowIdx) => {
        const y = -0.005 - rowIdx * 0.082
        const rowWidth = (row.length - 1) * 0.098
        return (
          <group key={rowIdx} position={[0, y, 0.015]}>
            {row.map((ch, colIdx) => {
              const display = uppercase ? ch.toUpperCase() : ch
              const x = -rowWidth / 2 + colIdx * 0.098
              return (
                <KeyCap3D
                  key={ch}
                  label={display}
                  position={[x, 0, 0]}
                  onPress={() => appendText(display)}
                />
              )
            })}
          </group>
        )
      })}

      {/* Bottom modifier & spacebar row */}
      <group position={[0, -0.34, 0.015]}>
        <KeyCap3D
          label={uppercase ? 'CAPS ON' : 'Shift'}
          position={[-0.49, 0, 0]}
          width={0.21}
          accent={uppercase ? 'amber' : 'muted'}
          onPress={() => setUppercase((u) => !u)}
        />
        <KeyCap3D
          label="Space"
          position={[-0.06, 0, 0]}
          width={0.56}
          onPress={() => appendText(' ')}
        />
        <KeyCap3D
          label="⌫ Back"
          position={[0.34, 0, 0]}
          width={0.18}
          accent="muted"
          onPress={() => setBuffer((prev) => prev.slice(0, -1))}
        />
        <KeyCap3D
          label={
            mode === 'youtube' ? 'Search ↵' : mode === 'url' ? 'Play ▶' : 'Send ↵'
          }
          position={[0.54, 0, 0]}
          width={0.18}
          accent="amber"
          onPress={handleConfirm}
        />
      </group>
    </group>
  )
}
