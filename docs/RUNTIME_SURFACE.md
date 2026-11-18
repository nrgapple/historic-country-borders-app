# Runtime and crawler surface

Status: M4 account-independent controls prepared; production cutover pending owner access.

## Static requests

The Astro app is fully prerendered (`dist/`). HTML for `/`, all 53 enumerated `/year/<year>` routes, `/pa/school-districts`, and the useful 404 is generated at build time. Historical content-hashed payloads and the PA district tiles are immutable/local build inputs. Build and ordinary traffic make no GitHub or PASDA requests.

Workers Static Assets uses asset-first delivery. `wrangler.toml` sets `run_worker_first = ["/api/feedback"]`, `not_found_handling = "404-page"`, and `serve_directly` is confirmed in the deployed version. Thus page HTML, scripts, map data, sitemap, robots, and unknown routes do not execute Worker code. The enforced inventory is one public dynamic route, one internal Durable Object binding, and zero Pages Functions; `yarn dist:validate` (`scripts/validate-dist.js`) fails if the Worker-first route broadens.

## Approved dynamic operation

| Route                | Boundary and failure behavior                                                                                                                                                                                                                                                                                                                                                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/feedback` | Exact Worker-first path; POST and JSON only; same-origin when `Origin` is present; 8 KiB actual/declared body maximum; bounded field schema; strict SQLite Durable Object limit of 20 attempts/minute/client; five-second destination timeouts; secrets remain in Worker bindings; succeeds if any configured destination stores; safe 429/503 failures with `no-store` and diagnostic `X-HistoricBorders-Compute: feedback`. |

The Durable Object exists only behind the feedback Worker path. Free-plan allocation exhaustion fails the optional feedback operation without affecting static browsing. Local static preview intentionally returns 503 because it has no secret-bearing Worker.

Wikipedia is not an application runtime route. The browser performs one bounded GET to Wikipedia's CORS-enabled MediaWiki API. Deterministic tests cover query, success, empty, and unavailable states; a live M3 check observed `Access-Control-Allow-Origin: *`. Wikipedia failure only removes optional source-backed summary text.

## Preview proof

On 2026-09-03, <https://historic-borders.champtoday.workers.dev> returned static 200 responses for ordinary pages/data and static 404 for an unknown year. Live `wrangler tail` captured only feedback and its internal rate-limiter call while root, BC year, both data classes, and 404 were requested. The twenty-first bounded feedback attempt returned 429; configured Airtable feedback subsequently returned 200.

## Removed runtime operations

- `/api/borders/*`: replaced by validated content-hashed static assets.
- `/api/wikipedia`: replaced by direct browser CORS access.
- all Next API routes and Pages Functions: removed.
- PA school proxy: removed in M2.

## Crawler policy

`public/robots.txt` allows ordinary search engines to load public pages/assets, disallows API crawling, and denies named AI/model-training crawlers. Directives are advisory. Cloudflare AI Crawl Control and Bot Fight Mode require the custom domain/zone and remain an M4 cutover task; they must not break maps, Wikipedia, feedback, or legitimate search crawlers.
