# Relay Status: M3 Static-First Cloudflare Migration

- State: COMPLETE — M3 exit gate passed; M4 handoff ready
- Current position: M3 is implemented, validated, deployed, and quota-isolation verified on `upgrade/cloudflare-harness`.
- Last completed leg: 2 (Cloudflare preview and account verification)
- Next leg to run: none in this Relay
- Next task: Start `m4-optimize-launch` leg 1 according to its charter.

## Completion evidence

- Preview: <https://historic-borders.champtoday.workers.dev>; verified final version `c3144834-a22a-4b6c-8269-22147af6f9aa`.
- 53 pinned historical payloads are validated content-hashed static assets (55,615,413 bytes), with source/output hashes, GPL-3.0 attribution, provenance, uncertainty, and five retained zero-area anomalies documented.
- Workers Static Assets directly serves 57 generated pages and 197 deployable files. All year routes including long BC years, school districts, crawler files, map data, and useful 404 are static.
- `run_worker_first = ["/api/feedback"]` is the only compute route. Live tail showed only feedback plus its internal Durable Object; ordinary page/data/404 requests emitted no Worker event.
- Feedback uses a strict per-client SQLite Durable Object (20 attempts/minute), bounded input/destinations, no-store responses, and Airtable secrets transferred without printing/committing them. Attempt 21 returned 429; configured feedback returned 200.
- Live Chromium rendered authenticated Mapbox canvases for 1994 (198 features), 100 BC (85), and school districts (500). Static route/status/header checks passed.
- `yarn validate` passes: 188 unit/integration tests, offline data validation, static export and Wrangler dry-run, size budgets, and 15 cross-browser journeys.
- Deployment, quota checks, Free-only boundaries, secrets, custom-domain plan, crawler controls, and rollback are documented in `docs/CLOUDFLARE_DEPLOYMENT.md`.

## Relevant context for M4

- Keep Workers Static Assets asset-first and `/api/feedback` as the only Worker-first path.
- Production DNS/custom domain, AI Crawl Control/Bot Fight Mode evaluation, optimization, uptime monitoring, and launch review belong to M4.
- The empty experimental Pages project was deleted; `historic-borders` Worker is authoritative.
- Obsolete Gemini, Redis, public GitHub-token, and public Discord-webhook variables were removed from Vercel. Provider removal does not revoke credentials: before production launch, the owner should revoke/rotate the historically public GitHub token and Discord webhook; neither is used by Cloudflare.

## Blockers / intervention

None for M3. M4 must follow its own account/DNS/paid-risk intervention rules.
