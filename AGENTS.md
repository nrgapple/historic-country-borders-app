# Historic Borders Repository Guide

## Product

Historic Borders helps people explore how political borders changed over time. It also includes a Pennsylvania school-district map. Read `PRODUCT.md` and `docs/UPGRADE_HARNESS_PLAN.md` before changing architecture or product behavior.

## Non-negotiables

- Production must remain viable on a free tier.
- Public pages and map data must be static-first. Do not add request-time compute to ordinary page or crawler traffic.
- Do not add generative-AI features. Gemini and the existing AI comparison functionality are being removed.
- Keep secrets server-side. A variable prefixed with `NEXT_PUBLIC_` is public and must never contain a secret.
- Preserve data attribution, provenance, vintage, and uncertainty notices.
- Treat upstream map data as untrusted input: validate schemas and geometry before publishing it.
- Separate observed facts, assumptions, and recommendations in plans and product reviews.

## Toolchain

- Use Node 22 (`.nvmrc`).
- Use Yarn Classic and the committed `yarn.lock`; never use npm or pnpm.
- Install with `yarn install --frozen-lockfile`.
- Do not commit `.env*`, credentials, `node_modules`, build output, coverage, or browser-test artifacts.

## Required workflow

1. Start from a user problem and define acceptance criteria.
2. Add or update tests before considering the change complete.
3. Run the narrowest relevant tests while iterating.
4. Run `yarn validate` before merge.
5. For map-data changes, also run `yarn data:validate` once introduced.
6. For critical journeys, run `yarn test:e2e` once introduced.
7. Update product/architecture decisions when behavior or constraints change.

The complete local quality gate is:

```bash
yarn validate
```

Use `yarn type-check`, `yarn test`, `yarn build`, and `yarn test:e2e` for narrower checks. Known baseline gaps are recorded in `docs/product/SCORECARD.md`; do not hide them by weakening checks.

## Architecture rules

- Prefer build-time preprocessing and immutable static assets over runtime proxying or transformation.
- Keep dynamic endpoints few, explicit, bounded, and independently rate-limited.
- Do not fetch the same upstream manifest once per generated page; fetch once in a controlled refresh/build step.
- Make data refresh explicit and reviewable. Upstream changes must not silently reach production.
- Keep Cloudflare-specific behavior at deployment boundaries so the static output remains portable.
- Avoid broad rewrites without milestone-specific validation and a rollback path.

## Testing rules

- Unit and integration tests must not require production secrets or live third-party APIs.
- Use fixtures/request interception for GitHub, Wikipedia, PASDA, Mapbox, Airtable, and Discord behavior in CI.
- Scheduled smoke tests may check live upstreams, but they must not gate ordinary pull requests.
- Test loading, success, empty, malformed, timeout, and unavailable states for external data.
- Browser tests should use semantic locators and verify user-visible outcomes, not implementation details.

## Relay execution

Long-running upgrade work is organized as milestone Relays under `.pi-web/relays/` in this order:

1. `m1-ai-removal`
2. `m2-school-districts`
3. `m3-static-cloudflare`
4. `m4-optimize-launch`

A dispatched Relay runner must read its `charter.md` and `status.md`, follow the contained reading discipline, complete one whole milestone, make state durable, and hand off exactly once only as its charter permits. Do not use tracked subsessions as Relay handoffs. Use tracked subsessions only for bounded parallel audits whose results return to the current session. Never start a queued Relay before its prerequisite status is `COMPLETE`.

## Product loop

Use the documents under `docs/product/`:

1. Capture evidence in the scorecard/review.
2. Add opportunities to the backlog with user impact, confidence, effort, and risk.
3. Recommend the smallest high-impact change.
4. Define success signals before implementation.
5. Review the result after launch and record the decision.
