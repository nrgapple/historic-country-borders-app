# Upgrade Harness Plan

Status: Approved — M0 baseline in progress

## Problem

Historic Borders is currently unavailable because its Vercel deployment is disabled with HTTP 402 (`x-vercel-error: DEPLOYMENT_DISABLED`). The reported cost driver was edge compute, likely amplified by AI crawlers. The replacement must remain within a free tier and must not allow ordinary page traffic or crawlers to trigger unbounded compute usage.

The repository also needs a repeatable harness for upgrades, testing, optimization, and product enhancement. Pennsylvania school districts are the first product repair priority. Gemini-backed AI features should be removed; the other useful integrations should remain unless they become unnecessary as a consequence.

## Goals

1. Restore the site on a provider whose free usage cannot silently turn into a bill.
2. Make normal map and crawler traffic static, cached, and compute-free.
3. Restore and test the Pennsylvania school-district experience.
4. Add one-command local validation, GitHub Actions CI, and browser-level E2E tests.
5. Create a lightweight product-management harness that continuously turns evidence into prioritized recommendations.
6. Upgrade dependencies and architecture only behind measurable quality gates.

## Non-goals for the first release

- Adding new generative-AI product features.
- Paying for production infrastructure.
- Redesigning the entire visual identity before reliability is restored.
- Treating historical boundary data as academically authoritative without source caveats.

## Observed facts

- The app uses Next.js 15.3.8, React 18, the Pages Router, Yarn Classic, and Node 22 according to `package.json` and `.nvmrc`.
- The current local shell is Node 24 and `node_modules` is absent, so a clean Node 22 baseline has not yet been run.
- The code contains seven Next API routes. Normal border views currently invoke `/api/borders/...`, which downloads and transforms remote GeoJSON on demand.
- The school-district route proxies a 21,161,924-byte PASDA GeoJSON file through application compute. The source currently responds successfully, but production cannot be tested because the entire Vercel deployment returns 402.
- School-district processing occurs in the browser and stores the processed result in IndexedDB for 24 hours. Geometry handling assumes `Polygon`, which must be validated against the actual source, including any `MultiPolygon` records.
- Gemini powers country descriptions and country comparisons. Redis appears dedicated to AI caching plus a generic cache endpoint; its remaining value should be reassessed when Gemini is removed.
- There is a substantial Vitest suite, but no CI workflow, lint command, Playwright suite, deployment manifest, health check, or checked-in environment template.
- The only explicitly imported Vercel product is Speed Insights.
- The feedback webhook variable is named `DISCORD_WEBHOOK_URL` even though it is consumed server-side. It should be renamed to avoid implying that the secret is safe for browser exposure.

## Provider recommendation

### Recommended: Cloudflare Pages/Workers with a static-first architecture

Cloudflare is the strongest fit for the free-only constraint if the app is changed so ordinary traffic is served as static assets rather than invoking a Worker.

Relevant published characteristics:

- Static asset requests are free and unlimited.
- Workers Free allows 100,000 Worker requests/day, but only the small set of genuinely dynamic actions should use it.
- AI Crawl Control is available on all plans, and Bot Fight Mode is available on Free.
- Custom domains and TLS are supported.
- Workers supports streaming and a range of Node APIs, but adapting the whole current Next server to Workers would preserve unnecessary compute and compatibility risk.

Sources:

- <https://developers.cloudflare.com/workers/platform/limits/>
- <https://developers.cloudflare.com/workers/platform/pricing/>
- <https://developers.cloudflare.com/workers/static-assets/>
- <https://developers.cloudflare.com/ai-crawl-control/>
- <https://developers.cloudflare.com/bots/get-started/bot-fight-mode/>

### Why not merely move the current server

A lift-and-shift would retain per-view GeoJSON transformation, remote API calls, and crawler-triggered server rendering. It could exhaust any free compute allowance again. The safer design makes the public site and map datasets static, leaving only bounded feedback submission as dynamic compute.

### Alternatives

- Netlify Free has a hard credit limit and pauses projects when exhausted, but its credit model charges across bandwidth, compute, and requests. It is safer than uncapped billing but less attractive than compute-free static delivery for this workload.
- Render Free can run a conventional Node server but may spin down and still leaves every map/API request dependent on a server process.
- Railway Free includes only a small monthly usage credit and is not a durable free-only target for this app.

## Target architecture

### Static application path

