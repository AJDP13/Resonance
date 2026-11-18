import { z } from 'zod';

export const ZONES = ['Left', 'Center', 'Right'] as const;
export const ZoneSchema = z.enum(ZONES);
export type Zone = z.infer<typeof ZoneSchema>;

export const CUE_TARGETS = ['All', 'Left', 'Center', 'Right'] as const;
export const CueTargetSchema = z.enum(CUE_TARGETS);
export type CueTarget = z.infer<typeof CueTargetSchema>;

export const SpeakerRoleSchema = z.enum(['crowd', 'L', 'R']);
export type SpeakerRole = z.infer<typeof SpeakerRoleSchema>;

export const HostSpeakerRoleSchema = z.enum(['none', 'L', 'R']);
export type HostSpeakerRole = z.infer<typeof HostSpeakerRoleSchema>;

export const PosSourceSchema = z.enum(['zone', 'manual', 'audio', 'speaker']);
export type PosSource = z.infer<typeof PosSourceSchema>;

export const EffectTypeSchema = z.enum([
  'off', 'solid', 'flash', 'wave', 'bounce', 'rainbow', 'sparkle', 'split', 'pulse',
]);
export type EffectType = z.infer<typeof EffectTypeSchema>;

export const EventIdSchema = z
  .string().trim().min(2).max(24)
  .regex(/^[A-Za-z0-9_-]+$/, 'Invalid eventId characters')
  .transform((val) => val.toUpperCase());

export const HexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected #RRGGBB hex color');

export const EventCreateSchema = z.object({
  eventId: EventIdSchema.optional(),
  hostSpeakerRole: HostSpeakerRoleSchema.default('none'),
});

export const ProducerJoinSchema = z.object({
  eventId: EventIdSchema,
  hostSpeakerRole: HostSpeakerRoleSchema.default('none'),
});

export const ProducerRoleSchema = z.object({
  eventId: EventIdSchema,
  hostSpeakerRole: HostSpeakerRoleSchema,
});

export const AttendeeJoinSchema = z.object({
  eventId: EventIdSchema,
  participantId: z.string().trim().min(2).max(64),
  zone: ZoneSchema,
  x: z.number().min(0).max(1).optional(),
  posSource: PosSourceSchema.default('zone'),
  speakerRole: SpeakerRoleSchema.default('crowd'),
});

export const AttendeeZoneSchema = z.object({
  eventId: EventIdSchema,
  zone: ZoneSchema,
  x: z.number().min(0).max(1).optional(),
  posSource: PosSourceSchema.default('manual'),
});

export const AttendeeRoleSchema = z.object({
  eventId: EventIdSchema,
  speakerRole: SpeakerRoleSchema,
});

export const CueSendSchema = z.object({
  eventId: EventIdSchema,
  fx: EffectTypeSchema,
  color: HexColorSchema.default('#ffffff'),
  speed: z.number().min(10).max(400).default(100),
  width: z.number().min(2).max(100).default(14),
  loop: z.boolean().default(true),
  dir: z.union([z.literal(1), z.literal(-1)]).default(1),
  targetZone: CueTargetSchema.default('All'),
  intensity: z.number().min(0).max(1).default(1),
});

export const CueBlackoutSchema = z.object({
  eventId: EventIdSchema,
  targetZone: CueTargetSchema.default('All'),
});

export const ClockPingSchema = z.object({ t0: z.number().finite() });
export const CalBeepSchema = z.object({ eventId: EventIdSchema });
export const CalStartSchema = z.object({ eventId: EventIdSchema });
export const CalCandidateSchema = z.object({ D: z.number().finite(), n: z.number().int().nonnegative() });

export const CalReportSchema = z.object({
  eventId: EventIdSchema,
  calId: z.number().int().positive(),
  speakerRole: SpeakerRoleSchema,
  ok: z.boolean(),
  cands: z.array(CalCandidateSchema).max(12),
  nL: z.number().int().nonnegative(),
  nR: z.number().int().nonnegative(),
});

export const CalFinishSchema = z.object({
  eventId: EventIdSchema,
  calId: z.number().int().positive(),
});

export const HttpCreateEventSchema = z.object({ eventId: EventIdSchema.optional() }).strict();
export const HealthCheckQuerySchema = z.object({ ping: z.string().max(32).optional() }).strict();

export interface CueState {
  fx: EffectType;
  color: string;
  speed: number;
  width: number;
  loop: boolean;
  dir: 1 | -1;
  targetZone: CueTarget;
  intensity: number;
  at: number;
}

export interface ZoneCounts {
  Left: number;
  Center: number;
  Right: number;
  total: number;
}

export interface RosterEntry {
  participantId: string;
  zone: Zone;
  x: number;
  posSource: PosSource;
  speakerRole: SpeakerRole;
  seed: number;
}

export interface EventStateSnapshot {
  eventId: string;
  counts: ZoneCounts;
  zoneCues: Record<Zone, CueState>;
  hasLeftSpeaker: boolean;
  hasRightSpeaker: boolean;
  locatedCount: number;
  audioLocatedCount: number;
  roster: RosterEntry[];
}

export interface ProtocolError {
  error: { code: string; message: string };
}

export function makeError(code: string, message: string): ProtocolError {
  return { error: { code, message } };
}

export function invalidPayloadError(message: string): ProtocolError {
  return { error: { code: 'INVALID_PAYLOAD', message } };
}

export function xToZone(x: number): Zone {
  if (x < 1 / 3) return 'Left';
  if (x <= 2 / 3) return 'Center';
  return 'Right';
}

export function zoneToDefaultX(zone: Zone): number {
  if (zone === 'Left') return 0.16;
  if (zone === 'Center') return 0.5;
  return 0.84;
}
