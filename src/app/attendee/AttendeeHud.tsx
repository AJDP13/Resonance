'use client';

import { useState } from 'react';
import { ZONES, type SpeakerRole, type Zone, type ZoneCounts, xToZone } from '@/shared/protocol';

interface AttendeeHudProps {
  eventId: string;
  connected: boolean;
  zone: Zone;
  x: number;
  micState: 'unused' | 'granted' | 'denied';
  speakerRole: SpeakerRole;
  statusMsg: string;
  counts: ZoneCounts;
  onJoinEvent: (code: string) => void;
  onSelectZone: (zone: Zone) => void;
  onSlidePosition: (x: number) => void;
  onEnableMic: () => void;
  onSelectRole: (role: SpeakerRole) => void;
  onEnterFullShow: () => void;
}

export function AttendeeHud({
  eventId,
  connected,
  zone,
  x,
  micState,
  speakerRole,
  statusMsg,
  counts,
  onJoinEvent,
  onSelectZone,
  onSlidePosition,
  onEnableMic,
  onSelectRole,
  onEnterFullShow,
}: AttendeeHudProps) {
  const [inputCode, setInputCode] = useState('');

  return (
    <div className="relative z-10 mx-auto max-w-[540px] px-4 pt-6 pb-16">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold tracking-tight">
          Reso<span className="text-[#ffd166]">nance</span>
        </h1>
        {eventId && (
          <button
            data-testid="btn-fullscreen-show"
            type="button"
            onClick={onEnterFullShow}
            className="cursor-pointer rounded-xl bg-[#ffd166] px-3 py-1.5 text-xs font-bold text-[#111]"
          >
            Full-Screen Light ↗
          </button>
        )}
      </div>

      {!eventId && (
        <div className="mt-4 rounded-2xl border border-[#2a2a30] bg-[#16161a]/95 p-4 backdrop-blur">
          <div className="text-xs font-semibold tracking-wider text-[#9a968c] uppercase">
            Enter Session Code
          </div>
          <div className="mt-2 flex gap-2">
            <input
              data-testid="attendee-code-input"
              type="text"
              maxLength={12}
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value.toUpperCase())}
              placeholder="CODE"
              className="flex-1 rounded-xl border border-[#2a2a30] bg-[#0d0d10] px-3 py-2.5 text-center text-lg tracking-widest uppercase"
            />
            <button
              data-testid="attendee-code-submit"
              type="button"
              onClick={() => {
                const clean = inputCode.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
                if (clean.length >= 2) onJoinEvent(clean);
              }}
              className="cursor-pointer rounded-xl bg-[#ffd166] px-5 py-2.5 font-bold text-[#111]"
            >
              Join
            </button>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-2xl border border-[#2a2a30] bg-[#16161a]/90 p-3.5 backdrop-blur">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[#9a968c]">Session</span>
          <span data-testid="attendee-event-id" className="font-bold text-[#ffd166]">
            {eventId || 'Not joined'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-[#9a968c]">Connection</span>
          <span
            data-testid="attendee-connection"
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              connected ? 'bg-[#16301d] text-[#7bd88f]' : 'bg-[#3a1717] text-[#ff6b6b]'
            }`}
          >
            {connected ? 'live' : 'waiting'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-[#9a968c]">Crowd Live</span>
          <span data-testid="attendee-counter-total" className="text-xs font-semibold text-[#f4f1ea]">
            {counts.total} total ({counts[zone]} in {zone})
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-[#9a968c]">Your Zone &amp; Spot</span>
          <span data-testid="attendee-zone-badge" className="rounded-full bg-[#16301d] px-2.5 py-0.5 text-xs font-bold text-[#7bd88f]">
            {zone} · {Math.round(x * 100)}%
          </span>
        </div>
      </div>

      <p data-testid="attendee-status-msg" className="mt-3 text-base font-bold text-[#f4f1ea]">
        {statusMsg}
      </p>

      <div data-testid="zone-picker" className="mt-3 rounded-2xl border border-[#2a2a30] bg-[#16161a]/90 p-3.5 backdrop-blur">
        <div className="text-sm font-bold">Pick Your Zone (Manual / QR Fallback)</div>
        <p className="text-xs text-[#9a968c]">
          Works immediately even without microphone access.
        </p>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          {ZONES.map((z) => (
            <button
              key={z}
              data-testid={`zone-picker-${z}`}
              type="button"
              onClick={() => onSelectZone(z)}
              className={`cursor-pointer rounded-xl border py-3 text-sm font-bold ${
                zone === z
                  ? 'border-[#ffd166] bg-[#ffd166] text-[#111]'
                  : 'border-[#2a2a30] bg-[#0d0d10] text-[#f4f1ea]'
              }`}
            >
              {z}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <div className="flex justify-between text-xs text-[#9a968c]">
            <span>← Far Left</span>
            <span>Fine Position ({xToZone(x)})</span>
            <span>Far Right →</span>
          </div>
          <input
            data-testid="position-slider"
            type="range"
            min={0}
            max={1000}
            value={Math.round(x * 1000)}
            onChange={(e) => onSlidePosition(Number(e.target.value) / 1000)}
            className="mt-1 w-full"
          />
        </div>
      </div>

      <div className="mt-3 rounded-2xl border border-[#2a2a30] bg-[#16161a]/90 p-3.5 backdrop-blur">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold">Optional Acoustic Positioning</span>
          <span
            data-testid="attendee-mic-status"
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              micState === 'granted' ? 'bg-[#16301d] text-[#7bd88f]' : micState === 'denied' ? 'bg-[#3a1717] text-[#ff6b6b]' : 'bg-[#222] text-[#9a968c]'
            }`}
          >
            mic: {micState}
          </span>
        </div>
        <p className="mt-1 text-xs text-[#9a968c]">
          Listens in browser memory during the 6-second speaker chirp (audio never leaves your phone).
        </p>
        <button
          data-testid="btn-enable-mic"
          type="button"
          onClick={onEnableMic}
          className="mt-2.5 w-full cursor-pointer rounded-xl border border-[#2a2a30] bg-[#0d0d10] py-2.5 text-sm font-semibold hover:border-[#ffd166]"
        >
          {micState === 'granted' ? '✅ Mic Ready for Speaker Chirp' : '🎙️ Enable Mic for Chirp Calibration'}
        </button>
      </div>

      <details className="mt-3 rounded-2xl border border-[#2a2a30] bg-[#16161a]/90 p-3.5 backdrop-blur">
        <summary className="cursor-pointer text-xs font-semibold text-[#9a968c]">
          Speaker Setup (Organisers Only) · Current: {speakerRole}
        </summary>
        <div className="mt-2.5 grid grid-cols-3 gap-2">
          <button data-testid="role-L" type="button" onClick={() => onSelectRole('L')} className={`cursor-pointer rounded-xl py-2 text-xs font-bold ${speakerRole === 'L' ? 'bg-[#ffd166] text-[#111]' : 'bg-[#0d0d10] text-[#f4f1ea]'}`}>LEFT Spk</button>
          <button data-testid="role-R" type="button" onClick={() => onSelectRole('R')} className={`cursor-pointer rounded-xl py-2 text-xs font-bold ${speakerRole === 'R' ? 'bg-[#ffd166] text-[#111]' : 'bg-[#0d0d10] text-[#f4f1ea]'}`}>RIGHT Spk</button>
          <button data-testid="role-crowd" type="button" onClick={() => onSelectRole('crowd')} className={`cursor-pointer rounded-xl py-2 text-xs font-bold ${speakerRole === 'crowd' ? 'bg-[#ffd166] text-[#111]' : 'bg-[#0d0d10] text-[#f4f1ea]'}`}>Crowd</button>
        </div>
      </details>
    </div>
  );
}
