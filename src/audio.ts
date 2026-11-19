// Every effect is synthesized with the Web Audio API. Music streams from
// music/theme.mp3 when it exists and is generated when it does not.

export interface Mix {
  master: number; music: number; musicPlay: number; effects: number;
  lava: number; bellows: number; hammers: number; ducking: boolean; muted: boolean;
}

export const DEFAULT_MIX: Mix = {
  master: 0.8, music: 0.55, musicPlay: 0.35, effects: 0.8,
  lava: 0.08, bellows: 0.06, hammers: 0.1, ducking: true, muted: false,
};

const KEY = 'crucible.mix';

export class Sound {
  mix: Mix = { ...DEFAULT_MIX };
  /** Names of the sounds played so far, newest last (used by the checks). */
  readonly log: string[] = [];
  /** 'file' or 'generated' once music has started. */
  musicSource: 'none' | 'file' | 'generated' = 'none';
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private fx!: GainNode;
  private music!: GainNode;
  private duck!: GainNode;
  private amb: Record<'lava' | 'bellows' | 'hammers', GainNode> = {} as never;
  private noise!: AudioBuffer;
  private rumble: { gain: GainNode } | null = null;
  private craneGain: GainNode | null = null;
  private craneFilter: BiquadFilterNode | null = null;
  private inPlay = false;
  private lastSlots = false;
  private musicCut = false;
  private timer = 0;
  private step = 0;
  private nextBeat = 0;
  private nextHeart = 0;
  private nextHammer = 0;
  private audioEl: HTMLAudioElement | null = null;

  constructor() {
    try {
      const saved = localStorage.getItem(KEY);
      if (saved) this.mix = { ...DEFAULT_MIX, ...JSON.parse(saved) };
    } catch { /* keep defaults */ }
  }

  get started(): boolean { return this.ctx !== null; }

