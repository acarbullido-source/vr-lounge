import type { AvatarStyleId, PresenterState, SampleMediaPreset, SeatDefinition } from '../types/lounge'

/**
 * Curved cinema screen placement & dimensions (16:9 aspect ratio)
 * Positioned at the front of the room (-Z) facing +Z toward the tiered seats.
 */
export const SCREEN_CONFIG = {
  width: 8.8,
  height: 4.95,
  curveRadius: 13.5,
  center: [0, 2.95, -6.6] as [number, number, number],
} as const

/**
 * 8 designated lounge seats arranged in two curved tiers facing the screen.
 * Front row (4 plush lounge chairs) + Elevated back sofa tier (4 seats).
 */
export const LOUNGE_SEATS: readonly SeatDefinition[] = [
  {
    index: 0,
    label: 'A1 · Center Left',
    row: 'front',
    position: [-0.95, 0.0, 0.35],
    rotationY: -0.12,
  },
  {
    index: 1,
    label: 'A2 · Center Right',
    row: 'front',
    position: [0.95, 0.0, 0.35],
    rotationY: 0.12,
  },
  {
    index: 2,
    label: 'A3 · Wing Left',
    row: 'front',
    position: [-2.75, 0.0, 0.85],
    rotationY: -0.34,
  },
  {
    index: 3,
    label: 'A4 · Wing Right',
    row: 'front',
    position: [2.75, 0.0, 0.85],
    rotationY: 0.34,
  },
  {
    index: 4,
    label: 'B1 · Balcony Center L',
    row: 'back',
    position: [-1.05, 0.38, 2.75],
    rotationY: -0.1,
  },
  {
    index: 5,
    label: 'B2 · Balcony Center R',
    row: 'back',
    position: [1.05, 0.38, 2.75],
    rotationY: 0.1,
  },
  {
    index: 6,
    label: 'B3 · Balcony Wing L',
    row: 'back',
    position: [-3.0, 0.38, 3.2],
    rotationY: -0.28,
  },
  {
    index: 7,
    label: 'B4 · Balcony Wing R',
    row: 'back',
    position: [3.0, 0.38, 3.2],
    rotationY: 0.28,
  },
] as const

export const AVATAR_COLORS = [
  { name: 'Tungsten Amber', hex: '#E5A93C' },
  { name: 'Cinema Vermilion', hex: '#E05A47' },
  { name: 'Glacier Teal', hex: '#3FB8AF' },
  { name: 'Sage Jade', hex: '#52B788' },
  { name: 'Cobalt Horizon', hex: '#4A8FE7' },
  { name: 'Warm Copper', hex: '#D97B43' },
  { name: 'Champagne Ivory', hex: '#DFD5C0' },
  { name: 'Crimson Velvet', hex: '#C84B61' },
] as const

export const AVATAR_STYLES: ReadonlyArray<{
  id: AvatarStyleId
  label: string
  tagline: string
}> = [
  { id: 'visor-classic', label: 'Quest Proline', tagline: 'Curved anodized visor' },
  { id: 'visor-sleek', label: 'Aero Blade', tagline: 'Low-profile wraparound' },
  { id: 'visor-halo', label: 'Crown Halo', tagline: 'Dual-ring studio headband' },
  { id: 'visor-studio', label: 'Acoustic Pod', tagline: 'Integrated spatial cans' },
] as const

export const QUICK_REACTIONS = ['🔥', '😂', '👏', '🤯', '🍿', '❤️'] as const

/**
 * Curated CORS-enabled public cinema test streams (MP4 + HLS .m3u8)
 * so presenters in headsets or desktop can immediately test Mode 2 synchronized playback.
 */
export const SAMPLE_MEDIA_PRESETS: readonly SampleMediaPreset[] = [
  {
    id: 'tears-of-steel-hls',
    title: 'Tears of Steel (Blender Sci-Fi Short)',
    subtitle: 'Adaptive HLS (.m3u8) · 1080p Cinema Wide',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    kind: 'hls',
    durationHint: '10:54',
  },
  {
    id: 'sintel-mp4',
    title: 'Sintel — Open Movie Project',
    subtitle: 'Direct MP4 · 720p Stereo',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    kind: 'mp4',
    durationHint: '14:48',
  },
  {
    id: 'elephants-dream-mp4',
    title: 'Elephants Dream — Surreal Short',
    subtitle: 'Direct MP4 · 720p Stereo',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    kind: 'mp4',
    durationHint: '10:53',
  },
  {
    id: 'cosmos-laundromat-mp4',
    title: 'Big Buck Bunny — 60fps Reference',
    subtitle: 'Direct MP4 · High Frame Rate Test',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    kind: 'mp4',
    durationHint: '09:56',
  },
] as const

export function createInitialPresenterState(): PresenterState {
  return {
    activePresenterId: null,
    presenterName: null,
    lockedByHostId: null,
    screenMode: 'idle',
    mediaUrl: SAMPLE_MEDIA_PRESETS[0].url,
    mediaTitle: SAMPLE_MEDIA_PRESETS[0].title,
    useCorsProxy: false,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    updatedAt: Date.now(),
    revision: 0,
  }
}

export function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  for (let i = 0; i < 6; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)]
  }
  return `${code.slice(0, 3)}-${code.slice(3)}`
}
