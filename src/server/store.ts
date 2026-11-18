import {
  ZONES,
  type CueState,
  type EventStateSnapshot,
  type HostSpeakerRole,
  type PosSource,
  type RosterEntry,
  type SpeakerRole,
  type Zone,
  type ZoneCounts,
  zoneToDefaultX,
} from '../shared/protocol';
import { hash01 } from '../shared/effects';
import { evaluateCalibration, type CalReportEntry, type FinishCalResult } from './calibration';

export interface AttendeeRecord {
  socketId: string; eventId: string; participantId: string;
  zone: Zone; x: number; posSource: PosSource; speakerRole: SpeakerRole; seed: number;
}
export interface ProducerRecord { socketId: string; eventId: string; hostSpeakerRole: HostSpeakerRole }
export interface EventRecord {
  eventId: string;
  attendees: Map<string, AttendeeRecord>;
  producers: Map<string, ProducerRecord>;
  zoneCues: Record<Zone, CueState>;
  activeCalId: number | null;
  calReports: Map<string, CalReportEntry>;
}

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function makeDefaultCue(): CueState {
  return {
    fx: 'off', color: '#000000', speed: 100, width: 14, loop: true,
    dir: 1, targetZone: 'All', intensity: 0, at: Date.now(),
  };
}

export class EventStore {
  private readonly events = new Map<string, EventRecord>();
  private readonly socketEvent = new Map<string, string>();

  generateEventId(len = 5): string {
    for (let attempt = 0; attempt < 20; attempt++) {
      let id = '';
      for (let i = 0; i < len; i++) id += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
      if (!this.events.has(id)) return id;
    }
    return `EV${Date.now().toString(36).toUpperCase().slice(-4)}`;
  }

  getOrCreateEvent(eventId: string): EventRecord {
    const existing = this.events.get(eventId);
    if (existing) return existing;
    const rec: EventRecord = {
      eventId,
      attendees: new Map(),
      producers: new Map(),
      zoneCues: { Left: makeDefaultCue(), Center: makeDefaultCue(), Right: makeDefaultCue() },
      activeCalId: null,
      calReports: new Map(),
    };
    this.events.set(eventId, rec);
    return rec;
  }

  joinProducer(socketId: string, eventId: string, hostSpeakerRole: HostSpeakerRole): EventRecord {
    this.removeSocket(socketId);
    const ev = this.getOrCreateEvent(eventId);
    ev.producers.set(socketId, { socketId, eventId, hostSpeakerRole });
    this.socketEvent.set(socketId, eventId);
    return ev;
  }

  setProducerRole(socketId: string, eventId: string, role: HostSpeakerRole): EventRecord | null {
    const ev = this.events.get(eventId);
    const prod = ev?.producers.get(socketId);
    if (!ev || !prod) return null;
    prod.hostSpeakerRole = role;
    return ev;
  }

  joinAttendee(p: {
    socketId: string; eventId: string; participantId: string;
    zone: Zone; x?: number; posSource: PosSource; speakerRole: SpeakerRole;
  }): AttendeeRecord {
    this.removeSocket(p.socketId);
    const ev = this.getOrCreateEvent(p.eventId);
    const x = p.speakerRole === 'L' ? 0 : p.speakerRole === 'R' ? 1 : (p.x ?? zoneToDefaultX(p.zone));
    const zone: Zone = p.speakerRole === 'L' ? 'Left' : p.speakerRole === 'R' ? 'Right' : p.zone;
    const att: AttendeeRecord = {
      socketId: p.socketId, eventId: p.eventId, participantId: p.participantId,
      zone, x, posSource: p.posSource, speakerRole: p.speakerRole, seed: hash01(p.participantId),
    };
    ev.attendees.set(p.socketId, att);
    this.socketEvent.set(p.socketId, p.eventId);
    return att;
  }

