const MUSIC_KEY = 'fishsim-music'
const SFX_KEY = 'fishsim-sfx'

function getMusicOn() {
  try { return localStorage.getItem(MUSIC_KEY) !== '0' } catch (_) { return true }
}
function getSfxOn() {
  try { return localStorage.getItem(SFX_KEY) !== '0' } catch (_) { return true }
}

class AudioEngine {
  constructor() {
    this.ctx = null
    this.master = null
    this.sfxGain = null
    this.musicGain = null
    this.ambientNodes = null
  }

  init() {
    if (this.ctx) return
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return
    this.ctx = new AC()
    this.master = this.ctx.createGain()
    this.master.gain.value = 0.9
    this.master.connect(this.ctx.destination)

    this.sfxGain = this.ctx.createGain()
    this.sfxGain.gain.value = 0.5
    this.sfxGain.connect(this.master)

    this.musicGain = this.ctx.createGain()
    this.musicGain.gain.value = 0.25
    this.musicGain.connect(this.master)
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume()
  }

  sfx(name) {
    if (!this.ctx || !getSfxOn()) return
    const t = this.ctx.currentTime
    const o = this.ctx.createOscillator()
    const g = this.ctx.createGain()
    o.connect(g)
    g.connect(this.sfxGain)

    const presets = {
      click: { type: 'sine', f0: 520, f1: 660, dur: 0.08, vol: 0.3 },
      feed: { type: 'triangle', f0: 300, f1: 180, dur: 0.12, vol: 0.35 },
      buy: { type: 'square', f0: 440, f1: 880, dur: 0.14, vol: 0.3 },
      sell: { type: 'square', f0: 880, f1: 440, dur: 0.14, vol: 0.3 },
      breed: { type: 'sine', f0: 600, f1: 1200, dur: 0.25, vol: 0.35 },
      death: { type: 'sawtooth', f0: 320, f1: 70, dur: 0.5, vol: 0.3 },
      select: { type: 'sine', f0: 700, f1: 900, dur: 0.06, vol: 0.25 },
    }
    const p = presets[name] || presets.click
    o.type = p.type
    o.frequency.setValueAtTime(p.f0, t)
    o.frequency.exponentialRampToValueAtTime(Math.max(1, p.f1), t + p.dur)
    g.gain.setValueAtTime(p.vol, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + p.dur)
    o.start(t)
    o.stop(t + p.dur + 0.02)
  }

  ambientStart() {
    if (!this.ctx || !getMusicOn() || this.ambientNodes) return
    const t = this.ctx.currentTime
    const bufferSize = 2 * this.ctx.sampleRate
    const noiseBuf = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate)
    const data = noiseBuf.getChannelData(0)
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1
    const noise = this.ctx.createBufferSource()
    noise.buffer = noiseBuf
    noise.loop = true

    const filter = this.ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 420

    const lfo = this.ctx.createOscillator()
    lfo.frequency.value = 0.08
    const lfoGain = this.ctx.createGain()
    lfoGain.gain.value = 180
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)

    const g = this.ctx.createGain()
    g.gain.value = 0.6

    noise.connect(filter)
    filter.connect(g)
    g.connect(this.musicGain)
    noise.start(t)
    lfo.start(t)
    this.ambientNodes = { noise, lfo, g }
  }

  ambientStop() {
    if (!this.ambientNodes) return
    try { this.ambientNodes.noise.stop() } catch (_) {}
    try { this.ambientNodes.lfo.stop() } catch (_) {}
    this.ambientNodes = null
  }
}

export const audio = new AudioEngine()

export function applyAudioToggles() {
  if (getMusicOn()) audio.ambientStart()
  else audio.ambientStop()
}
