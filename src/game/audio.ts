/**
 * Every sound in the game is synthesised with WebAudio: no audio files to load.
 * Music is an ambient pad with a combat layer whose level follows the action.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null
  private master!: GainNode
  private sfx!: GainNode
  private musicBus!: GainNode
  private noise!: AudioBuffer
  private comp!: DynamicsCompressorNode
  private engineOsc: OscillatorNode[] = []
  private engineGain!: GainNode
  private engineFilter!: BiquadFilterNode
  private boostGain!: GainNode
  private padGain!: GainNode
  private combatGain!: GainNode
  private last = new Map<string, number>()
  private musicTimer = 0
  private step = 0
  private nextBeat = 0
  private padOscs: OscillatorNode[] = []
  private padFilter!: BiquadFilterNode
  private chord = 0
  intensity = 0
  volume = 0.8
  musicVolume = 0.6

  get ready() {
    return this.ctx !== null
  }

  /** Must run inside a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume()
      return
    }
    const ctx = new AudioContext()
    this.ctx = ctx
    this.comp = ctx.createDynamicsCompressor()
    this.comp.threshold.value = -14
    this.comp.ratio.value = 5
    this.master = ctx.createGain()
    this.master.gain.value = this.volume
    this.comp.connect(this.master).connect(ctx.destination)
    this.sfx = ctx.createGain()
    this.sfx.connect(this.comp)
    this.musicBus = ctx.createGain()
    this.musicBus.gain.value = this.musicVolume
    this.musicBus.connect(this.comp)
    const len = ctx.sampleRate * 2
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate)
    const d = this.noise.getChannelData(0)
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1
    this.buildEngine()
    this.buildMusic()
  }

  setVolume(v: number, music: number) {
    this.volume = v
    this.musicVolume = music
    if (!this.ctx) return
    this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05)
    this.musicBus.gain.setTargetAtTime(music, this.ctx.currentTime, 0.05)
  }

  suspend(on: boolean) {
    if (!this.ctx) return
    if (on) void this.ctx.suspend()
    else void this.ctx.resume()
  }

  private gate(key: string, ms: number) {
    const now = performance.now()
    if ((this.last.get(key) ?? 0) + ms > now) return false
    this.last.set(key, now)
    return true
  }

  private out(vol: number, pan = 0) {
    const ctx = this.ctx!
    const g = ctx.createGain()
    g.gain.value = vol
    if (pan !== 0) {
      const p = ctx.createStereoPanner()
      p.pan.value = Math.max(-1, Math.min(1, pan))
      g.connect(p).connect(this.sfx)
    } else g.connect(this.sfx)
    return g
  }

  private noiseSrc() {
    const s = this.ctx!.createBufferSource()
    s.buffer = this.noise
    s.loop = true
    s.loopStart = Math.random()
    return s
  }

  laser(terran: boolean, vol = 1, pan = 0) {
    if (!this.ctx || vol < 0.02 || !this.gate(terran ? 'lt' : 'lm', terran ? 45 : 20)) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = terran ? 'square' : 'sawtooth'
    const f0 = terran ? 900 : 1500
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(terran ? 140 : 220, t + 0.14)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(5000, t)
    f.frequency.exponentialRampToValueAtTime(600, t + 0.14)
    const g = this.out(0, pan)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.16 * vol, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    o.connect(f).connect(g)
    o.start(t)
    o.stop(t + 0.18)
  }

  explosion(size: number, vol = 1, pan = 0) {
    if (!this.ctx || vol < 0.02 || !this.gate('ex', 40)) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const dur = 0.6 + Math.min(3, size * 0.12)
    const n = this.noiseSrc()
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(3000, t)
    f.frequency.exponentialRampToValueAtTime(90, t + dur)
    const g = this.out(0, pan)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.7 * vol, t + 0.01)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    n.connect(f).connect(g)
    n.start(t)
    n.stop(t + dur)
    const o = ctx.createOscillator()
    o.type = 'sine'
    o.frequency.setValueAtTime(120, t)
    o.frequency.exponentialRampToValueAtTime(28, t + dur * 0.8)
    const og = this.out(0, pan)
    og.gain.setValueAtTime(0.0001, t)
    og.gain.exponentialRampToValueAtTime(0.8 * vol, t + 0.01)
    og.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.9)
    o.connect(og)
    o.start(t)
    o.stop(t + dur)
  }

  hit() {
    if (!this.ctx || !this.gate('hit', 50)) return
    this.blip(2400, 1600, 0.05, 'square', 0.08)
  }

  hurt() {
    if (!this.ctx || !this.gate('hurt', 90)) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const n = this.noiseSrc()
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.value = 700
    f.Q.value = 1.4
    const g = this.out(0)
    g.gain.setValueAtTime(0.5, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25)
    n.connect(f).connect(g)
    n.start(t)
    n.stop(t + 0.3)
  }

  shield() {
    if (!this.ctx || !this.gate('sh', 90)) return
    this.blip(500, 1400, 0.2, 'sine', 0.18)
  }

  lock(locked: boolean) {
    if (!this.ctx) return
    if (locked) this.blip(1760, 1760, 0.09, 'square', 0.07)
    else if (this.gate('lk', 160)) this.blip(990, 990, 0.04, 'square', 0.04)
  }

  missile() {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const n = this.noiseSrc()
    const f = ctx.createBiquadFilter()
    f.type = 'bandpass'
    f.frequency.setValueAtTime(400, t)
    f.frequency.exponentialRampToValueAtTime(2400, t + 0.5)
    const g = this.out(0)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.45, t + 0.03)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
    n.connect(f).connect(g)
    n.start(t)
    n.stop(t + 1)
  }

  alarm() {
    if (!this.ctx || !this.gate('al', 520)) return
    this.blip(880, 880, 0.12, 'square', 0.06)
    setTimeout(() => this.blip(660, 660, 0.12, 'square', 0.06), 160)
  }

  warp() {
    if (!this.ctx) return
    const ctx = this.ctx
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.setValueAtTime(40, t)
    o.frequency.exponentialRampToValueAtTime(900, t + 2.4)
    const f = ctx.createBiquadFilter()
    f.type = 'lowpass'
    f.frequency.setValueAtTime(200, t)
    f.frequency.exponentialRampToValueAtTime(6000, t + 2.4)
    const g = this.out(0)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.3, t + 1.8)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8)
    o.connect(f).connect(g)
    o.start(t)
    o.stop(t + 3)
    const n = this.noiseSrc()
    const nf = ctx.createBiquadFilter()
    nf.type = 'highpass'
    nf.frequency.setValueAtTime(200, t)
    nf.frequency.exponentialRampToValueAtTime(5000, t + 2.6)
    const ng = this.out(0)
    ng.gain.setValueAtTime(0.0001, t)
    ng.gain.exponentialRampToValueAtTime(0.35, t + 2.2)
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 3)
    n.connect(nf).connect(ng)
    n.start(t)
    n.stop(t + 3.1)
  }

  click() {
    if (!this.ctx) return
    this.blip(1200, 800, 0.04, 'triangle', 0.08)
  }

  perk() {
    if (!this.ctx) return
    ;[523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.blip(f, f, 0.18, 'triangle', 0.08), i * 70))
  }

  private blip(f0: number, f1: number, dur: number, type: OscillatorType, vol: number) {
    const ctx = this.ctx!
    const t = ctx.currentTime
    const o = ctx.createOscillator()
    o.type = type
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f1, t + dur)
    const g = this.out(0)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(vol, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private buildEngine() {
    const ctx = this.ctx!
    this.engineFilter = ctx.createBiquadFilter()
    this.engineFilter.type = 'lowpass'
    this.engineFilter.frequency.value = 300
    this.engineGain = ctx.createGain()
    this.engineGain.gain.value = 0
    this.engineFilter.connect(this.engineGain).connect(this.sfx)
    for (const f of [55, 55.7, 110.4]) {
      const o = ctx.createOscillator()
      o.type = 'sawtooth'
      o.frequency.value = f
      o.connect(this.engineFilter)
      o.start()
      this.engineOsc.push(o)
    }
    const n = this.noiseSrc()
    const nf = ctx.createBiquadFilter()
    nf.type = 'bandpass'
    nf.frequency.value = 900
    nf.Q.value = 0.6
    this.boostGain = ctx.createGain()
    this.boostGain.gain.value = 0
    n.connect(nf).connect(this.boostGain).connect(this.sfx)
    n.start()
  }

  /** throttle 0..1, boost 0..1, on=false silences the engine (menus). */
  engine(throttle: number, boost: number, on: boolean) {
    if (!this.ctx) return
    const t = this.ctx.currentTime
    const k = on ? 1 : 0
    this.engineGain.gain.setTargetAtTime((0.05 + throttle * 0.07) * k, t, 0.1)
    this.engineFilter.frequency.setTargetAtTime(180 + throttle * 420 + boost * 900, t, 0.1)
    this.boostGain.gain.setTargetAtTime(boost * 0.12 * k, t, 0.08)
    const pitch = 1 + throttle * 0.25 + boost * 0.35
    this.engineOsc.forEach((o, i) => o.frequency.setTargetAtTime([55, 55.7, 110.4][i] * pitch, t, 0.15))
  }

  private buildMusic() {
    const ctx = this.ctx!
    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = 'lowpass'
    this.padFilter.frequency.value = 700
    this.padFilter.Q.value = 0.7
    this.padGain = ctx.createGain()
    this.padGain.gain.value = 0.07
    this.padFilter.connect(this.padGain).connect(this.musicBus)
    for (let i = 0; i < 6; i++) {
      const o = ctx.createOscillator()
      o.type = i % 2 ? 'sawtooth' : 'triangle'
      o.detune.value = (i - 2.5) * 6
      o.connect(this.padFilter)
      o.start()
      this.padOscs.push(o)
    }
    this.combatGain = ctx.createGain()
    this.combatGain.gain.value = 0
    this.combatGain.connect(this.musicBus)
    this.setChord(0)
    this.nextBeat = ctx.currentTime + 0.1
  }

  // D minor-ish progression with a Lydian lift: cold, wide, a bit hopeful
  private static CHORDS = [
    [146.8, 220, 293.7, 349.2, 440, 587.3],
    [116.5, 174.6, 233.1, 293.7, 349.2, 466.2],
    [130.8, 196, 261.6, 329.6, 392, 523.3],
    [110, 164.8, 220, 277.2, 329.6, 440],
  ]
  private static BASS = [73.4, 58.3, 65.4, 55]

  private setChord(i: number) {
    const ctx = this.ctx!
    const c = AudioEngine.CHORDS[i]
    this.padOscs.forEach((o, k) => o.frequency.setTargetAtTime(c[k], ctx.currentTime, 1.2))
  }

  /** Call every frame. intensity 0..1 drives the combat layer. */
  update(dt: number) {
    if (!this.ctx) return
    const ctx = this.ctx
    this.musicTimer += dt
    if (this.musicTimer > 8) {
      this.musicTimer = 0
      this.chord = (this.chord + 1) % 4
      this.setChord(this.chord)
    }
    this.padFilter.frequency.setTargetAtTime(500 + this.intensity * 1400, ctx.currentTime, 0.8)
    this.combatGain.gain.setTargetAtTime(this.intensity * 0.32, ctx.currentTime, 0.6)
    // schedule the combat pulse a little ahead of time
    const beat = 60 / 118 / 2
    while (this.nextBeat < ctx.currentTime + 0.2) {
      const t = this.nextBeat
      const s = this.step % 16
      const bass = AudioEngine.BASS[this.chord]
      if (s % 2 === 0 || s === 7 || s === 15) this.pluck(t, bass * (s === 7 || s === 15 ? 2 : 1), 0.18)
      if (s === 0 || s === 8) this.kick(t)
      if (s === 4 || s === 12) this.snare(t)
      this.step++
      this.nextBeat += beat
    }
  }

  private pluck(t: number, f: number, dur: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.type = 'sawtooth'
    o.frequency.value = f
    const fl = ctx.createBiquadFilter()
    fl.type = 'lowpass'
    fl.frequency.setValueAtTime(1400, t)
    fl.frequency.exponentialRampToValueAtTime(120, t + dur)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.005)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(fl).connect(g).connect(this.combatGain)
    o.start(t)
    o.stop(t + dur + 0.02)
  }

  private kick(t: number) {
    const ctx = this.ctx!
    const o = ctx.createOscillator()
    o.frequency.setValueAtTime(150, t)
    o.frequency.exponentialRampToValueAtTime(40, t + 0.18)
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.9, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3)
    o.connect(g).connect(this.combatGain)
    o.start(t)
    o.stop(t + 0.32)
  }

  private snare(t: number) {
    const ctx = this.ctx!
    const n = this.noiseSrc()
    const f = ctx.createBiquadFilter()
    f.type = 'highpass'
    f.frequency.value = 1800
    const g = ctx.createGain()
    g.gain.setValueAtTime(0.35, t)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
    n.connect(f).connect(g).connect(this.combatGain)
    n.start(t)
    n.stop(t + 0.18)
  }
}

export const audio = new AudioEngine()
