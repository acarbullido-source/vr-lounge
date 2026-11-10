import type { SoundboardEffectId } from '../types/barGames'

export interface SoundboardEffectSpec {
  id: SoundboardEffectId
  label: string
  emoji: string
  reactionEmoji: string
  accentColor: string
  description: string
}

export const SOUNDBOARD_EFFECTS: readonly SoundboardEffectSpec[] = [
  {
    id: 'airhorn',
    label: 'Club Airhorn',
    emoji: '📣',
    reactionEmoji: '🔥',
    accentColor: '#EF4444',
    description: 'Triple stadium hype horn',
  },
  {
    id: 'rimshot',
    label: 'Ba-Dum Tss',
    emoji: '🥁',
    reactionEmoji: '😂',
    accentColor: '#F59E0B',
    description: 'Classic comedy snare & cymbal',
  },
  {
    id: 'applause',
    label: 'Golf Clap',
    emoji: '👏',
    reactionEmoji: '👏',
    accentColor: '#10B981',
    description: 'Polite clubhouse applause',
  },
  {
    id: 'cheer',
    label: 'Victory Fanfare',
    emoji: '🎉',
    reactionEmoji: '🎉',
    accentColor: '#38BDF8',
    description: 'Brass triumph chord',
  },
  {
    id: 'arcade-coin',
    label: '1-UP Coin',
    emoji: '🪙',
    reactionEmoji: '✨',
    accentColor: '#EAB308',
    description: 'Retro 8-bit powerup chime',
  },
  {
    id: 'dramatic',
    label: 'Dun-Dun-DUN!',
    emoji: '⚡',
    reactionEmoji: '🍿',
    accentColor: '#A855F7',
    description: 'Cinematic suspense sting',
  },
] as const

let sharedCtx: AudioContext | null = null

function getSoundboardContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!sharedCtx) {
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!Ctor) return null
    sharedCtx = new Ctor()
  }
  if (sharedCtx.state === 'suspended') {
    void sharedCtx.resume().catch(() => undefined)
  }
  return sharedCtx
}

/**
 * Synthesizes zero-latency procedural Web Audio soundboard effects so mobile,
 * desktop, and VR users hear crisp clubhouse stingers without external audio files.
 */
export function playSoundboardEffect(
  effectId: SoundboardEffectId,
  volume = 0.55,
): void {
  const ctx = getSoundboardContext()
  if (!ctx) return

  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(Math.max(0.05, Math.min(1, volume)), now)
  master.connect(ctx.destination)

  if (effectId === 'airhorn') {
    // Triple stadium airhorn blasts (detuned sawtooth stack)
    const bursts = [
      { start: 0, dur: 0.13 },
      { start: 0.16, dur: 0.13 },
      { start: 0.32, dur: 0.48 },
    ]
    const freqs = [392, 493.88, 587.33, 783.99]
    for (const b of bursts) {
      for (const f of freqs) {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(f * 0.96, now + b.start)
        osc.frequency.linearRampToValueAtTime(f, now + b.start + 0.03)
        g.gain.setValueAtTime(0.001, now + b.start)
        g.gain.exponentialRampToValueAtTime(0.14, now + b.start + 0.015)
        g.gain.exponentialRampToValueAtTime(0.001, now + b.start + b.dur)
        osc.connect(g)
        g.connect(master)
        osc.start(now + b.start)
        osc.stop(now + b.start + b.dur + 0.02)
      }
    }
    return
  }

  if (effectId === 'rimshot') {
    // Ba-Dum-Tss: Two tom hits + bright noise cymbal shimmer
    const hits = [
      { t: 0, f0: 175, f1: 95, dur: 0.12 },
      { t: 0.16, f0: 135, f1: 72, dur: 0.15 },
    ]
    for (const h of hits) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(h.f0, now + h.t)
      osc.frequency.exponentialRampToValueAtTime(h.f1, now + h.t + h.dur)
      g.gain.setValueAtTime(0.45, now + h.t)
      g.gain.exponentialRampToValueAtTime(0.001, now + h.t + h.dur)
      osc.connect(g)
      g.connect(master)
      osc.start(now + h.t)
      osc.stop(now + h.t + h.dur + 0.02)
    }
    // Cymbal sizzle at t = 0.34
    const bufLen = Math.floor(ctx.sampleRate * 0.55)
    const noiseBuf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.16))
    }
    const noise = ctx.createBufferSource()
    noise.buffer = noiseBuf
    const hp = ctx.createBiquadFilter()
    hp.type = 'highpass'
    hp.frequency.setValueAtTime(5200, now + 0.34)
    const ng = ctx.createGain()
    ng.gain.setValueAtTime(0.32, now + 0.34)
    ng.gain.exponentialRampToValueAtTime(0.001, now + 0.88)
    noise.connect(hp)
    hp.connect(ng)
    ng.connect(master)
    noise.start(now + 0.34)
    return
  }

  if (effectId === 'applause') {
    // Rhythmic filtered noise claps
    for (let i = 0; i < 9; i++) {
      const t = i * 0.065 + (Math.random() * 0.018)
      const bufLen = Math.floor(ctx.sampleRate * 0.055)
      const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate)
      const data = buf.getChannelData(0)
      for (let j = 0; j < bufLen; j++) {
        data[j] = (Math.random() * 2 - 1) * Math.exp(-j / (bufLen * 0.35))
      }
      const src = ctx.createBufferSource()
      src.buffer = buf
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(1100 + (i % 3) * 280, now + t)
      bp.Q.setValueAtTime(2.2, now + t)
      const g = ctx.createGain()
      g.gain.setValueAtTime(0.32, now + t)
      src.connect(bp)
      bp.connect(g)
      g.connect(master)
      src.start(now + t)
    }
    return
  }

  if (effectId === 'cheer') {
    // Rising brass triad fanfare (C5 -> E5 -> G5 -> C6)
    const notes = [
      { t: 0, f: 523.25, d: 0.11 },
      { t: 0.11, f: 659.25, d: 0.11 },
      { t: 0.22, f: 783.99, d: 0.11 },
      { t: 0.34, f: 1046.5, d: 0.42 },
    ]
    for (const n of notes) {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(n.f, now + n.t)
      g.gain.setValueAtTime(0.32, now + n.t)
      g.gain.exponentialRampToValueAtTime(0.001, now + n.t + n.d)
      osc.connect(g)
      g.connect(master)
      osc.start(now + n.t)
      osc.stop(now + n.t + n.d + 0.02)
    }
    return
  }

  if (effectId === 'arcade-coin') {
    // Classic B5 -> E6 8-bit coin pickup
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(987.77, now)
    osc.frequency.setValueAtTime(1318.51, now + 0.085)
    g.gain.setValueAtTime(0.24, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.42)
    osc.connect(g)
    g.connect(master)
    osc.start(now)
    osc.stop(now + 0.44)
    return
  }

  if (effectId === 'dramatic') {
    // Dun - Dun - DUNNN! (Minor suspense chord hits)
    const hits = [
      { t: 0, freqs: [146.83, 220], d: 0.18 },
      { t: 0.22, freqs: [138.59, 207.65], d: 0.18 },
      { t: 0.45, freqs: [130.81, 196.0, 311.13], d: 0.65 },
    ]
    for (const h of hits) {
      for (const f of h.freqs) {
        const osc = ctx.createOscillator()
        const g = ctx.createGain()
        osc.type = 'sawtooth'
        osc.frequency.setValueAtTime(f, now + h.t)
        g.gain.setValueAtTime(0.18, now + h.t)
        g.gain.exponentialRampToValueAtTime(0.001, now + h.t + h.d)
        osc.connect(g)
        g.connect(master)
        osc.start(now + h.t)
        osc.stop(now + h.t + h.d + 0.02)
      }
    }
  }
}

