# Relay Status: M4 Optimize and Launch

- State: BLOCKED — OWNER INPUT REQUIRED
- Current position: Account-independent work and optimized Worker candidate deployment are complete. Candidate `6e87c859-f70d-458f-aec4-6f51c41bc4de` passes static and repeated real-map checks. Production remains on disabled Vercel (HTTP 402) because Squarespace DNS/Cloudflare-zone UI access is still required.
- Last completed leg: 1 (account-independent optimize and launch preparation)
- Next leg to run: 2, only after owner resolves account/DNS intervention
- Next task: Owner signs into Squarespace Domains and Cloudflare dashboard to complete or supervise the DNSSEC/zone/custom-domain steps in `docs/M4_LAUNCH_RUNBOOK.md`; resumed runner performs production acceptance and records launch, 24-hour, and seven-day quota/error reviews.

## Completed evidence

- School artifact reduced 20,379,855 → 12,023,844 bytes (41%); Brotli estimate reduced 5,019,960 → 1,797,383 bytes (64%) while source hash, 500 districts, properties, geometry mix, and labels validate.
- FingerprintJS now loads only after feedback opens; initial route JS fell 7.5–8.0%. Tight CI budgets pass and cover JS plus historical/school data.
- M3 baseline plus deployed candidate timings are in `docs/M4_PERFORMANCE_REPORT.md`; school transfer fell 53% and map-ready median improved 49% on the Worker hostname.
- Static-only scheduled monitoring and `yarn smoke:production` cover nine checks with intended Worker requests of zero. The M3 preview smoke passes.
- Static validation reports 198 files, one public dynamic route, one internal Durable Object, zero Next API routes, and zero Pages Functions.
- `yarn validate` passes: 192 unit/integration tests, data/export/Wrangler/budget gates, and 15 cross-browser journeys.

## Owner intervention required

1. Sign into the registrar identified as Squarespace Domains; no credentials in chat.
2. In Cloudflare dashboard, confirm Workers/Durable Objects are Free with no paid add-on or automatic overage and add/import the `historicborders.app` zone.
3. Follow `docs/M4_LAUNCH_RUNBOOK.md`, especially the existing DS/DNSSEC sequence, nameserver change, custom domain, `www` redirect, and Mapbox hostname restriction.
4. The owner declined Vercel as a fallback. Keep Cloudflare version rollback (`c3144834-a22a-4b6c-8269-22147af6f9aa`) as the application rollback; Vercel stays disabled pending retirement review.
5. After dashboard/DNS access is resolved, dispatch M4 leg 2. Do not start M5.

## Relevant context for leg 2

- Runbook: `docs/M4_LAUNCH_RUNBOOK.md`
- Measurements/budgets: `docs/M4_PERFORMANCE_REPORT.md`
- Deployment boundary and prior version: `docs/CLOUDFLARE_DEPLOYMENT.md`
- Scorecard/review destinations: `docs/product/SCORECARD.md`, `docs/product/REVIEW.md`
- Required commands: `yarn validate`, `BASE_URL=<candidate> yarn smoke:production`, `RUNS=3 BASE_URL=<candidate> yarn performance:measure`

## Progress documentation

On resume, update this status, append `log.md`, record candidate/production version IDs and non-secret evidence, and preserve rollback before any stop.
