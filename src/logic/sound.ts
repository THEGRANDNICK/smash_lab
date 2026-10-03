// UI sounds, synthesized live with the Web Audio API — no audio files to download.
//
// Badminton + paper, in the spirit of Carnivinion's wood clicks — pitched low and warm (v2):
//   tap     — a light "tock" of a shuttle on strings: noise transient through a band-pass + a short, falling tone
//   pluck   — a brighter string "ping" for primary actions (start quiz, send, choose this one)
//   flick   — a paper flick for tabs, cards, toggles and opening/closing panels
//   tick    — a tiny, quiet tick for chips, checkboxes and selections
//   reveal  — two rising plucks when a result is revealed
// Every sound is varied by a few percent in pitch, so repeated clicks never sound mechanical.
// Off with one setting, remembered on this device.

export type SoundKind = 'tap' | 'pluck' | 'flick' | 'tick' | 'reveal'

const STORAGE_KEY = 'smashlab.sound'
let ctx: AudioContext | null = null
let noise: AudioBuffer | null = null
let bus: AudioNode | null = null
let enabled: boolean | null = null
const listeners = new Set<(on: boolean) => void>()

export function isSoundEnabled(): boolean {
  if (enabled == null) {
    try {
      // v2: off by default — sounds only after the player turns them on in the header.
      enabled = localStorage.getItem(STORAGE_KEY) === 'on'
    } catch {
      enabled = false
    }
  }
  return enabled
}

export function setSoundEnabled(on: boolean): void {
  enabled = on
  try {
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off')
  } catch {
    // private mode — the setting just won't survive a reload
  }
  listeners.forEach((l) => l(on))
  if (on) play('pluck')
}

export function onSoundSettingChange(listener: (on: boolean) => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function audio(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  if (!ctx) {
    ctx = new Ctor()
    // Master bus: boost (the first version was far too quiet to notice) through a limiter so
    // several voices at once never clip.
    const boost = ctx.createGain()
    boost.gain.value = 2.2
    const limiter = ctx.createDynamicsCompressor()
    limiter.threshold.value = -6
    limiter.knee.value = 0
    limiter.ratio.value = 20
    limiter.attack.value = 0.002
    limiter.release.value = 0.08
    boost.connect(limiter).connect(ctx.destination)
    bus = boost
  }
  if (ctx.state === 'suspended') void ctx.resume()
  if (!noise) {
    const length = Math.floor(ctx.sampleRate * 0.09)
    noise = ctx.createBuffer(1, length, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 3)
  }
  return ctx
}

const jitter = () => 1 + (Math.random() - 0.5) * 0.1

function noiseBurst(ac: AudioContext, t0: number, opts: { type: BiquadFilterType; freq: number; q: number; gain: number; decay: number; rate?: number }) {
  const src = ac.createBufferSource()
  const filter = ac.createBiquadFilter()
  const gain = ac.createGain()
  src.buffer = noise
  src.playbackRate.value = opts.rate ?? 1
  filter.type = opts.type
  filter.frequency.value = opts.freq
  filter.Q.value = opts.q
  gain.gain.setValueAtTime(opts.gain, t0)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + opts.decay)
  src.connect(filter).connect(gain).connect(bus ?? ac.destination)
  src.start(t0)
  src.stop(t0 + opts.decay + 0.02)
}

function tone(ac: AudioContext, t0: number, opts: { type: OscillatorType; from: number; to: number; gain: number; decay: number; lowpass?: number }) {
  const osc = ac.createOscillator()
  const gain = ac.createGain()
  const lp = ac.createBiquadFilter()
  osc.type = opts.type
  osc.frequency.setValueAtTime(opts.from, t0)
  osc.frequency.exponentialRampToValueAtTime(opts.to, t0 + opts.decay * 0.7)
  lp.type = 'lowpass'
  lp.frequency.value = opts.lowpass ?? 3000
  gain.gain.setValueAtTime(opts.gain, t0)
  gain.gain.exponentialRampToValueAtTime(0.001, t0 + opts.decay)
  osc.connect(lp).connect(gain).connect(bus ?? ac.destination)
  osc.start(t0)
  osc.stop(t0 + opts.decay + 0.02)
}

export function play(kind: SoundKind): void {
  if (!isSoundEnabled()) return
  try {
    const ac = audio()
    if (!ac) return
    const t0 = ac.currentTime + 0.001
    const j = jitter()
    switch (kind) {
      case 'tap':
        noiseBurst(ac, t0, { type: 'bandpass', freq: 1500 * j, q: 2.5, gain: 0.35, decay: 0.05 })
        tone(ac, t0, { type: 'triangle', from: 480 * j, to: 300 * j, gain: 0.16, decay: 0.09, lowpass: 1600 })
        break
      case 'pluck':
        noiseBurst(ac, t0, { type: 'bandpass', freq: 2000 * j, q: 3, gain: 0.3, decay: 0.04 })
        tone(ac, t0, { type: 'triangle', from: 740 * j, to: 620 * j, gain: 0.2, decay: 0.26, lowpass: 2800 })
        tone(ac, t0, { type: 'sine', from: 1480 * j, to: 1240 * j, gain: 0.04, decay: 0.14 })
        break
      case 'flick':
        noiseBurst(ac, t0, { type: 'bandpass', freq: 1100 * j, q: 0.8, gain: 0.3, decay: 0.07, rate: 0.5 })
        break
      case 'tick':
        noiseBurst(ac, t0, { type: 'bandpass', freq: 2600 * j, q: 5, gain: 0.22, decay: 0.03 })
        break
      case 'reveal':
        tone(ac, t0, { type: 'triangle', from: 587 * j, to: 575 * j, gain: 0.18, decay: 0.28, lowpass: 2800 })
        tone(ac, t0 + 0.11, { type: 'triangle', from: 880 * j, to: 862 * j, gain: 0.18, decay: 0.4, lowpass: 2800 })
        noiseBurst(ac, t0, { type: 'bandpass', freq: 3000, q: 3, gain: 0.2, decay: 0.03 })
        break
    }
  } catch {
    // Audio is a nicety — never let it break a click.
  }
}

/**
 * Which sound a click on `target` should make. Elements can choose explicitly with
 * data-sound="pluck|flick|tick|tap|none"; otherwise sensible defaults by element type.
 */
export function soundForElement(target: Element | null): SoundKind | null {
  const el = target?.closest<HTMLElement>('[data-sound], button, a[href], [role="tab"], summary, input[type="checkbox"], input[type="radio"], label, select')
  if (!el) return null
  if ((el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true') return null
  const explicit = el.dataset.sound
  if (explicit) return explicit === 'none' ? null : (explicit as SoundKind)
  if (el.getAttribute('role') === 'tab' || el.tagName === 'SUMMARY') return 'flick'
  if (el.tagName === 'INPUT' || el.tagName === 'LABEL' || el.tagName === 'SELECT') return 'tick'
  return 'tap'
}
