export type SynthTrackId = 'neon' | 'festival' | 'cosmic';

export interface MusicFrameInfo {
  bass: number;
  mid: number;
  high: number;
  bands: number[];
  isBeat: boolean;
  beatCount: number;
}

interface SynthPreset {
  bpm: number;
  notes: readonly number[];
  wave: OscillatorType;
}

const PRESETS: Record<SynthTrackId, SynthPreset> = {
  neon: { bpm: 124, notes: [110, 130.81, 146.83, 164.81, 196, 164.81, 146.83, 130.81], wave: 'sawtooth' },
  festival: { bpm: 128, notes: [130.81, 130.81, 196, 174.61, 164.81, 146.83, 196, 261.63], wave: 'square' },
  cosmic: { bpm: 96, notes: [98, 123.47, 146.83, 196, 220, 196, 146.83, 123.47], wave: 'triangle' },
};

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

export class ClientMusicEngine {
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private audioEl: HTMLAudioElement | null = null;
  private mediaSource: MediaElementAudioSourceNode | null = null;
  private objectUrl: string | null = null;
  private synthTimer: number | null = null;
  private rafId: number | null = null;
  private stepIdx = 0;
  private beatCount = 0;
  private lastBeatMs = 0;
  private prevBass = 0;
  private playing = false;

  private ensureGraph(): { ctx: AudioContext; analyser: AnalyserNode; master: GainNode } {
    if (!this.ctx || !this.analyser || !this.masterGain) {
      const win = window as WebkitWindow;
      const Ctor = window.AudioContext ?? win.webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio unavailable');
      this.ctx = new Ctor();
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.72;
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;
      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return { ctx: this.ctx, analyser: this.analyser, master: this.masterGain };
  }

  loadLocalFile(file: File): string {
    this.stop();
    if (this.objectUrl) URL.revokeObjectURL(this.objectUrl);
    this.objectUrl = URL.createObjectURL(file);
    const { ctx, master } = this.ensureGraph();
    if (!this.audioEl) {
      this.audioEl = new Audio();
      this.audioEl.crossOrigin = 'anonymous';
      this.mediaSource = ctx.createMediaElementSource(this.audioEl);
      this.mediaSource.connect(master);
    }
    this.audioEl.src = this.objectUrl;
    this.audioEl.load();
    return file.name;
  }

  async playFile(onFrame: (info: MusicFrameInfo) => void, onEnded?: () => void): Promise<void> {
    if (!this.audioEl || !this.audioEl.src) return;
    this.stopLoopsOnly();
    const { ctx } = this.ensureGraph();
    if (ctx.state === 'suspended') await ctx.resume();
    this.audioEl.onended = () => {
      this.playing = false;
      this.stopLoopsOnly();
      onEnded?.();
    };
    await this.audioEl.play();
    this.playing = true;
    this.startMeterLoop(onFrame);
  }

  startSynth(track: SynthTrackId, onFrame: (info: MusicFrameInfo) => void): void {
    this.stop();
    const { ctx, master } = this.ensureGraph();
    const preset = PRESETS[track];
    const stepMs = (60 / preset.bpm / 2) * 1000;
    this.stepIdx = 0;
    this.playing = true;

    const triggerStep = (): void => {
      if (!this.playing) return;
      const now = ctx.currentTime;
      if (this.stepIdx % 2 === 0) {
        const kick = ctx.createOscillator();
        const kGain = ctx.createGain();
        kick.type = 'sine';
        kick.frequency.setValueAtTime(150, now);
        kick.frequency.exponentialRampToValueAtTime(42, now + 0.14);
        kGain.gain.setValueAtTime(0.9, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        kick.connect(kGain);
        kGain.connect(master);
        kick.start(now);
        kick.stop(now + 0.19);
      }
      const freq = preset.notes[this.stepIdx % preset.notes.length] ?? 110;
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = preset.wave;
      osc.frequency.setValueAtTime(this.stepIdx % 4 === 3 ? freq * 2 : freq, now);
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.2);
      g.gain.setValueAtTime(0.28, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      osc.connect(filter);
      filter.connect(g);
      g.connect(master);
      osc.start(now);
      osc.stop(now + 0.23);
      this.stepIdx += 1;
    };

    triggerStep();
    this.synthTimer = window.setInterval(triggerStep, stepMs);
    this.startMeterLoop(onFrame);
  }

  setVolume(vol: number): void {
    if (this.masterGain) this.masterGain.gain.value = Math.max(0, Math.min(1, vol));
  }

  private startMeterLoop(onFrame: (info: MusicFrameInfo) => void): void {
    const { analyser } = this.ensureGraph();
    const bins = new Uint8Array(analyser.frequencyBinCount);
    const tick = (): void => {
      if (!this.playing) return;
      analyser.getByteFrequencyData(bins);
      const avg = (lo: number, hi: number): number => {
        let sum = 0;
        for (let i = lo; i < hi; i++) sum += bins[i] ?? 0;
        return sum / Math.max(1, hi - lo) / 255;
      };
      const bass = avg(0, 8);
      const mid = avg(8, 32);
      const high = avg(32, 80);
      const bands = [avg(0, 4), avg(4, 10), avg(10, 20), avg(20, 36), avg(36, 60), avg(60, 96)];
      const now = performance.now();
      const isBeat = bass > 0.42 && bass - this.prevBass > 0.08 && now - this.lastBeatMs > 280;
      this.prevBass = bass * 0.65 + this.prevBass * 0.35;
      if (isBeat) {
        this.lastBeatMs = now;
        this.beatCount += 1;
      }
      onFrame({ bass, mid, high, bands, isBeat, beatCount: this.beatCount });
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  private stopLoopsOnly(): void {
    if (this.synthTimer !== null) {
      window.clearInterval(this.synthTimer);
      this.synthTimer = null;
    }
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  stop(): void {
    this.playing = false;
    this.stopLoopsOnly();
    if (this.audioEl && !this.audioEl.paused) {
      this.audioEl.pause();
      this.audioEl.currentTime = 0;
    }
  }
}
