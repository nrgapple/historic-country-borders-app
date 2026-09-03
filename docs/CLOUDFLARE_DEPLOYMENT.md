# Cloudflare static deployment

## Architecture and free-tier boundary

The Next.js app exports portable files to `out/`. Cloudflare **Workers Static Assets** serves all HTML, JavaScript, crawler files, and map data directly from the asset layer. Static asset requests are free and unlimited and do not invoke Worker code.

`wrangler.toml` is the authoritative routing boundary:

```toml
[assets]
directory = "./out"
run_worker_first = ["/api/feedback"]
not_found_handling = "404-page"
```

Only exact path `/api/feedback` runs `worker/index.ts`. `run_worker_first = true`, wildcard API routing, and broad rewrites are prohibited. Unknown paths use static `404.html`. Wikipedia is fetched directly by the browser from its CORS-enabled API.

The committed limits are:

- Cloudflare account and Workers plan: **Free only**;
- static files: fewer than 20,000 and no file larger than 25 MiB;
- dynamic route: only `POST /api/feedback`;
- feedback rate limit: a strict 20 attempts/minute/client enforced by a per-client SQLite-backed Durable Object;
- feedback destinations: bounded at five seconds and successful if at least one stores; and
- no paid plan, paid add-on, or automatic paid usage without owner approval.

Workers Free includes bounded Durable Object allocations; exceeding a Free allocation fails rather than authorizing paid usage. The native Workers Rate Limiting binding was rejected for this deployment because production burst checks did not enforce its configured threshold. The Durable Object implementation provides the deterministic bound required by the product.

Relevant Cloudflare documentation: [static assets](https://developers.cloudflare.com/workers/static-assets/), [selective Worker-first routing](https://developers.cloudflare.com/workers/static-assets/routing/worker-script/), [asset billing and limits](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), and [Durable Objects pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/).

## Local validation

Use Node 22 and Yarn Classic:

```bash
nvm use
yarn install --frozen-lockfile
yarn build
yarn static:validate
yarn cloudflare:check
yarn preview -p 3000
```

Verify `/`, `/year/1994`, `/year/-100`, `/pa/school-districts`, and `/year/9999`. The unknown year must return the useful static 404. Local static preview deliberately returns a bounded 503 at `/api/feedback`; this proves the site remains useful when dynamic feedback is unavailable. `yarn test:e2e` automates these journeys across Chromium, Firefox, and WebKit.

`yarn cloudflare:check` performs a complete Wrangler dry-run, including the Worker, static assets, exact route, Durable Object binding, and migration.

## Deployment

Account authentication and secret changes require the owner; never paste credentials into chat or commit them.

1. Confirm the Cloudflare account is on Free with no paid Workers subscription or add-on.
2. Build with Node 22 and the public `NEXT_PUBLIC_MAPBOX_TOKEN` and optional `NEXT_PUBLIC_GA_FOUR`. Never run a `data:refresh*` command during deployment.
3. Run `yarn build`, `yarn static:validate`, `yarn cloudflare:check`, then `yarn cloudflare:deploy`.
4. Configure at least one destination using `wrangler secret put`: `DISCORD_WEBHOOK_URL`, or `AIRTABLE_PERSONAL_ACCESS_TOKEN` plus `AIRTABLE_BASE_ID`; `AIRTABLE_TABLE_NAME` defaults to `Feedback`.
5. Do not transfer obsolete Gemini, Redis, GitHub, or public webhook credentials.

M3 removed `GEMINI_API_KEY`, `REDIS_URL`, `NEXT_PUBLIC_GITHUB_API`, and `NEXT_PUBLIC_DISCORD_WEBHOOK_URL` from the linked Vercel project. Removal does not revoke credentials. Because the latter two were historically configured as public browser variables, the owner must revoke/rotate the old GitHub token and Discord webhook at their providers; neither is used by the Cloudflare deployment.

The verified deployment is:

- URL: <https://historic-borders.champtoday.workers.dev>
- Worker: `historic-borders`
- Current optimized candidate: `6e87c859-f70d-458f-aec4-6f51c41bc4de`
- Verified M3 rollback version: `c3144834-a22a-4b6c-8269-22147af6f9aa`
- Verification date: 2026-09-03 UTC

A temporary empty Pages project created during provider testing was deleted; Workers Static Assets is the sole deployment architecture.

## Preview and quota acceptance

For each candidate deployment:

1. record the version ID, URL, timestamp, and Free-plan status without recording secrets;
2. load `/`, AD and BC years, `/pa/school-districts`, historical/school JSON, robots, sitemap, and an unknown route;
3. verify static/cache responses contain no `X-HistoricBorders-Compute` header;
4. verify unknown routes return static HTTP 404;
5. verify country selection calls `https://en.wikipedia.org/w/api.php`, not a local API;
6. verify GET feedback returns 405, cross-origin feedback returns 403, and valid configured feedback succeeds or fails safely;
7. verify the twenty-first valid attempt in one minute returns 429;
8. run `wrangler tail` while requesting ordinary pages/data and feedback—the tail must show only `/api/feedback` and its internal Durable Object call; and
9. confirm account request/CPU/DO use remains within Free limits and no billable subscription is active.

M3 evidence on 2026-09-03:

- root, `/year/1994`, `/year/-100`, school page/data, historical data, robots, and sitemap returned 200;
- `/year/9999` returned the useful static 404;
- feedback GET returned 405 and cross-origin POST returned 403;
- configured Airtable feedback returned 200 with `X-HistoricBorders-Compute: feedback` and `Cache-Control: no-store`;
- a fake destination test produced safe failures for the first 20 accepted attempts and 429 on attempt 21; real secrets were restored and a subsequent submission returned 200;
- a live tail captured only `/api/feedback` plus `FeedbackRateLimiter`, while five ordinary page/data/404 requests produced no Worker event; and
- deployed version metadata confirmed `serve_directly: true`, static routing only for `/api/feedback`, `404-page`, all static header rules, three secret bindings, and one SQLite Durable Object binding.

## Crawler and bot controls

`robots.txt` statically denies named AI/model-training crawlers while allowing ordinary search indexing. AI Crawl Control and Bot Fight Mode require a Cloudflare-managed custom domain/zone, so configure and evaluate them during the M4 domain cutover. Leave Bot Fight Mode off if it breaks maps, direct Wikipedia, feedback, or legitimate search crawlers.

## Custom-domain plan (M4 only)

The authoritative account/DNS/DNSSEC procedure, go/no-go checks, exact validation commands, rollback thresholds, Free-plan checks, and post-launch review are in `docs/M4_LAUNCH_RUNBOOK.md`. DNS access remains owner-only. The current Vercel apex returns 402 and is not a viable DNS rollback target unless the owner first re-enables and smoke-tests it. `_redirects` intentionally contains no broad or host-level rewrite.

## Rollback

Cloudflare retains Worker versions. Record the previous known-good version ID before each deploy. If validation fails, use Workers & Pages → `historic-borders` → Deployments to roll back traffic to the previous version, then repeat static and feedback smoke checks. Secret changes are separate from code versions and must be restored independently if changed.

During M4, prefer a Cloudflare Worker-version rollback while leaving the custom domain in place. A delegation rollback must follow the saved DNSSEC/DS sequence and may remain cached for the former 21,600-second NS TTL; follow `docs/M4_LAUNCH_RUNBOOK.md`. The committed static output remains portable to another static host. Do not delete content-hashed map assets while an active rollback version references them.
