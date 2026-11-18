import type { Server, Socket } from 'socket.io';
import {
  AttendeeJoinSchema,
  AttendeeRoleSchema,
  AttendeeZoneSchema,
  ClockPingSchema,
  CueBlackoutSchema,
  CueSendSchema,
  EventCreateSchema,
  ProducerJoinSchema,
  ProducerRoleSchema,
  type CueState,
  makeError,
} from '../shared/protocol';
import type { EventStore } from './store';
import {
  type AckFn,
  eventRoom,
  parseFrame,
  registerCalibrationHandlers,
  zoneRoom,
} from './socket-cal';

export function attachSocketHandlers(io: Server, store: EventStore): void {
  const emitState = (eventId: string): void => {
    io.to(eventRoom(eventId)).emit('event:state', store.getSnapshot(eventId));
  };

  io.on('connection', (socket: Socket) => {
    socket.on('clock:ping', (payload: unknown, ack?: AckFn) => {
      const data = parseFrame(socket, ClockPingSchema, payload, ack);
      if (!data) return;
      const resp = { t0: data.t0, th: Date.now() };
      socket.emit('clock:pong', resp);
      if (typeof ack === 'function') ack(resp);
    });

    socket.on('event:create', (payload: unknown, ack?: AckFn) => {
      const data = parseFrame(socket, EventCreateSchema, payload ?? {}, ack);
      if (!data) return;
      const eventId = data.eventId ?? store.generateEventId(5);
      store.joinProducer(socket.id, eventId, data.hostSpeakerRole);
      socket.join(eventRoom(eventId));
      const snap = store.getSnapshot(eventId);
      emitState(eventId);
      if (typeof ack === 'function') ack({ state: snap });
    });

    socket.on('producer:join', (payload: unknown, ack?: AckFn) => {
      const data = parseFrame(socket, ProducerJoinSchema, payload, ack);
      if (!data) return;
      store.joinProducer(socket.id, data.eventId, data.hostSpeakerRole);
      socket.join(eventRoom(data.eventId));
      const snap = store.getSnapshot(data.eventId);
      emitState(data.eventId);
      if (typeof ack === 'function') ack({ state: snap });
    });

    socket.on('producer:role', (payload: unknown, ack?: AckFn) => {
      const data = parseFrame(socket, ProducerRoleSchema, payload, ack);
      if (!data) return;
      if (!store.setProducerRole(socket.id, data.eventId, data.hostSpeakerRole)) {
        if (typeof ack === 'function') ack(makeError('NOT_JOINED', 'Producer is not joined.'));
        return;
      }
      emitState(data.eventId);
      if (typeof ack === 'function') ack({ state: store.getSnapshot(data.eventId) });
    });

    socket.on('attendee:join', (payload: unknown, ack?: AckFn) => {
      const data = parseFrame(socket, AttendeeJoinSchema, payload, ack);
      if (!data) return;
      const att = store.joinAttendee({ socketId: socket.id, ...data });
      socket.join(eventRoom(att.eventId));
      socket.join(zoneRoom(att.eventId, att.zone));
      const snap = store.getSnapshot(att.eventId);
      const activeCue = snap.zoneCues[att.zone];
      socket.emit('cue:active', activeCue);
      emitState(att.eventId);
      if (typeof ack === 'function') ack({ attendee: att, cue: activeCue, state: snap });
    });

    socket.on('attendee:zone', (payload: unknown, ack?: AckFn) => {
      const data = parseFrame(socket, AttendeeZoneSchema, payload, ack);
      if (!data) return;
      const res = store.updateAttendeeZone(socket.id, data.eventId, data.zone, data.x, data.posSource);
      if (!res) {
        if (typeof ack === 'function') ack(makeError('NOT_JOINED', 'Attendee is not joined.'));
        return;
      }
      if (res.prevZone !== res.attendee.zone) {
        socket.leave(zoneRoom(data.eventId, res.prevZone));
        socket.join(zoneRoom(data.eventId, res.attendee.zone));
      }
      const activeCue = store.getSnapshot(data.eventId).zoneCues[res.attendee.zone];
      socket.emit('cue:active', activeCue);
      emitState(data.eventId);
      if (typeof ack === 'function') ack({ attendee: res.attendee, cue: activeCue });
    });

    socket.on('attendee:role', (payload: unknown, ack?: AckFn) => {
      const data = parseFrame(socket, AttendeeRoleSchema, payload, ack);
      if (!data) return;
      const res = store.updateAttendeeRole(socket.id, data.eventId, data.speakerRole);
      if (!res) {
        if (typeof ack === 'function') ack(makeError('NOT_JOINED', 'Attendee is not joined.'));
        return;
      }
      if (res.prevZone !== res.attendee.zone) {
        socket.leave(zoneRoom(data.eventId, res.prevZone));
        socket.join(zoneRoom(data.eventId, res.attendee.zone));
      }
      socket.emit('cue:active', store.getSnapshot(data.eventId).zoneCues[res.attendee.zone]);
      emitState(data.eventId);
      if (typeof ack === 'function') ack({ attendee: res.attendee });
    });

    socket.on('cue:send', (payload: unknown, ack?: AckFn) => {
      const data = parseFrame(socket, CueSendSchema, payload, ack);
      if (!data) return;
      const cue: CueState = {
        fx: data.fx, color: data.color, speed: data.speed, width: data.width,
        loop: data.loop, dir: data.dir, targetZone: data.targetZone,
        intensity: data.intensity, at: Date.now() + 100,
      };
      for (const z of store.applyCue(data.eventId, cue)) {
        io.to(zoneRoom(data.eventId, z)).emit('cue:active', cue);
      }
      emitState(data.eventId);
      if (typeof ack === 'function') ack({ cue });
    });

    socket.on('cue:blackout', (payload: unknown, ack?: AckFn) => {
      const data = parseFrame(socket, CueBlackoutSchema, payload, ack);
      if (!data) return;
      const cue: CueState = {
        fx: 'off', color: '#000000', speed: 100, width: 14, loop: false,
        dir: 1, targetZone: data.targetZone, intensity: 0, at: Date.now(),
      };
      for (const z of store.applyCue(data.eventId, cue)) {
        io.to(zoneRoom(data.eventId, z)).emit('cue:active', cue);
      }
      emitState(data.eventId);
      if (typeof ack === 'function') ack({ cue });
    });

    registerCalibrationHandlers(io, socket, store, emitState);

    socket.on('disconnect', () => {
      const eventId = store.removeSocket(socket.id);
      if (eventId) emitState(eventId);
    });
  });
}
