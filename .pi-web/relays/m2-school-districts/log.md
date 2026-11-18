# Relay Log: M2 Pennsylvania School Districts

## Setup — leg 0

Created the queued M2 packet under the owner-approved milestone Relay policy. It must not begin until M1 is complete.

## Leg 1 — complete M2 milestone

- Confirmed M1 was complete, measured the pinned October 2025 PASDA source, and recorded its checksum, size, metadata/terms, 500-record schema, and 460 Polygon/40 MultiPolygon mix.
- Added a pinned mixed-geometry fixture, deterministic validation/normalization library, explicit `data:refresh` and offline `data:validate` commands, provenance/report files, and a committed 20,379,855-byte static artifact.
- Corrected MultiPolygon area/label handling with validated interior label points; malformed records now fail explicitly rather than being skipped.
- Replaced the runtime proxy, browser preprocessing, and IndexedDB cache with a static fetch. Added visible loading, empty, unavailable/retry, stale-source, attribution, and source-vintage behavior.
- Added pipeline, hook, state, and fixture-selection tests; expanded Playwright to cold/reload journeys in Chromium, Firefox, and WebKit; updated CI browser installation.
- Updated README, school/source/runtime docs, product decision/backlog/scorecard, and removed obsolete proxy/preprocessing paths.
- Validation: `yarn validate` passed with 196 Vitest tests, `yarn data:validate`, successful build/size checks, and 9 Playwright runs.
- M2 finish line is complete with no blocker. Handoff target: `m3-static-cloudflare` leg 1.
