import type { Server, Socket } from 'socket.io';
import type { ZodType } from 'zod';
import {
  CalBeepSchema,
  CalFinishSchema,
  CalReportSchema,
  CalStartSchema,
  type ProtocolError,
  type Zone,
  invalidPayloadError,
  makeError,
} from '../shared/protocol';
import type { EventStore } from './store';

export type AckFn = ((res: unknown) => void) | undefined;

export function eventRoom(eventId: string): string {
  return `event:${eventId}`;
}

export function zoneRoom(eventId: string, zone: Zone): string {
  return `event:${eventId}:zone:${zone}`;
}

export function parseFrame<T>(
  socket: Socket,
  schema: ZodType<T>,
  payload: unknown,
  ack: AckFn
): T | null {
  const res = schema.safeParse(payload);
  if (!res.success) {
    const issue = res.error.issues[0];
    const msg = issue ? `${issue.path.join('.') || 'payload'}: ${issue.message}` : 'Invalid payload';
    const err: ProtocolError = invalidPayloadError(msg);
    socket.emit('error_frame', err);
    if (typeof ack === 'function') ack(err);
    return null;
  }
  return res.data;
}

export function registerCalibrationHandlers(
  io: Server,
  socket: Socket,
  store: EventStore,
  emitState: (eventId: string) => void
): void {
  socket.on('cal:beep', (payload: unknown, ack?: AckFn) => {
    const data = parseFrame(socket, CalBeepSchema, payload, ack);
    if (!data) return;
    io.to(eventRoom(data.eventId)).emit('cal:beep', { eventId: data.eventId, at: Date.now() });
    if (typeof ack === 'function') ack({ ok: true });
  });

  socket.on('cal:start', (payload: unknown, ack?: AckFn) => {
    const data = parseFrame(socket, CalStartSchema, payload, ack);
    if (!data) return;
    const started = store.startCalibration(data.eventId);
    if (!started.ok) {
      const err = makeError('SPEAKERS_MISSING', started.message);
      if (typeof ack === 'function') ack(err);
      return;
    }
    io.to(eventRoom(data.eventId)).emit('cal:start', { eventId: data.eventId, calId: started.calId });
    if (typeof ack === 'function') ack({ calId: started.calId });
  });

  socket.on('cal:report', (payload: unknown, ack?: AckFn) => {
    const data = parseFrame(socket, CalReportSchema, payload, ack);
    if (!data) return;
    const ok = store.recordCalReport(data.eventId, data.calId, {
      socketId: socket.id,
      speakerRole: data.speakerRole,
      ok: data.ok,
      cands: data.cands,
    });
    if (typeof ack === 'function') ack({ recorded: ok });
  });

  socket.on('cal:finish', (payload: unknown, ack?: AckFn) => {
    const data = parseFrame(socket, CalFinishSchema, payload, ack);
    if (!data) return;
    const fin = store.finishCalibration(data.eventId, data.calId);
    if (!fin.ok) {
      const err = makeError('CALIBRATION_FAILED', fin.message);
      io.to(eventRoom(data.eventId)).emit('cal:result', err);
      if (typeof ack === 'function') ack(err);
      return;
    }
    const snap = store.getSnapshot(data.eventId);
    for (const item of fin.updated) {
      const targetSocket = io.sockets.sockets.get(item.attendee.socketId);
      if (targetSocket) {
        if (item.prevZone !== item.attendee.zone) {
          targetSocket.leave(zoneRoom(data.eventId, item.prevZone));
          targetSocket.join(zoneRoom(data.eventId, item.attendee.zone));
        }
        targetSocket.emit('attendee:located', {
          zone: item.attendee.zone,
          x: item.attendee.x,
          cue: snap.zoneCues[item.attendee.zone],
        });
      }
    }
    const summary = {
      calId: data.calId,
      dLR: fin.dLR,
      DL: fin.DL,
      DR: fin.DR,
      locatedCount: fin.updated.length,
    };
    io.to(eventRoom(data.eventId)).emit('cal:result', summary);
    emitState(data.eventId);
    if (typeof ack === 'function') ack(summary);
  });
}
