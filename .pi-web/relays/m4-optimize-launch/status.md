# Relay Status: M4 Optimize and Launch

- State: QUEUED — DO NOT START BEFORE M3 IS GREEN
- Current position: Packet prepared; M4 has not started.
- Last completed leg: 0 (Relay setup)
- Next leg to run: 1
- Next task: After M3 completion, measure and complete all account-independent optimization/launch preparation before raising required account or DNS interventions.

## Relevant context

- Prerequisite: `.pi-web/relays/m3-static-cloudflare/status.md` must say COMPLETE.
- Read `AGENTS.md` and only the M4, validation, success-measure, and risk sections of `docs/UPGRADE_HARNESS_PLAN.md`.
- Use `docs/product/SCORECARD.md` as the measurement destination, not as authority to change the finish line.
- Owner access is known for GitHub and Vercel and a Cloudflare account can be created. DNS registrar access remains unidentified and must trigger intervention.

## Progress documentation

Update status, append `log.md`, record before/after evidence and launch review, and preserve rollback instructions before stop.

## Blockers / intervention

M3 completion is required. Cloudflare, Vercel, and DNS production steps require owner intervention.
