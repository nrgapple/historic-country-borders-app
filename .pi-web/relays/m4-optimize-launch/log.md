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

## Owner follow-up after leg 1 — candidate deployment

- Owner requested that the agent perform accessible production work and explicitly declined Vercel as a fallback. Identified the registrar as Squarespace Domains II; Cloudflare CLI is authenticated, but registrar and Cloudflare zone/dashboard steps still require owner UI access.
- Preserved the existing public Mapbox and GA build variables without printing/committing them, built the reviewed commit, and deployed optimized candidate `dd9f9ff4-8018-4f5c-89c7-ca0b4215e433` after one transient asset-upload retry.
- Repeated cold-browser checks exposed an existing intermittent historical-map race (`Style is not done loading`) that the prior single M3 check had not surfaced. Fixed `MapContainer` so data sources mount only after Mapbox reports the style fully loaded; added a regression test.
- Deployed superseding candidate `6e87c859-f70d-458f-aec4-6f51c41bc4de`. Nine static smoke checks and five repeated real-map loads passed with 198 historical features, 500 districts, and zero page errors.
- Three-run candidate medians: historical FCP 348 ms/map-ready 792 ms; school FCP 344 ms/map-ready 989 ms. School transfer fell from 8,279,783 to 3,883,612 bytes (53%) versus M3 baseline. Updated performance, runbook, product review/decisions/scorecard, deployment docs, and status.
- `yarn validate` passes after the race fix (192 unit/integration tests and 15 cross-browser journeys).
- Still stopped for owner intervention: sign into Squarespace and Cloudflare dashboard, confirm Free-only plan, import the zone, follow DNSSEC/nameserver/custom-domain steps, and apply Mapbox hostname restrictions. Vercel remains disabled and excluded; Cloudflare M3 version `c3144834-a22a-4b6c-8269-22147af6f9aa` is the application rollback.
