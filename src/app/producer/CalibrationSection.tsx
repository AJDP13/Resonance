'use client';

import type { HostSpeakerRole } from '@/shared/protocol';

interface CalibrationSectionProps {
  hasLeftSpeaker: boolean;
  hasRightSpeaker: boolean;
  hostRole: HostSpeakerRole;
  calibrating: boolean;
  calMessage: string;
  fakeCount: number;
  onSetHostRole: (role: HostSpeakerRole) => void;
  onTestBeep: () => void;
  onCalibrate: () => void;
  onToggleFake: () => void;
}

export function CalibrationSection({
  hasLeftSpeaker,
  hasRightSpeaker,
  hostRole,
  calibrating,
  calMessage,
  fakeCount,
  onSetHostRole,
  onTestBeep,
  onCalibrate,
  onToggleFake,
}: CalibrationSectionProps) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 text-xs font-semibold tracking-widest text-[#9a968c] uppercase">
        1 · Speakers &amp; Acoustic Calibration
      </h2>
      <p className="text-sm text-[#9a968c]">
        Assign front-left and front-right speaker devices (either two joined phones or this host
        device + one phone) to position everyone by sound, or attendees can pick their zone manually.
      </p>

      <div className="mt-2.5 rounded-2xl border border-[#2a2a30] bg-[#16161a] p-3.5">
        <div className="flex items-center justify-between text-sm">
          <span>Left speaker</span>
          <span
            data-testid="status-left-speaker"
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              hasLeftSpeaker ? 'bg-[#16301d] text-[#7bd88f]' : 'bg-[#3a1717] text-[#ff6b6b]'
            }`}
          >
            {hasLeftSpeaker ? 'ready' : 'missing'}
          </span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span>Right speaker</span>
          <span
            data-testid="status-right-speaker"
            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
              hasRightSpeaker ? 'bg-[#16301d] text-[#7bd88f]' : 'bg-[#3a1717] text-[#ff6b6b]'
            }`}
          >
            {hasRightSpeaker ? 'ready' : 'missing'}
          </span>
        </div>

        <div className="mt-3 text-xs text-[#9a968c]">This host device acts as:</div>
        <div className="mt-1.5 grid grid-cols-3 gap-1.5">
          {(
            [
              ['none', 'Not speaker'],
              ['L', 'LEFT spk'],
              ['R', 'RIGHT spk'],
            ] as const
          ).map(([role, label]) => (
            <button
              key={role}
              data-testid={`host-role-${role}`}
              type="button"
              onClick={() => onSetHostRole(role)}
              className={`cursor-pointer rounded-xl border py-2 text-xs font-semibold ${
                hostRole === role
                  ? 'border-[#ffd166] bg-[#ffd166] text-[#111]'
                  : 'border-[#2a2a30] bg-[#0d0d10] text-[#f4f1ea]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <button
          data-testid="btn-test-beep"
          type="button"
          onClick={onTestBeep}
          className="mt-2.5 w-full cursor-pointer rounded-xl border border-[#2a2a30] bg-[#0d0d10] py-2.5 text-sm font-semibold"
        >
          🔊 Test speaker sound
        </button>
      </div>

      <div className="mt-3">
        <button
          data-testid="btn-calibrate"
          type="button"
          disabled={calibrating}
          onClick={onCalibrate}
          className="w-full cursor-pointer rounded-2xl bg-[#ffd166] py-3.5 text-base font-bold text-[#111] disabled:opacity-50"
        >
          {calibrating ? '🤫 Listening & Locating…' : '📣 Chirp & Locate Phones'}
        </button>
        <p data-testid="calibration-status" className="mt-1.5 text-xs text-[#9a968c]">
          {calMessage}
        </p>
      </div>

      <button
        data-testid="btn-fake-phones"
        type="button"
        onClick={onToggleFake}
        className="mt-2 w-full cursor-pointer rounded-xl border border-[#2a2a30] bg-[#16161a] py-2 text-xs font-semibold text-[#9a968c] hover:text-[#f4f1ea]"
      >
        {fakeCount > 0 ? 'Remove pretend phones from map' : 'Practice: Add 60 pretend phones to map'}
      </button>
    </section>
  );
}
