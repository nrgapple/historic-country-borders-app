# M4 performance report

Measurement date: 2026-09-03 UTC

## Method and limits

Observed facts are separated from assumptions below. Production baseline measurements used headless Chromium against the verified M3 Worker preview, three cold browser contexts per journey, real Cloudflare delivery, and real Mapbox. Deterministic before/after measurements used `yarn performance:measure` against the local static server with an empty intercepted Mapbox style; they isolate application/data work but are not production Web Vitals or low-end-device results.

Repeat deterministic measurements with:

```bash
NEXT_PUBLIC_MAPBOX_TOKEN=test-token yarn build
yarn preview -p 3000
DETERMINISTIC=1 RUNS=3 BASE_URL=http://127.0.0.1:3000 yarn performance:measure
```

For a deployed candidate, omit `DETERMINISTIC=1` and set `BASE_URL` to its HTTPS URL.

## Baseline evidence

### Production M3 preview medians (three cold runs)

| Journey             |    FCP | Map ready | Data transfer | Data duration | Startup long tasks | Longest task | Errors |
| ------------------- | -----: | --------: | ------------: | ------------: | -----------------: | -----------: | -----: |
| Historical 1994     | 364 ms |  1,354 ms |     566,068 B |        395 ms |       160 ms total |       160 ms |      0 |
| PA school districts | 352 ms |  1,946 ms |   8,279,783 B |        639 ms |       581 ms total |       364 ms |      0 |

The school artifact was the measured bottleneck: 20,379,855 bytes raw and approximately 8.28 MB transferred by Cloudflare. The 1,532,130-byte raw Mapbox chunk was the largest JavaScript chunk. Initial route JavaScript was 423,430 bytes for historical years and 400,273 bytes for school districts. Optional FingerprintJS code and work loaded eagerly from the global app before a visitor opened feedback.

Cloudflare baseline responses were static cache hits for HTML, historical data, crawler files, and 404 during verification. Historical data returned one-year immutable caching. The unhashed school artifact returned a one-hour cache policy and may be a MISS at an individual edge. None of these static responses contained `X-HistoricBorders-Compute`; M3 live-tail evidence remains the authoritative proof that ordinary traffic invoked no Worker.

## Bounded optimizations

1. The school pipeline rounds coordinates to six decimal places. This preserves sub-meter coordinate precision, all 500 districts, the 460/40 Polygon/MultiPolygon mix, label containment, source hash, provenance, and source properties.
2. FingerprintJS is dynamically imported only after a visitor explicitly opens feedback. This removes optional fingerprinting code and CPU work from ordinary map startup.
3. CI budgets were tightened and expanded to cover total/largest JavaScript, route-initial JavaScript, total/largest historical data, and raw/Brotli school data.
4. A static-only production smoke monitor checks both map journeys, AD/BC paths, map-data cache policy, crawler files, and useful 404 without invoking the feedback Worker.

Geometry simplification was deliberately not used: no topology/visual-diff acceptance harness currently justifies changing source shapes.

## Final account-independent measurements

| Metric                            |     Baseline |        Final |                                    Change |
| --------------------------------- | -----------: | -----------: | ----------------------------------------: |
| School artifact raw               | 20,379,855 B | 12,023,844 B |                                    -41.0% |
| School artifact Brotli estimate   |  5,019,960 B |  1,797,383 B |                                    -64.2% |
| Historical initial JS             |    423,430 B |    391,587 B |                                     -7.5% |
| School initial JS                 |    400,273 B |    368,430 B |                                     -8.0% |
| Total generated JS                |  2,044.3 KiB |  2,044.6 KiB | +0.01% (code moved to an on-demand chunk) |
| Largest JS chunk                  |  1,532,130 B |  1,532,130 B |                                 unchanged |
| Local school map-ready median     |       205 ms |       193 ms |                                     -5.9% |
| Local school data-duration median |        43 ms |        37 ms |                                    -14.0% |
| Local school interaction median   |       239 ms |       242 ms |                          within run noise |
| Local historical map-ready median |       134 ms |       129 ms |                          within run noise |

Final deterministic runs had zero navigation/map readiness errors. The school startup longest task fell from 99 ms median to 99 ms (unchanged); coordinate rounding primarily improves network, parse/input size, and memory rather than Mapbox's fixed startup work.

