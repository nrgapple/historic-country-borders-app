# Product and Reliability Scorecard

Status: M3 local/static work complete; Cloudflare preview verification pending owner access

| Signal                          | Baseline                                       | Desired direction          | Evidence                                                                                 |
| ------------------------------- | ---------------------------------------------- | -------------------------- | ---------------------------------------------------------------------------------------- |
| Production availability         | Failing: HTTP 402                              | Available                  | Vercel returns `DEPLOYMENT_DISABLED`                                                     |
| Type-check                      | Passing on Node 22.23.2                        | Pass                       | `yarn type-check`                                                                        |
| Unit/integration tests          | Passing: 187 tests                             | Pass                       | Historical processing/static URL, direct Wikipedia, feedback Worker, and school coverage |
| Production build                | Passing as static export                       | Remain deterministic       | 57 generated pages; build uses only committed local map inputs; no Next API routes       |
| Frozen install                  | Passing                                        | Pass                       | Lockfile synchronized; `yarn install --frozen-lockfile`                                  |
| E2E critical journeys           | Passing: 15 cross-browser runs                 | Remain green               | Static deep links, BC year, 404, both maps, and feedback failure across three engines    |
| School map load                 | Not measurable in production                   | Establish success rate     | Production is disabled                                                                   |
| School source availability      | Pinned and validated                           | Refresh explicitly         | October 2025 PASDA source; 500 districts; 460 Polygon/40 MultiPolygon; SHA-256 recorded  |
| Runtime map compute             | Zero in local/static output                    | Verify zero in CF preview  | 53 content-hashed payloads totaling 55,615,413 bytes; `/api/borders` removed             |
| Runtime school compute          | Zero                                           | Remain zero                | Browser loads the 20,379,855-byte normalized static artifact                             |
| Removed feature/caching surface | Removed end-to-end                             | Remain absent              | Source, dependency, and built-client searches; M1 validation                             |
| Formatting                      | Passing repository-wide                        | Pass                       | `yarn format:check`                                                                      |
| Lint                            | Passing with zero warnings                     | Pass                       | `yarn lint`                                                                              |
| Coverage regression floors      | 44.12 lines / 82.19 branches / 64.28 functions | Raise over time            | Enforced by `yarn test:coverage`; HTML/LCOV uploaded in CI                               |
| JavaScript build budget         | 2,017.7 KiB total; 1,496.2 KiB largest chunk   | Reduce                     | 5 MiB total and 1,600 KiB chunk limits enforced by `yarn size:check`                     |
| Cloudflare dynamic isolation    | Local configuration passes                     | Verify in CF preview       | `_routes.json` includes only `/api/feedback`; Wrangler Function build passes             |
| Relay execution                 | M3 owner-access intervention pending           | Durable milestone handoffs | `.pi-web/relays/*/{charter,status,log}.md`                                               |

## Baseline notes

- Initial measurements exposed a stale lockfile, one brittle test locator, and duplicated unauthenticated GitHub calls during static generation. The M0 harness fixes those baseline blockers.
- Current M2 measurements use Node 22.21.1 and Yarn 1.22.22.
- The manifest pins 53 historical years and upstream commit `62d8f1a03a71f2d3ff17f2d166f7553f256bce68`. The explicit refresh validates and preprocesses GitHub inputs; deployment builds make no GitHub or PASDA requests.
- Next.js 15.5.25 produces a Cloudflare-ready `out/` export with all year routes and a static 404. Local validation observed 198 output files, all below 25 MiB.
- M1 removed generated country descriptions, country comparisons, their caching service, and Vercel Speed Insights. Wikipedia is now fetched directly from its CORS API. Feedback is the only exactly routed Function and fails safely.
- CI now enforces frozen install, formatting, zero-warning lint, type-check, coverage floors, sitemap drift, production build, JavaScript size budgets, deterministic browser journeys, and high-severity dependency review.
- M2 pins the October 2025 PASDA source at 21,161,924 bytes and the normalized artifact at 20,379,855 bytes. Offline validation proves 500 districts, required properties, and a 460 Polygon/40 MultiPolygon mix.
- E2E verifies deterministic data loading and a visible Mapbox canvas in all three browser engines, but real Mapbox authentication/rendering remains a separate smoke-test concern.
- Cloudflare preview static-hit/Function-quota evidence, dashboard bot controls, real Mapbox rendering, broader accessibility, and production performance remain to be verified.

## Review cadence

Update this scorecard at each milestone and after production launch. Link reports or commits rather than replacing failed values without evidence.
