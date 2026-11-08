export type AvatarStyleId =
  | 'visor-classic'
  | 'visor-sleek'
  | 'visor-halo'
  | 'visor-studio'
  | 'bot-retro'
  | 'astro-dome'
  | 'cat-ears'
  | 'knight-helm'

export type AvatarFaceId =
  | 'visor-led'
  | 'happy-pixel'
  | 'cool-shades'
  | 'starry'
  | 'cyber-scan'
  | 'wink'
  | 'minimal'

export type AvatarHatId =
  | 'none'
  | 'beanie'
  | 'baseball-cap'
  | 'crown'
  | 'cowboy'
  | 'wizard'
  | 'top-hat'
  | 'party-cone'

export type AvatarOutfitId =
  | 'hoodie'
  | 'varsity'
  | 'cyber-vest'
  | 'tuxedo'
  | 'astronaut'
  | 'cloak'

export type AvatarAccessoryId =
  | 'none'
  | 'shoulder-drone'
  | 'orbit-rings'
  | 'vip-halo'
  | 'bowtie'

export interface AvatarCustomization {
  bodyColor: string
  faceStyle: AvatarFaceId
  hat: AvatarHatId
  outfit: AvatarOutfitId
  accessory: AvatarAccessoryId
  flairEmoji: string
}

export type ScreenMode = 'idle' | 'tab-stream' | 'url-sync'

export type DeviceMode = 'vr' | 'desktop'

export type TransportMode = 'supabase' | 'cloud-relay' | 'local-broadcast'

export interface Vec3Tuple {
  0: number
  1: number
  2: number
}

export interface QuatTuple {
  0: number
  1: number
  2: number
  3: number
}

export interface Transform6DoF {
  position: [number, number, number]
  quaternion: [number, number, number, number]
}

export interface AvatarPose6DoF {
  userId: string
  head: Transform6DoF
  leftHand: Transform6DoF | null
  rightHand: Transform6DoF | null
  seatIndex: number
  seatId?: string
  inVR: boolean
  isFlying?: boolean
  timestamp: number
}

export interface ParticipantProfile {
  userId: string
  displayName: string
  avatarColor: string
  avatarStyle: AvatarStyleId
  avatarCustomization?: AvatarCustomization
  seatIndex: number
  seatId?: string
  isHost: boolean
  isMuted: boolean
  inVR: boolean
  joinedAt: number
}

export interface PresenterState {
  activePresenterId: string | null
  presenterName: string | null
  lockedByHostId: string | null
  screenMode: ScreenMode
  mediaUrl: string
  mediaTitle: string
  useCorsProxy: boolean
  isPlaying: boolean
  currentTime: number
  duration: number
  updatedAt: number
  revision: number
}

export interface ChatMessage {
  id: string
  userId: string
  displayName: string
  avatarColor: string
  text: string
  createdAt: number
  isSystem?: boolean
}

export interface FloatingReaction {
  id: string
  userId: string
  displayName: string
  emoji: string
  origin: [number, number, number]
  createdAt: number
}

export interface SeatDefinition {
  index: number
  label: string
  row: 'front' | 'back'
  position: [number, number, number]
  rotationY: number
}

export interface SampleMediaPreset {
  id: string
  title: string
  subtitle: string
  url: string
  kind: 'mp4' | 'hls'
  durationHint: string
}

export type WebRTCSignalKind =
  | 'webrtc-offer'
  | 'webrtc-answer'
  | 'webrtc-ice'
  | 'webrtc-request-renegotiate'

export interface WebRTCSignalMessage {
  kind: WebRTCSignalKind
  fromUserId: string
  toUserId: string
  sdp?: RTCSessionDescriptionInit
  candidate?: RTCIceCandidateInit
  timestamp: number
}

// ============================================================================
// Customizable Hangout Space (v2.0) — Architecture, Furniture, Seating & Moods
// ============================================================================

