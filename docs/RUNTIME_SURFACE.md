# Runtime and crawler surface

Status: M3 local migration complete; Cloudflare preview verification pending owner access.

## Static requests

The Next.js app uses `output: 'export'`. HTML for `/`, all 53 enumerated `/year/<year>` routes, `/pa/school-districts`, and the useful 404 is generated at build time. Historical content-hashed payloads and the PA school payload are immutable/local build inputs. Build and ordinary traffic make no GitHub or PASDA requests.

`public/_routes.json` is the authoritative Cloudflare Functions boundary:

```json
{ "version": 1, "include": ["/api/feedback"], "exclude": [] }
```

Thus page HTML, Next assets, map data, sitemap, robots, and unknown routes cannot invoke a Function. `yarn static:validate` fails if another function or route appears.

## Approved dynamic operation

| Route                | Boundary and failure behavior                                                                                                                                                                                                                                                                                                                                                                                                                      |
| -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/feedback` | Exactly routed Pages Function; POST and JSON only; same-origin when `Origin` is present; 8 KiB actual/declared body maximum; bounded field schema; Cloudflare `FEEDBACK_RATE_LIMITER` limit of 20 attempts/minute/location/client; five-second destination timeouts; secrets remain in Worker bindings; succeeds if any configured destination stores; safe 429/503 failures with `no-store` and diagnostic `X-HistoricBorders-Compute: feedback`. |

The local static preview intentionally returns 503 for feedback because it has no secret-bearing Worker. The map remains usable.

Wikipedia is not an application runtime route. The browser performs one bounded GET to Wikipedia's CORS-enabled MediaWiki API. Deterministic tests cover the query, success, empty, and unavailable states; a live M3 check observed `Access-Control-Allow-Origin: *`. Wikipedia failure only removes optional source-backed summary text.

## Removed runtime operations

- `/api/borders/*`: replaced by validated content-hashed static assets.
- `/api/wikipedia`: replaced by direct browser CORS access.
- all Next API routes: removed from the static app.
- PA school proxy: removed in M2.

## Crawler policy

`public/robots.txt` allows ordinary search engines to load public pages/assets, disallows API crawling, and denies named AI/model-training crawlers. Directives are advisory. Cloudflare AI Crawl Control and any Bot Fight Mode decision require owner dashboard access and must follow `docs/CLOUDFLARE_DEPLOYMENT.md` without breaking maps, Wikipedia, feedback, or legitimate search crawlers.
