'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function LandingInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [code, setCode] = useState('');

  useEffect(() => {
    const legacyRoom = searchParams.get('room') ?? searchParams.get('eventId');
    if (searchParams.has('host')) {
      const q = legacyRoom ? `?eventId=${encodeURIComponent(legacyRoom.toUpperCase())}` : '';
      router.replace(`/producer${q}`);
      return;
    }
    if (legacyRoom) {
      router.replace(`/attendee?eventId=${encodeURIComponent(legacyRoom.toUpperCase())}`);
    }
  }, [router, searchParams]);

  const handleJoin = () => {
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
    if (clean.length >= 2) {
      router.push(`/attendee?eventId=${encodeURIComponent(clean)}`);
    }
  };

  return (
    <main className="mx-auto max-w-[560px] px-5 pt-8 pb-16">
      <h1 className="text-4xl font-extrabold tracking-tight">
        Reso<span className="text-[#ffd166]">nance</span>
      </h1>
      <p className="mt-2 text-sm text-[#9a968c]">
        Turn every phone in the room into one giant synchronized light show.
      </p>

      <section className="mt-8">
        <h2 className="mb-2.5 text-xs font-semibold tracking-widest text-[#9a968c] uppercase">
          Join a show
        </h2>
        <input
          data-testid="landing-code-input"
          type="text"
          maxLength={12}
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleJoin();
          }}
          placeholder="CODE"
          autoComplete="off"
          className="w-full rounded-2xl border border-[#2a2a30] bg-[#0d0d10] p-3.5 text-center text-2xl tracking-[0.2em] text-[#f4f1ea] uppercase outline-none focus:border-[#ffd166]"
        />
        <button
          data-testid="landing-join-btn"
          type="button"
          onClick={handleJoin}
          className="mt-3 w-full cursor-pointer rounded-2xl bg-[#ffd166] px-4 py-4 text-lg font-bold text-[#111] active:scale-[0.99]"
        >
          Join Session
        </button>
      </section>

      <section className="mt-8">
        <h2 className="mb-2.5 text-xs font-semibold tracking-widest text-[#9a968c] uppercase">
          Run a show
        </h2>
        <button
          data-testid="landing-host-btn"
          type="button"
          onClick={() => router.push('/producer')}
          className="w-full cursor-pointer rounded-2xl border border-[#2a2a30] bg-[#16161a] px-4 py-4 font-semibold text-[#f4f1ea] hover:border-[#ffd166] active:scale-[0.99]"
        >
          Start a new show (Host / Producer)
        </button>
        <p className="mt-2 text-sm text-[#9a968c]">
          Creates a session with a QR code, calibrates speakers &amp; phone positions, and plays
          synchronized light shows + music.
        </p>
      </section>
    </main>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="p-8 text-[#9a968c]">Loading Resonance…</div>}>
      <LandingInner />
    </Suspense>
  );
}
