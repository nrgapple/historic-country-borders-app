# Remaster app guide (`remaster/`)

Read the repository `AGENTS.md`, `docs/product/REMASTER_PLAN.md` and `remaster/README.md` first.

- **This is production.** Since the P4 cutover (2026-11-18), `wrangler.toml` serves `remaster/dist/` and the Deploy workflow builds it. The legacy Next.js app was removed the same day.
- **One lockfile.** `remaster/` is a nohoisted Yarn workspace of the root `package.json`. Add dependencies with `yarn workspace historic-borders-remaster add <pkg>@<exact>`; never create a second lockfile. Use Node ≥ 22.23.4.
- **Static only.** Pages are prerendered; the only Worker route stays `/api/feedback`. No request-time compute, no Mapbox, no third-party map hosts.
- **One store, one URL contract** (`src/atlas/store.ts`). React reads it with `useAtlas`; the MapLibre controller subscribes directly. Do not add a router or a second state library.
- **Sibling tracks go through `src/adapters/*`.** Change an adapter, not its callers, when a track's contract changes.
- **Tokens.** Edit `src/styles/tokens.ts`, then run `yarn --cwd remaster tokens`; the build fails on a stale `tokens.css`, and `tokens.test.ts` enforces AA contrast for every listed pair.
- **Two map styles.** Classic atlas (A) and Modern textbook (B) share components, layer ids and sources; B is tokens under `:root[data-theme='textbook']`, `src/styles/textbook.css` and `src/adapters/textbookStyle.ts`. Never fork a component per theme, and check both themes (`THEME=` for `scripts/shoot.mjs`, `LAYOUT_THEME=` for the layout suites). PA district colours come only from `src/pa/palette.ts`.
- **CSS rules (plan §2.2–2.3):** no `100vh`; edge-anchored UI pads with `var(--safe-*)`; no fixed bottom bars; keep the 1279 px finder collapse, the 860 px two-row header and the colour-scheme pair: `color-scheme: light dark only` on the root (`light dark` makes Safari's Adaptive Dark Mode skip the page; `only` stops Chrome's force-dark) with `body > * { color-scheme: light only }` so nothing renders dark.
- **Checks.** `yarn remaster:test` (use `--maxWorkers=2` on a busy machine), `yarn remaster:build`, `yarn remaster:test:e2e`, and `BASE_URL=http://127.0.0.1:4410 yarn test:layout` with `yarn remaster:preview` running.
- **Chromium tests use new headless mode** (`channel: 'chromium'`): the headless shell renders WebGL in software and stalls on full year files.
