/**
 * Sintetizador de audio procedural vía Web Audio API.
 * No requiere archivos MP3 externos y funciona offline en cualquier navegador.
 */

class SoundFX {
  private ctx: AudioContext | null = null
  public muted = false

  constructor() {
    try {
      this.muted = localStorage.getItem('promex_sound_muted') === '1'
    } catch {
      this.muted = false
    }
  }

  private getCtx(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      if (AC) this.ctx = new AC()
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {})
    }
    return this.ctx
  }

  setMuted(next: boolean) {
    this.muted = next
    try {
      localStorage.setItem('promex_sound_muted', next ? '1' : '0')
    } catch {
      // ignore
    }
  }

  private tone(freq: number, duration: number, type: OscillatorType = 'sine', gainVal = 0.08, delay = 0) {
    const ctx = this.getCtx()
    if (!ctx) return
    const now = ctx.currentTime + delay
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = type
    osc.frequency.setValueAtTime(freq, now)
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration)
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start(now)
    osc.stop(now + duration + 0.02)
  }

  spinStart() {
    this.tone(190, 0.09, 'triangle', 0.07, 0)
    this.tone(260, 0.11, 'triangle', 0.06, 0.04)
  }

  reelStop(reelIndex: number, hasBook: boolean) {
    if (hasBook) {
      this.tone(520 + reelIndex * 90, 0.22, 'sine', 0.11, 0)
      this.tone(780 + reelIndex * 90, 0.25, 'triangle', 0.07, 0.04)
    } else {
      this.tone(115 + reelIndex * 12, 0.07, 'triangle', 0.08, 0)
    }
  }

  win(big: boolean) {
    const notes = big ? [523.25, 659.25, 783.99, 1046.5, 1318.5] : [440, 554.37, 659.25]
    notes.forEach((f, idx) => {
      this.tone(f, big ? 0.28 : 0.18, 'triangle', 0.09, idx * 0.075)
    })
  }

  freeSpinsTrigger() {
    const notes = [392, 493.88, 587.33, 783.99, 987.77, 1174.66]
    notes.forEach((f, idx) => {
      this.tone(f, 0.35, 'sawtooth', 0.06, idx * 0.09)
    })
  }

  expand() {
    this.tone(330, 0.35, 'sine', 0.09, 0)
    this.tone(495, 0.4, 'triangle', 0.08, 0.06)
    this.tone(660, 0.45, 'sine', 0.09, 0.12)
  }

  gambleFlip(won: boolean) {
    if (won) {
      this.tone(587.33, 0.16, 'triangle', 0.09, 0)
      this.tone(880, 0.24, 'triangle', 0.1, 0.08)
    } else {
      this.tone(240, 0.2, 'sawtooth', 0.07, 0)
      this.tone(170, 0.28, 'sawtooth', 0.07, 0.1)
    }
  }
}

export const sound = new SoundFX()
