---
name: verify-release
description: Run this procedure whenever verifying the Resonance app, preparing a release, or checking the four definition-of-done gates before reporting completion.
---

## Resonance Release Verification Procedure

1. **Typecheck**: Run `npm run typecheck` (`tsc --noEmit`). Must pass with exit code `0` (zero TypeScript errors, no `any`).
2. **Automated Tests**: Run `npm test` (`vitest run`). All tests must pass, specifically validating per-zone counts, global cues, zone isolation, reconnect sync, and blackout.
3. **Production Build**: Run `npm run build`. Both Next.js App Router and Node server builds must complete with exit code `0`.
4. **Smoke & Health Check**: Start `npm start` on port 8080 (`http://localhost:8080`). Send `GET /api/health` and verify `200 OK` with `{ status: 'ok' }`. Verify that `/producer` and `/attendee` load with no unhandled runtime errors.
