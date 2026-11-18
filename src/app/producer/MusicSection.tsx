'use client';

import { useEffect, useRef, useState } from 'react';
import type { CueTarget, EffectType } from '@/shared/protocol';
import { ClientMusicEngine, type MusicFrameInfo, type SynthTrackId } from '../_lib/music-engine';

const STAGE_PALETTE = ['#ffd166', '#ff4d6d', '#00f5d4', '#9b5de5', '#00bbf9', '#7bd88f'] as const;
const ZONE_ROTATION: readonly CueTarget[] = ['Left', 'Center', 'Right'];

export interface ReactiveCueDispatch {
  fx: EffectType; color: string; speed: number; dir: 1 | -1; targetZone: CueTarget; intensity: number;
}

export function MusicSection({ onMusicCue }: { onMusicCue: (cue: ReactiveCueDispatch) => void }) {
  const engineRef = useRef<ClientMusicEngine | null>(null);
  const [sourceMode, setSourceMode] = useState<'synth' | 'file'>('synth');
  const [synthTrack, setSynthTrack] = useState<SynthTrackId>('neon');
  const [fileName, setFileName] = useState<string>('');
  const [playing, setPlaying] = useState(false);
  const [syncLights, setSyncLights] = useState(true);
  const [reactiveStyle, setReactiveStyle] = useState<'festival' | 'chase' | 'strobe'>('festival');
  const [volume, setVolume] = useState(85);
  const [bands, setBands] = useState<number[]>([0, 0, 0, 0, 0, 0]);

  const syncRef = useRef({ syncLights, reactiveStyle, onMusicCue });
  syncRef.current = { syncLights, reactiveStyle, onMusicCue };

  useEffect(() => {
    engineRef.current = new ClientMusicEngine();
    return () => engineRef.current?.stop();
  }, []);

  const handleFrame = (info: MusicFrameInfo) => {
    setBands(info.bands);
    const { syncLights: sync, reactiveStyle: style, onMusicCue: dispatch } = syncRef.current;
    if (!sync || !info.isBeat) return;
    const col = STAGE_PALETTE[info.beatCount % STAGE_PALETTE.length] ?? '#ffd166';
    const intensity = Math.min(1, Math.max(0.55, info.bass + 0.25));
    if (style === 'chase') {
      const tz = ZONE_ROTATION[info.beatCount % ZONE_ROTATION.length] ?? 'Center';
      dispatch({ fx: 'flash', color: col, speed: 130, dir: 1, targetZone: tz, intensity });
      return;
    }
    if (style === 'strobe') {
      dispatch({ fx: 'flash', color: col, speed: 160, dir: 1, targetZone: 'All', intensity });
      return;
    }
    const barStep = info.beatCount % 8;
    const fx: EffectType = barStep === 0 ? 'rainbow' : barStep === 4 ? 'split' : barStep % 2 === 0 ? 'wave' : 'flash';
    dispatch({ fx, color: col, speed: 135, dir: info.beatCount % 4 < 2 ? 1 : -1, targetZone: 'All', intensity });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !engineRef.current) return;
    setFileName(engineRef.current.loadLocalFile(file));
    setSourceMode('file');
    setPlaying(false);
  };

  const handlePlay = async () => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.setVolume(volume / 100);
    if (sourceMode === 'file' && fileName) {
      await eng.playFile(handleFrame, () => setPlaying(false));
    } else {
      eng.startSynth(synthTrack, handleFrame);
    }
    setPlaying(true);
  };

  const handleStop = () => {
    engineRef.current?.stop();
    setPlaying(false);
    setBands([0, 0, 0, 0, 0, 0]);
  };

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold tracking-widest text-[#9a968c] uppercase">
        3 · Music &amp; MP3 Reactive Show
      </h2>
      <div className="rounded-2xl border border-[#2a2a30] bg-[#16161a] p-3.5">
        <div className="grid grid-cols-2 gap-2">
          <button
            data-testid="music-mode-synth"
            type="button"
            onClick={() => { handleStop(); setSourceMode('synth'); }}
            className={`cursor-pointer rounded-xl py-2 text-xs font-bold ${sourceMode === 'synth' ? 'bg-[#ffd166] text-[#111]' : 'bg-[#0d0d10] text-[#f4f1ea]'}`}
          >
            🎹 Built-in Synth Music
          </button>
          <label
            data-testid="music-file-label"
            className={`flex cursor-pointer items-center justify-center rounded-xl py-2 text-xs font-bold ${sourceMode === 'file' ? 'bg-[#ffd166] text-[#111]' : 'bg-[#0d0d10] text-[#f4f1ea]'}`}
          >
            🎵 Load MP3 / Audio
            <input data-testid="music-file-input" type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a" onChange={handleFileChange} className="hidden" />
          </label>
        </div>

        {sourceMode === 'synth' ? (
          <select
            data-testid="music-track-select"
            value={synthTrack}
            onChange={(e) => {
              const next = e.target.value as SynthTrackId;
              setSynthTrack(next);
              if (playing) engineRef.current?.startSynth(next, handleFrame);
            }}
            className="mt-2.5 w-full rounded-xl border border-[#2a2a30] bg-[#0d0d10] p-2.5 text-sm text-[#f4f1ea]"
          >
            <option value="neon">Neon Pulse — 124 BPM Synthwave</option>
            <option value="festival">Stage Anthem — 128 BPM Electro</option>
            <option value="cosmic">Cosmic Wave — 96 BPM Chill</option>
          </select>
        ) : (
          <div data-testid="music-file-name" className="mt-2.5 truncate rounded-xl bg-[#0d0d10] px-3 py-2 text-xs text-[#ffd166]">
            {fileName ? `Loaded locally: ${fileName}` : 'Choose an MP3 or audio file above'}
          </div>
        )}

        <div className="mt-3 flex h-10 items-end gap-1.5 rounded-xl bg-[#050507] px-3 py-2">
          {bands.map((b, idx) => (
            <div key={idx} style={{ height: `${Math.max(12, Math.round(b * 100))}%` }} className="flex-1 rounded-sm bg-[#ffd166] transition-all duration-75" />
          ))}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            data-testid="music-play-btn"
            type="button"
            disabled={sourceMode === 'file' && !fileName}
            onClick={() => void handlePlay()}
            className="cursor-pointer rounded-xl bg-[#7bd88f] py-2.5 text-sm font-bold text-[#111] disabled:opacity-40"
          >
            {playing ? '↻ Restart Music' : '▶ Play Music'}
          </button>
          <button data-testid="music-stop-btn" type="button" onClick={handleStop} className="cursor-pointer rounded-xl border border-[#2a2a30] bg-[#0d0d10] py-2.5 text-sm font-semibold">
            ■ Stop Music
          </button>
        </div>

        <div className="mt-2.5 flex items-center justify-between gap-3 text-xs text-[#9a968c]">
          <span>Volume</span>
          <input
            data-testid="music-volume"
            type="range" min={0} max={100} value={volume}
            onChange={(e) => { const v = Number(e.target.value); setVolume(v); engineRef.current?.setVolume(v / 100); }}
            className="w-40"
          />
        </div>

        <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-[#2a2a30] pt-2.5">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-[#f4f1ea]">
            <input data-testid="music-sync-toggle" type="checkbox" checked={syncLights} onChange={(e) => setSyncLights(e.target.checked)} className="h-4 w-4" />
            Auto-sync crowd light show to beats
          </label>
          <select
            data-testid="music-style-select"
            value={reactiveStyle}
            onChange={(e) => setReactiveStyle(e.target.value as 'festival' | 'chase' | 'strobe')}
            className="rounded-lg border border-[#2a2a30] bg-[#0d0d10] px-2 py-1 text-xs text-[#f4f1ea]"
          >
            <option value="festival">Festival Mix</option>
            <option value="chase">Zone Chase (L/C/R)</option>
            <option value="strobe">Bass Strobe</option>
          </select>
        </div>
      </div>
    </section>
  );
}