- Preserve the user-facing routes, including `/year/[year]` and `/pa/school-districts`.
- Generate the year manifest and route outputs during the build instead of querying GitHub at runtime.
- Download, validate, and preprocess historical GeoJSON in a controlled, versioned data-refresh workflow.
- Publish processed map payloads as immutable, content-hashed static assets with a generated manifest.
- Download and preprocess the PASDA school-district source during the same controlled workflow; publish it as a static optimized asset.
- Keep deployment builds deterministic: they consume pinned artifacts and never depend on live GitHub or PASDA access.
- Keep browser caching/IndexedDB only where it produces a measured benefit. Prefer HTTP caching as the first layer.
- Fetch Wikipedia directly from the browser if its CORS/API behavior passes tests; otherwise use one tightly cached Worker endpoint.
- Remove Vercel Speed Insights and use existing GA4 plus free uptime checks and Cloudflare analytics where useful.

### Dynamic path

- Keep feedback submission in one narrowly scoped Cloudflare Function/Worker so Discord/Airtable secrets remain server-side.
- Enforce method, schema, body-size, origin, timeout, and rate limits.
- Return static-friendly failure states if the Worker quota is unavailable.
- Do not route page rendering, map assets, school data, or crawlers through Worker compute.

### AI removal

Remove the feature end-to-end rather than merely hiding it:

- Gemini API routes and key documentation.
- AI country-information provider and UI toggle.
- AI comparison context, UI, history, analytics, tests, and styles.
- Redis AI cache and generic cache route if no non-AI consumer remains.
- Gemini, Redis, and Vercel-only dependencies made unused by the removal.

Wikipedia remains the country-information provider.

## Harness design

### Repository guidance

Add a project-level `AGENTS.md` that defines:

- Product intent and non-negotiables.
- Static-first and free-tier constraints.
- Yarn/Node conventions.
- Required checks before merge.
- Data-source attribution and update rules.
- Security rules for environment variables.
- A rule that feature work starts from a measurable user problem.

### Product harness

Add durable product documents:

- `PRODUCT.md`: audience, jobs-to-be-done, value proposition, principles, and success measures.
- `docs/product/SCORECARD.md`: availability, map-load success, school-map success, performance, feedback, and usage indicators.
- `docs/product/BACKLOG.md`: scored opportunities using impact, confidence, effort, risk, and evidence.
- `docs/product/REVIEW.md`: a recurring review template that turns analytics, errors, feedback, and technical findings into recommendations.
- `docs/product/DECISIONS.md` or ADRs: accepted/rejected recommendations and rationale.

The assistant's product-person loop will be:

1. Collect evidence from tests, analytics, feedback, performance, and data freshness.
2. State observed facts separately from assumptions.
3. Identify user problems, not just feature ideas.
4. Score and recommend the smallest high-impact change.
5. Define acceptance criteria and instrumentation before implementation.
6. Ship behind the harness, then review results and update the backlog.

### Local commands

Provide stable scripts with no production secrets required:

- `yarn validate`: type-check, unit/integration tests, production build, and browser smoke tests. (Yarn Classic reserves `yarn check`, so the harness cannot safely use that name.)
- `yarn test:e2e`: Playwright against a locally served production build.
- `yarn test:e2e:ui`: interactive browser debugging.
- `yarn data:validate`: source schema, geometry, required fields, years, and output-size checks.
- `yarn data:refresh`: explicit data update; never hidden inside normal development.

### GitHub Actions

Required pull-request workflow:

1. Pin Node 22 and Yarn Classic with dependency caching.
2. Install from the lockfile.
3. Run formatting/lint and type-check.
4. Run Vitest with coverage.
5. Build the static production artifact.
6. Run Playwright against that artifact.
7. Upload failure screenshots, traces, and relevant reports.
8. Run dependency review/security checks appropriate for a public repository.

A separate manually triggered data-refresh workflow should fetch upstream datasets, validate and optimize them, show file-size diffs, and open or prepare a reviewable change. Upstream data changes must not silently alter production.

### E2E critical journeys

- Root route resolves to a valid historical year.
- A historical map loads borders and labels without a server API call.
- Timeline navigation changes year and preserves valid URL behavior.
- Country selection shows Wikipedia information and handles upstream failure.
- Settings persist and do not break map interaction.
- Pennsylvania school-district page loads all expected districts.
- Selecting a district shows the correct details.
- School map works on a cold cache and a returning visit.
- Feedback validates input and degrades safely when the dynamic endpoint is unavailable.
- Unknown year and error states are useful and crawl-safe.

External calls should be deterministic in CI through fixtures or request interception. A small optional scheduled smoke test may verify the real upstream sources.

