import { locatePhone, solveBeacons, type OffsetCandidate } from '../shared/dsp-locate';
import { xToZone, type SpeakerRole, type Zone } from '../shared/protocol';
import type { AttendeeRecord, EventRecord } from './store';

export interface CalReportEntry {
  socketId: string;
  speakerRole: SpeakerRole;
  ok: boolean;
  cands: OffsetCandidate[];
}

export type FinishCalResult =
  | {
      ok: true;
      dLR: number;
      DL: number;
      DR: number;
      updated: Array<{ prevZone: Zone; attendee: AttendeeRecord }>;
    }
  | { ok: false; message: string };

export function evaluateCalibration(ev: EventRecord, calId: number): FinishCalResult {
  if (ev.activeCalId !== calId) {
    return { ok: false, message: 'Calibration session mismatch.' };
  }
  const reps = [...ev.calReports.values()];
  const rl = reps.filter((r) => r.speakerRole === 'L' && r.ok);
  const rr = reps.filter((r) => r.speakerRole === 'R' && r.ok);
  let best = null;
  for (const a of rl) {
    for (const b of rr) {
      const s = solveBeacons(a.cands, b.cands);
      if (s && (!best || s.score > best.score)) best = s;
    }
  }
  if (!best) {
    return {
      ok: false,
      message: 'Speakers could not hear each other clearly. Increase volume and retry.',
    };
  }
  const updated: Array<{ prevZone: Zone; attendee: AttendeeRecord }> = [];
  for (const r of reps) {
    if (r.speakerRole !== 'crowd' || !r.ok) continue;
    const att = ev.attendees.get(r.socketId);
    if (!att) continue;
    const pos = locatePhone(r.cands, best.DL, best.DR);
    if (pos) {
      const prevZone = att.zone;
      att.x = pos.x;
      att.zone = xToZone(pos.x);
      att.posSource = 'audio';
      updated.push({ prevZone, attendee: att });
    }
  }
  return { ok: true, dLR: best.dLR, DL: best.DL, DR: best.DR, updated };
}