## Enforced budgets

`yarn size:check`, included in `yarn validate` and CI, enforces:

- total generated JavaScript <= 2,100 KiB;
- largest JavaScript chunk <= 1,550 KiB;
- initial JavaScript for each map route <= 400 KiB;
- historical payloads <= 38 MiB total and <= 2,900 KiB each (tightened from 55 MiB/3,500 KiB by the addendum below);
- school payload <= 12,000 KiB raw and <= 1,850 KiB Brotli.

Current measured values pass: 2,044.6 KiB total JS, 1,496.2 KiB largest chunk, 382.4/359.8 KiB initial map-route JS, 54,311.9 KiB historical total, 3,299.0 KiB largest historical payload, and 11,742.0/1,755.3 KiB raw/Brotli school data.

## Deployed optimized candidate

Cloudflare Worker version `6e87c859-f70d-458f-aec4-6f51c41bc4de` was deployed to the Worker hostname on 2026-09-03 UTC. The first optimized candidate exposed an existing historical-map race in cold repeated loads (`Style is not done loading`); data sources could mount before Mapbox completed its style. The candidate was superseded after requiring `isStyleLoaded()` before source mounting. Five cold acceptance loads (three historical, two school) then rendered 198 historical features and 500 districts with zero page errors.

Three cold final runs produced:

| Journey             |    FCP | Map ready | Data transfer | Data duration | Longest startup task | Post-startup settings response | Errors |
| ------------------- | -----: | --------: | ------------: | ------------: | -------------------: | -----------------------------: | -----: |
| Historical 1994     | 348 ms |    792 ms |     566,016 B |        367 ms |               130 ms |                         483 ms |      0 |
| PA school districts | 344 ms |    989 ms |   3,883,612 B |        517 ms |               365 ms |                         791 ms |      0 |

Against the M3 preview baseline, school transfer fell 53%, map readiness improved 49%, and data duration improved 19%. Compression negotiated by the observed production browser differs from the local Brotli estimate. Historical changes are mostly startup deferral and run/network variance because its map payload did not change. Long-task totals are not directly comparable because the hardened measurement now allows map startup to settle and verifies a visible settings response before collecting metrics; longest task remained effectively unchanged for school (364 vs 365 ms).

All nine static smoke checks passed with expected cache controls and no compute marker. Final custom-domain cache/error/quota evidence and authoritative live-tail Worker isolation still require the DNS cutover. No target in this report authorizes paid services or weaker source fidelity/accessibility.

## Addendum: historical coordinate rounding (2026-11-18 UTC)

Observed facts: the historical pipeline now publishes coordinates at five decimal places (about 1.1 m) and drops consecutive duplicate positions. The pinned upstream commit `62d8f1a03a71f2d3ff17f2d166f7553f256bce68` did not change. Brotli estimates use `node:zlib` at quality 11 per file, summed. These are byte measurements, not browser timings.

| Metric                  |     Before |      After | Change |
| ----------------------- | ---------: | ---------: | -----: |
| Total raw (53 payloads) | 55,615,413 | 37,207,476 | -33.1% |
| Total Brotli estimate   | 14,165,944 |  7,234,964 | -48.9% |
| Largest raw (1492)      |  3,378,139 |  2,775,816 | -17.8% |
| 1492 Brotli estimate    |    763,919 |    528,271 | -30.8% |
| 1994 raw (default year) |  1,845,282 |  1,212,202 | -34.3% |
| 1994 Brotli estimate    |    423,046 |    215,044 | -49.2% |

All byte values are in bytes. Feature, label, place, and zero-area counts are unchanged in every year. 208 rings in 28 years would collapse below four positions after rounding and keep their original coordinates. All of them are upstream slivers less than a metre wide or already degenerate. Historical route-initial JavaScript is unchanged (382.5 KiB). The browser bundles `data/historical-assets.json`, so the fallback count is recorded once, not per year. `yarn size:check` now enforces 38 MiB total and 2,900 KiB largest. Those limits leave about 7% headroom.

Assumption: the smaller input should lower parse time and memory, most of all on low-end devices. No production Web Vitals were measured for this change.
