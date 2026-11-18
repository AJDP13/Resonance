import { ZoneSchema, type Zone, zoneToDefaultX } from '@/shared/protocol';

const KEY_EVENT = 'resonance_eventId';
const KEY_ZONE = 'resonance_zone';
const KEY_X = 'resonance_x';
const KEY_PID = 'resonance_participantId';

const ID_CHARS = 'abcdefghijkmnpqrstuvwxyz23456789';

function randomId(len = 10): string {
  let out = '';
  for (let i = 0; i < len; i++) {
    out += ID_CHARS[Math.floor(Math.random() * ID_CHARS.length)];
  }
  return out;
}

export interface StoredAttendeeSession {
  eventId: string;
  zone: Zone;
  x: number;
  participantId: string;
}

export function readAttendeeSession(search: URLSearchParams): StoredAttendeeSession {
  let storedEvent = '';
  let storedZoneRaw: string | null = null;
  let storedXRaw: string | null = null;
  let participantId = '';

  if (typeof window !== 'undefined') {
    try {
      storedEvent = window.sessionStorage.getItem(KEY_EVENT) ?? '';
      storedZoneRaw = window.sessionStorage.getItem(KEY_ZONE);
      storedXRaw = window.sessionStorage.getItem(KEY_X);
      participantId = window.sessionStorage.getItem(KEY_PID) ?? '';
      if (!participantId) {
        participantId = randomId(12);
        window.sessionStorage.setItem(KEY_PID, participantId);
      }
    } catch {
      participantId = randomId(12);
    }
  }

  const rawUrlEvent = search.get('eventId') ?? search.get('room') ?? '';
  const cleanUrlEvent = rawUrlEvent.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 24);
  const eventId = cleanUrlEvent || storedEvent;

  const urlZoneParsed = ZoneSchema.safeParse(search.get('zone'));
  const storedZoneParsed = ZoneSchema.safeParse(storedZoneRaw);
  const zone: Zone = urlZoneParsed.success
    ? urlZoneParsed.data
    : storedZoneParsed.success
      ? storedZoneParsed.data
      : 'Center';

  const parsedX = storedXRaw !== null ? Number.parseFloat(storedXRaw) : Number.NaN;
  const x =
    !urlZoneParsed.success && Number.isFinite(parsedX) && parsedX >= 0 && parsedX <= 1
      ? parsedX
      : zoneToDefaultX(zone);

  return { eventId, zone, x, participantId: participantId || randomId(12) };
}

export function persistAttendeeSession(
  eventId: string,
  zone: Zone,
  x: number,
  syncUrl = true
): void {
  if (typeof window === 'undefined') return;
  try {
    if (eventId) window.sessionStorage.setItem(KEY_EVENT, eventId);
    window.sessionStorage.setItem(KEY_ZONE, zone);
    window.sessionStorage.setItem(KEY_X, x.toFixed(4));
  } catch {
    // Ignore storage quota / private mode restrictions
  }
  if (syncUrl && eventId) {
    const url = new URL(window.location.href);
    url.searchParams.set('eventId', eventId);
    url.searchParams.set('zone', zone);
    url.searchParams.delete('room');
    window.history.replaceState(null, '', url.toString());
  }
}
