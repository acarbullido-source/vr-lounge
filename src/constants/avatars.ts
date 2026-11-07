import type {
  AvatarAccessoryId,
  AvatarCustomization,
  AvatarFaceId,
  AvatarHatId,
  AvatarOutfitId,
  AvatarStyleId,
} from '../types/lounge'

export const AVATAR_COLORS = [
  { name: 'Tungsten Amber', hex: '#E5A93C' },
  { name: 'Cinema Vermilion', hex: '#E05A47' },
  { name: 'Glacier Teal', hex: '#3FB8AF' },
  { name: 'Sage Jade', hex: '#52B788' },
  { name: 'Cobalt Horizon', hex: '#4A8FE7' },
  { name: 'Warm Copper', hex: '#D97B43' },
  { name: 'Champagne Ivory', hex: '#DFD5C0' },
  { name: 'Crimson Velvet', hex: '#C84B61' },
  { name: 'Electric Violet', hex: '#A855F7' },
  { name: 'Cyber Lime', hex: '#84CC16' },
  { name: 'Sakura Pink', hex: '#F472B6' },
  { name: 'Arctic Cyan', hex: '#22D3EE' },
] as const

export const AVATAR_BODY_COLORS = [
  { name: 'Obsidian Slate', hex: '#181F2B' },
  { name: 'Midnight Navy', hex: '#172554' },
  { name: 'Charcoal Graphite', hex: '#27272A' },
  { name: 'Pearl Frost', hex: '#CBD5E1' },
  { name: 'Crimson Varsity', hex: '#7F1D1D' },
  { name: 'Forest Pine', hex: '#14532D' },
  { name: 'Royal Plum', hex: '#4C1D95' },
  { name: 'Espresso Walnut', hex: '#451A03' },
  { name: 'Sunset Rust', hex: '#9A3412' },
  { name: 'Deep Lagoon', hex: '#134E4A' },
] as const

export const AVATAR_STYLES: ReadonlyArray<{
  id: AvatarStyleId
  label: string
  tagline: string
  icon: string
}> = [
  {
    id: 'visor-classic',
    label: 'Quest Proline',
    tagline: 'Curved anodized visor',
    icon: '🥽',
  },
  {
    id: 'visor-sleek',
    label: 'Cyber Ninja',
    tagline: 'Angular blade wrap & fins',
    icon: '⚡',
  },
  {
    id: 'visor-halo',
    label: 'Crown Halo',
    tagline: 'Dual-ring floating band',
    icon: '🪐',
  },
  {
    id: 'visor-studio',
    label: 'DJ Studio',
    tagline: 'Over-ear spatial cans & mic',
    icon: '🎧',
  },
  {
    id: 'bot-retro',
    label: 'Retro CRT Bot',
    tagline: 'Vintage monitor & antenna',
    icon: '📺',
  },
  {
    id: 'astro-dome',
    label: 'Space Explorer',
    tagline: 'Tinted bubble helmet & ring',
    icon: '🧑‍🚀',
  },
  {
    id: 'cat-ears',
    label: 'Neko Synth',
    tagline: 'Glowing neon cat-ear cans',
    icon: '🐱',
  },
  {
    id: 'knight-helm',
    label: 'Starlight Knight',
    tagline: 'Crested sci-fi paladin visor',
    icon: '🛡️',
  },
] as const

export const AVATAR_FACES: ReadonlyArray<{
  id: AvatarFaceId
  label: string
  glyph: string
}> = [
  { id: 'visor-led', label: 'LED Gaze', glyph: '● ●' },
  { id: 'happy-pixel', label: 'Happy Arc', glyph: '^ ^' },
  { id: 'cool-shades', label: 'Cool Shades', glyph: '🕶️' },
  { id: 'starry', label: 'Starlight', glyph: '✦ ✦' },
  { id: 'cyber-scan', label: 'KITT Scanner', glyph: '━━━' },
  { id: 'wink', label: 'Playful Wink', glyph: '^ -' },
  { id: 'minimal', label: 'Stealth Glass', glyph: '───' },
] as const

