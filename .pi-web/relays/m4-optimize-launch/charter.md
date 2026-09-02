# Relay Charter: M4 Optimize and Launch

## Identity

- Relay: `m4-optimize-launch`
- Root: `.pi-web/relays/m4-optimize-launch/`
- Upgrade sequence: fourth and final approved infrastructure milestone Relay

## Goal and finish line

Complete M4 from `docs/UPGRADE_HARNESS_PLAN.md` after M3 is green. The Relay is complete only when:

1. Baseline and final measurements cover JavaScript/data sizes, critical rendering and interaction timings, cache behavior, map responsiveness, errors, and approved Worker usage.
2. Measured bottlenecks receive bounded optimizations such as lazy loading, artifact simplification/compression, caching, and rendering improvements without weakening source fidelity or accessibility.
3. Enforced performance/build-size budgets are documented and pass in CI.
4. Production smoke/uptime monitoring checks critical historical and school journeys without causing meaningful compute usage.
5. Cloudflare free-tier usage, bot controls, static-hit behavior, dynamic route counts, and failure/degradation behavior are verified.
6. Custom-domain/DNS cutover and rollback instructions are exact, reversible, and tested where possible.
7. Production is cut over to the verified Cloudflare deployment, critical journeys pass, ordinary traffic cannot auto-upgrade into paid usage, and Vercel rollback/retirement state is documented.
8. A post-launch quota/error review is recorded in the product scorecard and review documents.
9. `yarn validate` and production smoke checks pass.
10. No M5 product hypothesis is implemented without a new owner-approved finish line.

The M4 section, success measures, and risks in `docs/UPGRADE_HARNESS_PLAN.md`, plus `AGENTS.md`, are designated supporting requirements. Changing this finish line requires owner agreement.

## Leg sizing

One runner owns M4, with later numbered resume legs only after owner-resolved account/DNS interventions.

## Task selection

Choose the highest-priority unblocked finish-line item. Measure before optimizing; complete all account-independent work before requesting access; preserve rollback throughout.

## Handover

There is no automatic M5 handoff because enhancement candidates are hypotheses without an approved finish line. On full M4 completion, update status/log and stop. The owner must approve the next product milestone before another Relay packet or session is created.

Never spawn on intervention or after completion.

## Intervention signal

Stop with `BLOCKED — OWNER INPUT REQUIRED` for finish-line/scope change, paid-service risk, account/secret/DNS/production access, or subjective user-facing behavior. Finish safe local preparation and provide exact non-secret owner instructions first. Never request credentials in chat.

## Reading discipline

Read charter, status, `AGENTS.md`, the exact M4 plan/success/risk sections, and only referenced/implicated artifacts. Do not read full Relay logs or product history defensively. Repair the baton when possible; stop on subjective ambiguity.
