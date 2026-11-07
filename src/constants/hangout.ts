import type {
  CeilingStyleId,
  ComputedSeat,
  FurnitureCatalogId,
  FurnitureCategory,
  LightingPresetId,
  PlacedFurnitureItem,
  RoomCustomizationState,
  RoomMaterialThemeId,
  RoomSizePreset,
} from '../types/lounge'
import { SCREEN_CONFIG } from './cinema'

export interface RoomSizeSpec {
  id: RoomSizePreset
  label: string
  shortLabel: string
  width: number
  depth: number
  height: number
  frontZ: number
  backZ: number
  balconyZ: number
}

export const ROOM_SIZE_SPECS: Record<RoomSizePreset, RoomSizeSpec> = {
  cozy: {
    id: 'cozy',
    label: 'Cozy Den (13×14m)',
    shortLabel: 'Cozy Den',
    width: 13.0,
    depth: 13.8,
    height: 5.5,
    frontZ: -6.9,
    backZ: 6.1,
    balconyZ: 3.1,
  },
  classic: {
    id: 'classic',
    label: 'Classic Lounge (15×16m)',
    shortLabel: 'Classic',
    width: 15.2,
    depth: 16.0,
    height: 6.3,
    frontZ: -7.6,
    backZ: 6.6,
    balconyZ: 3.25,
  },
  grand: {
    id: 'grand',
    label: 'Grand Loft (20×21m)',
    shortLabel: 'Grand Loft',
    width: 20.0,
    depth: 21.0,
    height: 7.1,
    frontZ: -9.4,
    backZ: 8.8,
    balconyZ: 4.5,
  },
}

export interface RoomMaterialThemeSpec {
  id: RoomMaterialThemeId
  label: string
  shortLabel: string
  floorColor: string
  floorRoughness: number
  wallColor: string
  backWallColor: string
  ceilingColor: string
  slatColor: string
  riserColor: string
  rugDefaultColor: string
}

export const ROOM_MATERIAL_THEMES: Record<RoomMaterialThemeId, RoomMaterialThemeSpec> = {
  'obsidian-theater': {
    id: 'obsidian-theater',
    label: 'Obsidian Cinema',
    shortLabel: 'Obsidian',
    floorColor: '#10151E',
    floorRoughness: 0.92,
    wallColor: '#111722',
    backWallColor: '#0D1118',
    ceilingColor: '#0A0E15',
    slatColor: '#241D17',
    riserColor: '#151B26',
    rugDefaultColor: '#18202E',
  },
  'walnut-velvet': {
    id: 'walnut-velvet',
    label: 'Warm Walnut & Velvet',
    shortLabel: 'Walnut',
    floorColor: '#221813',
    floorRoughness: 0.74,
    wallColor: '#2B1F1B',
    backWallColor: '#1E1512',
    ceilingColor: '#16100E',
    slatColor: '#432E21',
    riserColor: '#2A1D18',
    rugDefaultColor: '#4A1E28',
  },
  'industrial-loft': {
    id: 'industrial-loft',
    label: 'Industrial Brick & Oak',
    shortLabel: 'Loft Brick',
    floorColor: '#2B2219',
    floorRoughness: 0.68,
    wallColor: '#26282E',
    backWallColor: '#1C1E24',
    ceilingColor: '#16181D',
    slatColor: '#3B2B23',
    riserColor: '#21242B',
    rugDefaultColor: '#293241',
  },
  'neon-cyber': {
    id: 'neon-cyber',
    label: 'Midnight Synthwave',
    shortLabel: 'Neon Club',
    floorColor: '#0B0D18',
    floorRoughness: 0.48,
    wallColor: '#121328',
    backWallColor: '#090A16',
    ceilingColor: '#070812',
    slatColor: '#1F1B3A',
    riserColor: '#14162E',
    rugDefaultColor: '#231942',
  },
  'nordic-oak': {
    id: 'nordic-oak',
    label: 'Nordic Timber & Slate',
    shortLabel: 'Nordic',
    floorColor: '#3A3128',
    floorRoughness: 0.76,
    wallColor: '#2B313B',
    backWallColor: '#222730',
    ceilingColor: '#1D222B',
    slatColor: '#5C4835',
    riserColor: '#313742',
    rugDefaultColor: '#334155',
  },
}

