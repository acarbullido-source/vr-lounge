export type RangeWeaponId =
  | 'pistol-9mm'
  | 'revolver-44'
  | 'pistol-burst'
  | 'rifle-carbine'
  | 'shotgun-12g'
  | 'sniper-bolt'

class ShootingRangeAudioEngine {
  private ctx: AudioContext | null = null
  private noiseBuffer: AudioBuffer | null = null
  private muted = false

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext
      if (!AudioCtx) return null
      try {
        this.ctx = new AudioCtx()
      } catch {
        return null
      }
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => undefined)
    }
    if (!this.noiseBuffer && this.ctx) {
      const sr = this.ctx.sampleRate
      const len = Math.floor(sr * 0.6)
      const buf = this.ctx.createBuffer(1, len, sr)
      const data = buf.getChannelData(0)
      for (let i = 0; i < len; i++) {
        data[i] = Math.random() * 2 - 1
      }
      this.noiseBuffer = buf
    }
    return this.ctx
  }

  public setMuted(muted: boolean): void {
    this.muted = muted
  }

  public isMuted(): boolean {
    return this.muted
  }

  public playGunshot(weaponId: RangeWeaponId): void {
    const ctx = this.ensureContext()
    if (!ctx || !this.noiseBuffer) return
    const now = ctx.currentTime

    // 1. Noise blast envelope tailored per weapon caliber
    const noiseSrc = ctx.createBufferSource()
    noiseSrc.buffer = this.noiseBuffer

    const filter = ctx.createBiquadFilter()
    const noiseGain = ctx.createGain()

    // 2. Low-end punch oscillator
    const osc = ctx.createOscillator()
    const oscGain = ctx.createGain()

    if (weaponId === 'pistol-9mm') {
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1450, now)
      filter.Q.setValueAtTime(0.85, now)
      noiseGain.gain.setValueAtTime(0.32, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.14)

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(240, now)
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.08)
      oscGain.gain.setValueAtTime(0.28, now)
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.09)
    } else if (weaponId === 'revolver-44') {
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(980, now)
      noiseGain.gain.setValueAtTime(0.48, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28)

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(155, now)
      osc.frequency.exponentialRampToValueAtTime(34, now + 0.18)
      oscGain.gain.setValueAtTime(0.42, now)
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19)
    } else if (weaponId === 'pistol-burst') {
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1750, now)
      filter.Q.setValueAtTime(1.1, now)
      noiseGain.gain.setValueAtTime(0.25, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1)

      osc.type = 'triangle'
      osc.frequency.setValueAtTime(270, now)
      osc.frequency.exponentialRampToValueAtTime(65, now + 0.065)
      oscGain.gain.setValueAtTime(0.22, now)
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.07)
    } else if (weaponId === 'rifle-carbine') {
      filter.type = 'bandpass'
      filter.frequency.setValueAtTime(1650, now)
      filter.Q.setValueAtTime(0.75, now)
      noiseGain.gain.setValueAtTime(0.36, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.17)

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(210, now)
      osc.frequency.exponentialRampToValueAtTime(46, now + 0.11)
      oscGain.gain.setValueAtTime(0.32, now)
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    } else if (weaponId === 'shotgun-12g') {
      filter.type = 'lowpass'
      filter.frequency.setValueAtTime(860, now)
      noiseGain.gain.setValueAtTime(0.52, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32)

      osc.type = 'sine'
      osc.frequency.setValueAtTime(130, now)
      osc.frequency.exponentialRampToValueAtTime(28, now + 0.22)
      oscGain.gain.setValueAtTime(0.46, now)
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.23)
    } else {
      // sniper-bolt: high-velocity supersonic crack + deep chamber echo
      filter.type = 'highpass'
      filter.frequency.setValueAtTime(1100, now)
      noiseGain.gain.setValueAtTime(0.44, now)
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26)

      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(190, now)
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.17)
      oscGain.gain.setValueAtTime(0.38, now)
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    }

    noiseSrc.connect(filter)
    filter.connect(noiseGain)
    noiseGain.connect(ctx.destination)
    noiseSrc.start(now)
    noiseSrc.stop(now + 0.35)

    osc.connect(oscGain)
    oscGain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.25)
  }

  public playSteelPing(distanceMeters = 18): void {
    const ctx = this.ensureContext()
    if (!ctx) return
    const delay = Math.min(0.12, Math.max(0.015, distanceMeters / 340))
    const start = ctx.currentTime + delay

    const freqs = [1540, 2310, 3180]
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = idx === 0 ? 'triangle' : 'sine'
      osc.frequency.setValueAtTime(f + (Math.random() - 0.5) * 35, start)
      gain.gain.setValueAtTime(0.16 / (idx + 1), start)
      gain.gain.exponentialRampToValueAtTime(0.0008, start + 0.36 - idx * 0.07)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.38)
    })
  }

  public playTargetHit(
    zone: 'bullseye' | 'head' | 'body' | 'no-shoot' | 'shatter',
  ): void {
    const ctx = this.ensureContext()
    if (!ctx) return
    const now = ctx.currentTime

    if (zone === 'no-shoot') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(165, now)
      osc.frequency.setValueAtTime(130, now + 0.1)
      gain.gain.setValueAtTime(0.22, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.26)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 0.27)
      return
    }

    if (zone === 'shatter' && this.noiseBuffer) {
      const src = ctx.createBufferSource()
      src.buffer = this.noiseBuffer
      const bp = ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.setValueAtTime(2200, now)
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.28, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
      src.connect(bp)
      bp.connect(gain)
      gain.connect(ctx.destination)
      src.start(now)
      src.stop(now + 0.2)
    }

    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'sine'
    if (zone === 'bullseye' || zone === 'head') {
      osc.frequency.setValueAtTime(880, now)
      osc.frequency.setValueAtTime(1320, now + 0.055)
      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18)
    } else {
      osc.frequency.setValueAtTime(420, now)
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.07)
      gain.gain.setValueAtTime(0.14, now)
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08)
    }
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.2)
  }

  public playReload(): void {
    const ctx = this.ensureContext()
    if (!ctx) return
    const now = ctx.currentTime
    const clicks = [
      { t: 0, f: 520 },
      { t: 0.11, f: 780 },
      { t: 0.22, f: 1120 },
    ]
    for (const c of clicks) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(c.f, now + c.t)
      osc.frequency.exponentialRampToValueAtTime(240, now + c.t + 0.045)
      gain.gain.setValueAtTime(0.18, now + c.t)
      gain.gain.exponentialRampToValueAtTime(0.001, now + c.t + 0.05)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + c.t)
      osc.stop(now + c.t + 0.055)
    }
  }

  public playPumpAction(): void {
    const ctx = this.ensureContext()
    if (!ctx) return
    const now = ctx.currentTime
    ;[0, 0.09].forEach((offset, idx) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(idx === 0 ? 640 : 890, now + offset)
      osc.frequency.exponentialRampToValueAtTime(260, now + offset + 0.05)
      gain.gain.setValueAtTime(0.16, now + offset)
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.055)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + offset)
      osc.stop(now + offset + 0.06)
    })
  }

  public playDryFire(): void {
    const ctx = this.ensureContext()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    osc.frequency.setValueAtTime(1400, now)
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.025)
    gain.gain.setValueAtTime(0.12, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.03)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + 0.035)
  }

  public playRangeBuzzer(kind: 'start' | 'end' | 'wave'): void {
    const ctx = this.ensureContext()
    if (!ctx) return
    const now = ctx.currentTime
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = 'square'
    const freq = kind === 'start' ? 1046.5 : kind === 'wave' ? 880 : 523.25
    const dur = kind === 'end' ? 0.36 : 0.18
    osc.frequency.setValueAtTime(freq, now)
    gain.gain.setValueAtTime(0.16, now)
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + dur + 0.02)
  }
}

export const shootingRangeAudio = new ShootingRangeAudioEngine()
