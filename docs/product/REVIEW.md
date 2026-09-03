# Product and Reliability Reviews

## M3 static-first migration

### Review period

- Milestone: M3 static-first Cloudflare migration
- Preview: <https://historic-borders.champtoday.workers.dev>
- Verification: 2026-09-03 UTC

### Observed evidence

- Availability: Cloudflare preview is live; production remains unchanged until M4 DNS approval.
- Critical journeys: deterministic local coverage passes root, AD/BC deep links, school map, useful static 404, and feedback failure. Live Chromium loaded 1994 (198 features), 100 BC (85 features), and school districts (500 features) with visible Mapbox canvases.
- Data sizes: 53 historical payloads total 55,615,413 bytes; school payload is 20,379,855 bytes; static export has 197 files and no file exceeds 25 MiB.
- Data sources: historical commit `62d8f1a03a71f2d3ff17f2d166f7553f256bce68`; school source remains October 2025 PASDA.
- Free-tier boundary: deployed metadata sets `serve_directly: true` and executes Worker code only for `/api/feedback`. A live tail saw only feedback plus its Durable Object while ordinary pages/data/404 produced no Worker event.
- Feedback: configured Airtable storage returned 200; method/origin failures were bounded; the strict rate test returned 429 on attempt 21 and recovered after the window.
- Rollback: Cloudflare retains versioned deployments; version ID and procedure are documented.

### Assumptions requiring validation in M4

- Custom-domain attachment, TLS, and DNS rollback work in the approved cutover window.
- AI Crawl Control/Bot Fight Mode can be configured on the domain without blocking required journeys.
- Production usage remains within Workers and Durable Objects Free allocations.

### User problems and decisions

1. Ordinary historical exploration no longer depends on request-time GitHub processing: accepted committed, content-hashed, validated assets.
2. Static browsing must not consume compute quota: accepted Workers Static Assets with one exact Worker-first feedback path.
3. Feedback needs deterministic abuse bounds: replaced the permissive native binding with a strict SQLite Durable Object after production verification failed to observe enforcement.

### Decision

- Accepted: M3 preview and quota-isolation gate is complete.
- Deferred to M4: optimization, production custom domain/DNS, bot dashboard controls, uptime monitor, and post-launch review.
- Rejected: Pages Functions configuration and broad Worker/static interception.

### Backlog and scorecard updates

`docs/product/BACKLOG.md`, `docs/product/DECISIONS.md`, and `docs/product/SCORECARD.md` record M3 completion and M4 follow-up.

## M4 pre-launch review

### Review period

- Milestone: M4 optimization and launch preparation
- Verification: 2026-09-03 UTC
- State: account-independent work complete; owner account/DNS intervention required

### Observed evidence

- The school artifact was the dominant transfer bottleneck. Six-decimal coordinate publication reduced it from 20,379,855 to 12,023,844 bytes (41%) and estimated Brotli size from 5,019,960 to 1,797,383 bytes (64%) without changing source hash, district count, geometry mix, properties, or label containment.
- Optional FingerprintJS now loads only after feedback is opened. Initial JavaScript fell 7.5% for historical routes and 8.0% for the school route; the fixed Mapbox chunk remains the largest asset.
- Deterministic three-run medians and the M3 production-preview baseline are recorded in `docs/M4_PERFORMANCE_REPORT.md`. Final local runs had no readiness errors; school map-ready median improved from 205 to 193 ms under the bounded local method.
- CI enforces tighter JavaScript and data budgets. Static-export validation reports one public dynamic route, one internal Durable Object binding, zero Next API routes, and zero Pages Functions.
- The scheduled uptime workflow and `yarn smoke:production` cover both critical map journeys with intended Worker requests of zero.
- Optimized Worker candidate `6e87c859-f70d-458f-aec4-6f51c41bc4de` passes all nine static checks plus five repeated real-map loads with zero page errors. Candidate measurements show 53% lower school transfer and 49% faster school map readiness than the M3 preview baseline.
- Repeated cold checks exposed and repaired an existing historical source/style race before DNS cutover; map sources now wait for Mapbox `isStyleLoaded()`.
- Production still returns Vercel HTTP 402. The registrar is Squarespace Domains, DNSSEC is enabled, and authenticated DNS/Cloudflare-zone UI work remains.

### Assumptions requiring owner validation

- The Cloudflare account remains Free with no paid add-on or automatic overage.
- Registrar access can be located and the provider-supported DS/DNSSEC migration sequence can be followed.
- The custom domain passes real production maps, static tail isolation, feedback degradation, and Mapbox hostname restrictions after DNS cutover.
- Cloudflare account/zone dashboard evidence confirms Free-only operation and imported DNS records.

### Decision

- Accepted: bounded payload/startup optimization, enforced budgets, static-only monitoring, dynamic-route inventory, and exact launch/rollback preparation.
- Deferred pending owner: Squarespace DNSSEC/nameserver and Cloudflare-zone/custom-domain cutover, bot controls, alternate Worker-hostname retirement, production smoke, and 24-hour/seven-day quota/error reviews. The owner explicitly rejected Vercel as a fallback; Cloudflare version rollback is retained.
- Rejected: geometry simplification without topology/visual acceptance evidence; paid monitoring or automatic overage; implementing an M5 hypothesis.

### Post-launch review placeholder

Do not mark M4 complete from preparation evidence. At launch, 24 hours, and seven days, append actual availability, errors, Worker/DO usage, cache behavior, Mapbox usage, feedback failures, rollback outcome, and Vercel retirement decision according to `docs/M4_LAUNCH_RUNBOOK.md`.
