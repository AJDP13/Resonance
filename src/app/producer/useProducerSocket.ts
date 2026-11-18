'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { CHIRP_SCHED } from '@/shared/dsp-core';
import type {
  CueState,
  CueTarget,
  EffectType,
  EventStateSnapshot,
  HostSpeakerRole,
} from '@/shared/protocol';
import { chirpAudio } from '../_lib/chirp-audio';

const OFF_CUE: CueState = {
  fx: 'off', color: '#000000', speed: 100, width: 14, loop: true, dir: 1, targetZone: 'All', intensity: 0, at: 0,
};

export interface SendCueInput {
  fx: EffectType;
  color: string;
  speed: number;
  width: number;
  loop: boolean;
  dir: 1 | -1;
  targetZone: CueTarget;
  intensity: number;
}

export function useProducerSocket(initialRequestedId: string) {
  const socketRef = useRef<Socket | null>(null);
  const hostRoleRef = useRef<HostSpeakerRole>('none');
  const eventIdRef = useRef<string>('');

  const [connected, setConnected] = useState(false);
  const [eventId, setEventId] = useState('');
  const [hostRole, setHostRole] = useState<HostSpeakerRole>('none');
  const [calibrating, setCalibrating] = useState(false);
  const [calMessage, setCalMessage] = useState(
    'Ask the room for 6 seconds of quiet, then tap Chirp & Locate.'
  );
  const [snapshot, setSnapshot] = useState<EventStateSnapshot>({
    eventId: '',
    counts: { Left: 0, Center: 0, Right: 0, total: 0 },
    zoneCues: { Left: OFF_CUE, Center: OFF_CUE, Right: OFF_CUE },
    hasLeftSpeaker: false,
    hasRightSpeaker: false,
    locatedCount: 0,
    audioLocatedCount: 0,
    roster: [],
  });

  useEffect(() => {
    const sock = io({ transports: ['websocket', 'polling'] });
    socketRef.current = sock;

    const syncUrl = (id: string) => {
      eventIdRef.current = id;
      setEventId(id);
      const u = new URL(window.location.href);
      u.searchParams.set('eventId', id);
      window.history.replaceState(null, '', u.toString());
    };

    sock.on('connect', () => {
      setConnected(true);
      const existing = eventIdRef.current || initialRequestedId;
      const evName = existing ? 'producer:join' : 'event:create';
      const body = existing
        ? { eventId: existing, hostSpeakerRole: hostRoleRef.current }
        : { hostSpeakerRole: hostRoleRef.current };
      sock.emit(evName, body, (res: { state?: EventStateSnapshot }) => {
        if (res?.state) {
          syncUrl(res.state.eventId);
          setSnapshot(res.state);
        }
      });
    });

    sock.on('disconnect', () => setConnected(false));
    sock.on('event:state', (s: EventStateSnapshot) => setSnapshot(s));
    sock.on('cal:beep', () => {
      const r = hostRoleRef.current;
      if (r === 'L' || r === 'R') chirpAudio.playChirps(r, [0.05, 0.4]);
    });
    sock.on('cal:start', (m: { eventId: string; calId: number }) => {
      const r = hostRoleRef.current;
      if (r !== 'L' && r !== 'R') return;
      void chirpAudio.runCalibrationWindow(r).then((analysis) => {
        if (!analysis) return;
        sock.emit('cal:report', {
          eventId: m.eventId, calId: m.calId, speakerRole: r,
          ok: analysis.ok, cands: analysis.cands, nL: analysis.nL, nR: analysis.nR,
        });
      });
    });
    sock.on('cal:result', (res: { dLR?: number; locatedCount?: number; error?: { message: string } }) => {
      setCalibrating(false);
      if (res.error) setCalMessage(`❌ ${res.error.message}`);
      else if (typeof res.dLR === 'number') {
        setCalMessage(`✅ Speakers ${res.dLR.toFixed(1)} m apart · Positioned ${res.locatedCount ?? 0} phone(s) by sound.`);
      }
    });

    return () => {
      sock.disconnect();
    };
  }, [initialRequestedId]);

  const createNewSession = useCallback(() => {
    socketRef.current?.emit('event:create', { hostSpeakerRole: hostRoleRef.current }, (res: { state?: EventStateSnapshot }) => {
      if (res?.state) {
        eventIdRef.current = res.state.eventId;
        setEventId(res.state.eventId);
        setSnapshot(res.state);
        const u = new URL(window.location.href);
        u.searchParams.set('eventId', res.state.eventId);
        window.history.replaceState(null, '', u.toString());
      }
    });
  }, []);

  const updateHostRole = useCallback(async (role: HostSpeakerRole) => {
    if (role !== 'none') await chirpAudio.init(true);
    hostRoleRef.current = role;
    setHostRole(role);
    if (eventIdRef.current) {
      socketRef.current?.emit('producer:role', { eventId: eventIdRef.current, hostSpeakerRole: role });
    }
  }, []);

  const startCalibration = useCallback(async () => {
    if (!eventIdRef.current || !socketRef.current) return;
    if (hostRoleRef.current !== 'none') await chirpAudio.init(true);
    socketRef.current.emit('cal:start', { eventId: eventIdRef.current }, (res: { calId?: number; error?: { message: string } }) => {
      if (res?.error || !res.calId) {
        setCalMessage(`⚠️ ${res?.error?.message ?? 'Could not start calibration.'}`);
        return;
      }
      const calId = res.calId;
      setCalibrating(true);
      setCalMessage('🤫 Chirping speakers & measuring arrival times (~7s)…');
      window.setTimeout(() => {
        socketRef.current?.emit('cal:finish', { eventId: eventIdRef.current, calId });
      }, (CHIRP_SCHED.windowSec + 1.2) * 1000);
    });
  }, []);

  const sendCue = useCallback((cue: SendCueInput) => {
    if (!eventIdRef.current) return;
    socketRef.current?.emit('cue:send', { eventId: eventIdRef.current, ...cue });
  }, []);

  const sendBlackout = useCallback((targetZone: CueTarget) => {
    if (!eventIdRef.current) return;
    socketRef.current?.emit('cue:blackout', { eventId: eventIdRef.current, targetZone });
  }, []);

  const sendBeep = useCallback(() => {
    if (eventIdRef.current) socketRef.current?.emit('cal:beep', { eventId: eventIdRef.current });
  }, []);

  return {
    connected, eventId, hostRole, calibrating, calMessage, snapshot,
    createNewSession, updateHostRole, startCalibration, sendCue, sendBlackout, sendBeep,
  };
}