  /** Sound starts on the first click. */
  start(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = (this.ctx = new AC());
    this.master = ctx.createGain();
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);
    this.fx = ctx.createGain();
    this.fx.connect(this.master);
    this.music = ctx.createGain();
    this.duck = ctx.createGain();
    this.music.connect(this.duck).connect(this.master);
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.startAmbience();
    this.apply();
    this.startMusic();
    this.timer = window.setInterval(() => this.tick(), 60);
  }

  save(): void {
    try { localStorage.setItem(KEY, JSON.stringify(this.mix)); } catch { /* private mode */ }
    this.apply();
  }

  reset(): void { this.mix = { ...DEFAULT_MIX }; this.save(); }
  toggleMute(): void { this.mix.muted = !this.mix.muted; this.save(); }

  private apply(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const m = this.mix;
    this.master.gain.setTargetAtTime(m.muted ? 0 : m.master, t, 0.05);
    this.fx.gain.setTargetAtTime(m.effects, t, 0.05);
    const mus = this.musicCut ? 0 : this.inPlay ? m.musicPlay : m.music;
    this.music.gain.setTargetAtTime(mus, t, this.musicCut ? 0.04 : 0.4);
    if (this.audioEl) this.audioEl.volume = Math.min(1, (m.muted ? 0 : m.master) * mus);
    this.amb.lava.gain.setTargetAtTime(m.lava, t, 0.1);
    this.amb.bellows.gain.setTargetAtTime(m.bellows, t, 0.1);
    this.amb.hammers.gain.setTargetAtTime(m.hammers, t, 0.1);
  }

  /** Music is quieter during play than on the title. */
  setInPlay(on: boolean): void { this.inPlay = on; this.apply(); }
  /** With six or fewer slots left the percussion drops out and a heartbeat starts. */
  setLastSlots(on: boolean): void {
    if (on && !this.lastSlots && this.ctx) this.nextHeart = this.ctx.currentTime + 0.1;
    this.lastSlots = on;
  }
  get heartbeat(): boolean { return this.lastSlots; }
  /** The music cuts out for the slow fall of a winning drop. */
  cutMusic(on: boolean): void { this.musicCut = on; this.apply(); }

  /** Ducks the music under a masterstroke or the winning drop. */
  duckFor(seconds: number): void {
    if (!this.ctx || !this.mix.ducking) return;
    const t = this.ctx.currentTime;
    const g = this.duck.gain;
    g.cancelScheduledValues(t);
    g.setTargetAtTime(0.25, t, 0.08);
    g.setTargetAtTime(1, t + seconds, 0.5);
  }

  // ---- building blocks ----

  private env(g: AudioParam, t: number, peak: number, attack: number, decay: number): void {
    g.setValueAtTime(0.0001, t);
    g.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.exponentialRampToValueAtTime(0.0001, t + attack + decay);
  }

  private tone(freq: number, t: number, peak: number, decay: number, type: OscillatorType = 'sine', out: AudioNode = this.fx, glideTo?: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t + decay);
    this.env(g.gain, t, peak, 0.004, decay);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + decay + 0.1);
  }

  private hiss(t: number, peak: number, attack: number, decay: number, type: BiquadFilterType, freq: number, q = 1, out: AudioNode = this.fx, sweepTo?: number): void {
    const ctx = this.ctx!;
    const s = ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + attack + decay);
    f.Q.value = q;
    const g = ctx.createGain();
    this.env(g.gain, t, peak, attack, decay);
    s.connect(f).connect(g).connect(out);
    s.start(t, Math.random());
    s.stop(t + attack + decay + 0.1);
  }

  /** A clang from inharmonic partials. */
  private clang(t: number, base: number, peak: number, decay: number, out: AudioNode = this.fx): void {
    const ratios = [1, 2.32, 2.76, 4.07, 5.43, 6.8];
    ratios.forEach((r, i) => this.tone(base * r, t, peak / (1 + i * 0.7), decay / (1 + i * 0.45), i === 0 ? 'triangle' : 'sine', out));
    this.hiss(t, peak * 0.5, 0.002, 0.05, 'highpass', 2500, 1, out);
  }

  private at(delay = 0): number { return this.ctx!.currentTime + delay; }

  private mark(name: string): boolean {
    this.log.push(name);
    if (this.log.length > 200) this.log.shift();
    return this.ctx !== null && this.ctx.state === 'running';
  }

  // ---- effects ----

  /** A rattle down the channel for the length of the fall. */
  rattle(seconds: number): void {
    if (!this.mark('rattle')) return;
    const n = Math.max(3, Math.round(seconds / 0.055));
    for (let i = 0; i < n; i++) {
      const t = this.at((i / n) * seconds);
      this.hiss(t, 0.1 + Math.random() * 0.08, 0.001, 0.03, 'bandpass', 1800 + Math.random() * 2600, 6);
      this.tone(900 + Math.random() * 900, t, 0.03, 0.03, 'square');
    }
  }

  /** The landing clang. Lower slots ring deeper. */
  clangAt(row: number, strength = 1): void {
    if (!this.mark('clang')) return;
    this.clang(this.at(), 150 + row * 34, 0.5 * strength, 1.1);
    this.tone(70, this.at(), 0.45 * strength, 0.18, 'sine', this.fx, 38);
  }

  sparks(): void {
    if (!this.mark('sparks')) return;
    for (let i = 0; i < 7; i++) this.hiss(this.at(i * 0.022 + Math.random() * 0.02), 0.12, 0.001, 0.035 + Math.random() * 0.05, 'highpass', 5000 + Math.random() * 4000);
  }

  /** The crane's chain rattle, pitched by its speed (0 stops it). */
  crane(speed: number): void {
    if (!this.ctx) return;
    if (!this.craneGain) {
      const ctx = this.ctx;
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      this.craneFilter = ctx.createBiquadFilter();
      this.craneFilter.type = 'bandpass';
      this.craneFilter.Q.value = 5;
      const trem = ctx.createGain();
      const lfo = ctx.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 23;
      const lg = ctx.createGain();
      lg.gain.value = 0.5;
      trem.gain.value = 0.5;
      lfo.connect(lg).connect(trem.gain);
      this.craneGain = ctx.createGain();
      this.craneGain.gain.value = 0;
      s.connect(this.craneFilter).connect(trem).connect(this.craneGain).connect(this.fx);
      s.start();
      lfo.start();
    }
    const v = Math.min(1, Math.abs(speed) / 9);
    if (v > 0.05 && this.log[this.log.length - 1] !== 'crane') this.log.push('crane');
    this.craneGain.gain.setTargetAtTime(v * 0.16, this.ctx.currentTime, 0.04);
    this.craneFilter!.frequency.setTargetAtTime(900 + v * 2200, this.ctx.currentTime, 0.04);
  }

  /** The low rumble that swells while a line of three stands open. */
  openLine(on: boolean): void {
    if (on) { if (this.log[this.log.length - 1] !== 'rumble') this.log.push('rumble'); }
    if (!this.ctx) return;
    if (!this.rumble) {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.gain.value = 0;
      for (const f of [41, 43.5, 61]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f;
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 160;
        o.connect(lp).connect(g);
        o.start();
      }
      g.connect(this.fx);
      this.rumble = { gain: g };
    }
    this.rumble.gain.gain.setTargetAtTime(on ? 0.2 : 0, this.ctx.currentTime, on ? 0.9 : 0.25);
  }

  banner(): void {
    if (!this.mark('banner')) return;
    this.tone(98, this.at(), 0.4, 1.2, 'sawtooth');
    this.tone(147, this.at(), 0.25, 1.2, 'sawtooth');
    this.hiss(this.at(), 0.2, 0.3, 0.8, 'lowpass', 500);
  }

  hammerWhoosh(): void {
    if (!this.mark('hammerfall-whoosh')) return;
    this.hiss(this.at(), 0.5, 0.45, 0.15, 'bandpass', 300, 1.5, this.fx, 2400);
  }

  hammerStrike(): void {
    if (!this.mark('hammerfall-strike')) return;
    const t = this.at();
    this.clang(t, 78, 1.0, 2.6);
    this.tone(60, t, 1.0, 0.5, 'sine', this.fx, 28);
    this.hiss(t, 0.7, 0.002, 0.25, 'lowpass', 1800);
  }

  /** Three clangs as the column drops. */
  tripleClang(): void {
    if (!this.mark('hammerfall-clangs')) return;
    for (let i = 0; i < 3; i++) this.clang(this.at(i * 0.13), 190 - i * 22, 0.45, 0.8);
  }

  steam(): void {
    if (!this.mark('quench-steam')) return;
    this.hiss(this.at(), 0.75, 0.25, 1.3, 'bandpass', 3800, 0.6, this.fx, 1400);
    this.hiss(this.at(), 0.35, 0.1, 1.0, 'highpass', 6000);
  }

  ice(): void {
    if (!this.mark('quench-ice')) return;
    for (let i = 0; i < 14; i++) {
      const t = this.at(i * 0.05 + Math.random() * 0.05);
      this.tone(2400 + Math.random() * 3800, t, 0.16, 0.05, 'square');
      this.hiss(t, 0.2, 0.001, 0.025, 'highpass', 5000);
    }
    this.tone(1650, this.at(0.75), 0.2, 1.0, 'sine');
  }

  meltWhine(): void {
    if (!this.mark('meltdown-whine')) return;
    const ctx = this.ctx!;
    const t = this.at();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(220, t);
    o.frequency.exponentialRampToValueAtTime(1500, t + 0.95);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.8);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 2600;
    o.connect(f).connect(g).connect(this.fx);
    o.start(t);
    o.stop(t + 1.1);
  }

  meltHiss(): void {
    if (!this.mark('meltdown-hiss')) return;
    this.hiss(this.at(), 0.5, 0.03, 0.8, 'highpass', 3200);
  }

  meltDrop(): void {
    if (!this.mark('meltdown-drop')) return;
    this.tone(520, this.at(), 0.5, 0.2, 'sine', this.fx, 110);
    this.hiss(this.at(0.02), 0.25, 0.002, 0.12, 'lowpass', 900);
  }

  ratchet(seconds: number): void {
    if (!this.mark('upend-ratchet')) return;
    const n = Math.round(seconds / 0.085);
    for (let i = 0; i < n; i++) {
      const t = this.at(i * 0.085);
      this.tone(410 + (i % 3) * 60, t, 0.22, 0.04, 'square');
      this.hiss(t, 0.25, 0.001, 0.03, 'bandpass', 2600, 4);
    }
  }

  groan(seconds: number): void {
    if (!this.mark('upend-groan')) return;
    const ctx = this.ctx!;
    const t = this.at();
    for (const f of [52, 79]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.linearRampToValueAtTime(f * 0.72, t + seconds * 0.5);
      o.frequency.linearRampToValueAtTime(f * 1.1, t + seconds);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.3, t + seconds * 0.3);
      g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 420;
      lp.Q.value = 7;
      o.connect(lp).connect(g).connect(this.fx);
      o.start(t);
      o.stop(t + seconds + 0.1);
    }
  }

  tumble(count: number): void {
    if (!this.mark('upend-tumble')) return;
    const n = Math.min(12, Math.max(3, count));
    for (let i = 0; i < n; i++) this.clang(this.at(i * 0.07 + Math.random() * 0.05), 140 + Math.random() * 170, 0.3, 0.7);
  }

  /** A bell-like strike with a long tail and a roar of fire. */
  winStrike(): void {
    if (!this.mark('win-bell')) return;
    const t = this.at();
    for (const [r, a] of [[1, 0.7], [2, 0.45], [2.4, 0.3], [3, 0.28], [4.2, 0.2], [5.4, 0.14], [6.8, 0.1]] as const) {
      this.tone(196 * r, t, a * 0.75, 4.2 / (1 + r * 0.22), 'sine');
    }
    this.tone(49, t, 0.9, 0.9, 'sine', this.fx, 30);
    this.hiss(t, 0.6, 0.6, 2.8, 'lowpass', 900, 0.7, this.fx, 320);
    this.hiss(t, 0.3, 0.3, 2.0, 'bandpass', 2400, 0.5);
    this.log.push('win-fire');
  }

  lossToll(): void {
    if (!this.mark('loss')) return;
    this.clang(this.at(), 62, 0.7, 3.0);
    this.tone(110, this.at(0.3), 0.3, 2.4, 'sawtooth', this.fx, 55);
  }

  drawCool(): void {
    if (!this.mark('draw')) return;
    this.hiss(this.at(), 0.4, 0.5, 2.2, 'highpass', 2600, 1, this.fx, 600);
    this.tone(147, this.at(), 0.25, 2.2, 'triangle');
  }

  faceOff(): void {
    if (!this.mark('faceoff')) return;
    this.clang(this.at(), 92, 0.9, 2.4);
    this.tone(55, this.at(), 0.9, 0.5, 'sine', this.fx, 30);
    for (let i = 0; i < 12; i++) this.hiss(this.at(i * 0.02), 0.14, 0.001, 0.05, 'highpass', 5500);
  }

  click(): void {
    if (!this.mark('click')) return;
    this.tone(660, this.at(), 0.12, 0.06, 'triangle');
    this.hiss(this.at(), 0.08, 0.001, 0.03, 'highpass', 3000);
  }

  private thump(): void {
    this.log.push('heartbeat');
    const t = this.at();
    this.tone(62, t, 0.8, 0.16, 'sine', this.fx, 40);
    this.tone(56, t + 0.24, 0.6, 0.18, 'sine', this.fx, 36);
  }

  // ---- ambience ----

  private startAmbience(): void {
    const ctx = this.ctx!;
    const loop = (type: BiquadFilterType, freq: number, q: number): { gain: GainNode; pre: GainNode } => {
      const s = ctx.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      const f = ctx.createBiquadFilter();
      f.type = type;
      f.frequency.value = freq;
      f.Q.value = q;
      const pre = ctx.createGain();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      s.connect(f).connect(pre).connect(gain).connect(this.master);
      s.start(0, Math.random());
      return { gain, pre };
    };
    // The lava's rumble.
    const lava = loop('lowpass', 130, 0.8);
    lava.pre.gain.value = 5;
    this.amb.lava = lava.gain;
    // The slow breath of the bellows, every four seconds like the model in the hall.
    const bel = loop('bandpass', 520, 0.7);
    bel.pre.gain.value = 1.2;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 1.55 / (2 * Math.PI);
    const lg = ctx.createGain();
    lg.gain.value = 1.2;
    lfo.connect(lg).connect(bel.pre.gain);
    lfo.start();
    this.amb.bellows = bel.gain;
    // Distant hammering comes from the tick loop.
    this.amb.hammers = ctx.createGain();
    this.amb.hammers.gain.value = 0;
    const far = ctx.createBiquadFilter();
    far.type = 'lowpass';
    far.frequency.value = 1100;
    far.connect(this.amb.hammers).connect(this.master);
    this.hammerBus = far;
  }

  private hammerBus!: AudioNode;

  // ---- music ----

  private startMusic(): void {
    const url = `${import.meta.env.BASE_URL}music/theme.mp3`;
    fetch(url, { method: 'HEAD' })
      .then((r) => {
        const type = r.headers.get('content-type') ?? '';
        if (!r.ok || !type.startsWith('audio')) throw new Error('no theme');
        const el = new Audio(url);
        el.loop = true;
        this.audioEl = el;
        this.musicSource = 'file';
        this.apply();
        return el.play();
      })
      .catch(() => this.startScore());
  }

  /** The generated score: a low drone, anvil percussion at 84 beats a minute, a slow four-note motif. */
  private startScore(): void {
    if (this.musicSource === 'generated') return;
    const ctx = this.ctx!;
    this.audioEl = null;
    this.musicSource = 'generated';
    for (const [f, a] of [[55, 0.22], [55.4, 0.16], [82.4, 0.09], [110, 0.05]] as const) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 240;
      const g = ctx.createGain();
      g.gain.value = a;
      o.connect(lp).connect(g).connect(this.music);
      o.start();
    }
    this.nextBeat = ctx.currentTime + 0.2;
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime;
    const beat = 60 / 84;
    while (this.musicSource === 'generated' && this.nextBeat < now + 0.2) {
      const t = this.nextBeat;
      const s = this.step++;
      if (!this.lastSlots) {
        // Anvil strikes on the beat, a heavier one on the first of four.
        const strong = s % 4 === 0;
        this.clang(t, strong ? 392 : 523, strong ? 0.2 : 0.09, strong ? 0.6 : 0.3, this.music);
        if (strong) this.tone(55, t, 0.5, 0.3, 'sine', this.music, 36);
        if (s % 4 === 2) this.hiss(t, 0.1, 0.002, 0.09, 'highpass', 4000, 1, this.music);
      }
      // The motif: one note every two beats, four notes, then rest for four beats.
      const bar = s % 16;
      if (bar % 2 === 0 && bar < 8) {
        const note = [146.83, 174.61, 164.81, 110][bar / 2];
        this.tone(note, t, 0.2, beat * 2.4, 'triangle', this.music);
        this.tone(note * 2, t, 0.06, beat * 2, 'sine', this.music);
      }
      this.nextBeat += beat;
    }
    if (this.lastSlots && now >= this.nextHeart) { this.thump(); this.nextHeart = now + 1.25; }
    if (now >= this.nextHammer) {
      const n = 2 + Math.floor(Math.random() * 3);
      for (let i = 0; i < n; i++) this.clang(now + i * 0.42, 300 + Math.random() * 40, 0.6, 0.5, this.hammerBus);
      this.nextHammer = now + 3 + Math.random() * 5;
    }
  }

  dispose(): void { window.clearInterval(this.timer); }
}