export const AVATAR_HATS: ReadonlyArray<{
  id: AvatarHatId
  label: string
  icon: string
}> = [
  { id: 'none', label: 'No Hat', icon: '✕' },
  { id: 'beanie', label: 'Slouch Beanie', icon: '🧶' },
  { id: 'baseball-cap', label: 'Clubhouse Cap', icon: '🧢' },
  { id: 'crown', label: 'VIP Crown', icon: '👑' },
  { id: 'cowboy', label: 'Sheriff Hat', icon: '🤠' },
  { id: 'wizard', label: 'Tabletop Mage', icon: '🧙' },
  { id: 'top-hat', label: 'Cinema Tux Hat', icon: '🎩' },
  { id: 'party-cone', label: 'Watch-Party', icon: '🎉' },
] as const

export const AVATAR_OUTFITS: ReadonlyArray<{
  id: AvatarOutfitId
  label: string
  tagline: string
  icon: string
}> = [
  { id: 'hoodie', label: 'Cozy Hoodie', tagline: 'Hood collar & pouch', icon: '🧥' },
  { id: 'varsity', label: 'Club Varsity', tagline: 'Contrast sleeves & badge', icon: '⚾' },
  { id: 'cyber-vest', label: 'Neon Tech Vest', tagline: 'High collar & chest core', icon: '🔋' },
  { id: 'tuxedo', label: 'Premiere Tux', tagline: 'Crisp lapels & bow tie', icon: '🤵' },
  { id: 'astronaut', label: 'EVA Flight Rig', tagline: 'Space chest pack', icon: '🚀' },
  { id: 'cloak', label: 'D&D Mantle', tagline: 'Draped cape & gold clasp', icon: '🗡️' },
] as const

export const AVATAR_ACCESSORIES: ReadonlyArray<{
  id: AvatarAccessoryId
  label: string
  icon: string
}> = [
  { id: 'none', label: 'None', icon: '✕' },
  { id: 'shoulder-drone', label: 'Mini Companion', icon: '🛸' },
  { id: 'orbit-rings', label: 'Orbit Satellites', icon: '✨' },
  { id: 'vip-halo', label: 'Floor Aura', icon: '💫' },
  { id: 'bowtie', label: 'Collar Emblem', icon: '🎀' },
] as const

export const AVATAR_FLAIR_BADGES: ReadonlyArray<{
  emoji: string
  label: string
}> = [
  { emoji: '', label: 'None' },
  { emoji: '🍿', label: 'Movie Buff' },
  { emoji: '🎯', label: 'Darts Ace' },
  { emoji: '⛳', label: 'Putt Boss' },
  { emoji: '🎲', label: 'High Roller' },
  { emoji: '👑', label: 'Club VIP' },
  { emoji: '🔥', label: 'On Fire' },
  { emoji: '🎸', label: 'Night Owl' },
  { emoji: '🚀', label: 'Explorer' },
  { emoji: '🧙', label: 'Dungeon Master' },
] as const

export interface AvatarPresetDefinition {
  id: string
  label: string
  tagline: string
  icon: string
  avatarColor: string
  avatarStyle: AvatarStyleId
  customization: AvatarCustomization
}

export const DEFAULT_AVATAR_CUSTOMIZATION: AvatarCustomization = {
  bodyColor: '#181F2B',
  faceStyle: 'visor-led',
  hat: 'none',
  outfit: 'hoodie',
  accessory: 'none',
  flairEmoji: '',
}

