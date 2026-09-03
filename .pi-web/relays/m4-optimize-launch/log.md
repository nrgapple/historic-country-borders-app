# Relay Log: M4 Optimize and Launch

## Setup — leg 0

Created the queued final infrastructure Relay packet. M4 stops after launch/review; M5 requires a separately approved product finish line.

## Leg 1 — account-independent optimize and launch preparation

- Confirmed M3 prerequisite complete and measured M3 preview cold Chromium baseline for historical and school journeys, including FCP, map readiness, data transfer/duration, long tasks, cache behavior, and errors.
- Optimized the measured school-data bottleneck by publishing six-decimal coordinates: raw bytes fell 41% and estimated Brotli bytes 64% with pinned source hash, count, properties, geometry validation, and labels preserved. Deferred geometry simplification as unsupported by current fidelity tests.
- Deferred FingerprintJS loading until explicit feedback intent, reducing map-route initial JavaScript 7.5–8.0% while retaining feedback abuse controls.
- Tightened CI budgets for total/largest/route-initial JS and historical/school payload sizes; strengthened static validation to enumerate the one public Worker route and one Durable Object and reject unexpected browser API fetches.
- Added reproducible performance measurement, static production smoke tooling/tests, and a four-times-daily static-only uptime workflow with zero intended Worker requests. M3 preview smoke passed all nine checks.
- Added `docs/M4_PERFORMANCE_REPORT.md` and exact `docs/M4_LAUNCH_RUNBOOK.md`; updated deployment/runtime/product decisions, scorecard, and pre-launch review. The runbook captures current DNS/DNSSEC/Vercel risk, free-tier/bot controls, exact cutover checks, two rollback layers, Vercel retirement, and launch/24-hour/seven-day reviews.
- Validation: `yarn validate` passed (192 unit/integration tests, data/static/Wrangler/budget gates, 15 cross-browser journeys); production-preview smoke passed.
- Stopped as required with `BLOCKED — OWNER INPUT REQUIRED`: deploying the optimized Worker, Cloudflare plan evidence, registrar/DNSSEC/custom-domain changes, rollback acceptance, and production reviews require owner access. No handoff spawned; leg 2 may be dispatched only after intervention is resolved.
