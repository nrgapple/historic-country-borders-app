# M3 Product and Reliability Review

## Review period

- Milestone: M3 local/static migration
- Release/commit: working tree pending Cloudflare preview
- Reviewer: Relay runner

## Observed evidence

- Availability and errors: production baseline remains Vercel HTTP 402; Cloudflare preview requires owner access.
- Critical journeys: local deterministic coverage now includes root, AD/BC deep links, school map, useful static 404, and bounded feedback-unavailable behavior.
- Performance and data sizes: 53 processed historical payloads total 55,615,413 bytes; school payload is 20,379,855 bytes; static export has 198 files and no file exceeds 25 MiB.
- Data-source freshness: historical source pinned to commit `62d8f1a03a71f2d3ff17f2d166f7553f256bce68`; school source remains October 2025 PASDA.
- Free-tier usage: local routing proves only `/api/feedback` is eligible for Functions; live invocation/quota evidence is pending owner preview.

## Assumptions requiring validation

- Cloudflare preview serves all ordinary pages/data as static hits and applies the checked-in exact Function route.
- The owner account remains Free with no billable feature enabled.
- Bot controls can be configured without blocking maps, Wikipedia, feedback, or legitimate crawlers.

## User problems and recommendation

1. Users cannot access disabled production. The smallest next step is an owner-created free Cloudflare preview, not DNS cutover.
2. Ordinary historical exploration previously depended on runtime GitHub processing. The accepted fix is committed, content-hashed, validated static payloads.

Acceptance for M3 requires preview critical journeys, zero Function increments for pages/data, exactly one incrementing dynamic feedback path, and documented quota/bot evidence. Roll back by promoting the prior Pages deployment; do not proceed to DNS in M3.

## Decision

- Accepted: committed historical artifacts, fully static Next export, direct Wikipedia CORS, one isolated feedback Function.
- Deferred: production DNS cutover and performance optimization to M4.
- Blocked pending owner: Cloudflare account/project setup and preview verification.

## Backlog and scorecard updates

`docs/product/BACKLOG.md`, `docs/product/DECISIONS.md`, and `docs/product/SCORECARD.md` record the M3 implementation and remaining preview gate.
