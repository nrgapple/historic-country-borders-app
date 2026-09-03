# Relay Log: M3 Static-First Cloudflare Migration

## Setup — leg 0

Created the queued M3 packet. It explicitly separates account-independent static migration from Cloudflare account steps, which require owner intervention.

## 2026-09-02 — Leg 1: local static migration; owner intervention

- Confirmed M2 `COMPLETE`, then completed all account-independent M3 work.
- Added a pinned historical refresh/validation pipeline and 53 content-hashed payloads (55,615,413 bytes), preserving `{data, places}` while fixing long-BC availability and recording source/output hashes, GPL-3.0 attribution/provenance, uncertainty, and five retained upstream zero-area anomalies.
- Converted Next to static export; added useful 404, static headers/routes/redirect policy, sitemap/static validation, portable local preview, Wrangler config, and Cloudflare deployment/quota/rollback instructions.
- Removed all Next API routes and obsolete Node feedback/Airtable/rate-limit code. Historical maps now use immutable static assets; Wikipedia uses direct browser CORS; exactly `/api/feedback` maps to one bounded Worker-native Function with a Cloudflare rate-limit binding.
- Updated runtime, feedback, historical-data, README, architecture decision, backlog, review, and scorecard documentation. Removed an unused duplicate feedback implementation and unused dependencies.
- Validation: `yarn validate` passed (187 unit/integration tests, 53 historical + 500 school records validated, 57 static pages/198 files, Wrangler Function compile, size budgets, 15 browser runs). `wrangler pages dev out` additionally returned 200 for BC/school/data, 404 for unknown year, safe 503 for unconfigured feedback, and reported only the exact local rate binding with valid headers/no redirect warnings.
- State set to `BLOCKED — OWNER INPUT REQUIRED`. Owner must follow `docs/CLOUDFLARE_DEPLOYMENT.md`, provide only non-secret preview/quota/bot/rollback evidence, then resume as leg 2. No M4 session spawned.

## 2026-09-03 — Leg 2: Cloudflare preview verified; M3 complete

- Owner authenticated Cloudflare and Vercel CLI. Created the preview deployment and transferred only required Airtable values directly from Vercel to Cloudflare secret storage without printing or committing values.
- Cloudflare Pages rejected `ratelimits`; adapted within the charter to Workers Static Assets with exact `run_worker_first = ["/api/feedback"]`. Deleted the empty experimental Pages project.
- Production tests found the native Rate Limiting binding too permissive to enforce the required threshold. Replaced it with a strict per-client SQLite Durable Object on Workers Free; deterministic and live tests proved attempt 21 returns 429. Restored real Airtable secrets and verified feedback 200 afterward.
- Verified preview `https://historic-borders.champtoday.workers.dev`, final version `c3144834-a22a-4b6c-8269-22147af6f9aa`: ordinary pages/data/404 are direct static assets; a live tail captured only feedback and its internal Durable Object. Live Chromium rendered AD, BC, and school Mapbox journeys with 198, 85, and 500 features.
- Removed obsolete Gemini, Redis, public GitHub-token, and public Discord-webhook variables from Vercel. They are not used by Cloudflare; owner provider rotation is recorded as a pre-launch M4 follow-up.
- Updated deployment/runtime/feedback/product docs and validation for Workers Static Assets. `yarn validate` passed: 188 tests, 197-file static export, Wrangler DO dry-run, budgets, and 15 browser runs.
- Set M3 status `COMPLETE`; handing off exactly once to `m4-optimize-launch` leg 1.
