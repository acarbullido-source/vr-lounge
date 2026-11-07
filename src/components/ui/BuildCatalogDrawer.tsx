import {
  Check,
  Copy,
  Hammer,
  Lightbulb,
  Maximize2,
  Palette,
  Plus,
  RotateCcw,
  Sofa,
  Trash2,
  Tv,
  Upload,
  X,
} from 'lucide-react'
import { useState } from 'react'
import {
  CEILING_STYLES,
  FURNITURE_CATALOG,
  FURNITURE_COLOR_SWATCHES,
  LIGHTING_PRESETS,
  POSTER_ART_PRESETS,
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

export interface BuildCatalogDrawerProps {
  open: boolean
  buildMode: boolean
  customization: RoomCustomizationState
  selectedFurnitureId: string | null
  onToggleBuildMode: (enabled: boolean) => void
  onSelectFurniture: (id: string | null) => void
  onSpawnFurniture: (type: FurnitureCatalogId) => void
  onUpdateFurnitureItem: (id: string, patch: Partial<PlacedFurnitureItem>) => void
  onDuplicateFurnitureItem: (id: string) => void
  onDeleteFurnitureItem: (id: string) => void
  onUpdateArchitecture: (patch: Partial<RoomArchitectureConfig>) => void
  onUpdateLighting: (patch: Partial<RoomLightingConfig>) => void
  onApplyLightingPreset: (preset: LightingPresetId) => void
  onUpdateScreen: (patch: Partial<RoomScreenTransform>) => void
  onResetRoom: () => void
  onImportBlueprintJson: (jsonText: string) => boolean
  onClose: () => void
}

export function BuildCatalogDrawer({
  open,
  buildMode,
  customization,
  selectedFurnitureId,
  onToggleBuildMode,
  onSelectFurniture,
  onSpawnFurniture,
  onUpdateFurnitureItem,
  onDuplicateFurnitureItem,
  onDeleteFurnitureItem,
  onUpdateArchitecture,
  onUpdateLighting,
  onApplyLightingPreset,
  onUpdateScreen,
  onResetRoom,
  onImportBlueprintJson,
  onClose,
}: BuildCatalogDrawerProps) {
  const [activeTab, setActiveTab] = useState<'furniture' | 'layout' | 'screen' | 'mood'>(
    'furniture',
  )
  const [catFilter, setCatFilter] = useState<FurnitureCategory>('seating')
  const [copiedJson, setCopiedJson] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importDraft, setImportDraft] = useState('')
  const [importError, setImportError] = useState<string | null>(null)

  if (!open) return null

  const { architecture, lighting, screen, furniture } = customization
  const selectedItem = selectedFurnitureId
    ? furniture.find((f) => f.id === selectedFurnitureId) ?? null
    : null
  const selectedEntry = selectedItem ? getCatalogEntry(selectedItem.type) : null

  const handleCopyBlueprint = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(customization, null, 2))
      setCopiedJson(true)
      window.setTimeout(() => setCopiedJson(false), 2000)
    } catch {
      // Ignore clipboard failure
    }
  }

  return (
    <section
      id="hangout-customize-drawer"
      className="pointer-events-auto lounge-panel mx-auto mb-3 w-full max-w-4xl rounded-2xl p-4 sm:p-5"
    >
      {/* Top Header & Sub-Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#f4f1ea]/10 pb-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            id="btn-studio-tab-furniture"
            type="button"
            onClick={() => setActiveTab('furniture')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'furniture'
                ? 'bg-[#e5a93c] text-[#080a0d]'
                : 'bg-[#141922] text-[#c7c2b8] hover:text-[#f4f1ea]'
            }`}
          >
            <Sofa className="h-3.5 w-3.5" />
            <span>Build &amp; Decorate</span>
          </button>

          <button
            id="btn-studio-tab-layout"
            type="button"
            onClick={() => setActiveTab('layout')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'layout'
                ? 'bg-[#e5a93c] text-[#080a0d]'
                : 'bg-[#141922] text-[#c7c2b8] hover:text-[#f4f1ea]'
            }`}
          >
            <Maximize2 className="h-3.5 w-3.5" />
            <span>Room &amp; Materials</span>
          </button>

          <button
            id="btn-studio-tab-screen"
            type="button"
            onClick={() => setActiveTab('screen')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'screen'
                ? 'bg-[#e5a93c] text-[#080a0d]'
                : 'bg-[#141922] text-[#c7c2b8] hover:text-[#f4f1ea]'
            }`}
          >
            <Tv className="h-3.5 w-3.5" />
            <span>Screen Setup</span>
          </button>

          <button
            id="btn-studio-tab-mood"
            type="button"
            onClick={() => setActiveTab('mood')}
            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-semibold transition ${
              activeTab === 'mood'
                ? 'bg-[#e5a93c] text-[#080a0d]'
                : 'bg-[#141922] text-[#c7c2b8] hover:text-[#f4f1ea]'
            }`}
          >
            <Lightbulb className="h-3.5 w-3.5" />
            <span>Lighting &amp; Moods</span>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            id="btn-toggle-3d-build-gizmo"
            type="button"
            onClick={() => onToggleBuildMode(!buildMode)}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
              buildMode
                ? 'border-[#22d3ee] bg-[#22d3ee]/15 text-[#22d3ee]'
                : 'border-[#f4f1ea]/12 bg-[#141922] text-[#c7c2b8] hover:text-[#f4f1ea]'
            }`}
          >
            <Hammer className="h-3.5 w-3.5" />
            <span>{buildMode ? '3D Edit Mode: ON' : 'Enable 3D Point & Move'}</span>
          </button>

          <button
            id="btn-close-studio-drawer"
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-[#8a867e] hover:text-[#f4f1ea]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* ================================================================= */}
      {/* TAB 1: FURNITURE CATALOG & SELECTED ITEM INSPECTOR                */}
      {/* ================================================================= */}
      {activeTab === 'furniture' && (
        <div className="mt-3.5 grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Left: Spawn Catalog */}
          <div className="space-y-3 lg:col-span-7">
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ['seating', '🛋 Seating (Dynamic Seats)'],
                  ['tables', '☕ Tables & Rugs'],
                  ['decor', '🪴 Lamps & Props'],
                  ['wall', '🖼 Wall Posters & Neon'],
                ] as const
              ).map(([cat, label]) => (
                <button
                  key={cat}
                  id={`btn-cat-${cat}`}
                  type="button"
                  onClick={() => setCatFilter(cat)}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    catFilter === cat
                      ? 'bg-[#f4f1ea] text-[#080a0d]'
                      : 'bg-[#141922] text-[#c7c2b8] hover:text-[#f4f1ea]'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {FURNITURE_CATALOG.filter((c) => c.category === catFilter).map((entry) => (
                <button
                  key={entry.id}
                  id={`btn-spawn-${entry.id}`}
                  type="button"
                  onClick={() => onSpawnFurniture(entry.id)}
                  className="flex flex-col justify-between rounded-xl border border-[#f4f1ea]/10 bg-[#080a0d]/75 p-2.5 text-left transition hover:border-[#e5a93c]/60 hover:bg-[#121824]"
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-[#f4f1ea]">
                      {entry.shortLabel}
                    </span>
                    <Plus className="h-3.5 w-3.5 shrink-0 text-[#e5a93c]" />
                  </div>
                  <span className="mt-1 text-[11px] text-[#8a867e]">
                    {entry.seatSlots
                      ? `Adds ${entry.seatSlots.length} seat${entry.seatSlots.length > 1 ? 's' : ''}`
                      : entry.placementSurface === 'wall'
                        ? 'Mounts on walls'
                        : 'Floor decor'}
                  </span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-[#8a867e]">
              Tip: With <strong className="text-[#22d3ee]">3D Edit Mode ON</strong>, click
              any item in the 3D scene to select it, then click anywhere on the floor (or
              walls for posters/neon) to move it there instantly!
            </p>
          </div>

          {/* Right: Selected Item Inspector */}
          <div className="rounded-xl border border-[#f4f1ea]/10 bg-[#080a0d]/70 p-3.5 lg:col-span-5">
            {selectedItem && selectedEntry ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#f4f1ea]/10 pb-2">
                  <div>
                    <div className="text-xs font-semibold text-[#22d3ee]">
                      {selectedEntry.label}
                    </div>
                    <div className="font-mono text-[10px] text-[#8a867e]">
                      Pos ({selectedItem.position[0].toFixed(1)},{' '}
                      {selectedItem.position[2].toFixed(1)}) · Scale{' '}
                      {Math.round(selectedItem.scale * 100)}%
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onDuplicateFurnitureItem(selectedItem.id)}
                      className="rounded-lg border border-[#f4f1ea]/12 bg-[#141922] px-2 py-1 text-[11px] text-[#c7c2b8] hover:text-[#f4f1ea]"
                    >
                      Clone
                    </button>
                    <button
                      id="btn-delete-selected-furniture"
                      type="button"
                      onClick={() => onDeleteFurnitureItem(selectedItem.id)}
                      title="Delete item"
                      className="rounded-lg bg-[#e05a47]/20 p-1.5 text-[#e05a47] hover:bg-[#e05a47]/35"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                {/* Color Swatches + Custom Color Input */}
                <div>
                  <span className="flex items-center gap-1 text-[11px] font-medium text-[#c7c2b8]">
                    <Palette className="h-3 w-3 text-[#e5a93c]" /> Color &amp; Finish
                  </span>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {FURNITURE_COLOR_SWATCHES.map((sw) => (
                      <button
                        key={sw.hex}
                        type="button"
                        title={sw.name}
                        onClick={() =>
                          onUpdateFurnitureItem(selectedItem.id, { color: sw.hex })
                        }
                        className={`h-6 w-6 rounded-full border transition ${
                          selectedItem.color.toLowerCase() === sw.hex.toLowerCase()
                            ? 'scale-110 border-[#f4f1ea]'
                            : 'border-transparent opacity-80 hover:opacity-100'
                        }`}
                        style={{ backgroundColor: sw.hex }}
                      />
                    ))}
                    <input
                      aria-label="Custom item color"
                      type="color"
                      value={selectedItem.color}
                      onChange={(e) =>
                        onUpdateFurnitureItem(selectedItem.id, { color: e.target.value })
                      }
                      className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0"
                    />
                  </div>
                </div>

                {/* Rotation & Scale Sliders */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="flex justify-between text-[11px] text-[#c7c2b8]">
                      <span>Rotation</span>
                      <span className="font-mono">
                        {Math.round((selectedItem.rotationY * 180) / Math.PI)}°
                      </span>
                    </div>
                    <input
                      id="slider-furniture-rotation"
                      type="range"
                      min={-180}
                      max={180}
                      step={5}
                      value={Math.round((selectedItem.rotationY * 180) / Math.PI)}
                      onChange={(e) =>
                        onUpdateFurnitureItem(selectedItem.id, {
                          rotationY: Number(
                            ((Number(e.target.value) * Math.PI) / 180).toFixed(4),
                          ),
                        })
                      }
                      className="cinema-slider mt-1 w-full"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-[11px] text-[#c7c2b8]">
                      <span>Scale</span>
                      <span className="font-mono">
                        {Math.round(selectedItem.scale * 100)}%
                      </span>
                    </div>
                    <input
                      id="slider-furniture-scale"
                      type="range"
                      min={0.65}
                      max={1.55}
                      step={0.05}
                      value={selectedItem.scale}
                      onChange={(e) =>
                        onUpdateFurnitureItem(selectedItem.id, {
                          scale: Number(e.target.value),
                        })
                      }
                      className="cinema-slider mt-1 w-full"
                    />
                  </div>
                </div>

                {/* Poster Custom Image URL or Neon Sign Custom Text */}
                {selectedItem.type === 'wall-poster' && (
                  <div className="space-y-1.5 border-t border-[#f4f1ea]/10 pt-2">
                    <label className="block text-[11px] font-medium text-[#c7c2b8]">
                      Poster Artwork Preset or Custom Image URL
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {POSTER_ART_PRESETS.map((art) => (
                        <button
                          key={art.id}
                          type="button"
                          onClick={() =>
                            onUpdateFurnitureItem(selectedItem.id, {
                              imageUrl: art.id,
                              label: art.label,
                            })
                          }
                          className={`rounded-md px-2 py-0.5 text-[10px] font-medium ${
                            selectedItem.imageUrl === art.id
                              ? 'bg-[#e5a93c] text-[#080a0d]'
                              : 'bg-[#141922] text-[#c7c2b8]'
                          }`}
                        >
                          {art.label}
                        </button>
                      ))}
                    </div>
                    <input
                      id="input-poster-image-url"
                      type="url"
                      value={
                        selectedItem.imageUrl?.startsWith('preset:')
                          ? ''
                          : (selectedItem.imageUrl ?? '')
                      }
                      onChange={(e) =>
                        onUpdateFurnitureItem(selectedItem.id, {
                          imageUrl: e.target.value || 'preset:synthwave',
                        })
                      }
                      placeholder="https://example.com/poster.jpg (CORS-enabled)"
                      className="lounge-input w-full rounded-lg px-2.5 py-1.5 text-xs"
                    />
                  </div>
                )}

                {selectedItem.type === 'neon-sign' && (
                  <div className="space-y-1 border-t border-[#f4f1ea]/10 pt-2">
                    <label className="block text-[11px] font-medium text-[#c7c2b8]">
                      Neon Sign Text
                    </label>
                    <input
                      id="input-neon-sign-label"
                      type="text"
                      maxLength={16}
                      value={selectedItem.label ?? 'GOOD VIBES'}
                      onChange={(e) =>
                        onUpdateFurnitureItem(selectedItem.id, {
                          label: e.target.value.toUpperCase(),
                        })
                      }
                      className="lounge-input w-full rounded-lg px-2.5 py-1.5 font-mono text-xs uppercase"
                    />
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-xs font-medium text-[#c7c2b8]">
                  Placed Items ({furniture.length})
                </div>
                <div className="lounge-scrollbar max-h-44 space-y-1 overflow-y-auto pr-1">
                  {furniture.map((item) => {
                    const entry = getCatalogEntry(item.type)
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => onSelectFurniture(item.id)}
                        className="flex w-full items-center justify-between rounded-lg bg-[#121722] px-2.5 py-1.5 text-left text-xs text-[#c7c2b8] hover:bg-[#1a2232] hover:text-[#f4f1ea]"
                      >
                        <span className="flex items-center gap-2 truncate">
                          <span
                            className="h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="truncate">{entry.label}</span>
                        </span>
                        <span className="font-mono text-[10px] text-[#8a867e]">Edit</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 2: EXPANDABLE ROOM LAYOUT & ARCHITECTURAL STYLES              */}
      {/* ================================================================= */}
      {activeTab === 'layout' && (
        <div className="mt-3.5 space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {/* Room Size */}
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#8a867e]">
                Room Size Footprint
              </span>
              <div className="mt-1.5 space-y-1.5">
                {(['cozy', 'classic', 'grand'] as RoomSizePreset[]).map((sz) => (
                  <button
                    key={sz}
                    id={`btn-room-size-${sz}`}
                    type="button"
                    onClick={() => onUpdateArchitecture({ sizePreset: sz })}
                    className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs transition ${
                      architecture.sizePreset === sz
                        ? 'border-[#e5a93c] bg-[#e5a93c]/15 text-[#f4f1ea]'
                        : 'border-[#f4f1ea]/10 bg-[#080a0d]/70 text-[#c7c2b8] hover:border-[#f4f1ea]/25'
                    }`}
                  >
                    <span className="font-medium">{ROOM_SIZE_SPECS[sz].label}</span>
                    {architecture.sizePreset === sz && (
                      <Check className="h-3.5 w-3.5 text-[#e5a93c]" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Expandable Hangout Alcoves */}
            <div>
              <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#8a867e]">
                Expandable Hangout Areas
              </span>
              <div className="mt-1.5 space-y-1.5">
                <button
                  id="btn-toggle-left-alcove"
                  type="button"
                  onClick={() =>
                    onUpdateArchitecture({ leftBarAlcove: !architecture.leftBarAlcove })
                  }
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs transition ${
                    architecture.leftBarAlcove
                      ? 'border-[#22d3ee] bg-[#22d3ee]/12 text-[#f4f1ea]'
                      : 'border-[#f4f1ea]/10 bg-[#080a0d]/70 text-[#c7c2b8]'
                  }`}
                >
                  <span>🍹 Left Pub &amp; Bar Alcove</span>
                  <span className="font-mono text-[11px]">
                    {architecture.leftBarAlcove ? 'OPEN' : 'CLOSED'}
                  </span>
                </button>

                <button
                  id="btn-toggle-right-alcove"
                  type="button"
                  onClick={() =>
                    onUpdateArchitecture({
                      rightArcadeAlcove: !architecture.rightArcadeAlcove,
                    })
                  }
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs transition ${
                    architecture.rightArcadeAlcove
                      ? 'border-[#22d3ee] bg-[#22d3ee]/12 text-[#f4f1ea]'
                      : 'border-[#f4f1ea]/10 bg-[#080a0d]/70 text-[#c7c2b8]'
                  }`}
                >
                  <span>🕹 Right Arcade &amp; Chill Bay</span>
                  <span className="font-mono text-[11px]">
                    {architecture.rightArcadeAlcove ? 'OPEN' : 'CLOSED'}
                  </span>
                </button>

                <button
                  id="btn-toggle-rear-balcony"
                  type="button"
                  onClick={() =>
                    onUpdateArchitecture({ rearBalcony: !architecture.rearBalcony })
                  }
                  className={`flex w-full items-center justify-between rounded-xl border px-3 py-2 text-xs transition ${
                    architecture.rearBalcony
                      ? 'border-[#e5a93c] bg-[#e5a93c]/12 text-[#f4f1ea]'
                      : 'border-[#f4f1ea]/10 bg-[#080a0d]/70 text-[#c7c2b8]'
                  }`}
                >
                  <span>🛋 Elevated Stadium Riser</span>
                  <span className="font-mono text-[11px]">
                    {architecture.rearBalcony ? 'ON' : 'FLAT'}
                  </span>
                </button>
              </div>
            </div>

            {/* Ceiling + Blueprint Tools */}
            <div className="space-y-3">
              <div>
                <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#8a867e]">
                  Ceiling Architecture
                </span>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {CEILING_STYLES.map((cs: { id: CeilingStyleId; label: string }) => (
                    <button
                      key={cs.id}
                      type="button"
                      onClick={() => onUpdateArchitecture({ ceilingStyle: cs.id })}
                      className={`rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                        architecture.ceilingStyle === cs.id
                          ? 'bg-[#e5a93c] text-[#080a0d]'
                          : 'bg-[#141922] text-[#c7c2b8]'
                      }`}
                    >
                      {cs.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => void handleCopyBlueprint()}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#f4f1ea]/12 bg-[#141922] px-2.5 py-1.5 text-xs text-[#c7c2b8] hover:text-[#f4f1ea]"
                >
                  {copiedJson ? (
                    <Check className="h-3.5 w-3.5 text-[#49b384]" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span>{copiedJson ? 'Copied JSON' : 'Export JSON'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setImportOpen((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#f4f1ea]/12 bg-[#141922] px-2.5 py-1.5 text-xs text-[#c7c2b8] hover:text-[#f4f1ea]"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span>Import</span>
                </button>
                <button
                  id="btn-reset-room-default"
                  type="button"
                  onClick={onResetRoom}
                  className="inline-flex items-center gap-1 rounded-lg bg-[#e05a47]/15 px-2.5 py-1.5 text-xs text-[#e05a47] hover:bg-[#e05a47]/30"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Reset</span>
                </button>
              </div>
            </div>
          </div>

          {importOpen && (
            <div className="flex flex-col gap-2 rounded-xl border border-[#f4f1ea]/12 bg-[#080a0d]/85 p-3 sm:flex-row">
              <input
                type="text"
                value={importDraft}
                onChange={(e) => {
                  setImportError(null)
                  setImportDraft(e.target.value)
                }}
                placeholder="Paste exported VR Lounge room JSON here..."
                className="lounge-input flex-1 rounded-lg px-3 py-1.5 font-mono text-xs"
              />
              <button
                type="button"
                onClick={() => {
                  if (onImportBlueprintJson(importDraft)) {
                    setImportDraft('')
                    setImportOpen(false)
                  } else {
                    setImportError('Invalid room blueprint JSON.')
                  }
                }}
                className="rounded-lg bg-[#e5a93c] px-3 py-1.5 text-xs font-semibold text-[#080a0d]"
              >
                Load Blueprint
              </button>
              {importError && (
                <span className="self-center text-xs text-[#e05a47]">{importError}</span>
              )}
            </div>
          )}

          {/* Wall, Floor & Trim Material Palettes */}
          <div>
            <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#8a867e]">
              Wall, Floor &amp; Wood Finish Style
            </span>
            <div className="mt-1.5 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(Object.keys(ROOM_MATERIAL_THEMES) as RoomMaterialThemeId[]).map((th) => {
                const spec = ROOM_MATERIAL_THEMES[th]
                const active = architecture.materialTheme === th
                return (
                  <button
                    key={th}
                    id={`btn-theme-${th}`}
                    type="button"
                    onClick={() => onUpdateArchitecture({ materialTheme: th })}
                    className={`rounded-xl border p-2.5 text-left transition ${
                      active
                        ? 'border-[#e5a93c] bg-[#e5a93c]/12 text-[#f4f1ea]'
                        : 'border-[#f4f1ea]/10 bg-[#080a0d]/70 text-[#c7c2b8] hover:border-[#f4f1ea]/25'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-white/20"
                        style={{ backgroundColor: spec.wallColor }}
                      />
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-white/20"
                        style={{ backgroundColor: spec.slatColor }}
                      />
                      <span
                        className="h-3.5 w-3.5 rounded-full border border-white/20"
                        style={{ backgroundColor: spec.floorColor }}
                      />
                    </div>
                    <div className="mt-1.5 text-xs font-semibold">{spec.shortLabel}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 3: MAIN SCREEN POSITION, SCALE & CURVATURE                    */}
      {/* ================================================================= */}
      {activeTab === 'screen' && (
        <div className="mt-3.5 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-[#c7c2b8]">
                <span>Screen Size Scale</span>
                <span className="font-mono text-[#e5a93c]">
                  {Math.round(screen.scale * 100)}%
                </span>
              </div>
              <input
                id="slider-screen-scale"
                type="range"
                min={0.65}
                max={1.55}
                step={0.05}
                value={screen.scale}
                onChange={(e) => onUpdateScreen({ scale: Number(e.target.value) })}
                className="cinema-slider mt-1.5 w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-[#c7c2b8]">
                <span>Horizontal Offset (X)</span>
                <span className="font-mono">{screen.position[0].toFixed(2)}m</span>
              </div>
              <input
                id="slider-screen-x"
                type="range"
                min={-5}
                max={5}
                step={0.2}
                value={screen.position[0]}
                onChange={(e) =>
                  onUpdateScreen({
                    position: [
                      Number(e.target.value),
                      screen.position[1],
                      screen.position[2],
                    ],
                  })
                }
                className="cinema-slider mt-1.5 w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-[#c7c2b8]">
                <span>Elevation Height (Y)</span>
                <span className="font-mono">{screen.position[1].toFixed(2)}m</span>
              </div>
              <input
                id="slider-screen-y"
                type="range"
                min={1.8}
                max={4.6}
                step={0.1}
                value={screen.position[1]}
                onChange={(e) =>
                  onUpdateScreen({
                    position: [
                      screen.position[0],
                      Number(e.target.value),
                      screen.position[2],
                    ],
                  })
                }
                className="cinema-slider mt-1.5 w-full"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs text-[#c7c2b8]">
                <span>Room Depth (Z)</span>
                <span className="font-mono">{screen.position[2].toFixed(2)}m</span>
              </div>
              <input
                id="slider-screen-z"
                type="range"
                min={-9.0}
                max={-2.2}
                step={0.2}
                value={screen.position[2]}
                onChange={(e) =>
                  onUpdateScreen({
                    position: [
                      screen.position[0],
                      screen.position[1],
                      Number(e.target.value),
                    ],
                  })
                }
                className="cinema-slider mt-1.5 w-full"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs text-[#c7c2b8]">
                <span>Swivel Angle (Yaw)</span>
                <span className="font-mono">
                  {Math.round((screen.rotationY * 180) / Math.PI)}°
                </span>
              </div>
              <input
                id="slider-screen-yaw"
                type="range"
                min={-65}
                max={65}
                step={5}
                value={Math.round((screen.rotationY * 180) / Math.PI)}
                onChange={(e) =>
                  onUpdateScreen({
                    rotationY: Number(
                      ((Number(e.target.value) * Math.PI) / 180).toFixed(4),
                    ),
                  })
                }
                className="cinema-slider mt-1.5 w-full"
              />
            </div>

            <div className="flex items-center gap-2 pt-2">
              <button
                id="btn-toggle-screen-curve"
                type="button"
                onClick={() => onUpdateScreen({ curved: !screen.curved })}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-medium transition ${
                  screen.curved
                    ? 'border-[#e5a93c] bg-[#e5a93c]/15 text-[#f4f1ea]'
                    : 'border-[#f4f1ea]/12 bg-[#141922] text-[#c7c2b8]'
                }`}
              >
                {screen.curved ? 'Curved IMAX Geometry' : 'Flat Cinema Wall'}
              </button>

              <button
                id="btn-reset-screen-transform"
                type="button"
                onClick={() =>
                  onUpdateScreen({
                    position: [0, 3.05, -6.45],
                    rotationY: 0,
                    scale: 1,
                    curved: true,
                  })
                }
                className="rounded-xl border border-[#f4f1ea]/12 bg-[#141922] px-3 py-2 text-xs text-[#c7c2b8] hover:text-[#f4f1ea]"
              >
                Reset Screen
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* TAB 4: MOOD LIGHTING & PLAYBACK AUTO-DIM                          */}
      {/* ================================================================= */}
      {activeTab === 'mood' && (
        <div className="mt-3.5 space-y-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {(Object.keys(LIGHTING_PRESETS) as LightingPresetId[]).map((pid) => {
              const spec = LIGHTING_PRESETS[pid]
              const active = lighting.preset === pid
              return (
                <button
                  key={pid}
                  id={`btn-lighting-preset-${pid}`}
                  type="button"
                  onClick={() => onApplyLightingPreset(pid)}
                  className={`rounded-xl border px-3 py-2.5 text-left text-xs font-semibold transition ${
                    active
                      ? 'border-[#e5a93c] bg-[#e5a93c]/15 text-[#f4f1ea]'
                      : 'border-[#f4f1ea]/10 bg-[#080a0d]/70 text-[#c7c2b8] hover:border-[#f4f1ea]/25'
                  }`}
                >
                  {spec.label}
                </button>
              )
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <div className="flex justify-between text-xs text-[#c7c2b8]">
                <span>Master Brightness</span>
                <span className="font-mono">{Math.round(lighting.brightness * 100)}%</span>
              </div>
              <input
                id="slider-room-brightness"
                type="range"
                min={0.15}
                max={1.8}
                step={0.05}
                value={lighting.brightness}
                onChange={(e) =>
                  onUpdateLighting({ brightness: Number(e.target.value) })
                }
                className="cinema-slider mt-1.5 w-full"
              />
            </div>

            <div className="flex items-center gap-3">
              <div>
                <label className="block text-xs text-[#c7c2b8]">Accent / Sconces</label>
                <input
                  id="input-lighting-accent-color"
                  type="color"
                  value={lighting.accentColor}
                  onChange={(e) => onUpdateLighting({ accentColor: e.target.value })}
                  className="mt-1 h-8 w-14 cursor-pointer rounded border border-[#f4f1ea]/15 bg-transparent"
                />
              </div>
              <div>
                <label className="block text-xs text-[#c7c2b8]">Ambient Tint</label>
                <input
                  id="input-lighting-ambient-color"
                  type="color"
                  value={lighting.ambientTint}
                  onChange={(e) => onUpdateLighting({ ambientTint: e.target.value })}
                  className="mt-1 h-8 w-14 cursor-pointer rounded border border-[#f4f1ea]/15 bg-transparent"
                />
              </div>
            </div>

            <div className="flex items-center">
              <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-[#f4f1ea]/10 bg-[#080a0d]/70 px-3.5 py-2.5 text-xs text-[#f4f1ea]">
                <input
                  id="checkbox-auto-dim-on-play"
                  type="checkbox"
                  checked={lighting.autoDimOnPlay}
                  onChange={(e) =>
                    onUpdateLighting({ autoDimOnPlay: e.target.checked })
                  }
                  className="accent-[#e5a93c]"
                />
                <span>
                  Automatically dim room lights when video or browser stream plays
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
