'use client';

import { useEffect, useRef } from 'react';
import {
  CUE_TARGETS,
  type CueState,
  type CueTarget,
  type EffectType,
  type RosterEntry,
  type Zone,
  xToZone,
} from '@/shared/protocol';
import { fxRgb, rgbToCss } from '@/shared/effects';

export interface CueControlsState {
  color: string;
  speed: number;
  width: number;
  loop: boolean;
  targetZone: CueTarget;
}

interface LightShowSectionProps {
  roster: RosterEntry[];
  fakePhones: RosterEntry[];
  zoneCues: Record<Zone, CueState>;
  controls: CueControlsState;
  onChangeControls: (patch: Partial<CueControlsState>) => void;
  onTriggerCue: (fx: EffectType, dir?: 1 | -1) => void;
  onBlackout: () => void;
}

export function LightShowSection({
  roster,
  fakePhones,
  zoneCues,
  controls,
  onChangeControls,
  onTriggerCue,
  onBlackout,
}: LightShowSectionProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const dataRef = useRef({ roster, fakePhones, zoneCues });
  dataRef.current = { roster, fakePhones, zoneCues };

  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const cv = canvasRef.current;
      if (cv) {
        const g = cv.getContext('2d');
        if (g) {
          const dpr = window.devicePixelRatio || 1;
          const w = cv.clientWidth || 320;
          const h = cv.clientHeight || 200;
          if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
            cv.width = Math.round(w * dpr);
            cv.height = Math.round(h * dpr);
          }
          g.setTransform(dpr, 0, 0, dpr, 0, 0);
          g.fillStyle = '#050507';
          g.fillRect(0, 0, w, h);

          g.strokeStyle = '#1f1f26';
          g.setLineDash([4, 4]);
          g.beginPath();
          g.moveTo(w / 3, 0);
          g.lineTo(w / 3, h);
          g.moveTo((2 * w) / 3, 0);
          g.lineTo((2 * w) / 3, h);
          g.stroke();
          g.setLineDash([]);

          const now = Date.now();
          const pad = 16;
          const allPts = [...dataRef.current.roster, ...dataRef.current.fakePhones];
          for (const p of allPts) {
            const z = p.zone ?? xToZone(p.x);
            const activeCue = dataRef.current.zoneCues[z];
            const px = pad + p.x * (w - 2 * pad);
            const py = pad + 14 + p.seed * (h - 2 * pad - 22);
            const isOff = !activeCue || activeCue.fx === 'off';
            const rgb = isOff ? [120, 120, 110] as [number, number, number] : fxRgb(activeCue, p.x, p.seed, now);
            g.fillStyle = rgbToCss(rgb);
            g.beginPath();
            g.arc(px, py, p.speakerRole === 'crowd' ? 5 : 7.5, 0, Math.PI * 2);
            g.fill();
          }

          g.fillStyle = '#ffd166';
          g.font = '11px sans-serif';
          g.fillText('🔊 LEFT', 8, 14);
          g.fillText('CENTER', w / 2 - 22, 14);
          g.fillText('RIGHT 🔊', w - 62, 14);
        }
      }
      raf = window.requestAnimationFrame(draw);
    };
    raf = window.requestAnimationFrame(draw);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold tracking-widest text-[#9a968c] uppercase">
        2 · Live Crowd Map &amp; Light Show Cues
      </h2>
      <canvas
        ref={canvasRef}
        data-testid="crowd-map"
        className="block h-[200px] w-full rounded-2xl border border-[#2a2a30] bg-[#050507]"
      />

      <div className="mt-3 flex items-center justify-between gap-2 rounded-2xl border border-[#2a2a30] bg-[#16161a] p-2.5">
        <span className="text-xs font-semibold text-[#9a968c]">Target Zone:</span>
        <div className="flex gap-1.5">
          {CUE_TARGETS.map((tz) => (
            <button
              key={tz}
              data-testid={`target-zone-${tz}`}
              type="button"
              onClick={() => onChangeControls({ targetZone: tz })}
              className={`cursor-pointer rounded-xl px-3 py-1.5 text-xs font-bold ${
                controls.targetZone === tz
                  ? 'bg-[#ffd166] text-[#111]'
                  : 'bg-[#0d0d10] text-[#f4f1ea]'
              }`}
            >
              {tz}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-2">
        <button data-testid="cue-wave-right" type="button" onClick={() => onTriggerCue('wave', 1)} className="cursor-pointer rounded-xl border border-[#2a2a30] bg-[#16161a] py-3 font-semibold">🌊 Wave →</button>
        <button data-testid="cue-wave-left" type="button" onClick={() => onTriggerCue('wave', -1)} className="cursor-pointer rounded-xl border border-[#2a2a30] bg-[#16161a] py-3 font-semibold">🌊 Wave ←</button>
        <button data-testid="cue-bounce" type="button" onClick={() => onTriggerCue('bounce', 1)} className="cursor-pointer rounded-xl border border-[#2a2a30] bg-[#16161a] py-3 font-semibold">↔ Ping-pong</button>
        <button data-testid="cue-rainbow" type="button" onClick={() => onTriggerCue('rainbow', 1)} className="cursor-pointer rounded-xl border border-[#2a2a30] bg-[#16161a] py-3 font-semibold">🌈 Rainbow</button>
        <button data-testid="cue-sparkle" type="button" onClick={() => onTriggerCue('sparkle', 1)} className="cursor-pointer rounded-xl border border-[#2a2a30] bg-[#16161a] py-3 font-semibold">✨ Sparkle</button>
        <button data-testid="cue-flash" type="button" onClick={() => onTriggerCue('flash', 1)} className="cursor-pointer rounded-xl border border-[#2a2a30] bg-[#16161a] py-3 font-semibold">⚡ Flash</button>
        <button data-testid="cue-split" type="button" onClick={() => onTriggerCue('split', 1)} className="cursor-pointer rounded-xl border border-[#2a2a30] bg-[#16161a] py-3 font-semibold">◐ Split L/R</button>
        <button data-testid="cue-solid" type="button" onClick={() => onTriggerCue('solid', 1)} className="cursor-pointer rounded-xl border border-[#2a2a30] bg-[#16161a] py-3 font-semibold">● Solid colour</button>
      </div>

      <button
        data-testid="cue-blackout"
        type="button"
        onClick={onBlackout}
        className="mt-2 w-full cursor-pointer rounded-xl border border-[#4a2222] bg-[#1c1010] py-3 font-bold text-[#ff6b6b]"
      >
        ■ Blackout ({controls.targetZone})
      </button>

      <div className="mt-2.5 rounded-2xl border border-[#2a2a30] bg-[#16161a] p-3.5">
        <div className="flex items-center justify-between gap-4">
          <span className="text-xs text-[#9a968c]">Cue Colour</span>
          <input
            data-testid="cue-color"
            type="color"
            value={controls.color}
            onChange={(e) => onChangeControls({ color: e.target.value })}
            className="h-9 w-24 cursor-pointer border-0 bg-transparent"
          />
        </div>
        <div className="mt-2 text-xs text-[#9a968c]">Speed ({controls.speed}%)</div>
        <input
          data-testid="cue-speed"
          type="range"
          min={20}
          max={300}
          value={controls.speed}
          onChange={(e) => onChangeControls({ speed: Number(e.target.value) })}
          className="w-full"
        />
        <div className="mt-1 text-xs text-[#9a968c]">Wave Width ({controls.width}%)</div>
        <input
          data-testid="cue-width"
          type="range"
          min={4}
          max={45}
          value={controls.width}
          onChange={(e) => onChangeControls({ width: Number(e.target.value) })}
          className="w-full"
        />
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-[#9a968c]">
          <input
            data-testid="cue-loop"
            type="checkbox"
            checked={controls.loop}
            onChange={(e) => onChangeControls({ loop: e.target.checked })}
            className="h-4 w-4"
          />
          Loop wave effects continuously
        </label>
      </div>
    </section>
  );
}