## Milestones and gates

### M0 — Baseline and safety

Deliverables:

- Project `AGENTS.md`, environment example, architecture inventory, and command harness.
- Reproducible Node 22/Yarn install.
- Baseline results for tests, type-check, build, dependency audit, coverage, and bundle/output sizes.
- Explicit secret inventory and rotation recommendation for anything previously exposed.

Exit gate: one local command reports a trustworthy pass/fail baseline.

### M1 — Remove AI and reduce attack/cost surface

Deliverables:

- Complete Gemini/AI comparison removal.
- Remove now-unused Redis and Vercel code unless a verified non-AI use remains.
- Crawler policy (`robots.txt`, AI crawler controls, and suitable Cloudflare rules).
- Rate/size/origin controls for remaining dynamic operations.

Exit gate: no Gemini route, UI, key, Redis connection, or AI-triggered compute remains; regression tests pass.

### M2 — Repair school districts

Deliverables:

- Fixture-based diagnosis of the actual PASDA schema and geometry types.
- Build-time normalized school-district artifact with source date/license metadata.
- Correct labels for Polygon and MultiPolygon geometries.
- Loading, error, empty, and stale-data states.
- Unit tests plus Playwright cold/returning-user journeys.

Exit gate: expected district count and required fields validate; the page renders and selection works in Chromium, Firefox, and WebKit.

### M3 — Static-first migration

Deliverables:

- Static manifests and preprocessed map assets.
- Removal or isolation of runtime map-processing APIs.
- Cloudflare deployment configuration and documented secrets.
- Preview deployment, custom-domain plan, bot controls, and rollback instructions.

Exit gate: normal pages and map assets produce zero Worker invocations; only approved dynamic paths consume the Worker quota.

### M4 — Optimize and launch

Deliverables:

- Measured bundle/data reductions, cache headers, lazy loading, and map responsiveness improvements.
- Production smoke test and uptime monitor.
- DNS cutover and rollback window.
- Post-launch quota and error review.

Exit gate: production journeys pass, budget cannot auto-upgrade into paid usage, and rollback has been tested or explicitly verified.

### M5 — Product enhancement cycle

Initial recommendation candidates after reliability work:

1. Make school districts discoverable from primary navigation and clarify the dataset vintage.
2. Add district search and direct-linkable district selection.
3. Improve historical source/uncertainty explanations.
4. Add shareable map state and a useful social preview.
5. Use feedback and map interaction evidence to prioritize the next change.

These are hypotheses, not approved features. They enter the scored backlog after baseline evidence is available.

## Validation and success measures

Technical measures:

- Production availability and successful critical-journey checks.
- Zero runtime compute for page HTML and map-data asset delivery.
- Worker invocations restricted to documented dynamic endpoints.
- No client bundle references to Gemini, Redis, Vercel Speed Insights, or secret webhook values.
- Deterministic CI on every pull request.
- School-district schema/count validation and cross-browser E2E coverage.
- Explicit size/performance budgets established from the baseline, then tightened after optimization.

Product measures:

- School map load-success rate.
- Time until a district is interactable.
- District selections per school-map visit.
- Historical year exploration per visit.
- Actionable feedback volume and recurring problem themes.

## Risks and mitigations

- **Cloudflare free limits or product terms change:** isolate deployment configuration, document alternatives, and keep the output portable static files.
- **Upstream datasets change or disappear:** controlled refresh workflow, fixtures, schema validation, provenance metadata, and last-known-good artifacts.
- **Repository size grows from generated data:** publish generated artifacts during CI or use release/object assets rather than committing large payloads; choose after measuring all outputs.
- **Mapbox or GitHub quotas become the next bottleneck:** instrument failures and cache static inputs; never put public provider tokens with unintended privileges in the bundle.
- **Bot controls block legitimate users:** begin with AI crawler rules and caching; test broad Bot Fight Mode against maps and APIs before enabling it.
- **Major refactor causes regressions:** milestone gates, fixture tests, browser tests, preview deployment, and reversible DNS cutover.

## Approved decisions

- Cloudflare is the deployment target; the owner can create a free Cloudflare account.
- Use a major static-first refactor rather than a Next server lift-and-shift.
- Remove Redis together with Gemini and the AI feature set.
- The owner can access GitHub and Vercel. Domain/DNS access still needs to be located before cutover; no credentials should be shared in chat.

## Remaining open decisions

1. Identify the domain registrar/DNS account before production cutover.
2. Decide whether generated data belongs in deployment artifacts, a release, or object storage after the baseline measures total size.
