# Relay Status: M3 Static-First Cloudflare Migration

- State: QUEUED — DO NOT START BEFORE M2 IS GREEN
- Current position: Packet prepared; M3 implementation has not started.
- Last completed leg: 0 (Relay setup)
- Next leg to run: 1
- Next task: After M2 completion, execute all account-independent static migration work, then follow the intervention policy for Cloudflare preview access.

## Relevant context

- Prerequisite: `.pi-web/relays/m2-school-districts/status.md` must say COMPLETE.
- Read `AGENTS.md`, the target architecture, and only the M3 section of `docs/UPGRADE_HARNESS_PLAN.md`.
- Existing pinned year manifest: `data/historical-manifest.json`.
- Current dynamic boundaries include historical borders, Wikipedia, feedback, and any routes left after M1/M2.
- Owner can create a free Cloudflare account but account/secret actions require intervention; never request credentials.

## Progress documentation

Update status, append `log.md`, update architecture/scorecard/deployment instructions, and preserve static/quota validation evidence before handoff or stop.

## Blockers / intervention

M2 completion is required. Cloudflare preview verification will later require owner account action and must trigger the documented intervention.