export const CEILING_STYLES: ReadonlyArray<{ id: CeilingStyleId; label: string }> = [
  { id: 'coffered', label: 'Acoustic Coffer' },
  { id: 'skylight-stars', label: 'Starlight Skylight' },
  { id: 'industrial-beams', label: 'Loft Timber Beams' },
]

export interface LightingPresetSpec {
  id: LightingPresetId
  label: string
  shortLabel: string
  brightness: number
  accentColor: string
  ambientTint: string
  skyBg: string
}

export const LIGHTING_PRESETS: Record<LightingPresetId, LightingPresetSpec> = {
  movie: {
    id: 'movie',
    label: '🎬 Movie Mode',
    shortLabel: 'Movie',
    brightness: 0.48,
    accentColor: '#E5A93C',
    ambientTint: '#9DB4DA',
    skyBg: '#090C14',
  },
  cozy: {
    id: 'cozy',
    label: '🛋 Cozy Hangout',
    shortLabel: 'Cozy',
    brightness: 1.05,
    accentColor: '#F4A261',
    ambientTint: '#FFE3C2',
    skyBg: '#121622',
  },
  'neon-pub': {
    id: 'neon-pub',
    label: '🔮 Neon / Pub',
    shortLabel: 'Neon Pub',
    brightness: 0.92,
    accentColor: '#EC4899',
    ambientTint: '#38BDF8',
    skyBg: '#0E0B1E',
  },
  'midnight-lofi': {
    id: 'midnight-lofi',
    label: '🌙 Midnight Lo-Fi',
    shortLabel: 'Lo-Fi',
    brightness: 0.76,
    accentColor: '#A855F7',
    ambientTint: '#818CF8',
    skyBg: '#0D1021',
  },
  daylight: {
    id: 'daylight',
    label: '☀️ Bright Studio',
    shortLabel: 'Bright',
    brightness: 1.45,
    accentColor: '#38BDF8',
    ambientTint: '#F1F5F9',
    skyBg: '#1A2334',
  },
}

export const FURNITURE_COLOR_SWATCHES = [
  { name: 'Slate Navy', hex: '#232D3F' },
  { name: 'Warm Charcoal', hex: '#2B2B30' },
  { name: 'Cognac Leather', hex: '#7C4427' },
  { name: 'Emerald Velvet', hex: '#1F5647' },
  { name: 'Burgundy Wine', hex: '#5E2133' },
  { name: 'Amber Gold', hex: '#D99326' },
  { name: 'Neon Magenta', hex: '#DB2777' },
  { name: 'Nordic Cream', hex: '#A8A29E' },
] as const

export const POSTER_ART_PRESETS = [
  { id: 'preset:synthwave', label: 'Synthwave Horizon' },
  { id: 'preset:cosmos', label: 'Deep Space Odyssey' },
  { id: 'preset:lofi', label: 'Midnight Vinyl Club' },
  { id: 'preset:arcade', label: 'Retro Arcade 1986' },
] as const

export interface SeatSlotOffset {
  localPos: [number, number, number]
  localRotY: number
  seatHeightOffset: number
  suffix: string
}

export interface FurnitureCatalogEntry {
  id: FurnitureCatalogId
  label: string
  shortLabel: string
  category: FurnitureCategory
  placementSurface: 'floor' | 'wall'
  defaultColor: string
  defaultLabel?: string
  defaultImageUrl?: string
  seatSlots?: ReadonlyArray<SeatSlotOffset>
}

