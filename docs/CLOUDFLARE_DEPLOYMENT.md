# Cloudflare static deployment

## Architecture and free-tier boundary

The Next.js app exports portable files to `out/`. Cloudflare Pages serves all HTML, JavaScript, crawler files, and map data as static assets. `public/_routes.json` allows Pages Functions to run for exactly `/api/feedback`; no wildcard Worker route may be added. Wikipedia is fetched directly by the browser from its CORS-enabled API.

The committed limits are:

- output: `out/` (`next.config.js` uses `output: 'export'`);
- static files: fewer than 20,000 and no file larger than 25 MiB, checked by `yarn static:validate`;
- dynamic route: only `POST /api/feedback`;
- feedback rate limit: 20 attempts per minute per Cloudflare location/client key via `FEEDBACK_RATE_LIMITER`;
- Cloudflare plan: Free only. Do not enable a paid plan, paid add-on, paid rate-limiting rule, or automatic paid usage without owner approval.

Relevant Cloudflare documentation: [static Next.js deployment](https://developers.cloudflare.com/pages/framework-guides/nextjs/deploy-a-static-nextjs-site/), [Functions routing](https://developers.cloudflare.com/pages/functions/routing/), [Workers limits](https://developers.cloudflare.com/workers/platform/limits/), and [rate-limit bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).

## Local/static validation

Use Node 22 and Yarn Classic:

```bash
nvm use
yarn install --frozen-lockfile
yarn build
yarn static:validate
yarn cloudflare:check
yarn preview -p 3000
```

Then verify `/`, `/year/1994`, `/year/-100`, `/pa/school-districts`, and `/year/9999`. The unknown year must return the useful static 404. The local preview deliberately returns a bounded 503 at `/api/feedback`; this proves the static site remains useful when dynamic feedback is unavailable. `yarn test:e2e` automates these journeys across Chromium, Firefox, and WebKit.

## Owner-only preview setup

These steps require Cloudflare account access and are intentionally not performed by an automated Relay runner. Never paste credentials into chat or commit them.

1. Create/sign in to a Cloudflare account and confirm the account is on **Free** with no paid Workers/Pages subscription or paid rate-limiting product.
2. Create a Pages project named `historic-borders` from this repository, or authenticate Wrangler and run `yarn cloudflare:deploy` after `yarn build`.
3. For Git builds, configure Node 22, build command `yarn install --frozen-lockfile && yarn build`, and output directory `out`. Deployment builds must not run any `data:refresh*` command.
4. Set build-time browser variables only as needed: `NEXT_PUBLIC_MAPBOX_TOKEN` (public URL-restricted token) and `NEXT_PUBLIC_GA_FOUR` (public measurement ID).
5. In Pages secrets, set at least one feedback destination: `DISCORD_WEBHOOK_URL`, or the pair `AIRTABLE_PERSONAL_ACCESS_TOKEN` and `AIRTABLE_BASE_ID`; `AIRTABLE_TABLE_NAME` is optional and defaults to `Feedback`. These are Worker secrets, never `NEXT_PUBLIC_*` variables.
6. Confirm Wrangler applies the `FEEDBACK_RATE_LIMITER` binding from `wrangler.toml`. If namespace `1001` conflicts in the account, choose another positive integer, commit that non-secret configuration change, and redeploy.
7. Deploy to a `*.pages.dev` preview URL. Do not add DNS/custom domains during M3 verification.

## Preview acceptance and quota evidence

Record the preview URL and timestamp without recording secrets. In Cloudflare analytics, capture the Worker/Functions invocation baseline, then:

1. load `/`, `/year/1994`, `/year/-100`, `/pa/school-districts`, a historical JSON asset, and the school JSON asset;
2. verify response headers show static/cache delivery and that Worker/Functions invocations did **not** increase;
3. request an unknown year and verify static HTTP 404 with useful links;
4. select a country and verify the browser calls `https://en.wikipedia.org/w/api.php`, not a local API;
5. submit one feedback request and verify this alone increments Functions invocations and returns a safe success/failure response;
6. verify GET `/api/feedback` returns 405, cross-origin POST returns 403, and repeated requests reach 429;
7. confirm Functions routes list only `/api/feedback` and `_routes.json` is deployed unchanged; and
8. confirm current daily Worker usage remains well below the Free-plan request allowance and no billable subscription is active.

A broad route, any page/data Worker invocation, a request to enable billing, or an inability to prove quota isolation blocks the milestone.

## Crawler and bot controls

`robots.txt` statically denies named AI/model-training crawlers while allowing ordinary search indexing. On the preview/production zone, enable AI Crawl Control for the eventual hostname. Evaluate Bot Fight Mode against all map journeys, direct Wikipedia, feedback, and ordinary search crawlers before enabling it; leave it off if it breaks required requests. Dashboard changes require owner access and must be recorded with the preview evidence.

## Custom-domain plan (M4 cutover only)

Before production cutover, locate the registrar/DNS account, add `historicborders.app` and `www.historicborders.app` to Pages, verify TLS, and create a Cloudflare Redirect Rule from `www` to the apex while preserving path/query. (`_redirects` intentionally contains no broad or host-level rewrite.) Lower DNS TTL before the approved window. Do not change DNS in M3.

## Rollback

Cloudflare Pages retains prior deployments. If preview or production validation fails, promote the last known-good deployment in Pages and verify the critical journeys. During M4 DNS cutover, restore the previous DNS records within the rollback window if Pages/TLS fails. Because all map inputs are committed and builds are static, the same Git revision can also be rebuilt and deployed to another static host. Do not delete old content-hashed map assets while an active rollback deployment references them.
