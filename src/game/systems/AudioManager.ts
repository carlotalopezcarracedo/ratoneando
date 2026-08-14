import { Save } from './SaveManager';

type MusicTheme = 'menu' | 'tension' | 'heist' | 'victory';

interface Pattern {
  bpm: number;
  bass: readonly number[];
  lead: readonly number[];
  leadWave: OscillatorType;
  leadGain: number;
  bassGain: number;
}

const REST = -1;

/** Notas MIDI. Todo el audio del juego se sintetiza aquí: no hay ficheros externos. */
const PATTERNS: Record<MusicTheme, Pattern> = {
  menu: {
    bpm: 104,
    bass: [40, REST, 47, REST, 38, REST, 45, REST],
    lead: [64, 67, 71, 67, 62, 67, 71, 74],
    leadWave: 'triangle',
    leadGain: 0.05,
    bassGain: 0.09
  },
  tension: {
    bpm: 132,
    bass: [36, 36, 43, 36, 34, 34, 41, 34],
    lead: [60, REST, 63, REST, 65, REST, 63, REST],
    leadWave: 'square',
    leadGain: 0.035,
    bassGain: 0.1
  },
  heist: {
    bpm: 148,
    bass: [33, 33, 40, 33, 31, 31, 38, 43],
    lead: [72, 75, 79, 75, 72, 70, 67, 70],
    leadWave: 'sawtooth',
    leadGain: 0.045,
    bassGain: 0.11
  },
  victory: {
    bpm: 120,
    bass: [41, REST, 48, REST, 43, REST, 50, REST],
    lead: [72, 76, 79, 84, 79, 76, 72, 76],
    leadWave: 'triangle',
    leadGain: 0.055,
    bassGain: 0.08
  }
};

