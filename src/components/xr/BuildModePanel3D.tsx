import { RoundedBox, Text } from '@react-three/drei'
import { useState } from 'react'
import {
  CEILING_STYLES,
  FURNITURE_CATALOG,
  FURNITURE_COLOR_SWATCHES,
  LIGHTING_PRESETS,
  ROOM_MATERIAL_THEMES,
  ROOM_SIZE_SPECS,
  getCatalogEntry,
} from '../../constants/hangout'
import type {
  CeilingStyleId,
  FurnitureCatalogId,
  FurnitureCategory,
  LightingPresetId,
  PlacedFurnitureItem,
  RoomArchitectureConfig,
  RoomCustomizationState,
  RoomLightingConfig,
  RoomMaterialThemeId,
  RoomScreenTransform,
  RoomSizePreset,
} from '../../types/lounge'

type BuilderTab3D = 'spawn' | 'room' | 'screen' | 'mood'

interface Btn3DProps {
  label: string
  sub?: string
  position: [number, number, number]
  width?: number
  height?: number
  active?: boolean
  accentColor?: string
  danger?: boolean
  onClick: () => void
}

function Btn3D({
  label,
  sub,
  position,
  width = 0.34,
  height = 0.095,
  active = false,
  accentColor,
  danger = false,
  onClick,
}: Btn3DProps) {
  const [hovered, setHovered] = useState(false)

  const fill = danger
    ? hovered
      ? '#EF4444'
      : '#991B1B'
    : active
      ? '#E5A93C'
      : accentColor
        ? accentColor
        : hovered
          ? '#283449'
          : '#161D2B'

  const fg = active ? '#080A0D' : '#F4F1EA'

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
          args={[width + 0.008, height + 0.008, 0.014]}
          radius={0.022}
          smoothness={2}
          position={[0, 0, -0.002]}
        >
          <meshBasicMaterial
            color={danger ? '#F87171' : active ? '#FDE68A' : '#22D3EE'}
            transparent
            opacity={hovered ? 0.75 : 0.35}
          />
        </RoundedBox>
      )}
      <RoundedBox args={[width, height, 0.016]} radius={0.02} smoothness={2}>
        <meshBasicMaterial color={fill} />
      </RoundedBox>
      <Text
        position={[0, sub ? 0.014 : 0, 0.012]}
        fontSize={0.028}
        color={fg}
        maxWidth={width - 0.03}
        anchorX="center"
        anchorY="middle"
      >
        {label}
      </Text>
      {sub && (
        <Text
          position={[0, -0.022, 0.012]}
          fontSize={0.019}
          color={active ? '#1F2937' : '#CBD5E1'}
          anchorX="center"
          anchorY="middle"
        >
          {sub}
        </Text>
      )}
    </group>
  )
}

export interface BuildModePanel3DProps {
  visible: boolean
  customization: RoomCustomizationState
  selectedFurnitureId: string | null
  onSpawnFurniture: (type: FurnitureCatalogId) => void
  onUpdateFurnitureItem: (id: string, patch: Partial<PlacedFurnitureItem>) => void
  onDeleteFurnitureItem: (id: string) => void
  onEditFurnitureMedia: (id: string) => void
  onUpdateArchitecture: (patch: Partial<RoomArchitectureConfig>) => void
  onUpdateLighting: (patch: Partial<RoomLightingConfig>) => void
  onApplyLightingPreset: (preset: LightingPresetId) => void
  onUpdateScreen: (patch: Partial<RoomScreenTransform>) => void
  onResetRoom: () => void
  onClose: () => void
}

