# M3 Product and Reliability Review

## Review period

- Milestone: M3 static-first Cloudflare migration
- Preview: <https://historic-borders.champtoday.workers.dev>
- Verification: 2026-09-03 UTC

## Observed evidence

- Availability: Cloudflare preview is live; production remains unchanged until M4 DNS approval.
- Critical journeys: deterministic local coverage passes root, AD/BC deep links, school map, useful static 404, and feedback failure. Live Chromium loaded 1994 (198 features), 100 BC (85 features), and school districts (500 features) with visible Mapbox canvases.
- Data sizes: 53 historical payloads total 55,615,413 bytes; school payload is 20,379,855 bytes; static export has 197 files and no file exceeds 25 MiB.
- Data sources: historical commit `62d8f1a03a71f2d3ff17f2d166f7553f256bce68`; school source remains October 2025 PASDA.
- Free-tier boundary: deployed metadata sets `serve_directly: true` and executes Worker code only for `/api/feedback`. A live tail saw only feedback plus its Durable Object while ordinary pages/data/404 produced no Worker event.
- Feedback: configured Airtable storage returned 200; method/origin failures were bounded; the strict rate test returned 429 on attempt 21 and recovered after the window.
- Rollback: Cloudflare retains versioned deployments; version ID and procedure are documented.

## Assumptions requiring validation in M4

- Custom-domain attachment, TLS, and DNS rollback work in the approved cutover window.
- AI Crawl Control/Bot Fight Mode can be configured on the domain without blocking required journeys.
- Production usage remains within Workers and Durable Objects Free allocations.

## User problems and decisions

1. Ordinary historical exploration no longer depends on request-time GitHub processing: accepted committed, content-hashed, validated assets.
2. Static browsing must not consume compute quota: accepted Workers Static Assets with one exact Worker-first feedback path.
3. Feedback needs deterministic abuse bounds: replaced the permissive native binding with a strict SQLite Durable Object after production verification failed to observe enforcement.

## Decision

- Accepted: M3 preview and quota-isolation gate is complete.
- Deferred to M4: optimization, production custom domain/DNS, bot dashboard controls, uptime monitor, and post-launch review.
- Rejected: Pages Functions configuration and broad Worker/static interception.

## Backlog and scorecard updates

`docs/product/BACKLOG.md`, `docs/product/DECISIONS.md`, and `docs/product/SCORECARD.md` record M3 completion and M4 follow-up.
