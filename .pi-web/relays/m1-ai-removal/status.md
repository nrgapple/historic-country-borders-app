# Relay Status: M1 AI and Cost-Surface Removal

- State: ACTIVE — leg 1 dispatched
- Current position: M0 is committed on `upgrade/cloudflare-harness`, PR #30 is open, and the GitHub `validate` and `dependency-review` jobs are green. M1 implementation is starting.
- Last completed leg: 0 (Relay setup and dispatch readiness)
- Next leg to run: 1
- Next task: Complete the entire M1 finish line in `charter.md`.

## Relevant context

- Read `AGENTS.md`.
- Read `docs/UPGRADE_HARNESS_PLAN.md` only from `### M1 — Remove AI and reduce attack/cost surface` through its exit gate.
- Preserve the committed M0 baseline and continue on `upgrade/cloudflare-harness`; do not reset or discard prior work.
- PR #30: `https://github.com/nrgapple/historic-country-borders-app/pull/30`.
- Baseline gate: local `yarn validate` and GitHub CI pass with 311 Vitest tests and 3 deterministic Chromium journeys.
- Next.js is pinned to 15.5.25 after dependency review identified high-severity advisories in 15.3.8.
- The legacy Vercel status remains red because the Vercel account is blocked; this is expected during migration and is not an M1 gate.
- Current runtime references can be located with targeted searches for `Gemini`, `aiCompare`, `InfoProvider`, `redis`, `SpeedInsights`, and related environment variables.

## Progress documentation

Before stop or handoff:

1. Update this status with state, completed leg, next leg/task, focused context, and blockers.
2. Append a concise entry to `log.md`.
3. Update product scorecard/decisions when the resulting product surface changes.
4. Keep implementation and validation artifacts on disk.

## Blockers / intervention

None currently.