export function BuildModePanel3D({
  visible,
  customization,
  selectedFurnitureId,
  onSpawnFurniture,
  onUpdateFurnitureItem,
  onDeleteFurnitureItem,
  onEditFurnitureMedia,
  onUpdateArchitecture,
  onUpdateLighting,
  onApplyLightingPreset,
  onUpdateScreen,
  onResetRoom,
  onClose,
}: BuildModePanel3DProps) {
  const [tab, setTab] = useState<BuilderTab3D>('spawn')
  const [category, setCategory] = useState<FurnitureCategory>('seating')

  if (!visible) return null

  const selectedItem = selectedFurnitureId
    ? customization.furniture.find((f) => f.id === selectedFurnitureId) ?? null
    : null
  const selectedEntry = selectedItem ? getCatalogEntry(selectedItem.type) : null

  const filteredCatalog = FURNITURE_CATALOG.filter((item) => item.category === category)
  const { architecture, lighting, screen } = customization

  return (
    <group
      name="vr-build-mode-panel-3d"
      position={[-1.08, 1.32, -1.16]}
      rotation={[0, 0.42, 0]}
    >
      {/* Brushed Metallic Outer Studio Bezel */}
      <RoundedBox args={[1.372, 1.112, 0.02]} position={[0, 0, -0.004]} radius={0.044} smoothness={3}>
        <meshStandardMaterial color="#1E293B" roughness={0.25} metalness={0.75} />
      </RoundedBox>

      {/* Main Studio Backing Chassis */}
      <RoundedBox args={[1.34, 1.08, 0.024]} radius={0.04} smoothness={3}>
        <meshStandardMaterial color="#0B0F17" roughness={0.44} metalness={0.36} />
      </RoundedBox>

      {/* Cyan Builder Accent Strip */}
      <mesh position={[0, 0.525, 0.014]}>
        <boxGeometry args={[1.24, 0.007, 0.004]} />
        <meshBasicMaterial color="#22D3EE" />
      </mesh>

      {/* Header */}
      <Text
        position={[-0.6, 0.47, 0.016]}
        fontSize={0.036}
        color="#22D3EE"
        anchorX="left"
        anchorY="middle"
      >
        HANGOUT BUILDER &amp; MOOD STUDIO
      </Text>

      <Btn3D
        label="Done ✕"
        position={[0.52, 0.47, 0.016]}
        width={0.19}
        height={0.072}
        onClick={onClose}
      />

      {/* Primary Tab Row */}
      <group position={[0, 0.37, 0.016]}>
        {(
          [
            ['spawn', '🛋 Furniture'],
            ['room', '🏛 Layout'],
            ['screen', '📺 Screen'],
            ['mood', '💡 Lighting'],
          ] as const
        ).map(([id, label], idx) => (
          <Btn3D
            key={id}
            label={label}
            position={[-0.465 + idx * 0.31, 0, 0]}
            width={0.29}
            height={0.08}
            active={tab === id}
            onClick={() => setTab(id)}
          />
        ))}
      </group>

      {/* ================================================================= */}
      {/* TAB 1: SPAWN & INSPECT FURNITURE                                  */}
      {/* ================================================================= */}
      {tab === 'spawn' && (
        <group position={[0, 0, 0.016]}>
          {/* Category sub-pills */}
          {(
            [
              ['seating', 'Seats & Sofas'],
              ['tables', 'Tables & Rugs'],
              ['decor', 'Lamps & Props'],
              ['wall', 'Posters & Neon'],
            ] as const
          ).map(([catId, label], idx) => (
            <Btn3D
              key={catId}
              label={label}
              position={[-0.465 + idx * 0.31, 0.26, 0]}
              width={0.29}
              height={0.072}
              active={category === catId}
              onClick={() => setCategory(catId)}
            />
          ))}

          {/* Catalog Spawn Grid */}
          {filteredCatalog.map((entry, idx) => {
            const col = idx % 2
            const row = Math.floor(idx / 2)
            const x = col === 0 ? -0.31 : 0.31
            const y = 0.14 - row * 0.105
            return (
              <Btn3D
                key={entry.id}
                label={`+ ${entry.label}`}
                sub={
                  entry.seatSlots
                    ? `${entry.seatSlots.length} dynamic seat${entry.seatSlots.length > 1 ? 's' : ''}`
                    : entry.placementSurface === 'wall'
                      ? 'Wall mount'
                      : 'Floor prop'
                }
                position={[x, y, 0]}
                width={0.58}
                height={0.09}
                onClick={() => onSpawnFurniture(entry.id)}
              />
            )
          })}

          {/* Selected Item Inspector Footer */}
          <group position={[0, -0.32, 0]}>
            <RoundedBox args={[1.22, 0.31, 0.01]} radius={0.024} smoothness={2}>
              <meshBasicMaterial color="#111724" />
            </RoundedBox>
            {selectedItem && selectedEntry ? (
              <>
                <Text
                  position={[-0.56, 0.105, 0.01]}
                  fontSize={0.026}
                  color="#E5A93C"
                  anchorX="left"
                  anchorY="middle"
                >
                  {`SELECTED: ${selectedEntry.label.toUpperCase()} (POINT AT ${selectedEntry.placementSurface.toUpperCase()} & CLICK TO MOVE)`}
                </Text>

                {/* Color Swatch Row */}
                {FURNITURE_COLOR_SWATCHES.map((sw, idx) => (
                  <Btn3D
                    key={sw.hex}
                    label={
                      selectedItem.color.toLowerCase() === sw.hex.toLowerCase() ? '✓' : ''
                    }
                    position={[-0.51 + idx * 0.145, 0.015, 0.01]}
                    width={0.12}
                    height={0.068}
                    accentColor={sw.hex}
                    onClick={() =>
                      onUpdateFurnitureItem(selectedItem.id, { color: sw.hex })
                    }
                  />
                ))}

                {/* Nudge / Rotate / Poster / Delete */}
                <Btn3D
                  label="⟲ Rot -15°"
                  position={[-0.46, -0.09, 0.01]}
                  width={0.26}
                  height={0.072}
                  onClick={() =>
                    onUpdateFurnitureItem(selectedItem.id, {
                      rotationY: Number((selectedItem.rotationY - Math.PI / 12).toFixed(4)),
                    })
                  }
                />
                <Btn3D
                  label="⟳ Rot +15°"
                  position={[-0.17, -0.09, 0.01]}
                  width={0.26}
                  height={0.072}
                  onClick={() =>
                    onUpdateFurnitureItem(selectedItem.id, {
                      rotationY: Number((selectedItem.rotationY + Math.PI / 12).toFixed(4)),
                    })
                  }
                />
                {selectedItem.type === 'wall-poster' ||
                selectedItem.type === 'neon-sign' ? (
                  <Btn3D
                    label={
                      selectedItem.type === 'wall-poster' ? 'Custom Art ⌨' : 'Edit Text ⌨'
                    }
                    position={[0.14, -0.09, 0.01]}
                    width={0.3}
                    height={0.072}
                    active
                    onClick={() => onEditFurnitureMedia(selectedItem.id)}
                  />
                ) : (
                  <Btn3D
                    label={`Scale ${Math.round(selectedItem.scale * 100)}%`}
                    position={[0.14, -0.09, 0.01]}
                    width={0.3}
                    height={0.072}
                    onClick={() => {
                      const nextScale =
                        selectedItem.scale >= 1.4
                          ? 0.75
                          : Number((selectedItem.scale + 0.15).toFixed(2))
                      onUpdateFurnitureItem(selectedItem.id, { scale: nextScale })
                    }}
                  />
                )}
                <Btn3D
                  label="Delete ✕"
                  position={[0.45, -0.09, 0.01]}
                  width={0.25}
                  height={0.072}
                  danger
                  onClick={() => onDeleteFurnitureItem(selectedItem.id)}
                />
              </>
            ) : (
              <Text
                position={[0, 0, 0.01]}
                fontSize={0.028}
                color="#9CA3AF"
                maxWidth={1.1}
                textAlign="center"
                anchorX="center"
                anchorY="middle"
              >
                Tap any furniture above to spawn it, or point &amp; click any placed item in the room to recolor, rotate, or move it!
              </Text>
            )}
          </group>
        </group>
      )}

      {/* ================================================================= */}
      {/* TAB 2: EXPANDABLE ROOM LAYOUT & MATERIALS                         */}
      {/* ================================================================= */}
      {tab === 'room' && (
        <group position={[0, 0, 0.016]}>
          <Text
            position={[-0.59, 0.255, 0]}
            fontSize={0.026}
            color="#9CA3AF"
            anchorX="left"
            anchorY="middle"
          >
            ROOM FOOTPRINT SIZE
          </Text>
          {(['cozy', 'classic', 'grand'] as RoomSizePreset[]).map((sz, idx) => (
            <Btn3D
              key={sz}
              label={ROOM_SIZE_SPECS[sz].shortLabel}
              sub={`${ROOM_SIZE_SPECS[sz].width}×${ROOM_SIZE_SPECS[sz].depth}m`}
              position={[-0.41 + idx * 0.41, 0.175, 0]}
              width={0.38}
              height={0.088}
              active={architecture.sizePreset === sz}
              onClick={() => onUpdateArchitecture({ sizePreset: sz })}
            />
          ))}

          <Text
            position={[-0.59, 0.08, 0]}
            fontSize={0.026}
            color="#9CA3AF"
            anchorX="left"
            anchorY="middle"
          >
            EXPANDABLE HANGOUT WINGS &amp; ALCOVES
          </Text>
          <Btn3D
            label={`Left Bar Wing: ${architecture.leftBarAlcove ? 'OPEN' : 'CLOSED'}`}
            position={[-0.41, 0.005, 0]}
            width={0.38}
            height={0.085}
            active={architecture.leftBarAlcove}
            onClick={() =>
              onUpdateArchitecture({ leftBarAlcove: !architecture.leftBarAlcove })
            }
          />
          <Btn3D
            label={`Right Arcade: ${architecture.rightArcadeAlcove ? 'OPEN' : 'CLOSED'}`}
            position={[0, 0.005, 0]}
            width={0.38}
            height={0.085}
            active={architecture.rightArcadeAlcove}
            onClick={() =>
              onUpdateArchitecture({
                rightArcadeAlcove: !architecture.rightArcadeAlcove,
              })
            }
          />
          <Btn3D
            label={`Rear Balcony: ${architecture.rearBalcony ? 'ON' : 'FLAT'}`}
            position={[0.41, 0.005, 0]}
            width={0.38}
            height={0.085}
            active={architecture.rearBalcony}
            onClick={() =>
              onUpdateArchitecture({ rearBalcony: !architecture.rearBalcony })
            }
          />

          <Text
            position={[-0.59, -0.09, 0]}
            fontSize={0.026}
            color="#9CA3AF"
            anchorX="left"
            anchorY="middle"
          >
            WALL, FLOOR &amp; WOOD PALETTE
          </Text>
          {(Object.keys(ROOM_MATERIAL_THEMES) as RoomMaterialThemeId[]).map((th, idx) => (
            <Btn3D
              key={th}
              label={ROOM_MATERIAL_THEMES[th].shortLabel}
              position={[-0.48 + idx * 0.24, -0.165, 0]}
              width={0.225}
              height={0.08}
              active={architecture.materialTheme === th}
              onClick={() => onUpdateArchitecture({ materialTheme: th })}
            />
          ))}

          <Text
            position={[-0.59, -0.255, 0]}
            fontSize={0.026}
            color="#9CA3AF"
            anchorX="left"
            anchorY="middle"
          >
            CEILING ARCHITECTURE &amp; ROOM RESET
          </Text>
          {CEILING_STYLES.map((cs: { id: CeilingStyleId; label: string }, idx) => (
            <Btn3D
              key={cs.id}
              label={cs.label}
              position={[-0.45 + idx * 0.3, -0.335, 0]}
              width={0.28}
              height={0.078}
              active={architecture.ceilingStyle === cs.id}
              onClick={() => onUpdateArchitecture({ ceilingStyle: cs.id })}
            />
          ))}
          <Btn3D
            label="Reset Room"
            position={[0.46, -0.335, 0]}
            width={0.26}
            height={0.078}
            danger
            onClick={onResetRoom}
          />
        </group>
      )}

      {/* ================================================================= */}
      {/* TAB 3: REPOSITIONABLE & RESIZABLE MAIN VIEWING SCREEN             */}
      {/* ================================================================= */}
      {tab === 'screen' && (
        <group position={[0, 0, 0.016]}>
          <Text
            position={[0, 0.24, 0]}
            fontSize={0.03}
            color="#E5A93C"
            anchorX="center"
            anchorY="middle"
          >
            {`SCREEN SCALE: ${Math.round(screen.scale * 100)}% · ${screen.curved ? 'CURVED IMAX' : 'FLAT PANEL'}`}
          </Text>

          <Btn3D
            label="Smaller (-10%)"
            position={[-0.4, 0.14, 0]}
            width={0.36}
            height={0.09}
            onClick={() =>
              onUpdateScreen({
                scale: Math.max(0.65, Number((screen.scale - 0.1).toFixed(2))),
              })
            }
          />
          <Btn3D
            label="Larger (+10%)"
            position={[0, 0.14, 0]}
            width={0.36}
            height={0.09}
            onClick={() =>
              onUpdateScreen({
                scale: Math.min(1.55, Number((screen.scale + 0.1).toFixed(2))),
              })
            }
          />
          <Btn3D
            label={screen.curved ? 'Switch to Flat' : 'Switch to Curved'}
            position={[0.4, 0.14, 0]}
            width={0.36}
            height={0.09}
            active={screen.curved}
            onClick={() => onUpdateScreen({ curved: !screen.curved })}
          />

          <Text
            position={[0, 0.035, 0]}
            fontSize={0.026}
            color="#9CA3AF"
            anchorX="center"
            anchorY="middle"
          >
            POSITION &amp; ANGLE IN ROOM
          </Text>

          <Btn3D
            label="◀ Move Left"
            position={[-0.4, -0.045, 0]}
            width={0.36}
            height={0.085}
            onClick={() =>
              onUpdateScreen({
                position: [
                  Number((screen.position[0] - 0.6).toFixed(2)),
                  screen.position[1],
                  screen.position[2],
                ],
              })
            }
          />
          <Btn3D
            label="▲ Raise Up"
            position={[0, -0.045, 0]}
            width={0.36}
            height={0.085}
            onClick={() =>
              onUpdateScreen({
                position: [
                  screen.position[0],
                  Math.min(4.6, Number((screen.position[1] + 0.25).toFixed(2))),
                  screen.position[2],
                ],
              })
            }
          />
          <Btn3D
            label="Move Right ▶"
            position={[0.4, -0.045, 0]}
            width={0.36}
            height={0.085}
            onClick={() =>
              onUpdateScreen({
                position: [
                  Number((screen.position[0] + 0.6).toFixed(2)),
                  screen.position[1],
                  screen.position[2],
                ],
              })
            }
          />

          <Btn3D
            label="Closer (+Z)"
            position={[-0.4, -0.15, 0]}
            width={0.36}
            height={0.085}
            onClick={() =>
              onUpdateScreen({
                position: [
                  screen.position[0],
                  screen.position[1],
                  Math.min(-2.2, Number((screen.position[2] + 0.55).toFixed(2))),
                ],
              })
            }
          />
          <Btn3D
            label="▼ Lower Down"
            position={[0, -0.15, 0]}
            width={0.36}
            height={0.085}
            onClick={() =>
              onUpdateScreen({
                position: [
                  screen.position[0],
                  Math.max(1.85, Number((screen.position[1] - 0.25).toFixed(2))),
                  screen.position[2],
                ],
              })
            }
          />
          <Btn3D
            label="Further (-Z)"
            position={[0.4, -0.15, 0]}
            width={0.36}
            height={0.085}
            onClick={() =>
              onUpdateScreen({
                position: [
                  screen.position[0],
                  screen.position[1],
                  Math.max(-9.0, Number((screen.position[2] - 0.55).toFixed(2))),
                ],
              })
            }
          />

          <Btn3D
            label="⟲ Angle Left"
            position={[-0.4, -0.265, 0]}
            width={0.36}
            height={0.085}
            onClick={() =>
              onUpdateScreen({
                rotationY: Number((screen.rotationY + 0.14).toFixed(3)),
              })
            }
          />
          <Btn3D
            label="Center Screen"
            position={[0, -0.265, 0]}
            width={0.36}
            height={0.085}
            onClick={() =>
              onUpdateScreen({
                position: [0, 3.05, -6.45],
                rotationY: 0,
                scale: 1,
                curved: true,
              })
            }
          />
          <Btn3D
            label="Angle Right ⟳"
            position={[0.4, -0.265, 0]}
            width={0.36}
            height={0.085}
            onClick={() =>
              onUpdateScreen({
                rotationY: Number((screen.rotationY - 0.14).toFixed(3)),
              })
            }
          />
        </group>
      )}

      {/* ================================================================= */}
      {/* TAB 4: MOOD LIGHTING PRESETS & AUTO-DIM                           */}
      {/* ================================================================= */}
      {tab === 'mood' && (
        <group position={[0, 0, 0.016]}>
          <Text
            position={[-0.59, 0.255, 0]}
            fontSize={0.026}
            color="#9CA3AF"
            anchorX="left"
            anchorY="middle"
          >
            QUICK VIBE PRESETS
          </Text>
          {(Object.keys(LIGHTING_PRESETS) as LightingPresetId[]).map((pid, idx) => (
            <Btn3D
              key={pid}
              label={LIGHTING_PRESETS[pid].shortLabel}
              position={[-0.48 + idx * 0.24, 0.17, 0]}
              width={0.225}
              height={0.088}
              active={lighting.preset === pid}
              onClick={() => onApplyLightingPreset(pid)}
            />
          ))}

          <Text
            position={[-0.59, 0.065, 0]}
            fontSize={0.026}
            color="#9CA3AF"
            anchorX="left"
            anchorY="middle"
          >
            {`ROOM BRIGHTNESS (${Math.round(lighting.brightness * 100)}%) & PLAYBACK AUTO-DIM`}
          </Text>

          <Btn3D
            label="Dimmer (-20%)"
            position={[-0.42, -0.015, 0]}
            width={0.34}
            height={0.088}
            onClick={() =>
              onUpdateLighting({
                brightness: Math.max(0.18, Number((lighting.brightness - 0.2).toFixed(2))),
              })
            }
          />
          <Btn3D
            label="Brighter (+20%)"
            position={[-0.04, -0.015, 0]}
            width={0.34}
            height={0.088}
            onClick={() =>
              onUpdateLighting({
                brightness: Math.min(1.8, Number((lighting.brightness + 0.2).toFixed(2))),
              })
            }
          />
          <Btn3D
            label={`Auto-Dim: ${lighting.autoDimOnPlay ? 'ON' : 'OFF'}`}
            sub="Dims when playing"
            position={[0.38, -0.015, 0]}
            width={0.42}
            height={0.088}
            active={lighting.autoDimOnPlay}
            onClick={() =>
              onUpdateLighting({ autoDimOnPlay: !lighting.autoDimOnPlay })
            }
          />

          <Text
            position={[-0.59, -0.125, 0]}
            fontSize={0.026}
            color="#9CA3AF"
            anchorX="left"
            anchorY="middle"
          >
            CUSTOM ACCENT SCONCE &amp; TRIM COLOR
          </Text>

          {[
            '#E5A93C',
            '#F97316',
            '#EC4899',
            '#A855F7',
            '#38BDF8',
            '#10B981',
            '#EF4444',
            '#F8FAFC',
          ].map((hex, idx) => (
            <Btn3D
              key={hex}
              label={lighting.accentColor.toLowerCase() === hex.toLowerCase() ? '✓' : ''}
              position={[-0.51 + idx * 0.145, -0.21, 0]}
              width={0.12}
              height={0.08}
              accentColor={hex}
              onClick={() => onUpdateLighting({ accentColor: hex })}
            />
          ))}
        </group>
      )}
    </group>
  )
}