export const FURNITURE_CATALOG: ReadonlyArray<FurnitureCatalogEntry> = [
  {
    id: 'sofa-3',
    label: '3-Seat Plush Sofa',
    shortLabel: '3-Seat Sofa',
    category: 'seating',
    placementSurface: 'floor',
    defaultColor: '#232D3F',
    seatSlots: [
      { localPos: [-0.82, 0, 0], localRotY: 0, seatHeightOffset: 0, suffix: 'Left' },
      { localPos: [0, 0, 0], localRotY: 0, seatHeightOffset: 0, suffix: 'Center' },
      { localPos: [0.82, 0, 0], localRotY: 0, seatHeightOffset: 0, suffix: 'Right' },
    ],
  },
  {
    id: 'loveseat-2',
    label: '2-Seat Cozy Loveseat',
    shortLabel: 'Loveseat',
    category: 'seating',
    placementSurface: 'floor',
    defaultColor: '#5E2133',
    seatSlots: [
      { localPos: [-0.46, 0, 0], localRotY: 0, seatHeightOffset: 0, suffix: 'Left' },
      { localPos: [0.46, 0, 0], localRotY: 0, seatHeightOffset: 0, suffix: 'Right' },
    ],
  },
  {
    id: 'armchair',
    label: 'Club Lounge Armchair',
    shortLabel: 'Armchair',
    category: 'seating',
    placementSurface: 'floor',
    defaultColor: '#7C4427',
    seatSlots: [
      { localPos: [0, 0, 0], localRotY: 0, seatHeightOffset: 0, suffix: 'Seat' },
    ],
  },
  {
    id: 'beanbag',
    label: 'Plush Beanbag Lounger',
    shortLabel: 'Beanbag',
    category: 'seating',
    placementSurface: 'floor',
    defaultColor: '#1F5647',
    seatSlots: [
      { localPos: [0, 0, 0], localRotY: 0, seatHeightOffset: -0.14, suffix: 'Lounger' },
    ],
  },
  {
    id: 'barstool',
    label: 'High Pub Barstool',
    shortLabel: 'Barstool',
    category: 'seating',
    placementSurface: 'floor',
    defaultColor: '#D99326',
    seatSlots: [
      { localPos: [0, 0, 0], localRotY: 0, seatHeightOffset: 0.28, suffix: 'Stool' },
    ],
  },
  {
    id: 'coffee-table',
    label: 'Walnut Coffee Table',
    shortLabel: 'Coffee Table',
    category: 'tables',
    placementSurface: 'floor',
    defaultColor: '#2B2B30',
  },
  {
    id: 'bar-counter',
    label: 'LED Lounge Bar Counter',
    shortLabel: 'Bar Counter',
    category: 'tables',
    placementSurface: 'floor',
    defaultColor: '#232D3F',
  },
  {
    id: 'rug-plush',
    label: 'Woven Area Rug',
    shortLabel: 'Area Rug',
    category: 'tables',
    placementSurface: 'floor',
    defaultColor: '#1F293B',
  },
  {
    id: 'plant-monstera',
    label: 'Monstera Potted Plant',
    shortLabel: 'Monstera Plant',
    category: 'decor',
    placementSurface: 'floor',
    defaultColor: '#1F5647',
  },
  {
    id: 'lamp-floor',
    label: 'Warm Tripod Floor Lamp',
    shortLabel: 'Floor Lamp',
    category: 'decor',
    placementSurface: 'floor',
    defaultColor: '#D99326',
  },
  {
    id: 'popcorn-cart',
    label: 'Vintage Popcorn Cart',
    shortLabel: 'Popcorn Cart',
    category: 'decor',
    placementSurface: 'floor',
    defaultColor: '#B91C1C',
  },
  {
    id: 'arcade-cabinet',
    label: 'Retro Arcade Machine',
    shortLabel: 'Arcade Cab',
    category: 'decor',
    placementSurface: 'floor',
    defaultColor: '#7C3AED',
  },
  {
    id: 'wall-poster',
    label: 'Framed Wall Poster / Image',
    shortLabel: 'Wall Poster',
    category: 'wall',
    placementSurface: 'wall',
    defaultColor: '#232D3F',
    defaultImageUrl: 'preset:synthwave',
    defaultLabel: 'Synthwave Horizon',
  },
  {
    id: 'neon-sign',
    label: 'Glowing Neon Wall Sign',
    shortLabel: 'Neon Sign',
    category: 'wall',
    placementSurface: 'wall',
    defaultColor: '#DB2777',
    defaultLabel: 'GOOD VIBES',
  },
]

