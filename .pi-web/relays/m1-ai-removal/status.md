# Relay Status: M1 AI and Cost-Surface Removal

- State: COMPLETE — M1 exit gate passed; M2 handoff ready
- Current position: M1 is implemented and validated on `upgrade/cloudflare-harness`.
- Last completed leg: 1 (entire M1 milestone)
- Next leg to run: none in this Relay
- Next task: Start `m2-school-districts` leg 1 according to its charter.

## Completion evidence

- Generated country information, country comparison, provider toggle/context, comparison history/storage/analytics/styles, cache service/routes, and Vercel Speed Insights were removed end-to-end.
- Wikipedia is the sole country-information path and has hook, component, loading/error, and bounded route coverage.
- `public/robots.txt` blocks named model-training/answer crawlers while allowing ordinary pages/assets; Cloudflare dashboard actions are documented in `docs/RUNTIME_SURFACE.md` for M3.
- Four temporary dynamic routes now have documented and tested method, validation, size, timeout, rate where applicable, and safe-failure controls or milestone-specific removal plans.
- README, school-district documentation, upgrade status, product backlog, decisions, and scorecard reflect M1.
- `yarn install --frozen-lockfile` passes on Node 22.23.2 / Yarn 1.22.22.
- `yarn validate` passes: 187 Vitest tests, coverage gates, build/size checks, and 3 Chromium journeys.
- Exact source/runtime and `.next/static` scans return no removed-service or removed-feature references.

## Relevant context for M2

- Preserve all M1 work and continue on `upgrade/cloudflare-harness`.
- Temporary school proxy bounds and M2 replacement intent are documented in `docs/RUNTIME_SURFACE.md` and `docs/PA_SCHOOL_DISTRICTS.md`.
- Current build has four dynamic API routes; M2 owns replacing the school route with a validated static artifact.

## Blockers / intervention

None.
