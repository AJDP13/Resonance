'use client';

import { Suspense, useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { type EffectType, type RosterEntry, type Zone, xToZone } from '@/shared/protocol';
import { QrSection } from './QrSection';
import { CalibrationSection } from './CalibrationSection';
import { LightShowSection, type CueControlsState } from './LightShowSection';
import { MusicSection, type ReactiveCueDispatch } from './MusicSection';
import { useProducerSocket } from './useProducerSocket';

function ProducerInner() {
  const searchParams = useSearchParams();
  const requestedId = (searchParams.get('eventId') ?? searchParams.get('room') ?? '')
    .trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');

  const {
    connected, eventId, hostRole, calibrating, calMessage, snapshot,
    createNewSession, updateHostRole, startCalibration, sendCue, sendBlackout, sendBeep,
  } = useProducerSocket(requestedId);

  const [fakePhones, setFakePhones] = useState<RosterEntry[]>([]);
  const [controls, setControls] = useState<CueControlsState>({
    color: '#ffd166', speed: 100, width: 14, loop: true, targetZone: 'All',
  });

  const triggerCue = useCallback(
    (fx: EffectType, dir: 1 | -1 = 1) => {
      sendCue({
        fx, color: controls.color, speed: controls.speed, width: controls.width,
        loop: controls.loop, dir, targetZone: controls.targetZone, intensity: 1,
      });
    },
    [controls, sendCue]
  );

  const handleMusicCue = useCallback(
    (mc: ReactiveCueDispatch) => {
      sendCue({
        fx: mc.fx, color: mc.color, speed: mc.speed, width: controls.width,
        loop: true, dir: mc.dir, targetZone: mc.targetZone, intensity: mc.intensity,
      });
    },
    [controls.width, sendCue]
  );

  return (
    <main className="mx-auto max-w-[580px] px-4 pt-6 pb-16">
      <h1 className="text-3xl font-extrabold tracking-tight">
        Reso<span className="text-[#ffd166]">nance</span>{' '}
        <span className="text-sm font-normal text-[#9a968c]">producer</span>
      </h1>

      <QrSection
        eventId={eventId}
        connected={connected}
        counts={snapshot.counts}
        locatedSummary={
          snapshot.locatedCount > 0 ? `${snapshot.audioLocatedCount}/${snapshot.locatedCount} placed by chirp` : ''
        }
        onNewSession={createNewSession}
      />

      <CalibrationSection
        hasLeftSpeaker={snapshot.hasLeftSpeaker}
        hasRightSpeaker={snapshot.hasRightSpeaker}
        hostRole={hostRole}
        calibrating={calibrating}
        calMessage={calMessage}
        fakeCount={fakePhones.length}
        onSetHostRole={(r) => void updateHostRole(r)}
        onTestBeep={sendBeep}
        onCalibrate={() => void startCalibration()}
        onToggleFake={() =>
          setFakePhones((prev) =>
            prev.length
              ? []
              : Array.from({ length: 60 }, (_, i) => {
                  const x = Math.random();
                  const z: Zone = xToZone(x);
                  return { participantId: `sim_${i}`, zone: z, x, posSource: 'manual', speakerRole: 'crowd', seed: Math.random() };
                })
          )
        }
      />

      <LightShowSection
        roster={snapshot.roster}
        fakePhones={fakePhones}
        zoneCues={snapshot.zoneCues}
        controls={controls}
        onChangeControls={(patch) => setControls((c) => ({ ...c, ...patch }))}
        onTriggerCue={triggerCue}
        onBlackout={() => sendBlackout(controls.targetZone)}
      />

      <MusicSection onMusicCue={handleMusicCue} />
    </main>
  );
}

export default function ProducerPage() {
  return (
    <Suspense fallback={<div className="p-8 text-[#9a968c]">Loading Producer Console…</div>}>
      <ProducerInner />
    </Suspense>
  );
}