export function getCatalogEntry(type: FurnitureCatalogId): FurnitureCatalogEntry {
  return FURNITURE_CATALOG.find((item) => item.id === type) ?? FURNITURE_CATALOG[0]
}

export function createDefaultFurnitureLayout(): PlacedFurnitureItem[] {
  return [
    {
      id: 'furn-rug-center',
      type: 'rug-plush',
      position: [0, 0.005, 0.25],
      rotationY: 0,
      scale: 1.15,
      color: '#1A2436',
    },
    {
      id: 'furn-table-center',
      type: 'coffee-table',
      position: [0, 0, -1.35],
      rotationY: 0,
      scale: 1,
      color: '#2B2B30',
    },
    {
      id: 'furn-sofa-front',
      type: 'sofa-3',
      position: [0, 0, 0.45],
      rotationY: 0,
      scale: 1,
      color: '#232D3F',
    },
    {
      id: 'furn-chair-front-left',
      type: 'armchair',
      position: [-2.45, 0, -0.05],
      rotationY: -0.34,
      scale: 1,
      color: '#7C4427',
    },
    {
      id: 'furn-chair-front-right',
      type: 'armchair',
      position: [2.45, 0, -0.05],
      rotationY: 0.34,
      scale: 1,
      color: '#7C4427',
    },
    {
      id: 'furn-sofa-back-left',
      type: 'loveseat-2',
      position: [-1.55, 0.38, 3.2],
      rotationY: -0.14,
      scale: 1,
      color: '#5E2133',
    },
    {
      id: 'furn-sofa-back-right',
      type: 'loveseat-2',
      position: [1.55, 0.38, 3.2],
      rotationY: 0.14,
      scale: 1,
      color: '#5E2133',
    },
    {
      id: 'furn-lamp-left',
      type: 'lamp-floor',
      position: [-3.65, 0, -0.8],
      rotationY: 0.3,
      scale: 1,
      color: '#E5A93C',
    },
    {
      id: 'furn-lamp-right',
      type: 'lamp-floor',
      position: [3.65, 0, -0.8],
      rotationY: -0.3,
      scale: 1,
      color: '#E5A93C',
    },
    {
      id: 'furn-plant-left',
      type: 'plant-monstera',
      position: [-5.3, 0, -5.2],
      rotationY: 0.4,
      scale: 1.1,
      color: '#1F5647',
    },
    {
      id: 'furn-plant-right',
      type: 'plant-monstera',
      position: [5.3, 0, -5.2],
      rotationY: -0.4,
      scale: 1.1,
      color: '#1F5647',
    },
    {
      id: 'furn-poster-left',
      type: 'wall-poster',
      position: [-7.48, 2.85, -1.6],
      rotationY: Math.PI / 2,
      scale: 1,
      color: '#232D3F',
      imageUrl: 'preset:synthwave',
      label: 'Synthwave Horizon',
    },
    {
      id: 'furn-poster-right',
      type: 'wall-poster',
      position: [7.48, 2.85, -1.6],
      rotationY: -Math.PI / 2,
      scale: 1,
      color: '#232D3F',
      imageUrl: 'preset:cosmos',
      label: 'Deep Space Odyssey',
    },
  ]
}

