# Relay Status: M3 Static-First Cloudflare Migration

- State: BLOCKED — OWNER INPUT REQUIRED
- Current position: All account-independent M3 implementation and local validation are complete on `upgrade/cloudflare-harness`; Cloudflare preview/account verification remains.
- Last completed leg: 1 (local static migration)
- Next leg to run: 2, only after the owner completes the non-secret preview setup below
- Next task: Verify the Cloudflare preview, static-hit/Function quota isolation, Free-plan status, bot controls, and rollback evidence. If green, complete M3 and hand off once to M4.

## Durable completion evidence

- 53 pinned historical payloads are validated and published as content-hashed static assets (55,615,413 bytes total), with source/output hashes, GPL-3.0 attribution, provenance, uncertainty, and five retained zero-area anomalies documented.
- `output: 'export'` produces 57 pages and 198 deployable files; all year routes including long BC years, school districts, sitemap/robots, and a useful 404 are static.
- All Next API routes are removed. Wikipedia is direct browser CORS. `_routes.json` permits only `/api/feedback`; the bounded Worker-native Function uses a Cloudflare rate-limit binding and safe failures.
- `yarn validate` passes: 187 unit/integration tests, offline data validation, static export checks, Wrangler Function compilation, size budgets, and 15 cross-browser journeys.
- Local `wrangler pages dev out` verified BC/school/data HTTP 200, unknown-year HTTP 404, feedback HTTP 503 without secrets, exact local rate binding, five valid header rules, and no redirect warnings.

## Owner action (account access; never share credentials)

Follow **Owner-only preview setup** and **Preview acceptance and quota evidence** in `docs/CLOUDFLARE_DEPLOYMENT.md`:

1. Confirm a Cloudflare Free account/project with no paid subscription or add-on.
2. Create/deploy the `historic-borders` Pages preview using Node 22, `yarn install --frozen-lockfile && yarn build`, and output `out`; never run data refresh in deployment.
3. Configure public build variables and at least one feedback destination as Cloudflare secrets; confirm `FEEDBACK_RATE_LIMITER` is bound.
4. Record the non-secret preview URL/timestamp and verify ordinary pages/data do not increase Function invocations, while only `/api/feedback` does.
5. Record AI Crawl Control/Bot Fight Mode decisions, daily quota/free-plan evidence, and rollback availability. Do not change DNS.
6. Resume Relay `m3-static-cloudflare` as leg 2 with that non-secret evidence.

## Relevant context

- Deployment/account checklist: `docs/CLOUDFLARE_DEPLOYMENT.md`
- Runtime boundary: `docs/RUNTIME_SURFACE.md`
- Historical provenance: `docs/HISTORICAL_DATA.md`
- M3 review/evidence: `docs/product/REVIEW.md`, `docs/product/SCORECARD.md`

## Blocker / intervention

Cloudflare account, secret, dashboard, and preview deployment actions require the owner. Do not spawn M4 until preview and quota isolation satisfy the charter finish line.