const midiToHz = (n: number): number => 440 * Math.pow(2, (n - 69) / 12);

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private noise: AudioBuffer | null = null;

  private muted = false;
  private theme: MusicTheme | null = null;
  private timer: number | null = null;
  private seqStep = 0;
  private nextTime = 0;

  get isMuted(): boolean {
    return this.muted;
  }

  init(): void {
    this.muted = Save.data.muted;
  }

  private ensure(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor: typeof AudioContext | undefined =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;

    const ctx = new Ctor();
    const master = ctx.createGain();
    master.gain.value = this.muted ? 0 : 0.85;
    master.connect(ctx.destination);

    const sfx = ctx.createGain();
    sfx.gain.value = 1;
    sfx.connect(master);

    const music = ctx.createGain();
    music.gain.value = 0.7;
    music.connect(master);

    // Buffer de ruido blanco reutilizable (ladridos, pasos, impactos).
    const len = Math.floor(ctx.sampleRate * 1.2);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const chan = buf.getChannelData(0);
    for (let i = 0; i < len; i++) chan[i] = Math.random() * 2 - 1;

    this.ctx = ctx;
    this.master = master;
    this.sfxBus = sfx;
    this.musicBus = music;
    this.noise = buf;
    return ctx;
  }

  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  suspend(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    Save.patch({ muted });
    if (this.master && this.ctx) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.85, this.ctx.currentTime, 0.03);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) this.click();
    return this.muted;
  }

  // ---------------------------------------------------------------- helpers

  private tone(
    freq: number,
    dur: number,
    opts: {
      type?: OscillatorType;
      gain?: number;
      to?: number;
      delay?: number;
      attack?: number;
      detune?: number;
    } = {}
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || this.muted) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.type ?? 'triangle';
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.to), t0 + dur);
    if (opts.detune) osc.detune.value = opts.detune;

    const peak = opts.gain ?? 0.18;
    const atk = opts.attack ?? 0.006;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    osc.connect(g).connect(this.sfxBus);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  private noiseBurst(
    dur: number,
    opts: {
      gain?: number;
      freq?: number;
      toFreq?: number;
      q?: number;
      type?: BiquadFilterType;
      delay?: number;
    } = {}
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxBus || !this.noise || this.muted) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;

    const filter = ctx.createBiquadFilter();
    filter.type = opts.type ?? 'bandpass';
    filter.frequency.setValueAtTime(opts.freq ?? 1200, t0);
    if (opts.toFreq !== undefined) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, opts.toFreq), t0 + dur);
    }
    filter.Q.value = opts.q ?? 1.1;

    const g = ctx.createGain();
    const peak = opts.gain ?? 0.14;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

    src.connect(filter).connect(g).connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.05);
  }

  // ------------------------------------------------------------------- sfx

  click(): void {
    this.tone(680, 0.07, { type: 'triangle', gain: 0.15, to: 940 });
  }

  hover(): void {
    this.tone(520, 0.05, { type: 'sine', gain: 0.07 });
  }

  back(): void {
    this.tone(420, 0.1, { type: 'triangle', gain: 0.13, to: 280 });
  }

  /** El ladrido estilizado de Ratón: "¡GUAU!" */
  bark(power = 1): void {
    const p = Math.max(0.5, Math.min(1.6, power));
    this.noiseBurst(0.13 * p, { gain: 0.2 * p, freq: 1500, toFreq: 380, q: 0.9 });
    this.tone(300 * p, 0.16, { type: 'sawtooth', gain: 0.14 * p, to: 110 });
    this.tone(150 * p, 0.2, { type: 'square', gain: 0.07 * p, to: 80, delay: 0.02 });
  }

  alert(): void {
    this.tone(920, 0.09, { type: 'square', gain: 0.12 });
    this.tone(1240, 0.11, { type: 'square', gain: 0.1, delay: 0.09 });
  }

  suspicion(): void {
    this.tone(300, 0.18, { type: 'sine', gain: 0.09, to: 420 });
  }

  success(): void {
    [0, 0.09, 0.18, 0.3].forEach((d, i) => {
      this.tone([523, 659, 784, 1047][i], 0.28, {
        type: 'triangle',
        gain: 0.15,
        delay: d
      });
    });
  }

  fail(): void {
    this.tone(240, 0.5, { type: 'sawtooth', gain: 0.13, to: 70 });
    this.tone(238, 0.5, { type: 'square', gain: 0.06, to: 68, detune: 12 });
    this.noiseBurst(0.35, { gain: 0.07, freq: 500, toFreq: 120, type: 'lowpass' });
  }

  nut(): void {
    this.tone(880, 0.09, { type: 'sine', gain: 0.16, to: 1320 });
    this.noiseBurst(0.06, { gain: 0.08, freq: 3000, q: 2 });
  }

  footstep(): void {
    this.noiseBurst(0.05, { gain: 0.05, freq: 900, toFreq: 260, type: 'lowpass', q: 0.6 });
  }

  thud(): void {
    this.tone(120, 0.22, { type: 'sine', gain: 0.2, to: 55 });
    this.noiseBurst(0.14, { gain: 0.1, freq: 340, toFreq: 90, type: 'lowpass' });
  }

  whoosh(): void {
    this.noiseBurst(0.32, { gain: 0.08, freq: 260, toFreq: 2600, q: 0.7 });
  }

  heartbeat(): void {
    this.tone(66, 0.16, { type: 'sine', gain: 0.2, to: 44 });
    this.tone(62, 0.18, { type: 'sine', gain: 0.16, to: 40, delay: 0.19 });
  }

  bell(): void {
    this.tone(1560, 0.35, { type: 'sine', gain: 0.1, to: 1480 });
    this.tone(2340, 0.22, { type: 'sine', gain: 0.05, delay: 0.01 });
  }

  /** Golpe dramático para el momento del robo. */
  sting(): void {
    [55, 58, 62, 67].forEach((n, i) =>
      this.tone(midiToHz(n), 1.1, { type: 'sawtooth', gain: 0.09, delay: i * 0.012 })
    );
    this.noiseBurst(0.9, { gain: 0.09, freq: 5200, toFreq: 700, q: 0.5 });
    this.tone(48, 1.3, { type: 'sine', gain: 0.16, to: 30 });
  }

  // ----------------------------------------------------------------- music

  playMusic(theme: MusicTheme): void {
    if (this.theme === theme) return;
    this.stopMusic();
    const ctx = this.ensure();
    if (!ctx) return;
    this.theme = theme;
    this.seqStep = 0;
    this.nextTime = ctx.currentTime + 0.08;
    this.timer = window.setInterval(() => this.scheduler(), 30);
  }

  stopMusic(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.theme = null;
  }

  private scheduler(): void {
    const ctx = this.ctx;
    const theme = this.theme;
    if (!ctx || !theme || !this.musicBus) return;
    const pat = PATTERNS[theme];
    const stepDur = 60 / pat.bpm / 2; // corcheas

    while (this.nextTime < ctx.currentTime + 0.2) {
      const i = this.seqStep % 8;
      if (!this.muted) {
        const bassNote = pat.bass[i];
        if (bassNote !== REST) {
          this.musicNote(midiToHz(bassNote), this.nextTime, stepDur * 0.9, 'triangle', pat.bassGain);
        }
        const leadNote = pat.lead[i];
        if (leadNote !== REST) {
          this.musicNote(
            midiToHz(leadNote),
            this.nextTime,
            stepDur * 0.75,
            pat.leadWave,
            pat.leadGain
          );
        }
      }
      this.nextTime += stepDur;
      this.seqStep++;
    }
  }

  private musicNote(
    freq: number,
    at: number,
    dur: number,
    type: OscillatorType,
    gain: number
  ): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus) return;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    osc.connect(g).connect(this.musicBus);
    osc.start(at);
    osc.stop(at + dur + 0.03);
  }
}

export const Audio = new AudioManager();