export type SpatialInteractionAudioKind =
  | 'ui-click'
  | 'ui-hover'
  | 'dart-throw'
  | 'dart-hit'
  | 'putt-strike'
  | 'putt-cup'
  | 'dice-roll'
  | 'card-flip'
  | 'puck-slide'
  | 'bag-toss'
  | 'teleport'

/**
 * Lightweight procedural micro-audio cues for spatial VR/3D affordances.
 */
export function playSpatialUiFeedback(
  kind: SpatialInteractionAudioKind,
  volume = 0.22,
): void {
  const ctx = getSoundboardContext()
  if (!ctx) return

  const now = ctx.currentTime
  const master = ctx.createGain()
  master.gain.setValueAtTime(Math.max(0.02, Math.min(0.6, volume)), now)
  master.connect(ctx.destination)

  if (kind === 'ui-hover') {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(520, now)
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.028)
    g.gain.setValueAtTime(0.08, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.032)
    osc.connect(g)
    g.connect(master)
    osc.start(now)
    osc.stop(now + 0.035)
    return
  }

  if (kind === 'ui-click') {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(680, now)
    osc.frequency.exponentialRampToValueAtTime(920, now + 0.045)
    g.gain.setValueAtTime(0.18, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.05)
    osc.connect(g)
    g.connect(master)
    osc.start(now)
    osc.stop(now + 0.055)
    return
  }

  if (kind === 'dart-throw' || kind === 'bag-toss') {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(280, now)
    osc.frequency.exponentialRampToValueAtTime(540, now + 0.09)
    g.gain.setValueAtTime(0.16, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.095)
    osc.connect(g)
    g.connect(master)
    osc.start(now)
    osc.stop(now + 0.1)
    return
  }

  if (kind === 'dart-hit') {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(145, now)
    osc.frequency.exponentialRampToValueAtTime(58, now + 0.075)
    g.gain.setValueAtTime(0.32, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    osc.connect(g)
    g.connect(master)
    osc.start(now)
    osc.stop(now + 0.085)
    return
  }

  if (kind === 'putt-strike' || kind === 'puck-slide') {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(420, now)
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.055)
    g.gain.setValueAtTime(0.28, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.06)
    osc.connect(g)
    g.connect(master)
    osc.start(now)
    osc.stop(now + 0.065)
    return
  }

  if (kind === 'putt-cup') {
    const notes = [587.33, 880]
    notes.forEach((f, idx) => {
      const osc = ctx.createOscillator()
      const g = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(f, now + idx * 0.065)
      g.gain.setValueAtTime(0.26, now + idx * 0.065)
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.065 + 0.16)
      osc.connect(g)
      g.connect(master)
      osc.start(now + idx * 0.065)
      osc.stop(now + idx * 0.065 + 0.17)
    })
    return
  }

  if (kind === 'dice-roll' || kind === 'card-flip') {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(kind === 'dice-roll' ? 340 : 620, now)
    osc.frequency.exponentialRampToValueAtTime(
      kind === 'dice-roll' ? 760 : 380,
      now + 0.06,
    )
    g.gain.setValueAtTime(0.2, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.065)
    osc.connect(g)
    g.connect(master)
    osc.start(now)
    osc.stop(now + 0.07)
    return
  }

  if (kind === 'teleport') {
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(320, now)
    osc.frequency.exponentialRampToValueAtTime(640, now + 0.11)
    g.gain.setValueAtTime(0.16, now)
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    osc.connect(g)
    g.connect(master)
    osc.start(now)
    osc.stop(now + 0.125)
  }
}
