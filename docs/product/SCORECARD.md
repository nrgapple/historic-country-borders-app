# Product and Reliability Scorecard

Status: M2 complete

| Signal                          | Baseline                                       | Desired direction             | Evidence                                                                                  |
| ------------------------------- | ---------------------------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------- |
| Production availability         | Failing: HTTP 402                              | Available                     | Vercel returns `DEPLOYMENT_DISABLED`                                                      |
| Type-check                      | Passing on Node 22.23.2                        | Pass                          | `yarn type-check`                                                                         |
| Unit/integration tests          | Passing: 196 tests                             | Pass                          | `yarn test`; mixed-geometry pipeline and school UI-state coverage                         |
| Production build                | Passing without live map-source calls          | Pass as a fully static export | Pinned historical manifest and school artifact; three temporary bounded API routes remain |
| Frozen install                  | Passing                                        | Pass                          | Lockfile synchronized; `yarn install --frozen-lockfile`                                   |
| E2E critical journeys           | Passing: 9 deterministic cross-browser runs    | Remain green                  | Three journeys in Chromium, Firefox, and WebKit; school cold/reload behavior included     |
| School map load                 | Not measurable in production                   | Establish success rate        | Production is disabled                                                                    |
| School source availability      | Pinned and validated                           | Refresh explicitly            | October 2025 PASDA source; 500 districts; 460 Polygon/40 MultiPolygon; SHA-256 recorded   |
| Runtime map compute             | Every historical data request                  | Zero for static pages/assets  | `/api/borders/...` downloads and transforms GeoJSON per request                           |
| Runtime school compute          | Zero                                           | Remain zero                   | Browser loads the 20,379,855-byte normalized static artifact; obsolete API/cache removed  |
| Removed feature/caching surface | Removed end-to-end                             | Remain absent                 | Source, dependency, and built-client searches; M1 validation                              |
| Formatting                      | Passing repository-wide                        | Pass                          | `yarn format:check`                                                                       |
| Lint                            | Passing with zero warnings                     | Pass                          | `yarn lint`                                                                               |
| Coverage regression floors      | 44.12 lines / 82.19 branches / 64.28 functions | Raise over time               | Enforced by `yarn test:coverage`; HTML/LCOV uploaded in CI                                |
| JavaScript build budget         | 2,017.7 KiB total; 1,496.2 KiB largest chunk   | Reduce                        | 5 MiB total and 1,600 KiB chunk limits enforced by `yarn size:check`                      |
| Relay execution                 | M1–M4 packets ready                            | Durable milestone handoffs    | `.pi-web/relays/*/{charter,status,log}.md`                                                |

## Baseline notes

- Initial measurements exposed a stale lockfile, one brittle test locator, and duplicated unauthenticated GitHub calls during static generation. The M0 harness fixes those baseline blockers.
- Current M2 measurements use Node 22.21.1 and Yarn 1.22.22.
- The manifest pins 53 historical years and upstream commit `62d8f1a03a71f2d3ff17f2d166f7553f256bce68`; deployment builds no longer query GitHub for routes or sitemap data.
- Next.js 15.5.25 is pinned to avoid the high-severity advisories affecting 15.3.8. The regular Next build passes, but it is not yet a Cloudflare-ready static export because three temporary API routes remain.
- M1 removed generated country descriptions, country comparisons, their caching service, and Vercel Speed Insights. Wikipedia is the sole description source. Remaining request-time routes have method, input/size, timeout, and safe-failure controls documented in `docs/RUNTIME_SURFACE.md`.
- CI now enforces frozen install, formatting, zero-warning lint, type-check, coverage floors, sitemap drift, production build, JavaScript size budgets, deterministic browser journeys, and high-severity dependency review.
- M2 pins the October 2025 PASDA source at 21,161,924 bytes and the normalized artifact at 20,379,855 bytes. Offline validation proves 500 districts, required properties, and a 460 Polygon/40 MultiPolygon mix.
- E2E verifies deterministic data loading and a visible Mapbox canvas in all three browser engines, but real Mapbox authentication/rendering remains a separate smoke-test concern.
- Historical static output sizes, broader accessibility, and production performance remain to be measured.

## Review cadence

Update this scorecard at each milestone and after production launch. Link reports or commits rather than replacing failed values without evidence.
