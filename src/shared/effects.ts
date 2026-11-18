import type { CueState } from './protocol';

export function hash01(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.startsWith('#') ? hex.slice(1) : hex;
  const n = Number.parseInt(clean, 16);
  if (Number.isNaN(n)) return [255, 255, 255];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const hh = (((h % 360) + 360) % 360) / 60;
  const i = Math.floor(hh) % 6;
  const f = hh - Math.floor(hh);
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));
  const table: Array<[number, number, number]> = [
    [v, t, p],
    [q, v, p],
    [p, v, t],
    [p, q, v],
    [t, p, v],
    [v, p, q],
  ];
  const rgb = table[i] ?? [v, v, v];
  return [Math.round(rgb[0] * 255), Math.round(rgb[1] * 255), Math.round(rgb[2] * 255)];
}

export function fxRgb(
  cue: CueState | null | undefined,
  x: number,
  seed: number,
  nowMs: number
): [number, number, number] {
  if (!cue || cue.fx === 'off') return [0, 0, 0];
  const elapsed = Math.max(0, nowMs - cue.at);
  const baseCol = hexToRgb(cue.color || '#ffffff');
  const sp = Math.max(0.1, (cue.speed || 100) / 100);
  const gain = Math.min(1, Math.max(0, cue.intensity ?? 1));
  const scale = (k: number): [number, number, number] => {
    const f = Math.min(1, Math.max(0, k * gain));
    return [
      Math.round(baseCol[0] * f),
      Math.round(baseCol[1] * f),
      Math.round(baseCol[2] * f),
    ];
  };

  switch (cue.fx) {
    case 'solid':
      return scale(1);
    case 'flash': {
      const k = Math.max(0, 1 - elapsed / (600 / sp));
      return scale(k);
    }
    case 'pulse': {
      const k = 0.25 + 0.75 * (0.5 + 0.5 * Math.cos((elapsed / (480 / sp)) * Math.PI * 2));
      return scale(k);
    }
    case 'wave':
    case 'bounce': {
      const dur = 2600 / sp;
      const w = Math.max(0.03, (cue.width || 14) / 100);
      const cyc = elapsed / dur;
      if (!cue.loop && cyc > 1) return [0, 0, 0];
      const p = cyc - Math.floor(cyc);
      let dir: number = cue.dir || 1;
      if (cue.fx === 'bounce' && Math.floor(cyc) % 2 === 1) dir = -dir;
      let pos = -0.25 + 1.5 * p;
      if (dir < 0) pos = 1 - pos;
      const d = (x - pos) / w;
      return scale(Math.exp(-d * d));
    }
    case 'rainbow': {
      const rgb = hsvToRgb(x * 300 - elapsed * 0.15 * sp, 1, gain);
      return rgb;
    }
    case 'sparkle': {
      const slot = Math.floor(elapsed / (140 / sp));
      const r = hash01(`${seed.toFixed(5)}:${slot}`);
      return r < 0.14 ? scale(1) : scale(0.05);
    }
    case 'split': {
      const half = Math.floor(elapsed / (700 / sp)) % 2;
      return (x < 0.5) === (half === 0) ? scale(1) : [0, 0, 0];
    }
    default:
      return [0, 0, 0];
  }
}

export function rgbToCss(rgb: [number, number, number]): string {
  return `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
}
