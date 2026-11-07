export type AvatarStyleId = 'visor-classic' | 'visor-sleek' | 'visor-halo' | 'visor-studio'

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
  timestamp: number
}

export interface ParticipantProfile {
  userId: string
  displayName: string
  avatarColor: string
  avatarStyle: AvatarStyleId
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

export interface RoomCustomizationState {
  revision: number
  updatedAt: number
  updatedBy: string
  architecture: RoomArchitectureConfig
  lighting: RoomLightingConfig
  screen: RoomScreenTransform
  furniture: PlacedFurnitureItem[]
}

export interface ComputedSeat {
  id: string
  index: number
  furnitureId: string
  furnitureType: FurnitureCatalogId | 'fallback'
  label: string
  position: [number, number, number]
  localCushionOffset: [number, number, number]
  seatHeightOffset: number
  rotationY: number
}
