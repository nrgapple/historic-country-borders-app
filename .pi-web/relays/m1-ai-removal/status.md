# Relay Status: M1 AI and Cost-Surface Removal

- State: READY
- Current position: M0 harness is implemented and locally validated; M1 has not started.
- Last completed leg: 0 (Relay setup)
- Next leg to run: 1
- Next task: Complete the entire M1 finish line in `charter.md`.

## Relevant context

- Read `AGENTS.md`.
- Read `docs/UPGRADE_HARNESS_PLAN.md` only from `### M1 — Remove AI and reduce attack/cost surface` through its exit gate.
- Existing M0 changes are uncommitted. Preserve them; do not reset or discard the working tree.
- Baseline gate: `yarn validate` passes with 311 Vitest tests and 3 deterministic Chromium journeys.
- Current runtime references can be located with targeted searches for `Gemini`, `aiCompare`, `InfoProvider`, `redis`, `SpeedInsights`, and related environment variables.

## Progress documentation

Before stop or handoff:

1. Update this status with state, completed leg, next leg/task, focused context, and blockers.
2. Append a concise entry to `log.md`.
3. Update product scorecard/decisions when the resulting product surface changes.
4. Keep implementation and validation artifacts on disk.

## Blockers / intervention

None currently.
