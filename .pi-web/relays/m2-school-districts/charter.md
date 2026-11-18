# Relay Charter: M2 Pennsylvania School Districts

## Identity

- Relay: `m2-school-districts`
- Root: `.pi-web/relays/m2-school-districts/`
- Upgrade sequence: second of four milestone Relays

## Goal and finish line

Complete M2 from `docs/UPGRADE_HARNESS_PLAN.md` after M1 is green. The Relay is complete only when:

1. A pinned PASDA source fixture and provenance record establish schema, source vintage, license/attribution, expected district count, required properties, geometry mix, and source checksum.
2. A controlled data-refresh command fetches, validates, and preprocesses the source separately from deterministic deployment builds.
3. Polygon and MultiPolygon districts receive valid borders, areas, and label positions, with malformed records rejected or reported explicitly.
4. The browser consumes a normalized static artifact rather than proxying and processing the 21 MB upstream source through runtime application compute.
5. The obsolete school-district proxy and stale cache path are removed after equivalent behavior is proven.
6. Loading, success, empty, malformed, upstream-unavailable, stale-data, cold-cache, and returning-user behavior is useful and tested.
7. District selection displays correct fixture details and the real validated artifact contains the expected records.
8. `yarn data:validate` and `yarn data:refresh` are explicit documented commands; normal `yarn build` does not contact PASDA.
9. Unit/integration tests and Playwright journeys pass in Chromium, Firefox, and WebKit.
10. `yarn validate` passes and product/source documentation is accurate.

The M2 section of `docs/UPGRADE_HARNESS_PLAN.md` and repository constraints in `AGENTS.md` are designated supporting requirements. Changing this finish line requires explicit owner agreement.

## Leg sizing

One runner owns the entire M2 milestone. Resume with a later numbered leg only after an owner-resolved intervention.

## Task selection

Choose the highest-priority unblocked finish-line item. Prefer source/schema measurement, fixtures, and validation before implementation; prove static behavior before removing the proxy. Do not begin M3 work.

## Handover

After M2 is fully green, update status, append the log, and spawn exactly one M3 session:

```text
Relay "m3-static-cloudflare" leg 1 begins now.

You are the next runner in this Relay method chain.

Read:
- .pi-web/relays/m3-static-cloudflare/charter.md
- .pi-web/relays/m3-static-cloudflare/status.md

Do not read log.md end-to-end. Use it only for targeted lookup if status.md or charter.md points you there.

Run one leg according to the charter. Before handing off, update status.md, append log.md, make work durable, then either spawn the next milestone Relay once or stop with a clear intervention note.
```

Never spawn early or more than once. Stop without spawning on intervention.

## Intervention signal

Stop with `BLOCKED — OWNER INPUT REQUIRED` in status and a log entry for: finish-line/scope change, paid-service risk, account/secret/DNS/production access, or subjective user-facing behavior. Repair validation failures within scope rather than stopping solely because a first attempt failed.

## Reading discipline

Read charter, status, `AGENTS.md`, the exact M2 plan section, and only files/status references needed for the current item. Do not read the full log, backlog, plan, or repository defensively. Repair an insufficient baton; stop if ambiguity requires subjective judgment.
