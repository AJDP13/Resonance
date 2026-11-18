export const SOUND_SPEED_MS = 343;

export const CHIRP_CONFIG = {
  dur: 0.06,
  L: [2000, 4000] as const,
  R: [4500, 6500] as const,
};

export const CHIRP_SCHED = {
  L: [1.0, 2.2, 3.4, 4.6] as readonly number[],
  R: [1.6, 2.8, 4.0, 5.2] as readonly number[],
  windowSec: 6.4,
};

export function makeChirp(
  sr: number,
  f0: number,
  f1: number,
  dur: number = CHIRP_CONFIG.dur
): Float32Array {
  const n = Math.round(sr * dur);
  const out = new Float32Array(n);
  const k = (f1 - f0) / dur;
  const taper = Math.round(n * 0.15);
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    let w = 1;
    if (i < taper) {
      w = 0.5 - 0.5 * Math.cos((Math.PI * i) / taper);
    } else if (i > n - 1 - taper) {
      w = 0.5 - 0.5 * Math.cos((Math.PI * (n - 1 - i)) / taper);
    }
    out[i] = w * Math.sin(2 * Math.PI * (f0 * t + 0.5 * k * t * t));
  }
  return out;
}

export function fft(re: Float64Array, im: Float64Array, inv: boolean): void {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      const tr = re[i];
      re[i] = re[j];
      re[j] = tr;
      const ti = im[i];
      im[i] = im[j];
      im[j] = ti;
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((2 * Math.PI) / len) * (inv ? 1 : -1);
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    const half = len >> 1;
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let j = 0; j < half; j++) {
        const a = i + j;
        const b = a + half;
        const xr = re[b] * cr - im[b] * ci;
        const xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr;
        im[b] = im[a] - xi;
        re[a] += xr;
        im[a] += xi;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
  if (inv) {
    for (let i = 0; i < n; i++) {
      re[i] /= n;
      im[i] /= n;
    }
  }
}

export function envelope(c: Float64Array, len: number, w: number): Float32Array {
  const env = new Float32Array(len);
  for (let i = 0; i < len; i++) {
    let m = 0;
    const a = Math.max(0, i - w);
    const b = Math.min(len - 1, i + w);
    for (let j = a; j <= b; j += 2) {
      const v = Math.abs(c[j]);
      if (v > m) m = v;
    }
    env[i] = m;
  }
  return env;
}

export function correlate(x: Float32Array, templates: Float32Array[]): Float32Array[] {
  let maxT = 0;
  for (const h of templates) maxT = Math.max(maxT, h.length);
  let size = 1;
  while (size < x.length + maxT) size <<= 1;
  const xr = new Float64Array(size);
  const xi = new Float64Array(size);
  xr.set(x);
  fft(xr, xi, false);

  const out: Float32Array[] = [];
  for (const h of templates) {
    const hr = new Float64Array(size);
    const hi = new Float64Array(size);
    hr.set(h);
    fft(hr, hi, false);
    for (let i = 0; i < size; i++) {
      const r = xr[i] * hr[i] + xi[i] * hi[i];
      const im = xi[i] * hr[i] - xr[i] * hi[i];
      hr[i] = r;
      hi[i] = im;
    }
    fft(hr, hi, true);
    out.push(envelope(hr, x.length, 24));
  }
  return out;
}
