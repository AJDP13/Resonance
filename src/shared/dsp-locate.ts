import { CHIRP_CONFIG, CHIRP_SCHED, SOUND_SPEED_MS, correlate, makeChirp } from './dsp-core';

export interface ArrivalPeak { t: number; v: number }
export interface OffsetCandidate { D: number; n: number }
export interface ChirpAnalysis {
  ok: boolean;
  cands: OffsetCandidate[];
  D: number | null;
  n: number;
  nL: number;
  nR: number;
  snrL: number;
  snrR: number;
}
export interface BeaconSolution { DL: number; DR: number; dLR: number; score: number }
export interface LocatedPosition { dLR: number; diff: number; u: number; x: number }

function keepSpaced(peaks: ArrivalPeak[], sr: number): ArrivalPeak[] {
  const gap = (CHIRP_SCHED.L[1] - CHIRP_SCHED.L[0]) * sr;
  const tol = 0.006 * sr;
  return peaks.filter((p) =>
    peaks.some((q) => {
      if (q === p) return false;
      const d = Math.abs(q.t - p.t);
      for (let k = 1; k <= 3; k++) if (Math.abs(d - k * gap) < tol) return true;
      return false;
    })
  );
}

export function findArrivals(
  env: Float32Array,
  sr: number,
  envRev?: Float32Array,
  maxCount = 10
): { peaks: ArrivalPeak[]; snr: number } {
  const sub: number[] = [];
  let gmax = 0;
  for (let i = 0; i < env.length; i++) if (env[i] > gmax) gmax = env[i];
  for (let i = 0; i < env.length; i += 50) sub.push(env[i]);
  sub.sort((a, b) => a - b);
  const median = sub[Math.floor(sub.length / 2)] || 0;
  const work = Float32Array.from(env);
  const peaks: ArrivalPeak[] = [];
  const sup = Math.round(0.25 * sr);
  const back = Math.round(0.06 * sr);
  const near = Math.round(0.004 * sr);
  let thr = 7 * median;

  for (let k = 0; k < maxCount + 40 && peaks.length < maxCount; k++) {
    let idx = 0;
    let val = 0;
    for (let i = 0; i < work.length; i++) {
      if (work[i] > val) { val = work[i]; idx = i; }
    }
    if (val <= 0 || val < thr) break;
    let rev = 0;
    if (envRev) {
      for (let i = Math.max(0, idx - near); i < Math.min(envRev.length, idx + near); i++) {
        if (envRev[i] > rev) rev = envRev[i];
      }
    }
    const isNoise = Boolean(envRev && val < 2.5 * rev);
    const w = isNoise ? Math.round(0.07 * sr) : sup;
    for (let i = Math.max(0, idx - w); i < Math.min(work.length, idx + w); i++) work[i] = 0;
    if (isNoise) continue;
    if (!peaks.length) thr = Math.max(thr, 0.2 * val);
    let first = idx;
    for (let i = Math.max(0, idx - back); i < idx; i++) {
      if (env[i] >= Math.max(0.3 * val, thr)) { first = i; break; }
    }
    peaks.push({ t: first, v: val });
  }
  peaks.sort((a, b) => a.t - b.t);
  return { peaks: keepSpaced(peaks, sr), snr: median > 0 ? Math.round(gmax / median) : 99 };
}

export function pairOffset(tL: number[], tR: number[], sr: number): OffsetCandidate[] {
  const win = sr * 1.0;
  const tol = sr * 0.002;
  const diffs: number[] = [];
  for (const a of tL) for (const b of tR) if (Math.abs(b - a) < win) diffs.push(b - a);
  diffs.sort((a, b) => a - b);
  const used = new Array<boolean>(diffs.length).fill(false);
  const cands: OffsetCandidate[] = [];
  while (true) {
    let best: number[] | null = null;
    for (let i = 0; i < diffs.length; i++) {
      if (used[i]) continue;
      const cl: number[] = [];
      for (let j = 0; j < diffs.length; j++) {
        if (!used[j] && Math.abs(diffs[j] - diffs[i]) <= tol) cl.push(j);
      }
      if (!best || cl.length > best.length) best = cl;
    }
    if (!best) break;
    for (const j of best) used[j] = true;
    const vals = best.map((j) => diffs[j]);
    cands.push({ D: vals[Math.floor(vals.length / 2)] / sr, n: vals.length });
  }
  cands.sort((a, b) => b.n - a.n);
  return cands.slice(0, 6);
}

export function analyseRecording(samples: Float32Array, sr: number): ChirpAnalysis {
  const hL = makeChirp(sr, CHIRP_CONFIG.L[0], CHIRP_CONFIG.L[1]);
  const hLr = makeChirp(sr, CHIRP_CONFIG.L[1], CHIRP_CONFIG.L[0]);
  const hR = makeChirp(sr, CHIRP_CONFIG.R[0], CHIRP_CONFIG.R[1]);
  const hRr = makeChirp(sr, CHIRP_CONFIG.R[1], CHIRP_CONFIG.R[0]);
  const [eL, eLr, eR, eRr] = correlate(samples, [hL, hLr, hR, hRr]);
  const aL = findArrivals(eL, sr, eLr);
  const aR = findArrivals(eR, sr, eRr);
  const cands = pairOffset(aL.peaks.map((p) => p.t), aR.peaks.map((p) => p.t), sr);
  const good = cands.filter((c) => c.n >= 3);
  return {
    ok: good.length > 0,
    cands: good.length > 0 ? good : cands,
    D: cands.length > 0 ? cands[0].D : null,
    n: cands.length > 0 ? cands[0].n : 0,
    nL: aL.peaks.length,
    nR: aR.peaks.length,
    snrL: aL.snr,
    snrR: aR.snr,
  };
}

export function solveBeacons(candsL: OffsetCandidate[], candsR: OffsetCandidate[]): BeaconSolution | null {
  let best: BeaconSolution | null = null;
  for (const a of candsL) {
    for (const b of candsR) {
      const dLR = (SOUND_SPEED_MS * (a.D - b.D)) / 2;
      if (dLR < 0.4 || dLR > 150) continue;
      const score = a.n + b.n;
      if (!best || score > best.score) best = { DL: a.D, DR: b.D, dLR, score };
    }
  }
  return best;
}

export function computePosition(D: number, DL: number, DR: number): LocatedPosition {
  const dLR = (SOUND_SPEED_MS * (DL - DR)) / 2;
  const diff = SOUND_SPEED_MS * ((DL + DR) / 2 - D);
  const u = dLR > 0 ? diff / dLR : 0;
  return { dLR, diff, u, x: Math.min(1, Math.max(0, (u + 1) / 2)) };
}

export function locatePhone(cands: OffsetCandidate[], DL: number, DR: number): LocatedPosition | null {
  const mid = (DL + DR) / 2;
  const lim = ((DL - DR) / 2) * 1.15 + 0.004;
  for (const c of cands) if (Math.abs(c.D - mid) <= lim) return computePosition(c.D, DL, DR);
  return null;
}
