import { CHIRP_CONFIG, CHIRP_SCHED, makeChirp } from '@/shared/dsp-core';
import { analyseRecording, type ChirpAnalysis } from '@/shared/dsp-locate';

interface WebkitWindow extends Window {
  webkitAudioContext?: typeof AudioContext;
}

class InMemoryChirpAudio {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private chunks: Float32Array[] = [];
  private capturing = false;
  private micReady = false;
  private nodes: AudioNode[] = [];

  ensureContext(): AudioContext {
    if (!this.ctx) {
      const win = window as WebkitWindow;
      const Ctor = window.AudioContext ?? win.webkitAudioContext;
      if (!Ctor) throw new Error('Web Audio API unavailable');
      this.ctx = new Ctor();
    }
    return this.ctx;
  }

  async init(wantMic: boolean): Promise<boolean> {
    const ctx = this.ensureContext();
    try {
      if (ctx.state === 'suspended') await ctx.resume();
      const silent = ctx.createBuffer(1, 1, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = silent;
      src.connect(ctx.destination);
      src.start();
    } catch {
      // Non-fatal unlock failure
    }
    if (!wantMic) return this.micReady;
    if (this.micReady && this.stream) return true;

    if (!navigator.mediaDevices?.getUserMedia) return false;
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1,
        },
      });
    } catch {
      return false;
    }

    const source = ctx.createMediaStreamSource(this.stream);
    const proc = ctx.createScriptProcessor(4096, 1, 1);
    const mute = ctx.createGain();
    mute.gain.value = 0;
    proc.onaudioprocess = (ev: AudioProcessingEvent) => {
      if (!this.capturing) return;
      const input = ev.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(input));
    };
    source.connect(proc);
    proc.connect(mute);
    mute.connect(ctx.destination);
    this.nodes = [source, proc, mute];
    this.micReady = true;
    return true;
  }

  hasMic(): boolean {
    return this.micReady && Boolean(this.nodes.length);
  }

  playChirps(role: 'L' | 'R', offsetsSec: readonly number[]): void {
    const ctx = this.ensureContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const band = CHIRP_CONFIG[role];
    const pcm = makeChirp(ctx.sampleRate, band[0], band[1]);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const now = ctx.currentTime;
    for (const dt of offsetsSec) {
      const src = ctx.createBufferSource();
      const gain = ctx.createGain();
      gain.gain.value = 0.95;
      src.buffer = buf;
      src.connect(gain);
      gain.connect(ctx.destination);
      src.start(now + dt);
    }
  }

  async runCalibrationWindow(emitRole: 'L' | 'R' | null): Promise<ChirpAnalysis | null> {
    if (!this.micReady || !this.ctx) {
      if (emitRole) this.playChirps(emitRole, CHIRP_SCHED[emitRole]);
      return null;
    }
    if (this.ctx.state === 'suspended') await this.ctx.resume();
    this.chunks = [];
    this.capturing = true;
    if (emitRole) {
      this.playChirps(emitRole, CHIRP_SCHED[emitRole]);
    }
    await new Promise<void>((resolve) => {
      window.setTimeout(resolve, CHIRP_SCHED.windowSec * 1000);
    });
    this.capturing = false;

    const totalLen = this.chunks.reduce((acc, c) => acc + c.length, 0);
    const merged = new Float32Array(totalLen);
    let offset = 0;
    for (const chunk of this.chunks) {
      merged.set(chunk, offset);
      offset += chunk.length;
    }
    this.chunks = [];
    const sr = this.ctx.sampleRate;
    const result = analyseRecording(merged, sr);
    merged.fill(0);
    return result;
  }
}

export const chirpAudio = new InMemoryChirpAudio();
