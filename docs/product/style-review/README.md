# Classic-atlas map style (T6)

Status: implemented on branch `t3/classic-atlas-map-style` for remaster track T6 (plan §9.7), integrated with the published outputs of T1 (`t3/historical-data-pipeline` @ `91812f5`), T2 (`t3/build-static-vector-basemap` @ `e63a4c4`) and T3 (`t3/self-host-fonts-glyphs` @ `5db4b01`), which are merged into this branch.

The style module lives at `remaster-spike/src/atlas/classic/` and is re-exported from `remaster-spike/src/atlas/style.ts`, the spike's style-module location. It targets MapLibre GL JS 6.19.

| File             | Holds                                                                                                                                             |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `contract.ts`    | Every source id, source-layer, attribute, URL, fontstack, image and layer id the style reads                                                      |
| `tokens.ts`      | Direction A map colours, the 12 washes with darker edges, the dependency tint                                                                     |
| `options.ts`     | `MapSettings` (same shape as the app's `Settings`), selection, `lowPower`, `projectorText`                                                        |
| `expressions.ts` | Pure expression builders: washes, settings mapping, label sizing, capitals, the waterline rule                                                    |
| `layers.ts`      | The layer stack in plan §2.1 order                                                                                                                |
| `style.ts`       | `classicAtlasStyle()`, `applyStyleOptions()`, `setSelection()`, `addRelief()`, `loadMapFontCss()`                                                 |
| `lowPower.ts`    | The low-power rule and its device heuristic                                                                                                       |
| `markers.ts`     | City dot, capital star-in-circle, ruins ∴ and the per-wash dependency hatch, drawn once on a canvas                                               |
| `neatline.ts`    | Degree-ladder neatline (SVG overlay), a single rule on phones                                                                                     |
| `grain.ts`       | Paper-grain overlay (DOM)                                                                                                                         |
| `legend.ts`      | Legend metadata for the map key: only the classes actually drawn                                                                                  |
| `style.test.ts`  | 38 unit tests: spec validation, washes, dependencies, settings mapping, waterline rule, capitals, legend, manifest drift and T3's fontstack check |

## Contract with T1, T2 and T3

Every producer name lives in `contract.ts`. The tests check it against the producers' own manifests and checks, so a rebuild that moves a URL or renames a layer fails `yarn test`:

- `BASEMAP_TILES`, `RELIEF` and `BASEMAP_LAYER` are checked against `data/basemap-manifest.json`;
- `GLYPHS_URL` and `FONTSTACK` are checked against `data/map-fonts.json`;
- every style variant passes T3's `checkStyleFontstacks`. It also passes `yarn data:validate:fonts --style <style.json>` for the default, selected, Projector-text and low-power variants, while a bogus stack fails it.

**T2, basemap** (`docs/BASEMAP.md`, "Layer contract"). The tiles URL, zoom range, attribution and relief are imported from `data/basemap-manifest.json`; only about 1 kB of it is bundled.

- **Source**: `/tiles/basemap/ne-5.1.2-r1/{z}/{x}/{y}.pbf`, z0–5.
- **`ocean`**: painted over every border layer.
- **`coast`**: carries `landmass_km2`. Water is on the right, so a positive `line-offset` goes seaward, as the waterlines need. Only `landmass_km2 ≥ 5000` gets waterlines.
- **`lakes` and `rivers`**: `rank`, `name`.
- **`marine_labels`**: `name`, `kind`, `rank`. `kind == 'ocean'` is uppercased and widely tracked.
- **Relief**: `/basemap/ne-5.1.2-r1/relief.webp`, an image source with the manifest's `coordinates`. It is added after the first idle.

**T3, glyphs** (`docs/FONTS.md`, "Map fontstacks").

- **Glyphs URL**: `/glyphs/cdf13ca70db8/{fontstack}/{range}.pbf`, pinned as `GLYPHS_URL`. It isn't imported because the manifest's `glyphs` key is 31 kB of per-face data; a test enforces equality.
- **Fontstacks**: each is a single-element `text-font` array.
  - `Alegreya SC Medium` / `Alegreya SC Bold`: states, Bold above 250,000 km² and for the selection.
  - `Alegreya Medium Italic`: seas and oceans.
  - `Alegreya Italic`: rivers, and archaeological-site names.
  - `Alegreya Regular`: cities and capitals.
  - `Atkinson Hyperlegible Next Medium` / `Bold`: Projector text.
- **Site names in italic.** This deliberately differs from T3's suggested use ("Alegreya Regular: city, capital and site names"): the owner asked for italic ruin labels. `Alegreya Italic` carries the same 13 glyph ranges as every other stack, so site names have full coverage.
- **CSS.** Map pages load `/fonts/map-aliases.css`, statically in the spike's `Base.astro` (`mapPage`), and again through `loadMapFontCss()`, which is idempotent. It loads `/fonts/projector.css` only when Projector text is on.

**T1, year data** (`docs/HISTORICAL_DATA.md`, "Split year files").

- **Polygons**: `id` is the shared territory id, set through feature-state on selection. Properties:
  - `c`: wash 0–11;
  - `dep`: 1 for a dependency;
  - `ov`: the overlord id;
  - `oc`: the overlord's wash.
- **Labels**: `n` (name) and `a` (km², so `AREA_TO_KM2 = 1`).
- **Places**: `p` (name) and `k` (`city` or `site`).
- **Capitals**: `public/data/context/<year>.capitals.<hash>.json`, with URLs in `data/historical-capitals.json`. Properties are `name`, `t` (territory id) and `qid`.

The spike's `yarn data` now copies these committed files (`scripts/build-data.mjs`, `scripts/copy-map-assets.mjs`) instead of building stand-ins.

Notes for T1, observed in the review screenshots:

- **Dependency ids.** `setSelection()` finds a selection's dependencies in the loaded tiles (`ov` = selected id). Adding dependency ids to the year index would let the controller pass them through `setSelection(..., dependencyIds)`.
- **British Raj.** In 1914 the British Raj is not marked as a dependency. Its source `SUBJECTO` is "United Kingdom", which is not a feature that year, so it is not tinted or emphasised when the United Kingdom is selected. The United Kingdom and France also share one source colour, so their colonies get the same smalt tint. _Resolved in the data on 2026-11-18:_ a reviewed overlord alias links the British Raj and Hong Kong to the United Kingdom of Great Britain and Ireland, and overlords now get distinct washes (France moves to wash 11 in 1914). See `docs/HISTORICAL_DATA.md` "Overlord aliases" and "Overlord washes".
- **Place names.** "Ziz, Palermo" still shows the source's raw place name. _Resolved in the data on 2026-11-18:_ it is published as "Palermo" (`data/historical-name-overrides.json`).

## What the style draws

- **Washes.** The 12 hand-tinted washes are selected by `c` (0–11); anything else draws the fallback wash. Fills are drawn at 62% at the default opacity setting.
- **Edge bands.** A Grenzkolorit band runs inside every border: 3–9 px of the darker pigment, offset inward, at 50% with a 1.5 px blur.
- **Selection.** Uses a madder fill, an inner band and a line. It is set through feature-state only, so changing the selection never re-tiles the borders.
- **State labels.** Alegreya SC, sized by `log10(km²)` and zoom, with a 13 px floor (projector minimum). The selected territory gets a fixed 18–28 px bold label and the top sort key.
- **Water names.** Seas use Alegreya Medium Italic and rivers Alegreya Italic. Ocean names are uppercase and tracked.
- **Ocean mask.** Painted over every border layer, with a 0.9 px coast stroke.
- **Waterline rule** (plan §9.2 P3). Four lines below z3.5, two up to z5, none from z5. They are layer `maxzoom`s, opacity ramps down with zoom, and only rings of at least 5,000 km² get them.
- **Other decoration.** A 10° graticule, the degree-ladder neatline (a single rule on phones), relief after first paint, and paper grain.

Owner additions:

- **Dependency tint.**
  - A dependency (`dep: 1`) takes a lighter tint of its overlord's wash: the overlord's fill diluted 40% toward bare land. Its edge band uses the overlord's darker pigment at 35%.
  - A fine diagonal hatch in the overlord's pigment is added, and dropped in low-power mode.
  - Selecting the overlord lightly emphasises its dependencies with a light madder fill and a 0.7–1.4 px madder line, through feature-state.
- **Capitals.**
  - Capitals are drawn as an atlas star-in-circle with an Alegreya Regular label.
  - The selected territory's capital is always drawn. Its star is an icon-only layer on top that ignores placement, so it shows even under its own country's name and never displaces a label. Its name is placed when there is room.
  - Other capitals appear from `CAPITAL_MINZOOM = 4`. In the review, z3.5 adds clutter, while at z4 the 1914 Europe view gains Berlin, Paris, Belgrade, Bucharest, Athens and Algiers and drops no state name (`capitals-1914-z3.5.png` / `-z4.png` / `-z4.5.png`).
- **Ruins.** An archaeological site (`k: 'site'`) is drawn with the ∴ mark and an Alegreya Italic label ending in "(ruins)", distinct from a city's ink dot and roman label.
- **Legend metadata.** `legendEntries(drawnClasses(map))` returns entries in key order for: selected territory, ruled by the selected territory, dependency, capital, city and archaeological site. Each entry is listed only when that class is on screen. Call it on `moveend`/`idle`, never per frame.

**Settings mapping** (`applyStyleOptions(map, options)`; MapLibre skips unchanged values):

| Setting                           | Style effect                                                                                                    |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `textSize` small / medium / large | All map labels ×0.9 / ×1 / ×1.3, never below 13 px                                                              |
| `textCase` upper                  | `text-transform: uppercase` on state names, +0.04 em tracking                                                   |
| `countryOpacity` 0.1–1            | Fill opacity × 0.886 (0.7 → the mock's 62%). Selected +0.30, overlord's dependencies +0.15                      |
| `borderThickness` 0–4             | Ink border × thickness/2 (2 → the mock's 0.5–1.1 px; 0 hides it). The selection line never drops below 1.6–3 px |
| `showLabels` false                | Hides state names, places and capitals; water names stay                                                        |
| `projectorText` (P2 setting)      | Every fontstack → Atkinson Hyperlegible Next, state names uppercase, ×1.1 size                                  |

## Screenshots

Taken on the real T1/T2/T3 data with `node remaster-spike/scripts/style-review.mjs` against `yarn build` output, with no page errors or failed requests (the script reports any 4xx/5xx) on the review page `/review/<year>`, a full-bleed map with the neatline and grain. Desktop is 1440×900 @1x and phone is 390×844 @2x, framed as in the design mocks. The review page has no panel, so the desktop map runs under the space the mock gives the panel.

| View                                                        | File                                                                                   |
| ----------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 1492, Ottoman Empire selected, desktop                      | `1492-desktop.png`                                                                     |
| 1492, Ottoman Empire selected, phone                        | `1492-phone.png`                                                                       |
| 1914, desktop, dependency tint                              | `1914-desktop.png`                                                                     |
| 1914, phone, Africa                                         | `1914-phone.png`                                                                       |
| 1914, United Kingdom selected (its dependencies emphasised) | `1914-desktop-uk-selected.png`                                                         |
| 1914, France selected                                       | `1914-desktop-france-selected.png`                                                     |
| Capital zoom review                                         | `capitals-1914-z3.5.png`, `-z4.png`, `-z4.5.png`                                       |
| Waterline rule, Aegean at z4.2 and z5 (phone)               | `aegean-phone-z4.png`, `aegean-phone-z5.png`                                           |
| Low power, Projector text, Settings variants                | `1492-desktop-lowpower.png`, `1492-desktop-projector.png`, `1914-desktop-settings.png` |

Compared with `design/living-atlas/shots/a-classic-atlas-*.png`, the render keeps the mock's character: the same washes, edge bands, madder selection, small-caps hierarchy, ocean over borders, waterlines and neatline. Differences:

- **Places.** The mock shows a curated list of 16 cities. The style draws every place, with collision, so more city names appear. A place rank belongs to T1.
- **Capital marker.** The mock marked the capital with a ring and dot. The owner-approved star-in-circle replaces it.

## Per-decoration cost

Measured 2026-11-18 with `node remaster-spike/scripts/profile-style.mjs` against `yarn build` output, before T1/T2/T3 were merged. The stand-ins then in use carried the same content: the same 1:50m Natural Earth layers and relief, the same historical polygons converted by the spike, and Alegreya glyph PBFs. The decorations' relative costs therefore carry over; P0 re-measures on the Chromebook. Raw data is in `remaster-spike/results/style-profile-cpu{1,4}x.{json,txt}`.

**Method.**

- Full Chromium in new-headless mode, on the host GPU (Apple M4, ANGLE Metal).
- Vsync and the frame-rate limiter are off, and the page is 1440×900 at 2× (2880×1800 drawn pixels, the controller's DPR cap).
- Each frame of three linear animated pans (like a drag) is recorded twice:
  - **map**: MapLibre's render pass closed with `gl.finish()`, so it covers CPU plus GPU work;
  - **frame**: the rAF interval, which also covers compositing and the DOM overlays.
- Each configuration hides ONE decoration. Its cost is the baseline median minus that configuration's median.
- Each configuration runs 3 rotating rounds of about 150 frames, after a discarded warm-up.
- The 1× run isolates GPU work. The 4× run throttles the main thread as a proxy for a school Chromebook's CPU.

**Caveat.** SwiftShader, the usual software-GL proxy for a weak iGPU, hangs in headless Chromium on this host, so no software-GL number exists. Plan P0 must repeat this on the real Chromebook.

**Median ms saved per frame by dropping each decoration** (a positive value is that decoration's cost). Baselines: 1492 at 1× is 4.5 ms map / 3.7 ms frame and at 4× is 27.8 / 15.7. 1914 at 1× is 5.2 / 4.5.

| Decoration                       | 1492 @1× map / frame | 1914 @1× map / frame | 1492 @4× map / frame | Verdict                        |
| -------------------------------- | -------------------: | -------------------: | -------------------: | ------------------------------ |
| Edge bands                       |            0.3 / 0.2 |            0.4 / 0.3 |           −1.0 / 2.7 | Keep: the main "alive" cue     |
| Waterlines, all 4                |            0.2 / 0.1 |            0.6 / 0.4 |           −0.6 / 1.6 |                                |
| Waterlines 2–4 (keep innermost)  |            0.3 / 0.2 |            0.7 / 0.6 |            2.3 / 2.0 | **Drop in low power**          |
| Relief                           |            0.4 / 0.5 |            0.5 / 0.5 |            0.4 / 0.8 | Keep: loaded after first paint |
| Graticule                        |            0.4 / 0.2 |            0.9 / 0.6 |            1.1 / 3.2 | Keep: orientation              |
| Selection band + line            |            0.1 / 0.1 |            0.6 / 0.7 |            2.0 / 1.8 | Keep: content, not decoration  |
| Dependency hatch                 |            0.1 / 0.2 |            0.5 / 0.4 |            0.3 / 0.5 | **Drop in low power**          |
| Paper grain (DOM multiply)       |            0.0 / 0.1 |            0.5 / 0.4 |            2.3 / 2.6 | **Drop in low power**          |
| Neatline ladder (DOM SVG)        |            0.2 / 0.4 |            0.2 / 0.5 |            0.7 / 7.5 | **Single rule in low power**   |
| The map-layer part of `lowPower` |            0.4 / 0.3 |            0.9 / 0.7 |            4.0 / 3.7 |                                |

**Reading the numbers.**

- On a capable GPU every map decoration is under 1 ms, near the noise floor. The 1914 run at 4× CPU was noise-dominated: its baseline varied by more than the effects, with "savings" from −10.8 to +4.4 ms. It is in the raw data but not in the table.
- **The neatline was the single largest cost.** In the first profile, rebuilding its SVG on every `move` cost 4.7 ms per frame on 1492 and 12.4 ms on 1914 at 1× (`remaster-spike/results/style-profile-before-neatline-fix-cpu1x.txt`. That earlier run panned with per-frame jumps rather than animated legs; the old neatline rebuilt on every `move` either way). It now translates its two ladder groups while panning at constant zoom, and rebuilds only on zoom change, `moveend` and resize. That cut it to about 0.5 ms at 1×. At 4× the SVG repaint still costs about 7.5 ms per frame, so low-power mode draws the single rule phones already use.
- **The low-power rule** (`lowPower.ts`) drops:
  - waterlines 2–4, keeping only the innermost;
  - the dependency hatch (the lighter tint still marks dependencies);
  - the paper grain;
  - the neatline ladder, which becomes a single rule.

  It keeps edge bands, relief, graticule and the selection. On 1492 at 4× CPU the map-layer part saves 4.0 ms of map time (14%). The grain and ladder add about 2.6 and 7.5 ms of frame time.

- **The low-power default** comes from `prefersLowPower()`. It is on for software GL (SwiftShader, llvmpipe), for devices with ≤ 4 cores and ≤ 4 GB, for Save-Data, and for `prefers-reduced-transparency`. The app can override it, and the P0 Chromebook profile should confirm or adjust it.

## Reproduce

```bash
cd remaster-spike
source ~/.nvm/nvm.sh && nvm use 22.23.5
yarn install --frozen-lockfile
yarn data            # copies T1 split files, T2 basemap and T3 glyphs/fonts from the repo
yarn test --maxWorkers=2   # 38 style tests
(cd .. && yarn data:validate:fonts --style <style.json>)
yarn build && node scripts/serve.mjs dist 4400 &
node scripts/style-review.mjs http://127.0.0.1:4400          # screenshots into this folder
node scripts/profile-style.mjs http://127.0.0.1:4400 --cpu=1 # and --cpu=4
```

The review page is `/review/1492` or `/review/1914`. It takes these query parameters:

- `place=<name>`;
- `fit=w,s,e,n` and `pad=t,r,b,l`;
- `lowPower=0|1`;
- `projector=1`;
- `text=small|medium|large`;
- `case=upper`;
- `opacity=`;
- `border=`;
- `labels=0`;
- `grain=0` and `neatline=0`.
