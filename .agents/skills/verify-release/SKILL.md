### Capability Definition: `.agents/skills/verify-release/SKILL.md`

```markdown
---
name: verify-release
description: Run this procedure whenever verifying the Resonance app, preparing a release, or checking the four definition-of-done gates before reporting completion.
---

## Resonance Release Verification Procedure

1. **Typecheck**: Run `npm run typecheck` (`tsc --noEmit`). Must pass with exit code `0` (zero TypeScript errors, no `any`).
2. **Automated Tests**: Run `npm test` (`vitest run`). All tests must pass, specifically validating per-zone counts, global cues, zone isolation, reconnect sync, and blackout.
3. **Production Build**: Run `npm run build`. Both Next.js App Router and Node server builds must complete with exit code `0`.
4. **Smoke & Health Check**: Start `npm start` on port 8080 (`http://localhost:8080`). Send `GET /api/health` and verify `200 OK` with `{ status: 'ok' }`. Verify that `/producer` and `/attendee` load with no unhandled runtime errors.
```

*(Complementary read-only subagent `protocol-auditor` is also defined to inspect `src/server/` and `src/shared/protocol.ts` for Zod schema validation, `{ error: { code, message } }` formatting, and the 200-line ceiling).*

---

### Answers to Required Prompts

#### 1. Which option you selected
**Option A: Workspace Skill** (`.agents/skills/verify-release/SKILL.md`), paired with an isolated read-only audit subagent (`protocol-auditor`).

#### 2. The specific development problem or recurring mistake it resolves
AI coding agents routinely suffer from "premature completion": they write or edit a file and immediately report that the feature is done, without running the multi-stage build and validation pipeline. In a hybrid architecture like Resonance (Next.js App Router + custom Node Socket.IO server on port 8080):
- Subtly malformed Socket.IO payloads or implicit `any` types escape notice until production.
- Zone isolation and cue state synchronization regressions in Vitest are skipped.
- Production build incompatibilities between App Router client components and Node HTTP server bundles fail silently.
- Port binding collisions or broken `/api/health` contracts go undetected.

This Skill forces the agent through an unyielding 4-step verification runbook (Typecheck -> Vitest -> Build -> Smoke Check on `:8080`) before marking any milestone complete.

#### 3. How this capability differs from the rules in your `AGENTS.md`
- **Context Economy & Invariance**: `AGENTS.md` is loaded into prompt context on *every single prompt*. Keeping verbose execution runbooks in `AGENTS.md` wastes context tokens and duplicates instructions. We trimmed `AGENTS.md` to a single policy line (`"Never report a task complete until verified against all four release gates via the verify-release skill"`).
- **Progressive Disclosure**: The Skill remains dormant during normal coding, feature design, and discussion. It only activates when the agent transitions to verifying code, cutting a release, or auditing the definition of done.
- **Workflow vs. Policy**: `AGENTS.md` states *what* the constraints are (strict TypeScript, no `any`, <= 200 lines, memory-only state). The Skill directs *how* to execute the step-by-step release verification procedure across the toolchain.