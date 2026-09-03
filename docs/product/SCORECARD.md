# Product and Reliability Scorecard

Status: M4 account-independent optimization and launch preparation complete; owner cutover required

| Signal                          | Baseline                                       | Desired direction         | Evidence                                                                                 |
| ------------------------------- | ---------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------- |
| Production availability         | Failing: HTTP 402                              | Available                 | Vercel returns `DEPLOYMENT_DISABLED`                                                     |
| Type-check                      | Passing on Node 22.23.2                        | Pass                      | `yarn type-check`                                                                        |
| Unit/integration tests          | Passing: 192 tests                             | Pass                      | Historical/static data, deferred fingerprinting, production smoke, feedback, and school  |
| Production build                | Passing as static export                       | Remain deterministic      | 57 generated pages; build uses only committed local map inputs; no Next API routes       |
| Frozen install                  | Passing                                        | Pass                      | Lockfile synchronized; `yarn install --frozen-lockfile`                                  |
| E2E critical journeys           | Passing: 15 cross-browser runs                 | Remain green              | Static deep links, BC year, 404, both maps, and feedback failure across three engines    |
| School map load                 | Preview ready with 500 features/canvas         | Establish production rate | Live Chromium preview smoke test                                                         |
| School source availability      | Pinned and validated                           | Refresh explicitly        | October 2025 PASDA source; 500 districts; 460 Polygon/40 MultiPolygon; SHA-256 recorded  |
| Runtime map compute             | Zero in Cloudflare preview                     | Remain zero               | Direct assets plus live tail; 53 payloads total 55,615,413 bytes                         |
| Runtime school compute          | Zero                                           | Remain zero               | Browser loads the 12,023,844-byte normalized static artifact                             |
| Removed feature/caching surface | Removed end-to-end                             | Remain absent             | Source, dependency, and built-client searches; M1 validation                             |
| Formatting                      | Passing repository-wide                        | Pass                      | `yarn format:check`                                                                      |
| Lint                            | Passing with zero warnings                     | Pass                      | `yarn lint`                                                                              |
| Coverage regression floors      | 44.12 lines / 82.19 branches / 64.28 functions | Raise over time           | Enforced by `yarn test:coverage`; HTML/LCOV uploaded in CI                               |
| JavaScript build budget         | 2,044.6 KiB total; 1,496.2 KiB largest chunk   | Stay within tightened cap | 2,100 KiB total, 1,550 KiB chunk, and 400 KiB initial-route limits enforced              |
| Cloudflare dynamic isolation    | Preview verified                               | Remain exact/bounded      | 1 public dynamic route, 1 internal DO, 0 Next APIs/Pages Functions; live-tail proof      |
| Production uptime monitor       | Prepared; production still HTTP 402            | Pass after cutover        | Static-only scheduled workflow plus `yarn smoke:production`; intended Worker requests: 0 |
| Relay execution                 | M4 owner intervention                          | Complete launch reviews   | `.pi-web/relays/*/{charter,status,log}.md`                                               |

## Baseline notes

- Initial measurements exposed a stale lockfile, one brittle test locator, and duplicated unauthenticated GitHub calls during static generation. The M0 harness fixes those baseline blockers.
- Current M2 measurements use Node 22.21.1 and Yarn 1.22.22.
- The manifest pins 53 historical years and upstream commit `62d8f1a03a71f2d3ff17f2d166f7553f256bce68`. The explicit refresh validates and preprocesses GitHub inputs; deployment builds make no GitHub or PASDA requests.
- Next.js 15.5.25 produces a Cloudflare-ready `out/` export with all year routes and a static 404. M4 local validation observed 198 output files, all below 25 MiB.
- M1 removed generated country descriptions, country comparisons, their caching service, and Vercel Speed Insights. Wikipedia is now fetched directly from its CORS API. Feedback is the only exact Worker path, uses a strict Durable Object rate limit, and fails safely.
- CI now enforces frozen install, formatting, zero-warning lint, type-check, coverage floors, sitemap drift, production build, JavaScript size budgets, deterministic browser journeys, and high-severity dependency review.
- M2 pins the October 2025 PASDA source at 21,161,924 bytes. M4 preserves its hash, 500 districts, properties, and 460 Polygon/40 MultiPolygon mix while six-decimal coordinate publication reduces the normalized artifact from 20,379,855 to 12,023,844 bytes (41%).
- E2E verifies deterministic data loading and a visible canvas in all three engines. Live preview Chromium also rendered authenticated Mapbox canvases for AD, BC, and school maps.
- Cloudflare preview static-hit/Worker isolation, strict rate limiting, real Mapbox rendering, secrets, and rollback metadata are verified. M4 baseline/final local evidence and budgets are in `docs/M4_PERFORMANCE_REPORT.md`; exact cutover/rollback and review steps are in `docs/M4_LAUNCH_RUNBOOK.md`.

## Review cadence

Update this scorecard at each milestone and after production launch. Link reports or commits rather than replacing failed values without evidence.
