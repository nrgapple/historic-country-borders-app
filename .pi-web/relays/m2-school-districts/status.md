# Relay Status: M2 Pennsylvania School Districts

- State: QUEUED — DO NOT START BEFORE M1 IS GREEN
- Current position: Packet prepared; M2 implementation has not started.
- Last completed leg: 0 (Relay setup)
- Next leg to run: 1
- Next task: After M1 completion, execute the complete M2 finish line.

## Relevant context

- Prerequisite: `.pi-web/relays/m1-ai-removal/status.md` must say COMPLETE.
- Read `AGENTS.md` and only the M2 section of `docs/UPGRADE_HARNESS_PLAN.md`.
- Primary current paths: `hooks/usePASchoolDistricts.tsx`, `pages/api/pa-school-districts.ts`, `scripts/preprocess-districts.js`, `components/PASchoolDistrictsMapContainer.tsx`, `components/PASchoolDistrictsMapSources.tsx`, `docs/PA_SCHOOL_DISTRICTS.md`.
- Upstream was observed at 21,161,924 bytes, but schema/count/geometry must be measured and pinned by this Relay.

## Progress documentation

Update status, append `log.md`, update scorecard/source decisions, and preserve generated validation reports before handoff or stop.

## Blockers / intervention

M1 completion is the only current prerequisite.
