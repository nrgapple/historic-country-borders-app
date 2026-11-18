# Relay Charter: M1 AI and Cost-Surface Removal

## Identity

- Relay: `m1-ai-removal`
- Root: `.pi-web/relays/m1-ai-removal/`
- Upgrade sequence: first of four milestone Relays

## Goal and finish line

Complete M1 from `docs/UPGRADE_HARNESS_PLAN.md`. The Relay is complete only when all of the following are true:

1. Gemini country information and AI comparison functionality are removed end-to-end: routes, hooks, contexts, components, settings, history/storage, analytics, tests, styles, dependencies, environment variables, and setup documentation.
2. Wikipedia remains the sole country-information path and its covered behavior still works.
3. Redis and the generic cache route are removed, with no imports, dependencies, environment variables, setup documentation, or runtime connections remaining.
4. Vercel Speed Insights and other now-unused Vercel-specific application code are removed.
5. Repository-level crawler policy addresses known AI crawler amplification without blocking ordinary pages or required assets. Any dashboard-only Cloudflare action is documented for M3 rather than performed here.
6. Remaining dynamic operations have bounded method, payload, timeout, validation, and safe-failure behavior appropriate to their current runtime, or an explicit tested reason is recorded for deferral to M3.
7. README, `.env.example`, product documents, scorecard, and architecture decisions describe the resulting product accurately.
8. `yarn validate` and `yarn install --frozen-lockfile` pass.
9. Searches of source and built client assets find no Gemini, Redis, AI-comparison, or Vercel Speed Insights runtime references, except historical decision/log text that is clearly marked as history.

The M1 section of `docs/UPGRADE_HARNESS_PLAN.md` and repository constraints in `AGENTS.md` are designated supporting requirements. Changing this finish line requires explicit owner agreement and a charter update.

## Leg sizing

One runner owns the entire M1 milestone. Do not split ordinary M1 implementation into smaller Relay legs. If an intervention condition requires a stop, a later runner may resume as the next numbered leg after the owner resolves it.

## Task selection

Use the explicit M1 finish-line list above. When ordering is not explicit, choose the highest-priority unblocked task, preferring risk-reducing removal, tests, and dependency cleanup before documentation polish. Do not begin M2 work.

## Handover

After M1 is fully green, update this Relay's `status.md`, append `log.md`, and spawn exactly one independent session for M2 using `spawn_session`:

```text
Relay "m2-school-districts" leg 1 begins now.

You are the next runner in this Relay method chain.

Read:
- .pi-web/relays/m2-school-districts/charter.md
- .pi-web/relays/m2-school-districts/status.md

Do not read log.md end-to-end. Use it only for targeted lookup if status.md or charter.md points you there.

Run one leg according to the charter. Before handing off, update status.md, append log.md, make work durable, then either spawn the next milestone Relay once or stop with a clear intervention note.
```

Do not spawn early or spawn multiple sessions. If an intervention condition fires, stop without spawning.

## Intervention signal

Stop, set `status.md` to `BLOCKED — OWNER INPUT REQUIRED`, and append a clear log entry when:

- the agreed finish line or product scope must change;
- any paid service or spending risk is introduced;
- account, secret, DNS, or production access is required;
- user-facing behavior requires a subjective owner decision.

A failing validation attempt is not by itself an intervention: repair it within scope. A finish-line change always requires owner agreement.

## Reading discipline

Read only:

1. this charter;
2. `status.md`;
3. `AGENTS.md` and the exact M1 plan section;
4. files specifically referenced by status or directly implicated by the current finish-line item.

Do not read `log.md` end-to-end, the entire product backlog, or the whole repository defensively. Use targeted searches. If the baton is insufficient, repair `status.md`; stop if resolving ambiguity requires broad archaeology or a subjective product decision.
