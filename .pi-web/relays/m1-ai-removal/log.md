# Relay Log: M1 AI and Cost-Surface Removal

## Setup — leg 0

Created the Relay packet after owner approval. The owner chose one Relay per milestone, one complete milestone per runner, highest-priority unblocked task selection, automatic green handoff, contained reading, and intervention for scope changes, spending risk, account/access needs, or subjective user-facing decisions. M1 is ready but has not been dispatched.

## Dispatch — leg 1

Checkpointed M0 as four focused commits on `upgrade/cloudflare-harness`, opened PR #30, and verified the GitHub `validate` and `dependency-review` jobs. Dependency review exposed high-severity advisories in Next.js 15.3.8, so the baseline was upgraded and revalidated on Next.js 15.5.25 before dispatch. The legacy Vercel check remains red because the blocked Vercel deployment is the migration trigger, not an M1 acceptance gate. Dispatching leg 1 to complete the M1 finish line and hand off to M2 when green.