export const AVATAR_PRESETS: readonly AvatarPresetDefinition[] = [
  {
    id: 'cinema-pro',
    label: 'Lounge Regular',
    tagline: 'Cozy hoodie + LED visor',
    icon: '🍿',
    avatarColor: '#E5A93C',
    avatarStyle: 'visor-classic',
    customization: {
      bodyColor: '#181F2B',
      faceStyle: 'visor-led',
      hat: 'beanie',
      outfit: 'hoodie',
      accessory: 'none',
      flairEmoji: '🍿',
    },
  },
  {
    id: 'club-champ',
    label: 'Clubhouse VIP',
    tagline: 'Royal crown + varsity jacket',
    icon: '👑',
    avatarColor: '#E5A93C',
    avatarStyle: 'visor-sleek',
    customization: {
      bodyColor: '#7F1D1D',
      faceStyle: 'cool-shades',
      hat: 'crown',
      outfit: 'varsity',
      accessory: 'vip-halo',
      flairEmoji: '👑',
    },
  },
  {
    id: 'tabletop-mage',
    label: 'Tabletop Wizard',
    tagline: 'Wizard hat + D&D cloak',
    icon: '🧙',
    avatarColor: '#A855F7',
    avatarStyle: 'visor-halo',
    customization: {
      bodyColor: '#4C1D95',
      faceStyle: 'starry',
      hat: 'wizard',
      outfit: 'cloak',
      accessory: 'orbit-rings',
      flairEmoji: '🎲',
    },
  },
  {
    id: 'retro-crt',
    label: 'Retro CRT Bot',
    tagline: 'TV monitor head + mini drone',
    icon: '📺',
    avatarColor: '#52B788',
    avatarStyle: 'bot-retro',
    customization: {
      bodyColor: '#27272A',
      faceStyle: 'happy-pixel',
      hat: 'none',
      outfit: 'cyber-vest',
      accessory: 'shoulder-drone',
      flairEmoji: '🔥',
    },
  },
  {
    id: 'neko-dj',
    label: 'Neko Synth DJ',
    tagline: 'Neon cat ears + cyber jacket',
    icon: '🐱',
    avatarColor: '#F472B6',
    avatarStyle: 'cat-ears',
    customization: {
      bodyColor: '#172554',
      faceStyle: 'wink',
      hat: 'none',
      outfit: 'cyber-vest',
      accessory: 'orbit-rings',
      flairEmoji: '🎸',
    },
  },
  {
    id: 'space-ranger',
    label: 'Space Explorer',
    tagline: 'Bubble dome + EVA flight rig',
    icon: '🧑‍🚀',
    avatarColor: '#22D3EE',
    avatarStyle: 'astro-dome',
    customization: {
      bodyColor: '#CBD5E1',
      faceStyle: 'visor-led',
      hat: 'none',
      outfit: 'astronaut',
      accessory: 'shoulder-drone',
      flairEmoji: '🚀',
    },
  },
  {
    id: 'lounge-sheriff',
    label: 'Oche Outlaw',
    tagline: 'Cowboy hat + warm copper trim',
    icon: '🤠',
    avatarColor: '#D97B43',
    avatarStyle: 'visor-classic',
    customization: {
      bodyColor: '#451A03',
      faceStyle: 'cool-shades',
      hat: 'cowboy',
      outfit: 'varsity',
      accessory: 'bowtie',
      flairEmoji: '🎯',
    },
  },
  {
    id: 'premiere-vip',
    label: 'Opening Night',
    tagline: 'Top hat + premiere tuxedo',
    icon: '🎩',
    avatarColor: '#DFD5C0',
    avatarStyle: 'knight-helm',
    customization: {
      bodyColor: '#181F2B',
      faceStyle: 'cyber-scan',
      hat: 'top-hat',
      outfit: 'tuxedo',
      accessory: 'vip-halo',
      flairEmoji: '⛳',
    },
  },
] as const

const VALID_STYLES = new Set<string>(AVATAR_STYLES.map((s) => s.id))
const VALID_FACES = new Set<string>(AVATAR_FACES.map((f) => f.id))
const VALID_HATS = new Set<string>(AVATAR_HATS.map((h) => h.id))
const VALID_OUTFITS = new Set<string>(AVATAR_OUTFITS.map((o) => o.id))
const VALID_ACCESSORIES = new Set<string>(AVATAR_ACCESSORIES.map((a) => a.id))

