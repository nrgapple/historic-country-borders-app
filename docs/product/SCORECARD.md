# Product and Reliability Scorecard

Status: M0 baseline

| Signal                     | Baseline                                       | Desired direction                   | Evidence                                                                                        |
| -------------------------- | ---------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| Production availability    | Failing: HTTP 402                              | Available                           | Vercel returns `DEPLOYMENT_DISABLED`                                                            |
| Type-check                 | Passing on Node 22.21.1                        | Pass                                | `yarn type-check`                                                                               |
| Unit/integration tests     | Passing: 311 tests                             | Pass                                | `yarn test`                                                                                     |
| Production build           | Passing without live GitHub calls              | Pass as a fully static export       | Pinned `data/historical-manifest.json`; seven API routes remain dynamic                         |
| Frozen install             | Passing                                        | Pass                                | Lockfile synchronized; `yarn install --frozen-lockfile`                                         |
| E2E critical journeys      | Passing: 3 deterministic Chromium journeys     | Expand school behavior and browsers | Non-empty fixtures, blocked external traffic, ready state, feature count, and canvas assertions |
| School map load            | Not measurable in production                   | Establish success rate              | Production is disabled                                                                          |
| School source availability | Available                                      | Monitored                           | PASDA source returned HTTP 200; 21,161,924 bytes                                                |
| Runtime map compute        | Every historical data request                  | Zero for static pages/assets        | `/api/borders/...` downloads and transforms GeoJSON per request                                 |
| Runtime school compute     | 21 MB proxy request per cold client            | Zero for asset delivery             | `/api/pa-school-districts` streams PASDA through the app                                        |
| AI/Redis surface           | Present                                        | Removed                             | Owner-approved M1 Relay                                                                         |
| Formatting                 | Passing repository-wide                        | Pass                                | `yarn format:check`                                                                             |
| Lint                       | Passing with zero warnings                     | Pass                                | `yarn lint`                                                                                     |
| Coverage regression floors | 46.01 lines / 79.46 branches / 64.74 functions | Raise over time                     | Enforced by `yarn test:coverage`; HTML/LCOV uploaded in CI                                      |
| JavaScript build budget    | 2,050.7 KiB total; 1,501.1 KiB largest chunk   | Reduce                              | 5 MiB total and 1,600 KiB chunk limits enforced by `yarn size:check`                            |
| Relay execution            | M1–M4 packets ready                            | Durable milestone handoffs          | `.pi-web/relays/*/{charter,status,log}.md`                                                      |

## Baseline notes

- Initial measurements exposed a stale lockfile, one brittle test locator, and duplicated unauthenticated GitHub calls during static generation. The M0 harness fixes those baseline blockers.
- Current measurements use the repository-pinned Node 22.21.1 and Yarn 1.22.22.
- The manifest pins 53 historical years and upstream commit `62d8f1a03a71f2d3ff17f2d166f7553f256bce68`; deployment builds no longer query GitHub for routes or sitemap data.
- The regular Next build passes, but it is not yet a Cloudflare-ready static export because seven API routes remain.
- CI now enforces frozen install, formatting, zero-warning lint, type-check, coverage floors, sitemap drift, production build, JavaScript size budgets, deterministic browser journeys, and high-severity dependency review.
- E2E verifies deterministic data loading and a visible Mapbox canvas, but real Mapbox authentication/rendering remains a separate smoke-test concern.
- Static output sizes, district counts, geometry mix, accessibility, and production performance remain to be measured.

## Review cadence

Update this scorecard at each milestone and after production launch. Link reports or commits rather than replacing failed values without evidence.
