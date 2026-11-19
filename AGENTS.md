# Historic Borders Repository Guide

## Product

Historic Borders helps people explore how political borders changed over time. It also includes a Pennsylvania school-district map. Read `PRODUCT.md` and `docs/UPGRADE_HARNESS_PLAN.md` before changing architecture or product behavior.

## Non-negotiables

- Production must remain viable on a free tier.
- Public pages and map data must be static-first. Do not add request-time compute to ordinary page or crawler traffic.
- Do not add generative-AI features. Gemini and the AI comparison functionality were removed.
- Keep secrets server-side. A variable prefixed with `NEXT_PUBLIC_` is public and must never contain a secret.
- Preserve data attribution, provenance, vintage, and uncertainty notices.
- Treat upstream map data as untrusted input: validate schemas and geometry before publishing it.
- Separate observed facts, assumptions, and recommendations in plans and product reviews.

## Toolchain

- Use Node 22 (`.nvmrc`; ≥ 22.23.4).
- Use Yarn Classic and the committed `yarn.lock`; never use npm or pnpm. The repository is one package: add dependencies at an exact version with `yarn add <pkg>@<exact>` (or `yarn add -D`).
- Install with `yarn install --frozen-lockfile`.
- CI runs browser tests in `mcr.microsoft.com/playwright:v<version>-noble` (`ci.yml` e2e, `layout.yml`); when you bump `@playwright/test`, bump that image tag to the same version.
- Do not commit `.env*`, credentials, `node_modules`, build output, coverage, or browser-test artifacts.

## Required workflow

1. Start from a user problem and define acceptance criteria.
2. Add or update tests before considering the change complete.
3. Run the narrowest relevant tests while iterating.
4. Run `yarn validate` before merge.
5. For map-data changes, also run `yarn data:validate`.
6. For critical journeys, run `yarn test:e2e`; for layout changes, `yarn test:layout`.
7. Update product/architecture decisions when behavior or constraints change.

The complete local quality gate is:

```bash
yarn validate
```

`yarn quality` is the same gate without the browser journeys. For narrower checks:

| Command                 | What it does                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `yarn dev`              | `yarn data`, then `astro dev` on <http://127.0.0.1:4321>                                            |
| `yarn build`            | `yarn data`, the stale-`tokens.css` check and `astro build` → `dist/`                               |
| `yarn preview`          | Workers-like static server for `dist/` on <http://127.0.0.1:4410>                                   |
| `yarn data`             | Stages the shipped static files into `build/public/` and writes `src/data/*.json` (offline)         |
| `yarn tokens`           | Regenerates `src/styles/tokens.css` from `src/styles/tokens.ts`                                     |
| `yarn type-check`       | `tsc --noEmit` over `src/`, `tests/`, `worker/`, `e2e/` and the configs                             |
| `yarn test`             | Vitest: the `app` project (jsdom, `src/`) and the `data` project (node, `tests/`)                   |
| `yarn test:e2e`         | Playwright critical journeys (`e2e/*.spec.ts`) against `dist/` on port 4411, or `BASE_URL`          |
| `yarn test:layout`      | Safe-area, width and forced-dark suites (`e2e/layout/`) against `dist/` on port 4410, or `BASE_URL` |
| `yarn dist:validate`    | Required pages and files, Cloudflare Free limits and the Worker-first route                         |
| `yarn cloudflare:check` | Wrangler dry-run of the production Worker and assets                                                |
| `yarn size:check`       | File-count, year-data, glyph and font budgets for `dist/`                                           |
| `yarn data:validate`    | Validates every committed data artifact offline                                                     |
| `yarn format:check`     | Prettier                                                                                            |

Use `yarn test --maxWorkers=2` on a busy machine. Known baseline gaps are recorded in `docs/product/SCORECARD.md`; do not hide them by weakening checks.

## Architecture rules