export function resolveAvatarCustomization(
  raw?: Partial<AvatarCustomization> | null,
): AvatarCustomization {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_AVATAR_CUSTOMIZATION }
  }
  return {
    bodyColor:
      typeof raw.bodyColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(raw.bodyColor)
        ? raw.bodyColor
        : DEFAULT_AVATAR_CUSTOMIZATION.bodyColor,
    faceStyle:
      typeof raw.faceStyle === 'string' && VALID_FACES.has(raw.faceStyle)
        ? (raw.faceStyle as AvatarFaceId)
        : DEFAULT_AVATAR_CUSTOMIZATION.faceStyle,
    hat:
      typeof raw.hat === 'string' && VALID_HATS.has(raw.hat)
        ? (raw.hat as AvatarHatId)
        : DEFAULT_AVATAR_CUSTOMIZATION.hat,
    outfit:
      typeof raw.outfit === 'string' && VALID_OUTFITS.has(raw.outfit)
        ? (raw.outfit as AvatarOutfitId)
        : DEFAULT_AVATAR_CUSTOMIZATION.outfit,
    accessory:
      typeof raw.accessory === 'string' && VALID_ACCESSORIES.has(raw.accessory)
        ? (raw.accessory as AvatarAccessoryId)
        : DEFAULT_AVATAR_CUSTOMIZATION.accessory,
    flairEmoji:
      typeof raw.flairEmoji === 'string' ? raw.flairEmoji.slice(0, 4) : '',
  }
}

export function createRandomAvatarLook(): {
  avatarColor: string
  avatarStyle: AvatarStyleId
  avatarCustomization: AvatarCustomization
} {
  const pick = <T,>(arr: readonly T[]): T =>
    arr[Math.floor(Math.random() * arr.length)]
  return {
    avatarColor: pick(AVATAR_COLORS).hex,
    avatarStyle: pick(AVATAR_STYLES).id,
    avatarCustomization: {
      bodyColor: pick(AVATAR_BODY_COLORS).hex,
      faceStyle: pick(AVATAR_FACES).id,
      hat: pick(AVATAR_HATS).id,
      outfit: pick(AVATAR_OUTFITS).id,
      accessory: pick(AVATAR_ACCESSORIES).id,
      flairEmoji: pick(AVATAR_FLAIR_BADGES).emoji,
    },
  }
}

const AVATAR_STORAGE_KEY = 'vr-lounge:avatar-prefs:v1'

export interface SavedAvatarPreferences {
  displayName?: string
  avatarColor: string
  avatarStyle: AvatarStyleId
  avatarCustomization: AvatarCustomization
}

export function loadSavedAvatarPreferences(): SavedAvatarPreferences | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AVATAR_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<SavedAvatarPreferences>
    const avatarStyle =
      typeof parsed.avatarStyle === 'string' && VALID_STYLES.has(parsed.avatarStyle)
        ? parsed.avatarStyle
        : AVATAR_STYLES[0].id
    const avatarColor =
      typeof parsed.avatarColor === 'string' &&
      /^#[0-9a-fA-F]{6}$/.test(parsed.avatarColor)
        ? parsed.avatarColor
        : AVATAR_COLORS[0].hex
    return {
      displayName:
        typeof parsed.displayName === 'string' ? parsed.displayName.slice(0, 24) : undefined,
      avatarColor,
      avatarStyle,
      avatarCustomization: resolveAvatarCustomization(parsed.avatarCustomization),
    }
  } catch {
    return null
  }
}

export function saveAvatarPreferences(prefs: SavedAvatarPreferences): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(AVATAR_STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // Ignore storage quota / private mode warnings
  }
}
