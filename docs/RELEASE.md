# Release process

Every change reaches production through a pull request that merges itself once CI passes. There is no staging and no manual sign-off (owner decision): a merge to `main` is a release.

## Flow

1. **Open a pull request** from a branch. Tests run in CI, not locally: run only the narrow checks you need while working.
2. **Turn on auto-merge** (`gh pr merge --auto --squash`, or the button on the PR). Auto-merge is enabled for the repository.
3. **CI on the pull request** (`.github/workflows/ci.yml`) runs in parallel:
   - `checks`: `format:check` and `data:validate`;
   - `app`: build, `dist:validate`, `cloudflare:check`, `size:check`, `type-check`, unit tests;
   - `e2e (chromium|firefox|webkit)`: the browser journeys against `app`'s build, one job per engine in the Playwright image;
   - `browser tests`: passes when every engine passed (or none needed to run);
   - also reported but not required: `dependency-review`, the `Layout` suites and the `Preview` deploy.
4. **Branch protection on `main`** requires `checks`, `app` and `browser tests`. The branch does not have to be up to date with `main` (no forced rebases); the `type-check` on the merge commit catches most conflicts between two PRs. When the three checks pass, GitHub merges the PR and deletes its branch.
5. **The push to `main` ships**: the `scope` job sees that the commit came from a merged PR, so `app` builds (with the GA ID), validates and type-checks without re-running the tests, `deploy` ships the build to Cloudflare Workers, and the production smoke test runs. About 4–5 minutes from merge to live.

A **direct push to `main`** (admins can still push) is not a merged PR, so CI runs the unit tests and all three browser jobs before deploying.

**Documentation-only PRs** (`docs/`, `design/`, `*.md`) skip `app` and the browsers; the required checks pass as skipped.

## Why

Observed on 2026-11-18: every merge re-ran the full suite on `main` before deploying (about 10–13 minutes), with the three browsers in one serial job, and two deploys were blocked by a flaky browser test whose PR had already passed. Running the gate once, in parallel, on the PR, and shipping the already-tested change makes releases faster and stops flakes from holding production, without testing less.

## Rollback

Roll back with a Cloudflare Worker-version rollback (docs/CLOUDFLARE_DEPLOYMENT.md), then revert the commit on `main` through a PR. The manual **Deploy** workflow rebuilds and redeploys the current `main`.
