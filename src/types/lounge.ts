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
  inVR: boolean
  timestamp: number
}

export interface ParticipantProfile {
  userId: string
  displayName: string
  avatarColor: string
  avatarStyle: AvatarStyleId
  seatIndex: number
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
