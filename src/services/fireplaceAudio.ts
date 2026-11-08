/**
 * Zero-dependency WebAudio procedural fireplace synthesizer for the Cozy Library.
 * Produces a soothing warm hearth rumble (low-passed brown noise) plus gentle
 * wood-ember crackle pops — no external audio files or network fetches required.
 */
class FireplaceAudioEngine {
  private ctx: AudioContext | null = null
  private rumbleNode: AudioBufferSourceNode | null = null
  private masterGain: GainNode | null = null
  private crackleTimer: number | null = null
  private active = false

  isPlaying(): boolean {
    return this.active
  }

  resumeIfNeeded(): void {
    if (this.active && this.ctx && this.ctx.state === 'suspended') {
      void this.ctx.resume().catch(() => {})
    }
  }

  toggle(): boolean {
    if (this.active) {
      this.stop()
      return false
    }
    this.start()
    return true
  }

  start(): void {
    if (this.active || typeof window === 'undefined') return
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext
    if (!AudioCtx) return

    try {
      if (!this.ctx) {
        this.ctx = new AudioCtx()
      }
      if (this.ctx.state === 'suspended') {
        void this.ctx.resume()
      }

      const master = this.ctx.createGain()
      master.gain.value = 0.22
      master.connect(this.ctx.destination)
      this.masterGain = master

      // Generate 3 seconds of warm looping brown noise for gentle hearth draft
      const sampleRate = this.ctx.sampleRate
      const length = sampleRate * 3
      const buffer = this.ctx.createBuffer(1, length, sampleRate)
      const data = buffer.getChannelData(0)
      let lastOut = 0
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1
        lastOut = (lastOut + 0.02 * white) / 1.02
        data[i] = lastOut * 2.8
      }

      const src = this.ctx.createBufferSource()
      src.buffer = buffer
      src.loop = true

      const lowpass = this.ctx.createBiquadFilter()
      lowpass.type = 'lowpass'
      lowpass.frequency.value = 260

      const rumbleGain = this.ctx.createGain()
      rumbleGain.gain.value = 0.55

      src.connect(lowpass)
      lowpass.connect(rumbleGain)
      rumbleGain.connect(master)
      src.start()
      this.rumbleNode = src
      this.active = true

      this.scheduleNextCrackle()
    } catch {
      this.active = false
    }
  }

  private scheduleNextCrackle(): void {
    if (!this.active || !this.ctx || !this.masterGain) return
    const delayMs = 90 + Math.random() * 420
    this.crackleTimer = window.setTimeout(() => {
      this.triggerSingleCrackle()
      this.scheduleNextCrackle()
    }, delayMs)
  }

  private triggerSingleCrackle(): void {
    if (!this.active || !this.ctx || !this.masterGain) return
    try {
      const now = this.ctx.currentTime
      const dur = 0.018 + Math.random() * 0.032
      const len = Math.max(32, Math.floor(this.ctx.sampleRate * dur))
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate)
      const ch = buf.getChannelData(0)
      for (let i = 0; i < len; i++) {
        const env = Math.pow(1 - i / len, 2.4)
        ch[i] = (Math.random() * 2 - 1) * env
      }

      const popSrc = this.ctx.createBufferSource()
      popSrc.buffer = buf

      const bp = this.ctx.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 1200 + Math.random() * 2600
      bp.Q.value = 1.8

      const popGain = this.ctx.createGain()
      popGain.gain.setValueAtTime(0.08 + Math.random() * 0.16, now)
      popGain.gain.exponentialRampToValueAtTime(0.001, now + dur)

      popSrc.connect(bp)
      bp.connect(popGain)
      popGain.connect(this.masterGain)
      popSrc.start(now)
    } catch {
      // Ignore transient WebAudio node errors
    }
  }

  stop(): void {
    this.active = false
    if (this.crackleTimer !== null && typeof window !== 'undefined') {
      window.clearTimeout(this.crackleTimer)
      this.crackleTimer = null
    }
    try {
      this.rumbleNode?.stop()
      this.rumbleNode?.disconnect()
    } catch {
      // Ignore stop errors
    }
    this.rumbleNode = null
    try {
      this.masterGain?.disconnect()
    } catch {
      // Ignore disconnect errors
    }
    this.masterGain = null
  }
}

export const fireplaceAudio = new FireplaceAudioEngine()
