'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { io, type Socket } from 'socket.io-client';
import {
  type CueState,
  type EventStateSnapshot,
  type SpeakerRole,
  type Zone,
  type ZoneCounts,
  xToZone,
  zoneToDefaultX,
} from '@/shared/protocol';
import { fxRgb, hash01, rgbToCss } from '@/shared/effects';
import { chirpAudio } from '../_lib/chirp-audio';
import { persistAttendeeSession, readAttendeeSession } from '../_lib/session';
import { AttendeeHud } from './AttendeeHud';

function AttendeeInner() {
  const searchParams = useSearchParams();
  const socketRef = useRef<Socket | null>(null);
  const surfaceRef = useRef<HTMLDivElement | null>(null);
  const clockOffsetRef = useRef<number>(0);

  const [initialized, setInitialized] = useState(false);
  const [participantId, setParticipantId] = useState('anon');
  const [eventId, setEventId] = useState('');
  const [zone, setZone] = useState<Zone>('Center');
  const [x, setX] = useState<number>(0.5);
  const [speakerRole, setSpeakerRole] = useState<SpeakerRole>('crowd');
  const [micState, setMicState] = useState<'unused' | 'granted' | 'denied'>('unused');
  const [connected, setConnected] = useState(false);
  const [activeCue, setActiveCue] = useState<CueState | null>(null);
  const [counts, setCounts] = useState<ZoneCounts>({ Left: 0, Center: 0, Right: 0, total: 0 });
  const [statusMsg, setStatusMsg] = useState('Pick your zone or scan a session QR code to join.');
  const [hideHud, setHideHud] = useState(false);

  const stateRef = useRef({ eventId, zone, x, speakerRole, participantId, activeCue });
  stateRef.current = { eventId, zone, x, speakerRole, participantId, activeCue };

  useEffect(() => {
    const sess = readAttendeeSession(new URLSearchParams(searchParams.toString()));
    setParticipantId(sess.participantId);
    setEventId(sess.eventId);
    setZone(sess.zone);
    setX(sess.x);
    if (sess.eventId) {
      persistAttendeeSession(sess.eventId, sess.zone, sess.x, true);
      setStatusMsg('Connected to session. Hold your phone up when the light show starts!');
    }
    setInitialized(true);
  }, [searchParams]);

  useEffect(() => {
    if (!initialized || !eventId) return;
    const sock = io({ transports: ['websocket', 'polling'] });
    socketRef.current = sock;

    sock.on('connect', () => {
      setConnected(true);
      const cur = stateRef.current;
      sock.emit('attendee:join', {
        eventId: cur.eventId,
        participantId: cur.participantId,
        zone: cur.zone,
        x: cur.x,
        posSource: 'zone',
        speakerRole: cur.speakerRole,
      });
      sock.emit('clock:ping', { t0: Date.now() });
    });

    sock.on('disconnect', () => setConnected(false));
    sock.on('clock:pong', (m: { t0: number; th: number }) => {
      const t1 = Date.now();
      const rtt = t1 - m.t0;
      if (rtt >= 0 && rtt < 4000) clockOffsetRef.current = m.th + rtt / 2 - t1;
    });
    sock.on('cue:active', (cue: CueState) => {
      setActiveCue(cue);
    });
    sock.on('event:state', (snap: EventStateSnapshot) => {
      setCounts(snap.counts);
    });
    sock.on('cal:beep', () => {
      const r = stateRef.current.speakerRole;
      if (r === 'L' || r === 'R') chirpAudio.playChirps(r, [0.05, 0.4]);
    });
    sock.on('cal:start', (m: { eventId: string; calId: number }) => {
      const cur = stateRef.current;
      const emitRole = cur.speakerRole === 'L' || cur.speakerRole === 'R' ? cur.speakerRole : null;
      if (!chirpAudio.hasMic() && !emitRole) {
        setStatusMsg('Mic unused — using your manual zone spot below.');
        return;
      }
      setStatusMsg('🤫 Listening to speaker chirps (~6s)…');
      void chirpAudio.runCalibrationWindow(emitRole).then((res) => {
        if (!res) return;
        sock.emit('cal:report', {
          eventId: m.eventId, calId: m.calId, speakerRole: cur.speakerRole,
          ok: res.ok, cands: res.cands, nL: res.nL, nR: res.nR,
        });
        if (!res.ok && cur.speakerRole === 'crowd') {
          setStatusMsg('Could not hear chirps clearly — use the zone picker below.');
        }
      });
    });
    sock.on('attendee:located', (loc: { zone: Zone; x: number; cue: CueState }) => {
      setZone(loc.zone);
      setX(loc.x);
      setActiveCue(loc.cue);
      persistAttendeeSession(stateRef.current.eventId, loc.zone, loc.x, true);
      setStatusMsg(`🎯 Positioned by sound: ${loc.zone} (${Math.round(loc.x * 100)}% across)!`);
    });

    return () => { sock.disconnect(); };
  }, [initialized, eventId]);

  useEffect(() => {
    let raf = 0;
    const render = () => {
      const el = surfaceRef.current;
      if (el) {
        const cur = stateRef.current;
        const seed = hash01(cur.participantId);
        const now = Date.now() + clockOffsetRef.current;
        const rgb = fxRgb(cur.activeCue, cur.x, seed, now);
        el.style.backgroundColor = rgbToCss(rgb);
      }
      raf = window.requestAnimationFrame(render);
    };
    raf = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(raf);
  }, []);

  const updateZoneManual = (nextZone: Zone, nextX?: number) => {
    const resolvedX = nextX ?? zoneToDefaultX(nextZone);
    setZone(nextZone);
    setX(resolvedX);
    persistAttendeeSession(eventId, nextZone, resolvedX, true);
    if (eventId && socketRef.current?.connected) {
      socketRef.current.emit('attendee:zone', {
        eventId, zone: nextZone, x: resolvedX, posSource: 'manual',
      });
    }
  };

  return (
    <main className="relative min-h-screen w-full overflow-x-hidden">
      <div
        ref={surfaceRef}
        data-testid="attendee-display-surface"
        data-zone={zone}
        data-active-fx={activeCue?.fx ?? 'off'}
        onClick={() => { if (hideHud) setHideHud(false); }}
        className="fixed inset-0 z-0 transition-colors duration-75"
        style={{ backgroundColor: 'rgb(0, 0, 0)' }}
      />

      {hideHud ? (
        <div
          onClick={() => setHideHud(false)}
          className="fixed right-0 bottom-0 left-0 z-20 cursor-pointer bg-gradient-to-t from-black/80 to-transparent p-4 text-center text-xs text-[#9a968c]"
        >
          {zone} Zone · Tap anywhere to show controls
        </div>
      ) : (
        <AttendeeHud
          eventId={eventId}
          connected={connected}
          zone={zone}
          x={x}
          micState={micState}
          speakerRole={speakerRole}
          statusMsg={statusMsg}
          counts={counts}
          onJoinEvent={(code) => {
            setEventId(code);
            persistAttendeeSession(code, zone, x, true);
            setStatusMsg('Joined session! Pick your zone or enable mic for chirp calibration.');
          }}
          onSelectZone={(z) => updateZoneManual(z)}
          onSlidePosition={(val) => updateZoneManual(xToZone(val), val)}
          onEnableMic={() => {
            void chirpAudio.init(true).then((ok) => {
              setMicState(ok ? 'granted' : 'denied');
              setStatusMsg(
                ok
                  ? '🎙️ Mic ready! Wait for the host to tap Chirp & Locate.'
                  : 'Mic access denied — no problem, use the manual zone picker above.'
              );
            });
          }}
          onSelectRole={(role) => {
            void chirpAudio.init(true).then((ok) => setMicState(ok ? 'granted' : 'denied'));
            setSpeakerRole(role);
            const nextZ: Zone = role === 'L' ? 'Left' : role === 'R' ? 'Right' : zone;
            const nextX = role === 'L' ? 0 : role === 'R' ? 1 : x;
            setZone(nextZ);
            setX(nextX);
            persistAttendeeSession(eventId, nextZ, nextX, true);
            if (eventId) socketRef.current?.emit('attendee:role', { eventId, speakerRole: role });
          }}
          onEnterFullShow={() => setHideHud(true)}
        />
      )}
    </main>
  );
}

export default function AttendeePage() {
  return (
    <Suspense fallback={<div className="p-8 text-[#9a968c]">Loading Attendee View…</div>}>
      <AttendeeInner />
    </Suspense>
  );
}
