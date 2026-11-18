# Project: Resonance
Browser-based crowd light-show app for live events with coarse zone assignment and QR/manual fallback. See brief for acceptance criteria.

## Stack
- Next.js (App Router), React, TypeScript 5 (`"strict": true`; `any` forbidden), Tailwind CSS, and Zod.
- Custom Node HTTP + Socket.IO server in `src/server/` keeping event, zone, and cue state strictly in memory (no database or ORM).
- Automated tests with Vitest in `tests/` (no new `package.json` dependency without a one-line commit justification).

## Conventions
- Views live in `src/app/` (`/producer`, `/attendee`, `/api/health`), Socket.IO server in `src/server/`, shared contracts in `src/shared/`, tests in `tests/`. Keep every `.ts`/`.tsx` file <= 200 lines.
- Validate every incoming Socket.IO event and HTTP payload with shared Zod schemas in `src/shared/protocol.ts`; reject invalid frames with `{ error: { code: 'INVALID_PAYLOAD', message: string } }` and return `{ error: { code, message } }` on all errors.
- Restrict zones to `'Left' | 'Center' | 'Right'`. Persist active `eventId` and `zone` in `sessionStorage` and URL query params so refreshing `/attendee` automatically rejoins the event, restores its zone, and syncs current cue state.
- Never use `MediaRecorder`, store audio, or send audio over HTTP/Socket.IO; run optional Web Audio checks strictly in client memory and expose the manual/QR zone picker immediately if mic access is denied or unused.
- No auth, accounts, or payments. Put explicit `data-testid` attributes on every cue button, zone picker, live counter, and attendee display surface.

## Definition of done
- `npm run typecheck` (`tsc --noEmit`) passes with exit code `0`.
- `npm test` (`vitest run`) passes with exit code `0`, testing Socket.IO per-zone counts, global cues, zone isolation, refresh/reconnect sync, and blackout.
- `npm run build` completes the Next.js and server production build with exit code `0`.
- `npm start` serves Next.js and Socket.IO from a single process on port `8080` (`http://localhost:8080`) with `GET /api/health` returning `200 OK` and no `.env` required.
- Do not tell me a task is complete until all four commands above have been run and passed.
