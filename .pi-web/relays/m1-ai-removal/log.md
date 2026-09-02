# Relay Log: M1 AI and Cost-Surface Removal

## Setup — leg 0

Created the Relay packet after owner approval. The owner chose one Relay per milestone, one complete milestone per runner, highest-priority unblocked task selection, automatic green handoff, contained reading, and intervention for scope changes, spending risk, account/access needs, or subjective user-facing decisions. M1 is ready but has not been dispatched.

## Dispatch — leg 1

Checkpointed M0 as four focused commits on `upgrade/cloudflare-harness`, opened PR #30, and verified the GitHub `validate` and `dependency-review` jobs. Dependency review exposed high-severity advisories in Next.js 15.3.8, so the baseline was upgraded and revalidated on Next.js 15.5.25 before dispatch. The legacy Vercel check remains red because the blocked Vercel deployment is the migration trigger, not an M1 acceptance gate. Dispatching leg 1 to complete the M1 finish line and hand off to M2 when green.

## 2026-09-02 — Leg 1 complete

- Removed generated country-information and comparison functionality end-to-end: API routes, hooks, contexts, UI, settings, persisted preferences, history, analytics, tests, styles, setup guides, and obsolete toast copy.
- Removed the generic cache route/client and the application performance add-on; removed their dependencies plus the no-longer-needed Wikipedia wrapper dependency and regenerated `yarn.lock`.
- Kept Wikipedia as the sole information source, using bounded direct Wikipedia requests with validation, caching, timeouts, safe failures, and focused tests.
- Hardened remaining dynamic operations: feedback now has same-origin, 8 KiB/schema, per-instance rate, and outbound timeout controls; temporary map routes have method/path/source-size/timeouts and safe failures. Added `docs/RUNTIME_SURFACE.md` with M2/M3 dispositions and Cloudflare dashboard work.
- Updated `public/robots.txt` to block named model-training/answer crawlers without blocking ordinary pages or required assets.
- Updated README, PA school docs, upgrade status, product backlog, decisions, and scorecard. Added replacement regression tests for Wikipedia, country/district UI, route bounds, and rate limiting.
- Validation: `yarn install --frozen-lockfile` passed; `yarn validate` passed with 187 Vitest tests, coverage floors, production build/size checks, and 3 Chromium journeys. Exact source/runtime and built-client scans found no removed feature/service references.
- Relay state set to COMPLETE. Handing off exactly once to `m2-school-districts` leg 1.
