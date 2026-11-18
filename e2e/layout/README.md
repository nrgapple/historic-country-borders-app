# Layout acceptance suites

These Playwright suites implement the acceptance checks in `docs/product/REMASTER_PLAN.md`:

- `safe-area.spec.ts` covers §9.4, iPhone and Pixel safe areas.
- `responsive.spec.ts` covers §9.5, widths from 390 to 1440 px.
- `forced-dark.spec.ts` covers §9.6, forced dark mode and a dark preference.

They use their own config, `playwright.layout.config.ts`, apart from the app's journeys (`yarn remaster:test:e2e`).

## Running

```bash
yarn remaster:build && yarn test:layout             # the config serves remaster/dist on :4410
BASE_URL=http://127.0.0.1:4412 yarn test:layout     # an already running server; nothing is started
LAYOUT_THEME=textbook BASE_URL=… yarn test:layout   # every page in one map style (classic|textbook)
yarn test:layout --project='safe-area:*'            # one suite (or 'responsive:*', 'forced-dark:*')
```

The suites intercept every third-party request:

- Mapbox (which the app no longer uses) would get an empty style, so no metered loads can happen.
- Wikipedia gets a fixed summary.
- Every other off-origin request is aborted.

Map data on the app's own origin is static and is served unchanged, so layouts are measured with real place names and panel content.

Screenshots for each case are attached to the HTML report in `playwright-report/layout/`.

## What the suites check

**Safe area.** Seven projects run:

- iPhone 15 Pro portrait, iPhone 15 Pro landscape, and iPhone SE, each in WebKit and in Chromium;
- Pixel 7 in Chromium.

Each project checks five pages. For each page it runs three cases: at rest, and after toolbar resizes of −80 px and +80 px.

- Every visible control, text block, year heading, and map attribution stays inside the viewport minus the insets.
- No `position: fixed` element sits over the home indicator.
- The phone place panel's controls end above the home indicator (its paper may run to the screen edge).
- The year heading moves less than 4 px when the toolbar resizes.
- The HTML has `viewport-fit=cover`, and first-party CSS has no `100vh`.

The insets are simulated differently in each engine:

- **Chromium** sets real `env()` values through CDP's `Emulation.setSafeAreaInsetsOverride`.
- **WebKit** cannot inject `env()`. The page reads `--test-inset-*` custom properties through `max(env(...), var(--test-inset-*, 0px))`.
  - The app does this through its `--safe-*` tokens.
  - For an app without the hook, the suite rewrites `env(safe-area-inset-*)` in served CSS and HTML to the same expression. The served files are rewritten only in the test.

Devices render at 1× scale. Layout is in CSS px, and a 3× WebGL map is slow in software rendering.

**Responsive.** The suite runs at 390, 744, 820, 1024, 1180, 1366, and 1440 px, in both Chromium and WebKit, with touch emulation up to 1180 px. Each map page is checked in four states: default, projector mode, settings open, and place finder expanded. The 404 page is checked in the default state only. The checks are:

- no horizontal overflow;
- every control lies within `[0, innerWidth]`;
- no two visible controls overlap;
- non-modal overlays (the panel, popovers, `<details>`) don't cover the top bar's controls;
- the year is never clipped.

A control is checked for overlap only if a hit test at its center reaches it. Controls that an overlay covers on purpose, such as the expanded search field over its row, are left out of that check. The overlay check then decides whether the overlay may cover them.

**Forced dark.** Chromium runs with `--enable-features=WebContentsForceDark` and WebKit with `colorScheme: 'dark'`. Each run checks:

- the `color-scheme` meta tag and `:root` read `light dark only`: `light dark` makes Safari's Adaptive Dark Mode skip the page and `only` stops Chrome's force-dark (everything inside `<body>` is pinned to `light only`);
- the backgrounds of the body, top bar, and place panel match a light-mode reference load.

Chromium also compares a top-bar screenshot against a browser without force-dark, and allows at most 1% of pixels to change. A self-test first confirms that force-dark really darkens an unprotected white page, so the pixel check can't pass vacuously.

## Hooks for the remaster

- Mark the visible year with `data-year-heading`. Today's `.timeline__current-value` and `.projector-caption__title` also work.
- Map attribution is found through `.maplibregl-ctrl-attrib`, `.mapboxgl-ctrl-attrib`, or `[data-attribution]`.
- Read `--test-inset-*` in the global tokens file, as §2.2 describes.
- The pages under test are listed in `LAYOUT_PAGES` in `support.ts`.
