'use client';

import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import type { CueTarget, ZoneCounts } from '@/shared/protocol';

interface QrSectionProps {
  eventId: string;
  connected: boolean;
  counts: ZoneCounts;
  locatedSummary: string;
  onNewSession: () => void;
}

export function QrSection({
  eventId,
  connected,
  counts,
  locatedSummary,
  onNewSession,
}: QrSectionProps) {
  const [qrZone, setQrZone] = useState<CueTarget>('All');
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [joinUrl, setJoinUrl] = useState<string>('');
  const [fullScreenQr, setFullScreenQr] = useState(false);

  useEffect(() => {
    if (!eventId || typeof window === 'undefined') return;
    const u = new URL('/attendee', window.location.origin);
    u.searchParams.set('eventId', eventId);
    if (qrZone !== 'All') u.searchParams.set('zone', qrZone);
    const link = u.toString();
    setJoinUrl(link);
    void QRCode.toDataURL(link, { width: 320, margin: 2 }).then(setQrDataUrl).catch(() => {});
  }, [eventId, qrZone]);

  return (
    <section className="mt-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xs text-[#9a968c] uppercase">Room code</div>
          <div data-testid="event-code" className="text-4xl font-extrabold tracking-wider text-[#ffd166]">
            {eventId || '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[#9a968c] uppercase">Total Phones</div>
          <div data-testid="counter-total" className="text-4xl font-extrabold">
            {counts.total}
          </div>
        </div>
      </div>

      <div className="mt-2 grid grid-cols-3 gap-2 rounded-2xl border border-[#2a2a30] bg-[#16161a] p-3 text-center">
        <div>
          <div className="text-xs text-[#9a968c]">Left Zone</div>
          <div data-testid="counter-Left" className="text-xl font-bold text-[#f4f1ea]">
            {counts.Left}
          </div>
        </div>
        <div className="border-x border-[#2a2a30]">
          <div className="text-xs text-[#9a968c]">Center Zone</div>
          <div data-testid="counter-Center" className="text-xl font-bold text-[#f4f1ea]">
            {counts.Center}
          </div>
        </div>
        <div>
          <div className="text-xs text-[#9a968c]">Right Zone</div>
          <div data-testid="counter-Right" className="text-xl font-bold text-[#f4f1ea]">
            {counts.Right}
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between text-xs">
        <span
          data-testid="producer-connection"
          className={`rounded-full px-2.5 py-1 font-medium ${
            connected ? 'bg-[#16301d] text-[#7bd88f]' : 'bg-[#3a1717] text-[#ff6b6b]'
          }`}
        >
          {connected ? 'Socket live' : 'Reconnecting…'}
        </span>
        <span className="text-[#9a968c]">{locatedSummary}</span>
      </div>

      <div className="mt-3 rounded-2xl border border-[#2a2a30] bg-[#16161a] p-3">
        <div className="mb-2 flex items-center justify-between text-xs text-[#9a968c]">
          <span>QR preset zone:</span>
          <div className="flex gap-1">
            {(['All', 'Left', 'Center', 'Right'] as const).map((z) => (
              <button
                key={z}
                data-testid={`qr-preset-${z}`}
                type="button"
                onClick={() => setQrZone(z)}
                className={`cursor-pointer rounded-lg px-2 py-1 text-xs font-semibold ${
                  qrZone === z ? 'bg-[#ffd166] text-[#111]' : 'bg-[#222] text-[#9a968c]'
                }`}
              >
                {z === 'All' ? 'Any' : z}
              </button>
            ))}
          </div>
        </div>
        <div data-testid="qr-code-box" className="flex justify-center rounded-xl bg-white p-3">
          {qrDataUrl ? (
            <img src={qrDataUrl} alt={`Join event ${eventId}`} className="h-auto w-full max-w-[240px]" />
          ) : (
            <div className="py-16 text-sm text-black">Generating QR…</div>
          )}
        </div>
        <p data-testid="join-url" className="mt-2 text-center text-xs break-all text-[#9a968c]">
          {joinUrl}
        </p>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            data-testid="btn-qr-fullscreen"
            type="button"
            onClick={() => setFullScreenQr(true)}
            className="cursor-pointer rounded-xl border border-[#2a2a30] bg-[#0d0d10] py-2.5 text-sm font-semibold"
          >
            Show QR full screen
          </button>
          <button
            data-testid="btn-new-session"
            type="button"
            onClick={onNewSession}
            className="cursor-pointer rounded-xl border border-[#2a2a30] bg-[#0d0d10] py-2.5 text-sm font-semibold"
          >
            New session code
          </button>
        </div>
      </div>

      {fullScreenQr && qrDataUrl && (
        <div
          onClick={() => setFullScreenQr(false)}
          className="fixed inset-0 z-50 flex cursor-pointer flex-col items-center justify-center bg-white p-6 text-black"
        >
          <img src={qrDataUrl} alt="Full screen QR" className="w-[min(78vw,72vh)]" />
          <div className="mt-3 text-center text-2xl font-extrabold">
            Scan to join · Code {eventId} {qrZone !== 'All' ? `(${qrZone})` : ''}
          </div>
          <div className="mt-1 text-sm text-neutral-500">Tap anywhere to close</div>
        </div>
      )}
    </section>
  );
}
