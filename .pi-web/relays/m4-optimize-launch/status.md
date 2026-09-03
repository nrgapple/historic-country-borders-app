# Relay Status: M4 Optimize and Launch

- State: BLOCKED — OWNER INPUT REQUIRED
- Current position: Leg 1 completed all safe account-independent optimization, budgets, monitoring, measurement, and launch/rollback preparation. Production remains on disabled Vercel (HTTP 402); optimized Cloudflare candidate is not deployed or cut over.
- Last completed leg: 1 (account-independent optimize and launch preparation)
- Next leg to run: 2, only after owner resolves account/DNS intervention
- Next task: Owner deploys/verifies the candidate and completes or supervises the exact registrar/DNSSEC/custom-domain steps in `docs/M4_LAUNCH_RUNBOOK.md`; resumed runner performs production acceptance and records launch, 24-hour, and seven-day quota/error reviews.

## Completed evidence

- School artifact reduced 20,379,855 → 12,023,844 bytes (41%); Brotli estimate reduced 5,019,960 → 1,797,383 bytes (64%) while source hash, 500 districts, properties, geometry mix, and labels validate.
- FingerprintJS now loads only after feedback opens; initial route JS fell 7.5–8.0%. Tight CI budgets pass and cover JS plus historical/school data.
- M3 production baseline and deterministic before/final timings are in `docs/M4_PERFORMANCE_REPORT.md`.
- Static-only scheduled monitoring and `yarn smoke:production` cover nine checks with intended Worker requests of zero. The M3 preview smoke passes.
- Static validation reports 198 files, one public dynamic route, one internal Durable Object, zero Next API routes, and zero Pages Functions.
- `yarn validate` passes: 192 unit/integration tests, data/export/Wrangler/budget gates, and 15 cross-browser journeys.

## Owner intervention required

1. Identify registrar/DNS access; no credentials in chat.
2. Confirm Cloudflare Workers/Durable Objects are Free with no paid add-on or automatic overage.
3. Decide the rollback boundary: re-enable and smoke-test Vercel, or explicitly accept that DNS rollback restores known HTTP 402 while Cloudflare version rollback remains viable.
4. Follow `docs/M4_LAUNCH_RUNBOOK.md`, especially the existing DS/DNSSEC sequence; deploy the reviewed candidate and record non-secret version/plan evidence.
5. After account access and candidate deployment are resolved, dispatch M4 leg 2. Do not start M5.

## Relevant context for leg 2

- Runbook: `docs/M4_LAUNCH_RUNBOOK.md`
- Measurements/budgets: `docs/M4_PERFORMANCE_REPORT.md`
- Deployment boundary and prior version: `docs/CLOUDFLARE_DEPLOYMENT.md`
- Scorecard/review destinations: `docs/product/SCORECARD.md`, `docs/product/REVIEW.md`
- Required commands: `yarn validate`, `BASE_URL=<candidate> yarn smoke:production`, `RUNS=3 BASE_URL=<candidate> yarn performance:measure`

## Progress documentation

On resume, update this status, append `log.md`, record candidate/production version IDs and non-secret evidence, and preserve rollback before any stop.