- Prefer build-time preprocessing and immutable static assets over runtime proxying or transformation.
- Keep dynamic endpoints few, explicit, bounded, and independently rate-limited.
- Do not fetch the same upstream manifest once per generated page; fetch once in a controlled refresh/build step.
- Make data refresh explicit and reviewable. Upstream changes must not silently reach production.
- Keep Cloudflare-specific behavior at deployment boundaries so the static output remains portable.
- Avoid broad rewrites without milestone-specific validation and a rollback path.

## Testing rules

- Unit and integration tests must not require production secrets or live third-party APIs.
- Use fixtures/request interception for GitHub, Wikipedia, Wikidata, PASDA, PIAA, Airtable, and Discord behavior in CI.
- Scheduled smoke tests may check live upstreams, but they must not gate ordinary pull requests.
- Test loading, success, empty, malformed, timeout, and unavailable states for external data.
- Browser tests should use semantic locators and verify user-visible outcomes, not implementation details.

## App rules

The Astro 7 app (static pages, one React 19 island per page, MapLibre GL JS 6) is the whole repository: `src/`, `scripts/`, `e2e/`, `public/`, `data/`, `worker/`. It is production: `wrangler.toml` serves `dist/` with the `/api/feedback` Worker. See `README.md` for its architecture and `docs/product/REMASTER_PLAN.md` for the plan it was built from. The original Next.js app was removed on 2026-11-18 and remains in the git history.

- **Static only.** Pages are prerendered; the only Worker route stays `/api/feedback`. No request-time compute, no Mapbox, no third-party map hosts.
- **`public/` is a source, not Astro's publicDir.** It holds committed, validated artifacts, some of which must not ship (combined year payloads, the PASDA source). `yarn data` copies what ships into `build/public/` (gitignored), which Astro serves. Never point Astro at `public/` or write generated files there.
- **One store, one URL contract** (`src/atlas/store.ts`). React reads it with `useAtlas`; the MapLibre controller subscribes directly. Do not add a router or a second state library.
- **Sibling tracks go through `src/adapters/*`.** Change an adapter, not its callers, when a track's contract changes. The Classic-atlas style (T6) lives in `src/atlas/classic/`.
- **Tokens.** Edit `src/styles/tokens.ts`, then run `yarn tokens`; the build fails on a stale `tokens.css`, and `tokens.test.ts` enforces AA contrast for every listed pair.
- **Two map styles.** Classic atlas (A) and Modern textbook (B) share components, layer ids and sources; B is tokens under `:root[data-theme='textbook']`, `src/styles/textbook.css` and `src/adapters/textbookStyle.ts`. Never fork a component per theme, and check both themes (`THEME=` for `scripts/shoot.mjs`, `LAYOUT_THEME=` for the layout suites). PA district colours come only from `src/pa/palette.ts`.
- **CSS rules (plan §2.2–2.3):** no `100vh`; edge-anchored UI pads with `var(--safe-*)`; no fixed bottom bars; keep the 1279 px finder collapse, the 860 px two-row header and the colour-scheme pair: `color-scheme: light dark only` on the root (`light dark` makes Safari's Adaptive Dark Mode skip the page; `only` stops Chrome's force-dark) with `body > * { color-scheme: light only }` so nothing renders dark.
- **Border-change animation** (`src/atlas/transition/`, README "Border-change animation") draws in MapLibre's own context through a custom layer and reads colours from the live style: a new map style or a new paint expression on the fill, border, casing or edge-band layers must still evaluate in `transition/paint.ts` (else year changes silently stop animating; `paint.test.ts` checks both styles). Browser suites that do not test it run with reduced motion.
- **Persisted keys are a contract.** Keep `localStorage` keys such as `historic-borders-welcome:2026-remaster`, `historic-borders-settings`, `historic-borders-theme`, `historic-borders-theme:pa` and `hb:map-key-open` unchanged unless a change is intended; renaming one resets every returning visitor.
- **Chromium tests use new headless mode** (`channel: 'chromium'`): the headless shell renders WebGL in software and stalls on full year files.

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