  updateAttendeeZone(socketId: string, eventId: string, zone: Zone, x: number | undefined, posSource: PosSource) {
    const att = this.events.get(eventId)?.attendees.get(socketId);
    if (!att) return null;
    const prevZone = att.zone;
    att.zone = zone;
    att.x = x ?? zoneToDefaultX(zone);
    att.posSource = posSource;
    return { prevZone, attendee: att };
  }

  updateAttendeeRole(socketId: string, eventId: string, speakerRole: SpeakerRole) {
    const att = this.events.get(eventId)?.attendees.get(socketId);
    if (!att) return null;
    const prevZone = att.zone;
    att.speakerRole = speakerRole;
    if (speakerRole === 'L') { att.x = 0; att.zone = 'Left'; att.posSource = 'speaker'; }
    else if (speakerRole === 'R') { att.x = 1; att.zone = 'Right'; att.posSource = 'speaker'; }
    else if (att.posSource === 'speaker') { att.posSource = 'zone'; att.x = zoneToDefaultX(att.zone); }
    return { prevZone, attendee: att };
  }

  applyCue(eventId: string, cue: CueState): Zone[] {
    const ev = this.getOrCreateEvent(eventId);
    const targets: Zone[] = cue.targetZone === 'All' ? [...ZONES] : [cue.targetZone];
    for (const z of targets) ev.zoneCues[z] = { ...cue };
    return targets;
  }

  removeSocket(socketId: string): string | null {
    const eventId = this.socketEvent.get(socketId);
    if (!eventId) return null;
    this.socketEvent.delete(socketId);
    const ev = this.events.get(eventId);
    ev?.attendees.delete(socketId);
    ev?.producers.delete(socketId);
    return eventId;
  }

  startCalibration(eventId: string): { ok: true; calId: number } | { ok: false; message: string } {
    const snap = this.getSnapshot(eventId);
    if (!snap.hasLeftSpeaker || !snap.hasRightSpeaker) {
      return { ok: false, message: 'Both LEFT and RIGHT speakers must be assigned before calibrating.' };
    }
    const ev = this.getOrCreateEvent(eventId);
    ev.activeCalId = Date.now();
    ev.calReports.clear();
    return { ok: true, calId: ev.activeCalId };
  }

  recordCalReport(eventId: string, calId: number, entry: CalReportEntry): boolean {
    const ev = this.events.get(eventId);
    if (!ev || ev.activeCalId !== calId) return false;
    ev.calReports.set(entry.socketId, entry);
    return true;
  }

  finishCalibration(eventId: string, calId: number): FinishCalResult {
    const ev = this.events.get(eventId);
    if (!ev) return { ok: false, message: 'Event not found.' };
    return evaluateCalibration(ev, calId);
  }

  getSnapshot(eventId: string): EventStateSnapshot {
    const ev = this.getOrCreateEvent(eventId);
    const counts: ZoneCounts = { Left: 0, Center: 0, Right: 0, total: 0 };
    const roster: RosterEntry[] = [];
    let locatedCount = 0;
    let audioLocatedCount = 0;
    let attL = false;
    let attR = false;
    for (const att of ev.attendees.values()) {
      counts[att.zone] += 1;
      counts.total += 1;
      if (att.speakerRole === 'L') attL = true;
      if (att.speakerRole === 'R') attR = true;
      if (att.speakerRole === 'crowd') {
        locatedCount += 1;
        if (att.posSource === 'audio') audioLocatedCount += 1;
      }
      roster.push({
        participantId: att.participantId, zone: att.zone, x: att.x,
        posSource: att.posSource, speakerRole: att.speakerRole, seed: att.seed,
      });
    }
    const prodRoles = [...ev.producers.values()].map((p) => p.hostSpeakerRole);
    return {
      eventId, counts,
      zoneCues: { Left: { ...ev.zoneCues.Left }, Center: { ...ev.zoneCues.Center }, Right: { ...ev.zoneCues.Right } },
      hasLeftSpeaker: attL || prodRoles.includes('L'),
      hasRightSpeaker: attR || prodRoles.includes('R'),
      locatedCount, audioLocatedCount, roster,
    };
  }
}