export type RoomSizePreset = 'cozy' | 'classic' | 'grand'

export type RoomMaterialThemeId =
  | 'obsidian-theater'
  | 'walnut-velvet'
  | 'industrial-loft'
  | 'neon-cyber'
  | 'nordic-oak'

export type CeilingStyleId = 'coffered' | 'skylight-stars' | 'industrial-beams'

export type LightingPresetId =
  | 'movie'
  | 'cozy'
  | 'neon-pub'
  | 'midnight-lofi'
  | 'daylight'

export type FurnitureCategory = 'seating' | 'tables' | 'decor' | 'wall'

export type FurnitureCatalogId =
  | 'sofa-3'
  | 'loveseat-2'
  | 'armchair'
  | 'beanbag'
  | 'barstool'
  | 'coffee-table'
  | 'bar-counter'
  | 'rug-plush'
  | 'plant-monstera'
  | 'lamp-floor'
  | 'neon-sign'
  | 'wall-poster'
  | 'arcade-cabinet'
  | 'popcorn-cart'

export interface PlacedFurnitureItem {
  id: string
  type: FurnitureCatalogId
  position: [number, number, number]
  rotationY: number
  scale: number
  color: string
  imageUrl?: string
  label?: string
}

export interface RoomScreenTransform {
  position: [number, number, number]
  rotationY: number
  scale: number
  curved: boolean
}

export interface RoomArchitectureConfig {
  sizePreset: RoomSizePreset
  materialTheme: RoomMaterialThemeId
  ceilingStyle: CeilingStyleId
  leftBarAlcove: boolean
  rightArcadeAlcove: boolean
  rearBalcony: boolean
}

export interface RoomLightingConfig {
  preset: LightingPresetId
  brightness: number
  accentColor: string
  ambientTint: string
  autoDimOnPlay: boolean
}

export type LoungeWingId =
  | 'main-lounge'
  | 'hallway'
  | 'boardroom'
  | 'library'
  | 'command-center'
  | 'game-room'
  | 'outdoor-deck'

export type OutdoorSkyPresetId =
  | 'golden-sunset'
  | 'starlit-aurora'
  | 'alpine-morning'

export type CommandNewsCategoryId = 'top' | 'tech' | 'space' | 'markets'

export type SportsLeagueId = 'nfl' | 'nba' | 'mlb' | 'nhl' | 'mls' | 'ncaaf'

export interface ExpansionWingSyncedState {
  boardroomScreenMode: 'agenda' | 'mirror-lounge'
  boardroomAgendaIndex: number
  libraryFireLit: boolean
  outdoorSkyPreset: OutdoorSkyPresetId
  commandScreenMode: 'mirror-lounge' | 'ops-stream'
  commandStreamPresetId: string
  commandCustomStreamUrl: string
  commandCustomStreamTitle: string
  commandWeatherCityId: string
  commandCustomCityQuery: string
  commandNewsCategory: CommandNewsCategoryId
  commandSportsLeague?: SportsLeagueId
}

export interface RoomCustomizationState {
  revision: number
  updatedAt: number
  updatedBy: string
  architecture: RoomArchitectureConfig
  lighting: RoomLightingConfig
  screen: RoomScreenTransform
  furniture: PlacedFurnitureItem[]
  expansionWing?: ExpansionWingSyncedState
}

export interface ComputedSeat {
  id: string
  index: number
  furnitureId: string
  furnitureType: FurnitureCatalogId | 'fallback' | 'game-station' | 'wing-seat'
  label: string
  position: [number, number, number]
  localCushionOffset: [number, number, number]
  seatHeightOffset: number
  rotationY: number
  lookAtTarget?: [number, number, number]
  stationKind?:
    | 'seat'
    | 'game-table'
    | 'darts-oche'
    | 'putting-tee'
    | 'chalkboard'
    | 'shuffleboard'
    | 'cornhole'
    | 'arcade'
  roomWing?: LoungeWingId
}