export function createDefaultRoomCustomization(): RoomCustomizationState {
  return {
    revision: 0,
    updatedAt: 0,
    updatedBy: 'System',
    architecture: {
      sizePreset: 'classic',
      materialTheme: 'obsidian-theater',
      ceilingStyle: 'coffered',
      leftBarAlcove: false,
      rightArcadeAlcove: false,
      rearBalcony: true,
    },
    lighting: {
      preset: 'cozy',
      brightness: 1.0,
      accentColor: '#E5A93C',
      ambientTint: '#DCE4F5',
      autoDimOnPlay: true,
    },
    screen: {
      position: [...SCREEN_CONFIG.center],
      rotationY: 0,
      scale: 1.0,
      curved: true,
    },
    furniture: createDefaultFurnitureLayout(),
  }
}

/**
 * Computes world-space interactive seats attached to all seating furniture
 * currently placed in the room. Automatically follows moved, rotated, or
 * scaled sofas, armchairs, beanbags, and barstools.
 */
export function computeRoomSeats(customization: RoomCustomizationState): ComputedSeat[] {
  const seats: ComputedSeat[] = []
  const sizeSpec = ROOM_SIZE_SPECS[customization.architecture.sizePreset] ?? ROOM_SIZE_SPECS.classic
  const hasBalcony = customization.architecture.rearBalcony

  // Count how many items of each type exist for clean human-readable seat labels
  const typeCounts = new Map<FurnitureCatalogId, number>()

  for (const item of customization.furniture) {
    const entry = FURNITURE_CATALOG.find((c) => c.id === item.type)
    if (!entry?.seatSlots || entry.seatSlots.length === 0) continue

    const itemNum = (typeCounts.get(item.type) ?? 0) + 1
    typeCounts.set(item.type, itemNum)

    const cos = Math.cos(item.rotationY)
    const sin = Math.sin(item.rotationY)
    const itemScale = Math.max(0.6, Math.min(1.6, item.scale || 1))

    // Automatically adjust floor Y if rearBalcony was toggled on/off
    const onBalconyFootprint =
      hasBalcony &&
      Math.abs(item.position[0]) < 4.7 &&
      item.position[2] > sizeSpec.balconyZ - 1.65 &&
      item.position[2] < sizeSpec.balconyZ + 1.65
    const baseFloorY = onBalconyFootprint ? 0.38 : 0

    for (let slotIdx = 0; slotIdx < entry.seatSlots.length; slotIdx++) {
      const slot = entry.seatSlots[slotIdx]
      const lx = slot.localPos[0] * itemScale
      const lz = slot.localPos[2] * itemScale

      const wx = item.position[0] + lx * cos + lz * sin
      const wz = item.position[2] - lx * sin + lz * cos
      const wy = baseFloorY + slot.localPos[1] * itemScale

      const seatLabel =
        entry.seatSlots.length > 1
          ? `${entry.shortLabel} ${itemNum} · ${slot.suffix}`
          : `${entry.shortLabel} ${itemNum}`

      seats.push({
        id: `${item.id}:${slotIdx}`,
        index: seats.length,
        furnitureId: item.id,
        furnitureType: item.type,
        label: seatLabel,
        position: [Number(wx.toFixed(3)), Number(wy.toFixed(3)), Number(wz.toFixed(3))],
        localCushionOffset: slot.localPos,
        seatHeightOffset: slot.seatHeightOffset * itemScale,
        rotationY: item.rotationY + slot.localRotY,
      })
    }
  }

  // Fallback standing/floor spots if every piece of seating was deleted
  if (seats.length === 0) {
    const fallbackSpots: Array<[number, number, number]> = [
      [-1.2, 0, 0.6],
      [0, 0, 0.6],
      [1.2, 0, 0.6],
      [0, 0, 2.4],
    ]
    fallbackSpots.forEach((pos, idx) => {
      seats.push({
        id: `fallback:${idx}`,
        index: idx,
        furnitureId: 'fallback',
        furnitureType: 'fallback',
        label: `Lounge Spot ${idx + 1}`,
        position: pos,
        localCushionOffset: [0, 0, 0],
        seatHeightOffset: 0,
        rotationY: 0,
      })
    })
  }

  return seats
}
